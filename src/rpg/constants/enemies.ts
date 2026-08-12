export interface DropRule {
  itemId: string;
  chance: number;
  minQty: number;
  maxQty: number;
}

export interface Enemy {
  id: string;
  name: string;
  emoji: string;
  level: number;
  minLevel: number;        // Apelido para a dungeon não quebrar
  location: string;
  type: 'normal' | 'elite' | 'boss'; // Adicionado "elite" para compatibilidade
  hp: number;
  baseHp: number;          // Apelido pro combate
  attack: number;
  baseAttack: number;      // Apelido pro combate
  defense: number;
  baseDefense: number;     // Apelido pro combate
  xpReward: number;
  goldMin: number;         // Apelido antigo
  goldMax: number;         // Apelido antigo
  goldReward: { min: number; max: number }; 
  drops: DropRule[];       // Novo sistema de Loot
  dropTable: { itemId: string; chance: number }[]; // Sistema Antigo
  abilities?: string[];    // Táticas do Inimigo
  karmaEffect?: number;    // Efeito de moralidade
}

export const ENEMIES: Enemy[] = [
  {
    id: 'lobo_selvagem', name: 'Lobo Selvagem', emoji: '🐺', level: 2, minLevel: 1,
    location: 'floresta_inicial', type: 'normal',
    hp: 80, baseHp: 80, attack: 12, baseAttack: 12, defense: 3, baseDefense: 3,
    xpReward: 25, goldMin: 5, goldMax: 15, goldReward: { min: 5, max: 15 },
    drops: [{ itemId: 'couro_de_lobo', chance: 0.70, minQty: 1, maxQty: 2 }],
    dropTable: [{ itemId: 'couro_de_lobo', chance: 70 }],
  },
  {
    id: 'goblin_ladrao', name: 'Goblin Ladrão', emoji: '👺', level: 4, minLevel: 3,
    location: 'floresta_inicial', type: 'normal',
    hp: 120, baseHp: 120, attack: 22, baseAttack: 22, defense: 8, baseDefense: 8,
    xpReward: 45, goldMin: 25, goldMax: 50, goldReward: { min: 25, max: 50 },
    drops: [
      { itemId: 'adaga_ferro', chance: 0.10, minQty: 1, maxQty: 1 }, 
      { itemId: 'pocao_hp_pequena', chance: 0.30, minQty: 1, maxQty: 1 }
    ],
    dropTable: [{ itemId: 'pocao_hp_pequena', chance: 30 }],
  },
  {
    id: 'cavaleiro_sombrio', name: 'Cavaleiro Sombrio', emoji: '🥷', level: 15, minLevel: 10,
    location: 'cavernas_sombrias', type: 'boss',
    hp: 800, baseHp: 800, attack: 110, baseAttack: 110, defense: 60, baseDefense: 60,
    xpReward: 350, goldMin: 150, goldMax: 300, goldReward: { min: 150, max: 300 },
    drops: [{ itemId: 'essencia_sombria', chance: 0.50, minQty: 1, maxQty: 2 }],
    dropTable: [{ itemId: 'essencia_sombria', chance: 50 }],
    abilities: ['forma final'], karmaEffect: -5
  },
];

export function getEnemy(id: string): Enemy | undefined {
  return ENEMIES.find(e => e.id === id);
}

// ─── FUNÇÕES DE AMBIENTE ───

export function scaleEnemy(enemy: Enemy, playerLevel?: number): Enemy {
  if (!playerLevel) return enemy;
  const levelDiff = Math.max(0, playerLevel - enemy.level);
  const scale = 1 + (levelDiff * 0.1);
  return {
    ...enemy,
    baseHp: Math.floor(enemy.hp * scale),
    baseAttack: Math.floor(enemy.attack * scale),
    baseDefense: Math.floor(enemy.defense * scale),
    xpReward: Math.floor(enemy.xpReward * scale),
  };
}

export function getEnemiesForLocation(locationId: string, playerLevel?: number): Enemy[] {
  let list = ENEMIES.filter(e => e.location === locationId && e.type !== 'boss');
  
  // Se o arquivo da dungeon enviar o level, a gente filtra pela propriedade minLevel
  if (playerLevel !== undefined) {
    list = list.filter(e => playerLevel >= e.minLevel);
  }
  
  return list;
}

export function getBossesForLocation(locationId: string, playerLevel?: number): Enemy[] {
  let list = ENEMIES.filter(e => e.location === locationId && e.type === 'boss');
  
  // Mesma coisa para os chefões
  if (playerLevel !== undefined) {
    list = list.filter(e => playerLevel >= e.minLevel);
  }
  
  return list;
}
