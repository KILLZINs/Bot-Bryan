// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE TEMPLATES DE EMBEDS — customização total por embed
// ═══════════════════════════════════════════════════════════════════════

import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { prisma } from '../database/client';

export interface EmbedTemplateData {
  key:          string;
  title:        string | null;
  description:  string | null;
  color:        number | null;
  thumbnailUrl: string | null;
  imageUrl:     string | null;
  footerText:   string | null;
  footerIcon:   string | null;
}

// ── Catálogo de todos os embeds configuráveis ──────────────────────────
export interface EmbedCatalogEntry {
  label:    string;
  category: string;
  desc:     string;
}

export const EMBED_CATALOG: Record<string, EmbedCatalogEntry> = {
  // Geral
  'welcome.channel':       { label: '👋 Boas-vindas (canal)',       category: 'geral',    desc: 'Embed de boas-vindas enviado no canal quando um membro entra' },
  'welcome.dm':            { label: '📩 Boas-vindas (DM)',          category: 'geral',    desc: 'DM enviada automaticamente ao novo membro' },
  'levelup':               { label: '🎯 Level Up',                  category: 'geral',    desc: 'Notificação de subida de nível (sistema de XP)' },
  'rp':                    { label: '🎭 Roleplay (/rp)',             category: 'geral',    desc: 'Embed das ações de roleplay' },
  'painel':                { label: '⚔️ Painel Principal',           category: 'geral',    desc: 'Painel principal do bot (/painel)' },
  // RPG
  'combat.victory':        { label: '🏆 Vitória no Combate',        category: 'rpg',      desc: 'Resultado quando vence um combate' },
  'combat.defeat':         { label: '💀 Derrota no Combate',        category: 'rpg',      desc: 'Resultado quando perde um combate' },
  'combat.draw':           { label: '💥 Empate no Combate',         category: 'rpg',      desc: 'Resultado de empate' },
  // Boss Mundial
  'worldboss.spawn':       { label: '🐉 Boss Mundial — Spawn',      category: 'bossmundial', desc: 'Embed quando um Boss Mundial é invocado' },
  'worldboss.defeated':    { label: '🏆 Boss Mundial — Derrota',    category: 'bossmundial', desc: 'Embed quando o Boss Mundial é derrotado' },
  'worldboss.expired':     { label: '⏰ Boss Mundial — Expirado',   category: 'bossmundial', desc: 'Embed quando o Boss Mundial expira sem ser derrotado' },
  // Casamento
  'marriage.proposal':     { label: '💍 Proposta de Casamento',     category: 'casamento', desc: 'Embed de proposta de casamento enviada' },
  'marriage.married':      { label: '💒 Casamento Realizado',       category: 'casamento', desc: 'Embed de confirmação de casamento' },
  'marriage.divorced':     { label: '💔 Divórcio',                  category: 'casamento', desc: 'Embed quando um casal se divorcia' },
  // Missões
  'mission.daily.complete':{ label: '📋 Missão Diária Completa',    category: 'missoes',   desc: 'Embed de missão diária concluída' },
  'mission.weekly.complete':{ label: '📆 Missão Semanal Completa',  category: 'missoes',   desc: 'Embed de missão semanal concluída' },
  // Aliança
  'alliance.official':     { label: '🌐 Embed Oficial Aliança',     category: 'alianca',  desc: 'Embed com lista oficial dos servidores da aliança' },
  // Tickets
  'ticket.create':         { label: '🎫 Ticket Criado',             category: 'tickets',  desc: 'Embed exibido quando um ticket é aberto' },
  'ticket.close':          { label: '🔒 Ticket Fechado',            category: 'tickets',  desc: 'Embed exibido quando um ticket é fechado' },
  'ticket.claim':          { label: '🛡️ Ticket Assumido',           category: 'tickets',  desc: 'Embed quando um moderador assume o ticket' },
  // Sorteios
  'giveaway.start':        { label: '🎁 Sorteio Iniciado',          category: 'sorteios', desc: 'Embed do sorteio ativo aguardando participantes' },
  'giveaway.win':          { label: '🏆 Vencedor do Sorteio',       category: 'sorteios', desc: 'Embed de anúncio dos vencedores' },
  // Moderação
  'mod.warn':              { label: '⚠️ Aviso Emitido',             category: 'moderacao',desc: 'Embed de aviso de moderação aplicado' },
  'mod.ban':               { label: '🔨 Ban Aplicado',              category: 'moderacao',desc: 'Embed de ban aplicado ao membro' },
  'mod.kick':              { label: '👢 Kick Aplicado',             category: 'moderacao',desc: 'Embed de kick aplicado ao membro' },
  // Registro de Cargos
  'selfrole.add':          { label: '✅ Cargo Adicionado',          category: 'selfrole', desc: 'Mensagem ephemeral quando o membro recebe um cargo' },
  'selfrole.remove':       { label: '❌ Cargo Removido',            category: 'selfrole', desc: 'Mensagem ephemeral quando o membro perde um cargo' },
  // RPG miscelânea
  'rpg.levelup':           { label: '🌟 Level Up RPG',             category: 'rpg',      desc: 'Notificação de subida de nível no RPG' },
  'rpg.reincarnation':     { label: '✨ Reencarnação RPG',         category: 'rpg',      desc: 'Embed de reencarnação do personagem' },
  'rpg.marriage.proposal': { label: '💍 Proposta de Casamento RPG',category: 'rpg',      desc: 'Proposta de casamento dentro do RPG' },
};

