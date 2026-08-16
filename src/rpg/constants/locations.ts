// ═══════════════════════════════════════════════════════════════════════
// LOCALIZAÇÕES RPG (COM ZONAS SEGURAS DESCENTRALIZADAS)
// ═══════════════════════════════════════════════════════════════════════

export interface RpgLocation {
  id: string;
  name: string;
  emoji: string;
  description: string;
  minLevel: number;
  maxLevel?: number;
  environments: string[];
  enemyIds: string[];
  bossIds?: string[];
  travelCostEnergy: number;
  travelCooldownMin: number;
  goldMultiplier: number;
  xpMultiplier: number;
  dropBonus: number;
  hasDungeon: boolean;
  hasShop: boolean;
  hasCraft: boolean;
  color: number;
  isSafeZone: boolean;
}

export const LOCATIONS: Record<string, RpgLocation> = {

  // 🛡️ SEDES DA ALIANÇA (ZONAS SEGURAS ESPALHADAS PELO MAPA)
  sede_lumina: {
    id: 'sede_lumina',
    name: 'Fortaleza Lumina',
    emoji: '🏰',
    description: 'A Sede Central da Aliança. O único lugar 100% seguro para novatos forjarem e negociarem.',
    minLevel: 1,
    environments: ['DIA', 'NOITE'],
    enemyIds: [], bossIds: [],
    travelCostEnergy: 5, travelCooldownMin: 0,
    goldMultiplier: 1.0, xpMultiplier: 1.0, dropBonus: 0,
    hasDungeon: false, hasShop: true, hasCraft: true, color: 0x3498DB, isSafeZone: true,
  },
  posto_nevoeiro: {
    id: 'posto_nevoeiro',
    name: 'Posto do Nevoeiro',
    emoji: '⛺',
    description: 'Um acampamento avançado da Aliança entre as Cavernas e os Pântanos. Possui mercadores exilados.',
    minLevel: 15,
    environments: ['DIA', 'NOITE', 'NEVOEIRO'],
    enemyIds: [], bossIds: [],
    travelCostEnergy: 15, travelCooldownMin: 10,
    goldMultiplier: 1.0, xpMultiplier: 1.0, dropBonus: 0,
    hasDungeon: false, hasShop: true, hasCraft: true, color: 0x8E44AD, isSafeZone: true,
  },
  oasis_comercial: {
    id: 'oasis_comercial',
    name: 'Oásis Comercial',
    emoji: '🕌',
    description: 'Uma miragem que se provou real. Uma sede fortificada protegendo os mercadores do deserto.',
    minLevel: 30,
    environments: ['DIA', 'NOITE'],
    enemyIds: [], bossIds: [],
    travelCostEnergy: 25, travelCooldownMin: 15,
    goldMultiplier: 1.0, xpMultiplier: 1.0, dropBonus: 0,
    hasDungeon: false, hasShop: true, hasCraft: true, color: 0xF1C40F, isSafeZone: true,
  },
  santuario_astral: {
    id: 'santuario_astral',
    name: 'Santuário Astral',
    emoji: '🌌',
    description: 'A base final da Aliança, pairando à beira do abismo. Equipamentos lendários são forjados aqui.',
    minLevel: 45,
    environments: ['VAZIO', 'NOITE'],
    enemyIds: [], bossIds: [],
    travelCostEnergy: 40, travelCooldownMin: 30,
    goldMultiplier: 1.0, xpMultiplier: 1.0, dropBonus: 0,
    hasDungeon: false, hasShop: true, hasCraft: true, color: 0xE74C3C, isSafeZone: true,
  },

  // ⚔️ DUNGEONS E ZONAS DE COMBATE
  floresta_iniciantes: {
    id: 'floresta_iniciantes',
    name: 'Floresta dos Iniciantes',
    emoji: '🌲',
    description: 'Uma floresta tranquila com monstros fracos. Perfeita para começar sua jornada.',
    minLevel: 1, maxLevel: 10,
    environments: ['DIA', 'NOITE', 'NEVOEIRO'],
    enemyIds: ['lobo', 'goblin', 'slime', 'rato_gigante', 'fungo_venenoso'],
    bossIds: ['rei_goblin'],
    travelCostEnergy: 10, travelCooldownMin: 5,
    goldMultiplier: 0.8, xpMultiplier: 0.9, dropBonus: 5,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0x27AE60, isSafeZone: false,
  },
  ilha_da_floresta: {
    id: 'ilha_da_floresta',
    name: 'Ilha da Floresta',
    emoji: '🌴',
    description: 'Uma ilha misteriosa cercada de árvores milenares. Criaturas mágicas habitam estas terras.',
    minLevel: 5,
    environments: ['DIA', 'NOITE', 'NEVOEIRO', 'TEMPESTADE'],
    enemyIds: ['harpia', 'treant', 'elfo_das_sombras'],
    bossIds: ['guardiao_da_floresta'],
    travelCostEnergy: 20, travelCooldownMin: 10,
    goldMultiplier: 1.1, xpMultiplier: 1.1, dropBonus: 8,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0x16A085, isSafeZone: false,
  },
  cavernas_sombrias: {
    id: 'cavernas_sombrias',
    name: 'Cavernas Sombrias',
    emoji: '🕳️',
    description: 'Profundidades escuras onde criaturas noturnas dominam. Minérios raros aguardam os corajosos.',
    minLevel: 10,
    environments: ['ESCURIDAO', 'NEVOEIRO', 'NOITE'],
    enemyIds: ['morcego_vampiro', 'golem_de_pedra', 'aranha_gigante', 'morto_vivo'],
    bossIds: ['lorde_das_trevas_menor'],
    travelCostEnergy: 25, travelCooldownMin: 15,
    goldMultiplier: 1.3, xpMultiplier: 1.25, dropBonus: 12,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0x2C3E50, isSafeZone: false,
  },
  ruinas_antigas: {
    id: 'ruinas_antigas',
    name: 'Ruínas Antigas',
    emoji: '🏛️',
    description: 'Restos de uma civilização esquecida. Armadilhas e guardiões antigos protegem segredos valiosos.',
    minLevel: 15,
    environments: ['DIA', 'NEVOEIRO', 'TEMPESTADE'],
    enemyIds: ['golem_arcano'],
    bossIds: ['guardiao_ancestral'],
    travelCostEnergy: 30, travelCooldownMin: 20,
    goldMultiplier: 1.5, xpMultiplier: 1.4, dropBonus: 15,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0xD4AC0D, isSafeZone: false,
  },
  pantano_maldito: {
    id: 'pantano_maldito',
    name: 'Pântano Maldito',
    emoji: '🌫️',
    description: 'Terras corrompidas por magia negra. A névoa oculta criaturas que nunca deveriam existir.',
    minLevel: 20,
    environments: ['NEVOEIRO', 'NOITE', 'TEMPESTADE'],
    enemyIds: ['espirito_podre'],
    bossIds: ['bruxa_suprema'],
    travelCostEnergy: 35, travelCooldownMin: 25,
    goldMultiplier: 1.7, xpMultiplier: 1.6, dropBonus: 18,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0x6D4C41, isSafeZone: false,
  },
  montanhas_geladas: {
    id: 'montanhas_geladas',
    name: 'Montanhas Geladas',
    emoji: '🏔️',
    description: 'Picos cobertos de neve eterna. Dragões de gelo habitam estas alturas proibidas.',
    minLevel: 25,
    environments: ['NEVE', 'TEMPESTADE', 'NOITE'],
    enemyIds: ['dragao_de_gelo'],
    bossIds: ['dragao_anciag'],
    travelCostEnergy: 40, travelCooldownMin: 30,
    goldMultiplier: 2.0, xpMultiplier: 1.8, dropBonus: 22,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0xAED6F1, isSafeZone: false,
  },
  deserto_ardente: {
    id: 'deserto_ardente',
    name: 'Deserto Ardente',
    emoji: '🏜️',
    description: 'Um mar de areia e fogo. As temperaturas extremas filtram os fracos dos guerreiros.',
    minLevel: 30,
    environments: ['DIA', 'TEMPESTADE_DE_AREIA', 'NOITE'],
    enemyIds: ['escorpiao_gigante'],
    bossIds: ['senhor_das_areias'],
    travelCostEnergy: 40, travelCooldownMin: 30,
    goldMultiplier: 2.0, xpMultiplier: 1.9, dropBonus: 24,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0xF39C12, isSafeZone: false,
  },
  torre_do_abismo: {
    id: 'torre_do_abismo',
    name: 'Torre do Abismo',
    emoji: '🗼',
    description: 'Uma torre infinita que toca o céu e perfura o inferno. Cada andar é mais mortal que o anterior.',
    minLevel: 40,
    environments: ['ESCURIDAO', 'TEMPESTADE', 'VAZIO'],
    enemyIds: ['demonio_menor'],
    bossIds: ['arquidemonio'],
    travelCostEnergy: 50, travelCooldownMin: 45,
    goldMultiplier: 2.5, xpMultiplier: 2.2, dropBonus: 30,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0x6A1B9A, isSafeZone: false,
  },
  reino_das_sombras: {
    id: 'reino_das_sombras',
    name: 'Reino das Sombras',
    emoji: '🌑',
    description: 'O plano sombrio além da morte. Apenas os mais poderosos sobrevivem aqui.',
    minLevel: 50,
    environments: ['VAZIO', 'ESCURIDAO', 'ECLIPSE'],
    enemyIds: ['lich'],
    bossIds: ['o_rei_das_sombras'],
    travelCostEnergy: 60, travelCooldownMin: 60,
    goldMultiplier: 3.5, xpMultiplier: 3.0, dropBonus: 40,
    hasDungeon: true, hasShop: false, hasCraft: false, color: 0x1A1A2E, isSafeZone: false,
  },
};

