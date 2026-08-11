import { GuildBan } from 'discord.js';
import { sendLog, logUnban, LOG } from '../utils/logger';

export default {
  name: 'guildBanRemove',
  once: false,
  async execute(ban: GuildBan) {
    // Buscar audit log para saber quem desbanou
    let moderator: import('discord.js').User | import('discord.js').PartialUser | null = ban.client.user;
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: 23 /* MemberBanRemove */, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === ban.user.id && Date.now() - entry.createdTimestamp < 5000) {
        moderator = entry.executor ?? moderator;
      }
    } catch { /* audit log pode não estar disponível */ }

    const embed = logUnban(ban.user, moderator as any, ban.reason ?? 'Sem motivo');
    await sendLog(ban.guild, LOG.MODERATION, embed);
  },
};
