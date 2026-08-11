import {
  ModalSubmitInteraction, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, GuildMember,
} from 'discord.js';
import { prisma } from '../database/client';
import { getConfig, parseDuration, formatDuration, getOrCreateMember } from '../utils/helpers';
import { COLORS, EMOJIS, baseEmbed, successEmbed, errorEmbed, rankEmoji } from '../utils/embeds';
import { checkAdmin, checkModerator } from '../utils/permissions';
import { RANKS, xpForNextLevel } from '../types';
import { isBotManager, cacheAddGuild, cacheRemoveGuild, cacheAddManager, cacheRemoveManager, allowedGuildCount } from '../utils/allowlist';
import { sendLog, LOG } from '../utils/logger';

function resolveId(s: string) { return s.replace(/[<@!>&]/g, '').trim(); }

export async function handleModal(i: ModalSubmitInteraction) {
  const parts = i.customId.split(':');
  const prefix = parts[0];
  const action = parts[1];
  const extra = parts.slice(2);

  try {
    // Mod modals
    if (prefix === 'mod_modal') return await handleModModal(i, action);
    if (prefix === 'cargo_menu') return await handleCargoMenu(i, action, parts);

    // Config modals
    if (prefix === 'modal' && action === 'config') return await handleConfigModal(i, extra[0]);

    // Other modals
    switch (`${prefix}:${action}`) {
      case 'modal:anuncio':         return await sendAnuncio(i);
      case 'modal:poll':            return await createPoll(i);
      case 'modal:sorteio':         return await createSorteio(i);
      case 'modal:encerrar_sorteio': return await encerrarSorteio(i);
      case 'modal:evento':          return await createEvento(i);
      case 'modal:conquista':       return await gerenciarConquista(i);
      case 'modal:nivel_reward':    return await setNivelReward(i);
      case 'modal:admin_economia':  return await adminEconomia(i);
      case 'modal:admin_loja':      return await adminLoja(i);
      case 'modal:rank':            return await setRank(i);
      case 'modal:sugestaosubmit':  return await sendSugestao(i);
      case 'modal:feedbacksubmit':  return await sendFeedback(i);
      case 'modal:transferir':             return await transferirMoedas(i);
      case 'modal:allowlist_add_guild':    return await allowlistAddGuild(i);
      case 'modal:allowlist_remove_guild': return await allowlistRemoveGuild(i);
      case 'modal:allowlist_add_manager':  return await allowlistAddManager(i);
      case 'modal:allowlist_remove_manager': return await allowlistRemoveManager(i);
      case 'rpg_modal:guild_criar': return await (await import('./../rpg/handlers/rpgModalHandler')).handleRpgModal(i, 'guild_criar');
      case 'ticket_fb_modal:submit': return await sendTicketFeedback(i, extra);
    }
    // Alliance modals
    if (prefix === 'alliance_modal') return await (await import('./allianceHandler')).handleAllianceModal(i, action);
    if (prefix === 'servidor_modal')  return await (await import('./allianceHandler')).handleServidorModal(i, action);
    if (prefix === 'ticket_modal') return await ticketModalHandler(i, action, extra);
    if (prefix === 'embedcfg_modal')  return await (await import('./configHandler')).handleEmbedCfgModal(i, action);
    if (prefix === 'embeds_modal')    return await (await import('./embedsHandler')).handleEmbedCfgModal(i, action);
    if (prefix === 'logs_modal')      return await (await import('./logsHandler')).handleLogsModal(i, action);
    if (prefix === 'vip_modal')       return await (await import('./vipHandler')).handleVipModal(i, action, extra);
  } catch (err) {
    console.error('Modal error:', err);
    const e = errorEmbed('Erro', 'Ocorreu um erro ao processar este formulário.');
    try {
      if (i.replied || i.deferred) await i.followUp({ embeds: [e], ephemeral: true });
      else await i.reply({ embeds: [e], ephemeral: true });
    } catch { /* ignore */ }
  }
}

// ─── MOD MODALS ───────────────────────────────────────────────────────────────

