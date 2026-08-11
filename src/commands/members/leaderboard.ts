import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, baseEmbed, rankEmoji } from '../../utils/embeds';

export default {
  category: 'members',
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 membros do servidor por nível e XP'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const top = await prisma.member.findMany({ orderBy: [{ level: 'desc' }, { xp: 'desc' }], take: 10 });
    if (!top.length) return interaction.editReply({ embeds: [baseEmbed().setTitle('🏆 Ranking').setDescription('Nenhum membro encontrado.')] });

    const medals = ['🥇', '🥈', '🥉'];
    const list = top.map((m, i) =>
      `${medals[i] ?? `**${i + 1}.**`} ${rankEmoji(m.rank)} **${m.username}** — Nv **${m.level}** • ${m.xp} XP`
    ).join('\n');

    const userPos = await prisma.member.count({ where: { OR: [{ level: { gt: 0 } }] } });
    const myRank = top.findIndex(m => m.discordId === interaction.user.id) + 1;

    const embed = baseEmbed(COLORS.GOLD)
      .setTitle(`🏆 Ranking — Aliança Skyline`)
      .setDescription(list)
      .setThumbnail(interaction.guild?.iconURL() ?? null)
      .setFooter({ text: `${myRank > 0 ? `Sua posição: #${myRank}` : 'Você não está no top 10'} • ⚔️ Aliança Skyline` });

    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;
