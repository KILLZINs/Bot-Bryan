// ═══════════════════════════════════════════════════════════════════════
// CLASSES RPG — 16 classes jogáveis
// ═══════════════════════════════════════════════════════════════════════

export interface ClassStats {
  str: number; // FOR — Força
  agi: number; // AGI — Agilidade
  int: number; // INT — Inteligência
  vit: number; // VIT — Vitalidade
  lck: number; // SOR — Sorte
}

export interface RpgClass {
  id: string;
  name: string;
  emoji: string;
  description: string;
  lore: string;
  baseStats: ClassStats;
  statGrowthPerLevel: ClassStats;
  baseHp: number;
  hpPerVit: number;
  baseEnergy: number;
  energyPerLevel: number;
  primaryStat: keyof ClassStats;
  weaponTypes: string[];
  divineSkills: string[];   // IDs de habilidades divinas desbloqueáveis
  color: number;
  rarity: 'Comum' | 'Incomum' | 'Raro' | 'Épico' | 'Lendário';
  tier: 1 | 2 | 3;         // 1=básica, 2=avançada, 3=lendária
  evolveFrom?: string;      // ID da classe anterior
}

export const CLASSES: Record<string, RpgClass> = {

  // ─── TIER 1 — Classes Básicas ──────────────────────────────────────────────

  guerreiro: {
    id: 'guerreiro',
    name: 'Guerreiro',
    emoji: '⚔️',
    description: 'Mestre do combate corpo-a-corpo, resistente e poderoso.',
    lore: 'Forjado nas batalhas mais sangrentas da aliança, o Guerreiro é o escudo e a espada de seus companheiros.',
    baseStats: { str: 15, agi: 8,  int: 5,  vit: 14, lck: 8 },
    statGrowthPerLevel: { str: 3, agi: 1, int: 0, vit: 3, lck: 1 },
    baseHp: 120, hpPerVit: 12, baseEnergy: 80, energyPerLevel: 3,
    primaryStat: 'str',
    weaponTypes: ['espada', 'machado', 'martelo', 'lança', 'escudo'],
    divineSkills: ['golpe_divino', 'muralha_de_ferro', 'berserk'],
    color: 0xE74C3C,
    rarity: 'Comum', tier: 1,
  },

  mago: {
    id: 'mago',
    name: 'Mago',
    emoji: '🧙',
    description: 'Manipula as forças arcanas com precisão devastadora.',
    lore: 'Estudou décadas em torres proibidas, dominando feitiços capazes de rasgar a realidade.',
    baseStats: { str: 4,  agi: 7,  int: 18, vit: 6,  lck: 10 },
    statGrowthPerLevel: { str: 0, agi: 1, int: 4, vit: 1, lck: 2 },
    baseHp: 70, hpPerVit: 8, baseEnergy: 130, energyPerLevel: 8,
    primaryStat: 'int',
    weaponTypes: ['cajado', 'varinha', 'tomo', 'orbe'],
    divineSkills: ['meteorito_arcano', 'campo_de_forca', 'transcendencia_magica'],
    color: 0x9B59B6,
    rarity: 'Comum', tier: 1,
  },

  assassino: {
    id: 'assassino',
    name: 'Assassino',
    emoji: '🗡️',
    description: 'Velocidade letal e precisão cirúrgica no ataque.',
    lore: 'Nas sombras da aliança, o Assassino age onde nenhum outro ousa — silencioso, mortal e invisível.',
    baseStats: { str: 10, agi: 18, int: 7,  vit: 7,  lck: 14 },
    statGrowthPerLevel: { str: 2, agi: 4, int: 1, vit: 1, lck: 2 },
    baseHp: 80, hpPerVit: 9, baseEnergy: 100, energyPerLevel: 5,
    primaryStat: 'agi',
    weaponTypes: ['adaga', 'kunai', 'espada_curta', 'veneno'],
    divineSkills: ['toque_de_ouro', 'golpe_fatal', 'sombra_gemea'],
    color: 0x2C3E50,
    rarity: 'Comum', tier: 1,
  },

  arqueiro: {
    id: 'arqueiro',
    name: 'Arqueiro',
    emoji: '🏹',
    description: 'Atira com precisão incrível de qualquer distância.',
    lore: 'Cresceu nas florestas da aliança, onde cada tiro conta e cada flecha é sagrada.',
    baseStats: { str: 9,  agi: 15, int: 8,  vit: 8,  lck: 15 },
    statGrowthPerLevel: { str: 1, agi: 3, int: 1, vit: 2, lck: 3 },
    baseHp: 85, hpPerVit: 10, baseEnergy: 95, energyPerLevel: 4,
    primaryStat: 'agi',
    weaponTypes: ['arco', 'besta', 'flechas_especiais'],
    divineSkills: ['flecha_divina', 'chuva_de_flechas', 'olho_de_aguia'],
    color: 0x27AE60,
    rarity: 'Comum', tier: 1,
  },

  sacerdote: {
    id: 'sacerdote',
    name: 'Sacerdote',
    emoji: '✨',
    description: 'Canal da luz divina, cura aliados e purifica o mal.',
    lore: 'Abençoado pelos deuses da aliança, o Sacerdote transforma fé em poder de cura e proteção.',
    baseStats: { str: 5,  agi: 7,  int: 16, vit: 10, lck: 12 },
    statGrowthPerLevel: { str: 0, agi: 1, int: 4, vit: 2, lck: 2 },
    baseHp: 90, hpPerVit: 11, baseEnergy: 120, energyPerLevel: 7,
    primaryStat: 'int',
    weaponTypes: ['cajado', 'maça_sagrada', 'livro_sagrado', 'escudo_sagrado'],
    divineSkills: ['bencao_divina', 'ressurreicao', 'juizo_sagrado'],
    color: 0xF1C40F,
    rarity: 'Comum', tier: 1,
  },

  ladrao: {
    id: 'ladrao',
    name: 'Ladrão',
    emoji: '💰',
    description: 'Especialista em roubar e acumular riquezas com sorte absurda.',
    lore: 'As ruelas da aliança o criaram: esperto, rápido e sempre em busca do próximo tesouro.',
    baseStats: { str: 8,  agi: 14, int: 9,  vit: 7,  lck: 20 },
    statGrowthPerLevel: { str: 1, agi: 2, int: 1, vit: 1, lck: 5 },
    baseHp: 75, hpPerVit: 8, baseEnergy: 105, energyPerLevel: 5,
    primaryStat: 'lck',
    weaponTypes: ['adaga', 'estilingue', 'bomba_de_fumaca', 'gancho'],
    divineSkills: ['golpe_de_sorte', 'roubar', 'tesouro_oculto'],
    color: 0xE67E22,
    rarity: 'Comum', tier: 1,
  },

  monge: {
    id: 'monge',
    name: 'Monge',
    emoji: '🥋',
    description: 'Domina o combate sem armas através da disciplina espiritual.',
    lore: 'Décadas de meditação e treino transormaram seu corpo em uma arma viva da aliança.',
    baseStats: { str: 12, agi: 13, int: 10, vit: 12, lck: 8 },
    statGrowthPerLevel: { str: 2, agi: 3, int: 2, vit: 2, lck: 1 },
    baseHp: 100, hpPerVit: 11, baseEnergy: 110, energyPerLevel: 6,
    primaryStat: 'agi',
    weaponTypes: ['punhos', 'bastao', 'nunchaku', 'anel_espiritual'],
    divineSkills: ['palmada_trovejante', 'meditacao_combativa', 'sete_golpes'],
    color: 0xF39C12,
    rarity: 'Comum', tier: 1,
  },

  // ─── TIER 2 — Classes Avançadas ───────────────────────────────────────────

  paladino: {
    id: 'paladino',
    name: 'Paladino',
    emoji: '🛡️',
    description: 'Guerreiro sagrado que combina força bruta com poder divino.',
    lore: 'Escolhidos pelos deuses da aliança para ser guardiões da justiça — poderosos em combate e na fé.',
    baseStats: { str: 14, agi: 7,  int: 12, vit: 16, lck: 9 },
    statGrowthPerLevel: { str: 3, agi: 1, int: 2, vit: 3, lck: 1 },
    baseHp: 130, hpPerVit: 14, baseEnergy: 100, energyPerLevel: 5,
    primaryStat: 'str',
    weaponTypes: ['espadao', 'martelo_sagrado', 'escudo_sagrado', 'lança_sagrada'],
    divineSkills: ['protecao_sagrada', 'smite_divino', 'aura_de_luz'],
    color: 0x3498DB,
    rarity: 'Incomum', tier: 2, evolveFrom: 'guerreiro',
  },

  necromante: {
    id: 'necromante',
    name: 'Necromante',
    emoji: '💀',
    description: 'Domina a morte, invoca mortos-vivos e drena vida dos inimigos.',
    lore: 'Banido e temido em toda a aliança — o Necromante faz pactos com a morte que nenhum outro ousa.',
    baseStats: { str: 5,  agi: 6,  int: 20, vit: 8,  lck: 11 },
    statGrowthPerLevel: { str: 0, agi: 1, int: 5, vit: 1, lck: 2 },
    baseHp: 75, hpPerVit: 8, baseEnergy: 140, energyPerLevel: 9,
    primaryStat: 'int',
    weaponTypes: ['foice', 'cajado_osseo', 'grimoire_maldito', 'orbe_da_morte'],
    divineSkills: ['exercito_morto_vivo', 'drenagem_vital', 'lich_mode'],
    color: 0x1A1A2E,
    rarity: 'Raro', tier: 2, evolveFrom: 'mago',
  },

  druida: {
    id: 'druida',
    name: 'Druida',
    emoji: '🌿',
    description: 'Se transforma em animais e controla as forças da natureza.',
    lore: 'Guardião das florestas sagradas da aliança, o Druida fala com a natureza e ela obedece.',
    baseStats: { str: 9,  agi: 11, int: 13, vit: 12, lck: 10 },
    statGrowthPerLevel: { str: 1, agi: 2, int: 3, vit: 2, lck: 2 },
    baseHp: 100, hpPerVit: 12, baseEnergy: 115, energyPerLevel: 6,
    primaryStat: 'int',
    weaponTypes: ['bordao', 'cajado_natural', 'garra_animal', 'totem'],
    divineSkills: ['forma_bestial', 'raiz_ancestral', 'tempestade_natural'],
    color: 0x2ECC71,
    rarity: 'Incomum', tier: 2, evolveFrom: 'arqueiro',
  },

  bardo: {
    id: 'bardo',
    name: 'Bardo',
    emoji: '🎵',
    description: 'Músico místico que enfraquece inimigos e fortalece aliados com melodias.',
    lore: 'Suas canções ecoam pelos campos de batalha da aliança — inspirando heróis e quebrando a vontade dos inimigos.',
    baseStats: { str: 7,  agi: 12, int: 14, vit: 8,  lck: 16 },
    statGrowthPerLevel: { str: 1, agi: 2, int: 3, vit: 1, lck: 3 },
    baseHp: 80, hpPerVit: 9, baseEnergy: 120, energyPerLevel: 7,
    primaryStat: 'int',
    weaponTypes: ['alaude', 'flauta_magica', 'tamborim_de_guerra', 'voz'],
    divineSkills: ['cancao_de_batalha', 'melodia_maldita', 'sinfonia_divina'],
    color: 0xE91E63,
    rarity: 'Incomum', tier: 2, evolveFrom: 'sacerdote',
  },

  xama: {
    id: 'xama',
    name: 'Xamã',
    emoji: '🔮',
    description: 'Comunica-se com espíritos e invoca totens de poder elemental.',
    lore: 'Nos rituais mais antigos da aliança, o Xamã serve de ponte entre o mundo dos vivos e o dos espíritos.',
    baseStats: { str: 8,  agi: 9,  int: 16, vit: 11, lck: 13 },
    statGrowthPerLevel: { str: 1, agi: 1, int: 4, vit: 2, lck: 2 },
    baseHp: 90, hpPerVit: 10, baseEnergy: 125, energyPerLevel: 7,
    primaryStat: 'int',
    weaponTypes: ['totem', 'lanca_espiritual', 'escudo_de_fogo', 'mascara_ritual'],
    divineSkills: ['totem_ancestral', 'possessao_espiritual', 'tempestade_elemental'],
    color: 0xFF5722,
    rarity: 'Raro', tier: 2, evolveFrom: 'monge',
  },

  cacador: {
    id: 'cacador',
    name: 'Caçador',
    emoji: '🐺',
    description: 'Rastreia presas e luta ao lado de um companheiro animal fiel.',
    lore: 'Nas terras selvagens da aliança, o Caçador aprendeu que a melhor arma é conhecer o inimigo.',
    baseStats: { str: 11, agi: 16, int: 9,  vit: 10, lck: 12 },
    statGrowthPerLevel: { str: 2, agi: 3, int: 1, vit: 2, lck: 2 },
    baseHp: 95, hpPerVit: 10, baseEnergy: 100, energyPerLevel: 5,
    primaryStat: 'agi',
    weaponTypes: ['arco_longo', 'faca_de_caca', 'armadilha', 'companheiro_animal'],
    divineSkills: ['instinto_predador', 'companheiro_divino', 'cacada_infernal'],
    color: 0x795548,
    rarity: 'Incomum', tier: 2, evolveFrom: 'arqueiro',
  },

  // ─── TIER 3 — Classes Lendárias ───────────────────────────────────────────

  cavaleiro_das_trevas: {
    id: 'cavaleiro_das_trevas',
    name: 'Cavaleiro das Trevas',
    emoji: '🖤',
    description: 'Guerreiro corrompido pela escuridão — entre a morte e o poder absoluto.',
    lore: 'O Cavaleiro das Trevas vendeu sua alma nas profundezas da aliança em troca de um poder que faz deuses tremerem.',
    baseStats: { str: 20, agi: 10, int: 14, vit: 18, lck: 8 },
    statGrowthPerLevel: { str: 4, agi: 2, int: 3, vit: 4, lck: 1 },
    baseHp: 150, hpPerVit: 16, baseEnergy: 110, energyPerLevel: 6,
    primaryStat: 'str',
    weaponTypes: ['espada_das_trevas', 'foice_sombria', 'escudo_corrompido', 'lança_da_morte'],
    divineSkills: ['presenca_das_trevas', 'golpe_da_morte', 'ressurreicao_negra'],
    color: 0x212121,
    rarity: 'Lendário', tier: 3, evolveFrom: 'paladino',
  },

  feiticeiro: {
    id: 'feiticeiro',
    name: 'Feiticeiro',
    emoji: '🌌',
    description: 'Canaliza energias cósmicas proibidas para destruição em massa.',
    lore: 'Poucos alcançam esse nível de maestria arcana na aliança — e os que chegam, não voltam os mesmos.',
    baseStats: { str: 4,  agi: 8,  int: 25, vit: 7,  lck: 14 },
    statGrowthPerLevel: { str: 0, agi: 1, int: 6, vit: 1, lck: 3 },
    baseHp: 70, hpPerVit: 7, baseEnergy: 160, energyPerLevel: 12,
    primaryStat: 'int',
    weaponTypes: ['cajado_cosmico', 'orbe_proibido', 'grimoire_ancestral', 'cristal_de_poder'],
    divineSkills: ['singularidade', 'colapso_dimensional', 'omega_arcano'],
    color: 0x6A1B9A,
    rarity: 'Lendário', tier: 3, evolveFrom: 'necromante',
  },

  invocador: {
    id: 'invocador',
    name: 'Invocador',
    emoji: '🐉',
    description: 'Convoca criaturas lendárias e dragões para lutar ao seu lado.',
    lore: 'O contrato mais antigo da aliança — o Invocador não luta sozinho: um dragão sempre está ao seu lado.',
    baseStats: { str: 10, agi: 10, int: 18, vit: 12, lck: 16 },
    statGrowthPerLevel: { str: 2, agi: 2, int: 4, vit: 2, lck: 3 },
    baseHp: 100, hpPerVit: 11, baseEnergy: 145, energyPerLevel: 9,
    primaryStat: 'int',
    weaponTypes: ['grimoire_de_invocacao', 'cajado_dos_pactos', 'cristal_de_invocacao'],
    divineSkills: ['dragao_supremo', 'exercito_lendario', 'pacto_divino'],
    color: 0xE040FB,
    rarity: 'Lendário', tier: 3, evolveFrom: 'druida',
  },
};

