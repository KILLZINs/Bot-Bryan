// ═══════════════════════════════════════════════════════════════════════
// LOGGER CENTRAL — envia logs formatados para o canal configurado
// ═══════════════════════════════════════════════════════════════════════

import { Guild, EmbedBuilder, TextChannel, GuildMember, User } from 'discord.js';
import { prisma } from '../database/client';

// ── Bitmask de categorias ─────────────────────────────────────────────
export const LOG = {
  MESSAGES:   1,   // deletar/editar mensagens
  MEMBERS:    2,   // entrar/sair, cargo, apelido, timeout
  MODERATION: 4,   // ban, unban, kick, mute, warn
  CHANNELS:   8,   // criar/deletar canais
  VOICE:      16,  // entrar/sair/mover em voz
} as const;

export type LogCategory = typeof LOG[keyof typeof LOG];

export const LOG_ALL  = 31; // todos ativos por padrão
export const LOG_NONE = 0;

export const LOG_LABELS: Record<number, { emoji: string; name: string }> = {
  [LOG.MESSAGES]:   { emoji: '📩', name: 'Mensagens'  },
  [LOG.MEMBERS]:    { emoji: '👥', name: 'Membros'    },
  [LOG.MODERATION]: { emoji: '🔨', name: 'Moderação'  },
  [LOG.CHANNELS]:   { emoji: '📢', name: 'Canais'     },
  [LOG.VOICE]:      { emoji: '🔊', name: 'Voz'        },
};

// ── Cache de config por guildId (TTL 30s) ────────────────────────────
const cache = new Map<string, { channelId: string | null; flags: number; ts: number }>();

async function getLogConfig(guildId: string): Promise<{ channelId: string | null; flags: number }> {
  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.ts < 30_000) return { channelId: cached.channelId, flags: cached.flags };

  const cfg = await prisma.guildConfig.findUnique({ where: { guildId } });
  const entry = {
    channelId: cfg?.logChannelId ?? null,
    flags:     (cfg as any)?.logFlags ?? LOG_ALL,
    ts:        Date.now(),
  };
  cache.set(guildId, entry);
  return entry;
}

// Invalida cache quando o canal/flags mudar
export function invalidateLogCache(guildId: string) {
  cache.delete(guildId);
}

// ── Função principal ──────────────────────────────────────────────────
export async function sendLog(
  guild: Guild,
  category: LogCategory,
  embed: EmbedBuilder,
): Promise<void> {
  try {
    const { channelId, flags } = await getLogConfig(guild.id);
    if (!channelId) return;
    if ((flags & category) === 0) return; // categoria desativada

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel?.isTextBased()) return;

    embed.setTimestamp().setFooter({ text: `🆔 ${guild.name}` });
    await channel.send({ embeds: [embed] });
  } catch {
    // Silencioso — log não pode quebrar o bot
  }
}

// ═══════════════════════════════════════════════════════════════════════
// BUILDERS ESPECIALIZADOS (helpers para cada categoria)
// ═══════════════════════════════════════════════════════════════════════

// ── Mensagens ─────────────────────────────────────────────────────────
export function logMessageDelete(
  author: User,
  content: string,
  channelName: string,
  channelId: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() })
    .setTitle('🗑️ Mensagem Deletada')
    .addFields(
      { name: '📢 Canal',   value: `<#${channelId}> (${channelName})`, inline: true },
      { name: '👤 Autor',   value: `${author} (${author.id})`,         inline: true },
      { name: '💬 Conteúdo', value: content.slice(0, 1024) || '*(sem texto)*', inline: false },
    );
}

export function logMessageEdit(
  author: User,
  before: string,
  after: string,
  channelId: string,
  messageUrl: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xF39C12)
    .setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() })
    .setTitle('✏️ Mensagem Editada')
    .setURL(messageUrl)
    .addFields(
      { name: '📢 Canal',  value: `<#${channelId}>`,              inline: true },
      { name: '👤 Autor',  value: `${author} (${author.id})`,     inline: true },
      { name: '📄 Antes',  value: before.slice(0, 512) || '*(vazio)*', inline: false },
      { name: '📝 Depois', value: after.slice(0, 512),            inline: false },
    );
}

// ── Membros ───────────────────────────────────────────────────────────
export function logMemberJoin(member: GuildMember): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setTitle('📥 Membro Entrou')
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: '👤 Usuário',      value: `${member} (${member.id})`,                                     inline: true },
      { name: '📅 Conta criada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,      inline: true },
      { name: '👥 Total',        value: `**${member.guild.memberCount}** membros`,                       inline: true },
    );
}

