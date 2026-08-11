import { prisma } from '../database/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface BotConfigData {
  footerText:   string;
  primaryColor: number;
  botIconUrl:   string | null;
  rpFooterText: string;
  // Feature toggles globais
  featAfk:       boolean;
  featWelcomeDm: boolean;
}

// ─── Padrões ──────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULTS: BotConfigData = {
  footerText:   '⚔️ Aliança Skyline',
  primaryColor: 0x9b59b6,
  botIconUrl:   null,
  rpFooterText: '⚔️ Aliança Skyline • /genero para mudar seus pronomes',
  featAfk:       true,
  featWelcomeDm: true,
};

// ─── Cache em memória (carregado no ready) ────────────────────────────────────

let _cache: BotConfigData = { ...CONFIG_DEFAULTS };

export function getBotConfig(): BotConfigData {
  return _cache;
}

export async function loadBotConfig(): Promise<void> {
  try {
    const row = await prisma.botConfig.findUnique({ where: { id: 'global' } });
    if (row) {
      _cache = {
        footerText:   row.footerText,
        primaryColor: row.primaryColor,
        botIconUrl:   row.botIconUrl,
        rpFooterText: row.rpFooterText,
        featAfk:       (row as any).featAfk       ?? true,
        featWelcomeDm: (row as any).featWelcomeDm ?? true,
      };
    } else {
      _cache = { ...CONFIG_DEFAULTS };
    }
  } catch {
    // Tabela ainda não criada → usa defaults sem crash
    _cache = { ...CONFIG_DEFAULTS };
  }
}

export async function updateBotConfig(data: Partial<BotConfigData>): Promise<BotConfigData> {
  // Atualiza o cache IMEDIATAMENTE (optimistic) antes do await do DB
  _cache = { ..._cache, ...data };
  const snapshot = { ..._cache };
  await prisma.botConfig.upsert({
    where:  { id: 'global' },
    update: data as any,
    create: { id: 'global', ...snapshot },
  });
  return _cache;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "#9b59b6" ou "9b59b6" → número inteiro, ou null se inválido */
export function hexToInt(hex: string): number | null {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return parseInt(clean, 16);
}

/** 0x9b59b6 → "#9B59B6" */
export function intToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0').toUpperCase();
}
