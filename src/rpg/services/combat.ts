// ═══════════════════════════════════════════════════════════════════════
// ENGINE DE COMBATE RPG
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';
import { FullCharacter, ComputedStats, computeStats, addRpgXp } from './character';
import { Enemy, scaleEnemy } from '../constants/enemies';
import { getItem } from '../constants/items';
import { DIVINE_SKILLS, skillEffectValue } from '../constants/skills';
import type { SkillRank } from '../constants/skills';
import { getActiveBuffs, getCombatBuffMultipliers } from './temp-buffs';

export const DUNGEON_COOLDOWN_MS = 5 * 60 * 1000;
export type CombatMode = 'dungeon' | 'hunt' | 'expedition'; // MODO VIP ADICIONADO!

export class CombatBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CombatBlockedError';
  }
}

export interface CombatResult {
  result: 'vitoria' | 'derrota' | 'fuga' | 'empate';
  rounds: number;
  log: string[];
  xpGained: number;
  goldGained: number;
  itemsDropped: string[];
  playerHpLeft: number;
  playerEnergyLeft: number;
  bossKill: boolean;
}

interface CombatState {
  playerHp: number;
  playerEnergy: number;
  enemyHp: number;
  enemyMaxHp: number;
  round: number;
  log: string[];
  usedSkillThisRound: boolean;
  berserkActive: number;
  shieldActive: number;
  enemyAttackMultiplier: number;
  enemyDefenseMultiplier: number;
  doubleDmgNextHit: boolean;
  poisonRounds: number;
  frozenRounds: number;
  stubbedRounds: number;
  skillCooldown: number;
}

export type CombatAction = 'attack' | 'skill' | 'defend' | 'potion' | 'flee';

export interface CombatTurn {
  finished: boolean;
  result?: CombatResult;
  log: string[];
  round: number;
  playerHp: number;
  playerEnergy: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyName: string;
  enemyEmoji: string;
  mode: CombatMode;
  skillName?: string;
  skillReady: boolean;
  potionAvailable: boolean;
}

interface InteractiveCombatSession {
  char: FullCharacter;
  enemy: Enemy;
  scaledEnemy: Enemy;
  guildId?: string;
  mode: CombatMode;
  stats: ComputedStats;
  state: CombatState;
  startedAt: Date;
  potionAvailable: boolean;
  skillUsedInCombat: boolean;
}

const activeCombats = new Map<string, InteractiveCombatSession>();

// ─── Combate principal (Automático) ─────────────────────────────────────────

