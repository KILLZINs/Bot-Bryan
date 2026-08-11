// ═══════════════════════════════════════════════════════════════════════
// SERVIÇO DE PERSONAGEM RPG
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';
import { RpgCharacter, RpgEquipment } from '@prisma/client';
import {
  CLASSES, getClass, calcLevelStats, rpgXpForLevel,
  calcCombatPower, calcAttack, calcDefense, calcCritChance, calcDodge,
} from '../constants/classes';
import { ITEMS, getItem } from '../constants/items';
import { DIVINE_SKILLS, PASSIVE_TALENTS } from '../constants/skills';

export type FullCharacter = RpgCharacter & { equipment: RpgEquipment | null };

// ─── Obter ou criar personagem ─────────────────────────────────────────────

export async function getOrCreateCharacter(discordId: string, username: string): Promise<FullCharacter> {
  let char = await prisma.rpgCharacter.findUnique({
    where: { discordId },
    include: { equipment: true },
  });
  if (!char) {
    char = await prisma.rpgCharacter.create({
      data: {
        discordId, username,
        equipment: { create: {} },
      },
      include: { equipment: true },
    });
  }
  return char;
}

export async function getCharacter(discordId: string): Promise<FullCharacter | null> {
  return prisma.rpgCharacter.findUnique({
    where: { discordId },
    include: { equipment: true },
  });
}

// ─── Stats calculados ──────────────────────────────────────────────────────

export interface ComputedStats {
  str: number; agi: number; int: number; vit: number; lck: number;
  attack: number;
  defense: number;
  critChance: number;
  dodgeChance: number;
  combatPower: number;
  maxHp: number;
  maxEnergy: number;
  equipAttackBonus: number;
  equipDefenseBonus: number;
  goldBonus: number;
  xpBonus: number;
}

