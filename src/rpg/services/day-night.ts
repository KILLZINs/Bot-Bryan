// ═══════════════════════════════════════════════════════════════════════
// CICLO DIA/NOITE — baseado em UTC
// ═══════════════════════════════════════════════════════════════════════

export type DayPhase = 'amanhecer' | 'dia' | 'crepusculo' | 'noite';

export interface PhaseInfo {
  emoji: string;
  name: string;
  xpBonus: number;      // multiplicador adicional (0.15 = +15%)
  goldBonus: number;
  fishBonus: number;    // bonus de pesca
  enemyMult: number;    // inimigos mais fortes à noite
  meditaBonus: number;  // meditação rende mais de manhã
  desc: string;
}

export const PHASE_INFO: Record<DayPhase, PhaseInfo> = {
  amanhecer: {
    emoji: '🌅', name: 'Amanhecer',
    xpBonus: 0.15, goldBonus: 0, fishBonus: 0.1, enemyMult: 1.0, meditaBonus: 0.3,
    desc: '+15% XP | +30% eficiência de Meditação',
  },
  dia: {
    emoji: '☀️', name: 'Dia',
    xpBonus: 0, goldBonus: 0, fishBonus: 0, enemyMult: 1.0, meditaBonus: 0,
    desc: 'Condições normais',
  },
  crepusculo: {
    emoji: '🌇', name: 'Crepúsculo',
    xpBonus: 0.05, goldBonus: 0.15, fishBonus: 0.3, enemyMult: 1.05, meditaBonus: 0.1,
    desc: '+15% Ouro | +30% recompensas de Pesca',
  },
  noite: {
    emoji: '🌙', name: 'Noite',
    xpBonus: 0.25, goldBonus: 0.1, fishBonus: 0, enemyMult: 1.25, meditaBonus: 0.15,
    desc: '+25% XP | +10% Ouro | Inimigos 25% mais fortes',
  },
};

export function getDayPhase(): DayPhase {
  const hour = new Date().getUTCHours();
  if (hour >= 5 && hour < 7)  return 'amanhecer';
  if (hour >= 7 && hour < 18) return 'dia';
  if (hour >= 18 && hour < 20) return 'crepusculo';
  return 'noite';
}

export function getCurrentPhaseInfo(): PhaseInfo & { phase: DayPhase } {
  const phase = getDayPhase();
  return { phase, ...PHASE_INFO[phase] };
}

/** Retorna hora UTC formatada */
export function utcTimeStr(): string {
  const d = new Date();
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;
}