export const EMBED_CATEGORIES: Record<string, string> = {
  geral:       '🎯 Geral',
  rpg:         '⚔️ RPG',
  bossmundial: '🐉 Boss Mundial',
  casamento:   '💍 Casamento',
  missoes:     '📋 Missões',
  alianca:     '🌐 Aliança',
  tickets:     '🎫 Tickets',
  sorteios:    '🎁 Sorteios',
  moderacao:   '🔨 Moderação',
  selfrole:    '🎭 Registro de Cargos',
};

// ── Cache em memória ───────────────────────────────────────────────────
const _cache = new Map<string, EmbedTemplateData>();

export async function loadEmbedTemplates(): Promise<void> {
  try {
    const rows = await prisma.embedTemplate.findMany();
    _cache.clear();
    for (const row of rows) _cache.set(row.key, row as EmbedTemplateData);
    console.log(`✅ ${rows.length} template(s) de embed carregado(s)`);
  } catch (err) {
    console.warn('⚠️ Tabela embed_templates não existe ainda — execute o SQL de migração.');
  }
}

/** Leitura síncrona do cache em memória (útil para applyTemplate em runtime). */
export function getTemplate(key: string): EmbedTemplateData | undefined {
  return _cache.get(key);
}

/**
 * Leitura assíncrona com fallback no banco de dados.
 * Use nos painéis de edição (/embeds) para garantir que o template
 * correto seja exibido mesmo quando o cache ainda não foi populado
 * (ex.: logo após um redeploy no Railway).
 */
export async function fetchTemplate(key: string): Promise<EmbedTemplateData | undefined> {
  if (_cache.has(key)) return _cache.get(key);
  try {
    const row = await prisma.embedTemplate.findUnique({ where: { key } });
    if (row) {
      const cast = row as EmbedTemplateData;
      _cache.set(key, cast);
      return cast;
    }
  } catch { /* ignora erros de DB — retorna undefined */ }
  return undefined;
}

export function applyTemplate(embed: EmbedBuilder, key: string): EmbedBuilder {
  const tpl = getTemplate(key);
  if (!tpl) return embed;

  if (tpl.title)                   embed.setTitle(tpl.title);
  if (tpl.description)             embed.setDescription(tpl.description);
  if (tpl.color !== null && tpl.color !== undefined) embed.setColor(tpl.color as ColorResolvable);
  if (tpl.thumbnailUrl)            embed.setThumbnail(tpl.thumbnailUrl);
  if (tpl.imageUrl)                embed.setImage(tpl.imageUrl);

  if (tpl.footerText && tpl.footerIcon)  embed.setFooter({ text: tpl.footerText, iconURL: tpl.footerIcon });
  else if (tpl.footerText)               embed.setFooter({ text: tpl.footerText });
  else if (tpl.footerIcon) {
    const existing = embed.data.footer;
    if (existing?.text) embed.setFooter({ text: existing.text, iconURL: tpl.footerIcon });
  }

  return embed;
}

// ── CRUD ───────────────────────────────────────────────────────────────

export async function setTemplateField(
  key: string,
  field: keyof Omit<EmbedTemplateData, 'key'>,
  value: string | number | null,
): Promise<EmbedTemplateData> {
  const data: Record<string, unknown> = { [field]: value };
  const updated = await prisma.embedTemplate.upsert({
    where:  { key },
    update: data,
    create: { key, ...data },
  });
  const cast = updated as EmbedTemplateData;
  _cache.set(key, cast);
  return cast;
}