async function handleModModal(i: ModalSubmitInteraction, action: string) {
  if (!(await checkModerator(i))) return;
  await i.deferReply({ ephemeral: true });
  const guild = i.guild!;

  const getField = (id: string, required = false) => {
    try { return i.fields.getTextInputValue(id) || null; } catch { return null; }
  };

  if (action === 'ban') {
    const userId = resolveId(getField('usuario', true)!);
    const motivo = getField('motivo', true)!;
    const dias = Math.min(7, Math.max(0, parseInt(getField('dias') ?? '0') || 0));
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado.')] });
      await guild.bans.create(userId, { reason: `${i.user.tag}: ${motivo}`, deleteMessageSeconds: dias * 86400 });
      await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.ERROR).setTitle(`${EMOJIS.HAMMER} Membro Banido`).addFields({ name: 'Usuário', value: `${member.user.tag} (${userId})`, inline: true }, { name: 'Moderador', value: i.user.tag, inline: true }, { name: 'Motivo', value: motivo }));
      await i.editReply({ embeds: [successEmbed('Banido!', `**${member.user.tag}** foi banido.\nMotivo: ${motivo}`)] });
    } catch (err) { await i.editReply({ embeds: [errorEmbed('Erro', `${err}`)] }); }
  }

  else if (action === 'kick') {
    const userId = resolveId(getField('usuario', true)!);
    const motivo = getField('motivo', true)!;
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado.')] });
      await member.kick(`${i.user.tag}: ${motivo}`);
      await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.WARNING).setTitle(`👟 Membro Expulso`).addFields({ name: 'Usuário', value: `${member.user.tag}`, inline: true }, { name: 'Moderador', value: i.user.tag, inline: true }, { name: 'Motivo', value: motivo }));
      await i.editReply({ embeds: [successEmbed('Expulso!', `**${member.user.tag}** foi expulso.\nMotivo: ${motivo}`)] });
    } catch (err) { await i.editReply({ embeds: [errorEmbed('Erro', `${err}`)] }); }
  }

  else if (action === 'mute') {
    const userId = resolveId(getField('usuario', true)!);
    const duracaoStr = getField('duracao', true)!;
    const motivo = getField('motivo') ?? 'Sem motivo';
    const ms = parseDuration(duracaoStr);
    if (!ms) return i.editReply({ embeds: [errorEmbed('Duração inválida', 'Use formatos como: 10m, 1h, 1d')] });
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado.')] });
      await member.timeout(ms, `${i.user.tag}: ${motivo}`);
      await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.WARNING).setTitle(`🔇 Membro Mutado`).addFields({ name: 'Usuário', value: member.user.tag, inline: true }, { name: 'Moderador', value: i.user.tag, inline: true }, { name: 'Duração', value: duracaoStr, inline: true }, { name: 'Motivo', value: motivo }));
      await i.editReply({ embeds: [successEmbed('Mutado!', `**${member.user.tag}** foi mutado por **${duracaoStr}**.\nMotivo: ${motivo}`)] });
    } catch (err) { await i.editReply({ embeds: [errorEmbed('Erro', `${err}`)] }); }
  }

  else if (action === 'unmute') {
    const userId = resolveId(getField('usuario', true)!);
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado.')] });
      await member.timeout(null);
      await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.SUCCESS).setTitle('🔊 Timeout Removido').addFields({ name: '👤 Usuário', value: `${member.user.tag} (${member.id})`, inline: true }, { name: '🔨 Moderador', value: i.user.tag, inline: true }));
      await i.editReply({ embeds: [successEmbed('Desmutado!', `**${member.user.tag}** foi desmutado.`)] });
    } catch (err) { await i.editReply({ embeds: [errorEmbed('Erro', `${err}`)] }); }
  }

  else if (action === 'warn') {
    const userId = resolveId(getField('usuario', true)!);
    const motivo = getField('motivo', true)!;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado.')] });
    await prisma.warn.create({ data: { memberId: userId, guildId: guild.id, moderator: i.user.id, reason: motivo } });
    await prisma.member.upsert({ where: { discordId: userId }, update: { warnings: { increment: 1 } }, create: { discordId: userId, username: member.user.username, warnings: 1 } });
    const total = await prisma.warn.count({ where: { memberId: userId, guildId: guild.id } });
    await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.WARNING).setTitle('⚠️ Membro Advertido').addFields({ name: 'Usuário', value: `${member.user.tag}`, inline: true }, { name: 'Moderador', value: i.user.tag, inline: true }, { name: 'Total avisos', value: `${total}`, inline: true }, { name: 'Motivo', value: motivo }));
    await i.editReply({ embeds: [successEmbed('Advertido!', `**${member.user.tag}** advertido. Total: **${total}** aviso(s).\nMotivo: ${motivo}`)] });
  }

  else if (action === 'warns') {
    const userId = resolveId(getField('usuario', true)!);
    const member = await guild.members.fetch(userId).catch(() => null);
    const warns = await prisma.warn.findMany({ where: { memberId: userId, guildId: guild.id }, orderBy: { createdAt: 'desc' }, take: 10 });
    if (!warns.length) return i.editReply({ embeds: [baseEmbed().setTitle('📋 Avisos').setDescription(`${member?.user.tag ?? userId} não tem avisos.`)] });
    const list = warns.map((w, idx) => `**${idx + 1}.** ${w.reason} — <@${w.moderator}> — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join('\n');
    await i.editReply({ embeds: [baseEmbed(COLORS.WARNING).setTitle(`⚠️ Avisos — ${member?.user.tag ?? userId}`).setDescription(list).setFooter({ text: `${warns.length} aviso(s) recentes` })] });
  }

  else if (action === 'limpar') {
    const qtd = Math.min(100, Math.max(1, parseInt(getField('quantidade', true)!) || 10));
    const channel = i.channel as TextChannel;
    const deleted = await channel.bulkDelete(qtd, true);
    await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.ERROR).setTitle('🗑️ Purge de Mensagens').addFields({ name: '📢 Canal', value: `<#${channel.id}>`, inline: true }, { name: '🔢 Apagadas', value: `${deleted.size}`, inline: true }, { name: '🔨 Moderador', value: i.user.tag, inline: true }));
    await i.editReply({ embeds: [successEmbed('Mensagens Apagadas', `**${deleted.size}** mensagem(ns) apagada(s).`)] });
  }

  else if (action === 'unban') {
    const userId = resolveId(getField('usuario', true)!);
    const motivo = getField('motivo') ?? 'Sem motivo';
    try {
      await guild.bans.remove(userId, `${i.user.tag}: ${motivo}`);
      await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.SUCCESS).setTitle('🚫 Membro Desbanido').addFields({ name: 'ID', value: userId, inline: true }, { name: 'Moderador', value: i.user.tag, inline: true }, { name: 'Motivo', value: motivo }));
      await i.editReply({ embeds: [successEmbed('Desbanido!', `O usuário **${userId}** foi desbanido.`)] });
    } catch (err) { await i.editReply({ embeds: [errorEmbed('Erro', `Não foi possível desbanir: ${err}`)] }); }
  }

  else if (action === 'remover_warn') {
    const userId = resolveId(getField('usuario', true)!);
    const member = await guild.members.fetch(userId).catch(() => null);
    const lastWarn = await prisma.warn.findFirst({ where: { memberId: userId, guildId: guild.id }, orderBy: { createdAt: 'desc' } });
    if (!lastWarn) return i.editReply({ embeds: [errorEmbed('Sem avisos', 'Este usuário não tem avisos.')] });
    await prisma.warn.delete({ where: { id: lastWarn.id } });
    await prisma.member.updateMany({ where: { discordId: userId, warnings: { gt: 0 } }, data: { warnings: { decrement: 1 } } });
    await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.INFO).setTitle('🔄 Aviso Removido').addFields({ name: '👤 Membro', value: `${member?.user.tag ?? userId}`, inline: true }, { name: '🔨 Moderador', value: i.user.tag, inline: true }, { name: '📋 Aviso removido', value: lastWarn.reason, inline: false }));
    await i.editReply({ embeds: [successEmbed('Aviso Removido', `Último aviso de **${member?.user.tag ?? userId}** removido.`)] });
  }

  else if (action === 'slowmode') {
    const segundos = Math.min(21600, Math.max(0, parseInt(getField('segundos', true)!) || 0));
    const channel = i.channel as TextChannel;
    await channel.setRateLimitPerUser(segundos);
    await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.INFO).setTitle('🐢 Slowmode Alterado').addFields({ name: '📢 Canal', value: `<#${channel.id}>`, inline: true }, { name: '⏱️ Valor', value: segundos === 0 ? 'Desativado' : `${segundos}s`, inline: true }, { name: '🔨 Moderador', value: i.user.tag, inline: true }));
    await i.editReply({ embeds: [successEmbed('Slowmode', segundos === 0 ? 'Slowmode desativado.' : `Slowmode definido para **${segundos}s**.`)] });
  }

  else if (action === 'lock') {
    const motivo = getField('motivo') ?? 'Sem motivo';
    const channel = i.channel as TextChannel;
    await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
    await channel.send({ embeds: [baseEmbed(COLORS.ERROR).setDescription(`${EMOJIS.LOCK} Canal trancado por ${i.user}.\nMotivo: ${motivo}`)] });
    await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.ERROR).setTitle('🔒 Canal Trancado').addFields({ name: '📢 Canal', value: `<#${channel.id}>`, inline: true }, { name: '🔨 Moderador', value: i.user.tag, inline: true }, { name: '📋 Motivo', value: motivo, inline: false }));
    await i.editReply({ embeds: [successEmbed('Canal Trancado', `Membros não podem mais enviar mensagens.`)] });
  }

  else if (action === 'unlock') {
    const motivo = getField('motivo') ?? 'Sem motivo';
    const channel = i.channel as TextChannel;
    await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
    await channel.send({ embeds: [baseEmbed(COLORS.SUCCESS).setDescription(`${EMOJIS.UNLOCK} Canal destrancado por ${i.user}.\nMotivo: ${motivo}`)] });
    await sendLog(guild, LOG.MODERATION, baseEmbed(COLORS.SUCCESS).setTitle('🔓 Canal Destrancado').addFields({ name: '📢 Canal', value: `<#${channel.id}>`, inline: true }, { name: '🔨 Moderador', value: i.user.tag, inline: true }, { name: '📋 Motivo', value: motivo, inline: false }));
    await i.editReply({ embeds: [successEmbed('Canal Destrancado', `Membros podem enviar mensagens novamente.`)] });
  }
}

