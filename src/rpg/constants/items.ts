export type ItemType = 'weapon' | 'helmet' | 'chest' | 'pants' | 'boots' | 'gloves' | 'shield' | 'ring' | 'backpack' | 'pet' | 'consumable' | 'material';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

// ─── CONSTANTES RETROCOMPATÍVEIS (Para o Inventário antigo) ───
export const RARITY_EMOJI: Record<string, string> = {
  common: '⬜', uncommon: '🟩', rare: '🟦', epic: '🟪', legendary: '🟧', mythic: '🟥'
};

export const SLOT_NAME: Record<string, string> = {
  weapon: 'Arma', helmet: 'Elmo', chest: 'Peitoral', pants: 'Calça', boots: 'Bota',
  gloves: 'Luvas', shield: 'Escudo', ring: 'Anel', backpack: 'Mochila', pet: 'Pet',
  consumable: 'Consumível', material: 'Material'
};

export const SLOT_EMOJI: Record<string, string> = {
  weapon: '⚔️', helmet: '⛑️', chest: '👕', pants: '👖', boots: '👟',
  gloves: '🧤', shield: '🛡️', ring: '💍', backpack: '🎒', pet: '🐾',
  consumable: '🧪', material: '📦'
};

// ─── INTERFACE HÍBRIDA ───
export interface Item {
  id: string;
  name: string;
  emoji: string;
  type: ItemType;
  slot: ItemType;         // Apelido para o inventario.ts
  rarity: ItemRarity;
  description: string;
  buyPrice?: number;
  sellPrice: number;
  price: number;          // Apelido para a loja antiga
  minLevel: number;       // Apelido para checagem antiga
  maxStack: number;       // Apelido para o inventario
  classRestriction?: string[]; // Apelido
  effect?: string;        // Apelido
  stats?: {
    str?: number; agi?: number; int?: number; vit?: number; lck?: number;
    attack?: number; defense?: number; maxHp?: number;
    hp?: number;          // Apelido
    energy?: number;      // Apelido
    critBonus?: number;   // Apelido
    dodgeBonus?: number;  // Apelido
    goldBonus?: number;   // Apelido
    xpBonus?: number;     // Apelido
    dropBonus?: number;   // Apelido
  };
  healHp?: number;
  healEnergy?: number;
}

export type RpgItem = Item;

// ─── RECEITAS DA FORJA (Para consertar a forja.ts) ───
export interface CraftRecipe {
  resultItemId: string;
  resultQty: number;
  costGold: number;
  ingredients: { itemId: string; qty: number }[];
}
export const CRAFT_RECIPES: CraftRecipe[] = []; 

// ─── CATÁLOGO DE ITENS ───
export const ITEMS: Record<string, Item> = {
  espada_madeira: {
    id: 'espada_madeira', name: 'Espada de Madeira', emoji: '🪵',
    type: 'weapon', slot: 'weapon', rarity: 'common', description: 'Uma espada leve.',
    buyPrice: 50, price: 50, sellPrice: 10, minLevel: 1, maxStack: 1,
    stats: { attack: 5, str: 1 },
  },
  adaga_ferro: {
    id: 'adaga_ferro', name: 'Adaga de Ferro', emoji: '🗡️',
    type: 'weapon', slot: 'weapon', rarity: 'common', description: 'Rápida e letal.',
    buyPrice: 120, price: 120, sellPrice: 35, minLevel: 3, maxStack: 1,
    stats: { attack: 12, agi: 3 },
  },
  peitoral_ferro: {
    id: 'peitoral_ferro', name: 'Peitoral de Ferro', emoji: '🛡️',
    type: 'chest', slot: 'chest', rarity: 'uncommon', description: 'Armadura pesada.',
    buyPrice: 600, price: 600, sellPrice: 200, minLevel: 5, maxStack: 1,
    stats: { defense: 25, vit: 8 },
  },
  pocao_hp_pequena: {
    id: 'pocao_hp_pequena', name: 'Poção de Vida Menor', emoji: '🧪',
    type: 'consumable', slot: 'consumable', rarity: 'common', description: 'Recupera 50 HP.',
    buyPrice: 25, price: 25, sellPrice: 5, minLevel: 1, maxStack: 99,
    healHp: 50, stats: { hp: 50 }
  },
  couro_de_lobo: {
    id: 'couro_de_lobo', name: 'Couro de Lobo Selvagem', emoji: '🐺',
    type: 'material', slot: 'material', rarity: 'common', description: 'Couro rústico.',
    price: 0, sellPrice: 12, minLevel: 1, maxStack: 999,
  },
  essencia_sombria: {
    id: 'essencia_sombria', name: 'Essência Sombria', emoji: '🔮',
    type: 'material', slot: 'material', rarity: 'epic', description: 'Pura escuridão.',
    price: 0, sellPrice: 250, minLevel: 1, maxStack: 999,
  },
};

export const ITEM_LIST = Object.values(ITEMS);

export function getItem(id: string): Item | undefined {
  return ITEMS[id];
}
