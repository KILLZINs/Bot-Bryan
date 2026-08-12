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
export type CombatMode = 'dungeon' | 'hunt';

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
  itemsDropped: string[];   // itemIds
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
  berserkActive: number;     // turnos restantes
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

// ─── Combate principal ─────────────────────────────────────────────────────

export async function runCombat(
  char: FullCharacter,
  enemy: Enemy,
  useSkill: boolean = false,
  guildId?: string,
  mode: CombatMode = 'dungeon',
): Promise<CombatResult> {
  const slot = mode === 'dungeon'
    ? await claimDungeonSlot(char.discordId, char.currentHp, char.currentEnergy)
    : { success: true as const, startedAt: new Date() };
  if (!slot.success) throw new CombatBlockedError(slot.message);
  if (mode === 'hunt') {
    if (char.currentHp <= 0) throw new CombatBlockedError('Você está sem HP. Vá à cidade e se cure antes de caçar.');
    if (char.currentEnergy < 10) throw new CombatBlockedError('Você precisa de pelo menos **10⚡** para iniciar uma caça.');
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

  state.log.push(`${mode === 'hunt' ? '🌲' : '⚔️'} **${mode === 'hunt' ? 'Caçada' : 'Dungeon'}** — **${char.username}** (Lv.${char.level} ${char.class}) vs **${enemy.name}** ${enemy.emoji}`);
  state.log.push(`❤️ Seus HP: **${state.playerHp}/${stats.maxHp}** | HP inimigo: **${state.enemyHp}**`);
  state.log.push('');

  while (state.round < MAX_ROUNDS && state.playerHp > 0 && state.enemyHp > 0) {
    state.round++;
    state.log.push(`**— Rodada ${state.round} —**`);
    applyEnemyTactics(scaledEnemy, state);

    // ── Seu turno ──────────────────────────────────────────────────────────
    if (state.frozenRounds > 0) {
      state.log.push(`❄️ Você está congelado! Não pode atacar.`);
      state.frozenRounds--;
    } else {
      const playerDmg = calcPlayerDamage(char, stats, state, scaledEnemy, useSkill && state.round === 1);
      state.enemyHp = Math.max(0, state.enemyHp - playerDmg.damage);
      state.log.push(playerDmg.msg);
    }

    if (state.enemyHp <= 0) break;

    // ── Turno do inimigo ───────────────────────────────────────────────────
    if (state.stubbedRounds > 0) {
      state.log.push(`😵 ${enemy.name} está atordoado!`);
      state.stubbedRounds--;
    } else {
      const enemyDmg = calcEnemyDamage(scaledEnemy, stats, state);
      state.playerHp = Math.max(0, state.playerHp - enemyDmg.damage);
      state.log.push(enemyDmg.msg);
    }

    // ── Efeitos de veneno ──────────────────────────────────────────────────
    if (state.poisonRounds > 0 && state.enemyHp > 0) {
      const poisonDmg = Math.max(1, Math.floor(stats.attack * 0.08));
      state.enemyHp = Math.max(0, state.enemyHp - poisonDmg);
      state.log.push(`☠️ Veneno causa **${poisonDmg}** de dano!`);
      state.poisonRounds--;
    }

    // status HP
    if (state.playerHp > 0 && state.enemyHp > 0) {
      state.log.push(`> ❤️ Seu HP: **${state.playerHp}** | HP inimigo: **${state.enemyHp}**`);
    }
  }

  // ── Determinar resultado ───────────────────────────────────────────────────
  let result: CombatResult['result'] = 'empate';
  let xpGained = 0;
  let goldGained = 0;
  const itemsDropped: string[] = [];
  const itemsGainedMap = new Map<string, number>();

  if (state.playerHp <= 0 && state.enemyHp <= 0) {
    result = 'empate';
    state.log.push(`\n💥 **EMPATE!** Ambos caíram ao mesmo tempo!`);
    state.log.push('Nenhuma recompensa foi concedida: uma vitória precisa ser conquistada.');
  } else if (state.enemyHp <= 0) {
    result = 'vitoria';
    state.log.push(`\n🏆 **VITÓRIA!** ${enemy.name} foi derrotado!`);

    // calcular recompensas (com multiplicadores de eventos de mundo)
    const { getEventMultipliers } = await import('../panels/world-events');
    const worldMults = guildId ? await getEventMultipliers(guildId) : { xp: 1, gold: 1, dropBonus: 0, noEnergy: false, enemyMult: 1 };
    const combatBuffs = getCombatBuffMultipliers(await getActiveBuffs(char.discordId));
    const goldBonus = (1 + (stats.goldBonus / 100)) * worldMults.gold * combatBuffs.gold;
    const xpBonus   = (1 + ((stats.xpBonus) / 100)) * worldMults.xp * combatBuffs.xp;
    
    xpGained   = Math.floor(scaledEnemy.xpReward * xpBonus);
    goldGained = Math.floor((scaledEnemy.goldReward.min + Math.random() * (scaledEnemy.goldReward.max - scaledEnemy.goldReward.min)) * goldBonus);

    if (worldMults.xp > 1) state.log.push(`⭐ Bônus de evento: **×${worldMults.xp} XP**!`);
    if (worldMults.gold > 1) state.log.push(`💰 Bônus de evento: **×${worldMults.gold} Ouro**!`);
    if (combatBuffs.xp > 1) state.log.push(`💜 Buff ativo: **×${combatBuffs.xp} XP**!`);
    if (combatBuffs.gold > 1) state.log.push(`💰 Buff ativo: **×${combatBuffs.gold} Ouro**!`);

    // novo sistema de drop de itens (com quantidade variada e chance)
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

    if (itemsGainedMap.size > 0) {
      const names = Array.from(itemsGainedMap.entries()).map(([id, qty]) => `**${qty}x** ${getItem(id)?.name ?? id}`).join(', ');
      state.log.push(`🎁 **Drops:** ${names}`);
    }
    state.log.push(`⭐ **+${xpGained} XP** | 💰 **+${goldGained} Ouro**`);
  } else {
    result = 'derrota';
    state.log.push(`\n💀 **DERROTA!** Você foi derrotado por ${enemy.name}...`);
    goldGained = 0;
    state.log.push('Você não ganhou XP, mas saiu vivo o bastante para tentar novamente depois de se recuperar.');
  }

  // ── Salvar no banco ────────────────────────────────────────────────────────
  const newHp = result === 'derrota' ? Math.floor(stats.maxHp * 0.1) : state.playerHp;
  const { getEventMultipliers: getMults } = await import('../panels/world-events');
  const blessingCheck = guildId ? await getMults(guildId) : { noEnergy: false };
  const energyCost = blessingCheck.noEnergy ? 0 : Math.min(state.playerEnergy, 25 + state.round * 3);
  if (blessingCheck.noEnergy) state.log.push('✨ **Bênção dos Antigos**: energia não consumida!');
  const finalEnergy = Math.max(0, state.playerEnergy - energyCost);

  if (xpGained > 0) {
    await addRpgXp(char, xpGained, {
      currentHp: Math.max(1, newHp),
      currentEnergy: finalEnergy,
    });
  }

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
      ...(mode === 'dungeon' ? { lastDungeon: slot.startedAt } : {}),
    },
  });

  // ── XP de habilidade divina ─────────────────────
  if (xpGained > 0 && char.divineSkillId) {
    const skill = DIVINE_SKILLS[char.divineSkillId];
    if (skill) {
      const SKILL_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
      const skillXpGain = state.usedSkillThisRound
        ? Math.max(25, Math.floor(xpGained * 0.4))
        : Math.max(5,  Math.floor(xpGained * 0.1));
      const newSkillExp  = char.divineSkillExp + skillXpGain;
      const rankIdx      = SKILL_RANKS.indexOf(char.divineSkillRank as typeof SKILL_RANKS[number]);
      const RANK_MULT    = [1, 2, 4, 8, 16, 32, 64, 128] as const;
      const requiredXp   = skill.rankUpExpRequired * (RANK_MULT[rankIdx] ?? 1);
      const canRankUp    = rankIdx >= 0 && rankIdx < SKILL_RANKS.length - 1 && newSkillExp >= requiredXp;
      const newRank      = canRankUp ? SKILL_RANKS[rankIdx + 1] : char.divineSkillRank;

      await prisma.rpgCharacter.update({
        where: { discordId: char.discordId },
        data: {
          divineSkillExp:  canRankUp ? 0 : newSkillExp,
          divineSkillRank: newRank,
        },
      });

      const usedMark = state.usedSkillThisRound ? ' ✨' : '';
      state.log.push(`\n✨ **${skill.name}** +**${skillXpGain} XP** de habilidade${usedMark} (${canRankUp ? 0 : newSkillExp}/${requiredXp})`);
      if (canRankUp) {
        state.log.push(`🌟 **RANK UP!** ${skill.emoji} **${skill.name}** → Rank **${newRank}**! 🎊`);
      }
    }
  }

  // salvar drops no inventário
  for (const [itemId, qty] of itemsGainedMap.entries()) {
    await giveItem(char.discordId, itemId, qty);
  }

  // salvar log
  await prisma.rpgCombatLog.create({
    data: {
      characterId: char.discordId,
      type: mode === 'hunt' ? 'hunt' : enemy.type === 'boss' ? 'boss' : 'dungeon',
      result,
      enemyName: enemy.name,
      xpGained, goldGained,
      itemsGained: itemsDropped,
      rounds: state.round,
      summary: state.log.slice(-3).join(' '),
    },
  });

  if (result === 'vitoria' && guildId) {
    try {
      const { trackRpgMission } = await import('../../commands/utility/missoes');
      await trackRpgMission(char.discordId, guildId, 'matar_inimigos', 1);
      if (mode === 'dungeon') await trackRpgMission(char.discordId, guildId, 'vencer_dungeon', 1);
      if (enemy.type === 'boss') await trackRpgMission(char.discordId, guildId, 'matar_boss_rpg', 1);
      await trackRpgMission(char.discordId, guildId, 'ganhar_ouro_rpg', goldGained);
    } catch {
      // Ignora erro se missões falharem
    }
  }

  return {
    result, rounds: state.round, log: state.log,
    xpGained, goldGained, itemsDropped,
    playerHpLeft: Math.max(1, newHp),
    playerEnergyLeft: finalEnergy,
    bossKill: enemy.type === 'boss' && result === 'vitoria',
  };
}