// ─── CONFIG MODALS ────────────────────────────────────────────────────────────

async function handleConfigModal(i: ModalSubmitInteraction, section: string) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const guild = i.guild!;

  const getField = (id: string) => { try { return i.fields.getTextInputValue(id).trim() || null; } catch { return null; } };

  if (section === 'channels') {
    const data: Record<string, string | null> = {
      logChannelId: getField('log'),
      welcomeChannelId: getField('welcome'),
      levelUpChannelId: getField('levelup'),
      suggestionChannelId: getField('suggestion'),
      ticketLogChannelId: getField('ticket_log'),
    };
    const update: any = {};
    for (const [k, v] of Object.entries(data)) if (v !== null) update[k] = v;
    await prisma.guildConfig.upsert({ where: { guildId: guild.id }, update, create: { guildId: guild.id, ...update } });
    await i.editReply({ embeds: [successEmbed('Canais Atualizados', 'Configurações de canais salvas com sucesso.')] });
  }

  else if (section === 'roles') {
    const data: any = {};
    const admin = getField('admin'); if (admin) data.adminRoleId = admin;
    const mod = getField('mod');   if (mod)   data.modRoleId = mod;
    const mem = getField('member');if (mem)   data.memberRoleId = mem;
    const auto = getField('auto'); if (auto)  data.autoRoleId = auto;
    await prisma.guildConfig.upsert({ where: { guildId: guild.id }, update: data, create: { guildId: guild.id, ...data } });
    await i.editReply({ embeds: [successEmbed('Cargos Atualizados', 'Configurações de cargos salvas.')] });
  }

  else if (section === 'xp') {
    const data: any = {};
    const min = parseInt(getField('xp_min') ?? '');  if (!isNaN(min)) data.xpMin = Math.max(1, min);
    const max = parseInt(getField('xp_max') ?? '');  if (!isNaN(max)) data.xpMax = Math.max(1, max);
    const cd = parseInt(getField('cooldown') ?? ''); if (!isNaN(cd))  data.xpCooldown = Math.max(0, cd);
    const spam = getField('antispam');   if (spam !== null) data.antiSpam = spam.toLowerCase() === 'true';
    const links = getField('antilinks'); if (links !== null) data.antiLinks = links.toLowerCase() === 'true';
    await prisma.guildConfig.upsert({ where: { guildId: guild.id }, update: data, create: { guildId: guild.id, ...data } });
    await i.editReply({ embeds: [successEmbed('XP Atualizado', 'Configurações de XP e proteções salvas.')] });
  }

  else if (section === 'welcome') {
    const msg = getField('mensagem');
    await prisma.guildConfig.upsert({ where: { guildId: guild.id }, update: { welcomeMessage: msg }, create: { guildId: guild.id, welcomeMessage: msg } });
    await i.editReply({ embeds: [successEmbed('Mensagem Atualizada', msg ? `Nova mensagem: ${msg}` : 'Mensagem padrão restaurada.')] });
  }
}

// ─── ANÚNCIO ──────────────────────────────────────────────────────────────────

async function sendAnuncio(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const titulo = i.fields.getTextInputValue('titulo');
  const mensagem = i.fields.getTextInputValue('mensagem');
  const canalId = i.fields.getTextInputValue('canal').trim() || null;
  const config = await getConfig(i.guild!.id);
  const channelId = canalId || config.announcementChannelId || i.channelId;
  const channel = i.guild!.channels.cache.get(channelId!) as TextChannel | undefined;
  if (!channel) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', 'Configure o canal de anúncios ou informe um ID válido.')] });
  const embed = baseEmbed(COLORS.PRIMARY)
    .setTitle(`${EMOJIS.MEGAPHONE} ${titulo}`)
    .setDescription(mensagem)
    .setFooter({ text: `⚔️ Aliança Skyline • ${i.user.tag}` })
    .setTimestamp();
  await channel.send({ embeds: [embed] });
  await i.editReply({ embeds: [successEmbed('Anúncio Enviado!', `Publicado em ${channel}.`)] });
}

// ─── POLL ─────────────────────────────────────────────────────────────────────

async function createPoll(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const pergunta = i.fields.getTextInputValue('pergunta');
  const opcoes = i.fields.getTextInputValue('opcoes').split('\n').map(o => o.trim()).filter(Boolean).slice(0, 4);
  if (opcoes.length < 2) return i.editReply({ embeds: [errorEmbed('Poucas opções', 'Informe pelo menos 2 opções.')] });
  const duracaoStr = i.fields.getTextInputValue('duracao').trim();
  const ms = parseDuration(duracaoStr);
  const endsAt = ms ? new Date(Date.now() + ms) : null;
  const channelId = i.channelId!;
  const poll = await prisma.poll.create({ data: { guildId: i.guild!.id, channelId, question: pergunta, createdBy: i.user.id, endsAt } });
  await prisma.pollOption.createMany({ data: opcoes.map(label => ({ pollId: poll.id, label })) });
  const options = await prisma.pollOption.findMany({ where: { pollId: poll.id } });
  const embed = baseEmbed(COLORS.INFO)
    .setTitle(`📊 ${pergunta}`)
    .setDescription(options.map((o, idx) => `**${idx + 1}.** ${o.label} — 0 votos`).join('\n'))
    .setFooter({ text: `Encerra ${endsAt ? `<t:${Math.floor(endsAt.getTime() / 1000)}:R>` : 'sem prazo'} • ⚔️ Aliança Skyline` });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...options.map((o, idx) => new ButtonBuilder().setCustomId(`poll:vote:${poll.id}:${o.id}`).setLabel(`${idx + 1}`).setStyle(ButtonStyle.Secondary))
  );
  const channel = i.guild!.channels.cache.get(channelId) as TextChannel;
  const msg = await channel.send({ embeds: [embed], components: [row] });
  await prisma.poll.update({ where: { id: poll.id }, data: { messageId: msg.id } });
  await i.editReply({ embeds: [successEmbed('Enquete Criada!', `Publicada em ${channel}.`)] });
}

