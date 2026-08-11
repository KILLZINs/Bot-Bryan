// ═══════════════════════════════════════════════════════════════════════
// INIMIGOS E BOSSES
// ═══════════════════════════════════════════════════════════════════════

export type EnemyType = 'normal' | 'elite' | 'boss' | 'raid';

export interface Enemy {
  id: string;
  name: string;
  emoji: string;
  type: EnemyType;
  locationIds: string[];
  minLevel: number;
  maxLevel?: number;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  speed: number;          // 1-10, quem ataca primeiro
  xpReward: number;
  goldMin: number;
  goldMax: number;
  dropTable: { itemId: string; chance: number }[];  // chance em %
  abilities?: string[];   // habilidades especiais em texto
  karmaEffect?: number;   // karma ganho/perdido ao derrotar
  weakness?: string;      // tipo de dano que recebe +50%
  resistance?: string;    // tipo de dano que recebe -50%
}

export const ENEMIES: Record<string, Enemy> = {

  // ─── Floresta dos Iniciantes ───────────────────────────────────────────────
  lobo: {
    id: 'lobo', name: 'Lobo Selvagem', emoji: '🐺', type: 'normal',
    locationIds: ['floresta_iniciantes'],
    minLevel: 1, maxLevel: 5,
    baseHp: 80, baseAttack: 12, baseDefense: 5, speed: 7,
    xpReward: 20, goldMin: 5, goldMax: 15,
    dropTable: [{ itemId: 'couro_bruto', chance: 60 }, { itemId: 'pocao_de_vida_p', chance: 20 }],
  },
  goblin: {
    id: 'goblin', name: 'Goblin', emoji: '👺', type: 'normal',
    locationIds: ['floresta_iniciantes'],
    minLevel: 1, maxLevel: 6,
    baseHp: 60, baseAttack: 10, baseDefense: 3, speed: 8,
    xpReward: 18, goldMin: 8, goldMax: 20,
    dropTable: [{ itemId: 'minerio_de_ferro', chance: 40 }, { itemId: 'adaga_sombria', chance: 2 }],
    abilities: ['Grita alto (reduz sua velocidade por 1 turno)'],
  },
  slime: {
    id: 'slime', name: 'Slime Verde', emoji: '🟢', type: 'normal',
    locationIds: ['floresta_iniciantes'],
    minLevel: 1, maxLevel: 4,
    baseHp: 50, baseAttack: 6, baseDefense: 2, speed: 3,
    xpReward: 12, goldMin: 2, goldMax: 8,
    dropTable: [{ itemId: 'erva_medicinal', chance: 70 }],
  },
  rato_gigante: {
    id: 'rato_gigante', name: 'Rato Gigante', emoji: '🐀', type: 'normal',
    locationIds: ['floresta_iniciantes'],
    minLevel: 1, maxLevel: 3,
    baseHp: 40, baseAttack: 8, baseDefense: 2, speed: 9,
    xpReward: 10, goldMin: 1, goldMax: 6,
    dropTable: [{ itemId: 'couro_bruto', chance: 50 }],
  },
  fungo_venenoso: {
    id: 'fungo_venenoso', name: 'Fungo Venenoso', emoji: '🍄', type: 'normal',
    locationIds: ['floresta_iniciantes'],
    minLevel: 2, maxLevel: 7,
    baseHp: 70, baseAttack: 9, baseDefense: 4, speed: 2,
    xpReward: 16, goldMin: 3, goldMax: 10,
    dropTable: [{ itemId: 'erva_medicinal', chance: 55 }, { itemId: 'pocao_de_vida_p', chance: 15 }],
    abilities: ['Veneno (2 dano/turno por 3 turnos)'],
    weakness: 'fogo',
  },
  rei_goblin: {
    id: 'rei_goblin', name: 'Rei Goblin', emoji: '👑', type: 'boss',
    locationIds: ['floresta_iniciantes'],
    minLevel: 5,
    baseHp: 500, baseAttack: 35, baseDefense: 20, speed: 6,
    xpReward: 200, goldMin: 80, goldMax: 150,
    dropTable: [
      { itemId: 'espada_de_ferro', chance: 30 },
      { itemId: 'capacete_de_ferro', chance: 25 },
      { itemId: 'fragmento_de_boss', chance: 50 },
    ],
    abilities: ['Grito de Guerra (+30% ataque por 2 turnos)', 'Chama Gobelins (invoca 2 Goblins)'],
    karmaEffect: 5,
  },

  // ─── Ilha da Floresta ──────────────────────────────────────────────────────
  harpia: {
    id: 'harpia', name: 'Harpia', emoji: '🦅', type: 'normal',
    locationIds: ['ilha_da_floresta'],
    minLevel: 5, maxLevel: 12,
    baseHp: 120, baseAttack: 25, baseDefense: 10, speed: 9,
    xpReward: 40, goldMin: 15, goldMax: 35,
    dropTable: [{ itemId: 'couro_bruto', chance: 45 }, { itemId: 'pocao_de_vida_p', chance: 25 }],
    abilities: ['Mergulho Rasante (ignora 30% defesa)'],
  },
  treant: {
    id: 'treant', name: 'Treant', emoji: '🌳', type: 'elite',
    locationIds: ['ilha_da_floresta'],
    minLevel: 8, maxLevel: 15,
    baseHp: 400, baseAttack: 30, baseDefense: 35, speed: 2,
    xpReward: 90, goldMin: 40, goldMax: 80,
    dropTable: [{ itemId: 'minerio_de_ferro', chance: 60 }, { itemId: 'cristal_arcano', chance: 15 }],
    abilities: ['Raízes (prende por 1 turno)', 'Regeneração (recupera 5% HP/turno)'],
    weakness: 'fogo',
  },
  elfo_das_sombras: {
    id: 'elfo_das_sombras', name: 'Elfo das Sombras', emoji: '🧝', type: 'normal',
    locationIds: ['ilha_da_floresta'],
    minLevel: 7, maxLevel: 14,
    baseHp: 100, baseAttack: 28, baseDefense: 12, speed: 8,
    xpReward: 45, goldMin: 20, goldMax: 45,
    dropTable: [{ itemId: 'adaga_sombria', chance: 8 }, { itemId: 'arco_elfico', chance: 1 }],
  },
  guardiao_da_floresta: {
    id: 'guardiao_da_floresta', name: 'Guardião da Floresta', emoji: '🌲', type: 'boss',
    locationIds: ['ilha_da_floresta'],
    minLevel: 10,
    baseHp: 1200, baseAttack: 65, baseDefense: 55, speed: 5,
    xpReward: 500, goldMin: 200, goldMax: 380,
    dropTable: [
      { itemId: 'arco_elfico', chance: 15 },
      { itemId: 'botas_velozes', chance: 20 },
      { itemId: 'fragmento_de_boss', chance: 60 },
    ],
    abilities: ['Tempestade de Folhas (dano em área)', 'Raízes Sagradas (cura 10% HP)'],
    karmaEffect: 8, weakness: 'fogo',
  },

  // ─── Cavernas Sombrias ─────────────────────────────────────────────────────
  morcego_vampiro: {
    id: 'morcego_vampiro', name: 'Morcego Vampiro', emoji: '🦇', type: 'normal',
    locationIds: ['cavernas_sombrias'],
    minLevel: 10, maxLevel: 18,
    baseHp: 150, baseAttack: 38, baseDefense: 15, speed: 8,
    xpReward: 65, goldMin: 25, goldMax: 55,
    dropTable: [{ itemId: 'pocao_de_vida_m', chance: 30 }, { itemId: 'cristal_arcano', chance: 20 }],
    abilities: ['Drenar Sangue (rouba 15% do dano causado como HP)'],
    weakness: 'luz',
  },
  golem_de_pedra: {
    id: 'golem_de_pedra', name: 'Golem de Pedra', emoji: '🪨', type: 'elite',
    locationIds: ['cavernas_sombrias'],
    minLevel: 12, maxLevel: 20,
    baseHp: 600, baseAttack: 50, baseDefense: 80, speed: 1,
    xpReward: 130, goldMin: 60, goldMax: 120,
    dropTable: [{ itemId: 'minerio_de_aco', chance: 50 }, { itemId: 'fragmento_de_boss', chance: 10 }],
    abilities: ['Pele de Pedra (+50% defesa em turnos ímpares)'],
    weakness: 'magia',
  },
  aranha_gigante: {
    id: 'aranha_gigante', name: 'Aranha Gigante', emoji: '🕷️', type: 'normal',
    locationIds: ['cavernas_sombrias'],
    minLevel: 11, maxLevel: 19,
    baseHp: 200, baseAttack: 42, baseDefense: 18, speed: 7,
    xpReward: 75, goldMin: 30, goldMax: 65,
    dropTable: [{ itemId: 'couro_bruto', chance: 55 }, { itemId: 'pocao_de_vida_m', chance: 20 }],
    abilities: ['Teia (reduz velocidade do alvo à metade)'],
  },
  morto_vivo: {
    id: 'morto_vivo', name: 'Morto-Vivo', emoji: '🧟', type: 'normal',
    locationIds: ['cavernas_sombrias'],
    minLevel: 10, maxLevel: 17,
    baseHp: 180, baseAttack: 35, baseDefense: 20, speed: 3,
    xpReward: 58, goldMin: 20, goldMax: 50,
    dropTable: [{ itemId: 'minerio_de_ferro', chance: 40 }, { itemId: 'erva_medicinal', chance: 25 }],
    weakness: 'luz', resistance: 'trevas',
  },
  lorde_das_trevas_menor: {
    id: 'lorde_das_trevas_menor', name: 'Lorde das Trevas Menor', emoji: '😈', type: 'boss',
    locationIds: ['cavernas_sombrias'],
    minLevel: 15,
    baseHp: 2500, baseAttack: 90, baseDefense: 70, speed: 7,
    xpReward: 900, goldMin: 400, goldMax: 700,
    dropTable: [
      { itemId: 'coroa_das_sombras', chance: 8 },
      { itemId: 'espada_das_ruinas', chance: 12 },
      { itemId: 'fragmento_de_boss', chance: 70 },
      { itemId: 'cristal_arcano', chance: 40 },
    ],
    abilities: ['Maldição (-30% stats por 3 turnos)', 'Nova das Trevas (dano maciço)'],
    karmaEffect: 10, weakness: 'luz',
  },

  // ─── Ruínas Antigas ────────────────────────────────────────────────────────
  golem_arcano: {
    id: 'golem_arcano', name: 'Golem Arcano', emoji: '🤖', type: 'elite',
    locationIds: ['ruinas_antigas'],
    minLevel: 15, maxLevel: 25,
    baseHp: 700, baseAttack: 60, baseDefense: 60, speed: 4,
    xpReward: 160, goldMin: 80, goldMax: 160,
    dropTable: [{ itemId: 'cristal_arcano', chance: 45 }, { itemId: 'minerio_de_aco', chance: 40 }],
    abilities: ['Escudo Arcano (imune a magias por 1 turno)'],
  },
  guardiao_ancestral: {
    id: 'guardiao_ancestral', name: 'Guardião Ancestral', emoji: '🏛️', type: 'boss',
    locationIds: ['ruinas_antigas'],
    minLevel: 20,
    baseHp: 4000, baseAttack: 120, baseDefense: 100, speed: 5,
    xpReward: 1500, goldMin: 700, goldMax: 1200,
    dropTable: [
      { itemId: 'cajado_arcano', chance: 15 },
      { itemId: 'escudo_sagrado', chance: 10 },
      { itemId: 'fragmento_de_boss', chance: 80 },
    ],
    abilities: ['Olho Ancestral (dano verdadeiro)', 'Memória Antiga (ressuscita com 30% HP uma vez)'],
    karmaEffect: 12,
  },

  // ─── Montanhas Geladas ─────────────────────────────────────────────────────
  dragao_de_gelo: {
    id: 'dragao_de_gelo', name: 'Dragão de Gelo Jovem', emoji: '🐉', type: 'elite',
    locationIds: ['montanhas_geladas'],
    minLevel: 25, maxLevel: 35,
    baseHp: 1500, baseAttack: 120, baseDefense: 90, speed: 6,
    xpReward: 350, goldMin: 200, goldMax: 400,
    dropTable: [
      { itemId: 'cristal_arcano', chance: 50 },
      { itemId: 'fragmento_de_boss', chance: 30 },
    ],
    abilities: ['Sopro de Gelo (congela por 2 turnos)', 'Cauda de Gelo (-30% velocidade)'],
    resistance: 'gelo', weakness: 'fogo',
  },
  dragao_anciag: {
    id: 'dragao_anciag', name: 'Draçõ Anciã Gélida', emoji: '🐲', type: 'boss',
    locationIds: ['montanhas_geladas'],
    minLevel: 30,
    baseHp: 8000, baseAttack: 200, baseDefense: 150, speed: 7,
    xpReward: 3000, goldMin: 1500, goldMax: 2500,
    dropTable: [
      { itemId: 'arco_elfico', chance: 10 },
      { itemId: 'espada_lendaria', chance: 2 },
      { itemId: 'dragao_miniatura', chance: 5 },
      { itemId: 'fragmento_de_boss', chance: 90 },
    ],
    abilities: ['Tempestade Gelada (dano + congelamento total)', 'Escamas de Diamante (+100% defesa por 2 turnos)', 'Rugido do Abismo (reduz seus stats em 20%)'],
    karmaEffect: 20, resistance: 'gelo', weakness: 'fogo',
  },

  // ─── Torre do Abismo ───────────────────────────────────────────────────────
  demonio_menor: {
    id: 'demonio_menor', name: 'Demônio Menor', emoji: '👿', type: 'normal',
    locationIds: ['torre_do_abismo'],
    minLevel: 40, maxLevel: 50,
    baseHp: 2000, baseAttack: 200, baseDefense: 130, speed: 8,
    xpReward: 600, goldMin: 400, goldMax: 800,
    dropTable: [{ itemId: 'fragmento_de_boss', chance: 40 }, { itemId: 'cristal_arcano', chance: 50 }],
    abilities: ['Chamas do Inferno', 'Maldição Demoníaca'],
    weakness: 'luz',
  },
  arquidemonio: {
    id: 'arquidemonio', name: 'Arquidemônio', emoji: '😈', type: 'boss',
    locationIds: ['torre_do_abismo'],
    minLevel: 45,
    baseHp: 15000, baseAttack: 350, baseDefense: 250, speed: 9,
    xpReward: 8000, goldMin: 5000, goldMax: 9000,
    dropTable: [
      { itemId: 'espada_lendaria', chance: 5 },
      { itemId: 'fenix_sagrada', chance: 3 },
      { itemId: 'fragmento_de_boss', chance: 100 },
    ],
    abilities: ['Portal do Abismo', 'Maldição Suprema', 'Forma Final (+100% stats)'],
    karmaEffect: -15, weakness: 'luz',
  },

  // ─── Reino das Sombras ─────────────────────────────────────────────────────
  o_rei_das_sombras: {
    id: 'o_rei_das_sombras', name: 'O Rei das Sombras', emoji: '👑', type: 'boss',
    locationIds: ['reino_das_sombras'],
    minLevel: 50,
    baseHp: 50000, baseAttack: 600, baseDefense: 400, speed: 10,
    xpReward: 25000, goldMin: 15000, goldMax: 30000,
    dropTable: [
      { itemId: 'espada_lendaria', chance: 20 },
      { itemId: 'fenix_sagrada', chance: 10 },
      { itemId: 'fragmento_de_boss', chance: 100 },
    ],
    abilities: ['Domínio das Sombras (nega todos os buffs)', 'Noite Eterna (reduz 50% dos seus stats)', 'Morte Imediata (5% de chance de matar instantaneamente)', 'Ressureição Sombria (revive com 50% HP uma vez)'],
    karmaEffect: -20,
  },
};

