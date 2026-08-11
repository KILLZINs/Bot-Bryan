import { EmbedBuilder, ColorResolvable } from 'discord.js';

export const COLORS = {
  PRIMARY: 0x9b59b6,
  SECONDARY: 0x7d3c98,
  SUCCESS: 0x27ae60,
  ERROR: 0xe74c3c,
  WARNING: 0xf39c12,
  INFO: 0x8e44ad,
  DARK: 0x4a235a,
  GOLD: 0xf1c40f,
} as const;

export const EMOJIS = {
  CROWN: '👑',
  SWORD: '⚔️',
  SHIELD: '🛡️',
  STAR: '⭐',
  TROPHY: '🏆',
  COINS: '🪙',
  LIGHTNING: '⚡',
  TICKET: '🎫',
  WARNING: '⚠️',
  CHECK: '✅',
  CROSS: '❌',
  CLOCK: '🕐',
  CHART: '📊',
  GIFT: '🎁',
  MEGAPHONE: '📢',
  SCROLL: '📜',
  SPARKLES: '✨',
  FIRE: '🔥',
  LEVEL: '🎯',
  XP: '💜',
} as const;

export function baseEmbed(color: ColorResolvable = COLORS.PRIMARY): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: '⚔️ Aliança Skyline' });
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  return baseEmbed(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.CHECK} ${title}`)
    .setDescription(description ?? null);
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  return baseEmbed(COLORS.ERROR)
    .setTitle(`${EMOJIS.CROSS} ${title}`)
    .setDescription(description ?? null);
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  return baseEmbed(COLORS.INFO)
    .setTitle(`${EMOJIS.SPARKLES} ${title}`)
    .setDescription(description ?? null);
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
  return baseEmbed(COLORS.WARNING)
    .setTitle(`${EMOJIS.WARNING} ${title}`)
    .setDescription(description ?? null);
}

export function rankEmoji(rank: string): string {
  const rankEmojis: Record<string, string> = {
    Recruta: '🔰',
    Membro: '⭐',
    Veterano: '🌟',
    Elite: '💫',
    Capitão: '🛡️',
    Comandante: '⚔️',
    Líder: '👑',
  };
  return rankEmojis[rank] ?? '🔰';
}

export function levelBar(xp: number, xpNeeded: number, length = 10): string {
  const filled = Math.round((xp / xpNeeded) * length);
  const empty = length - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

export function colorFromLevel(level: number): number {
  if (level >= 20) return COLORS.GOLD;
  if (level >= 10) return COLORS.SECONDARY;
  return COLORS.PRIMARY;
}