// ─── SORTEIO ──────────────────────────────────────────────────────────────────

async function createSorteio(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const premio = i.fields.getTextInputValue('premio');
  const vencedores = Math.max(1, parseInt(i.fields.getTextInputValue('vencedores')) || 1);
  const duracaoStr = i.fields.getTextInputValue('duracao');
  const ms = parseDuration(duracaoStr);
  if (!ms) return i.editReply({ embeds: [errorEmbed('Duração inválida', 'Use: 10m, 1h, 1d')] });
  const endsAt = new Date(Date.now() + ms);
  const channel = i.channel as TextChannel;
  const giveaway = await prisma.giveaway.create({ data: { guildId: i.guild!.id, channelId: channel.id, prize: premio, winners: vencedores, hostId: i.user.id, endsAt } });
  const embed = baseEmbed(COLORS.GOLD)
    .setTitle(`🎁 Sorteio — ${premio}`)
    .addFields(
      { name: '🏆 Vencedores', value: `**${vencedores}**`, inline: true },
      { name: '⏰ Encerra', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
      { name: '👑 Criado por', value: `${i.user}`, inline: true },
    )
    .setFooter({ text: '0 participantes • ⚔️ Aliança Skyline' });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`giveaway:join:${giveaway.id}`).setLabel('Participar').setEmoji('🎁').setStyle(ButtonStyle.Success)
  );
  const msg = await channel.send({ embeds: [embed], components: [row] });
  await prisma.giveaway.update({ where: { id: giveaway.id }, data: { messageId: msg.id } });
  await i.editReply({ embeds: [successEmbed('Sorteio Criado!', `Sorteio de **${premio}** publicado em ${channel}.\nID: \`${giveaway.id}\``)] });
}

// ─── ENCERRAR SORTEIO ─────────────────────────────────────────────────────────

async function encerrarSorteio(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const id = i.fields.getTextInputValue('id').trim();
  const giveaway = await prisma.giveaway.findUnique({ where: { id }, include: { entries: { include: { member: true } } } });
  if (!giveaway || giveaway.guildId !== i.guild!.id) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Sorteio não encontrado.')] });
  if (giveaway.ended) return i.editReply({ embeds: [errorEmbed('Já encerrado', 'Este sorteio já foi encerrado.')] });
  const shuffled = [...giveaway.entries].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, giveaway.winners);
  const winnerMentions = chosen.map(e => `<@${e.member.discordId}>`).join(', ') || 'Nenhum participante.';
  await prisma.giveaway.update({ where: { id }, data: { ended: true, winnerIds: chosen.map(e => e.member.discordId) } });
  const channel = i.guild!.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
  if (channel) {
    await channel.send({ embeds: [baseEmbed(COLORS.GOLD).setTitle('🎉 Sorteio Encerrado!').setDescription(`**Prêmio:** ${giveaway.prize}\n**Vencedor(es):** ${winnerMentions}`).setFooter({ text: '⚔️ Aliança Skyline' })] });
    if (giveaway.messageId) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) await msg.edit({ components: [] }).catch(() => null);
    }
  }
  await i.editReply({ embeds: [successEmbed('Encerrado!', `Vencedor(es): ${winnerMentions}`)] });
}

// ─── EVENTO ───────────────────────────────────────────────────────────────────

async function createEvento(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const titulo = i.fields.getTextInputValue('titulo');
  const descricao = i.fields.getTextInputValue('descricao').trim() || null;
  const inicioStr = i.fields.getTextInputValue('inicio');
  const ms = parseDuration(inicioStr);
  if (!ms) return i.editReply({ embeds: [errorEmbed('Duração inválida', 'Use: 30m, 1h, 2d')] });
  const startsAt = new Date(Date.now() + ms);
  const channel = i.channel as TextChannel;
  const event = await prisma.event.create({ data: { guildId: i.guild!.id, channelId: channel.id, title: titulo, description: descricao, hostId: i.user.id, startsAt } });
  const embed = baseEmbed(COLORS.INFO)
    .setTitle(`📌 Evento — ${titulo}`)
    .setDescription(descricao ?? 'Sem descrição.')
    .addFields(
      { name: '⏰ Início', value: `<t:${Math.floor(startsAt.getTime() / 1000)}:R>`, inline: true },
      { name: '👑 Criado por', value: `${i.user}`, inline: true },
    )
    .setFooter({ text: '0 inscritos • ⚔️ Aliança Skyline' });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`event:join:${event.id}`).setLabel('Participar').setEmoji('📌').setStyle(ButtonStyle.Primary)
  );
  const msg = await channel.send({ embeds: [embed], components: [row] });
  await prisma.event.update({ where: { id: event.id }, data: { messageId: msg.id } });
  await i.editReply({ embeds: [successEmbed('Evento Criado!', `**${titulo}** publicado em ${channel}.`)] });
}

// ─── CONQUISTA ────────────────────────────────────────────────────────────────

async function gerenciarConquista(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const acao = i.fields.getTextInputValue('acao').trim().toLowerCase();
  const nome = i.fields.getTextInputValue('nome').trim();
  const detalhes = i.fields.getTextInputValue('descricao').trim();
  const recompensaStr = i.fields.getTextInputValue('recompensa').trim() || '0,0';

  if (acao === 'criar') {
    const [xpR, coinsR] = recompensaStr.split(',').map(Number);
    const exists = await prisma.achievementTemplate.findFirst({ where: { guildId: i.guild!.id, name: nome } });
    if (exists) return i.editReply({ embeds: [errorEmbed('Já existe', `Conquista **${nome}** já existe.`)] });
    await prisma.achievementTemplate.create({ data: { guildId: i.guild!.id, name: nome, description: detalhes, xpReward: xpR || 0, coinsReward: coinsR || 0 } });
    await i.editReply({ embeds: [successEmbed('Conquista Criada!', `**${nome}** criada com ${xpR || 0} XP e ${coinsR || 0} moedas.`)] });
  } else if (acao === 'dar') {
    const userId = resolveId(detalhes);
    const template = await prisma.achievementTemplate.findFirst({ where: { guildId: i.guild!.id, name: nome } });
    if (!template) return i.editReply({ embeds: [errorEmbed('Não encontrada', `Conquista **${nome}** não existe.`)] });
    const member = await i.guild!.members.fetch(userId).catch(() => null);
    if (!member) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado.')] });
    const m = await getOrCreateMember(userId, member.user.username);
    const alreadyHas = await prisma.achievement.findFirst({ where: { memberId: m.discordId, name: nome } });
    if (alreadyHas) return i.editReply({ embeds: [errorEmbed('Já possui', `${member} já tem **${nome}**.`)] });
    await prisma.achievement.create({ data: { memberId: m.discordId, name: nome, description: template.description } });
    if (template.xpReward > 0) await prisma.member.update({ where: { discordId: userId }, data: { xp: { increment: template.xpReward } } });
    if (template.coinsReward > 0) await prisma.member.update({ where: { discordId: userId }, data: { coins: { increment: template.coinsReward } } });
    await i.editReply({ embeds: [successEmbed('Conquista Concedida!', `**${nome}** foi dada para ${member}.`)] });
  } else {
    await i.editReply({ embeds: [errorEmbed('Ação inválida', 'Use "criar" ou "dar".')] });
  }
}