// ─── Combate interativo por turnos ─────────────────────────────────────────

export async function startInteractiveCombat(
  char: FullCharacter,
  enemy: Enemy,
  guildId?: string,
  mode: CombatMode = 'dungeon',
): Promise<CombatTurn> {
  if (activeCombats.has(char.discordId)) {
    throw new CombatBlockedError('Você já está em uma batalha. Escolha uma ação antes de iniciar outra.');
  }

  const slot = mode === 'dungeon'
    ? await claimDungeonSlot(char.discordId, char.currentHp, char.currentEnergy)
    : { success: true as const, startedAt: new Date() };
  if (!slot.success) throw new CombatBlockedError(slot.message);
  if (char.currentHp <= 0) throw new CombatBlockedError('Você está sem HP. Vá à cidade e se cure antes de batalhar.');
  if (char.currentEnergy < 10) throw new CombatBlockedError('Você precisa de pelo menos **10⚡** para iniciar uma batalha.');

  const stats = computeStats(char);
  const scaledEnemy = scaleEnemy(enemy, char.level);
  const state: CombatState = {
    playerHp: char.currentHp,
    playerEnergy: char.currentEnergy,
    enemyHp: scaledEnemy.baseHp,
    enemyMaxHp: scaledEnemy.baseHp,
    round: 0,
    log: [
      `${mode === 'hunt' ? '🌲' : '⚔️'} **${mode === 'hunt' ? 'Caçada' : 'Dungeon'}** — **${char.username}** (Lv.${char.level} ${char.class}) vs **${enemy.name}** ${enemy.emoji}`,
      `❤️ Seus HP: **${char.currentHp}/${stats.maxHp}** | HP inimigo: **${scaledEnemy.baseHp}/${scaledEnemy.baseHp}**`,
      '',
      '🎯 **Seu turno!** Escolha uma ação nos botões abaixo.',
    ],
    usedSkillThisRound: false,
    berserkActive: 0,
    shieldActive: 0,
    enemyAttackMultiplier: 1,
    enemyDefenseMultiplier: 1,
    doubleDmgNextHit: false,
    poisonRounds: 0,
    frozenRounds: 0,
    stubbedRounds: 0,
    skillCooldown: 0,
  };

  const session: InteractiveCombatSession = {
    char,
    enemy,
    scaledEnemy,
    guildId,
    mode,
    stats,
    state,
    startedAt: slot.startedAt,
    potionAvailable: await hasCombatPotion(char.discordId),
    skillUsedInCombat: false,
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
    if (!skill || skill.type === 'passiva') {
      return rejectCombatAction(session, 'Você não possui uma habilidade ativa para usar neste combate.');
    }
    if (state.skillCooldown > 0) {
      return rejectCombatAction(session, `Sua habilidade estará pronta em **${state.skillCooldown} rodada(s)**.`);
    }
    if (state.playerEnergy < skill.energyCost) {
      return rejectCombatAction(session, `Você precisa de **${skill.energyCost}⚡** para usar ${skill.name}.`);
    }
  }
  if (action === 'potion' && (!session.potionAvailable || state.playerHp >= stats.maxHp)) {
    return rejectCombatAction(session, 'Você não possui uma poção de vida utilizável agora.');
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

  if (action === 'skill') {
    useInteractiveSkill(session, skill!);
  } else if (action === 'attack') {
    if (state.frozenRounds > 0) {
      state.log.push('❄️ Você está congelado e perdeu o turno!');
      state.frozenRounds--;
    } else {
      const playerDmg = calcPlayerDamage(char, stats, state, scaledEnemy, false);
      state.enemyHp = Math.max(0, state.enemyHp - playerDmg.damage);
      state.log.push(playerDmg.msg);
    }
  } else if (action === 'defend') {
    state.shieldActive = Math.max(state.shieldActive, 1);
    state.log.push('🛡️ Você assume uma postura defensiva e reduzirá o próximo ataque em 50%.');
  } else if (action === 'potion') {
    const potion = await consumeCombatPotion(discordId, stats.maxHp, state.playerHp);
    if (!potion) return rejectCombatAction(session, 'A poção não está mais disponível. Atualize sua batalha.');
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
    if (state.frozenRounds > 0) {
      state.log.push(`❄️ Você está congelado e não conseguiu conjurar **${skill.name}**.`);
      state.frozenRounds--;
      return;
    }
    const attack = calcPlayerDamage(char, stats, state, scaledEnemy, true);
    state.enemyHp = Math.max(0, state.enemyHp - attack.damage);
    state.log.push(`✨ **${skill.name}** — ${attack.msg}`);
  } else if (skill.type === 'defesa') {
    state.playerEnergy -= skill.energyCost;
    state.shieldActive = Math.max(state.shieldActive, 2);
    state.log.push(`✨ **${skill.name}** ativada: seu escudo durará 2 ataques.`);
  } else {
    state.playerEnergy -= skill.energyCost;
    state.berserkActive = Math.max(state.berserkActive, 3);
    state.log.push(`✨ **${skill.name}** ativada: seu próximo ataque ficará fortalecido.`);
  }
  state.usedSkillThisRound = true;
  session.skillUsedInCombat = true;
  state.skillCooldown = skill.cooldownRounds;
}

function buildCombatTurn(session: InteractiveCombatSession, result?: CombatResult): CombatTurn {
  const { char, enemy, mode, state } = session;
  const skill = char.divineSkillId ? DIVINE_SKILLS[char.divineSkillId] : undefined;
  return {
    finished: !!result,
    result,
    log: state.log,
    round: state.round,
    playerHp: result?.playerHpLeft ?? state.playerHp,
    playerEnergy: result?.playerEnergyLeft ?? state.playerEnergy,
    enemyHp: state.enemyHp,
    enemyMaxHp: state.enemyMaxHp,
    enemyName: enemy.name,
    enemyEmoji: enemy.emoji,
    mode,
    skillName: skill?.name,
    skillReady: !!skill && skill.type !== 'passiva' && state.skillCooldown === 0 && state.playerEnergy >= skill.energyCost,
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
    where: {
      characterId: discordId,
      itemId: { in: ['pocao_de_vida_g', 'pocao_de_vida_m', 'pocao_de_vida_p'] },
      quantity: { gt: 0 },
    },
    select: { characterId: true },
  });
  return !!inventory;
}