export async function runCombat(
  char: FullCharacter,
  enemy: Enemy,
  useSkill: boolean = false,
  guildId?: string,
  mode: CombatMode = 'dungeon',
): Promise<CombatResult> {
  let slotStartedAt = new Date();
  
  if (mode === 'dungeon') {
    const slot = await claimDungeonSlot(char.discordId, char.currentHp, char.currentEnergy);
    if (!slot.success) throw new CombatBlockedError(slot.message);
    slotStartedAt = slot.startedAt;
  }
  
  if (char.currentHp <= 0) throw new CombatBlockedError('Você está sem HP. Vá à cidade e se cure antes de batalhar.');
  
  // A EXPEDIÇÃO É VIP E NÃO COBRA ENERGIA PARA INICIAR A SALA
  if (mode !== 'expedition' && char.currentEnergy < 10) {
    throw new CombatBlockedError('Você precisa de pelo menos **10⚡** para iniciar uma batalha.');
  }

  const stats = computeStats(char);
  const scaledEnemy = scaleEnemy(enemy, char.level);

  const state: CombatState = {
    playerHp: char.currentHp,
    playerEnergy: char.currentEnergy,
    enemyHp: scaledEnemy.baseHp,
    enemyMaxHp: scaledEnemy.baseHp,
    round: 0,
    log: [],
    usedSkillThisRound: false,
    berserkActive: 0, shieldActive: 0,
    enemyAttackMultiplier: 1, enemyDefenseMultiplier: 1,
    doubleDmgNextHit: false,
    poisonRounds: 0, frozenRounds: 0, stubbedRounds: 0,
    skillCooldown: 0,
  };

  const MAX_ROUNDS = 20;

  const modeTitle = mode === 'expedition' ? '🗺️ Expedição' : mode === 'hunt' ? '🌲 Caçada' : '⚔️ Dungeon';
  state.log.push(`**${modeTitle}** — **${char.username}** vs **${enemy.name}** ${enemy.emoji}`);
  state.log.push(`❤️ Seus HP: **${state.playerHp}/${stats.maxHp}** | HP inimigo: **${state.enemyHp}**\n`);

  while (state.round < MAX_ROUNDS && state.playerHp > 0 && state.enemyHp > 0) {
    state.round++;
    state.log.push(`**— Rodada ${state.round} —**`);
    applyEnemyTactics(scaledEnemy, state);

    if (state.frozenRounds > 0) {
      state.log.push(`❄️ Você está congelado! Não pode atacar.`);
      state.frozenRounds--;
    } else {
      const playerDmg = calcPlayerDamage(char, stats, state, scaledEnemy, useSkill && state.round === 1);
      state.enemyHp = Math.max(0, state.enemyHp - playerDmg.damage);
      state.log.push(playerDmg.msg);
    }

    if (state.enemyHp <= 0) break;

    if (state.stubbedRounds > 0) {
      state.log.push(`😵 ${enemy.name} está atordoado!`);
      state.stubbedRounds--;
    } else {
      const enemyDmg = calcEnemyDamage(scaledEnemy, stats, state);
      state.playerHp = Math.max(0, state.playerHp - enemyDmg.damage);
      state.log.push(enemyDmg.msg);
    }

    if (state.poisonRounds > 0 && state.enemyHp > 0) {
      const poisonDmg = Math.max(1, Math.floor(stats.attack * 0.08));
      state.enemyHp = Math.max(0, state.enemyHp - poisonDmg);
      state.log.push(`☠️ Veneno causa **${poisonDmg}** de dano!`);
      state.poisonRounds--;
    }
  }

  let result: CombatResult['result'] = 'empate';
  let xpGained = 0;
  let goldGained = 0;
  const itemsDropped: string[] = [];
  const itemsGainedMap = new Map<string, number>();

  if (state.playerHp <= 0 && state.enemyHp <= 0) {
    result = 'empate';
    state.log.push(`\n💥 **EMPATE!** Ambos caíram ao mesmo tempo!`);
  } else if (state.enemyHp <= 0) {
    result = 'vitoria';
    state.log.push(`\n🏆 **VITÓRIA!** ${enemy.name} foi derrotado!`);

    const { getEventMultipliers } = await import('../panels/world-events');
    const worldMults = guildId ? await getEventMultipliers(guildId) : { xp: 1, gold: 1, dropBonus: 0, noEnergy: false, enemyMult: 1 };
    const combatBuffs = getCombatBuffMultipliers(await getActiveBuffs(char.discordId));
    const goldBonus = (1 + (stats.goldBonus / 100)) * worldMults.gold * combatBuffs.gold;
    const xpBonus   = (1 + ((stats.xpBonus) / 100)) * worldMults.xp * combatBuffs.xp;
    
    xpGained   = Math.floor(scaledEnemy.xpReward * xpBonus);
    goldGained = Math.floor((scaledEnemy.goldReward.min + Math.random() * (scaledEnemy.goldReward.max - scaledEnemy.goldReward.min)) * goldBonus);

    if (worldMults.xp > 1) state.log.push(`⭐ Bônus de evento: **×${worldMults.xp} XP**!`);

    for (const drop of enemy.drops) {
      const roll = Math.random();
      if (roll <= drop.chance + worldMults.dropBonus) {
        const qty = Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1)) + drop.minQty;
        itemsGainedMap.set(drop.itemId, (itemsGainedMap.get(drop.itemId) || 0) + qty);
      }
    }

    for (const [id, qty] of itemsGainedMap.entries()) {
      for (let i = 0; i < qty; i++) itemsDropped.push(id);
    }
    if (itemsGainedMap.size > 0) state.log.push(`🎁 **Drops obtidos!**`);
  } else {
    result = 'derrota';
    state.log.push(`\n💀 **DERROTA!** Você foi derrotado por ${enemy.name}...`);
  }

  const newHp = result === 'derrota' ? Math.floor(stats.maxHp * 0.1) : state.playerHp;
  const { getEventMultipliers: getMults } = await import('../panels/world-events');
  const blessingCheck = guildId ? await getMults(guildId) : { noEnergy: false };
  
  // A EXPEDIÇÃO É VIP E NÃO CONSOME ENERGIA DURANTE O COMBATE
  const energyCost = (blessingCheck.noEnergy || mode === 'expedition') ? 0 : Math.min(state.playerEnergy, 25 + state.round * 3);
  const finalEnergy = Math.max(0, state.playerEnergy - energyCost);

  if (xpGained > 0) await addRpgXp(char, xpGained, { currentHp: Math.max(1, newHp), currentEnergy: finalEnergy });

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: {
      ...(xpGained > 0 ? {} : { currentHp: Math.max(1, newHp), currentEnergy: finalEnergy }),
      gold: { increment: goldGained },
      totalKills: result === 'vitoria' ? { increment: 1 } : undefined,
      totalDeaths: result === 'derrota' ? { increment: 1 } : undefined,
      totalWins:   result === 'vitoria' ? { increment: 1 } : undefined,
      bossKills:   (result === 'vitoria' && enemy.type === 'boss') ? { increment: 1 } : undefined,
      karma: enemy.karmaEffect ? { increment: enemy.karmaEffect } : undefined,
      ...(mode === 'dungeon' ? { lastDungeon: slotStartedAt } : {}),
    },
  });

  if (xpGained > 0 && char.divineSkillId) {
    const skill = DIVINE_SKILLS[char.divineSkillId];
    if (skill) {
      const SKILL_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
      const skillXpGain = state.usedSkillThisRound ? Math.max(25, Math.floor(xpGained * 0.4)) : Math.max(5,  Math.floor(xpGained * 0.1));
      const newSkillExp  = char.divineSkillExp + skillXpGain;
      const rankIdx      = SKILL_RANKS.indexOf(char.divineSkillRank as typeof SKILL_RANKS[number]);
      const RANK_MULT    = [1, 2, 4, 8, 16, 32, 64, 128] as const;
      const canRankUp    = rankIdx >= 0 && rankIdx < SKILL_RANKS.length - 1 && newSkillExp >= (skill.rankUpExpRequired * (RANK_MULT[rankIdx] ?? 1));
      await prisma.rpgCharacter.update({
        where: { discordId: char.discordId },
        data: { divineSkillExp: canRankUp ? 0 : newSkillExp, divineSkillRank: canRankUp ? SKILL_RANKS[rankIdx + 1] : char.divineSkillRank },
      });
    }
  }

  for (const [itemId, qty] of itemsGainedMap.entries()) await giveItem(char.discordId, itemId, qty);

  await prisma.rpgCombatLog.create({
    data: {
      characterId: char.discordId,
      type: mode === 'hunt' ? 'hunt' : mode === 'expedition' ? 'dungeon' : enemy.type === 'boss' ? 'boss' : 'dungeon',
      result, enemyName: enemy.name, xpGained, goldGained, itemsGained: itemsDropped, rounds: state.round, summary: state.log.slice(-3).join(' '),
    },
  });

  if (result === 'vitoria' && guildId) {
    try {
      const { trackRpgMission } = await import('../../commands/utility/missoes');
      await trackRpgMission(char.discordId, guildId, 'matar_inimigos', 1);
      if (mode === 'dungeon' || mode === 'expedition') await trackRpgMission(char.discordId, guildId, 'vencer_dungeon', 1);
      if (enemy.type === 'boss') await trackRpgMission(char.discordId, guildId, 'matar_boss_rpg', 1);
      await trackRpgMission(char.discordId, guildId, 'ganhar_ouro_rpg', goldGained);
    } catch { }
  }

  return {
    result, rounds: state.round, log: state.log, xpGained, goldGained, itemsDropped,
    playerHpLeft: Math.max(1, newHp), playerEnergyLeft: finalEnergy, bossKill: enemy.type === 'boss' && result === 'vitoria',
  };
}

