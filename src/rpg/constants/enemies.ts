export interface DropRule {
  itemId: string;
  chance: number; // 0.01 a 1.00 (ex: 0.5 = 50%)
  minQty: number;
  maxQty: number;
}

export interface Enemy {
  id: string;
  name: string;
  emoji: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  xpReward: number;
  goldReward: { min: number; max: number }; // Ouro variável
  drops: DropRule[]; // Itens que o monstro pode dropar
}

export const ENEMIES: Record<string, Enemy> = {
  // --- INIMIGOS NÍVEL BAIXO ---
  lobo_selvagem: {
    id: 'lobo_selvagem',
    name: 'Lobo Selvagem',
    emoji: '🐺',
    level: 2,
    hp: 80,
    attack: 12,
    defense: 3,
    xpReward: 25,
    goldReward: { min: 5, max: 15 },
    drops: [
      { itemId: 'couro_de_lobo', chance: 0.70, minQty: 1, maxQty: 2 }, // 70% de chance de 1 a 2 couros
    ],
  },
  goblin_ladrao: {
    id: 'goblin_ladrao',
    name: 'Goblin Ladrão',
    emoji: '👺',
    level: 4,
    hp: 120,
    attack: 22,
    defense: 8,
    xpReward: 45,
    goldReward: { min: 25, max: 50 }, // Goblins dropam mais ouro!
    drops: [
      { itemId: 'adaga_ferro', chance: 0.10, minQty: 1, maxQty: 1 }, // 10% de chance de dropar a arma dele
      { itemId: 'pocao_hp_pequena', chance: 0.30, minQty: 1, maxQty: 1 },
    ],
  },

  // --- INIMIGOS NÍVEL MÉDIO ---
  esqueleto_guerreiro: {
    id: 'esqueleto_guerreiro',
    name: 'Esqueleto Guerreiro',
    emoji: '💀',
    level: 8,
    hp: 250,
    attack: 45,
    defense: 25,
    xpReward: 90,
    goldReward: { min: 40, max: 80 },
    drops: [
      { itemId: 'osso_esqueleto', chance: 0.85, minQty: 1, maxQty: 3 },
      { itemId: 'espada_aco', chance: 0.05, minQty: 1, maxQty: 1 }, // Arma Incomum!
    ],
  },
  aranha_gigante: {
    id: 'aranha_gigante',
    name: 'Aranha Viúva Gigante',
    emoji: '🕷️',
    level: 10,
    hp: 340,
    attack: 55,
    defense: 18,
    xpReward: 120,
    goldReward: { min: 50, max: 100 },
    drops: [
      { itemId: 'presa_venenosa', chance: 0.40, minQty: 1, maxQty: 2 },
    ],
  },

  // --- BOSSES / INIMIGOS FORTES ---
  cavaleiro_sombrio: {
    id: 'cavaleiro_sombrio',
    name: 'Cavaleiro Sombrio',
    emoji: '🥷',
    level: 15,
    hp: 800,
    attack: 110,
    defense: 60,
    xpReward: 350,
    goldReward: { min: 150, max: 300 },
    drops: [
      { itemId: 'essencia_sombria', chance: 0.50, minQty: 1, maxQty: 2 }, // Epic Material
      { itemId: 'lamina_sombria', chance: 0.05, minQty: 1, maxQty: 1 },   // Rare Weapon Drop!
      { itemId: 'peitoral_ferro', chance: 0.15, minQty: 1, maxQty: 1 },
    ],
  },
};

export function getEnemy(id: string): Enemy | undefined {
  return ENEMIES[id];
}