async function consumeCombatPotion(
  discordId: string,
  maxHp: number,
  currentHp: number,
): Promise<{ name: string; heal: number } | null> {
  if (currentHp >= maxHp) return null;

  const potionIds = ['pocao_de_vida_g', 'pocao_de_vida_m', 'pocao_de_vida_p'];
  const inventory = await prisma.rpgInventoryItem.findFirst({
    where: {
      characterId: discordId,
      itemId: { in: potionIds },
      quantity: { gt: 0 },
    },
    orderBy: { itemId: 'asc' },
  });
  if (!inventory) return null;

  const item = getItem(inventory.itemId);
  if (!item) return null;
  const heal = item.id === 'pocao_de_vida_g'
    ? maxHp - currentHp
    : Math.min(item.stats?.maxHp ?? 0, maxHp - currentHp);

  const consumed = await prisma.$transaction(async tx => {
    const locked = await tx.rpgInventoryItem.updateMany({
      where: { characterId: discordId, itemId: inventory.itemId, quantity: { gt: 0 } },
      data: { quantity: { decrement: 1 } },
    });
    return locked.count > 0;
  });
  if (!consumed) return null;

  if (inventory.quantity === 1) {
    await prisma.rpgInventoryItem.deleteMany({
      where: { characterId: discordId, itemId: inventory.itemId, quantity: 0 },
    });
  }
  return { name: item.name, heal };
}

