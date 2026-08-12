export type ItemType = 'weapon' | 'helmet' | 'chest' | 'pants' | 'boots' | 'gloves' | 'shield' | 'ring' | 'backpack' | 'pet' | 'consumable' | 'material';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Item {
  id: string;
  name: string;
  emoji: string;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  buyPrice?: number; // Se não tiver buyPrice, não vende na loja (só drop ou quest)
  sellPrice: number;
  stats?: {
    str?: number;
    agi?: number;
    int?: number;
    vit?: number;
    lck?: number;
    attack?: number;
    defense?: number;
    maxHp?: number;
  };
  healHp?: number;
  healEnergy?: number;
}

export const ITEMS: Record<string, Item> = {
  // ==========================================
  // ⚔️ ARMAS
  // ==========================================
  espada_madeira: {
    id: 'espada_madeira',
    name: 'Espada de Madeira',
    emoji: '🪵',
    type: 'weapon',
    rarity: 'common',
    description: 'Uma espada de treinamento leve. Melhor que bater com as mãos.',
    buyPrice: 50,
    sellPrice: 10,
    stats: { attack: 5, str: 1 },
  },
  adaga_ferro: {
    id: 'adaga_ferro',
    name: 'Adaga de Ferro',
    emoji: '🗡️',
    type: 'weapon',
    rarity: 'common',
    description: 'Arma rápida e fácil de esconder.',
    buyPrice: 120,
    sellPrice: 35,
    stats: { attack: 12, agi: 3 },
  },
  espada_aco: {
    id: 'espada_aco',
    name: 'Espada de Aço Longa',
    emoji: '⚔️',
    type: 'weapon',
    rarity: 'uncommon',
    description: 'Uma lâmina afiada forjada pela guilda da cidade.',
    buyPrice: 450,
    sellPrice: 150,
    stats: { attack: 28, str: 5, agi: 2 },
  },
  cajado_arcano: {
    id: 'cajado_arcano',
    name: 'Cajado Arcano Aprendiz',
    emoji: '🪄',
    type: 'weapon',
    rarity: 'uncommon',
    description: 'Madeira imbuída com mana cristalizada.',
    buyPrice: 500,
    sellPrice: 160,
    stats: { attack: 15, int: 10 },
  },
  lamina_sombria: {
    id: 'lamina_sombria',
    name: 'Lâmina Sombria',
    emoji: '🌙',
    type: 'weapon',
    rarity: 'rare',
    description: 'Esculpidas no escuro das Cavernas Sombrias. (Apenas Drop)',
    sellPrice: 600, // Sem buyPrice = Só dropa de monstro!
    stats: { attack: 55, agi: 15, lck: 5 },
  },

  // ==========================================
  // 🛡️ ARMADURAS & EQUIPAMENTOS
  // ==========================================
  roupa_campones: {
    id: 'roupa_campones',
    name: 'Roupas de Camponês',
    emoji: '👕',
    type: 'chest',
    rarity: 'common',
    description: 'Roupas simples de tecido. Não protegem de nada.',
    buyPrice: 30,
    sellPrice: 5,
    stats: { defense: 2 },
  },
  armadura_couro: {
    id: 'armadura_couro',
    name: 'Armadura de Couro',
    emoji: '🧥',
    type: 'chest',
    rarity: 'common',
    description: 'Couro curtido que oferece uma leve proteção.',
    buyPrice: 150,
    sellPrice: 40,
    stats: { defense: 10, vit: 2 },
  },
  peitoral_ferro: {
    id: 'peitoral_ferro',
    name: 'Peitoral de Ferro',
    emoji: '🛡️',
    type: 'chest',
    rarity: 'uncommon',
    description: 'Armadura pesada que pode aguentar alguns cortes.',
    buyPrice: 600,
    sellPrice: 200,
    stats: { defense: 25, vit: 8, agi: -2 }, // Tira agilidade por ser pesada
  },
  anel_da_sorte: {
    id: 'anel_da_sorte',
    name: 'Anel do Leprechaun',
    emoji: '💍',
    type: 'ring',
    rarity: 'rare',
    description: 'Dizem que quem usa este anel encontra mais ouro.',
    buyPrice: 1200,
    sellPrice: 400,
    stats: { lck: 25, defense: 2 },
  },

  // ==========================================
  // 🧪 CONSUMÍVEIS (Poções da Loja)
  // ==========================================
  pocao_hp_pequena: {
    id: 'pocao_hp_pequena',
    name: 'Poção de Vida Menor',
    emoji: '🧪',
    type: 'consumable',
    rarity: 'common',
    description: 'Recupera 50 de HP instantaneamente.',
    buyPrice: 25,
    sellPrice: 5,
    healHp: 50,
  },
  pocao_hp_media: {
    id: 'pocao_hp_media',
    name: 'Poção de Vida Média',
    emoji: '🩸',
    type: 'consumable',
    rarity: 'uncommon',
    description: 'Recupera 150 de HP instantaneamente.',
    buyPrice: 70,
    sellPrice: 15,
    healHp: 150,
  },
  pocao_energia: {
    id: 'pocao_energia',
    name: 'Elixir de Energia',
    emoji: '⚡',
    type: 'consumable',
    rarity: 'rare',
    description: 'Recupera 40 de Energia para você caçar mais.',
    buyPrice: 150,
    sellPrice: 30,
    healEnergy: 40,
  },

  // ==========================================
  // 📦 MATERIAIS (Drops de Monstros)
  // ==========================================
  couro_de_lobo: {
    id: 'couro_de_lobo',
    name: 'Couro de Lobo Selvagem',
    emoji: '🐺',
    type: 'material',
    rarity: 'common',
    description: 'Um couro rústico vendido na cidade por algumas moedas.',
    sellPrice: 12,
  },
  osso_esqueleto: {
    id: 'osso_esqueleto',
    name: 'Osso Arcano',
    emoji: '🦴',
    type: 'material',
    rarity: 'common',
    description: 'Um osso antigo rangendo com magia negra fraca.',
    sellPrice: 18,
  },
  presa_venenosa: {
    id: 'presa_venenosa',
    name: 'Presa Venenosa',
    emoji: '🦷',
    type: 'material',
    rarity: 'uncommon',
    description: 'Pingando veneno letal. Alquimistas pagam bem por isso.',
    sellPrice: 45,
  },
  essencia_sombria: {
    id: 'essencia_sombria',
    name: 'Essência Sombria',
    emoji: '🔮',
    type: 'material',
    rarity: 'epic',
    description: 'Cristal puro de escuridão dropado por líderes das sombras.',
    sellPrice: 250,
  },
};

export function getItem(id: string): Item | undefined {
  return ITEMS[id];
}
