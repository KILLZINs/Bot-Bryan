import { ChatInputCommandInteraction, GuildMember, PermissionResolvable } from 'discord.js';
import { prisma } from '../database/client';
import { xpForNextLevel } from '../types';
import { COLORS } from './embeds';

export async function getOrCreateMember(discordId: string, username: string) {
  return prisma.member.upsert({
    where: { discordId },
    update: { username },
    create: { discordId, username },
  });
}

export async function addXp(discordId: string, username: string, amount: number) {
  const member = await getOrCreateMember(discordId, username);
  const newXp = member.xp + amount;
  const xpNeeded = xpForNextLevel(member.level);

  if (newXp >= xpNeeded) {
    return prisma.member.update({
      where: { discordId },
      data: { xp: newXp - xpNeeded, level: member.level + 1 },
    });
  }

  return prisma.member.update({
    where: { discordId },
    data: { xp: newXp },
  });
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function parseDuration(str: string): number | null {
  const regex = /^(\d+)(s|m|h|d)$/i;
  const match = str.match(regex);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit];
}

export function hasPermission(member: GuildMember, permission: PermissionResolvable): boolean {
  return member.permissions.has(permission);
}

export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has('Administrator');
}

export function isMod(member: GuildMember): boolean {
  const modRoleId = process.env.MOD_ROLE_ID;
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  return (
    isAdmin(member) ||
    (!!modRoleId && member.roles.cache.has(modRoleId)) ||
    (!!adminRoleId && member.roles.cache.has(adminRoleId))
  );
}

export async function checkModerator(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ Este comando só pode ser usado em servidores.', ephemeral: true });
    return false;
  }
  const member = interaction.member as GuildMember;
  if (!isMod(member)) {
    await interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
    return false;
  }
  return true;
}

export async function checkAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ Este comando só pode ser usado em servidores.', ephemeral: true });
    return false;
  }
  const member = interaction.member as GuildMember;
  if (!isAdmin(member)) {
    await interaction.reply({ content: '❌ Apenas administradores podem usar este comando.', ephemeral: true });
    return false;
  }
  return true;
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

export function colorFromLevel(level: number): number {
  if (level >= 20) return COLORS.GOLD;
  if (level >= 10) return COLORS.SECONDARY;
  return COLORS.PRIMARY;
}