// ─── NÍVEL REWARD ─────────────────────────────────────────────────────────────

async function setNivelReward(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const nivel = parseInt(i.fields.getTextInputValue('nivel'));
  const cargoId = i.fields.getTextInputValue('cargo').trim() || null;
  const moedas = parseInt(i.fields.getTextInputValue('moedas').trim()) || 0;
  if (isNaN(nivel) || nivel < 1) return i.editReply({ embeds: [errorEmbed('Nível inválido', 'Informe um nível válido.')] });
  if (!cargoId) {
    await prisma.levelReward.deleteMany({ where: { guildId: i.guild!.id, level: nivel } });
    return i.editReply({ embeds: [successEmbed('Removido', `Recompensa do nível ${nivel} removida.`)] });
  }
  await prisma.levelReward.upsert({
    where: { guildId_level: { guildId: i.guild!.id, level: nivel } },
    update: { roleId: cargoId, coins: moedas },
    create: { guildId: i.guild!.id, level: nivel, roleId: cargoId, coins: moedas },
  });
  await i.editReply({ embeds: [successEmbed('Recompensa Configurada!', `Nível **${nivel}** → <@&${cargoId}>${moedas > 0 ? ` + **${moedas}** moedas` : ''}.`)] });
}

// ─── ADMIN ECONOMIA ───────────────────────────────────────────────────────────

async function adminEconomia(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const acao = i.fields.getTextInputValue('acao').trim().toLowerCase();
  const tipo = i.fields.getTextInputValue('tipo').trim().toLowerCase();
  const userId = resolveId(i.fields.getTextInputValue('usuario'));
  const quantidade = parseInt(i.fields.getTextInputValue('quantidade'));
  if (isNaN(quantidade) || quantidade <= 0) return i.editReply({ embeds: [errorEmbed('Quantidade inválida', 'Informe um número positivo.')] });
  const member = await i.guild!.members.fetch(userId).catch(() => null);
  if (!member) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado.')] });
  const m = await getOrCreateMember(userId, member.user.username);
  if (tipo === 'moedas') {
    const delta = acao === 'dar' ? quantidade : -quantidade;
    const novas = Math.max(0, m.coins + delta);
    await prisma.member.update({ where: { discordId: userId }, data: { coins: novas } });
    await i.editReply({ embeds: [successEmbed('Economia Atualizada', `${acao === 'dar' ? '+' : '-'}**${quantidade}** moedas para ${member}.\nNovo saldo: **${novas}** moedas.`)] });
  } else if (tipo === 'xp') {
    const delta = acao === 'dar' ? quantidade : -quantidade;
    const novoXp = Math.max(0, m.xp + delta);
    await prisma.member.update({ where: { discordId: userId }, data: { xp: novoXp } });
    await i.editReply({ embeds: [successEmbed('XP Atualizado', `${acao === 'dar' ? '+' : '-'}**${quantidade}** XP para ${member}.\nNovo XP: **${novoXp}**.`)] });
  } else {
    await i.editReply({ embeds: [errorEmbed('Tipo inválido', 'Use "moedas" ou "xp".')] });
  }
}

// ─── ADMIN LOJA ───────────────────────────────────────────────────────────────

async function adminLoja(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const acao = i.fields.getTextInputValue('acao').trim().toLowerCase();
  const nome = i.fields.getTextInputValue('nome').trim();
  const guildId = i.guild!.id;
  if (acao === 'criar') {
    const precoStr = i.fields.getTextInputValue('preco').trim();
    const preco = parseInt(precoStr);
    if (isNaN(preco) || preco <= 0) return i.editReply({ embeds: [errorEmbed('Preço inválido', 'Informe um preço válido.')] });
    const descricao = i.fields.getTextInputValue('descricao').trim();
    const cargoId = i.fields.getTextInputValue('cargo').trim() || null;
    const exists = await prisma.shopItem.findFirst({ where: { guildId, name: nome } });
    if (exists) return i.editReply({ embeds: [errorEmbed('Já existe', `O item **${nome}** já está na loja.`)] });
    await prisma.shopItem.create({ data: { guildId, name: nome, description: descricao, price: preco, roleId: cargoId } });
    await i.editReply({ embeds: [successEmbed('Item Criado!', `**${nome}** adicionado por **${preco}** moedas.`)] });
  } else if (acao === 'remover') {
    const item = await prisma.shopItem.findFirst({ where: { guildId, name: nome } });
    if (!item) return i.editReply({ embeds: [errorEmbed('Não encontrado', `Item **${nome}** não existe.`)] });
    await prisma.shopItem.update({ where: { id: item.id }, data: { active: false } });
    await i.editReply({ embeds: [successEmbed('Item Removido', `**${nome}** foi removido da loja.`)] });
  } else {
    await i.editReply({ embeds: [errorEmbed('Ação inválida', 'Use "criar" ou "remover".')] });
  }
}

// ─── RANK ─────────────────────────────────────────────────────────────────────

async function setRank(i: ModalSubmitInteraction) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });
  const userId = resolveId(i.fields.getTextInputValue('usuario'));
  const rank = i.fields.getTextInputValue('rank').trim();
  if (!RANKS.includes(rank as any)) return i.editReply({ embeds: [errorEmbed('Rank inválido', `Ranks válidos: ${RANKS.join(', ')}`)] });
  const member = await i.guild!.members.fetch(userId).catch(() => null);
  if (!member) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado.')] });
  await prisma.member.upsert({ where: { discordId: userId }, update: { rank }, create: { discordId: userId, username: member.user.username, rank } });
  await i.editReply({ embeds: [successEmbed('Rank Definido!', `${member} agora é **${rank}** ${rankEmoji(rank)}.`)] });
}