export function computeStats(char: FullCharacter): ComputedStats {
  const cls = getClass(char.class) ?? CLASSES['guerreiro'];
  const levelStats = calcLevelStats(cls, char.level);

  let eqAttack = 0, eqDefense = 0, eqStr = 0, eqAgi = 0, eqInt = 0, eqVit = 0, eqLck = 0;
  let eqHp = 0, eqEnergy = 0, eqCrit = 0, eqDodge = 0, eqGold = 0, eqXp = 0;

  const eq = char.equipment;
  if (eq) {
    const slots = [eq.weapon, eq.helmet, eq.pants, eq.boots, eq.gloves, eq.shield, eq.ring, eq.amulet, eq.backpack, eq.pet];
    for (const itemId of slots) {
      if (!itemId) continue;
      const item = getItem(itemId);
      if (!item) continue;
      const s = item.stats;
      eqStr    += s.str    ?? 0;
      eqAgi    += s.agi    ?? 0;
      eqInt    += s.int    ?? 0;
      eqVit    += s.vit    ?? 0;
      eqLck    += s.lck    ?? 0;
      eqHp     += s.hp     ?? 0;
      eqEnergy += s.energy ?? 0;
      eqDefense += s.defense ?? 0;
      eqAttack  += s.attack  ?? 0;
      eqCrit   += s.critBonus  ?? 0;
      eqDodge  += s.dodgeBonus ?? 0;
      eqGold   += s.goldBonus  ?? 0;
    }
  }

  const clsBase = CLASSES[char.class]?.baseStats;
  const str = levelStats.str + char.strength      - (clsBase?.str ?? 0) + eqStr;
  const agi = levelStats.agi + char.agility       - (clsBase?.agi ?? 0) + eqAgi;
  const int = levelStats.int + char.intelligence  - (clsBase?.int ?? 0) + eqInt;
  const vit = levelStats.vit + char.vitality      - (clsBase?.vit ?? 0) + eqVit;
  const lck = levelStats.lck + char.luck          - (clsBase?.lck ?? 0) + eqLck;

  // ─── Aplicando os Talentos Passivos comprados com Pontos de Skill ────────
  let passiveAtkPct = 0;
  let passiveDefPct = 0;
  let passiveHpFlat = 0;
  let passiveEnFlat = 0;
  let passiveCrit = 0;
  let passiveGold = eqGold;
  let passiveXp = eqXp;

  const talentLevels = (char.talentLevels as Record<string, number> | null) ?? {};
  for (const [talentId, level] of Object.entries(talentLevels)) {
    const talent = PASSIVE_TALENTS[talentId];
    if (!talent || level <= 0) continue;
    const stats = talent.statsPerLevel;
    if (stats.attackPercent) passiveAtkPct += stats.attackPercent * level;
    if (stats.defensePercent) passiveDefPct += stats.defensePercent * level;
    if (stats.maxHp) passiveHpFlat += stats.maxHp * level;
    if (stats.maxEnergy) passiveEnFlat += stats.maxEnergy * level;
    if (stats.critChance) passiveCrit += stats.critChance * level;
    if (stats.goldBonus) passiveGold += stats.goldBonus * level;
    if (stats.xpBonus) passiveXp += stats.xpBonus * level;
  }

  const baseHp    = cls.baseHp + (vit * cls.hpPerVit) + eqHp;
  const maxHp     = baseHp + passiveHpFlat;
  const baseEnergy = cls.baseEnergy + (char.level * cls.energyPerLevel) + eqEnergy;
  const maxEnergy = baseEnergy + passiveEnFlat;

  let attack    = calcAttack({ str, agi, int, vit, lck }, cls.primaryStat) + eqAttack;
  if (passiveAtkPct > 0) attack = Math.floor(attack * (1 + passiveAtkPct / 100));

  let defense   = calcDefense(vit, eqDefense);
  if (passiveDefPct > 0) defense = Math.floor(defense * (1 + passiveDefPct / 100));

  const critChance  = Math.round((calcCritChance(agi, lck) + eqCrit + passiveCrit) * 10) / 10;
  const dodgeChance = Math.round((calcDodge(agi, lck) + eqDodge) * 10) / 10;
  const combatPower = calcCombatPower({ str, agi, int, vit, lck }, char.level, attack + defense);

  if (char.divineSkillId) {
    const skill = DIVINE_SKILLS[char.divineSkillId];
    if (skill?.passive) {
      passiveGold += skill.passive.goldBonus ?? 0;
      passiveXp   += skill.passive.xpBonus   ?? 0;
    }
  }

  return {
    str, agi, int, vit, lck,
    attack, defense, critChance, dodgeChance, combatPower,
    maxHp, maxEnergy,
    equipAttackBonus: eqAttack,
    equipDefenseBonus: eqDefense,
    goldBonus: passiveGold,
    xpBonus: passiveXp,
  };
}

// ─── XP e Level Up ────────────────────────────────────────────────────────

export async function addRpgXp(
  char: FullCharacter,
  xpGained: number,
  state?: { currentHp?: number; currentEnergy?: number },
): Promise<{ char: FullCharacter; leveledUp: boolean; newLevel: number }> {
  let { xp, level } = char;
  xp += xpGained;
  let leveledUp = false;

  while (xp >= rpgXpForLevel(level)) {
    xp -= rpgXpForLevel(level);
    level++;
    leveledUp = true;
  }

  const statPoints  = leveledUp ? char.statPoints  + (level - char.level) * 3 : char.statPoints;
  const skillPoints = leveledUp ? char.skillPoints + (level - char.level)      : char.skillPoints;

  const cls = getClass(char.class) ?? CLASSES['guerreiro'];
  const newLevelStats = calcLevelStats(cls, level);
  const newMaxHp     = cls.baseHp + (newLevelStats.vit * cls.hpPerVit);
  const newMaxEnergy = cls.baseEnergy + (level * cls.energyPerLevel);

  const baseHp = state?.currentHp ?? char.currentHp;
  const updated = await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: {
      xp, level, statPoints, skillPoints,
      maxHp: newMaxHp, maxEnergy: newMaxEnergy,
      currentHp: Math.min(baseHp + (leveledUp ? newMaxHp : 0), newMaxHp),
      ...(state?.currentEnergy === undefined ? {} : { currentEnergy: state.currentEnergy }),
    },
    include: { equipment: true },
  });

  return { char: updated, leveledUp, newLevel: level };
}

