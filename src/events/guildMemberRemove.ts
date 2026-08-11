import { GuildMember, PartialGuildMember } from 'discord.js';
import { prisma } from '../database/client';
import { sendLog, logMemberLeave, LOG } from '../utils/logger';

function today() { return new Date().toISOString().slice(0, 10); }

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member: GuildMember | PartialGuildMember) {
    const guildId = member.guild.id;
    const date = today();
    await prisma.serverStat.upsert({
      where:  { guildId_date: { guildId, date } },
      update: { leaves: { increment: 1 } },
      create: { guildId, date, leaves: 1 },
    }).catch(console.error);

    // Log de saída (só funciona se o membro estiver em cache com cargos)
    if (member instanceof Object && 'roles' in member && member.roles) {
      await sendLog(member.guild, LOG.MEMBERS, logMemberLeave(member as GuildMember)).catch(() => null);
    }
  },
};
