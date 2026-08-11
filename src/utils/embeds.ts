import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { getBotConfig } from './botConfig';

export const COLORS = {
  PRIMARY:   0x9b59b6,
  SECONDARY: 0x8e44ad,
  SUCCESS:   0x27ae60,
  ERROR:     0xe74c3c,
  WARNING:   0xf39c12,
  INFO:      0x7d3c98,
  DARK:      0x4a235a,
  GOLD:      0xf1c40f,
} as const;

export const EMOJIS = {
  CROWN:     '👑',
  SWORD:     '⚔️',
  SHIELD:    '🛡️',
  STAR:      '⭐',
  TROPHY:    '🏆',
  COINS:     '🪙',
  LIGHTNING: '⚡',
  TICKET:    '🎫',
  WARNING:   '⚠️',
  CHECK:     '✅',
  CROSS:     '❌',
  CLOCK:     '🕐',
  CHART:     '📊',
  GIFT:      '🎁',
  MEGAPHONE: '📢',
  SCROLL:    '📜',
  SPARKLES:  '✨',
  FIRE:      '🔥',
  LEVEL:     '🎯',
  XP:        '💜',
  GEAR:      '⚙️',
  HAMMER:    '🔨',
  BELL:      '🔔',
  LOCK:      '🔒',
  UNLOCK:    '🔓',
  PERSON:    '👤',
  GROUP:     '👥',
  PIN:       '📌',
} as const;

export function baseEmbed(color?: ColorResolvable): EmbedBuilder {
  const cfg = getBotConfig();
  return new EmbedBuilder()
    .setColor(color ?? (cfg.primaryColor as ColorResolvable))
    .setTimestamp()
    .setFooter({ text: cfg.footerText, iconURL: cfg.botIconUrl ?? undefined });
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
  const map: Record<string, string> = {
    Recruta:    '🔰',
    Membro:     '⭐',
    Veterano:   '🌟',
    Elite:      '💫',
    Capitão:    '🛡️',
    Comandante: '⚔️',
    Líder:      '👑',
  };
  return map[rank] ?? '🔰';
}

export function levelBar(xp: number, xpNeeded: number, length = 10): string {
  const filled = Math.min(length, Math.round((xp / xpNeeded) * length));
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export function colorFromLevel(level: number): number {
  if (level >= 20) return COLORS.GOLD;
  if (level >= 10) return COLORS.SECONDARY;
  return COLORS.PRIMARY;
}
