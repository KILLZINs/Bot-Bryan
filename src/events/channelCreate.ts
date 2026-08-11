import { GuildChannel, ChannelType } from 'discord.js';
import { sendLog, logChannelCreate, LOG } from '../utils/logger';

function channelTypeName(type: ChannelType): string {
  const map: Partial<Record<ChannelType, string>> = {
    [ChannelType.GuildText]:          'Texto',
    [ChannelType.GuildVoice]:         'Voz',
    [ChannelType.GuildCategory]:      'Categoria',
    [ChannelType.GuildAnnouncement]:  'Anúncio',
    [ChannelType.GuildForum]:         'Fórum',
    [ChannelType.GuildStageVoice]:    'Palco',
    [ChannelType.GuildMedia]:         'Mídia',
    [ChannelType.PublicThread]:       'Thread Pública',
    [ChannelType.PrivateThread]:      'Thread Privada',
  };
  return map[type] ?? 'Desconhecido';
}

export default {
  name: 'channelCreate',
  once: false,
  async execute(channel: GuildChannel) {
    if (!channel.guild) return;
    await sendLog(
      channel.guild,
      LOG.CHANNELS,
      logChannelCreate(channel.name, channel.id, channelTypeName(channel.type)),
    );
  },
};