// ─── Combate interativo por turnos ─────────────────────────────────────────

export async function startInteractiveCombat(
  char: FullCharacter,
  enemy: Enemy,
  guildId?: string,
  mode: CombatMode = 'dungeon',
): Promise<CombatTurn> {
  if (activeCombats.has(char.discordId)) throw new CombatBlockedError('Você já está em uma batalha.');

  let slotStartedAt = new Date();
  if (mode === 'dungeon') {
    const slot = await claimDungeonSlot(char.discordId, char.currentHp, char.currentEnergy);
    if (!slot.success) throw new CombatBlockedError(slot.message);
    slotStartedAt = slot.startedAt;
  }

  if (char.currentHp <= 0) throw new CombatBlockedError('Você está sem HP. Vá à cidade e se cure antes de batalhar.');
  
  // A EXPEDIÇÃO É VIP E NÃO COBRA ENERGIA PARA INICIAR
  if (mode !== 'expedition' && char.currentEnergy < 10) {
      throw new CombatBlockedError('Você precisa de pelo menos **10⚡** para iniciar uma batalha.');
  }

  const stats = computeStats(char);
  const scaledEnemy = scaleEnemy(enemy, char.level);
  
  const modeTitle = mode === 'expedition' ? '🗺️ Expedição' : mode === 'hunt' ? '🌲 Caçada' : '⚔️ Dungeon';
  const state: CombatState = {
    playerHp: char.currentHp, playerEnergy: char.currentEnergy, enemyHp: scaledEnemy.baseHp, enemyMaxHp: scaledEnemy.baseHp,
    round: 0, usedSkillThisRound: false, berserkActive: 0, shieldActive: 0, enemyAttackMultiplier: 1, enemyDefenseMultiplier: 1,
    doubleDmgNextHit: false, poisonRounds: 0, frozenRounds: 0, stubbedRounds: 0, skillCooldown: 0,
    log: [
      `**${modeTitle}** — **${char.username}** vs **${enemy.name}** ${enemy.emoji}`,
      `❤️ Seus HP: **${char.currentHp}/${stats.maxHp}** | HP inimigo: **${scaledEnemy.baseHp}/${scaledEnemy.baseHp}**`,
      '', '🎯 **Seu turno!** Escolha uma ação nos botões abaixo.',
    ],
  };

  const session: InteractiveCombatSession = {
    char, enemy, scaledEnemy, guildId, mode, stats, state, startedAt: slotStartedAt,
    potionAvailable: await hasCombatPotion(char.discordId), skillUsedInCombat: false,
  };
  activeCombats.set(char.discordId, session);
  return buildCombatTurn(session);
}

