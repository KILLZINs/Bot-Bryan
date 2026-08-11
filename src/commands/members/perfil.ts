import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS, baseEmbed, rankEmoji, levelBar, colorFromLevel } from '../../utils/embeds';
import { getOrCreateMember } from '../../utils/helpers';
import { xpForNextLevel } from '../../types';

export default {
  category: 'members',
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Exibe o perfil de um membro')
    .addUserOption(opt => opt.setName('usuario').setDescription('Membro (padrão: você mesmo)').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = (interaction.options.getMember('usuario') as GuildMember | null) ?? interaction.member as GuildMember;
    const user = target.user;
    await interaction.deferReply();
    const m = await getOrCreateMember(user.id, user.username);
    const xpNeeded = xpForNextLevel(m.level);
    const rankPos = await prisma.member.count({ where: { OR: [{ level: { gt: m.level } }, { level: m.level, xp: { gt: m.xp } }] } });
    const achievements = await prisma.achievement.count({ where: { memberId: m.discordId } });

    const embed = baseEmbed(colorFromLevel(m.level))
      .setTitle(`${EMOJIS.PERSON} ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🏅 Rank', value: `${rankEmoji(m.rank)} **${m.rank}**`, inline: true },
        { name: '🎯 Nível', value: `**${m.level}**`, inline: true },
        { name: '📊 Posição', value: `**#${rankPos + 1}**`, inline: true },
        { name: '💜 XP', value: `${m.xp} / ${xpNeeded}\n\`${levelBar(m.xp, xpNeeded)}\``, inline: false },
        { name: '🪙 Moedas', value: `**${m.coins}**`, inline: true },
        { name: '🏆 Conquistas', value: `**${achievements}**`, inline: true },
        { name: '⚠️ Avisos', value: `**${m.warnings}**`, inline: true },
        { name: '📅 Membro desde', value: `<t:${Math.floor(m.createdAt.getTime() / 1000)}:D>`, inline: false },
      )
      .setFooter({ text: '⚔️ Aliança Skyline' });

    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;
