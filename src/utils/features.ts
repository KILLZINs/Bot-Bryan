// ═══════════════════════════════════════════════════════════════════════
// FEATURE GATE — habilitar/desabilitar módulos por servidor
// ═══════════════════════════════════════════════════════════════════════

import { getConfig } from './helpers';

export type FeatureKey =
  | 'featLeveling'
  | 'featRpg'
  | 'featTickets'
  | 'featPolls'
  | 'featGiveaways'
  | 'featSelfRole'
  | 'featMissions'
  | 'featSocial'
  | 'featEconomy'
  | 'featMod'
  | 'featAnnouncements';

export interface FeatureMeta {
  label: string;
  emoji: string;
  desc:  string;
}

export const FEATURE_META: Record<FeatureKey, FeatureMeta> = {
  featLeveling:      { label: 'XP / Níveis',           emoji: '🎯', desc: 'XP por mensagem, level up e ranking de níveis' },
  featRpg:           { label: 'RPG',                   emoji: '⚔️', desc: 'Sistema RPG completo: dungeon, crafting, skills, etc.' },
  featTickets:       { label: 'Tickets / Suporte',     emoji: '🎫', desc: 'Sistema de tickets de suporte ao membro' },
  featPolls:         { label: 'Enquetes',              emoji: '📊', desc: 'Criação de enquetes interativas' },
  featGiveaways:     { label: 'Sorteios',              emoji: '🎁', desc: 'Sistema de sorteios com participação por botão' },
  featSelfRole:      { label: 'Registro de Cargos',   emoji: '🎭', desc: 'Menus de auto-cargo para membros escolherem seus cargos' },
  featMissions:      { label: 'Missões',               emoji: '📋', desc: 'Missões diárias e semanais com recompensas' },
  featSocial:        { label: 'Roleplay (/rp)',         emoji: '🤝', desc: 'Comandos de roleplay social (abraçar, beijar, etc.)' },
  featEconomy:       { label: 'Economia (moedas)',     emoji: '🪙', desc: 'Sistema de moedas, loja e transferências' },
  featMod:           { label: 'Auto-Moderação',        emoji: '🔨', desc: 'Anti-spam, anti-links e moderação automática' },
  featAnnouncements: { label: 'Anúncios / Eventos',    emoji: '📢', desc: 'Sistema de anúncios e eventos do servidor' },
};

export const FEATURE_KEYS = Object.keys(FEATURE_META) as FeatureKey[];

/** Retorna true se a feature está habilitada no servidor (padrão: true). */
export async function isFeatureEnabled(guildId: string | null | undefined, feat: FeatureKey): Promise<boolean> {
  if (!guildId) return true;
  try {
    const config = await getConfig(guildId);
    const val = (config as Record<string, unknown>)[feat];
    return val !== false; // undefined → true (padrão habilitado)
  } catch {
    return true; // em caso de erro, não bloquear
  }
}

/** Mensagem ephemeral padrão para features desabilitadas. */
export function featureDisabledMsg(feat: FeatureKey): string {
  const m = FEATURE_META[feat];
  return `❌ **${m.emoji} ${m.label}** está desabilitado neste servidor.\nUm administrador pode habilitá-lo em \`/admin\` → 🔧 **Módulos**.`;
}
