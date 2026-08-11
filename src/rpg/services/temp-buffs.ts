// ═══════════════════════════════════════════════════════════════════════
// BUFFS TEMPORÁRIOS RPG
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';
import type { ComputedStats } from './character';

export type BuffType = 'str_pct' | 'agi_pct' | 'int_pct' | 'vit_pct' | 'lck_pct'
                     | 'atk_pct' | 'def_pct' | 'xp_pct' | 'gold_pct' | 'crit_flat';

export interface TempBuff {
  id: string;
  discordId: string;
  buffType: string;
  value: number;
  expiresAt: Date;
  source: string;
  label: string;
}

export async function getActiveBuffs(discordId: string): Promise<TempBuff[]> {
  return prisma.rpgTempBuff.findMany({
    where: { discordId, expiresAt: { gt: new Date() } },
  }) as any;
}

export async function addTempBuff(
  discordId: string,
  buffType: BuffType,
  value: number,
  durationMs: number,
  source: string,
  label: string,
) {
  // Remove buff do mesmo tipo/source para não acumular
  await prisma.rpgTempBuff.deleteMany({ where: { discordId, buffType, source } });
  return prisma.rpgTempBuff.create({
    data: {
      discordId, buffType, value, source, label,
      expiresAt: new Date(Date.now() + durationMs),
    },
  });
}

export async function clearExpiredBuffs(discordId: string) {
  await prisma.rpgTempBuff.deleteMany({
    where: { discordId, expiresAt: { lte: new Date() } },
  });
}

export function applyBuffsToStats(stats: ComputedStats, buffs: TempBuff[]): ComputedStats {
  if (!buffs.length) return stats;
  const s = { ...stats };
  for (const b of buffs) {
    switch (b.buffType as BuffType) {
      case 'str_pct': s.str     = Math.round(s.str     * (1 + b.value)); break;
      case 'agi_pct': s.agi     = Math.round(s.agi     * (1 + b.value)); break;
      case 'int_pct': s.int     = Math.round(s.int     * (1 + b.value)); break;
      case 'vit_pct': s.vit     = Math.round(s.vit     * (1 + b.value)); break;
      case 'lck_pct': s.lck     = Math.round(s.lck     * (1 + b.value)); break;
      case 'atk_pct': s.attack  = Math.round(s.attack  * (1 + b.value)); break;
      case 'def_pct': s.defense = Math.round(s.defense * (1 + b.value)); break;
      case 'xp_pct':  /* aplicado no combate */                           break;
      case 'gold_pct':/* aplicado no combate */                           break;
      case 'crit_flat': s.critChance += b.value;                         break;
    }
  }
  // Recalc CP aproximado
  s.combatPower = Math.round(
    s.str * 10 + s.agi * 8 + s.int * 8 + s.vit * 6 + s.lck * 4 +
    s.attack * 5 + s.defense * 3,
  );
  return s;
}

/** Soma multiplicador xp/gold dos buffs ativos */
export function getCombatBuffMultipliers(buffs: TempBuff[]): { xp: number; gold: number } {
  let xp = 1, gold = 1;
  for (const b of buffs) {
    if (b.buffType === 'xp_pct')   xp   *= (1 + b.value);
    if (b.buffType === 'gold_pct') gold *= (1 + b.value);
  }
  return { xp, gold };
}

export function formatBuffList(buffs: TempBuff[]): string {
  if (!buffs.length) return '*Nenhum buff ativo*';
  return buffs.map(b => {
    const rem = Math.max(0, Math.round((b.expiresAt.getTime() - Date.now()) / 60000));
    const pct = b.buffType === 'crit_flat'
      ? `+${b.value.toFixed(1)}% Crítico`
      : `+${Math.round(b.value * 100)}% ${b.label}`;
    return `✨ **${pct}** *(${rem}min restante)*`;
  }).join('\n');
}
