import { prisma } from '../database/client';

// ─── In-memory cache ──────────────────────────────────────────────────────────
const allowedSet  = new Set<string>();
const managerSet  = new Set<string>();
let   cacheLoaded = false;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
/** Load allowlist + managers from DB. Call once on ready. */
export async function loadAllowlist(): Promise<void> {
  const [guilds, managers] = await Promise.all([
    prisma.allowedGuild.findMany({ where: { active: true } }),
    prisma.botManager.findMany(),
  ]);
  allowedSet.clear();
  managerSet.clear();
  for (const g of guilds)   allowedSet.add(g.guildId);
  for (const m of managers) managerSet.add(m.userId);
  cacheLoaded = true;
}

// ─── Checks ───────────────────────────────────────────────────────────────────
/** Enforcement is active only once at least one guild has been added. */
export function isEnforcementActive(): boolean {
  return cacheLoaded && allowedSet.size > 0;
}

/** Returns true if the guild may use the bot. */
export function isGuildAllowed(guildId: string): boolean {
  return !isEnforcementActive() || allowedSet.has(guildId);
}

/** Returns all owner IDs from env (supports BOT_OWNER_IDS csv + legacy OWNER_ID). */
export function getOwnerIds(): string[] {
  const ids = new Set<string>();
  (process.env.BOT_OWNER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean).forEach(id => ids.add(id));
  if (process.env.OWNER_ID) ids.add(process.env.OWNER_ID.trim());
  return [...ids];
}

export function isBotOwner(userId: string): boolean {
  return getOwnerIds().includes(userId);
}

export function isBotManager(userId: string): boolean {
  return isBotOwner(userId) || managerSet.has(userId);
}

// ─── Cache mutators ───────────────────────────────────────────────────────────
export function cacheAddGuild(guildId: string)    { allowedSet.add(guildId); }
export function cacheRemoveGuild(guildId: string)  { allowedSet.delete(guildId); }
export function cacheAddManager(userId: string)    { managerSet.add(userId); }
export function cacheRemoveManager(userId: string) { managerSet.delete(userId); }

export function allowedGuildCount(): number { return allowedSet.size; }
