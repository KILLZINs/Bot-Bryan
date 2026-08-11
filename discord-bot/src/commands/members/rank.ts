import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command, RANKS } from '../../types';
import { prisma } from '../../database/client';
import { checkModerator, getOrCreateMember } from '../../utils/helpers';
import { successEmbed, errorEmbed, rankEmoji } from '../../utils/embeds';

export default {
  category: 'members',
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Gerencia o rank de um membro')
    .addSubcommand((sub) =>
      sub
        .setName('definir')
        .setDescription('[MOD] Define o rank de um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('rank')
            .setDescription('Novo rank')
            .setRequired(true)
            .addChoices(...RANKS.map((r) => ({ name: r, value: r })))
        )
    )
    .addSubcommand((sub) =>
      sub.setName('lista').setDescription('Lista todos os ranks disponíveis')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'definir') {
      if (!(await checkModerator(interaction))) return;

      const target = interaction.options.getUser('usuario', true);
      const newRank = interaction.options.getString('rank', true);

      await getOrCreateMember(target.id, target.username);
      await prisma.member.update({ where: { discordId: target.id }, data: { rank: newRank } });

      await interaction.reply({
        embeds: [
          successEmbed(
            'Rank Atualizado',
            `${target} agora é ${rankEmoji(newRank)} **${newRank}**!`
          ),
        ],
      });

    } else if (sub === 'lista') {
      const list = RANKS.map((r, i) => `**${i + 1}.** ${rankEmoji(r)} ${r}`).join('\n');
      await interaction.reply({
        embeds: [
          {
            color: 0x9b59b6,
            title: '🏅 Ranks da Aliança Skyline',
            description: list,
            footer: { text: '⚔️ Aliança Skyline' },
          },
        ],
      });
    }
  },
} satisfies Command;