// ─── SUGESTÃO ─────────────────────────────────────────────────────────────────

async function sendSugestao(i: ModalSubmitInteraction) {
  await i.deferReply({ ephemeral: true });
  const titulo = i.fields.getTextInputValue('titulo');
  const descricao = i.fields.getTextInputValue('descricao');
  const config = await getConfig(i.guild!.id);
  if (!config.suggestionChannelId) return i.editReply({ embeds: [errorEmbed('Não configurado', 'Canal de sugestões não configurado. Use `/admin` → Configurações → Canais.')] });
  const channel = i.guild!.channels.cache.get(config.suggestionChannelId) as TextChannel | undefined;
  if (!channel) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', 'Canal de sugestões não encontrado.')] });
  const embed = baseEmbed(COLORS.INFO)
    .setTitle(`💡 ${titulo}`)
    .setDescription(descricao)
    .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
    .setTimestamp();
  const msg = await channel.send({ embeds: [embed] });
  await msg.react('✅').catch(() => null);
  await msg.react('❌').catch(() => null);
  await i.editReply({ embeds: [successEmbed('Sugestão Enviada!', 'Sua sugestão foi enviada para votação.')] });
}

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────

async function sendFeedback(i: ModalSubmitInteraction) {
  await i.deferReply({ ephemeral: true });
  const nota = i.fields.getTextInputValue('nota').trim();
  const mensagem = i.fields.getTextInputValue('mensagem');
  const notaNum = parseInt(nota);
  if (isNaN(notaNum) || notaNum < 1 || notaNum > 10) return i.editReply({ embeds: [errorEmbed('Nota inválida', 'A nota deve ser entre 1 e 10.')] });
  const config = await getConfig(i.guild!.id);
  const channelId = config.feedbackChannelId ?? config.logChannelId;
  if (!channelId) return i.editReply({ embeds: [errorEmbed('Não configurado', 'Canal de feedback não configurado.')] });
  const channel = i.guild!.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', 'Canal de feedback não encontrado.')] });
  const stars = '⭐'.repeat(Math.min(10, notaNum));
  const embed = baseEmbed(notaNum >= 7 ? COLORS.SUCCESS : notaNum >= 4 ? COLORS.WARNING : COLORS.ERROR)
    .setTitle(`📝 Feedback — ${nota}/10`)
    .setDescription(`${stars}\n\n${mensagem}`)
    .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
    .setTimestamp();
  await channel.send({ embeds: [embed] });
  await i.editReply({ embeds: [successEmbed('Feedback Enviado!', 'Obrigado pelo seu feedback!')] });
}

// ─── ALLOWLIST ────────────────────────────────────────────────────────────────

async function allowlistAddGuild(i: ModalSubmitInteraction) {
  await i.deferReply({ ephemeral: true });
  if (!isBotManager(i.user.id)) return i.editReply({ embeds: [errorEmbed('Acesso Negado', 'Apenas donos e managers do bot podem fazer isso.')] });

  const guildId  = i.fields.getTextInputValue('guild_id').trim();
  const nota     = (() => { try { return i.fields.getTextInputValue('nota').trim() || null; } catch { return null; } })();
  if (!/^\d{17,20}$/.test(guildId)) return i.editReply({ embeds: [errorEmbed('ID inválido', 'O ID do servidor deve ter entre 17 e 20 dígitos numéricos.')] });

  const guildObj  = i.client.guilds.cache.get(guildId);
  const guildName = guildObj?.name ?? nota ?? guildId;

  await prisma.allowedGuild.upsert({
    where:  { guildId },
    update: { active: true, guildName, note: nota, addedBy: i.user.id },
    create: { guildId, guildName, note: nota, addedBy: i.user.id },
  });
  cacheAddGuild(guildId);

  return i.editReply({
    embeds: [
      successEmbed('Servidor Autorizado!',
        `**${guildName}** (\`${guildId}\`) adicionado à allowlist.\n\n` +
        `✅ **Total autorizado:** ${allowedGuildCount()} servidor(es)\n` +
        (guildObj ? `🟢 O bot já está neste servidor.` : `⚠️ O bot ainda não está neste servidor — convide-o lá para ativar.`))
    ],
  });
}

async function allowlistRemoveGuild(i: ModalSubmitInteraction) {
  await i.deferReply({ ephemeral: true });
  if (!isBotManager(i.user.id)) return i.editReply({ embeds: [errorEmbed('Acesso Negado', 'Apenas donos e managers do bot podem fazer isso.')] });

  const guildId = i.fields.getTextInputValue('guild_id').trim();
  if (!/^\d{17,20}$/.test(guildId)) return i.editReply({ embeds: [errorEmbed('ID inválido', 'O ID do servidor deve ter entre 17 e 20 dígitos numéricos.')] });

  const existing = await prisma.allowedGuild.findUnique({ where: { guildId } });
  if (!existing || !existing.active) return i.editReply({ embeds: [errorEmbed('Não encontrado', `ID \`${guildId}\` não está na allowlist.`)] });

  await prisma.allowedGuild.update({ where: { guildId }, data: { active: false } });
  cacheRemoveGuild(guildId);

  const guildObj = i.client.guilds.cache.get(guildId);
  if (guildObj) await guildObj.leave().catch(() => null);

  return i.editReply({
    embeds: [
      successEmbed('Servidor Removido',
        `**${existing.guildName ?? guildId}** (\`${guildId}\`) removido da allowlist.\n` +
        (guildObj ? '🚪 O bot saiu do servidor automaticamente.\n' : '') +
        `\n✅ **Total restante:** ${allowedGuildCount()} servidor(es)`)
    ],
  });
}

async function allowlistAddManager(i: ModalSubmitInteraction) {
  await i.deferReply({ ephemeral: true });
  // Só donos podem adicionar managers
  const { isBotOwner } = await import('../utils/allowlist');
  if (!isBotOwner(i.user.id)) return i.editReply({ embeds: [errorEmbed('Acesso Negado', 'Apenas donos do bot podem adicionar managers.')] });

  const userId   = i.fields.getTextInputValue('user_id').trim();
  const username = (() => { try { return i.fields.getTextInputValue('username').trim() || null; } catch { return null; } })();
  if (!/^\d{17,20}$/.test(userId)) return i.editReply({ embeds: [errorEmbed('ID inválido', 'O ID do usuário deve ter entre 17 e 20 dígitos numéricos.')] });

  await prisma.botManager.upsert({
    where:  { userId },
    update: { username: username ?? undefined, addedBy: i.user.id },
    create: { userId, username: username ?? undefined, addedBy: i.user.id },
  });
  cacheAddManager(userId);

  return i.editReply({
    embeds: [successEmbed('Manager Adicionado', `<@${userId}>${username ? ` (${username})` : ''} agora pode gerenciar a allowlist do bot.`)],
  });
}

