import { prisma } from '../database/client';
import { xpForNextLevel } from '../types';

export async function getOrCreateMember(discordId: string, username: string) {
  return prisma.member.upsert({
    where: { discordId },
    update: { username },
    create: { discordId, username },
  });
}

export async function addXp(discordId: string, username: string, amount: number) {
  const member = await getOrCreateMember(discordId, username);
  let xp = member.xp + amount;
  let level = member.level;

  // BUG FIX: usar loop para suportar múltiplos level-ups em uma única chamada
  while (xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level++;
  }

  return prisma.member.update({
    where: { discordId },
    data: { xp, level },
  });
}

export async function getConfig(guildId: string) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const v = parseInt(match[1]);
  const u = match[2].toLowerCase();
  return v * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[u] ?? 0);
}