async function finalizeInteractiveCombat(
  session: InteractiveCombatSession,
  result: CombatResult['result'],
): Promise<CombatResult> {
  const { char, enemy, scaledEnemy, stats, state, guildId, mode } = session;
  let xpGained = 0;
  let goldGained = 0;
  const itemsDropped: string[] = [];
  const itemsGainedMap = new Map<string, number>();

  if (result === 'vitoria') {
    const { getEventMultipliers } = await import('../panels/world-events');
    const worldMults = guildId
      ? await getEventMultipliers(guildId)
      : { xp: 1, gold: 1, dropBonus: 0, noEnergy: false, enemyMult: 1 };
    const combatBuffs = getCombatBuffMultipliers(await getActiveBuffs(char.discordId));
    xpGained = Math.floor(scaledEnemy.xpReward * (1 + stats.xpBonus / 100) * worldMults.xp * combatBuffs.xp);
    
    // Ouro Dinâmico
    goldGained = Math.floor(
      (scaledEnemy.goldReward.min + Math.random() * (scaledEnemy.goldReward.max - scaledEnemy.goldReward.min))
      * (1 + stats.goldBonus / 100) * worldMults.gold * combatBuffs.gold
    );
    
    // Sistema de Drops Dinâmicos
    for (const drop of enemy.drops) {
      if (Math.random() <= drop.chance + worldMults.dropBonus) {
        const qty = Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1)) + drop.minQty;
        itemsGainedMap.set(drop.itemId, (itemsGainedMap.get(drop.itemId) || 0) + qty);
      }
    }

    for (const [id, qty] of itemsGainedMap.entries()) {
      for (let i = 0; i < qty; i++) itemsDropped.push(id);
    }

    if (itemsGainedMap.size > 0) {
      const names = Array.from(itemsGainedMap.entries()).map(([id, qty]) => `**${qty}x** ${getItem(id)?.name ?? id}`).join(', ');
      state.log.push(`🎁 **Drops:** ${names}`);
    }
    state.log.push(`⭐ **+${xpGained} XP** | 💰 **+${goldGained} Ouro**`);
  }

  const { getEventMultipliers: getMults } = await import('../panels/world-events');
  const blessing = guildId ? await getMults(guildId) : { noEnergy: false };
  const energyCost = blessing.noEnergy ? 0 : Math.min(state.playerEnergy, 25 + state.round * 3);
  const finalEnergy = Math.max(0, state.playerEnergy - energyCost);
  const newHp = result === 'derrota' ? Math.floor(stats.maxHp * 0.1) : state.playerHp;

  if (xpGained > 0) {
    await addRpgXp(char, xpGained, { currentHp: Math.max(1, newHp), currentEnergy: finalEnergy });
  }
  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: {
      ...(xpGained > 0 ? {} : { currentHp: Math.max(1, newHp), currentEnergy: finalEnergy }),
      gold: { increment: goldGained },
      totalKills: result === 'vitoria' ? { increment: 1 } : undefined,
      totalDeaths: result === 'derrota' ? { increment: 1 } : undefined,
      totalWins: result === 'vitoria' ? { increment: 1 } : undefined,
      bossKills: result === 'vitoria' && enemy.type === 'boss' ? { increment: 1 } : undefined,
      karma: enemy.karmaEffect ? { increment: enemy.karmaEffect } : undefined,
      ...(mode === 'dungeon' ? { lastDungeon: session.startedAt } : {}),
    },
  });

  if (xpGained > 0 && char.divineSkillId) {
    const skill = DIVINE_SKILLS[char.divineSkillId];
    if (skill) {
      const ranks = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
      const rankIndex = ranks.indexOf(char.divineSkillRank as typeof ranks[number]);
      const rankMultiplier = [1, 2, 4, 8, 16, 32, 64, 128] as const;
      const skillXp = session.skillUsedInCombat
        ? Math.max(25, Math.floor(xpGained * 0.4))
        : Math.max(5, Math.floor(xpGained * 0.1));
      const nextExp = char.divineSkillExp + skillXp;
      const required = skill.rankUpExpRequired * (rankMultiplier[rankIndex] ?? 1);
      const canRankUp = rankIndex >= 0 && rankIndex < ranks.length - 1 && nextExp >= required;
      const nextRank = canRankUp ? ranks[rankIndex + 1] : char.divineSkillRank;

      await prisma.rpgCharacter.update({
        where: { discordId: char.discordId },
        data: { divineSkillExp: canRankUp ? 0 : nextExp, divineSkillRank: nextRank },
      });
      state.log.push(`✨ **${skill.name}** +**${skillXp} XP** de habilidade${session.skillUsedInCombat ? ' ✨' : ''}`);
      if (canRankUp) state.log.push(`🌟 **RANK UP!** ${skill.emoji} **${skill.name}** → Rank **${nextRank}**!`);
    }
  }

  // Otimização: Gravar drops no inventário 
  for (const [itemId, qty] of itemsGainedMap.entries()) {
    await giveItem(char.discordId, itemId, qty);
  }

  await prisma.rpgCombatLog.create({
    data: {
      characterId: char.discordId,
      type: mode === 'hunt' ? 'hunt' : enemy.type === 'boss' ? 'boss' : 'dungeon',
      result,
      enemyName: enemy.name,
      xpGained,
      goldGained,
      itemsGained: itemsDropped,
      rounds: state.round,
      summary: state.log.slice(-3).join(' '),
    },
  });

  if (result === 'vitoria' && guildId) {
    try {
      const { trackRpgMission } = await import('../../commands/utility/missoes');
      await trackRpgMission(char.discordId, guildId, 'matar_inimigos', 1);
      if (mode === 'dungeon') await trackRpgMission(char.discordId, guildId, 'vencer_dungeon', 1);
      if (enemy.type === 'boss') await trackRpgMission(char.discordId, guildId, 'matar_boss_rpg', 1);
      await trackRpgMission(char.discordId, guildId, 'ganhar_ouro_rpg', goldGained);
    } catch { /* ignorar erro */ }
  }

  return {
    result, rounds: state.round, log: state.log,
    xpGained, goldGained, itemsDropped,
    playerHpLeft: Math.max(1, newHp),
    playerEnergyLeft: finalEnergy,
    bossKill: enemy.type === 'boss' && result === 'vitoria',
  };
}