async function allowlistRemoveManager(i: ModalSubmitInteraction) {
  await i.deferReply({ ephemeral: true });
  const { isBotOwner } = await import('../utils/allowlist');
  if (!isBotOwner(i.user.id)) return i.editReply({ embeds: [errorEmbed('Acesso Negado', 'Apenas donos do bot podem remover managers.')] });

  const userId = i.fields.getTextInputValue('user_id').trim();
  if (!/^\d{17,20}$/.test(userId)) return i.editReply({ embeds: [errorEmbed('ID inválido', 'O ID do usuário deve ter entre 17 e 20 dígitos numéricos.')] });

  const existing = await prisma.botManager.findUnique({ where: { userId } });
  if (!existing) return i.editReply({ embeds: [errorEmbed('Não encontrado', `<@${userId}> não é manager.`)] });

  await prisma.botManager.delete({ where: { userId } });
  cacheRemoveManager(userId);

  return i.editReply({ embeds: [successEmbed('Manager Removido', `<@${userId}> não é mais manager do bot.`)] });
}

// ─── TRANSFERIR ───────────────────────────────────────────────────────────────

async function transferirMoedas(i: ModalSubmitInteraction) {
  await i.deferReply({ ephemeral: true });
  const userId = resolveId(i.fields.getTextInputValue('usuario'));
  const quantidade = parseInt(i.fields.getTextInputValue('quantidade'));
  if (isNaN(quantidade) || quantidade <= 0) return i.editReply({ embeds: [errorEmbed('Quantidade inválida', 'Informe um valor positivo.')] });
  if (userId === i.user.id) return i.editReply({ embeds: [errorEmbed('Inválido', 'Não pode transferir para si mesmo.')] });
  const target = await i.guild!.members.fetch(userId).catch(() => null);
  if (!target || target.user.bot) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não encontrado ou é um bot.')] });
  const remetente = await getOrCreateMember(i.user.id, i.user.username);
  if (remetente.coins < quantidade) return i.editReply({ embeds: [errorEmbed('Saldo insuficiente', `Você tem apenas **${remetente.coins}** moedas.`)] });
  await getOrCreateMember(userId, target.user.username);
  await prisma.$transaction([
    prisma.member.update({ where: { discordId: i.user.id }, data: { coins: { decrement: quantidade } } }),
    prisma.member.update({ where: { discordId: userId }, data: { coins: { increment: quantidade } } }),
  ]);
  await i.editReply({ embeds: [successEmbed('Transferência Realizada!', `${EMOJIS.COINS} **${quantidade}** moedas enviadas para ${target}.\nNovo saldo: **${remetente.coins - quantidade}** moedas.`)] });
}

