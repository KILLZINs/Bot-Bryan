// ════════════════════════════════════════════════════════════════════════════
// COMANDO /vip — Sistema de Cargos VIP Personalizados
// ════════════════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, Guild, GuildMember, ChannelType } from 'discord.js';
import { Command } from '../types';
import { prisma } from '../database/client';
import { errorEmbed } from '../utils/embeds';
import { checkAdmin } from '../utils/permissions';
import { buildVipPanel, buildVipAdminPanel } from '../handlers/vipHandler';
import { createTicketForUser, findOpenTicket } from '../utils/ticketCreation';

async function getGuildCategory(guild: Guild, channelId: string | null | undefined) {
  if (!channelId) return null;
  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  return channel?.type === ChannelType.GuildCategory ? channel : null;
}

export default {
  category: 'utilidade',
  data: new SlashCommandBuilder()
    .setName('vip')
    .setDescription('Sistema de cargos VIP personalizados')
    .addSubcommand(sub =>
      sub.setName('painel').setDescription('Abrir seu painel VIP (criar e gerenciar seus cargos personalizados)')
    )
    .addSubcommand(sub =>
      sub.setName('config').setDescription('Configurar os cargos que dão acesso ao sistema VIP (Admin)')
    )
    .addSubcommand(sub =>
      sub.setName('personalizar').setDescription('Abrir um ticket para solicitar cor em gradiente')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'config') {
      if (!(await checkAdmin(interaction))) return;
      const { embed, rows } = await buildVipAdminPanel(interaction.guild!);
      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }

    if (sub === 'personalizar') {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild!;
      const member = interaction.member as GuildMember;
      const vipConfigs = await prisma.vipConfig.findMany({ where: { guildId: guild.id } });
      if (!vipConfigs.some(vc => member.roles.cache.has(vc.roleId))) {
        return interaction.editReply({
          embeds: [errorEmbed('Sem Acesso VIP', 'Você não possui um cargo VIP neste servidor.')],
        });
      }

      const vipConfig = await prisma.vipGuildConfig.findUnique({ where: { guildId: guild.id } });
      const categoryId = vipConfig?.gradientTicketCategoryId;
      const category = await getGuildCategory(guild, categoryId);
      if (!categoryId || !category) {
        return interaction.editReply({
          embeds: [errorEmbed('Gradiente não configurado', 'A categoria de tickets para personalização ainda não foi configurada pelos responsáveis do servidor.')],
        });
      }

      const existing = await findOpenTicket(guild, interaction.user.id, 'vip_gradiente');
      if (existing) {
        const channel = guild.channels.cache.get(existing.channelId);
        return interaction.editReply({
          embeds: [errorEmbed('Ticket Existente', channel ? `Você já tem um ticket aberto: ${channel}` : 'Você já tem um ticket aberto.')],
        });
      }

      const { success } = await createTicketForUser(guild, interaction.user, 'vip_gradiente', {
        parentId: categoryId,
        title: '🎨 Personalização de Gradiente',
        description:
          `Olá ${interaction.user}! Este ticket é para solicitar um cargo VIP com cor em gradiente.\n\n` +
          'Envie as duas ou mais cores desejadas, o nome do cargo e qualquer referência visual. A equipe vai aplicar o gradiente manualmente.',
      });
      return interaction.editReply({ embeds: [success] });
    }

    // sub === 'painel'
    await interaction.deferReply({ ephemeral: true });

    const guild  = interaction.guild!;
    const member = interaction.member as GuildMember;

    // Verifica se o usuário tem algum cargo VIP configurado
    const vipConfigs = await prisma.vipConfig.findMany({ where: { guildId: guild.id } });
    const hasVip = vipConfigs.some(vc => member.roles.cache.has(vc.roleId));

    if (!hasVip) {
      return interaction.editReply({
        embeds: [errorEmbed('Sem Acesso VIP', 'Você não possui um cargo VIP neste servidor.\nFale com um administrador para obter acesso.')],
      });
    }

    const { embed, rows } = await buildVipPanel(guild, interaction.user.id);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
} satisfies Command;
