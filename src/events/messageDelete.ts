import { Message, PartialMessage } from 'discord.js';
import { sendLog, logMessageDelete, LOG } from '../utils/logger';

export default {
  name: 'messageDelete',
  once: false,
  async execute(message: Message | PartialMessage) {
    if (!message.guild) return;
    if (message.author?.bot) return;
    // Ignorar mensagens de sistema / sem autor (parciais sem cache)
    if (!message.author) return;

    const content = message.content ?? '*(sem conteúdo)*';
    const channelName = message.channel.isDMBased() ? 'DM' : (message.channel as any).name ?? 'desconhecido';

    const embed = logMessageDelete(
      message.author,
      content,
      channelName,
      message.channelId,
    );

    // Anexos deletados
    if (message.attachments.size > 0) {
      const list = message.attachments.map(a => `[${a.name}](${a.url})`).slice(0, 5).join('\n');
      embed.addFields({ name: '📎 Anexos', value: list, inline: false });
    }

    await sendLog(message.guild, LOG.MESSAGES, embed);
  },
};
