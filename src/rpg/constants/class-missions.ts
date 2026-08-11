// ═══════════════════════════════════════════════════════════════════════
// MISSÕES DIÁRIAS POR CLASSE
// ═══════════════════════════════════════════════════════════════════════

export type MissionTrigger =
  | 'battle_win'       // vitória em batalha normal
  | 'boss_kill'        // derrota boss
  | 'gold_earned'      // ouro ganho em batalha
  | 'xp_earned'        // XP ganho em batalha
  | 'explore'          // explorou uma vez
  | 'fish'             // pescou uma vez
  | 'meditate'         // meditou uma vez
  | 'train'            // treinou uma vez
  | 'tavern_visit'     // visitou a taverna
  | 'dungeon_type'     // entrou em dungeon especial
  | 'pvp_win'          // venceu PvP
  | 'craft';           // forjou item

export interface ClassMissionTemplate {
  key: string;
  classes: string[];   // classes que recebem essa missão ('*' = todas)
  title: string;
  description: string;
  emoji: string;
  trigger: MissionTrigger;
  target: number;
  xpReward: number;
  goldReward: number;
  energyReward: number;
}

export const CLASS_MISSIONS: ClassMissionTemplate[] = [
  // ── Todas as classes ─────────────────────────────────────────────
  { key: 'daily_explore',  classes: ['*'], emoji: '🌍', trigger: 'explore',    target: 2,  title: 'Explorador',     description: 'Explore o mapa 2 vezes',                   xpReward: 80,  goldReward: 30,  energyReward: 10 },
  { key: 'daily_fish',     classes: ['*'], emoji: '🎣', trigger: 'fish',       target: 3,  title: 'Pescador',       description: 'Pesque 3 vezes',                           xpReward: 60,  goldReward: 40,  energyReward: 10 },
  { key: 'daily_meditate', classes: ['*'], emoji: '🧘', trigger: 'meditate',   target: 1,  title: 'Meditação',      description: 'Medite pelo menos 1 vez',                  xpReward: 50,  goldReward: 20,  energyReward: 20 },

  // ── Guerreiro / Paladino / Cavaleiro ─────────────────────────────
  { key: 'warrior_kills',  classes: ['guerreiro','paladino','cavaleiro','barbaro','templario'], emoji: '⚔️', trigger: 'battle_win', target: 5,  title: 'Guerreiro Incansável', description: 'Vença 5 batalhas',              xpReward: 120, goldReward: 50,  energyReward: 15 },
  { key: 'warrior_boss',   classes: ['guerreiro','paladino','cavaleiro','barbaro','templario'], emoji: '💀', trigger: 'boss_kill',  target: 1,  title: 'Caçador de Bosses',    description: 'Derrote 1 boss',               xpReward: 200, goldReward: 100, energyReward: 20 },
  { key: 'warrior_gold',   classes: ['guerreiro','paladino','cavaleiro','barbaro','templario'], emoji: '💰', trigger: 'gold_earned',target: 150,'title': 'Saque do Guerreiro', description: 'Colete 150 de ouro em batalha', xpReward: 100, goldReward: 70,  energyReward: 10 },

  // ── Mago / Feiticeiro / Necromante ───────────────────────────────
  { key: 'mage_xp',        classes: ['mago','feiticeiro','necromante','invocador','xamã'], emoji: '✨', trigger: 'xp_earned',    target: 500, title: 'Sede de Conhecimento', description: 'Ganhe 500 XP de batalha',       xpReward: 150, goldReward: 40,  energyReward: 10 },
  { key: 'mage_dungeon',   classes: ['mago','feiticeiro','necromante','invocador','xamã'], emoji: '🔮', trigger: 'dungeon_type', target: 1,   title: 'Pesquisador de Dungeons', description: 'Entre em uma dungeon especial', xpReward: 130, goldReward: 60,  energyReward: 15 },
  { key: 'mage_train',     classes: ['mago','feiticeiro','necromante','invocador','xamã'], emoji: '📚', trigger: 'train',        target: 2,   title: 'Praticante',           description: 'Treine seus atributos 2 vezes', xpReward: 100, goldReward: 30,  energyReward: 20 },

  // ── Arqueiro / Caçador / Atirador ────────────────────────────────
  { key: 'archer_kills',   classes: ['arqueiro','cacador','atirador'], emoji: '🎯', trigger: 'battle_win', target: 4,   title: 'Olho de Águia',       description: 'Vença 4 batalhas',                  xpReward: 110, goldReward: 45,  energyReward: 15 },
  { key: 'archer_explore', classes: ['arqueiro','cacador','atirador'], emoji: '🗺️', trigger: 'explore',    target: 3,   title: 'Rastreador',          description: 'Explore 3 vezes',                   xpReward: 100, goldReward: 50,  energyReward: 10 },
  { key: 'archer_gold',    classes: ['arqueiro','cacador','atirador'], emoji: '🏹', trigger: 'gold_earned',target: 120, title: 'Caçador de Recompensas', description: 'Colete 120 de ouro em batalha',   xpReward: 90,  goldReward: 80,  energyReward: 10 },

  // ── Assassino / Ladrão / Ninja ───────────────────────────────────
  { key: 'rogue_kills',    classes: ['assassino','ladrao','ninja'], emoji: '🗡️', trigger: 'battle_win', target: 4,   title: 'Sombra Mortal',       description: 'Vença 4 batalhas',                  xpReward: 110, goldReward: 60,  energyReward: 15 },
  { key: 'rogue_pvp',      classes: ['assassino','ladrao','ninja'], emoji: '⚔️', trigger: 'pvp_win',    target: 1,   title: 'Duelo nas Sombras',   description: 'Vença 1 duelo PvP',                 xpReward: 180, goldReward: 90,  energyReward: 10 },
  { key: 'rogue_explore',  classes: ['assassino','ladrao','ninja'], emoji: '🌑', trigger: 'explore',    target: 2,   title: 'Infiltrador',         description: 'Explore 2 vezes',                   xpReward: 90,  goldReward: 55,  energyReward: 10 },
];

/** Retorna 3 missões para a classe do jogador */
export function getMissionsForClass(playerClass: string): ClassMissionTemplate[] {
  const applicable = CLASS_MISSIONS.filter(m =>
    m.classes.includes('*') || m.classes.includes(playerClass),
  );
  // Pegar 1 missão "geral" (trigger: explore/fish/meditate) e 2 da classe
  const general = applicable.filter(m => m.classes.includes('*'));
  const classSpecific = applicable.filter(m => !m.classes.includes('*'));

  // Embaralhar
  const shuffle = <T>(arr: T[]) => arr.sort(() => Math.random() - 0.5);
  const chosen = [
    ...shuffle(general).slice(0, 1),
    ...shuffle(classSpecific).slice(0, 2),
  ];
  return chosen.slice(0, 3);
}
