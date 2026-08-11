import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember, checkModerator } from '../../utils/helpers';
import { COLORS, EMOJIS, successEmbed, errorEmbed } from '../../utils/embeds';

export default {
  category: 'feedback',
  data: new SlashCommandBuilder()
    .setName('sugestao')
    .setDescription('Sistema de sugestões da aliança')
    .addSubcommand((sub) =>
      sub
        .setName('enviar')
        .setDescription('Envia uma sugestão para a aliança')
        .addStringOption((opt) => opt.setName('conteudo').setDescription('Sua sugestão').setRequired(true).setMaxLength(1000))
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista as sugestões enviadas')
        .addStringOption((opt) =>
          opt.setName('status').setDescription('Filtrar por status').addChoices(
            { name: 'Pendente', value: 'PENDING' },
            { name: 'Aprovada', value: 'APPROVED' },
            { name: 'Rejeitada', value: 'REJECTED' }
          )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('aprovar')
        .setDescription('[MOD] Aprova uma sugestão')
        .addStringOption((opt) => opt.setName('id').setDescription('ID da sugestão').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('rejeitar')
        .setDescription('[MOD] Rejeita uma sugestão')
        .addStringOption((opt) => opt.setName('id').setDescription('ID da sugestão').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'enviar') {
      const content = interaction.options.getString('conteudo', true);
      const member = await getOrCreateMember(interaction.user.id, interaction.user.username);
      const sug = await prisma.suggestion.create({ data: { memberId: member.id, content } });

      await interaction.reply({
        embeds: [successEmbed('Sugestão Enviada!', `Sua sugestão foi registrada!\n\n🆔 ID: \`${sug.id.slice(0, 8)}\`\n\nA equipe irá analisar em breve.`)],
        ephemeral: true,
      });

    } else if (sub === 'listar') {
      const status = interaction.options.getString('status') ?? 'PENDING';
      const items = await prisma.suggestion.findMany({
        where: { status },
        include: { member: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (!items.length) {
        await interaction.reply({ embeds: [errorEmbed('Sem Sugestões', `Nenhuma sugestão com status "${status}".`)], ephemeral: true });
        return;
      }

      const statusEmoji: Record<string, string> = { PENDING: '⏳', APPROVED: '✅', REJECTED: '❌' };
      const list = items
        .map((s) => `${statusEmoji[s.status]} **${s.member.username}** — \`${s.id.slice(0, 8)}\`\n└ ${s.content.slice(0, 100)}`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`💡 Sugestões — ${status}`)
        .setDescription(list)
        .setFooter({ text: `${items.length} sugestão(ões) • ⚔️ Aliança Skyline` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'aprovar') {
      if (!(await checkModerator(interaction))) return;
      const id = interaction.options.getString('id', true);
      const sug = await prisma.suggestion.findFirst({ where: { id: { startsWith: id } } });
      if (!sug) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrada', 'ID inválido.')], ephemeral: true });
        return;
      }
      await prisma.suggestion.update({ where: { id: sug.id }, data: { status: 'APPROVED' } });
      await interaction.reply({ embeds: [successEmbed('Sugestão Aprovada', `A sugestão \`${id}\` foi **aprovada**! 🎉`)] });

    } else if (sub === 'rejeitar') {
      if (!(await checkModerator(interaction))) return;
      const id = interaction.options.getString('id', true);
      const sug = await prisma.suggestion.findFirst({ where: { id: { startsWith: id } } });
      if (!sug) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrada', 'ID inválido.')], ephemeral: true });
        return;
      }
      await prisma.suggestion.update({ where: { id: sug.id }, data: { status: 'REJECTED' } });
      await interaction.reply({ embeds: [successEmbed('Sugestão Rejeitada', `A sugestão \`${id}\` foi **rejeitada**.`)], ephemeral: true });
    }
  },
} satisfies Command;
