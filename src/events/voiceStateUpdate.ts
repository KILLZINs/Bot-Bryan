import { VoiceState } from 'discord.js';
import { sendLog, logVoice, LOG } from '../utils/logger';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(before: VoiceState, after: VoiceState) {
    const member = after.member ?? before.member;
    if (!member || member.user.bot) return;
    const guild = after.guild;

    if (!before.channel && after.channel) {
      // Entrou em um canal de voz
      await sendLog(guild, LOG.VOICE, logVoice(member, 'join', undefined, after.channel.name));
    } else if (before.channel && !after.channel) {
      // Saiu de um canal de voz
      await sendLog(guild, LOG.VOICE, logVoice(member, 'leave', before.channel.name));
    } else if (before.channel && after.channel && before.channel.id !== after.channel.id) {
      // Moveu de canal
      await sendLog(guild, LOG.VOICE, logVoice(member, 'move', before.channel.name, after.channel.name));
    }
  },
};
