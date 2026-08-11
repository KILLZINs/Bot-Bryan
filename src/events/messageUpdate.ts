import { Message, PartialMessage } from 'discord.js';
import { sendLog, logMessageEdit, LOG } from '../utils/logger';

export default {
  name: 'messageUpdate',
  once: false,
  async execute(before: Message | PartialMessage, after: Message | PartialMessage) {
    if (!after.guild) return;
    if (after.author?.bot) return;
    if (!after.author) return;

    const contentBefore = before.content ?? '';
    const contentAfter  = after.content  ?? '';

    // Ignorar edições sem mudança real no texto (ex: embed carregou)
    if (contentBefore === contentAfter) return;

    const embed = logMessageEdit(
      after.author,
      contentBefore,
      contentAfter,
      after.channelId,
      after.url,
    );

    await sendLog(after.guild, LOG.MESSAGES, embed);
  },
};
