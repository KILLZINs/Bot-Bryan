// ═══════════════════════════════════════════════════════════════════════
// TIPOS DE DUNGEON
// ═══════════════════════════════════════════════════════════════════════

export interface DungeonType {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: number;
  enemyHpMult: number;
  enemyAtkMult: number;
  xpMult: number;
  goldMult: number;
  dotDamage: number;       // dano por turno (flat, 0 = sem DoT)
  dotEmoji: string;
  dotName: string;
  freezeChance: number;    // chance de congelar o jogador (0–1)
  critBonus: number;       // bonus de crítico (0–1)
  dropRarityBonus: number; // chance adicional de item raro (0–1)
  specialEffect: string;
  minLevel: number;
}

export const DUNGEON_TYPES: Record<string, DungeonType> = {
  normal: {
    id: 'normal', name: 'Normal', emoji: '⚔️',
    description: 'A dungeon padrão, equilibrada e sem efeitos especiais.',
    color: 0xE74C3C,
    enemyHpMult: 1.0, enemyAtkMult: 1.0, xpMult: 1.0, goldMult: 1.0,
    dotDamage: 0, dotEmoji: '', dotName: '',
    freezeChance: 0, critBonus: 0, dropRarityBonus: 0,
    specialEffect: 'Sem efeitos especiais.',
    minLevel: 1,
  },
  fogo: {
    id: 'fogo', name: 'Fogo', emoji: '🔥',
    description: 'Inimigos flamejantes. Queimadura causa dano contínuo.',
    color: 0xFF4500,
    enemyHpMult: 1.1, enemyAtkMult: 1.2, xpMult: 1.3, goldMult: 1.2,
    dotDamage: 8, dotEmoji: '🔥', dotName: 'Queimadura',
    freezeChance: 0, critBonus: 0, dropRarityBonus: 0.05,
    specialEffect: '🔥 Queimadura: -8 HP por turno',
    minLevel: 5,
  },
  gelo: {
    id: 'gelo', name: 'Gelo', emoji: '❄️',
    description: 'O frio extremo pode congelar seus movimentos.',
    color: 0x00BFFF,
    enemyHpMult: 1.15, enemyAtkMult: 0.85, xpMult: 1.25, goldMult: 1.35,
    dotDamage: 0, dotEmoji: '', dotName: '',
    freezeChance: 0.25, critBonus: 0, dropRarityBonus: 0.1,
    specialEffect: '❄️ Congelamento: 25% de chance de perder um turno',
    minLevel: 8,
  },
  sombra: {
    id: 'sombra', name: 'Sombra', emoji: '🌑',
    description: 'Inimigos sombrios envenenam e furtam no escuro.',
    color: 0x4B0082,
    enemyHpMult: 1.2, enemyAtkMult: 1.1, xpMult: 1.4, goldMult: 1.5,
    dotDamage: 12, dotEmoji: '☠️', dotName: 'Veneno Sombrio',
    freezeChance: 0, critBonus: 0, dropRarityBonus: 0.2,
    specialEffect: '☠️ Veneno Sombrio: -12 HP por turno | Drops raros x2',
    minLevel: 12,
  },
  trovao: {
    id: 'trovao', name: 'Trovão', emoji: '⚡',
    description: 'Energia elétrica amplifica críticos de ambos os lados.',
    color: 0xFFD700,
    enemyHpMult: 0.9, enemyAtkMult: 1.3, xpMult: 1.5, goldMult: 1.1,
    dotDamage: 0, dotEmoji: '', dotName: '',
    freezeChance: 0, critBonus: 0.25, dropRarityBonus: 0,
    specialEffect: '⚡ Cadeia Elétrica: +25% chance de crítico para AMBOS',
    minLevel: 15,
  },
  abissal: {
    id: 'abissal', name: 'Abissal', emoji: '🕳️',
    description: 'O abismo mais profundo. Apenas os mais fortes sobrevivem.',
    color: 0x1A1A2E,
    enemyHpMult: 1.5, enemyAtkMult: 1.4, xpMult: 2.0, goldMult: 2.0,
    dotDamage: 15, dotEmoji: '🕳️', dotName: 'Maldição Abissal',
    freezeChance: 0, critBonus: 0, dropRarityBonus: 0.3,
    specialEffect: '🕳️ Maldição Abissal: -15 HP por turno | XP/Ouro dobrados',
    minLevel: 25,
  },
};

export const DUNGEON_TYPE_LIST = Object.values(DUNGEON_TYPES);

export function getDungeonType(id: string): DungeonType {
  return DUNGEON_TYPES[id] ?? DUNGEON_TYPES['normal'];
}