export async function takeCombatAction(discordId: string, action: CombatAction): Promise<CombatTurn> {
  const session = activeCombats.get(discordId);
  if (!session) throw new CombatBlockedError('Essa batalha não está mais ativa. Inicie uma nova batalha.');

  const { char, enemy, scaledEnemy, stats, state } = session;
  const skill = char.divineSkillId ? DIVINE_SKILLS[char.divineSkillId] : undefined;

  if (action === 'skill') {
    if (!skill || skill.type === 'passiva') return rejectCombatAction(session, 'Você não possui uma habilidade ativa para usar.');
    if (state.skillCooldown > 0) return rejectCombatAction(session, `Habilidade pronta em **${state.skillCooldown} rodada(s)**.`);
    if (state.playerEnergy < skill.energyCost) return rejectCombatAction(session, `Você precisa de **${skill.energyCost}⚡** para usar ${skill.name}.`);
  }
  if (action === 'potion' && (!session.potionAvailable || state.playerHp >= stats.maxHp)) {
    return rejectCombatAction(session, 'Você não possui uma poção utilizável agora.');
  }

  state.round++;
  state.usedSkillThisRound = false;
  state.log.push(`**— Rodada ${state.round} —**`);
  applyEnemyTactics(scaledEnemy, state);

  if (action === 'flee') {
    state.log.push('🏃 Você fugiu da batalha e não recebeu recompensas.');
    const result = await finalizeInteractiveCombat(session, 'fuga');
    activeCombats.delete(discordId);
    return buildCombatTurn(session, result);
  }

  if (action === 'skill') useInteractiveSkill(session, skill!);
  else if (action === 'attack') {
    if (state.frozenRounds > 0) { state.log.push('❄️ Você está congelado e perdeu o turno!'); state.frozenRounds--; } 
    else {
      const playerDmg = calcPlayerDamage(char, stats, state, scaledEnemy, false);
      state.enemyHp = Math.max(0, state.enemyHp - playerDmg.damage);
      state.log.push(playerDmg.msg);
    }
  } else if (action === 'defend') {
    state.shieldActive = Math.max(state.shieldActive, 1);
    state.log.push('🛡️ Você assume uma postura defensiva e reduzirá o próximo ataque em 50%.');
  } else if (action === 'potion') {
    const potion = await consumeCombatPotion(discordId, stats.maxHp, state.playerHp);
    if (!potion) return rejectCombatAction(session, 'Poção não disponível. Atualize sua batalha.');
    session.potionAvailable = await hasCombatPotion(discordId);
    state.playerHp = Math.min(stats.maxHp, state.playerHp + potion.heal);
    state.log.push(`🧪 Você usou **${potion.name}** e recuperou **${potion.heal} HP**.`);
  }

  if (state.enemyHp <= 0) {
    state.log.push(`🏆 **VITÓRIA!** ${enemy.name} foi derrotado!`);
    const result = await finalizeInteractiveCombat(session, 'vitoria');
    activeCombats.delete(discordId);
    return buildCombatTurn(session, result);
  }

  if (state.stubbedRounds > 0) {
    state.log.push(`😵 ${enemy.name} está atordoado e perdeu o turno!`);
    state.stubbedRounds--;
  } else {
    const enemyDmg = calcEnemyDamage(scaledEnemy, stats, state);
    state.playerHp = Math.max(0, state.playerHp - enemyDmg.damage);
    state.log.push(enemyDmg.msg);
  }

  if (state.poisonRounds > 0 && state.enemyHp > 0) {
    const poisonDmg = Math.max(1, Math.floor(stats.attack * 0.08));
    state.enemyHp = Math.max(0, state.enemyHp - poisonDmg);
    state.log.push(`☠️ Veneno causa **${poisonDmg}** de dano!`);
    state.poisonRounds--;
  }
  state.skillCooldown = Math.max(0, state.skillCooldown - 1);

  if (state.playerHp <= 0) {
    state.log.push(`💀 **DERROTA!** Você foi derrotado por ${enemy.name}...`);
    const result = await finalizeInteractiveCombat(session, 'derrota');
    activeCombats.delete(discordId);
    return buildCombatTurn(session, result);
  }
  if (state.round >= 20) {
    state.log.push('💥 O combate chegou ao limite de rodadas e terminou em empate.');
    const result = await finalizeInteractiveCombat(session, 'empate');
    activeCombats.delete(discordId);
    return buildCombatTurn(session, result);
  }

  state.log.push(`> ❤️ Seu HP: **${state.playerHp}** | HP inimigo: **${state.enemyHp}**`);
  state.log.push('🎯 **Seu turno!** Escolha sua próxima ação.');
  return buildCombatTurn(session);
}

