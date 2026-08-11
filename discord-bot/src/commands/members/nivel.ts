import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command, xpForNextLevel } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember } from '../../utils/helpers';
import { COLORS, EMOJIS, levelBar, rankEmoji, colorFromLevel } from '../../utils/embeds';

export default {
  category: 'members',
  data: new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('Veja seu nível ou o de outro membro')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Membro para consultar').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('usuario') ?? interaction.user;
    const member = await getOrCreateMember(target.id, target.username);
    const xpNeeded = xpForNextLevel(member.level);
    const bar = levelBar(member.xp, xpNeeded);
    const rankPos = await prisma.member.count({ where: { level: { gt: member.level } } });

    const embed = new EmbedBuilder()
      .setColor(colorFromLevel(member.level))
      .setTitle(`${EMOJIS.LEVEL} Nível de ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .setDescription(
        `${rankEmoji(member.rank)} **${member.rank}**\n\n` +
        `**Nível ${member.level}** — XP: ${member.xp}/${xpNeeded}\n` +
        `\`${bar}\`\n\n` +
        `📊 Posição no ranking: **#${rankPos + 1}**`
      )
      .setFooter({ text: '⚔️ Aliança Skyline' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
