// ═══════════════════════════════════════════════════════════════════════
// MEGA BANCO DE DADOS DE ITENS RPG
// ═══════════════════════════════════════════════════════════════════════

export type ItemSlot = 'weapon' | 'helmet' | 'chest' | 'pants' | 'boots' | 'gloves' | 'shield' | 'ring' | 'amulet' | 'backpack' | 'pet' | 'consumable' | 'material';
export type ItemRarity = 'Comum' | 'Incomum' | 'Raro' | 'Épico' | 'Lendário';

export interface ItemStats {
  str?: number; agi?: number; int?: number; vit?: number; lck?: number;
  hp?: number; energy?: number; defense?: number; attack?: number;
  critBonus?: number; dodgeBonus?: number; goldBonus?: number; xpBonus?: number;
  maxHp?: number; // Alias para combate
}

export interface RpgItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  slot: ItemSlot;
  type?: ItemSlot;         // Alias
  rarity: ItemRarity;
  minLevel: number;
  stats: ItemStats;
  price: number;           // 0 = Não vende na loja (Drop de boss/Lendário)
  buyPrice?: number;       // Alias
  sellPrice: number;
  maxStack: number;
  classRestriction?: string[];
  effect?: string;
  craftable?: boolean;
}

export type Item = RpgItem;