function useInteractiveSkill(session: InteractiveCombatSession, skill: typeof DIVINE_SKILLS[string]): void {
  const { char, stats, scaledEnemy, state } = session;
  if (skill.type === 'ataque' || skill.type === 'ultimate') {
    if (state.frozenRounds > 0) { state.log.push(`❄️ Congelado!`); state.frozenRounds--; return; }
    const attack = calcPlayerDamage(char, stats, state, scaledEnemy, true);
    state.enemyHp = Math.max(0, state.enemyHp - attack.damage);
    state.log.push(`✨ **${skill.name}** — ${attack.msg}`);
  } else if (skill.type === 'defesa') {
    state.playerEnergy -= skill.energyCost;
    state.shieldActive = Math.max(state.shieldActive, 2);
    state.log.push(`✨ **${skill.name}** ativada: escudo por 2 ataques.`);
  } else {
    state.playerEnergy -= skill.energyCost;
    state.berserkActive = Math.max(state.berserkActive, 3);
    state.log.push(`✨ **${skill.name}** ativada: próximo ataque fortalecido.`);
  }
  state.usedSkillThisRound = true;
  session.skillUsedInCombat = true;
  state.skillCooldown = skill.cooldownRounds;
}

function buildCombatTurn(session: InteractiveCombatSession, result?: CombatResult): CombatTurn {
  const { char, enemy, mode, state } = session;
  const skill = char.divineSkillId ? DIVINE_SKILLS[char.divineSkillId] : undefined;
  return {
    finished: !!result, result, log: state.log, round: state.round,
    playerHp: result?.playerHpLeft ?? state.playerHp, playerEnergy: result?.playerEnergyLeft ?? state.playerEnergy,
    enemyHp: state.enemyHp, enemyMaxHp: state.enemyMaxHp, enemyName: enemy.name, enemyEmoji: enemy.emoji, mode,
    skillName: skill?.name, skillReady: !!skill && skill.type !== 'passiva' && state.skillCooldown === 0 && state.playerEnergy >= skill.energyCost,
    potionAvailable: session.potionAvailable && state.playerHp < session.stats.maxHp,
  };
}