export const CLASS_LIST = Object.values(CLASSES);
export const TIER1_CLASSES = CLASS_LIST.filter(c => c.tier === 1);
export const TIER2_CLASSES = CLASS_LIST.filter(c => c.tier === 2);
export const TIER3_CLASSES = CLASS_LIST.filter(c => c.tier === 3);

export function getClass(id: string): RpgClass | undefined {
  return CLASSES[id];
}

/** Calcula stats totais do personagem com base no nível */
export function calcLevelStats(cls: RpgClass, level: number): ClassStats {
  return {
    str: cls.baseStats.str + cls.statGrowthPerLevel.str * (level - 1),
    agi: cls.baseStats.agi + cls.statGrowthPerLevel.agi * (level - 1),
    int: cls.baseStats.int + cls.statGrowthPerLevel.int * (level - 1),
    vit: cls.baseStats.vit + cls.statGrowthPerLevel.vit * (level - 1),
    lck: cls.baseStats.lck + cls.statGrowthPerLevel.lck * (level - 1),
  };
}

/** XP necessário para subir para o próximo nível (RPG) — escala exponencial dura */
export function rpgXpForLevel(level: number): number {
  // Nível 1: 150 | Nível 5: ~530 | Nível 10: ~2140 | Nível 20: ~24000 | Nível 30: ~110000
  return Math.floor(150 * Math.pow(1.30, level - 1));
}

