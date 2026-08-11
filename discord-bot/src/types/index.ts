import {
  ChatInputCommandInteraction,
  Collection,
  Client,
} from 'discord.js';

export interface Command {
  data: { name: string; toJSON(): object };
  category: string;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
  cooldowns: Collection<string, Collection<string, number>>;
}

export const RANKS = [
  'Recruta',
  'Membro',
  'Veterano',
  'Elite',
  'Capitão',
  'Comandante',
  'Líder',
] as const;

export type Rank = (typeof RANKS)[number];

export const XP_PER_MESSAGE = 10;
export const XP_COOLDOWN_MS = 60_000; // 1 minute

export function xpForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}
