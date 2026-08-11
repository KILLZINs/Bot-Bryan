import { GuildBan } from 'discord.js';
import { prisma } from '../database/client';

function today() { return new Date().toISOString().slice(0, 10); }

export default {
  name: 'guildBanAdd',
  once: false,
  async execute(ban: GuildBan) {
    const guildId = ban.guild.id;
    const date = today();
    await prisma.serverStat.upsert({
      where:  { guildId_date: { guildId, date } },
      update: { bans: { increment: 1 } },
      create: { guildId, date, bans: 1 },
    }).catch(console.error);
  },
};