export const ENEMY_LIST = Object.values(ENEMIES);

export function getEnemy(id: string): Enemy | undefined {
  return ENEMIES[id];
}

export function getEnemiesForLocation(locationId: string, playerLevel: number): Enemy[] {
  return ENEMY_LIST.filter(e =>
    e.locationIds.includes(locationId) &&
    e.type !== 'boss' && e.type !== 'raid' &&
    playerLevel >= e.minLevel &&
    (e.maxLevel === undefined || playerLevel <= e.maxLevel + 5)
  );
}

export function getBossesForLocation(locationId: string): Enemy[] {
  return ENEMY_LIST.filter(e =>
    e.locationIds.includes(locationId) && e.type === 'boss'
  );
}

/** Escala os stats do inimigo com o nível do jogador — inimigos mais difíceis */
export function scaleEnemy(enemy: Enemy, playerLevel: number): Enemy {
  const scale = 1 + (playerLevel - enemy.minLevel) * 0.14;
  return {
    ...enemy,
    baseHp: Math.floor(enemy.baseHp * scale),
    baseAttack: Math.floor(enemy.baseAttack * scale),
    baseDefense: Math.floor(enemy.baseDefense * scale),
    xpReward: Math.floor(enemy.xpReward * scale),
    goldMin: Math.floor(enemy.goldMin * scale),
    goldMax: Math.floor(enemy.goldMax * scale),
  };
}
