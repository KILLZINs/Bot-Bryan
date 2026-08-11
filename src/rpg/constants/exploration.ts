// ═══════════════════════════════════════════════════════════════════════
// EVENTOS DE EXPLORAÇÃO
// ═══════════════════════════════════════════════════════════════════════

export type ExploreEventType =
  | 'treasure' | 'ambush' | 'friendly_npc' | 'trap'
  | 'ancient_ruins' | 'rare_item' | 'nothing' | 'merchant' | 'shrine';

export interface ExploreEvent {
  type: ExploreEventType;
  weight: number; // probabilidade relativa
  title: string;
  emoji: string;
  descriptions: string[];  // escolhe um aleatório
  gold?: { min: number; max: number };
  xp?: { min: number; max: number };
  hpChange?: { min: number; max: number }; // negativo = dano
  energyChange?: number;
  buff?: { type: string; value: number; durationMs: number; label: string };
}

export const EXPLORE_EVENTS: ExploreEvent[] = [
  {
    type: 'treasure', weight: 18, emoji: '💰', title: 'Tesouro Escondido!',
    descriptions: [
      'Você encontrou um baú escondido atrás de uma rocha!',
      'Uma caixa enterrada revela seu conteúdo de ouro!',
      'Pegadas antigas levam você a um tesouro escondido!',
    ],
    gold: { min: 30, max: 120 }, xp: { min: 20, max: 60 },
  },
  {
    type: 'ambush', weight: 15, emoji: '⚔️', title: 'Emboscada!',
    descriptions: [
      'Bandidos saltam da escuridão e atacam!',
      'Monstros selvagens bloqueiam seu caminho!',
      'Um predador oculto arremessa-se sobre você!',
    ],
    hpChange: { min: -40, max: -10 }, gold: { min: 5, max: 30 }, xp: { min: 30, max: 80 },
  },
  {
    type: 'friendly_npc', weight: 14, emoji: '🧙', title: 'Viajante Amigável',
    descriptions: [
      'Um velho sábio compartilha sua sabedoria e lhe dá uma poção.',
      'Um mercador amigável te oferece suprimentos gratuitos.',
      'Um herói aposentado lhe ensina uma técnica de recuperação.',
    ],
    hpChange: { min: 20, max: 50 }, energyChange: 15, xp: { min: 10, max: 30 },
  },
  {
    type: 'trap', weight: 12, emoji: '🪤', title: 'Armadilha!',
    descriptions: [
      'Você caiu em uma armadilha de espinhos!',
      'Uma pedra cai do teto e te acerta!',
      'O chão cede e você cai em uma vala com estacas!',
    ],
    hpChange: { min: -60, max: -20 }, energyChange: -10,
  },
  {
    type: 'ancient_ruins', weight: 12, emoji: '🏛️', title: 'Ruínas Antigas',
    descriptions: [
      'Ruínas de uma civilização perdida — você aprende com os escritos nas paredes.',
      'Inscrições antigas revelam segredos de batalha.',
      'Um templo em ruínas pulsa com energia misteriosa.',
    ],
    xp: { min: 60, max: 150 },
  },
  {
    type: 'merchant', weight: 10, emoji: '🛒', title: 'Mercador Itinerante',
    descriptions: [
      'Um mercador excêntrico oferece seus melhores produtos a preço justo!',
    ],
    gold: { min: -50, max: -20 }, // cobra pelo buff
    buff: { type: 'xp_pct', value: 0.2, durationMs: 60 * 60 * 1000, label: 'XP (Mercador)' },
  },
  {
    type: 'shrine', weight: 8, emoji: '⛩️', title: 'Santuário Antigo',
    descriptions: [
      'Você encontrou um santuário esquecido — ele restaura sua energia!',
      'Uma fonte sagrada emana energia divina.',
    ],
    hpChange: { min: 30, max: 60 }, energyChange: 25, xp: { min: 15, max: 40 },
  },
  {
    type: 'rare_item', weight: 6, emoji: '💎', title: 'Item Raro!',
    descriptions: [
      'Uma gema brilhante captura sua atenção entre as pedras.',
      'Algo reluz no chão — parece valioso!',
    ],
    gold: { min: 80, max: 200 }, xp: { min: 30, max: 80 },
  },
  {
    type: 'nothing', weight: 5, emoji: '🌿', title: 'Caminho Tranquilo',
    descriptions: [
      'A exploração foi calma. Nada de especial aconteceu... mas você se sente mais experiente.',
      'Você voltou sem grandes aventuras, mas com os pés no chão.',
    ],
    xp: { min: 5, max: 20 },
  },
];

export function rollExploreEvent(level: number): ExploreEvent & {
  goldResult: number; xpResult: number; hpResult: number; energyResult: number;
} {
  // Level alto = mais chance de tesouro/raro, menos nada
  const table = EXPLORE_EVENTS.map(e => ({
    ...e,
    weight: e.type === 'treasure' || e.type === 'rare_item'
      ? e.weight + Math.floor(level / 5)
      : e.weight,
  }));
  const total = table.reduce((s, e) => s + e.weight, 0);
  let rng = Math.random() * total;
  let event = table[0];
  for (const e of table) { rng -= e.weight; if (rng <= 0) { event = e; break; } }

  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const desc = event.descriptions[Math.floor(Math.random() * event.descriptions.length)];

  return {
    ...event,
    descriptions: [desc], // só a escolhida
    goldResult:   event.gold   ? rand(event.gold.min, event.gold.max) : 0,
    xpResult:     event.xp     ? rand(event.xp.min,  event.xp.max)   : 0,
    hpResult:     event.hpChange ? rand(event.hpChange.min, event.hpChange.max) : 0,
    energyResult: event.energyChange ?? 0,
  };
}

/** 3 min cooldown de exploração */
export const EXPLORE_COOLDOWN_MS = 3 * 60 * 1000;
export const EXPLORE_ENERGY_COST = 8;
