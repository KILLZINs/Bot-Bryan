// ═══════════════════════════════════════════════════════════════════════
// ITENS RPG
// ═══════════════════════════════════════════════════════════════════════

export type ItemSlot = 'weapon' | 'helmet' | 'pants' | 'boots' | 'gloves' | 'shield' | 'ring' | 'amulet' | 'backpack' | 'pet' | 'consumable' | 'material';
export type ItemRarity = 'Comum' | 'Incomum' | 'Raro' | 'Épico' | 'Lendário';

export interface ItemStats {
  str?: number; agi?: number; int?: number; vit?: number; lck?: number;
  hp?: number; energy?: number; defense?: number; attack?: number;
  critBonus?: number; dodgeBonus?: number; goldBonus?: number;
}

export interface RpgItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  minLevel: number;
  stats: ItemStats;
  price: number;           // preço na loja (0 = não vendável)
  sellPrice: number;       // preço de venda
  maxStack: number;        // 1 = não stackável (equipamento)
  classRestriction?: string[]; // IDs de classes que podem usar
  effect?: string;         // efeito especial em texto
  craftable?: boolean;
}

export const ITEMS: Record<string, RpgItem> = {

  // ═══════════════ ARMAS ═══════════════

  espada_enferrujada: {
    id: 'espada_enferrujada', name: 'Espada Enferrujada', emoji: '🗡️',
    description: 'Uma espada velha com ferrugem, mas ainda funcional para iniciantes.',
    slot: 'weapon', rarity: 'Comum', minLevel: 1,
    stats: { attack: 8, str: 1 }, price: 50, sellPrice: 10, maxStack: 1,
  },
  espada_de_ferro: {
    id: 'espada_de_ferro', name: 'Espada de Ferro', emoji: '⚔️',
    description: 'Uma espada sólida de ferro forjada nas forjas da aliança.',
    slot: 'weapon', rarity: 'Comum', minLevel: 5,
    stats: { attack: 18, str: 3 }, price: 300, sellPrice: 60, maxStack: 1,
  },
  espada_de_aco: {
    id: 'espada_de_aco', name: 'Espada de Aço', emoji: '⚔️',
    description: 'Forjada com o melhor aço da aliança. Balanceada e afiada.',
    slot: 'weapon', rarity: 'Incomum', minLevel: 10,
    stats: { attack: 32, str: 6, agi: 2 }, price: 1200, sellPrice: 250, maxStack: 1,
  },
  espada_das_ruinas: {
    id: 'espada_das_ruinas', name: 'Espada das Ruínas', emoji: '⚔️',
    description: 'Encontrada nas Ruínas Antigas, imbuída de energia arcana.',
    slot: 'weapon', rarity: 'Raro', minLevel: 18,
    stats: { attack: 55, str: 10, int: 5 }, price: 0, sellPrice: 800, maxStack: 1,
    effect: '+15% de dano contra mortos-vivos',
  },
  espada_lendaria: {
    id: 'espada_lendaria', name: 'Espada da Aliança', emoji: '🌟',
    description: 'A lendária espada forjada no coração da Aliança Skyline. Apenas os escolhidos a empunham.',
    slot: 'weapon', rarity: 'Lendário', minLevel: 40,
    stats: { attack: 180, str: 30, agi: 15, int: 15, vit: 10, lck: 20 },
    price: 0, sellPrice: 50000, maxStack: 1,
    effect: '+25% dano total. Aura de combate que amedronta inimigos.',
  },

  cajado_de_aprendiz: {
    id: 'cajado_de_aprendiz', name: 'Cajado de Aprendiz', emoji: '🪄',
    description: 'Um cajado mágico básico para magos iniciantes.',
    slot: 'weapon', rarity: 'Comum', minLevel: 1,
    stats: { attack: 6, int: 4, energy: 20 }, price: 60, sellPrice: 12, maxStack: 1,
  },
  cajado_arcano: {
    id: 'cajado_arcano', name: 'Cajado Arcano', emoji: '🔮',
    description: 'Canal poderoso para magias avançadas.',
    slot: 'weapon', rarity: 'Raro', minLevel: 15,
    stats: { attack: 20, int: 18, energy: 60, critBonus: 5 }, price: 2500, sellPrice: 500, maxStack: 1,
  },

  arco_longo: {
    id: 'arco_longo', name: 'Arco Longo', emoji: '🏹',
    description: 'Arco de alcance estendido. Favorito dos arqueiros da aliança.',
    slot: 'weapon', rarity: 'Comum', minLevel: 1,
    stats: { attack: 12, agi: 3 }, price: 80, sellPrice: 16, maxStack: 1,
  },
  arco_elfico: {
    id: 'arco_elfico', name: 'Arco Élfico', emoji: '🏹',
    description: 'Feito de madeira milenar. Preciso como a mente de um elfo.',
    slot: 'weapon', rarity: 'Épico', minLevel: 25,
    stats: { attack: 75, agi: 20, lck: 15, critBonus: 10 }, price: 0, sellPrice: 5000, maxStack: 1,
    effect: 'Chance de disparar flecha dupla (20%)',
  },

  adaga_sombria: {
    id: 'adaga_sombria', name: 'Adaga Sombria', emoji: '🗡️',
    description: 'Forjada com metal das sombras. Perfeita para assassinos.',
    slot: 'weapon', rarity: 'Incomum', minLevel: 8,
    stats: { attack: 25, agi: 8, lck: 5, critBonus: 8 }, price: 800, sellPrice: 160, maxStack: 1,
  },

  martelo_de_guerra: {
    id: 'martelo_de_guerra', name: 'Martelo de Guerra', emoji: '🔨',
    description: 'Pesado e devastador. Cada golpe pode atordoar o inimigo.',
    slot: 'weapon', rarity: 'Incomum', minLevel: 8,
    stats: { attack: 30, str: 8, vit: 3 }, price: 750, sellPrice: 150, maxStack: 1,
    effect: 'Chance de atordoar (10%)',
  },

  // ═══════════════ ELMOS ═══════════════

  elmo_de_couro: {
    id: 'elmo_de_couro', name: 'Elmo de Couro', emoji: '🪖',
    description: 'Proteção básica para a cabeça.',
    slot: 'helmet', rarity: 'Comum', minLevel: 1,
    stats: { defense: 5, vit: 1 }, price: 40, sellPrice: 8, maxStack: 1,
  },
  capacete_de_ferro: {
    id: 'capacete_de_ferro', name: 'Capacete de Ferro', emoji: '⛑️',
    description: 'Proteção sólida. Padrão dos guerreiros da aliança.',
    slot: 'helmet', rarity: 'Comum', minLevel: 5,
    stats: { defense: 12, vit: 3 }, price: 250, sellPrice: 50, maxStack: 1,
  },
  tiara_arcana: {
    id: 'tiara_arcana', name: 'Tiara Arcana', emoji: '💎',
    description: 'Amplifica o poder mágico do usuário.',
    slot: 'helmet', rarity: 'Incomum', minLevel: 8,
    stats: { int: 10, energy: 30, defense: 5 }, price: 600, sellPrice: 120, maxStack: 1,
  },
  coroa_das_sombras: {
    id: 'coroa_das_sombras', name: 'Coroa das Sombras', emoji: '👑',
    description: 'Coroa forjada nas trevas do abismo. Irradia poder sombrio.',
    slot: 'helmet', rarity: 'Épico', minLevel: 35,
    stats: { int: 25, str: 15, defense: 30, energy: 80 }, price: 0, sellPrice: 8000, maxStack: 1,
  },

  // ═══════════════ ARMADURAS (CALÇAS) ═══════════════

  calcas_de_couro: {
    id: 'calcas_de_couro', name: 'Calças de Couro', emoji: '👖',
    description: 'Calças leves que permitem boa mobilidade.',
    slot: 'pants', rarity: 'Comum', minLevel: 1,
    stats: { defense: 6, agi: 1 }, price: 45, sellPrice: 9, maxStack: 1,
  },
  calcas_de_ferro: {
    id: 'calcas_de_ferro', name: 'Calças de Ferro', emoji: '🦾',
    description: 'Proteção pesada para as pernas.',
    slot: 'pants', rarity: 'Comum', minLevel: 5,
    stats: { defense: 15, vit: 2 }, price: 280, sellPrice: 56, maxStack: 1,
  },
  calcas_de_mithril: {
    id: 'calcas_de_mithril', name: 'Calças de Mithril', emoji: '✨',
    description: 'Metal lendário que é leve como pena e duro como diamante.',
    slot: 'pants', rarity: 'Épico', minLevel: 30,
    stats: { defense: 55, agi: 12, vit: 10 }, price: 0, sellPrice: 6000, maxStack: 1,
  },

  // ═══════════════ BOTAS ═══════════════

  botas_de_couro: {
    id: 'botas_de_couro', name: 'Botas de Couro', emoji: '👟',
    description: 'Confortáveis e duráveis.',
    slot: 'boots', rarity: 'Comum', minLevel: 1,
    stats: { defense: 4, agi: 2 }, price: 35, sellPrice: 7, maxStack: 1,
  },
  botas_velozes: {
    id: 'botas_velozes', name: 'Botas Velozes', emoji: '⚡',
    description: 'Encantadas com magia de velocidade. Aumenta esquiva massivamente.',
    slot: 'boots', rarity: 'Raro', minLevel: 15,
    stats: { agi: 15, dodgeBonus: 8, defense: 10 }, price: 2000, sellPrice: 400, maxStack: 1,
  },

  // ═══════════════ LUVAS ═══════════════

  luvas_de_couro: {
    id: 'luvas_de_couro', name: 'Luvas de Couro', emoji: '🧤',
    description: 'Proteção simples para as mãos.',
    slot: 'gloves', rarity: 'Comum', minLevel: 1,
    stats: { defense: 3, str: 1 }, price: 30, sellPrice: 6, maxStack: 1,
  },
  luvas_do_assassino: {
    id: 'luvas_do_assassino', name: 'Luvas do Assassino', emoji: '🖤',
    description: 'Imbuídas com veneno sutil. Aumenta o crítico drasticamente.',
    slot: 'gloves', rarity: 'Raro', minLevel: 12,
    stats: { agi: 8, lck: 10, critBonus: 12, defense: 8 }, price: 0, sellPrice: 1500, maxStack: 1,
  },

  // ═══════════════ ESCUDOS ═══════════════

  escudo_de_madeira: {
    id: 'escudo_de_madeira', name: 'Escudo de Madeira', emoji: '🛡️',
    description: 'Proteção básica. Melhor que nada!',
    slot: 'shield', rarity: 'Comum', minLevel: 1,
    stats: { defense: 10 }, price: 60, sellPrice: 12, maxStack: 1,
  },
  escudo_de_ferro: {
    id: 'escudo_de_ferro', name: 'Escudo de Ferro', emoji: '🛡️',
    description: 'Robusto escudo de ferro. Protege contra ataques físicos.',
    slot: 'shield', rarity: 'Comum', minLevel: 5,
    stats: { defense: 22, vit: 4 }, price: 400, sellPrice: 80, maxStack: 1,
  },
  escudo_sagrado: {
    id: 'escudo_sagrado', name: 'Escudo Sagrado', emoji: '✨',
    description: 'Abençoado pelos deuses da aliança. Reflete parte do dano.',
    slot: 'shield', rarity: 'Épico', minLevel: 28,
    stats: { defense: 80, vit: 20, hp: 100 }, price: 0, sellPrice: 7000, maxStack: 1,
    effect: 'Reflete 10% do dano recebido',
  },

  // ═══════════════ ANÉIS ═══════════════

  anel_simples: {
    id: 'anel_simples', name: 'Anel Simples', emoji: '💍',
    description: 'Um anel sem magia. Mas todo herói começa com um.',
    slot: 'ring', rarity: 'Comum', minLevel: 1,
    stats: { lck: 2 }, price: 20, sellPrice: 4, maxStack: 1,
  },
  anel_magico: {
    id: 'anel_magico', name: 'Anel Mágico', emoji: '💎',
    description: 'Imbuído com magia arcana. Amplifica feitiços.',
    slot: 'ring', rarity: 'Incomum', minLevel: 8,
    stats: { int: 8, energy: 25 }, price: 500, sellPrice: 100, maxStack: 1,
  },
  anel_do_guerreiro: {
    id: 'anel_do_guerreiro', name: 'Anel do Guerreiro', emoji: '🔴',
    description: 'Símbolo dos guerreiros de elite da aliança.',
    slot: 'ring', rarity: 'Raro', minLevel: 15,
    stats: { str: 12, vit: 8, hp: 50 }, price: 0, sellPrice: 1200, maxStack: 1,
  },

  // ═══════════════ AMULETOS ═══════════════

  amuleto_de_protecao: {
    id: 'amuleto_de_protecao', name: 'Amuleto de Proteção', emoji: '🔮',
    description: 'Protege contra magias e ataques elementais.',
    slot: 'amulet', rarity: 'Incomum', minLevel: 5,
    stats: { vit: 5, defense: 8 }, price: 350, sellPrice: 70, maxStack: 1,
  },
  amuleto_da_sorte: {
    id: 'amuleto_da_sorte', name: 'Amuleto da Sorte', emoji: '🍀',
    description: 'Dizem que traz fortuna infinita ao portador.',
    slot: 'amulet', rarity: 'Raro', minLevel: 10,
    stats: { lck: 20, goldBonus: 10 }, price: 1500, sellPrice: 300, maxStack: 1,
  },

  // ═══════════════ MOCHILAS ═══════════════

  mochila_simples: {
    id: 'mochila_simples', name: 'Mochila Simples', emoji: '🎒',
    description: 'Aumenta capacidade do inventário em 10 slots.',
    slot: 'backpack', rarity: 'Comum', minLevel: 1,
    stats: {}, price: 100, sellPrice: 20, maxStack: 1,
    effect: 'Inventário +10 slots',
  },
  mochila_de_aventureiro: {
    id: 'mochila_de_aventureiro', name: 'Mochila de Aventureiro', emoji: '🎒',
    description: 'Reforçada para grandes aventuras.',
    slot: 'backpack', rarity: 'Incomum', minLevel: 10,
    stats: { lck: 3 }, price: 800, sellPrice: 160, maxStack: 1,
    effect: 'Inventário +25 slots. +5% drop de itens',
  },

  // ═══════════════ PETS ═══════════════

  lobo_filhote: {
    id: 'lobo_filhote', name: 'Lobo Filhote', emoji: '🐺',
    description: 'Um lobo filhote leal. Acompanha você em batalha.',
    slot: 'pet', rarity: 'Incomum', minLevel: 1,
    stats: { str: 5, agi: 5 }, price: 500, sellPrice: 100, maxStack: 1,
    effect: 'Ataca 1x por combate causando 20% do seu ataque',
  },
  slime_azul: {
    id: 'slime_azul', name: 'Slime Azul', emoji: '🫧',
    description: 'Um slime dócil que absorve dano no lugar do dono.',
    slot: 'pet', rarity: 'Incomum', minLevel: 1,
    stats: { vit: 8, hp: 30 }, price: 450, sellPrice: 90, maxStack: 1,
    effect: 'Absorve 5% do dano recebido',
  },
  corvo_das_trevas: {
    id: 'corvo_das_trevas', name: 'Corvo das Trevas', emoji: '🐦‍⬛',
    description: 'Um corvo misterioso que traz informações sobre inimigos.',
    slot: 'pet', rarity: 'Raro', minLevel: 15,
    stats: { int: 10, lck: 8 }, price: 0, sellPrice: 2000, maxStack: 1,
    effect: 'Revela os stats do inimigo antes do combate',
  },
  dragao_miniatura: {
    id: 'dragao_miniatura', name: 'Dragão Miniatura', emoji: '🐉',
    description: 'Um dragão que cabe na palma da mão. Não menos letal.',
    slot: 'pet', rarity: 'Épico', minLevel: 35,
    stats: { str: 20, int: 20, vit: 15 }, price: 0, sellPrice: 15000, maxStack: 1,
    effect: 'Dispara bola de fogo 1x por combate: 40% do seu ataque em dano mágico',
  },
  fenix_sagrada: {
    id: 'fenix_sagrada', name: 'Fênix Sagrada', emoji: '🦅',
    description: 'Ave lendária da aliança. Revive o portador uma vez por dungeon.',
    slot: 'pet', rarity: 'Lendário', minLevel: 50,
    stats: { str: 30, int: 30, vit: 25, lck: 20 }, price: 0, sellPrice: 50000, maxStack: 1,
    effect: 'Revive com 30% do HP ao morrer (1x por dungeon). +10% XP ganho.',
  },

  // ═══════════════ CONSUMÍVEIS ═══════════════

  pocao_de_vida_p: {
    id: 'pocao_de_vida_p', name: 'Poção de Vida (P)', emoji: '🧪',
    description: 'Restaura 100 HP.',
    slot: 'consumable', rarity: 'Comum', minLevel: 1,
    stats: { hp: 100 }, price: 50, sellPrice: 10, maxStack: 99,
    effect: 'Restaura 100 HP',
  },
  pocao_de_vida_m: {
    id: 'pocao_de_vida_m', name: 'Poção de Vida (M)', emoji: '🍶',
    description: 'Restaura 300 HP.',
    slot: 'consumable', rarity: 'Incomum', minLevel: 1,
    stats: { hp: 300 }, price: 150, sellPrice: 30, maxStack: 99,
    effect: 'Restaura 300 HP',
  },
  pocao_de_vida_g: {
    id: 'pocao_de_vida_g', name: 'Poção de Vida (G)', emoji: '🏺',
    description: 'Restaura HP completo.',
    slot: 'consumable', rarity: 'Raro', minLevel: 1,
    stats: {}, price: 500, sellPrice: 100, maxStack: 30,
    effect: 'Restaura HP completo',
  },
  pocao_de_energia: {
    id: 'pocao_de_energia', name: 'Poção de Energia', emoji: '⚡',
    description: 'Restaura 100 de Energia.',
    slot: 'consumable', rarity: 'Comum', minLevel: 1,
    stats: { energy: 100 }, price: 60, sellPrice: 12, maxStack: 99,
    effect: 'Restaura 100 Energia',
  },
  elixir_de_xp: {
    id: 'elixir_de_xp', name: 'Elixir de XP', emoji: '💜',
    description: 'Duplica o XP ganho nas próximas 5 batalhas.',
    slot: 'consumable', rarity: 'Raro', minLevel: 1,
    stats: {}, price: 1000, sellPrice: 200, maxStack: 10,
    effect: '2x XP nas próximas 5 batalhas',
  },
  pergaminho_de_tele: {
    id: 'pergaminho_de_tele', name: 'Pergaminho de Teletransporte', emoji: '📜',
    description: 'Teletransporta para a Cidade da Aliança instantaneamente.',
    slot: 'consumable', rarity: 'Incomum', minLevel: 1,
    stats: {}, price: 200, sellPrice: 40, maxStack: 20,
    effect: 'Teletransporte imediato para a cidade (ignora cooldown)',
  },

  // ═══════════════ MATERIAIS ═══════════════

  minerio_de_ferro: {
    id: 'minerio_de_ferro', name: 'Minério de Ferro', emoji: '🪨',
    description: 'Material básico para forja.',
    slot: 'material', rarity: 'Comum', minLevel: 1,
    stats: {}, price: 10, sellPrice: 5, maxStack: 999,
  },
  minerio_de_aco: {
    id: 'minerio_de_aco', name: 'Minério de Aço', emoji: '🔩',
    description: 'Material de forja de qualidade superior.',
    slot: 'material', rarity: 'Incomum', minLevel: 1,
    stats: {}, price: 50, sellPrice: 25, maxStack: 999,
  },
  couro_bruto: {
    id: 'couro_bruto', name: 'Couro Bruto', emoji: '🟫',
    description: 'Couro de monstros. Usado para criar armaduras.',
    slot: 'material', rarity: 'Comum', minLevel: 1,
    stats: {}, price: 8, sellPrice: 4, maxStack: 999,
  },
  erva_medicinal: {
    id: 'erva_medicinal', name: 'Erva Medicinal', emoji: '🌿',
    description: 'Ingrediente para poções de cura.',
    slot: 'material', rarity: 'Comum', minLevel: 1,
    stats: {}, price: 12, sellPrice: 6, maxStack: 999,
  },
  cristal_arcano: {
    id: 'cristal_arcano', name: 'Cristal Arcano', emoji: '💎',
    description: 'Concentra energia mágica. Essencial para encantamentos.',
    slot: 'material', rarity: 'Raro', minLevel: 1,
    stats: {}, price: 200, sellPrice: 80, maxStack: 999,
  },
  fragmento_de_boss: {
    id: 'fragmento_de_boss', name: 'Fragmento de Boss', emoji: '💠',
    description: 'Fragmento de poder deixado por um boss derrotado.',
    slot: 'material', rarity: 'Épico', minLevel: 1,
    stats: {}, price: 0, sellPrice: 1000, maxStack: 99,
  },
};

