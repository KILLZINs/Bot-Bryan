// ═══════════════════════════════════════════════════════════════════════
// LOCALIZAÇÕES RPG
// ═══════════════════════════════════════════════════════════════════════

export interface RpgLocation {
  id: string;
  name: string;
  emoji: string;
  description: string;
  minLevel: number;
  maxLevel?: number;
  environments: string[];          // DAY, NIGHT, NEVOEIRO, TEMPESTADE, etc.
  enemyIds: string[];              // inimigos que aparecem aqui
  bossIds?: string[];              // bosses específicos
  travelCostEnergy: number;        // energia gasta para viajar
  travelCooldownMin: number;       // cooldown em minutos
  goldMultiplier: number;          // multiplicador de ouro nos drops
  xpMultiplier: number;
  dropBonus: number;               // % de chance extra de drop
  hasDungeon: boolean;
  hasShop: boolean;
  hasCraft: boolean;
  color: number;
  isSafeZone: boolean;
}

export const LOCATIONS: Record<string, RpgLocation> = {

  cidade_inicial: {
    id: 'cidade_inicial',
    name: 'Cidade da Aliança',
    emoji: '🏰',
    description: 'O coração da Aliança Skyline. Local seguro para descansar, comprar e planejar aventuras.',
    minLevel: 1,
    environments: ['DIA', 'NOITE'],
    enemyIds: [],
    travelCostEnergy: 0,
    travelCooldownMin: 0,
    goldMultiplier: 1.0,
    xpMultiplier: 1.0,
    dropBonus: 0,
    hasDungeon: false,
    hasShop: true,
    hasCraft: true,
    color: 0x3498DB,
    isSafeZone: true,
  },

  floresta_iniciantes: {
    id: 'floresta_iniciantes',
    name: 'Floresta dos Iniciantes',
    emoji: '🌲',
    description: 'Uma floresta tranquila com monstros fracos. Perfeita para começar sua jornada.',
    minLevel: 1, maxLevel: 10,
    environments: ['DIA', 'NOITE', 'NEVOEIRO'],
    enemyIds: ['lobo', 'goblin', 'slime', 'rato_gigante', 'fungo_venenoso'],
    bossIds: ['rei_goblin'],
    travelCostEnergy: 10,
    travelCooldownMin: 5,
    goldMultiplier: 0.8,
    xpMultiplier: 0.9,
    dropBonus: 5,
    hasDungeon: true,
    hasShop: false,
    hasCraft: false,
    color: 0x27AE60,
    isSafeZone: false,
  },

  ilha_da_floresta: {
    id: 'ilha_da_floresta',
    name: 'Ilha da Floresta',
    emoji: '🌴',
    description: 'Uma ilha misteriosa cercada de árvores milenares. Criaturas mágicas habitam estas terras.',
    minLevel: 5,
    environments: ['DIA', 'NOITE', 'NEVOEIRO', 'TEMPESTADE'],
    enemyIds: ['harpia', 'treant', 'elfo_das_sombras', 'cobra_venenosa', 'cervo_espiritual'],
    bossIds: ['guardiao_da_floresta'],
    travelCostEnergy: 20,
    travelCooldownMin: 10,
    goldMultiplier: 1.1,
    xpMultiplier: 1.1,
    dropBonus: 8,
    hasDungeon: true,
    hasShop: false,
    hasCraft: false,
    color: 0x16A085,
    isSafeZone: false,
  },

  cavernas_sombrias: {
    id: 'cavernas_sombrias',
    name: 'Cavernas Sombrias',
    emoji: '🕳️',
    description: 'Profundidades escuras onde criaturas noturnas dominam. Minérios raros aguardam os corajosos.',
    minLevel: 10,
    environments: ['ESCURIDAO', 'NEVOEIRO', 'NOITE'],
    enemyIds: ['morcego_vampiro', 'toupeira_gigante', 'golem_de_pedra', 'aranha_gigante', 'morto_vivo'],
    bossIds: ['lorde_das_trevas_menor'],
    travelCostEnergy: 25,
    travelCooldownMin: 15,
    goldMultiplier: 1.3,
    xpMultiplier: 1.25,
    dropBonus: 12,
    hasDungeon: true,
    hasShop: false,
    hasCraft: true,
    color: 0x2C3E50,
    isSafeZone: false,
  },

  ruinas_antigas: {
    id: 'ruinas_antigas',
    name: 'Ruínas Antigas',
    emoji: '🏛️',
    description: 'Restos de uma civilização esquecida. Armadilhas e guardiões antigos protegem segredos valiosos.',
    minLevel: 15,
    environments: ['DIA', 'NEVOEIRO', 'TEMPESTADE'],
    enemyIds: ['golem_arcano', 'esqueleto_guerreiro', 'fantasma_antigo', 'construto_magico', 'mumia'],
    bossIds: ['guardiao_ancestral'],
    travelCostEnergy: 30,
    travelCooldownMin: 20,
    goldMultiplier: 1.5,
    xpMultiplier: 1.4,
    dropBonus: 15,
    hasDungeon: true,
    hasShop: true,
    hasCraft: false,
    color: 0xD4AC0D,
    isSafeZone: false,
  },

  pantano_maldito: {
    id: 'pantano_maldito',
    name: 'Pântano Maldito',
    emoji: '🌫️',
    description: 'Terras corrompidas por magia negra. A névoa oculta criaturas que nunca deveriam existir.',
    minLevel: 20,
    environments: ['NEVOEIRO', 'NOITE', 'TEMPESTADE'],
    enemyIds: ['bruxa', 'hidra', 'zumbi_antigo', 'lagarto_venenoso', 'espirito_podre'],
    bossIds: ['a_bruxa_suprema'],
    travelCostEnergy: 35,
    travelCooldownMin: 25,
    goldMultiplier: 1.7,
    xpMultiplier: 1.6,
    dropBonus: 18,
    hasDungeon: true,
    hasShop: false,
    hasCraft: true,
    color: 0x6D4C41,
    isSafeZone: false,
  },

  montanhas_geladas: {
    id: 'montanhas_geladas',
    name: 'Montanhas Geladas',
    emoji: '🏔️',
    description: 'Picos cobertos de neve eterna. Dragões de gelo e gigantes habitam estas alturas proibidas.',
    minLevel: 25,
    environments: ['NEVE', 'TEMPESTADE', 'NOITE'],
    enemyIds: ['dragao_de_gelo', 'gigante_de_pedra', 'yeti', 'grifo', 'elemental_de_gelo'],
    bossIds: ['dragao_anciag'],
    travelCostEnergy: 40,
    travelCooldownMin: 30,
    goldMultiplier: 2.0,
    xpMultiplier: 1.8,
    dropBonus: 22,
    hasDungeon: true,
    hasShop: false,
    hasCraft: false,
    color: 0xAED6F1,
    isSafeZone: false,
  },

  deserto_ardente: {
    id: 'deserto_ardente',
    name: 'Deserto Ardente',
    emoji: '🏜️',
    description: 'Um mar de areia e fogo. As temperaturas extremas filtram os fracos dos verdadeiros guerreiros.',
    minLevel: 30,
    environments: ['DIA', 'TEMPESTADE_DE_AREIA', 'NOITE'],
    enemyIds: ['escorpiao_gigante', 'elemental_de_fogo', 'cobra_de_fogo', 'farao_maldito', 'djinn'],
    bossIds: ['senhor_das_areias'],
    travelCostEnergy: 40,
    travelCooldownMin: 30,
    goldMultiplier: 2.0,
    xpMultiplier: 1.9,
    dropBonus: 24,
    hasDungeon: true,
    hasShop: true,
    hasCraft: true,
    color: 0xF39C12,
    isSafeZone: false,
  },

  torre_do_abismo: {
    id: 'torre_do_abismo',
    name: 'Torre do Abismo',
    emoji: '🗼',
    description: 'Uma torre infinita que toca o céu e perfura o inferno. Cada andar é mais mortal que o anterior.',
    minLevel: 40,
    environments: ['ESCURIDAO', 'TEMPESTADE', 'VAZIO'],
    enemyIds: ['demonio_menor', 'anjo_caido', 'horror_abissal', 'sombra_viva', 'senhor_do_caos'],
    bossIds: ['arquidemonio', 'anjo_da_morte'],
    travelCostEnergy: 50,
    travelCooldownMin: 45,
    goldMultiplier: 2.5,
    xpMultiplier: 2.2,
    dropBonus: 30,
    hasDungeon: true,
    hasShop: false,
    hasCraft: false,
    color: 0x6A1B9A,
    isSafeZone: false,
  },

  reino_das_sombras: {
    id: 'reino_das_sombras',
    name: 'Reino das Sombras',
    emoji: '🌑',
    description: 'O plano sombrio além da morte. Apenas os mais poderosos sobrevivem aqui.',
    minLevel: 50,
    environments: ['VAZIO', 'ESCURIDAO', 'ECLIPSE'],
    enemyIds: ['lich', 'rei_sombra', 'necromante_supremo', 'kraken_das_sombras', 'deus_menor'],
    bossIds: ['o_rei_das_sombras'],
    travelCostEnergy: 60,
    travelCooldownMin: 60,
    goldMultiplier: 3.5,
    xpMultiplier: 3.0,
    dropBonus: 40,
    hasDungeon: true,
    hasShop: false,
    hasCraft: true,
    color: 0x1A1A2E,
    isSafeZone: false,
  },
};

export const LOCATION_LIST = Object.values(LOCATIONS);

export function getLocation(id: string): RpgLocation {
  return LOCATIONS[id] ?? LOCATIONS['cidade_inicial'];
}

/** Ambientes possíveis por hora do dia */
export function getCurrentEnvironment(location: RpgLocation): string {
  const hour = new Date().getHours();
  const isDaytime = hour >= 6 && hour < 20;

  if (location.isSafeZone) return isDaytime ? 'DIA' : 'NOITE';

  const envs = location.environments;
  // Pega um aleatório com peso: ambientes de dia predominam durante o dia
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
