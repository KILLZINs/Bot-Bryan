// Stub de compatibilidade — funcionalidade completa disponível em breve
export type FeatureKey = string;

export const FEATURE_KEYS: string[] = [
  'xpEnabled', 'welcomeEnabled', 'ticketEnabled', 'levelRolesEnabled',
  'antiSpam', 'antiLinks', 'autoModEnabled', 'logEnabled',
];

export const FEATURE_META: Record<string, { label: string; description: string; emoji: string }> = {
  xpEnabled:         { label: 'Sistema de XP',      description: 'Ganho de XP por mensagens',           emoji: '⭐' },
  welcomeEnabled:    { label: 'Boas-vindas',         description: 'Mensagem ao entrar no servidor',      emoji: '👋' },
  ticketEnabled:     { label: 'Tickets',             description: 'Sistema de suporte via tickets',      emoji: '🎫' },
  levelRolesEnabled: { label: 'Cargos por Nível',    description: 'Dar cargo automático ao subir nível', emoji: '🎯' },
  antiSpam:          { label: 'Anti-Spam',           description: 'Bloquear mensagens repetidas',        emoji: '🛡️' },
  antiLinks:         { label: 'Anti-Links',          description: 'Bloquear links externos',             emoji: '🔗' },
  autoModEnabled:    { label: 'Auto-Moderação',      description: 'Moderação automática de mensagens',   emoji: '🤖' },
  logEnabled:        { label: 'Logs',                description: 'Registrar ações em canal de log',     emoji: '📋' },
};