// ─── Regen passiva de energia (tempo + chat) ──────────────────────────────

export async function applyPassiveEnergyRegen(char: FullCharacter): Promise<FullCharacter> {
  const stats = computeStats(char);
  if (char.currentEnergy >= stats.maxEnergy) return char;

  const now      = Date.now();
  const lastTick = char.lastEnergyTick?.getTime() ?? char.createdAt.getTime();
  const minutes  = (now - lastTick) / 60_000;
  const gained   = Math.floor(minutes / 3);
  if (gained <= 0) return char;

  const newEnergy = Math.min(char.currentEnergy + gained, stats.maxEnergy);
  const nextTick = new Date(lastTick + gained * 3 * 60_000);
  return prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data:  { currentEnergy: newEnergy, lastEnergyTick: nextTick },
    include: { equipment: true },
  });
}

const _chatEnergyCooldowns = new Map<string, number>();
export async function applyChatEnergyRegen(discordId: string): Promise<void> {
  const now = Date.now();
  const last = _chatEnergyCooldowns.get(discordId) ?? 0;
  if (now - last < 5 * 60_000) return;

  const char = await prisma.rpgCharacter.findUnique({
    where: { discordId },
    include: { equipment: true },
  });
  if (!char) return;

  const stats = computeStats(char);
  if (char.currentEnergy >= stats.maxEnergy) return;

  const gained = Math.floor(Math.random() * 2) + 1;
  const newEnergy = Math.min(char.currentEnergy + gained, stats.maxEnergy);
  const lastTick = char.lastEnergyTick?.getTime() ?? char.createdAt.getTime();
  const passiveGained = Math.max(0, Math.floor((now - lastTick) / (3 * 60_000)));
  const nextTick = new Date(lastTick + passiveGained * 3 * 60_000);
  await prisma.rpgCharacter.update({
    where: { discordId },
    data:  { currentEnergy: newEnergy, lastEnergyTick: nextTick },
  });
  _chatEnergyCooldowns.set(discordId, now);
}

// ─── Restaurar HP / Energia ───────────────────────────────────────────────

export async function restoreHp(discordId: string, amount: number | 'full') {
  const char = await getCharacter(discordId);
  if (!char) return null;
  const stats = computeStats(char);
  const newHp = amount === 'full' ? stats.maxHp : Math.min(char.currentHp + amount, stats.maxHp);
  return prisma.rpgCharacter.update({ where: { discordId }, data: { currentHp: newHp } });
}

export async function restoreEnergy(discordId: string, amount: number | 'full') {
  const char = await getCharacter(discordId);
  if (!char) return null;
  const stats = computeStats(char);
  const newEn = amount === 'full' ? stats.maxEnergy : Math.min(char.currentEnergy + amount, stats.maxEnergy);
  return prisma.rpgCharacter.update({ where: { discordId }, data: { currentEnergy: newEn } });
}

// ─── Distribuir pontos de atributo ───────────────────────────────────────

type StatKey = 'strength' | 'agility' | 'intelligence' | 'vitality' | 'luck';

export async function distributeStatPoints(discordId: string, stat: StatKey, points: number): Promise<{ success: boolean; message: string }> {
  const char = await getCharacter(discordId);
  if (!char) return { success: false, message: 'Personagem não encontrado.' };
  if (char.statPoints < points) return { success: false, message: `Pontos insuficientes! Você tem **${char.statPoints}** ponto(s).` };

  await prisma.rpgCharacter.update({
    where: { discordId },
    data: { [stat]: { increment: points }, statPoints: { decrement: points } },
  });
  return { success: true, message: `+${points} em ${stat}!` };
}