export const ITEMS: Record<string, RpgItem> = {

  // ═══════════════ ARMAS (weapon) ═══════════════
  espada_enferrujada: { id: 'espada_enferrujada', name: 'Espada Enferrujada', emoji: '🗡️', description: 'Uma espada velha. Melhor que usar as mãos.', slot: 'weapon', rarity: 'Comum', minLevel: 1, stats: { attack: 8, str: 1 }, price: 50, sellPrice: 10, maxStack: 1 },
  espada_de_ferro: { id: 'espada_de_ferro', name: 'Espada de Ferro', emoji: '⚔️', description: 'Espada sólida forjada para recrutas.', slot: 'weapon', rarity: 'Comum', minLevel: 5, stats: { attack: 18, str: 3 }, price: 300, sellPrice: 60, maxStack: 1 },
  espada_de_aco: { id: 'espada_de_aco', name: 'Espada de Aço', emoji: '⚔️', description: 'Afiada e bem balanceada.', slot: 'weapon', rarity: 'Incomum', minLevel: 10, stats: { attack: 32, str: 6, agi: 2 }, price: 1200, sellPrice: 250, maxStack: 1 },
  machado_de_batalha: { id: 'machado_de_batalha', name: 'Machado de Batalha', emoji: '🪓', description: 'Lento, mas destrutivo.', slot: 'weapon', rarity: 'Incomum', minLevel: 12, stats: { attack: 40, str: 10, agi: -2 }, price: 1500, sellPrice: 300, maxStack: 1, effect: 'Chance de sangramento' },
  lanca_longa: { id: 'lanca_longa', name: 'Lança Longa', emoji: '🔱', description: 'Mantém os inimigos à distância.', slot: 'weapon', rarity: 'Incomum', minLevel: 15, stats: { attack: 35, str: 5, agi: 5 }, price: 1600, sellPrice: 320, maxStack: 1 },
  espada_das_ruinas: { id: 'espada_das_ruinas', name: 'Espada das Ruínas', emoji: '🗡️', description: 'Brilha com energia arcana.', slot: 'weapon', rarity: 'Raro', minLevel: 18, stats: { attack: 55, str: 10, int: 5 }, price: 0, sellPrice: 800, maxStack: 1, effect: '+15% contra mortos-vivos' },
  foice_ceifeira: { id: 'foice_ceifeira', name: 'Foice Ceifeira', emoji: '⛏️', description: 'Usada pelos cultistas do abismo.', slot: 'weapon', rarity: 'Raro', minLevel: 22, stats: { attack: 65, str: 15, lck: 10, critBonus: 15 }, price: 4500, sellPrice: 900, maxStack: 1 },
  espada_lendaria: { id: 'espada_lendaria', name: 'Espada da Aliança', emoji: '🌟', description: 'Forjada no coração do Reino. Uma lenda.', slot: 'weapon', rarity: 'Lendário', minLevel: 40, stats: { attack: 180, str: 30, agi: 15, int: 15, vit: 10, lck: 20 }, price: 0, sellPrice: 50000, maxStack: 1 },

  cajado_de_aprendiz: { id: 'cajado_de_aprendiz', name: 'Cajado de Aprendiz', emoji: '🪄', description: 'Foco mágico simples.', slot: 'weapon', rarity: 'Comum', minLevel: 1, stats: { attack: 6, int: 4, energy: 20 }, price: 60, sellPrice: 12, maxStack: 1 },
  varinha_de_cristal: { id: 'varinha_de_cristal', name: 'Varinha de Cristal', emoji: '🎇', description: 'Canaliza mana purificada.', slot: 'weapon', rarity: 'Comum', minLevel: 8, stats: { attack: 12, int: 10, energy: 35 }, price: 500, sellPrice: 100, maxStack: 1 },
  cajado_arcano: { id: 'cajado_arcano', name: 'Cajado Arcano', emoji: '🔮', description: 'Poder puro e condensado.', slot: 'weapon', rarity: 'Raro', minLevel: 15, stats: { attack: 20, int: 25, energy: 80, critBonus: 5 }, price: 2500, sellPrice: 500, maxStack: 1 },
  grimorio_sombrio: { id: 'grimorio_sombrio', name: 'Grimório Sombrio', emoji: '📓', description: 'Livro de maldições proibidas.', slot: 'weapon', rarity: 'Épico', minLevel: 30, stats: { attack: 40, int: 45, energy: 150, lck: 15 }, price: 0, sellPrice: 8000, maxStack: 1 },

  arco_longo: { id: 'arco_longo', name: 'Arco Longo', emoji: '🏹', description: 'Favorito dos sentinelas.', slot: 'weapon', rarity: 'Comum', minLevel: 1, stats: { attack: 12, agi: 3 }, price: 80, sellPrice: 16, maxStack: 1 },
  besta_pesada: { id: 'besta_pesada', name: 'Besta Pesada', emoji: '🏹', description: 'Disparo letal, recarga lenta.', slot: 'weapon', rarity: 'Incomum', minLevel: 10, stats: { attack: 35, str: 5, agi: -2, critBonus: 10 }, price: 1100, sellPrice: 220, maxStack: 1 },
  arco_elfico: { id: 'arco_elfico', name: 'Arco Élfico', emoji: '🍃', description: 'Preciso como a mente élfica.', slot: 'weapon', rarity: 'Épico', minLevel: 25, stats: { attack: 75, agi: 25, lck: 15, critBonus: 12 }, price: 0, sellPrice: 5000, maxStack: 1, effect: 'Chance de atirar 2x' },

  adaga_de_bronze: { id: 'adaga_de_bronze', name: 'Adaga de Bronze', emoji: '🔪', description: 'Rápida e leve.', slot: 'weapon', rarity: 'Comum', minLevel: 2, stats: { attack: 9, agi: 4 }, price: 100, sellPrice: 20, maxStack: 1 },
  adaga_sombria: { id: 'adaga_sombria', name: 'Adaga Sombria', emoji: '🗡️', description: 'Lâmina envenenada.', slot: 'weapon', rarity: 'Incomum', minLevel: 8, stats: { attack: 25, agi: 12, lck: 5, critBonus: 8 }, price: 800, sellPrice: 160, maxStack: 1 },

  // ═══════════════ ELMOS (helmet) ═══════════════
  capuz_de_pano: { id: 'capuz_de_pano', name: 'Capuz de Pano', emoji: '🥷', description: 'Esconde o rosto da chuva.', slot: 'helmet', rarity: 'Comum', minLevel: 1, stats: { defense: 2, agi: 1 }, price: 20, sellPrice: 4, maxStack: 1 },
  elmo_de_couro: { id: 'elmo_de_couro', name: 'Elmo de Couro', emoji: '🪖', description: 'Couro endurecido.', slot: 'helmet', rarity: 'Comum', minLevel: 3, stats: { defense: 5, vit: 1 }, price: 50, sellPrice: 10, maxStack: 1 },
  capacete_de_ferro: { id: 'capacete_de_ferro', name: 'Capacete de Ferro', emoji: '⛑️', description: 'Padrão da infantaria.', slot: 'helmet', rarity: 'Comum', minLevel: 8, stats: { defense: 14, vit: 4 }, price: 300, sellPrice: 60, maxStack: 1 },
  tiara_arcana: { id: 'tiara_arcana', name: 'Tiara Arcana', emoji: '💎', description: 'Aumenta o foco mental.', slot: 'helmet', rarity: 'Incomum', minLevel: 10, stats: { int: 12, energy: 40, defense: 6 }, price: 650, sellPrice: 130, maxStack: 1 },
  mascara_do_assassino: { id: 'mascara_do_assassino', name: 'Máscara do Assassino', emoji: '👺', description: 'Intimida os fracos.', slot: 'helmet', rarity: 'Raro', minLevel: 18, stats: { defense: 20, agi: 15, critBonus: 5 }, price: 2000, sellPrice: 400, maxStack: 1 },
  coroa_das_sombras: { id: 'coroa_das_sombras', name: 'Coroa das Sombras', emoji: '👑', description: 'Poder do rei caído.', slot: 'helmet', rarity: 'Épico', minLevel: 35, stats: { int: 25, str: 15, defense: 30, energy: 80 }, price: 0, sellPrice: 8000, maxStack: 1 },

  // ═══════════════ PEITORAIS (chest) ═══════════════
  tunica_de_pano: { id: 'tunica_de_pano', name: 'Túnica de Pano', emoji: '🥋', description: 'Roupa comum de aldeão.', slot: 'chest', rarity: 'Comum', minLevel: 1, stats: { defense: 3, hp: 10 }, price: 30, sellPrice: 6, maxStack: 1 },
  peitoral_de_couro: { id: 'peitoral_de_couro', name: 'Peitoral de Couro', emoji: '🦺', description: 'Oferece proteção básica.', slot: 'chest', rarity: 'Comum', minLevel: 4, stats: { defense: 10, vit: 2 }, price: 150, sellPrice: 30, maxStack: 1 },
  manto_do_sabio: { id: 'manto_do_sabio', name: 'Manto do Sábio', emoji: '🧥', description: 'Imbuído de fios arcanos.', slot: 'chest', rarity: 'Incomum', minLevel: 8, stats: { defense: 8, int: 10, energy: 50 }, price: 700, sellPrice: 140, maxStack: 1 },
  cota_de_malha: { id: 'cota_de_malha', name: 'Cota de Malha', emoji: '⛓️', description: 'Anéis de aço entrelaçados.', slot: 'chest', rarity: 'Incomum', minLevel: 12, stats: { defense: 25, vit: 6, str: 3 }, price: 1200, sellPrice: 240, maxStack: 1 },
  armadura_de_placas: { id: 'armadura_de_placas', name: 'Armadura de Placas', emoji: '🛡️', description: 'Aço impenetrável.', slot: 'chest', rarity: 'Raro', minLevel: 20, stats: { defense: 45, vit: 15, agi: -5 }, price: 3500, sellPrice: 700, maxStack: 1 },
  veste_dimensional: { id: 'veste_dimensional', name: 'Veste Dimensional', emoji: '🌌', description: 'Parece feita de estrelas.', slot: 'chest', rarity: 'Épico', minLevel: 32, stats: { defense: 35, int: 30, dodgeBonus: 10, energy: 100 }, price: 0, sellPrice: 10000, maxStack: 1 },

  // ═══════════════ CALÇAS (pants) ═══════════════
  calcas_de_pano: { id: 'calcas_de_pano', name: 'Calças de Pano', emoji: '🩳', description: 'Simples e leves.', slot: 'pants', rarity: 'Comum', minLevel: 1, stats: { defense: 2 }, price: 25, sellPrice: 5, maxStack: 1 },
  calcas_de_couro: { id: 'calcas_de_couro', name: 'Calças de Couro', emoji: '👖', description: 'Permitem boa mobilidade.', slot: 'pants', rarity: 'Comum', minLevel: 4, stats: { defense: 6, agi: 2 }, price: 120, sellPrice: 24, maxStack: 1 },
  calcas_furtivas: { id: 'calcas_furtivas', name: 'Calças Furtivas', emoji: '🥷', description: 'Não emitem som ao andar.', slot: 'pants', rarity: 'Incomum', minLevel: 10, stats: { defense: 10, agi: 8, dodgeBonus: 3 }, price: 850, sellPrice: 170, maxStack: 1 },
  calcas_de_ferro: { id: 'calcas_de_ferro', name: 'Calças de Ferro', emoji: '🦾', description: 'Proteção pesada.', slot: 'pants', rarity: 'Incomum', minLevel: 12, stats: { defense: 18, vit: 4 }, price: 1000, sellPrice: 200, maxStack: 1 },
  calcas_de_mithril: { id: 'calcas_de_mithril', name: 'Calças de Mithril', emoji: '✨', description: 'Leve como pena, duro como aço.', slot: 'pants', rarity: 'Épico', minLevel: 30, stats: { defense: 55, agi: 12, vit: 10 }, price: 0, sellPrice: 6000, maxStack: 1 },

  // ═══════════════ BOTAS (boots) ═══════════════
  sandalias: { id: 'sandalias', name: 'Sandálias', emoji: '🩴', description: 'Pé no chão.', slot: 'boots', rarity: 'Comum', minLevel: 1, stats: { defense: 1, agi: 1 }, price: 15, sellPrice: 3, maxStack: 1 },
  botas_de_couro: { id: 'botas_de_couro', name: 'Botas de Couro', emoji: '👟', description: 'Confortáveis.', slot: 'boots', rarity: 'Comum', minLevel: 3, stats: { defense: 4, agi: 3 }, price: 90, sellPrice: 18, maxStack: 1 },
  botas_pesadas: { id: 'botas_pesadas', name: 'Botas de Aço', emoji: '🥾', description: 'Te prendem ao chão.', slot: 'boots', rarity: 'Incomum', minLevel: 10, stats: { defense: 12, vit: 3, agi: -2 }, price: 600, sellPrice: 120, maxStack: 1 },
  botas_velozes: { id: 'botas_velozes', name: 'Botas Velozes', emoji: '⚡', description: 'Magia de aceleração.', slot: 'boots', rarity: 'Raro', minLevel: 15, stats: { agi: 18, dodgeBonus: 8, defense: 10 }, price: 2000, sellPrice: 400, maxStack: 1 },
  passos_do_assassino: { id: 'passos_do_assassino', name: 'Passos Sombrios', emoji: '🦇', description: 'Feitas da sombra pura.', slot: 'boots', rarity: 'Épico', minLevel: 28, stats: { agi: 30, lck: 10, dodgeBonus: 12, defense: 20 }, price: 0, sellPrice: 7500, maxStack: 1 },

  // ═══════════════ LUVAS (gloves) ═══════════════
  luvas_de_pano: { id: 'luvas_de_pano', name: 'Luvas de Pano', emoji: '🧤', description: 'Evita calos.', slot: 'gloves', rarity: 'Comum', minLevel: 1, stats: { defense: 1 }, price: 20, sellPrice: 4, maxStack: 1 },
  luvas_de_couro: { id: 'luvas_de_couro', name: 'Luvas de Couro', emoji: '🥊', description: 'Melhora a aderência.', slot: 'gloves', rarity: 'Comum', minLevel: 4, stats: { defense: 4, str: 2 }, price: 100, sellPrice: 20, maxStack: 1 },
  luvas_arcanas: { id: 'luvas_arcanas', name: 'Luvas de Seda Arcana', emoji: '✨', description: 'Fios mágicos conduzem mana.', slot: 'gloves', rarity: 'Incomum', minLevel: 10, stats: { int: 8, energy: 20, defense: 5 }, price: 750, sellPrice: 150, maxStack: 1 },
  manoplas_de_ferro: { id: 'manoplas_de_ferro', name: 'Manoplas de Ferro', emoji: '🦾', description: 'Soco dói mais.', slot: 'gloves', rarity: 'Incomum', minLevel: 12, stats: { defense: 14, str: 5 }, price: 900, sellPrice: 180, maxStack: 1 },
  luvas_do_assassino: { id: 'luvas_do_assassino', name: 'Luvas do Assassino', emoji: '🖤', description: 'Lâminas ocultas.', slot: 'gloves', rarity: 'Raro', minLevel: 16, stats: { agi: 12, lck: 10, critBonus: 12, defense: 10 }, price: 2500, sellPrice: 500, maxStack: 1 },

  // ═══════════════ ESCUDOS (shield) ═══════════════
  escudo_de_madeira: { id: 'escudo_de_madeira', name: 'Escudo de Madeira', emoji: '🪵', description: 'Quebra fácil.', slot: 'shield', rarity: 'Comum', minLevel: 1, stats: { defense: 10 }, price: 100, sellPrice: 20, maxStack: 1 },
  broquel_bronze: { id: 'broquel_bronze', name: 'Broquel de Bronze', emoji: '🛡️', description: 'Pequeno, mas deflete bem.', slot: 'shield', rarity: 'Comum', minLevel: 4, stats: { defense: 18, agi: 2 }, price: 350, sellPrice: 70, maxStack: 1 },
  escudo_de_ferro: { id: 'escudo_de_ferro', name: 'Escudo de Ferro', emoji: '🛡️', description: 'Robusto e pesado.', slot: 'shield', rarity: 'Incomum', minLevel: 10, stats: { defense: 35, vit: 6 }, price: 1200, sellPrice: 240, maxStack: 1 },
  escudo_torre: { id: 'escudo_torre', name: 'Escudo Torre de Aço', emoji: '🏰', description: 'Cobre o corpo todo.', slot: 'shield', rarity: 'Raro', minLevel: 20, stats: { defense: 60, vit: 15, agi: -5, hp: 100 }, price: 4000, sellPrice: 800, maxStack: 1 },
  escudo_sagrado: { id: 'escudo_sagrado', name: 'Égide Sagrada', emoji: '✨', description: 'Abençoado pelos deuses.', slot: 'shield', rarity: 'Épico', minLevel: 30, stats: { defense: 90, vit: 25, hp: 250, energy: 50 }, price: 0, sellPrice: 9000, maxStack: 1, effect: 'Reflete 10% do dano recebido' },

  // ═══════════════ ANÉIS (ring) ═══════════════
  anel_simples: { id: 'anel_simples', name: 'Anel de Latão', emoji: '💍', description: 'Dá um charme.', slot: 'ring', rarity: 'Comum', minLevel: 1, stats: { lck: 2 }, price: 200, sellPrice: 40, maxStack: 1 },
  anel_de_prata: { id: 'anel_de_prata', name: 'Anel de Prata', emoji: '💍', description: 'Polido e brilhante.', slot: 'ring', rarity: 'Comum', minLevel: 5, stats: { lck: 5, int: 2 }, price: 600, sellPrice: 120, maxStack: 1 },
  anel_magico: { id: 'anel_magico', name: 'Anel de Safira', emoji: '💎', description: 'Armazena mana.', slot: 'ring', rarity: 'Incomum', minLevel: 10, stats: { int: 10, energy: 40 }, price: 1500, sellPrice: 300, maxStack: 1 },
  anel_do_guerreiro: { id: 'anel_do_guerreiro', name: 'Anel do Gigante', emoji: '🔴', description: 'Força bruta.', slot: 'ring', rarity: 'Raro', minLevel: 18, stats: { str: 15, vit: 10, hp: 80 }, price: 3500, sellPrice: 700, maxStack: 1 },
  ouroboros: { id: 'ouroboros', name: 'Ouroboros', emoji: '🐍', description: 'A vida e a morte.', slot: 'ring', rarity: 'Lendário', minLevel: 45, stats: { str: 20, int: 20, vit: 20, agi: 20, lck: 20, hp: 500, energy: 200 }, price: 0, sellPrice: 60000, maxStack: 1 },

  // ═══════════════ AMULETOS (amulet) ═══════════════
  colar_de_dente: { id: 'colar_de_dente', name: 'Colar de Presa', emoji: '📿', description: 'Traz coragem.', slot: 'amulet', rarity: 'Comum', minLevel: 2, stats: { str: 3 }, price: 250, sellPrice: 50, maxStack: 1 },
  amuleto_de_protecao: { id: 'amuleto_de_protecao', name: 'Amuleto Guardião', emoji: '🔮', description: 'Campo de força leve.', slot: 'amulet', rarity: 'Incomum', minLevel: 8, stats: { vit: 8, defense: 12 }, price: 1200, sellPrice: 240, maxStack: 1 },
  amuleto_da_sorte: { id: 'amuleto_da_sorte', name: 'Trevo de Quatro Folhas', emoji: '🍀', description: 'A sorte sorri pra você.', slot: 'amulet', rarity: 'Raro', minLevel: 15, stats: { lck: 25, goldBonus: 15 }, price: 4000, sellPrice: 800, maxStack: 1 },
  coracao_de_gelo: { id: 'coracao_de_gelo', name: 'Coração de Gelo', emoji: '❄️', description: 'Pulsando frio absoluto.', slot: 'amulet', rarity: 'Épico', minLevel: 30, stats: { int: 35, vit: 20, energy: 150 }, price: 0, sellPrice: 12000, maxStack: 1 },

  // ═══════════════ MOCHILAS (backpack) ═══════════════
  mochila_simples: { id: 'mochila_simples', name: 'Pochete de Pano', emoji: '👝', description: 'Aumenta limite de itens.', slot: 'backpack', rarity: 'Comum', minLevel: 1, stats: {}, price: 300, sellPrice: 60, maxStack: 1, effect: 'Inventário +10 slots' },
  mochila_de_aventureiro: { id: 'mochila_de_aventureiro', name: 'Mochila de Couro', emoji: '🎒', description: 'Bolsos extras.', slot: 'backpack', rarity: 'Incomum', minLevel: 10, stats: { vit: 2 }, price: 1500, sellPrice: 300, maxStack: 1, effect: 'Inventário +25 slots' },
  mochila_magica: { id: 'mochila_magica', name: 'Mochila Dimensional', emoji: '🌌', description: 'Espaço quase infinito.', slot: 'backpack', rarity: 'Raro', minLevel: 25, stats: { lck: 10 }, price: 8000, sellPrice: 1600, maxStack: 1, effect: 'Inventário +50 slots' },

  // ═══════════════ PETS (pet) ═══════════════
  gato_preto: { id: 'gato_preto', name: 'Gato Preto', emoji: '🐈‍⬛', description: 'Dá azar aos inimigos.', slot: 'pet', rarity: 'Comum', minLevel: 1, stats: { lck: 8, agi: 4 }, price: 800, sellPrice: 160, maxStack: 1 },
  lobo_filhote: { id: 'lobo_filhote', name: 'Lobo Leal', emoji: '🐺', description: 'Te defende com a vida.', slot: 'pet', rarity: 'Incomum', minLevel: 5, stats: { str: 8, vit: 5, attack: 15 }, price: 2000, sellPrice: 400, maxStack: 1 },
  slime_azul: { id: 'slime_azul', name: 'Slime Doméstico', emoji: '🫧', description: 'Amortece os golpes.', slot: 'pet', rarity: 'Incomum', minLevel: 5, stats: { vit: 12, hp: 50, defense: 10 }, price: 1800, sellPrice: 360, maxStack: 1 },
  tartaruga_casco: { id: 'tartaruga_casco', name: 'Tartaruga Casco-Duro', emoji: '🐢', description: 'Uma muralha portátil.', slot: 'pet', rarity: 'Raro', minLevel: 12, stats: { vit: 25, defense: 30, hp: 120 }, price: 5000, sellPrice: 1000, maxStack: 1 },
  coruja_mistica: { id: 'coruja_mistica', name: 'Coruja Arcana', emoji: '🦉', description: 'Regenera sua mana na batalha.', slot: 'pet', rarity: 'Raro', minLevel: 15, stats: { int: 20, energy: 100, xpBonus: 5 }, price: 6000, sellPrice: 1200, maxStack: 1 },
  fada_cura: { id: 'fada_cura', name: 'Fada da Luz', emoji: '🧚', description: 'Um brilho de esperança.', slot: 'pet', rarity: 'Épico', minLevel: 28, stats: { int: 25, vit: 15, hp: 200 }, price: 15000, sellPrice: 3000, maxStack: 1, effect: 'Cura passivamente a cada rodada' },
  dragao_miniatura: { id: 'dragao_miniatura', name: 'Dragão de Bolso', emoji: '🐉', description: 'Cospe fogo de verdade.', slot: 'pet', rarity: 'Épico', minLevel: 35, stats: { str: 30, int: 30, attack: 50 }, price: 0, sellPrice: 15000, maxStack: 1 },

  // ═══════════════ CONSUMÍVEIS (consumable) ═══════════════
  pocao_de_vida_p: { id: 'pocao_de_vida_p', name: 'Poção de Vida (P)', emoji: '🧪', description: 'Restaura 100 HP.', slot: 'consumable', rarity: 'Comum', minLevel: 1, stats: { hp: 100 }, price: 50, sellPrice: 10, maxStack: 99 },
  pocao_de_vida_m: { id: 'pocao_de_vida_m', name: 'Poção de Vida (M)', emoji: '🍶', description: 'Restaura 300 HP.', slot: 'consumable', rarity: 'Incomum', minLevel: 5, stats: { hp: 300 }, price: 150, sellPrice: 30, maxStack: 99 },
  pocao_de_vida_g: { id: 'pocao_de_vida_g', name: 'Poção de Vida (G)', emoji: '🏺', description: 'Restaura 1000 HP.', slot: 'consumable', rarity: 'Raro', minLevel: 15, stats: { hp: 1000 }, price: 500, sellPrice: 100, maxStack: 99 },
  pocao_de_energia: { id: 'pocao_de_energia', name: 'Poção de Energia', emoji: '⚡', description: 'Restaura 100 Energia.', slot: 'consumable', rarity: 'Comum', minLevel: 1, stats: { energy: 100 }, price: 80, sellPrice: 16, maxStack: 99 },
  refeicao_taverna: { id: 'refeicao_taverna', name: 'Refeição Farta', emoji: '🍗', description: 'Restaura 500 HP e 50 Energia.', slot: 'consumable', rarity: 'Incomum', minLevel: 5, stats: { hp: 500, energy: 50 }, price: 300, sellPrice: 60, maxStack: 50 },
  elixir_de_xp: { id: 'elixir_de_xp', name: 'Elixir da Sabedoria', emoji: '💜', description: 'Dobro de XP nas batalhas.', slot: 'consumable', rarity: 'Raro', minLevel: 1, stats: {}, price: 2000, sellPrice: 400, maxStack: 10 },
  pergaminho_de_tele: { id: 'pergaminho_de_tele', name: 'Pergaminho de Retorno', emoji: '📜', description: 'TP para a cidade.', slot: 'consumable', rarity: 'Incomum', minLevel: 1, stats: {}, price: 250, sellPrice: 50, maxStack: 20 },

  // ═══════════════ MATERIAIS (material) ═══════════════
  minerio_de_ferro: { id: 'minerio_de_ferro', name: 'Minério de Ferro', emoji: '🪨', description: 'Básico para forja.', slot: 'material', rarity: 'Comum', minLevel: 1, stats: {}, price: 20, sellPrice: 10, maxStack: 999 },
  minerio_de_aco: { id: 'minerio_de_aco', name: 'Minério de Aço', emoji: '🔩', description: 'Para itens duráveis.', slot: 'material', rarity: 'Incomum', minLevel: 5, stats: {}, price: 80, sellPrice: 40, maxStack: 999 },
  couro_bruto: { id: 'couro_bruto', name: 'Couro Bruto', emoji: '🟫', description: 'Dropado de feras.', slot: 'material', rarity: 'Comum', minLevel: 1, stats: {}, price: 15, sellPrice: 8, maxStack: 999 },
  erva_medicinal: { id: 'erva_medicinal', name: 'Erva Medicinal', emoji: '🌿', description: 'Materia-prima de poções.', slot: 'material', rarity: 'Comum', minLevel: 1, stats: {}, price: 10, sellPrice: 5, maxStack: 999 },
  cristal_arcano: { id: 'cristal_arcano', name: 'Cristal Arcano', emoji: '💎', description: 'Usado em encantamentos.', slot: 'material', rarity: 'Raro', minLevel: 10, stats: {}, price: 300, sellPrice: 150, maxStack: 999 },
  essencia_sombria: { id: 'essencia_sombria', name: 'Essência Sombria', emoji: '🌑', description: 'Gota do abismo.', slot: 'material', rarity: 'Épico', minLevel: 25, stats: {}, price: 0, sellPrice: 800, maxStack: 999 },
  escama_dragao: { id: 'escama_dragao', name: 'Escama de Dragão', emoji: '🐉', description: 'Duro como diamante, quente como fogo.', slot: 'material', rarity: 'Lendário', minLevel: 40, stats: {}, price: 0, sellPrice: 2500, maxStack: 99 },
  fragmento_de_boss: { id: 'fragmento_de_boss', name: 'Alma de Guardião', emoji: '💠', description: 'Para forja de lendários.', slot: 'material', rarity: 'Lendário', minLevel: 1, stats: {}, price: 0, sellPrice: 5000, maxStack: 99 },
};