export const LOCATION_LIST = Object.values(LOCATIONS);

export function getLocation(id: string): RpgLocation {
  return LOCATIONS[id] ?? LOCATIONS['sede_lumina'];
}

export function getCurrentEnvironment(location: RpgLocation): string {
  const hour = new Date().getHours();
  const isDaytime = hour >= 6 && hour < 20;

  if (location.isSafeZone) return isDaytime ? 'DIA' : 'NOITE';

  const envs = location.environments;
  const roll = Math.random();
  if (isDaytime && envs.includes('DIA') && roll < 0.6) return 'DIA';
  if (!isDaytime && envs.includes('NOITE') && roll < 0.5) return 'NOITE';
  if (envs.includes('NEVOEIRO') && roll < 0.2) return 'NEVOEIRO';
  if (envs.includes('TEMPESTADE') && roll < 0.15) return 'TEMPESTADE';
  return envs[0];
}

export const ENV_EMOJI: Record<string, string> = {
  DIA: '☀️ DIA',
  NOITE: '🌙 NOITE',
  NEVOEIRO: '🌫️ NEVOEIRO',
  TEMPESTADE: '⛈️ TEMPESTADE',
  NEVE: '❄️ NEVE',
  ESCURIDAO: '🕶️ ESCURIDÃO',
  VAZIO: '🌌 VAZIO',
  ECLIPSE: '🌑 ECLIPSE',
  TEMPESTADE_DE_AREIA: '🌪️ TEMPESTADE',
};
