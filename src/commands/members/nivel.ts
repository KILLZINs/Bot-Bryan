import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { baseEmbed, rankEmoji, levelBar, colorFromLevel } from '../../utils/embeds';
import { getOrCreateMember } from '../../utils/helpers';
import { xpForNextLevel } from '../../types';

export default {
  category: 'members',
  data: new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('Exibe o nível e XP de um membro')
    .addUserOption(opt => opt.setName('usuario').setDescription('Membro (padrão: você)').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = (interaction.options.getMember('usuario') as GuildMember | null) ?? interaction.member as GuildMember;
    const user = target.user;
    await interaction.deferReply();
    const m = await getOrCreateMember(user.id, user.username);
    const xpNeeded = xpForNextLevel(m.level);
    const rankPos = await prisma.member.count({ where: { OR: [{ level: { gt: m.level } }, { level: m.level, xp: { gt: m.xp } }] } });

    const embed = baseEmbed(colorFromLevel(m.level))
      .setTitle(`🎯 Nível de ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(
        `${rankEmoji(m.rank)} **${m.rank}**\n\n` +
        `**Nível ${m.level}** — ${m.xp} / ${xpNeeded} XP\n\`${levelBar(m.xp, xpNeeded)}\`\n\n` +
        `📊 **Ranking:** #${rankPos + 1}`
      )
      .setFooter({ text: '⚔️ Aliança Skyline' });

    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;