export const ITEM_LIST = Object.values(ITEMS);

// ⚙️ MÁQUINA DE COMPATIBILIDADE (Injeta os Apelidos Automaticamente)
for (const item of ITEM_LIST) {
  item.type = item.slot;
  item.buyPrice = item.price;
  if (item.stats && item.stats.hp) {
    item.stats.maxHp = item.stats.hp;
  }
}

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
  chest:     '👕',
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
  chest:     'Peitoral',
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
  craftTimeMin: number;
  minLevel: number;
  costGold: number;
  resultItemId?: string;
  resultQty?: number;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: 'craft_espada_ferro',
    outputItem: 'espada_de_ferro', outputQty: 1, resultItemId: 'espada_de_ferro', resultQty: 1,
    ingredients: [{ itemId: 'minerio_de_ferro', qty: 5 }, { itemId: 'couro_bruto', qty: 2 }],
    craftTimeMin: 10, minLevel: 3, costGold: 100,
  },
  {
    id: 'craft_espada_aco',
    outputItem: 'espada_de_aco', outputQty: 1, resultItemId: 'espada_de_aco', resultQty: 1,
    ingredients: [{ itemId: 'minerio_de_aco', qty: 8 }, { itemId: 'cristal_arcano', qty: 1 }],
    craftTimeMin: 30, minLevel: 8, costGold: 400,
  },
  {
    id: 'craft_pocao_vida_m',
    outputItem: 'pocao_de_vida_m', outputQty: 3, resultItemId: 'pocao_de_vida_m', resultQty: 3,
    ingredients: [{ itemId: 'erva_medicinal', qty: 3 }],
    craftTimeMin: 5, minLevel: 1, costGold: 50,
  },
  {
    id: 'craft_pocao_vida_g',
    outputItem: 'pocao_de_vida_g', outputQty: 1, resultItemId: 'pocao_de_vida_g', resultQty: 1,
    ingredients: [{ itemId: 'erva_medicinal', qty: 5 }, { itemId: 'cristal_arcano', qty: 1 }],
    craftTimeMin: 15, minLevel: 15, costGold: 150,
  },
  {
    id: 'craft_capacete_ferro',
    outputItem: 'capacete_de_ferro', outputQty: 1, resultItemId: 'capacete_de_ferro', resultQty: 1,
    ingredients: [{ itemId: 'minerio_de_ferro', qty: 4 }],
    craftTimeMin: 8, minLevel: 8, costGold: 120,
  },
  {
    id: 'craft_escudo_ferro',
    outputItem: 'escudo_de_ferro', outputQty: 1, resultItemId: 'escudo_de_ferro', resultQty: 1,
    ingredients: [{ itemId: 'minerio_de_ferro', qty: 6 }, { itemId: 'couro_bruto', qty: 3 }],
    craftTimeMin: 12, minLevel: 10, costGold: 180,
  },
];