export async function clearTemplate(key: string): Promise<void> {
  await prisma.embedTemplate.deleteMany({ where: { key } }).catch(() => null);
  _cache.delete(key);
}

export function hexToInt(hex: string): number | null {
  const clean = hex.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return parseInt(clean, 16);
}

export function intToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0').toUpperCase();
}

// ── Refresh e validação de URLs do Discord CDN ────────────────────────────────
//
// URLs de attachments do Discord expiram (~24h) E ficam inválidas imediatamente
// quando a mensagem-fonte é deletada — mesmo que o parâmetro `ex=` ainda esteja
// dentro do prazo. Por isso verificamos TODAS as URLs a cada ciclo:
//
//  • URLs que o Discord consegue renovar  → atualiza com o novo token
//  • URLs que o Discord NÃO consegue renovar (mensagem deletada) → remove do
//    banco/cache para que o embed pare de tentar exibir uma imagem quebrada

/** Retorna true se a URL é um attachment do CDN do Discord. */
function isDiscordAttachmentUrl(url: string): boolean {
  return /cdn\.discordapp\.com\/attachments\//.test(url);
}

/**
 * Verifica e renova TODAS as URLs de imagem do Discord nos templates.
 * URLs de mensagens deletadas são automaticamente limpas do banco/cache.
 * Chame no evento ready e a cada 12h.
 */
export async function refreshImageUrls(botToken: string): Promise<void> {
  const imageFields: (keyof EmbedTemplateData)[] = ['imageUrl', 'thumbnailUrl', 'footerIcon'];

  // Coleta TODAS as URLs de attachment do Discord — não apenas as "próximas de expirar".
  // Isso é necessário para detectar URLs de mensagens deletadas: elas ficam 404
  // imediatamente, mas o parâmetro `ex=` ainda pode parecer válido por timestamp.
  const urlToTargets = new Map<string, { key: string; field: keyof EmbedTemplateData }[]>();
  for (const [key, tpl] of _cache.entries()) {
    for (const field of imageFields) {
      const url = tpl[field] as string | null;
      if (url && isDiscordAttachmentUrl(url)) {
        const list = urlToTargets.get(url) ?? [];
        list.push({ key, field });
        urlToTargets.set(url, list);
      }
    }
  }

  if (urlToTargets.size === 0) return;
  console.log(`[EmbedTemplates] Verificando ${urlToTargets.size} URL(s) de imagem...`);

  try {
    const res = await fetch('https://discord.com/api/v10/attachments/refresh-urls', {
      method: 'POST',
      headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachment_urls: [...urlToTargets.keys()] }),
    });

    if (!res.ok) {
      console.warn(`[EmbedTemplates] refresh-urls returned ${res.status}`);
      return;
    }

    const data = await res.json() as { refreshed_urls: { original: string; refreshed: string }[] };

    // Conjunto das URLs originais que o Discord conseguiu renovar
    const refreshedOriginals = new Set(data.refreshed_urls.map(r => r.original));

    // 1. Atualizar as URLs renovadas no banco e no cache
    for (const { original, refreshed } of data.refreshed_urls) {
      for (const { key, field } of urlToTargets.get(original) ?? []) {
        await prisma.embedTemplate.update({ where: { key }, data: { [field]: refreshed } }).catch(() => null);
        const cached = _cache.get(key);
        if (cached) (cached as any)[field] = refreshed;
      }
    }

    // 2. Limpar URLs que o Discord NÃO renovou — mensagem-fonte foi deletada.
    //    Sem esta limpeza, o embed continuaria tentando exibir uma imagem 404.
    let cleared = 0;
    for (const [url, targets] of urlToTargets.entries()) {
      if (refreshedOriginals.has(url)) continue; // renovada com sucesso, ignorar
      for (const { key, field } of targets) {
        await prisma.embedTemplate.update({ where: { key }, data: { [field]: null } }).catch(() => null);
        const cached = _cache.get(key);
        if (cached) (cached as any)[field] = null;
        cleared++;
      }
    }

    const summary = `[EmbedTemplates] ${data.refreshed_urls.length} URL(s) renovada(s)` +
      (cleared > 0 ? `, ${cleared} URL(s) inválida(s) removida(s) (mensagem deletada)` : '') + '.';
    console.log(summary);
  } catch (err) {
    console.error('[EmbedTemplates] Falha ao renovar URLs:', err);
  }
}
