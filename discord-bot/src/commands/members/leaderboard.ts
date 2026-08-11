import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS, rankEmoji } from '../../utils/embeds';

const MEDALS = ['🥇', '🥈', '🥉'];

export default {
  category: 'members',
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostra o ranking de XP da aliança')
    .addStringOption((opt) =>
      opt
        .setName('tipo')
        .setDescription('Tipo de ranking')
        .addChoices(
          { name: 'XP / Nível', value: 'xp' },
          { name: 'Moedas', value: 'coins' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const tipo = interaction.options.getString('tipo') ?? 'xp';

    const members = await prisma.member.findMany({
      orderBy: tipo === 'xp' ? [{ level: 'desc' }, { xp: 'desc' }] : [{ coins: 'desc' }],
      take: 10,
    });

    if (!members.length) {
      await interaction.reply({ content: 'Nenhum membro registrado ainda.', ephemeral: true });
      return;
    }

    const userPos = members.findIndex((m) => m.discordId === interaction.user.id);

    const list = members
      .map((m, i) => {
        const medal = MEDALS[i] ?? `**${i + 1}.**`;
        const value = tipo === 'xp' ? `Nível ${m.level} | ${m.xp} XP` : `${m.coins} 💜`;
        return `${medal} ${rankEmoji(m.rank)} **${m.username}** — ${value}`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`${EMOJIS.TROPHY} Ranking — ${tipo === 'xp' ? 'XP / Nível' : 'Moedas'}`)
      .setDescription(list)
      .setFooter({
        text: userPos >= 0 ? `Sua posição: #${userPos + 1} • ⚔️ Aliança Skyline` : '⚔️ Aliança Skyline',
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
