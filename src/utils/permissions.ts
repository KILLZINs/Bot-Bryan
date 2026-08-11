import { GuildMember, ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { OWNER_ID } from '../types';
import { getConfig } from './helpers';
import { errorEmbed } from './embeds';
import { isBotManager } from './allowlist';
import { isAllianceServerRepresentative } from './alliance';

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

export function isOwner(userId: string): boolean {
  if (userId === OWNER_ID) return true;
  // Suporta múltiplos donos via BOT_OWNER_IDS (csv) além do legado OWNER_ID
  const extra = (process.env.BOT_OWNER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return extra.includes(userId);
}

export async function isAdmin(member: GuildMember, guildId: string): Promise<boolean> {
  if (isOwner(member.id)) return true;
  if (member.permissions.has('Administrator')) return true;
  const config = await getConfig(guildId);
  if (config.adminRoleId && member.roles.cache.has(config.adminRoleId)) return true;
  return false;
}

export async function isModerator(member: GuildMember, guildId: string): Promise<boolean> {
  if (await isAdmin(member, guildId)) return true;
  const config = await getConfig(guildId);
  if (config.modRoleId && member.roles.cache.has(config.modRoleId)) return true;
  return false;
}

export async function checkAdmin(interaction: AnyInteraction): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    const errMsg = { embeds: [errorEmbed('Erro', 'Este comando só pode ser usado em servidores.')], ephemeral: true as const };
    if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
    else await interaction.reply(errMsg).catch(() => null);
    return false;
  }
  const member = interaction.member as GuildMember;
  if (!(await isAdmin(member, interaction.guild.id))) {
    const errMsg = { embeds: [errorEmbed('Sem Permissão', 'Você precisa ser administrador para usar isso.')], ephemeral: true as const };
    if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
    else await interaction.reply(errMsg).catch(() => null);
    return false;
  }
  return true;
}

export async function checkModerator(interaction: AnyInteraction): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    const errMsg = { embeds: [errorEmbed('Erro', 'Este comando só pode ser usado em servidores.')], ephemeral: true as const };
    if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
    else await interaction.reply(errMsg).catch(() => null);
    return false;
  }
  const member = interaction.member as GuildMember;
  if (!(await isModerator(member, interaction.guild.id))) {
    const errMsg = { embeds: [errorEmbed('Sem Permissão', 'Você precisa ser moderador para usar isso.')], ephemeral: true as const };
    if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
    else await interaction.reply(errMsg).catch(() => null);
    return false;
  }
  return true;
}

// ─── Verificação de dono/representante do servidor ────────────────────────────

/**
 * Retorna true se o usuário for dono do servidor, representante da aliança
 * (definido via /alianca) ou bot manager/owner.
 */
export async function isServerOwnerOrRepresentative(interaction: AnyInteraction): Promise<boolean> {
  if (!interaction.guild) return false;
  const userId  = interaction.user.id;
  const guildId = interaction.guild.id;
  // Bot managers e donos do bot têm permissão total
  if (isBotManager(userId)) return true;
  // Dono do servidor Discord
  if (interaction.guild.ownerId === userId) return true;
  // Representante da aliança (setado via /alianca → Setar Rep/Dono)
  return isAllianceServerRepresentative(guildId, userId);
}

/**
 * Verifica dono/representante e envia mensagem de erro se negado.
 * Usar em lugar de checkAdmin para funções do /servidor.
 */
export async function checkServerOwnerOrRepresentative(interaction: AnyInteraction): Promise<boolean> {
  if (await isServerOwnerOrRepresentative(interaction)) return true;
  const errMsg = {
    embeds: [errorEmbed('Sem Permissão', 'Apenas o dono do servidor ou representantes definidos no `/alianca` podem usar este comando.')],
    ephemeral: true as const,
  };
  try {
    if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
    else await interaction.reply(errMsg).catch(() => null);
  } catch { /* ignore */ }
  return false;
}
