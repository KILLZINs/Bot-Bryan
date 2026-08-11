import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember, checkModerator } from '../../utils/helpers';
import { COLORS, EMOJIS, successEmbed, errorEmbed } from '../../utils/embeds';

export default {
  category: 'feedback',
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Sistema de feedback e sugestões')
    .addSubcommand((sub) =>
      sub
        .setName('enviar')
        .setDescription('Envia um feedback para a equipe da aliança')
        .addStringOption((opt) => opt.setName('conteudo').setDescription('Seu feedback').setRequired(true).setMaxLength(1000))
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('[MOD] Lista feedbacks recebidos')
        .addStringOption((opt) => opt.setName('status').setDescription('Filtrar por status').addChoices(
          { name: 'Pendente', value: 'PENDING' },
          { name: 'Revisado', value: 'REVIEWED' },
          { name: 'Implementado', value: 'IMPLEMENTED' },
        ))
    )
    .addSubcommand((sub) =>
      sub
        .setName('atualizar')
        .setDescription('[MOD] Atualiza o status de um feedback')
        .addStringOption((opt) => opt.setName('id').setDescription('ID do feedback').setRequired(true))
        .addStringOption((opt) => opt.setName('status').setDescription('Novo status').setRequired(true).addChoices(
          { name: 'Revisado', value: 'REVIEWED' },
          { name: 'Implementado', value: 'IMPLEMENTED' },
        ))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'enviar') {
      const content = interaction.options.getString('conteudo', true);
      const member = await getOrCreateMember(interaction.user.id, interaction.user.username);
      const fb = await prisma.feedback.create({ data: { memberId: member.id, content } });

      await interaction.reply({
        embeds: [successEmbed('Feedback Enviado!', `Seu feedback foi registrado. Obrigado pela contribuição!\n\n🆔 ID: \`${fb.id.slice(0, 8)}\``)],
        ephemeral: true,
      });

    } else if (sub === 'listar') {
      if (!(await checkModerator(interaction))) return;
      const status = interaction.options.getString('status') ?? 'PENDING';
      const items = await prisma.feedback.findMany({ where: { status }, include: { member: true }, orderBy: { createdAt: 'desc' }, take: 10 });

      if (!items.length) {
        await interaction.reply({ embeds: [successEmbed('Sem Feedbacks', `Nenhum feedback com status "${status}".`)], ephemeral: true });
        return;
      }

      const statusEmoji: Record<string, string> = { PENDING: '⏳', REVIEWED: '👀', IMPLEMENTED: '✅' };
      const list = items.map((f) => `${statusEmoji[f.status]} **${f.member.username}** — \`${f.id.slice(0, 8)}\`\n└ ${f.content.slice(0, 100)}`).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`💬 Feedbacks — ${status}`)
        .setDescription(list)
        .setFooter({ text: `${items.length} feedback(s) • ⚔️ Aliança Skyline` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'atualizar') {
      if (!(await checkModerator(interaction))) return;
      const id = interaction.options.getString('id', true);
      const status = interaction.options.getString('status', true);

      const fb = await prisma.feedback.findFirst({ where: { id: { startsWith: id } } });
      if (!fb) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrado', 'ID inválido.')], ephemeral: true });
        return;
      }

      await prisma.feedback.update({ where: { id: fb.id }, data: { status } });
      await interaction.reply({ embeds: [successEmbed('Status Atualizado', `Feedback \`${id}\` marcado como **${status}**.`)], ephemeral: true });
    }
  },
} satisfies Command;