// ─── PvP ──────────────────────────────────────────────────────────────────

export async function runPvp(attacker: FullCharacter, defender: FullCharacter): Promise<{
  winner: string; loser: string; log: string[]; xpGained: number; goldStolen: number;
}> {
  const atkStats = computeStats(attacker);
  const defStats = computeStats(defender);
  const log: string[] = [];

  log.push(`⚔️ **PvP:** ${attacker.username} (Lv.${attacker.level}) vs ${defender.username} (Lv.${defender.level})`);

  let atkHp = attacker.currentHp;
  let defHp = defender.currentHp;
  let round = 0;

  while (round < 15 && atkHp > 0 && defHp > 0) {
    round++;
    const rawDmg = Math.max(1, atkStats.attack - defStats.defense * 0.5);
    const crit = Math.random() * 100 < atkStats.critChance;
    const dmg = Math.floor(crit ? rawDmg * 2 : rawDmg);
    defHp -= dmg;
    log.push(`Rd ${round}: ${attacker.username} causa **${dmg}**${crit ? ' 💥 CRÍTICO' : ''} | HP ${defender.username}: **${Math.max(0, defHp)}**`);
    if (defHp <= 0) break;

    const rawDmg2 = Math.max(1, defStats.attack - atkStats.defense * 0.5);
    const crit2 = Math.random() * 100 < defStats.critChance;
    const dmg2 = Math.floor(crit2 ? rawDmg2 * 2 : rawDmg2);
    atkHp -= dmg2;
    log.push(`Rd ${round}: ${defender.username} causa **${dmg2}**${crit2 ? ' 💥 CRÍTICO' : ''} | HP ${attacker.username}: **${Math.max(0, atkHp)}**`);
  }

  const attackerWon = defHp <= 0 || (atkHp > 0 && defHp > 0 && atkStats.combatPower > defStats.combatPower);
  const winner = attackerWon ? attacker : defender;
  const loser  = attackerWon ? defender : attacker;

  const xpGained   = Math.floor(loser.level * 15);
  const goldStolen = Math.floor(loser.gold * 0.05);

  log.push(`\n🏆 **${winner.username} venceu o PvP!** +${xpGained} XP | 💰 +${goldStolen} ouro`);

  await Promise.all([
    prisma.rpgCharacter.update({ where: { discordId: winner.discordId }, data: { pvpWins: { increment: 1 }, gold: { increment: goldStolen }, lastPvp: new Date() } }),
    prisma.rpgCharacter.update({ where: { discordId: loser.discordId },  data: { pvpLosses: { increment: 1 }, gold: { decrement: Math.min(goldStolen, loser.gold) }, lastPvp: new Date() } }),
    addRpgXp(winner, xpGained),
    prisma.rpgCombatLog.create({ data: { characterId: winner.discordId, type: 'pvp', result: 'vitoria', opponentId: loser.discordId, xpGained, goldGained: goldStolen, rounds: round } }),
    prisma.rpgCombatLog.create({ data: { characterId: loser.discordId,  type: 'pvp', result: 'derrota', opponentId: winner.discordId, xpGained: 0, goldGained: 0, rounds: round } }),
  ]);

  return { winner: winner.discordId, loser: loser.discordId, log, xpGained, goldStolen };
}