function rejectCombatAction(session: InteractiveCombatSession, message: string): CombatTurn {
  session.state.log.push(`⚠️ ${message}`);
  session.state.log.push('🎯 **Seu turno continua.** Escolha outra ação.');
  return buildCombatTurn(session);
}

async function hasCombatPotion(discordId: string): Promise<boolean> {
  const inventory = await prisma.rpgInventoryItem.findFirst({
    where: { characterId: discordId, itemId: { in: ['pocao_de_vida_g', 'pocao_de_vida_m', 'pocao_de_vida_p'] }, quantity: { gt: 0 } },
  });
  return !!inventory;
}

async function consumeCombatPotion(discordId: string, maxHp: number, currentHp: number): Promise<{ name: string; heal: number } | null> {
  if (currentHp >= maxHp) return null;
  const inventory = await prisma.rpgInventoryItem.findFirst({
    where: { characterId: discordId, itemId: { in: ['pocao_de_vida_g', 'pocao_de_vida_m', 'pocao_de_vida_p'] }, quantity: { gt: 0 } },
    orderBy: { itemId: 'asc' },
  });
  if (!inventory) return null;
  const item = getItem(inventory.itemId);
  if (!item) return null;
  const heal = item.id === 'pocao_de_vida_g' ? maxHp - currentHp : Math.min(item.stats?.maxHp ?? 0, maxHp - currentHp);

  const consumed = await prisma.$transaction(async tx => {
    const locked = await tx.rpgInventoryItem.updateMany({ where: { characterId: discordId, itemId: inventory.itemId, quantity: { gt: 0 } }, data: { quantity: { decrement: 1 } } });
    return locked.count > 0;
  });
  if (!consumed) return null;

  if (inventory.quantity === 1) await prisma.rpgInventoryItem.deleteMany({ where: { characterId: discordId, itemId: inventory.itemId, quantity: 0 } });
  return { name: item.name, heal };
}

async function finalizeInteractiveCombat(session: InteractiveCombatSession, result: CombatResult['result']): Promise<CombatResult> {
  const { char, enemy, scaledEnemy, stats, state, guildId, mode } = session;
  let xpGained = 0, goldGained = 0;
  const itemsDropped: string[] = [];
  const itemsGainedMap = new Map<string, number>();

  if (result === 'vitoria') {
    const { getEventMultipliers } = await import('../panels/world-events');
    const worldMults = guildId ? await getEventMultipliers(guildId) : { xp: 1, gold: 1, dropBonus: 0, noEnergy: false, enemyMult: 1 };
    const combatBuffs = getCombatBuffMultipliers(await getActiveBuffs(char.discordId));
    xpGained = Math.floor(scaledEnemy.xpReward * (1 + stats.xpBonus / 100) * worldMults.xp * combatBuffs.xp);
    goldGained = Math.floor((scaledEnemy.goldReward.min + Math.random() * (scaledEnemy.goldReward.max - scaledEnemy.goldReward.min)) * (1 + stats.goldBonus / 100) * worldMults.gold * combatBuffs.gold);
    
    for (const drop of enemy.drops) {
      if (Math.random() <= drop.chance + worldMults.dropBonus) {
        const qty = Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1)) + drop.minQty;
        itemsGainedMap.set(drop.itemId, (itemsGainedMap.get(drop.itemId) || 0) + qty);
      }
    }
    for (const [id, qty] of itemsGainedMap.entries()) { for (let i = 0; i < qty; i++) itemsDropped.push(id); }
    if (itemsGainedMap.size > 0) state.log.push(`🎁 **Drops obtidos!**`);
  }

  const { getEventMultipliers: getMults } = await import('../panels/world-events');
  const blessing = guildId ? await getMults(guildId) : { noEnergy: false };
  
  // A EXPEDIÇÃO É VIP E NÃO CONSOME ENERGIA DURANTE O COMBATE
  const energyCost = (blessing.noEnergy || mode === 'expedition') ? 0 : Math.min(state.playerEnergy, 25 + state.round * 3);
  const finalEnergy = Math.max(0, state.playerEnergy - energyCost);
  const newHp = result === 'derrota' ? Math.floor(stats.maxHp * 0.1) : state.playerHp;

  if (xpGained > 0) await addRpgXp(char, xpGained, { currentHp: Math.max(1, newHp), currentEnergy: finalEnergy });
  
  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: {
      ...(xpGained > 0 ? {} : { currentHp: Math.max(1, newHp), currentEnergy: finalEnergy }),
      gold: { increment: goldGained }, totalKills: result === 'vitoria' ? { increment: 1 } : undefined,
      totalDeaths: result === 'derrota' ? { increment: 1 } : undefined, totalWins: result === 'vitoria' ? { increment: 1 } : undefined,
      bossKills: result === 'vitoria' && enemy.type === 'boss' ? { increment: 1 } : undefined, karma: enemy.karmaEffect ? { increment: enemy.karmaEffect } : undefined,
      ...(mode === 'dungeon' ? { lastDungeon: session.startedAt } : {}),
    },
  });

  for (const [itemId, qty] of itemsGainedMap.entries()) await giveItem(char.discordId, itemId, qty);

  await prisma.rpgCombatLog.create({
    data: {
      characterId: char.discordId, type: mode === 'hunt' ? 'hunt' : mode === 'expedition' ? 'dungeon' : enemy.type === 'boss' ? 'boss' : 'dungeon',
      result, enemyName: enemy.name, xpGained, goldGained, itemsGained: itemsDropped, rounds: state.round, summary: state.log.slice(-3).join(' '),
    },
  });

  return { result, rounds: state.round, log: state.log, xpGained, goldGained, itemsDropped, playerHpLeft: Math.max(1, newHp), playerEnergyLeft: finalEnergy, bossKill: enemy.type === 'boss' && result === 'vitoria' };
}