export const ITEM_LIST = Object.values(ITEMS);

export function getItem(id: string): RpgItem | undefined {
  return ITEMS[id];
}

export function itemsBySlot(slot: ItemSlot): RpgItem[] {
  return ITEM_LIST.filter(i => i.slot === slot);
}

export const RARITY_COLOR: Record<ItemRarity, number> = {
  Comum:    0x95A5A6,
  Incomum:  0x27AE60,
  Raro:     0x3498DB,
  Épico:    0x9B59B6,
  Lendário: 0xF1C40F,
};

export const RARITY_EMOJI: Record<ItemRarity, string> = {
  Comum:    '⬜',
  Incomum:  '🟩',
  Raro:     '🟦',
  Épico:    '🟪',
  Lendário: '🟨',
};

export const SLOT_EMOJI: Record<string, string> = {
  weapon:    '⚔️',
  helmet:    '⛑️',
  pants:     '👖',
  boots:     '👟',
  gloves:    '🧤',
  shield:    '🛡️',
  ring:      '💍',
  amulet:    '🔮',
  backpack:  '🎒',
  pet:       '🐾',
  consumable:'🧪',
  material:  '🪨',
};

export const SLOT_NAME: Record<string, string> = {
  weapon:    'Arma',
  helmet:    'Elmo',
  pants:     'Calças',
  boots:     'Botas',
  gloves:    'Luvas',
  shield:    'Escudo',
  ring:      'Anel',
  amulet:    'Amuleto',
  backpack:  'Mochila',
  pet:       'Pet',
  consumable:'Consumível',
  material:  'Material',
};