export function logMemberLeave(member: GuildMember): EmbedBuilder {
  const roles = member.roles.cache
    .filter(r => r.id !== member.guild.id)
    .map(r => r.toString())
    .slice(0, 10)
    .join(', ') || '*(nenhum)*';

  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setTitle('📤 Membro Saiu')
    .addFields(
      { name: '👤 Usuário',       value: `${member.user.tag} (${member.id})`,                        inline: true },
      { name: '📅 Entrou em',     value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Desconhecido', inline: true },
      { name: '🏷️ Cargos',       value: roles,                                                        inline: false },
    );
}

export function logRoleChange(
  member: GuildMember,
  added: string[],
  removed: string[],
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setTitle('🏷️ Cargos Alterados')
    .addFields(
      { name: '👤 Membro', value: `${member} (${member.id})`, inline: false },
      ...(added.length   ? [{ name: '➕ Adicionados', value: added.join(', '),   inline: true }] : []),
      ...(removed.length ? [{ name: '➖ Removidos',   value: removed.join(', '), inline: true }] : []),
    );
}

export function logNicknameChange(
  member: GuildMember,
  before: string | null,
  after: string | null,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setTitle('✍️ Apelido Alterado')
    .addFields(
      { name: '👤 Membro',  value: `${member} (${member.id})`, inline: false },
      { name: '📝 Antes',   value: before ?? '*(nenhum)*',     inline: true  },
      { name: '📝 Depois',  value: after  ?? '*(nenhum)*',     inline: true  },
    );
}

export function logTimeout(
  member: GuildMember,
  until: Date | null,
  moderator?: User,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(until ? 0xE67E22 : 0x2ECC71)
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setTitle(until ? '⏱️ Membro em Timeout' : '✅ Timeout Removido')
    .addFields(
      { name: '👤 Membro', value: `${member} (${member.id})`,                                    inline: true },
      ...(until ? [{ name: '⏰ Expira em', value: `<t:${Math.floor(until.getTime() / 1000)}:R>`, inline: true }] : []),
      ...(moderator ? [{ name: '🔨 Moderador', value: moderator.tag,                              inline: true }] : []),
    );
}

// ── Moderação ─────────────────────────────────────────────────────────
export function logBan(user: User, moderator: User, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xC0392B)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setTitle('🔨 Membro Banido')
    .addFields(
      { name: '👤 Usuário',    value: `${user.tag} (${user.id})`,  inline: true  },
      { name: '🔨 Moderador', value: moderator.tag,                inline: true  },
      { name: '📋 Motivo',    value: reason || 'Sem motivo',       inline: false },
    );
}

export function logUnban(user: User, moderator: User, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x27AE60)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setTitle('🔓 Membro Desbanido')
    .addFields(
      { name: '👤 Usuário',    value: `${user.tag} (${user.id})`, inline: true  },
      { name: '🔨 Moderador', value: moderator.tag,               inline: true  },
      { name: '📋 Motivo',    value: reason || 'Sem motivo',      inline: false },
    );
}

// ── Canais ────────────────────────────────────────────────────────────
export function logChannelCreate(channelName: string, channelId: string, type: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x1ABC9C)
    .setTitle('📢 Canal Criado')
    .addFields(
      { name: '📌 Nome', value: `<#${channelId}> (${channelName})`, inline: true },
      { name: '🗂️ Tipo', value: type,                               inline: true },
    );
}

export function logChannelDelete(channelName: string, type: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('🗑️ Canal Deletado')
    .addFields(
      { name: '📌 Nome', value: channelName, inline: true },
      { name: '🗂️ Tipo', value: type,        inline: true },
    );
}

// ── Voz ───────────────────────────────────────────────────────────────
export function logVoice(
  member: GuildMember,
  action: 'join' | 'leave' | 'move',
  channelBefore?: string,
  channelAfter?: string,
): EmbedBuilder {
  const titles  = { join: '🔊 Entrou na Voz', leave: '🔇 Saiu da Voz', move: '🔀 Movido de Canal' };
  const colors  = { join: 0x2ECC71, leave: 0xE74C3C, move: 0x3498DB };

  return new EmbedBuilder()
    .setColor(colors[action])
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setTitle(titles[action])
    .addFields(
      { name: '👤 Membro', value: `${member} (${member.id})`, inline: false },
      ...(channelBefore ? [{ name: action === 'move' ? '📤 De' : '🔊 Canal', value: channelBefore, inline: true }] : []),
      ...(channelAfter  ? [{ name: action === 'move' ? '📥 Para' : '🔊 Canal', value: channelAfter,  inline: true }] : []),
    );
}