// ─── Classe e evolução ────────────────────────────────────────────────────

export async function setClass(discordId: string, classId: string): Promise<{ success: boolean; message: string }> {
  const cls = getClass(classId);
  if (!cls) return { success: false, message: 'Classe inválida.' };

  const char = await getCharacter(discordId);
  if (!char) return { success: false, message: 'Personagem não encontrado.' };

  if (cls.tier === 2) {
    if (!cls.evolveFrom || char.class !== cls.evolveFrom) {
      return { success: false, message: `Para se tornar **${cls.name}**, você precisa ser **${getClass(cls.evolveFrom ?? '')?.name ?? '???'}** primeiro.` };
    }
    if (char.level < 20) return { success: false, message: 'Precisa ser nível 20 para evoluir para uma classe Tier 2.' };
  }

  if (cls.tier === 3) {
    if (!cls.evolveFrom || char.class !== cls.evolveFrom) {
      return { success: false, message: `Para se tornar **${cls.name}**, você precisa ser **${getClass(cls.evolveFrom ?? '')?.name ?? '???'}** primeiro.` };
    }
    if (char.level < 40) return { success: false, message: 'Precisa ser nível 40 para evoluir para uma classe Tier 3.' };
  }

  const baseStats = cls.baseStats;
  await prisma.rpgCharacter.update({
    where: { discordId },
    data: {
      class: classId,
      strength: baseStats.str, agility: baseStats.agi,
      intelligence: baseStats.int, vitality: baseStats.vit, luck: baseStats.lck,
      maxHp: cls.baseHp + baseStats.vit * cls.hpPerVit,
      currentHp: cls.baseHp + baseStats.vit * cls.hpPerVit,
      maxEnergy: cls.baseEnergy, currentEnergy: cls.baseEnergy,
    },
  });
  return { success: true, message: `Agora você é um(a) **${cls.name}** ${cls.emoji}!` };
}

// ─── Reencarnação (Geração) ───────────────────────────────────────────────

export async function reincarnate(discordId: string): Promise<{ success: boolean; message: string }> {
  const char = await getCharacter(discordId);
  if (!char) return { success: false, message: 'Personagem não encontrado.' };
  if (char.level < 50) return { success: false, message: 'Precisa ser nível 50 para se reencarnar.' };

  const cls = getClass(char.class) ?? CLASSES['guerreiro'];
  const baseStats = cls.baseStats;

  await prisma.rpgCharacter.update({
    where: { discordId },
    data: {
      generation: char.generation + 1,
      level: 1, xp: 0,
      strength: baseStats.str + (char.generation * 2),
      agility: baseStats.agi + (char.generation * 2),
      intelligence: baseStats.int + (char.generation * 2),
      vitality: baseStats.vit + (char.generation * 2),
      luck: baseStats.lck + (char.generation * 2),
      statPoints: 0, skillPoints: 0,
      currentHp: cls.baseHp, maxHp: cls.baseHp,
      currentEnergy: cls.baseEnergy, maxEnergy: cls.baseEnergy,
    },
  });

  return { success: true, message: `🌟 Você se reencarnou para a **Geração ${char.generation + 1}**! Seus atributos base aumentaram permanentemente.` };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function hpBar(current: number, max: number, len = 12): string {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * len);
  const bar = '█'.repeat(filled) + '░'.repeat(len - filled);
  const pctStr = Math.round(pct * 100);
  return `\`${bar}\` ${pctStr}%`;
}

export function xpBar(xp: number, level: number, len = 12): string {
  const needed = rpgXpForLevel(level);
  const pct = Math.min(1, xp / needed);
  const filled = Math.round(pct * len);
  const bar = '█'.repeat(filled) + '░'.repeat(len - filled);
  return `\`${bar}\` ${xp}/${needed}`;
}