// ─── Helpers internos ─────────────────────────────────────────────────────

function calcPlayerDamage(
  char: FullCharacter, stats: ComputedStats, state: CombatState,
  enemy: Enemy, useSkill: boolean,
): { damage: number; msg: string } {
  let dmg = Math.max(1, stats.attack - Math.floor(enemy.baseDefense * state.enemyDefenseMultiplier * 0.4));
  let msg = '';

  if (useSkill && char.divineSkillId && state.playerEnergy >= (DIVINE_SKILLS[char.divineSkillId]?.energyCost ?? 999)) {
    const skill = DIVINE_SKILLS[char.divineSkillId];
    if (skill && skill.type === 'ataque') {
      const eff = skillEffectValue(skill, char.divineSkillRank as SkillRank);
      dmg = Math.floor(dmg * eff);
      state.playerEnergy -= skill.energyCost;
      state.usedSkillThisRound = true;
      msg = `✨ **${skill.name}** ${skill.emoji} — `;
    }
  }

  if (state.berserkActive > 0) { dmg = Math.floor(dmg * 1.8); state.berserkActive--; }

  const isCrit = Math.random() * 100 < stats.critChance;
  if (isCrit) { dmg = Math.floor(dmg * 2.0); }

  if (state.doubleDmgNextHit) { dmg *= 2; state.doubleDmgNextHit = false; }

  msg += `⚔️ Você causa **${dmg}** de dano${isCrit ? ' 💥 CRÍTICO!' : '.'}`;
  return { damage: dmg, msg };
}