/** Karma → alinhamento */
export function karmaLabel(karma: number): string {
  if (karma >= 80)  return 'Sagrado ☀️';
  if (karma >= 40)  return 'Bondoso 💚';
  if (karma >= 10)  return 'Neutro ⚖️';
  if (karma >= -10) return 'Neutro ⚖️';
  if (karma >= -40) return 'Sombrio 🌑';
  if (karma >= -80) return 'Maligno 🔴';
  return 'Caótico 💀';
}

/** Poder de combate calculado */
export function calcCombatPower(
  stats: ClassStats,
  level: number,
  equipBonus: number = 0,
): number {
  const base = (stats.str * 3.2) + (stats.agi * 2.8) + (stats.int * 2.8) + (stats.vit * 2.5) + (stats.lck * 1.5);
  return Math.floor(base * (1 + level * 0.05) + equipBonus);
}

/** Ataque base */
export function calcAttack(stats: ClassStats, primary: keyof ClassStats): number {
  const mainStat = stats[primary];
  return Math.floor(mainStat * 1.5 + stats.str * 0.5);
}

/** Defesa base */
export function calcDefense(vit: number, equipDefense: number = 0): number {
  return Math.floor(vit * 2 + equipDefense);
}

/** Crítico % */
export function calcCritChance(agi: number, lck: number): number {
  return Math.min(75, ((agi * 0.3) + (lck * 0.4)));
}

/** Esquiva % */
export function calcDodge(agi: number, lck: number): number {
  return Math.min(60, ((agi * 0.25) + (lck * 0.2)));
}