// ─── Helpers internos (MANTIDOS INTACTOS) ─────────────────────────────────────────────────────

export async function runPvp(attacker: FullCharacter, defender: FullCharacter): Promise<{winner: string; loser: string; log: string[]; xpGained: number; goldStolen: number;}> {
  const atkStats = computeStats(attacker);
  const defStats = computeStats(defender);
  const log: string[] = [];
  log.push(`⚔️ **PvP:** ${attacker.username} vs ${defender.username}`);
  let atkHp = attacker.currentHp, defHp = defender.currentHp, round = 0;
  while (round < 15 && atkHp > 0 && defHp > 0) {
    round++;
    const rawDmg = Math.max(1, atkStats.attack - defStats.defense * 0.5);
    const crit = Math.random() * 100 < atkStats.critChance;
    defHp -= Math.floor(crit ? rawDmg * 2 : rawDmg);
    if (defHp <= 0) break;
    const rawDmg2 = Math.max(1, defStats.attack - atkStats.defense * 0.5);
    const crit2 = Math.random() * 100 < defStats.critChance;
    atkHp -= Math.floor(crit2 ? rawDmg2 * 2 : rawDmg2);
  }
  const attackerWon = defHp <= 0 || (atkHp > 0 && defHp > 0 && atkStats.combatPower > defStats.combatPower);
  const winner = attackerWon ? attacker : defender, loser = attackerWon ? defender : attacker;
  const xpGained = Math.floor(loser.level * 15), goldStolen = Math.floor(loser.gold * 0.05);
  await Promise.all([
    prisma.rpgCharacter.update({ where: { discordId: winner.discordId }, data: { pvpWins: { increment: 1 }, gold: { increment: goldStolen }, lastPvp: new Date() } }),
    prisma.rpgCharacter.update({ where: { discordId: loser.discordId },  data: { pvpLosses: { increment: 1 }, gold: { decrement: Math.min(goldStolen, loser.gold) }, lastPvp: new Date() } }),
    addRpgXp(winner, xpGained),
  ]);
  return { winner: winner.discordId, loser: loser.discordId, log, xpGained, goldStolen };
}

function calcPlayerDamage(char: FullCharacter, stats: ComputedStats, state: CombatState, enemy: Enemy, useSkill: boolean): { damage: number; msg: string } {
  let dmg = Math.max(1, stats.attack - Math.floor(enemy.baseDefense * state.enemyDefenseMultiplier * 0.4));
  let msg = '';
  if (useSkill && char.divineSkillId && state.playerEnergy >= (DIVINE_SKILLS[char.divineSkillId]?.energyCost ?? 999)) {
    const skill = DIVINE_SKILLS[char.divineSkillId];
    if (skill && skill.type === 'ataque') {
      dmg = Math.floor(dmg * skillEffectValue(skill, char.divineSkillRank as SkillRank));
      state.playerEnergy -= skill.energyCost; state.usedSkillThisRound = true; msg = `✨ **${skill.name}** ${skill.emoji} — `;
    }
  }
  if (state.berserkActive > 0) { dmg = Math.floor(dmg * 1.8); state.berserkActive--; }
  const isCrit = Math.random() * 100 < stats.critChance;
  if (isCrit) dmg = Math.floor(dmg * 2.0);
  if (state.doubleDmgNextHit) { dmg *= 2; state.doubleDmgNextHit = false; }
  msg += `⚔️ Você causa **${dmg}** de dano${isCrit ? ' 💥 CRÍTICO!' : '.'}`;
  return { damage: dmg, msg };
}