// ─── Receitas de Crafting ──────────────────────────────────────────────────────

export interface CraftRecipe {
  id: string;
  outputItem: string;
  outputQty: number;
  ingredients: { itemId: string; qty: number }[];
  craftTimeMin: number;  // tempo em minutos
  minLevel: number;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: 'craft_espada_ferro',
    outputItem: 'espada_de_ferro', outputQty: 1,
    ingredients: [{ itemId: 'minerio_de_ferro', qty: 5 }, { itemId: 'couro_bruto', qty: 2 }],
    craftTimeMin: 10, minLevel: 3,
  },
  {
    id: 'craft_espada_aco',
    outputItem: 'espada_de_aco', outputQty: 1,
    ingredients: [{ itemId: 'minerio_de_aco', qty: 8 }, { itemId: 'cristal_arcano', qty: 1 }],
    craftTimeMin: 30, minLevel: 8,
  },
  {
    id: 'craft_pocao_vida_m',
    outputItem: 'pocao_de_vida_m', outputQty: 3,
    ingredients: [{ itemId: 'erva_medicinal', qty: 3 }],
    craftTimeMin: 5, minLevel: 1,
  },
  {
    id: 'craft_pocao_vida_g',
    outputItem: 'pocao_de_vida_g', outputQty: 1,
    ingredients: [{ itemId: 'erva_medicinal', qty: 5 }, { itemId: 'cristal_arcano', qty: 1 }],
    craftTimeMin: 15, minLevel: 5,
  },
  {
    id: 'craft_capacete_ferro',
    outputItem: 'capacete_de_ferro', outputQty: 1,
    ingredients: [{ itemId: 'minerio_de_ferro', qty: 4 }],
    craftTimeMin: 8, minLevel: 3,
  },
  {
    id: 'craft_escudo_ferro',
    outputItem: 'escudo_de_ferro', outputQty: 1,
    ingredients: [{ itemId: 'minerio_de_ferro', qty: 6 }, { itemId: 'couro_bruto', qty: 3 }],
    craftTimeMin: 12, minLevel: 3,
  },
];
