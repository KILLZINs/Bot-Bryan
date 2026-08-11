// ═══════════════════════════════════════════════════════════════════════
// HABILIDADES DIVINAS
// ═══════════════════════════════════════════════════════════════════════

export type SkillRank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
export type SkillType = 'ataque' | 'defesa' | 'suporte' | 'passiva' | 'ultimate';

export interface DivineSkill {
  id: string;
  name: string;
  emoji: string;
  description: string;
  type: SkillType;
  classIds: string[];        // quais classes podem ter
  energyCost: number;
  cooldownRounds: number;
  baseEffect: number;        // valor base do efeito (dano, cura, etc.)
  rankMultiplier: number;    // multiplicador por rank
  rankUpExpRequired: number; // XP necessário para avançar de rank
  unlockLevel: number;
  passive?: {
    goldBonus?: number;      // % bonus de ouro
    xpBonus?: number;        // % bonus de XP
    critBonus?: number;
    dodgeBonus?: number;
    damageBonus?: number;
    defenseBonus?: number;
  };
}

export const DIVINE_SKILLS: Record<string, DivineSkill> = {

  // ─── Guerreiro ─────────────────────────────────────────────────────────────
  golpe_divino: {
    id: 'golpe_divino', name: 'Golpe Divino', emoji: '⚡',
    description: 'Concentra toda força em um golpe devastador.',
    type: 'ataque', classIds: ['guerreiro', 'paladino', 'cavaleiro_das_trevas'],
    energyCost: 30, cooldownRounds: 2, baseEffect: 2.5, rankMultiplier: 0.3,
    rankUpExpRequired: 500, unlockLevel: 5,
  },
  muralha_de_ferro: {
    id: 'muralha_de_ferro', name: 'Muralha de Ferro', emoji: '🛡️',
    description: 'Cria uma barreira de energia que reduz 50% do dano por 2 turnos.',
    type: 'defesa', classIds: ['guerreiro', 'paladino'],
    energyCost: 25, cooldownRounds: 4, baseEffect: 50, rankMultiplier: 0.1,
    rankUpExpRequired: 600, unlockLevel: 8,
  },
  berserk: {
    id: 'berserk', name: 'Berserk', emoji: '🔥',
    description: 'Entra em fúria: +80% de ataque, -30% de defesa por 3 turnos.',
    type: 'suporte', classIds: ['guerreiro', 'cavaleiro_das_trevas'],
    energyCost: 40, cooldownRounds: 6, baseEffect: 80, rankMultiplier: 0.2,
    rankUpExpRequired: 700, unlockLevel: 12,
  },

  // ─── Mago ──────────────────────────────────────────────────────────────────
  meteorito_arcano: {
    id: 'meteorito_arcano', name: 'Meteorito Arcano', emoji: '☄️',
    description: 'Invoca um meteorito de energia pura que causa dano maciço.',
    type: 'ataque', classIds: ['mago', 'feiticeiro'],
    energyCost: 50, cooldownRounds: 3, baseEffect: 3.5, rankMultiplier: 0.4,
    rankUpExpRequired: 600, unlockLevel: 8,
  },
  campo_de_forca: {
    id: 'campo_de_forca', name: 'Campo de Força', emoji: '🔵',
    description: 'Cria um escudo mágico que absorve dano baseado em INT.',
    type: 'defesa', classIds: ['mago', 'feiticeiro', 'necromante'],
    energyCost: 35, cooldownRounds: 4, baseEffect: 1.5, rankMultiplier: 0.25,
    rankUpExpRequired: 550, unlockLevel: 6,
  },
  transcendencia_magica: {
    id: 'transcendencia_magica', name: 'Transcendência Mágica', emoji: '🌌',
    description: 'Por 3 turnos, todas as magias ignoram 50% da resistência do inimigo.',
    type: 'suporte', classIds: ['mago', 'feiticeiro'],
    energyCost: 60, cooldownRounds: 8, baseEffect: 50, rankMultiplier: 0.1,
    rankUpExpRequired: 900, unlockLevel: 20,
  },

  // ─── Assassino ─────────────────────────────────────────────────────────────
  toque_de_ouro: {
    id: 'toque_de_ouro', name: 'Toque de Ouro', emoji: '💰',
    description: 'Ganha bônus de ouro dos monstros baseado em SOR.',
    type: 'passiva', classIds: ['assassino', 'ladrao'],
    energyCost: 0, cooldownRounds: 0, baseEffect: 10, rankMultiplier: 0.1,
    rankUpExpRequired: 400, unlockLevel: 1,
    passive: { goldBonus: 10 },
  },
  golpe_fatal: {
    id: 'golpe_fatal', name: 'Golpe Fatal', emoji: '💀',
    description: 'Ataque que causa dano baseado em AGI com chance de matar instantaneamente.',
    type: 'ataque', classIds: ['assassino', 'ladrao', 'cacador'],
    energyCost: 40, cooldownRounds: 4, baseEffect: 2.8, rankMultiplier: 0.35,
    rankUpExpRequired: 650, unlockLevel: 10,
  },
  sombra_gemea: {
    id: 'sombra_gemea', name: 'Sombra Gêmea', emoji: '👥',
    description: 'Cria uma cópia sombria que ataca junto por 3 turnos.',
    type: 'suporte', classIds: ['assassino'],
    energyCost: 55, cooldownRounds: 7, baseEffect: 0.6, rankMultiplier: 0.1,
    rankUpExpRequired: 800, unlockLevel: 18,
  },

  // ─── Arqueiro ──────────────────────────────────────────────────────────────
  flecha_divina: {
    id: 'flecha_divina', name: 'Flecha Divina', emoji: '✨',
    description: 'Dispara uma flecha imbuída de luz divina. Nunca erra.',
    type: 'ataque', classIds: ['arqueiro', 'cacador'],
    energyCost: 35, cooldownRounds: 2, baseEffect: 2.2, rankMultiplier: 0.3,
    rankUpExpRequired: 500, unlockLevel: 5,
  },
  chuva_de_flechas: {
    id: 'chuva_de_flechas', name: 'Chuva de Flechas', emoji: '🌧️',
    description: 'Dispara 8 flechas de uma vez. Cada uma causa 60% do dano base.',
    type: 'ataque', classIds: ['arqueiro', 'cacador'],
    energyCost: 60, cooldownRounds: 5, baseEffect: 0.6, rankMultiplier: 0.08,
    rankUpExpRequired: 750, unlockLevel: 15,
  },
  olho_de_aguia: {
    id: 'olho_de_aguia', name: 'Olho de Águia', emoji: '🦅',
    description: 'Foco extremo: próximo ataque tem 100% de crítico.',
    type: 'suporte', classIds: ['arqueiro', 'cacador'],
    energyCost: 20, cooldownRounds: 3, baseEffect: 100, rankMultiplier: 0,
    rankUpExpRequired: 450, unlockLevel: 7,
  },

  // ─── Sacerdote ─────────────────────────────────────────────────────────────
  bencao_divina: {
    id: 'bencao_divina', name: 'Bênção Divina', emoji: '✨',
    description: 'Cura HP baseado em INT e aumenta defesa.',
    type: 'suporte', classIds: ['sacerdote', 'paladino', 'bardo'],
    energyCost: 30, cooldownRounds: 2, baseEffect: 2.0, rankMultiplier: 0.25,
    rankUpExpRequired: 500, unlockLevel: 1,
  },
  ressurreicao: {
    id: 'ressurreicao', name: 'Ressurreição', emoji: '💫',
    description: 'Se morrer na dungeon, ressuscita com 50% do HP. Somente 1x.',
    type: 'passiva', classIds: ['sacerdote'],
    energyCost: 0, cooldownRounds: 0, baseEffect: 50, rankMultiplier: 0.05,
    rankUpExpRequired: 1000, unlockLevel: 20,
    passive: { defenseBonus: 5 },
  },
  juizo_sagrado: {
    id: 'juizo_sagrado', name: 'Juízo Sagrado', emoji: '⚡',
    description: 'Raio sagrado que causa dano extra contra inimigos com karma negativo.',
    type: 'ataque', classIds: ['sacerdote', 'paladino'],
    energyCost: 45, cooldownRounds: 3, baseEffect: 2.5, rankMultiplier: 0.3,
    rankUpExpRequired: 650, unlockLevel: 12,
  },

  // ─── Ladrão ────────────────────────────────────────────────────────────────
  golpe_de_sorte: {
    id: 'golpe_de_sorte', name: 'Golpe de Sorte', emoji: '🍀',
    description: 'Ataque com dano aleatório entre 50% e 300% baseado em SOR.',
    type: 'ataque', classIds: ['ladrao'],
    energyCost: 25, cooldownRounds: 2, baseEffect: 1.5, rankMultiplier: 0.3,
    rankUpExpRequired: 400, unlockLevel: 3,
  },
  roubar: {
    id: 'roubar', name: 'Roubar', emoji: '💰',
    description: 'Rouba ouro do inimigo baseado em SOR. Falha em bosses.',
    type: 'ataque', classIds: ['ladrao'],
    energyCost: 15, cooldownRounds: 3, baseEffect: 1.0, rankMultiplier: 0.2,
    rankUpExpRequired: 350, unlockLevel: 1,
    passive: { goldBonus: 15 },
  },
  tesouro_oculto: {
    id: 'tesouro_oculto', name: 'Tesouro Oculto', emoji: '🏆',
    description: 'Passiva: chance de encontrar tesouro bônus após batalhas.',
    type: 'passiva', classIds: ['ladrao'],
    energyCost: 0, cooldownRounds: 0, baseEffect: 15, rankMultiplier: 0.05,
    rankUpExpRequired: 500, unlockLevel: 5,
    passive: { goldBonus: 20, xpBonus: 5 },
  },

  // ─── Monge ─────────────────────────────────────────────────────────────────
  palmada_trovejante: {
    id: 'palmada_trovejante', name: 'Palmada Trovejante', emoji: '⚡',
    description: 'Soco com energia espiritual que causa dano e atordoa.',
    type: 'ataque', classIds: ['monge'],
    energyCost: 30, cooldownRounds: 2, baseEffect: 2.0, rankMultiplier: 0.25,
    rankUpExpRequired: 500, unlockLevel: 5,
  },
  meditacao_combativa: {
    id: 'meditacao_combativa', name: 'Meditação Combativa', emoji: '🧘',
    description: 'Regenera HP e energia por 3 turnos enquanto mantém combate.',
    type: 'suporte', classIds: ['monge', 'druida'],
    energyCost: 20, cooldownRounds: 5, baseEffect: 0.15, rankMultiplier: 0.03,
    rankUpExpRequired: 550, unlockLevel: 8,
  },
  sete_golpes: {
    id: 'sete_golpes', name: 'Sete Golpes Sagrados', emoji: '✊',
    description: 'Sete golpes rápidos que causam dano crescente.',
    type: 'ataque', classIds: ['monge'],
    energyCost: 50, cooldownRounds: 4, baseEffect: 0.7, rankMultiplier: 0.1,
    rankUpExpRequired: 700, unlockLevel: 15,
  },

  // ─── Classes Avançadas ─────────────────────────────────────────────────────
  protecao_sagrada: {
    id: 'protecao_sagrada', name: 'Proteção Sagrada', emoji: '🌟',
    description: 'Aura que reduz todo dano em 40% por 4 turnos.',
    type: 'defesa', classIds: ['paladino'],
    energyCost: 45, cooldownRounds: 6, baseEffect: 40, rankMultiplier: 0.1,
    rankUpExpRequired: 800, unlockLevel: 15,
  },
  smite_divino: {
    id: 'smite_divino', name: 'Smite Divino', emoji: '⚔️',
    description: 'Golpe imbuído com luz que causa 3x dano a mortos-vivos e demônios.',
    type: 'ataque', classIds: ['paladino'],
    energyCost: 40, cooldownRounds: 3, baseEffect: 3.0, rankMultiplier: 0.3,
    rankUpExpRequired: 700, unlockLevel: 10,
  },
  aura_de_luz: {
    id: 'aura_de_luz', name: 'Aura de Luz', emoji: '☀️',
    description: 'Passiva: aumenta crítico e reduz dano recebido constantemente.',
    type: 'passiva', classIds: ['paladino'],
    energyCost: 0, cooldownRounds: 0, baseEffect: 15, rankMultiplier: 0.05,
    rankUpExpRequired: 600, unlockLevel: 5,
    passive: { critBonus: 10, defenseBonus: 15 },
  },
  exercito_morto_vivo: {
    id: 'exercito_morto_vivo', name: 'Exército Morto-Vivo', emoji: '💀',
    description: 'Invoca 3 mortos-vivos que atacam por você por 3 turnos.',
    type: 'suporte', classIds: ['necromante'],
    energyCost: 70, cooldownRounds: 7, baseEffect: 0.5, rankMultiplier: 0.1,
    rankUpExpRequired: 900, unlockLevel: 18,
  },
  drenagem_vital: {
    id: 'drenagem_vital', name: 'Drenagem Vital', emoji: '🩸',
    description: 'Drena HP do inimigo, curando o Necromante.',
    type: 'ataque', classIds: ['necromante', 'cavaleiro_das_trevas'],
    energyCost: 40, cooldownRounds: 3, baseEffect: 1.5, rankMultiplier: 0.2,
    rankUpExpRequired: 650, unlockLevel: 8,
  },
  lich_mode: {
    id: 'lich_mode', name: 'Modo Lich', emoji: '💀',
    description: 'Por 5 turnos: +100% dano mágico, imune a CC, mas perde 5% HP/turno.',
    type: 'ultimate', classIds: ['necromante'],
    energyCost: 80, cooldownRounds: 10, baseEffect: 100, rankMultiplier: 0.15,
    rankUpExpRequired: 1500, unlockLevel: 30,
  },
  forma_bestial: {
    id: 'forma_bestial', name: 'Forma Bestial', emoji: '🐻',
    description: 'Transforma em animal: +60% STR, +40% AGI por 4 turnos.',
    type: 'ultimate', classIds: ['druida'],
    energyCost: 60, cooldownRounds: 8, baseEffect: 60, rankMultiplier: 0.1,
    rankUpExpRequired: 900, unlockLevel: 20,
  },
  raiz_ancestral: {
    id: 'raiz_ancestral', name: 'Raiz Ancestral', emoji: '🌿',
    description: 'Prende o inimigo por 2 turnos e causa dano de veneno.',
    type: 'ataque', classIds: ['druida'],
    energyCost: 35, cooldownRounds: 4, baseEffect: 0.8, rankMultiplier: 0.15,
    rankUpExpRequired: 600, unlockLevel: 8,
  },
  cancao_de_batalha: {
    id: 'cancao_de_batalha', name: 'Canção de Batalha', emoji: '🎵',
    description: '+30% de dano e crítico por 3 turnos.',
    type: 'suporte', classIds: ['bardo'],
    energyCost: 30, cooldownRounds: 5, baseEffect: 30, rankMultiplier: 0.1,
    rankUpExpRequired: 550, unlockLevel: 5,
  },
  melodia_maldita: {
    id: 'melodia_maldita', name: 'Melodia Maldita', emoji: '🎶',
    description: 'Enfraquece o inimigo: -40% ataque e defesa por 3 turnos.',
    type: 'suporte', classIds: ['bardo'],
    energyCost: 40, cooldownRounds: 5, baseEffect: 40, rankMultiplier: 0.1,
    rankUpExpRequired: 650, unlockLevel: 10,
  },
  sinfonia_divina: {
    id: 'sinfonia_divina', name: 'Sinfonia Divina', emoji: '🎼',
    description: 'Cura, fortalece e cria escudo mágico simultaneamente.',
    type: 'ultimate', classIds: ['bardo'],
    energyCost: 80, cooldownRounds: 10, baseEffect: 1.5, rankMultiplier: 0.2,
    rankUpExpRequired: 1200, unlockLevel: 25,
  },
  instinto_predador: {
    id: 'instinto_predador', name: 'Instinto Predador', emoji: '🐺',
    description: 'Passiva: rastreia inimigos, +20% dano na primeira rodada.',
    type: 'passiva', classIds: ['cacador'],
    energyCost: 0, cooldownRounds: 0, baseEffect: 20, rankMultiplier: 0.05,
    rankUpExpRequired: 500, unlockLevel: 1,
    passive: { damageBonus: 20 },
  },
  companheiro_divino: {
    id: 'companheiro_divino', name: 'Companheiro Divino', emoji: '🐕',
    description: 'Pet evolui temporariamente causando dano massivo.',
    type: 'ataque', classIds: ['cacador'],
    energyCost: 45, cooldownRounds: 5, baseEffect: 1.8, rankMultiplier: 0.2,
    rankUpExpRequired: 700, unlockLevel: 12,
  },

  // ─── Lendárias ─────────────────────────────────────────────────────────────
  presenca_das_trevas: {
    id: 'presenca_das_trevas', name: 'Presença das Trevas', emoji: '🌑',
    description: 'Aura que aterroriza inimigos: -30% stats deles por toda a batalha.',
    type: 'passiva', classIds: ['cavaleiro_das_trevas'],
    energyCost: 0, cooldownRounds: 0, baseEffect: 30, rankMultiplier: 0.05,
    rankUpExpRequired: 2000, unlockLevel: 1,
    passive: { defenseBonus: 20, damageBonus: 15 },
  },
  golpe_da_morte: {
    id: 'golpe_da_morte', name: 'Golpe da Morte', emoji: '💀',
    description: 'Ataque que ignora 50% da defesa e pode matar instantaneamente (5%).',
    type: 'ultimate', classIds: ['cavaleiro_das_trevas'],
    energyCost: 80, cooldownRounds: 8, baseEffect: 4.0, rankMultiplier: 0.5,
    rankUpExpRequired: 2500, unlockLevel: 25,
  },
  singularidade: {
    id: 'singularidade', name: 'Singularidade', emoji: '🌀',
    description: 'Cria um buraco negro que aspira o inimigo: dano crescente por 4 turnos.',
    type: 'ultimate', classIds: ['feiticeiro'],
    energyCost: 90, cooldownRounds: 10, baseEffect: 2.0, rankMultiplier: 0.5,
    rankUpExpRequired: 2500, unlockLevel: 30,
  },
  omega_arcano: {
    id: 'omega_arcano', name: 'Ômega Arcano', emoji: '🌌',
    description: 'Explosão mágica máxima. O maior dano do jogo.',
    type: 'ultimate', classIds: ['feiticeiro'],
    energyCost: 100, cooldownRounds: 12, baseEffect: 8.0, rankMultiplier: 1.0,
    rankUpExpRequired: 5000, unlockLevel: 45,
  },
  dragao_supremo: {
    id: 'dragao_supremo', name: 'Dragão Supremo', emoji: '🐉',
    description: 'Invoca um dragão lendário que ataca 3x por turno por 4 turnos.',
    type: 'ultimate', classIds: ['invocador'],
    energyCost: 90, cooldownRounds: 10, baseEffect: 1.5, rankMultiplier: 0.3,
    rankUpExpRequired: 3000, unlockLevel: 35,
  },
  pacto_divino: {
    id: 'pacto_divino', name: 'Pacto Divino', emoji: '✨',
    description: 'Pacto com entidade superior: stats dobram por 5 turnos.',
    type: 'ultimate', classIds: ['invocador'],
    energyCost: 100, cooldownRounds: 15, baseEffect: 100, rankMultiplier: 0.1,
    rankUpExpRequired: 5000, unlockLevel: 50,
  },
};

export const SKILL_RANKS: SkillRank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

export function getSkillRankIndex(rank: SkillRank): number {
  return SKILL_RANKS.indexOf(rank);
}

export function nextSkillRank(rank: SkillRank): SkillRank | null {
  const idx = getSkillRankIndex(rank);
  return idx < SKILL_RANKS.length - 1 ? SKILL_RANKS[idx + 1] : null;
}

export function skillEffectValue(skill: DivineSkill, rank: SkillRank): number {
  const rankIdx = getSkillRankIndex(rank);
  return skill.baseEffect + skill.rankMultiplier * skill.baseEffect * rankIdx;
}

export function getSkill(id: string): DivineSkill | undefined {
  return DIVINE_SKILLS[id];
}