function calcEnemyDamage(
  enemy: Enemy, stats: ComputedStats, state: CombatState,
): { damage: number; msg: string } {
  let dmg = Math.max(1, Math.floor(enemy.baseAttack * state.enemyAttackMultiplier) - Math.floor(stats.defense * 0.5));

  if (state.shieldActive > 0) { dmg = Math.floor(dmg * 0.5); state.shieldActive--; }

  if (Math.random() * 100 < stats.dodgeChance) {
    return { damage: 0, msg: `💨 Você esquivou do ataque de ${enemy.name}!` };
  }

  return { damage: dmg, msg: `💢 ${enemy.name} causa **${dmg}** de dano.` };
}

function applyEnemyTactics(enemy: Enemy, state: CombatState): void {
  if (!enemy.abilities?.length) return;
  const abilities = enemy.abilities.join(' ').toLowerCase();

  if (abilities.includes('veneno') && state.round === 1) {
    state.poisonRounds = Math.max(state.poisonRounds, 3);
    state.log.push(`☠️ **${enemy.name}** espalha veneno! Você sofrerá dano por 3 rodadas.`);
  }
  if ((abilities.includes('raízes') || abilities.includes('congela')) && state.round > 1 && Math.random() < 0.22) {
    state.frozenRounds = Math.max(state.frozenRounds, 1);
    state.log.push(`🌀 **${enemy.name}** usa controle de campo — seu próximo turno pode ser interrompido!`);
  }
  if ((abilities.includes('grito de guerra') || abilities.includes('forma final')) && state.round === 2) {
    state.enemyAttackMultiplier = 1.3;
    state.log.push(`🔥 **${enemy.name}** entra em fúria! Ataque inimigo aumentado em 30%.`);
  }
  if ((abilities.includes('pele de pedra') || abilities.includes('escamas de diamante')) && state.round % 2 === 1) {
    state.enemyDefenseMultiplier = 1.5;
    state.log.push(`🛡️ A defesa de **${enemy.name}** endurece nesta rodada.`);
  } else {
    state.enemyDefenseMultiplier = 1;
  }
  if (abilities.includes('regeneração') && state.round > 1) {
    const healed = Math.min(state.enemyMaxHp - state.enemyHp, Math.max(1, Math.floor(state.enemyMaxHp * 0.05)));
    if (healed > 0) {
      state.enemyHp += healed;
      state.log.push(`💚 **${enemy.name}** regenera **${healed} HP**.`);
    }
  }
}