// ── Cargo Menu — criar e adicionar cargos ────────────────────────────────────
async function handleCargoMenu(i: ModalSubmitInteraction, action: string, _parts: string[]) {
  if (!(await checkAdmin(i))) return;
  await i.deferReply({ ephemeral: true });

  const guildId = i.guildId!;
  const getField = (id: string) => { try { return i.fields.getTextInputValue(id).trim() || null; } catch { return null; } };

  // Resolve o canal a partir do campo 'canal' do modal (sempre obrigatório)
  const rawCanal = (getField('canal') ?? '').replace(/[<#>]/g, '');
  const channelId: string = rawCanal || i.channelId!;
  const targetChannel = i.guild?.channels.cache.get(channelId) as TextChannel | undefined;

  // ── Criar Menu ───────────────────────────────────────────────────────
  if (action === 'criar') {
    // channelId pode vir de parts[2] (fluxo via ChannelSelectMenu) ou do campo 'canal' (fluxo legado)
    const chanFromParts = _parts[2] ?? null;
    const resolvedChannelId = chanFromParts ?? channelId;
    const resolvedChannel = i.guild?.channels.cache.get(resolvedChannelId) as TextChannel | undefined;

    if (!resolvedChannel) {
      return i.editReply({ embeds: [errorEmbed('Canal não encontrado', `O canal \`${resolvedChannelId}\` não existe neste servidor.`)] });
    }
    const titulo    = getField('titulo')!;
    const descricao = getField('descricao');
    await prisma.selfRoleMenu.create({ data: { guildId, channelId: resolvedChannelId, title: titulo, description: descricao } });
    return i.editReply({
      embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('✅ Menu Criado!')
        .setDescription(`Menu **${titulo}** criado para ${resolvedChannel}.\n\nAgora clique em **➕ Adicionar Cargo** para adicionar cargos, depois em **📤 Publicar** para enviar ao canal.`)],
    });
  }

  // ── Adicionar Cargo ──────────────────────────────────────────────────
  if (action === 'adicionar') {
    const menu = await prisma.selfRoleMenu.findFirst({
      where: { guildId, channelId },
      include: { entries: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!menu) {
      return i.editReply({ embeds: [errorEmbed('Sem Menu', `Nenhum menu encontrado para <#${channelId}>. Crie um primeiro.`)] });
    }
    if (menu.entries.length >= 25) {
      return i.editReply({ embeds: [errorEmbed('Limite', 'Um menu pode ter no máximo 25 cargos.')] });
    }
    const rawId = (getField('role_id') ?? '').replace(/[<@&>]/g, '');
    const label = getField('label')!;
    const emoji = getField('emoji');
    if (!/^\d{17,20}$/.test(rawId)) {
      return i.editReply({ embeds: [errorEmbed('ID Inválido', 'Informe o ID numérico do cargo (17-20 dígitos).')] });
    }
    const role = i.guild?.roles.cache.get(rawId);
    if (!role) {
      return i.editReply({ embeds: [errorEmbed('Cargo não encontrado', `O cargo \`${rawId}\` não existe neste servidor.`)] });
    }
    await prisma.selfRoleEntry.create({ data: { menuId: menu.id, roleId: rawId, label, emoji } });
    const count = await prisma.selfRoleEntry.count({ where: { menuId: menu.id } });
    return i.editReply({
      embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('✅ Cargo Adicionado!')
        .setDescription(`${emoji ?? '🏷️'} **${label}** → ${role} adicionado.\nTotal: **${count}** cargo(s). Use **📤 Publicar** para atualizar o menu em <#${channelId}>.`)],
    });
  }

  // ── Publicar Menu ────────────────────────────────────────────────────
  if (action === 'publicar') {
    if (!targetChannel) {
      return i.editReply({ embeds: [errorEmbed('Canal não encontrado', `O canal \`${channelId}\` não existe neste servidor.`)] });
    }
    const menu = await prisma.selfRoleMenu.findFirst({
      where: { guildId, channelId },
      include: { entries: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!menu) {
      return i.editReply({ embeds: [errorEmbed('Sem Menu', `Nenhum menu encontrado para ${targetChannel}. Crie um primeiro.`)] });
    }
    if (!menu.entries.length) {
      return i.editReply({ embeds: [errorEmbed('Menu Vazio', 'Adicione pelo menos um cargo antes de publicar.')] });
    }
    const { buildMenuMessage } = await import('../utils/selfRole');
    const msgData = buildMenuMessage(menu);
    const ch = targetChannel as any;
    if (menu.messageId) {
      try {
        const msg = await ch.messages.fetch(menu.messageId);
        await msg.edit(msgData);
        return i.editReply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ Menu **${menu.title}** atualizado em ${targetChannel}!`)] });
      } catch { /* mensagem deletada, enviar nova */ }
    }
    const msg = await ch.send(msgData);
    await prisma.selfRoleMenu.update({ where: { id: menu.id }, data: { messageId: msg.id } });
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ Menu **${menu.title}** publicado em ${targetChannel} com **${menu.entries.length}** cargo(s)!`)] });
  }

  // ── Remover Cargo ────────────────────────────────────────────────────
  if (action === 'remover') {
    const menu = await prisma.selfRoleMenu.findFirst({
      where: { guildId, channelId },
      include: { entries: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!menu) {
      return i.editReply({ embeds: [errorEmbed('Sem Menu', `Nenhum menu encontrado para <#${channelId}>.`)] });
    }
    const rawId = (getField('role_id') ?? '').replace(/[<@&>]/g, '');
    const entry = menu.entries.find(e => e.roleId === rawId);
    if (!entry) {
      return i.editReply({ embeds: [errorEmbed('Não Encontrado', `O cargo \`${rawId}\` não está neste menu.`)] });
    }
    await prisma.selfRoleEntry.delete({ where: { id: entry.id } });
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ Cargo removido do menu. Use **📤 Publicar** para atualizar a mensagem em <#${channelId}>.`)] });
  }
}

// ─── TICKET FEEDBACK MODAL ────────────────────────────────────────────────────

async function sendTicketFeedback(i: ModalSubmitInteraction, extra: string[]) {
  const [ticketId, guildId, closedById, starStr] = extra;
  const star = parseInt(starStr);
  if (isNaN(star) || star < 1 || star > 5) {
    return i.reply({ content: '❌ Avaliação inválida.', ephemeral: true });
  }

  const descricao = (() => {
    try { return i.fields.getTextInputValue('descricao').trim() || null; } catch { return null; }
  })();

  await i.deferReply({ ephemeral: true });

  // Busca o guild pelo cliente (interação pode vir de DM)
  const guild = i.client.guilds.cache.get(guildId) ?? await i.client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return i.editReply({ content: '❌ Servidor não encontrado.' });

  const config = await getConfig(guildId);
  const channelId = config.feedbackChannelId;
  if (!channelId) return i.editReply({ content: '⚠️ Canal de feedback não configurado. Use `/admin` para definir o canal de feedback.' });

  const channel = await i.client.channels.fetch(channelId).catch(() => null) as TextChannel | null;
  if (!channel?.isTextBased()) return i.editReply({ content: '❌ Canal de feedback não encontrado.' });

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } }).catch(() => null);

  const filled   = '⭐'.repeat(star);
  const empty    = '☆'.repeat(5 - star);
  const color    = star >= 4 ? COLORS.SUCCESS : star >= 3 ? COLORS.WARNING : COLORS.ERROR;

  const embed = baseEmbed(color)
    .setTitle('📝 Feedback de Atendimento')
    .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
    .addFields(
      { name: '👤 Usuário',    value: `<@${i.user.id}>`,                                              inline: true },
      { name: '🛡️ Atendente', value: ticket?.claimedBy ? `<@${ticket.claimedBy}>` : 'Não assumido',  inline: true },
      { name: '⭐ Nota',       value: `${filled}${empty}  **${star}/5**`,                             inline: false },
      { name: '💬 Comentário', value: descricao ?? '*Sem comentário.*' },
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  await i.editReply({ content: '✅ Feedback enviado. Obrigado pela avaliação!' });
}

// ─── Modais do Ticket Staff ───────────────────────────────────────────────────
async function ticketModalHandler(i: ModalSubmitInteraction, action: string, extra: string[]) {
  if (!i.guild) return i.reply({ embeds: [errorEmbed('Erro', 'Use em um servidor.')], ephemeral: true });

  const member  = i.member as GuildMember;
  const config  = await getConfig(i.guild.id);
  const isMod   = i.guild.ownerId === i.user.id
    || member.permissions.has('ManageGuild')
    || (config.modRoleId   ? member.roles.cache.has(config.modRoleId)   : false)
    || (config.adminRoleId ? member.roles.cache.has(config.adminRoleId) : false);

  if (!isMod) {
    const msg = { embeds: [errorEmbed('Sem Permissão', 'Apenas staff pode usar este painel.')], ephemeral: true as const };
    if (i.replied || i.deferred) await i.followUp(msg).catch(() => null);
    else await i.reply(msg).catch(() => null);
    return;
  }

  await i.deferReply({ ephemeral: true });

  const getField = (id: string) => {
    try { return i.fields.getTextInputValue(id).trim() || null; } catch { return null; }
  };

  const ticketId = extra[0];
  const ticket   = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Ticket não encontrado.')] });

  const rawId  = getField('user_id');
  const userId = rawId?.replace(/[<@!>]/g, '').trim() ?? '';
  if (!userId) return i.editReply({ embeds: [errorEmbed('ID inválido', 'Informe um ID ou menção válida.')] });

  const targetMember = await i.guild.members.fetch(userId).catch(() => null);
  if (!targetMember) return i.editReply({ embeds: [errorEmbed('Membro não encontrado', `Não encontrei o usuário \`${userId}\` neste servidor.`)] });

  const ch = i.guild.channels.cache.get(ticket.channelId) as TextChannel | undefined;
  if (!ch) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', 'O canal do ticket não foi encontrado.')] });

  if (action === 'add_member') {
    await ch.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
    return i.editReply({ embeds: [successEmbed('Membro Adicionado', `${targetMember} foi adicionado ao ticket.`)] });
  }

  if (action === 'remove_member') {
    if (targetMember.id === ticket.authorId) {
      return i.editReply({ embeds: [errorEmbed('Não permitido', 'Não é possível remover o autor do ticket.')] });
    }
    await ch.permissionOverwrites.delete(targetMember.id).catch(() => null);
    return i.editReply({ embeds: [successEmbed('Membro Removido', `${targetMember} foi removido do ticket.`)] });
  }
}
