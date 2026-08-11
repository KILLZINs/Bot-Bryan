import { GuildMember, TextChannel, EmbedBuilder, PartialGuildMember } from 'discord.js';
import { COLORS } from '../utils/embeds';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member: GuildMember | PartialGuildMember) {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;
    const logChannel = member.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle('🚪 Membro Saiu')
      .setDescription(`**${member.user?.username ?? 'Desconhecido'}** saiu do servidor`)
      .addFields({ name: 'ID', value: member.id })
      .setThumbnail(member.user?.displayAvatarURL() ?? null)
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(console.error);
  },
};