// ─── Dar item ao personagem ────────────────────────────────────────────────

export async function giveItem(discordId: string, itemId: string, qty: number = 1) {
  if (!getItem(itemId)) throw new Error(`Item inválido: ${itemId}`);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('A quantidade do item deve ser positiva.');
  return prisma.rpgInventoryItem.upsert({
    where: { characterId_itemId: { characterId: discordId, itemId } },
    update: { quantity: { increment: qty } },
    create: { characterId: discordId, itemId, quantity: qty },
  });
}

export async function claimDungeonSlot(
  discordId: string,
  currentHp: number,
  currentEnergy: number,
): Promise<{ success: true; startedAt: Date } | { success: false; message: string }> {
  if (currentHp <= 0) return { success: false, message: 'Você está sem HP. Vá à cidade e se cure antes de batalhar.' };
  if (currentEnergy < 10) return { success: false, message: 'Você precisa de pelo menos **10⚡** para iniciar uma batalha.' };

  const startedAt = new Date();
  const cutoff = new Date(startedAt.getTime() - DUNGEON_COOLDOWN_MS);
  const claimed = await prisma.rpgCharacter.updateMany({
    where: {
      discordId,
      currentHp: { gt: 0 },
      currentEnergy: { gte: 10 },
      OR: [{ lastDungeon: null }, { lastDungeon: { lte: cutoff } }],
    },
    data: { lastDungeon: startedAt },
  });

  if (claimed.count === 0) {
    const fresh = await prisma.rpgCharacter.findUnique({ where: { discordId } });
    const remaining = fresh?.lastDungeon
      ? Math.max(1, Math.ceil((DUNGEON_COOLDOWN_MS - (Date.now() - fresh.lastDungeon.getTime())) / 60000))
      : 5;
    return { success: false, message: `Sua próxima batalha estará disponível em **${remaining} minuto(s)**.` };
  }
  return { success: true, startedAt };
}

export function isDungeonOnCooldown(char: FullCharacter, cooldownMin: number): { onCooldown: boolean; remaining: string } {
  if (!char.lastDungeon) return { onCooldown: false, remaining: '' };
  const elapsed = Date.now() - char.lastDungeon.getTime();
  const cooldownMs = cooldownMin * 60 * 1000;
  if (elapsed >= cooldownMs) return { onCooldown: false, remaining: '' };
  const rem = cooldownMs - elapsed;
  const mins = Math.ceil(rem / 60000);
  return { onCooldown: true, remaining: `${mins} minuto(s)` };
}

export function isTravelOnCooldown(char: FullCharacter, cooldownMin: number): { onCooldown: boolean; remaining: string } {
  if (!char.lastTravel) return { onCooldown: false, remaining: '' };
  const elapsed = Date.now() - char.lastTravel.getTime();
  const cooldownMs = cooldownMin * 60 * 1000;
  if (elapsed >= cooldownMs) return { onCooldown: false, remaining: '' };
  const rem = cooldownMs - elapsed;
  const mins = Math.ceil(rem / 60000);
  return { onCooldown: true, remaining: `${mins} minuto(s)` };
}