function calcEnemyDamage(enemy: Enemy, stats: ComputedStats, state: CombatState): { damage: number; msg: string } {
  let dmg = Math.max(1, Math.floor(enemy.baseAttack * state.enemyAttackMultiplier) - Math.floor(stats.defense * 0.5));
  if (state.shieldActive > 0) { dmg = Math.floor(dmg * 0.5); state.shieldActive--; }
  if (Math.random() * 100 < stats.dodgeChance) return { damage: 0, msg: `💨 Você esquivou!` };
  return { damage: dmg, msg: `💢 ${enemy.name} causa **${dmg}** de dano.` };
}

function applyEnemyTactics(enemy: Enemy, state: CombatState): void {
  if (!enemy.abilities?.length) return;
  const abilities = enemy.abilities.join(' ').toLowerCase();
  if (abilities.includes('veneno') && state.round === 1) { state.poisonRounds = Math.max(state.poisonRounds, 3); state.log.push(`☠️ Veneno aplicado por 3 turnos.`); }
  if ((abilities.includes('raízes') || abilities.includes('congela')) && state.round > 1 && Math.random() < 0.22) { state.frozenRounds = Math.max(state.frozenRounds, 1); state.log.push(`🌀 Controle de grupo ativado pelo inimigo!`); }
  if (abilities.includes('forma final') && state.round === 2) { state.enemyAttackMultiplier = 1.3; state.log.push(`🔥 O boss entrou em fúria!`); }
  if (abilities.includes('pele de pedra') && state.round % 2 === 1) state.enemyDefenseMultiplier = 1.5; else state.enemyDefenseMultiplier = 1;
}

export async function giveItem(discordId: string, itemId: string, qty: number = 1) {
  return prisma.rpgInventoryItem.upsert({ where: { characterId_itemId: { characterId: discordId, itemId } }, update: { quantity: { increment: qty } }, create: { characterId: discordId, itemId, quantity: qty } });
}

export async function claimDungeonSlot(discordId: string, currentHp: number, currentEnergy: number): Promise<{ success: true; startedAt: Date } | { success: false; message: string }> {
  if (currentHp <= 0) return { success: false, message: 'Sem HP.' };
  const startedAt = new Date();
  const claimed = await prisma.rpgCharacter.updateMany({
    where: { discordId, currentHp: { gt: 0 }, OR: [{ lastDungeon: null }, { lastDungeon: { lte: new Date(startedAt.getTime() - DUNGEON_COOLDOWN_MS) } }] },
    data: { lastDungeon: startedAt },
  });
  if (claimed.count === 0) return { success: false, message: `Sua próxima batalha estará disponível em alguns minutos.` };
  return { success: true, startedAt };
}

export function isDungeonOnCooldown(char: FullCharacter, cooldownMin: number): { onCooldown: boolean; remaining: string } {
  if (!char.lastDungeon) return { onCooldown: false, remaining: '' };
  const rem = (cooldownMin * 60 * 1000) - (Date.now() - char.lastDungeon.getTime());
  if (rem <= 0) return { onCooldown: false, remaining: '' };
  return { onCooldown: true, remaining: `${Math.ceil(rem / 60000)} minuto(s)` };
}
export function isTravelOnCooldown(char: FullCharacter, cooldownMin: number): { onCooldown: boolean; remaining: string } {
  if (!char.lastTravel) return { onCooldown: false, remaining: '' };
  const rem = (cooldownMin * 60 * 1000) - (Date.now() - char.lastTravel.getTime());
  if (rem <= 0) return { onCooldown: false, remaining: '' };
  return { onCooldown: true, remaining: `${Math.ceil(rem / 60000)} minuto(s)` };
}
