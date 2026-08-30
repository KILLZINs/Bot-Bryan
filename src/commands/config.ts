import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  GuildMember,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { PrismaClient, GuildConfig } from '@prisma/client';
import { Command } from '../types';
import { errorEmbed } from '../utils/embeds';
import { getBotConfig, intToHex, BotConfigData } from '../utils/botConfig';

// Singleton do Prisma embutido para controle seguro de conexões
declare global {
  var prismaInstance: PrismaClient | undefined;
}
const prisma = globalThis.prismaInstance ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prismaInstance = prisma;

export default {
  category: 'sistema',
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Painel Central: configure canais, tickets, cargos e módulos do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    // 1. Camada de Segurança: Validação de Servidor
    if (!interaction.guild || !interaction.guildId || !interaction.member) {
      return interaction.reply({
        embeds: [errorEmbed('Comando Inválido', 'Este comando só pode ser utilizado dentro de servidores.')],
        ephemeral: true,
      });
    }

    // 2. Camada de Segurança: Validação de Permissão de Administrador
    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: [errorEmbed('Acesso Negado', 'Apenas Administradores do servidor podem alterar as configurações.')],
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const guildName = interaction.guild.name;

    await interaction.deferReply({ ephemeral: true });

    // 3. Camada de Persistência: Carrega ou Cria configuração no Banco
    let cfg: GuildConfig;
    try {
      cfg = await prisma.guildConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
      });
    } catch (err) {
      console.error('[ERRO BANCO /config]:', err);
      return interaction.editReply({
        embeds: [errorEmbed('Erro no Banco', 'Não foi possível carregar as configurações do servidor.')],
      });
    }

    // Função de Renderização da Embed do Painel Geral
    const buildMainEmbed = (c: GuildConfig): EmbedBuilder => {
      const formatChan = (id: string | null) => (id ? `<#${id}>` : '`Não definido`');
      const formatRole = (id: string | null) => (id ? `<@&${id}>` : '`Não definido`');
      const formatBool = (val: boolean) => (val ? '🟢 `Ativo`' : '🔴 `Desativado`');

      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`⚙️ Painel de Controle Geral — ${guildName}`)
        .setDescription('Configure e gerencie todas as funções, sistemas e módulos ativos neste servidor.')
        .addFields(
          {
            name: '🎫 Sistema de Suporte & Tickets',
            value: `**Categoria dos Tickets:** ${formatChan(c.ticketCategoryId)}\n**Canal de Logs de Tickets:** ${formatChan(c.ticketLogChannelId)}`,
            inline: false,
          },
          {
            name: '📢 Canais Principais',
            value: `**Feed/Instagram:** ${formatChan(c.feedChannelId)}\n**Boas-Vindas:** ${formatChan(c.welcomeChannelId)}\n**Anúncios:** ${formatChan(c.announcementChannelId)}\n**Logs Gerais:** ${formatChan(c.logChannelId)}\n**Sugestões:** ${formatChan(c.suggestionChannelId)}\n**Feedback:** ${formatChan(c.feedbackChannelId)}`,
            inline: true,
          },
          {
            name: '🛡️ Cargos do Sistema',
            value: `**Admin:** ${formatRole(c.adminRoleId)}\n**Moderador:** ${formatRole(c.modRoleId)}\n**Membro:** ${formatRole(c.memberRoleId)}\n**Silenciado:** ${formatRole(c.mutedRoleId)}\n**Auto-Role:** ${formatRole(c.autoRoleId)}`,
            inline: true,
          },
          {
            name: '⚔️ RPG & Leveling',
            value: `**Canal de Level Up:** ${formatChan(c.levelUpChannelId)}\n**Sistema de XP:** 🌐 Global (Padronizado)`,
            inline: false,
          },
          {
            name: '🔒 Segurança & Auto-Mod',
            value: `**Anti-Spam:** ${formatBool(c.antiSpam)} | **Anti-Links:** ${formatBool(c.antiLinks)}`,
            inline: false,
          },
          {
            name: '🧩 Módulos do Bot',
            value:
              `Leveling: ${formatBool(c.featLeveling)} | RPG: ${formatBool(c.featRpg)} | Tickets: ${formatBool(c.featTickets)}\n` +
              `Sorteios: ${formatBool(c.featGiveaways)} | Enquetes: ${formatBool(c.featPolls)} | Auto-Cargos: ${formatBool(c.featSelfRole)}\n` +
              `Missões: ${formatBool(c.featMissions)} | Social: ${formatBool(c.featSocial)} | Economia: ${formatBool(c.featEconomy)}\n` +
              `Moderação: ${formatBool(c.featMod)} | Anúncios: ${formatBool(c.featAnnouncements)} | Música: ${formatBool(c.featMusic)}`,
            inline: false,
          }
        )
        .setFooter({ text: 'Painel seguro • Expira após 3 minutos de inatividade' })
        .setTimestamp();
    };

    // Menu Principal de Categorias
    const buildMainMenuRow = (): ActionRowBuilder<StringSelectMenuBuilder> => {
      return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('cfg_menu_category')
          .setPlaceholder('Escolha o módulo que deseja configurar...')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Sistema de Tickets')
              .setDescription('Configurar Categoria onde abrem os tickets e canal de logs')
              .setEmoji('🎫')
              .setValue('cat_tickets'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Level Up & Anúncios de Nível')
              .setDescription('Configurar canal ou fórum de notificações de Level Up')
              .setEmoji('⭐')
              .setValue('cat_rpg_leveling'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Canais do Servidor')
              .setDescription('Configurar Feed/Instagram, boas-vindas, logs, anúncios, sugestões, etc.')
              .setEmoji('📢')
              .setValue('cat_channels'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Cargos do Servidor')
              .setDescription('Configurar cargos de staff, auto-role, membros e silenciados')
              .setEmoji('🛡️')
              .setValue('cat_roles'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Segurança & Auto-Mod')
