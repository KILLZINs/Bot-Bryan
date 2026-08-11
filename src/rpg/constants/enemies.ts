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

  // ─── Cidade Inicial / Floresta dos Iniciantes ──────────────────────────────
  lobo: {
    id: 'lobo', name: 'Lobo Selvagem', emoji: '🐺', type: 'normal',
    locationIds: ['floresta_iniciantes', 'cidade_inicial'],
    minLevel: 1, maxLevel: 5,
    baseHp: 160, baseAttack: 22, baseDefense: 10, speed: 7,
    xpReward: 30, goldMin: 10, goldMax: 25,
    dropTable: [{ itemId: 'couro_bruto', chance: 60 }, { itemId: 'pocao_de_vida_p', chance: 20 }],
  },
  goblin: {
    id: 'goblin', name: 'Goblin', emoji: '👺', type: 'normal',
    locationIds: ['floresta_iniciantes', 'cidade_inicial'],
    minLevel: 1, maxLevel: 6,
    baseHp: 130, baseAttack: 18, baseDefense: 8, speed: 8,
    xpReward: 25, goldMin: 12, goldMax: 30,
    dropTable: [{ itemId: 'minerio_de_ferro', chance: 40 }, { itemId: 'adaga_sombria', chance: 2 }],
    abilities: ['Grita alto (reduz sua velocidade por 1 turno)'],
  },
  slime: {
    id: 'slime', name: 'Slime Verde', emoji: '🟢', type: 'normal',
    locationIds: ['floresta_iniciantes', 'cidade_inicial'],
    minLevel: 1, maxLevel: 4,
    baseHp: 110, baseAttack: 14, baseDefense: 6, speed: 3,
    xpReward: 20, goldMin: 5, goldMax: 15,
    dropTable: [{ itemId: 'erva_medicinal', chance: 70 }],
  },
  rato_gigante: {
    id: 'rato_gigante', name: 'Rato Gigante', emoji: '🐀', type: 'normal',
    locationIds: ['floresta_iniciantes', 'cidade_inicial'],
    minLevel: 1, maxLevel: 3,
    baseHp: 90, baseAttack: 16, baseDefense: 5, speed: 9,
    xpReward: 15, goldMin: 4, goldMax: 12,
    dropTable: [{ itemId: 'couro_bruto', chance: 50 }],
  },
  fungo_venenoso: {
    id: 'fungo_venenoso', name: 'Fungo Venenoso', emoji: '🍄', type: 'normal',
    locationIds: ['floresta_iniciantes', 'cidade_inicial'],
    minLevel: 2, maxLevel: 7,
    baseHp: 140, baseAttack: 18, baseDefense: 8, speed: 2,
    xpReward: 28, goldMin: 8, goldMax: 20,
    dropTable: [{ itemId: 'erva_medicinal', chance: 55 }, { itemId: 'pocao_de_vida_p', chance: 15 }],
    abilities: ['Veneno (2 dano/turno por 3 turnos)'],
    weakness: 'fogo',
  },
  rei_goblin: {
    id: 'rei_goblin', name: 'Rei Goblin', emoji: '👑', type: 'boss',
    locationIds: ['floresta_iniciantes', 'cidade_inicial'],
    minLevel: 5,
    baseHp: 950, baseAttack: 58, baseDefense: 35, speed: 6,
    xpReward: 350, goldMin: 150, goldMax: 280,
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
    baseHp: 240, baseAttack: 42, baseDefense: 20, speed: 9,
    xpReward: 70, goldMin: 30, goldMax: 60,
    dropTable: [{ itemId: 'couro_bruto', chance: 45 }, { itemId: 'pocao_de_vida_p', chance: 25 }],
    abilities: ['Mergulho Rasante (ignora 30% defesa)'],
  },
  treant: {
    id: 'treant', name: 'Treant', emoji: '🌳', type: 'elite',
    locationIds: ['ilha_da_floresta'],
    minLevel: 8, maxLevel: 15,
    baseHp: 750, baseAttack: 55, baseDefense: 50, speed: 2,
    xpReward: 160, goldMin: 70, goldMax: 140,
    dropTable: [{ itemId: 'minerio_de_ferro', chance: 60 }, { itemId: 'cristal_arcano', chance: 15 }],
    abilities: ['Raízes (prende por 1 turno)', 'Regeneração (recupera 5% HP/turno)'],
    weakness: 'fogo',
  },
  elfo_das_sombras: {
    id: 'elfo_das_sombras', name: 'Elfo das Sombras', emoji: '🧝', type: 'normal',
    locationIds: ['ilha_da_floresta'],
    minLevel: 7, maxLevel: 14,
    baseHp: 210, baseAttack: 48, baseDefense: 22, speed: 8,
    xpReward: 80, goldMin: 35, goldMax: 70,
    dropTable: [{ itemId: 'adaga_sombria', chance: 8 }, { itemId: 'arco_elfico', chance: 1 }],
  },
  guardiao_da_floresta: {
    id: 'guardiao_da_floresta', name: 'Guardião da Floresta', emoji: '🌲', type: 'boss',
    locationIds: ['ilha_da_floresta'],
    minLevel: 10,
    baseHp: 2200, baseAttack: 105, baseDefense: 85, speed: 5,
    xpReward: 850, goldMin: 350, goldMax: 650,
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
    baseHp: 320, baseAttack: 62, baseDefense: 28, speed: 8,
    xpReward: 110, goldMin: 45, goldMax: 90,
    dropTable: [{ itemId: 'pocao_de_vida_m', chance: 30 }, { itemId: 'cristal_arcano', chance: 20 }],
    abilities: ['Drenar Sangue (rouba 15% do dano causado como HP)'],
    weakness: 'luz',
  },
  golem_de_pedra: {
    id: 'golem_de_pedra', name: 'Golem de Pedra', emoji: '🪨', type: 'elite',
    locationIds: ['cavernas_sombrias'],
    minLevel: 12, maxLevel: 20,
    baseHp: 1100, baseAttack: 85, baseDefense: 110, speed: 1,
    xpReward: 220, goldMin: 100, goldMax: 200,
    dropTable: [{ itemId: 'minerio_de_aco', chance: 50 }, { itemId: 'fragmento_de_boss', chance: 10 }],
    abilities: ['Pele de Pedra (+50% defesa em turnos ímpares)'],
    weakness: 'magia',
  },
  aranha_gigante: {
    id: 'aranha_gigante', name: 'Aranha Gigante', emoji: '🕷️', type: 'normal',
    locationIds: ['cavernas_sombrias'],
    minLevel: 11, maxLevel: 19,
    baseHp: 380, baseAttack: 68, baseDefense: 32, speed: 7,
    xpReward: 125, goldMin: 50, goldMax: 100,
    dropTable: [{ itemId: 'couro_bruto', chance: 55 }, { itemId: 'pocao_de_vida_m', chance: 20 }],
    abilities: ['Teia (reduz velocidade do alvo à metade)'],
  },
  morto_vivo: {
    id: 'morto_vivo', name: 'Morto-Vivo', emoji: '🧟', type: 'normal',
    locationIds: ['cavernas_sombrias'],
    minLevel: 10, maxLevel: 17,
    baseHp: 340, baseAttack: 58, baseDefense: 35, speed: 3,
    xpReward: 100, goldMin: 40, goldMax: 85,
    dropTable: [{ itemId: 'minerio_de_ferro', chance: 40 }, { itemId: 'erva_medicinal', chance: 25 }],
    weakness: 'luz', resistance: 'trevas',
  },
  lorde_das_trevas_menor: {
    id: 'lorde_das_trevas_menor', name: 'Lorde das Trevas Menor', emoji: '😈', type: 'boss',
    locationIds: ['cavernas_sombrias'],
    minLevel: 15,
    baseHp: 4200, baseAttack: 150, baseDefense: 110, speed: 7,
    xpReward: 1500, goldMin: 600, goldMax: 1100,
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
    baseHp: 1300, baseAttack: 100, baseDefense: 95, speed: 4,
    xpReward: 280, goldMin: 140, goldMax: 260,
    dropTable: [{ itemId: 'cristal_arcano', chance: 45 }, { itemId: 'minerio_de_aco', chance: 40 }],
    abilities: ['Escudo Arcano (imune a magias por 1 turno)'],
  },
  guardiao_ancestral: {
    id: 'guardiao_ancestral', name: 'Guardião Ancestral', emoji: '🏛️', type: 'boss',
    locationIds: ['ruinas_antigas'],
    minLevel: 20,
    baseHp: 6500, baseAttack: 190, baseDefense: 160, speed: 5,
    xpReward: 2500, goldMin: 1100, goldMax: 1900,
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
    baseHp: 2600, baseAttack: 190, baseDefense: 140, speed: 6,
    xpReward: 550, goldMin: 300, goldMax: 600,
    dropTable: [
      { itemId: 'cristal_arcano', chance: 50 },
      { itemId: 'fragmento_de_boss', chance: 30 },
    ],
    abilities: ['Sopro de Gelo (congela por 2 turnos)', 'Cauda de Gelo (-30% velocidade)'],
    resistance: 'gelo', weakness: 'fogo',
  },
  dragao_anciag: {
    id: 'dragao_anciag', name: 'Dragão Ancião Gélido', emoji: '🐲', type: 'boss',
    locationIds: ['montanhas_geladas'],
    minLevel: 30,
    baseHp: 12500, baseAttack: 320, baseDefense: 230, speed: 7,
    xpReward: 5000, goldMin: 2200, goldMax: 3800,
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
    baseHp: 3200, baseAttack: 310, baseDefense: 200, speed: 8,
    xpReward: 950, goldMin: 600, goldMax: 1200,
    dropTable: [{ itemId: 'fragmento_de_boss', chance: 40 }, { itemId: 'cristal_arcano', chance: 50 }],
    abilities: ['Chamas do Inferno', 'Maldição Demoníaca'],
    weakness: 'luz',
  },
  arquidemonio: {
    id: 'arquidemonio', name: 'Arquidemônio', emoji: '😈', type: 'boss',
    locationIds: ['torre_do_abismo'],
    minLevel: 45,
    baseHp: 22000, baseAttack: 520, baseDefense: 380, speed: 9,
    xpReward: 12000, goldMin: 7000, goldMax: 13000,
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
    baseHp: 75000, baseAttack: 900, baseDefense: 600, speed: 10,
    xpReward: 38000, goldMin: 20000, goldMax: 45000,
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
  const matches = ENEMY_LIST.filter(e =>
    e.locationIds.includes(locationId) &&
    e.type !== 'boss' && e.type !== 'raid' &&
    playerLevel >= e.minLevel
  );

  if (matches.length > 0) return matches;

  // Fallback seguro se não encontrar inimigo no nível exato: retorna os normais da localização
  return ENEMY_LIST.filter(e => e.locationIds.includes(locationId) && e.type !== 'boss');
}

export function getBossesForLocation(locationId: string): Enemy[] {
  return ENEMY_LIST.filter(e =>
    e.locationIds.includes(locationId) && e.type === 'boss'
  );
}

/** Escala os stats do inimigo com o nível do jogador — multiplicador aumentado para combate mais difícil */
export function scaleEnemy(enemy: Enemy, playerLevel: number): Enemy {
  const scale = 1 + Math.max(0, playerLevel - enemy.minLevel) * 0.22;
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
