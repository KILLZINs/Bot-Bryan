// ═══════════════════════════════════════════════════════════════════════
// SISTEMA "RACHÃO" — fase 2
// A "pelada" é um CLÃ: um grupo persistente que não tem modo e não
// "finaliza" — é tipo um time/comunidade fixa. Dentro do clã acontecem
// PARTIDAS de verdade (cada uma com seu modo, futsal ou campo, com
// times, eventos e placar). As estatísticas de cada jogador ficam
// separadas por modo — futsal e campo contam pontos/XP diferentes.
// Comandos do Discord e o site chamam SOMENTE essas funções.
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';

export type FutMode = 'futsal' | 'campo';
export type FutEventType =
  | 'gol' | 'assistencia' | 'defesa' | 'concedido' | 'erro'
  | 'desarme' | 'boa_jogada' | 'bloqueio' | 'falha_defensiva' | 'falha_ofensiva';
export type FutTeam = 'A' | 'B';
export type FutResultado = 'vitoria_a' | 'vitoria_b' | 'empate';
export type FutVisibility = 'publico' | 'privado';

export class FutError extends Error {}

const XP_PARTICIPACAO = 10;
const XP_POR_GOL = 15;
const XP_POR_ASSIST = 8;
const XP_POR_DEFESA = 5;
const XP_POR_ERRO = -3;
const XP_BONUS_VITORIA = 20;
const XP_POR_DESARME = 4;
const XP_POR_BOA_JOGADA = 3;
const XP_POR_BLOQUEIO = 4;
// Falhas (defensiva/ofensiva) rendem menos XP negativo que um erro grave —
// erro grave é tipo "CAGADA MASTER", uma falha é só um deslize.
const XP_POR_FALHA_DEFENSIVA = -1;
const XP_POR_FALHA_OFENSIVA = -1;

// Limite de clãs simultâneos por servidor — evita clã abandonado acumulando
// e não deixa a lista virar bagunça. Deletar um clã libera o slot.
const MAX_CLANS_PER_GUILD = 3;

// ── Clã ──────────────────────────────────────────────────────────────────

const CLAN_INCLUDE = { members: { include: { team: true } }, teams: { orderBy: { createdAt: 'asc' as const } } };

// Clã público: qualquer um do servidor vê na lista e entra direto.
// Clã privado: só aparece na lista pra quem já é membro — pra entrar,
// precisa do código (fut_clans.joinCode), tipo um convite. É a forma de
// dar "só amigos veem" sem precisar de um sistema de amizade de verdade:
// quem tem o código foi convidado por alguém de dentro.
export async function listClans(guildId: string, viewerId?: string) {
  const clans = await prisma.futClan.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, include: CLAN_INCLUDE });
  if (!viewerId) return clans.filter((c) => c.visibility !== 'privado');
  return clans.filter((c) => c.visibility !== 'privado' || c.members.some((m) => m.discordId === viewerId));
}

// Total de clãs do servidor (incluindo privados que essa pessoa não vê) —
// usado só pra mostrar "X/3 slots usados" mesmo quando tem clã privado
// escondido da listagem.
export async function countClans(guildId: string) {
  return prisma.futClan.count({ where: { guildId } });
}

export function maxClansPerGuild() {
  return MAX_CLANS_PER_GUILD;
}

export async function getClanByName(guildId: string, name: string) {
  const clean = name.trim();
  return prisma.futClan.findFirst({
    where: { guildId, name: { equals: clean, mode: 'insensitive' } },
    include: CLAN_INCLUDE,
  });
}

export async function getClanById(clanId: string) {
  return prisma.futClan.findUnique({ where: { id: clanId }, include: CLAN_INCLUDE });
}

export async function getClanByJoinCode(joinCode: string) {
  return prisma.futClan.findUnique({ where: { joinCode: joinCode.trim().toUpperCase() }, include: CLAN_INCLUDE });
}

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I pra não confundir
function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  return code;
}

async function uniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    const existing = await prisma.futClan.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new FutError('Não consegui gerar um código único, tenta de novo.');
}

export async function createClan(guildId: string, creatorId: string, creatorName: string, name: string, visibility: FutVisibility = 'publico') {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new FutError('Dê um nome válido pro clã.');

  const existing = await getClanByName(guildId, clean);
  if (existing) throw new FutError(`Já existe um clã chamado **${existing.name}** neste servidor.`);

  const totalClans = await prisma.futClan.count({ where: { guildId } });
  if (totalClans >= MAX_CLANS_PER_GUILD) {
    throw new FutError(`Esse servidor já tem o máximo de ${MAX_CLANS_PER_GUILD} clãs. Delete um clã existente pela Activity (Atividades → Rachão) pra liberar um espaço.`);
  }

  const joinCode = visibility === 'privado' ? await uniqueJoinCode() : null;

  return prisma.futClan.create({
    data: {
      guildId,
      creatorId,
      name: clean,
      visibility,
      joinCode,
      members: { create: [{ discordId: creatorId, displayName: creatorName.slice(0, 40) }] },
    },
    include: CLAN_INCLUDE,
  });
}

export async function joinClan(clanId: string, discordId: string, displayName: string, joinCode?: string) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (clan.members.some((m) => m.discordId === discordId)) throw new FutError('Você já faz parte desse clã.');

  if (clan.visibility === 'privado') {
    if (!joinCode || joinCode.trim().toUpperCase() !== clan.joinCode) {
      throw new FutError('Esse clã é privado — peça o código de convite pra quem já é membro.');
    }
  }

  return prisma.futClanMember.create({ data: { clanId, discordId, displayName: displayName.slice(0, 40) } });
}

// Adiciona alguém DIRETO no elenco do clã, com nome e (se tiver) ID do
// Discord — só quem criou o clã pode fazer isso. Cobre o caso de um clã
// público: a visibilidade é pública, mas isso não bota ninguém no elenco
// sozinho, então o criador precisa poder trazer gente pra dentro na mão
// (inclusive gente sem conta linkada, só com apelido).
export async function addClanMember(clanId: string, requesterId: string, data: { discordId?: string; displayName: string }) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (clan.creatorId !== requesterId) throw new FutError('Só quem criou o clã pode adicionar membros diretamente.');

  const displayName = data.displayName?.trim().slice(0, 40);
  if (!displayName) throw new FutError('Informe um nome pra essa pessoa.');

  let discordId: string | null = null;
  if (data.discordId && data.discordId.trim()) {
    discordId = data.discordId.trim();
    if (!/^\d{5,25}$/.test(discordId)) throw new FutError('O ID do Discord precisa ser só números (o "Copiar ID" do Discord, com o modo desenvolvedor ativado).');
    if (clan.members.some((m) => m.discordId === discordId)) throw new FutError('Essa pessoa já faz parte desse clã.');
  }

  return prisma.futClanMember.create({ data: { clanId, discordId, displayName } });
}

// Remove alguém do elenco do clã — só quem criou o clã pode, e não dá pra
// remover o próprio criador (ele tem que deletar o clã inteiro, se quiser).
// Não mexe nas estatísticas já salvas (FutClanPlayerStats é por discordId,
// independente de continuar ou não no elenco).
export async function removeClanMember(clanId: string, requesterId: string, memberRef: { discordId?: string; apelido?: string }) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (clan.creatorId !== requesterId) throw new FutError('Só quem criou o clã pode remover membros.');

  const member = resolveMember(clan, memberRef);
  if (member.discordId === clan.creatorId) throw new FutError('Você não pode remover a si mesmo (criador) do clã — delete o clã inteiro se for o caso.');

  await prisma.futClanMember.delete({ where: { id: member.id } });
  return member;
}

export async function deleteClan(clanId: string, requesterId: string) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (clan.creatorId !== requesterId) throw new FutError('Só quem criou o clã pode deletar ele.');

  await prisma.futClan.delete({ where: { id: clanId } });
  return clan;
}

// ── Times internos do clã (elenco fixo, tipo "Time Amarelo" x "Time Azul") ─
// Isso é diferente do "team" A/B de uma partida específica: aqui é uma
// divisão permanente do grupo, e os jogadores ficam salvos dentro do time.

export async function listTeams(clanId: string) {
  return prisma.futTeam.findMany({ where: { clanId }, orderBy: { createdAt: 'asc' }, include: { members: true } });
}

export async function createTeam(clanId: string, requesterId: string, name: string, color?: string) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (clan.creatorId !== requesterId) throw new FutError('Só quem criou o clã pode criar times internos.');

  const clean = name.trim().slice(0, 30);
  if (!clean) throw new FutError('Dê um nome válido pro time.');

  const existing = await prisma.futTeam.findFirst({ where: { clanId, name: { equals: clean, mode: 'insensitive' } } });
  if (existing) throw new FutError(`Já existe um time chamado **${existing.name}** nesse clã.`);

  return prisma.futTeam.create({ data: { clanId, name: clean, color: color?.trim().slice(0, 20) || null } });
}

export async function deleteTeam(teamId: string, requesterId: string) {
  const team = await prisma.futTeam.findUnique({ where: { id: teamId }, include: { clan: true } });
  if (!team) throw new FutError('Time não encontrado.');
  if (team.clan.creatorId !== requesterId) throw new FutError('Só quem criou o clã pode deletar times.');

  await prisma.futTeam.delete({ where: { id: teamId } });
  return team;
}

export function resolveMember(clan: { members: { id: string; discordId: string | null; displayName: string }[] }, ref: { discordId?: string; apelido?: string }) {
  let member = null;
  if (ref.discordId) {
    member = clan.members.find((m) => m.discordId === ref.discordId) || null;
  } else if (ref.apelido) {
    const clean = ref.apelido.trim().toLowerCase();
    member = clan.members.find((m) => m.displayName.toLowerCase() === clean) || null;
  }
  if (!member) throw new FutError('Não achei esse jogador nesse clã. Confira o apelido/menção ou use `entrar` primeiro.');
  return member;
}

// Coloca (ou tira, com teamId=null) um membro do clã dentro de um time interno.
export async function setMemberTeam(clanId: string, memberRef: { discordId?: string; apelido?: string }, teamId: string | null) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  const member = resolveMember(clan, memberRef);

  if (teamId) {
    const team = await prisma.futTeam.findUnique({ where: { id: teamId } });
    if (!team || team.clanId !== clanId) throw new FutError('Esse time não pertence a esse clã.');
  }

  return prisma.futClanMember.update({ where: { id: member.id }, data: { teamId } });
}

// ── Partida (dentro de um clã) ──────────────────────────────────────────

export async function getOpenPartida(clanId: string) {
  return prisma.futPartida.findFirst({
    where: { clanId, status: { in: ['aberta', 'em_andamento'] } },
    orderBy: { createdAt: 'desc' },
    include: { players: true },
  });
}

export async function getPartidaById(partidaId: string) {
  return prisma.futPartida.findUnique({ where: { id: partidaId }, include: { players: true } });
}

export async function listPartidaHistory(clanId: string, limit = 10) {
  return prisma.futPartida.findMany({
    where: { clanId, status: 'finalizada' },
    orderBy: { finishedAt: 'desc' },
    take: limit,
    include: { players: true },
  });
}

// ── Perfil pessoal (posição preferida por modo) ─────────────────────────

export async function getUserProfile(discordId: string) {
  return prisma.futUserProfile.findUnique({ where: { discordId } });
}

export async function setUserPosition(discordId: string, mode: FutMode, position: string) {
  const clean = position.trim().slice(0, 30);
  if (!clean) throw new FutError('Informe uma posição válida.');
  const data = mode === 'futsal' ? { positionFutsal: clean } : { positionCampo: clean };
  return prisma.futUserProfile.upsert({ where: { discordId }, create: { discordId, ...data }, update: data });
}

async function defaultPositionFor(discordId: string, mode: FutMode) {
  const profile = await getUserProfile(discordId);
  if (!profile) return null;
  return (mode === 'futsal' ? profile.positionFutsal : profile.positionCampo) || null;
}

// Só aceita link http/https — mesma regra do vídeo de gol, evita salvar lixo
// nos campos de foto/banner (que são colados como URL, sem upload).
function sanitizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const clean = url.trim();
  if (!/^https?:\/\/\S+$/i.test(clean)) throw new FutError('O link da imagem precisa ser uma URL válida (começando com http:// ou https://).');
  return clean.slice(0, 500);
}

// Perfil PRÓPRIO do Rachão (fora de qualquer clã): nome de exibição, foto,
// banner e bio. Passar `null` num campo apaga ele (volta pro padrão do
// Discord); `undefined` deixa como já estava.
export async function updateUserProfile(discordId: string, data: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null; bannerUrl?: string | null }) {
  const clean: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null; bannerUrl?: string | null } = {};
  if (data.displayName !== undefined) clean.displayName = data.displayName?.trim().slice(0, 40) || null;
  if (data.bio !== undefined) clean.bio = data.bio?.trim().slice(0, 300) || null;
  if (data.avatarUrl !== undefined) clean.avatarUrl = sanitizeImageUrl(data.avatarUrl);
  if (data.bannerUrl !== undefined) clean.bannerUrl = sanitizeImageUrl(data.bannerUrl);

  return prisma.futUserProfile.upsert({
    where: { discordId },
    create: { discordId, ...clean },
    update: clean,
  });
}

// Perfil GLOBAL: dados próprios + todo clã (de qualquer servidor) em que a
// pessoa é membro, com as estatísticas PRINCIPAIS somadas dos dois modos
// (futsal + campo) pra dar uma visão geral rápida em cada card de clã — e o
// TOTAL somando TODOS os clãs de uma vez, inclusive privados (é a estatística
// de verdade da pessoa; só a LISTA de clãs é que esconde os privados de
// terceiros — ver serialização no site). Base pro futuro sistema de ranking.
export async function getGlobalProfile(discordId: string) {
  const [profile, memberships] = await Promise.all([
    getUserProfile(discordId),
    prisma.futClanMember.findMany({ where: { discordId }, include: { clan: true } }),
  ]);

  const clanesComStats = await Promise.all(memberships.map(async (m) => {
    const statsPorModo = await prisma.futClanPlayerStats.findMany({ where: { clanId: m.clanId, discordId } });
    const totalPartidas = statsPorModo.reduce((s, x) => s + x.totalPartidas, 0);
    const totalXp = statsPorModo.reduce((s, x) => s + x.xp, 0);
    const notaSomada = statsPorModo.reduce((s, x) => s + x.notaMedia * x.notaCount, 0);
    const notaCount = statsPorModo.reduce((s, x) => s + x.notaCount, 0);
    return {
      clanId: m.clanId,
      clanName: m.clan.name,
      visibility: m.clan.visibility,
      isCreator: m.clan.creatorId === discordId,
      totalPartidas,
      xp: totalXp,
      notaMedia: notaCount > 0 ? Math.round((notaSomada / notaCount) * 100) / 100 : null,
    };
  }));

  const totalPartidas = clanesComStats.reduce((s, c) => s + c.totalPartidas, 0);
  const totalXp = clanesComStats.reduce((s, c) => s + c.xp, 0);
  // Média simples entre os clãs onde já tem nota (cada clã pesa igual,
  // independente de quantas partidas teve nele) — dá pro ranking futuro
  // trocar por uma ponderada por partida se fizer mais sentido depois.
  const clanesComNota = clanesComStats.filter((c) => c.notaMedia != null);

  return {
    discordId,
    displayName: profile?.displayName || null,
    bio: profile?.bio || null,
    avatarUrl: profile?.avatarUrl || null,
    bannerUrl: profile?.bannerUrl || null,
    positionFutsal: profile?.positionFutsal || null,
    positionCampo: profile?.positionCampo || null,
    clans: clanesComStats,
    totais: {
      totalClans: clanesComStats.length,
      totalPartidas,
      totalXp,
      notaMedia: clanesComNota.length ? Math.round((clanesComNota.reduce((s, c) => s + (c.notaMedia ?? 0), 0) / clanesComNota.length) * 100) / 100 : null,
    },
  };
}

// Quem pode "registrar partida" num clã: o dono do clã sempre pode, e quem
// mais o dono autorizou nas configurações do clã (FutClanMember.canRecord).
// Todo mundo continua podendo ENTRAR/participar de uma partida já criada —
// essa checagem é só pra CRIAR uma partida nova.
export function isClanRecorder(clan: { creatorId: string; members: { discordId: string | null; canRecord: boolean }[] }, discordId: string) {
  if (clan.creatorId === discordId) return true;
  return clan.members.some((m) => m.discordId === discordId && m.canRecord);
}

// Liga/desliga a permissão de registrar partida pra alguém do elenco — só
// quem criou o clã pode mexer nisso.
export async function setMemberCanRecord(clanId: string, requesterId: string, memberRef: { discordId?: string; apelido?: string }, canRecord: boolean) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (clan.creatorId !== requesterId) throw new FutError('Só quem criou o clã pode mudar quem registra partida.');

  const member = resolveMember(clan, memberRef);
  if (member.discordId === clan.creatorId) throw new FutError('O dono do clã já pode registrar partida por padrão.');

  return prisma.futClanMember.update({ where: { id: member.id }, data: { canRecord } });
}

export async function createPartida(clanId: string, creatorId: string, creatorName: string, mode: FutMode, name?: string) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (!isClanRecorder(clan, creatorId)) throw new FutError('Só o dono do clã ou quem foi autorizado nas configurações pode criar/registrar uma partida.');

  const existing = await getOpenPartida(clanId);
  if (existing) throw new FutError(`Esse clã já tem uma partida em aberto (**${existing.name || 'sem nome'}**). Finalize ela antes de criar outra.`);

  const position = await defaultPositionFor(creatorId, mode);

  return prisma.futPartida.create({
    data: {
      clanId,
      creatorId,
      mode,
      name: name?.slice(0, 60) || null,
      players: { create: [{ discordId: creatorId, displayName: creatorName.slice(0, 40), position }] },
    },
    include: { players: true },
  });
}

export async function deletePartida(partidaId: string, requesterId: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode deletar ela.');

  await prisma.futPartida.delete({ where: { id: partidaId } });
  return partida;
}

function assertNotFinished(partida: { status: string }) {
  if (partida.status === 'finalizada') throw new FutError('Essa partida já foi finalizada.');
}

export async function joinPartida(partidaId: string, discordId: string, displayName: string, position?: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  assertNotFinished(partida);

  if (partida.players.some((p) => p.discordId === discordId)) throw new FutError('Você já está inscrito nessa partida.');

  const finalPosition = position?.trim().slice(0, 30) || await defaultPositionFor(discordId, partida.mode as FutMode);

  return prisma.futPartidaPlayer.create({
    data: { partidaId, discordId, displayName: displayName.slice(0, 40), position: finalPosition },
  });
}

export async function addOfflinePlayer(partidaId: string, apelido: string, position?: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  assertNotFinished(partida);

  const clean = apelido.trim().slice(0, 40);
  if (!clean) throw new FutError('Dê um apelido válido pro jogador.');
  if (partida.players.some((p) => p.displayName.toLowerCase() === clean.toLowerCase())) {
    throw new FutError('Já existe um jogador com esse apelido nessa partida.');
  }

  return prisma.futPartidaPlayer.create({
    data: { partidaId, displayName: clean, position: position?.slice(0, 30) || null },
  });
}

// Convoca alguém que já está no elenco do clã pra dentro da partida em
// aberto/andamento — direto, sem precisar que a pessoa entre sozinha
// (`entrar`) nem digitar de novo um apelido pra gente offline. Guarda o
// vínculo com o elenco (clanMemberId) pra estatística acumular certinho
// mesmo pra quem não tem conta do Discord. Só quem criou a partida.
export async function addClanMemberToPartida(partidaId: string, requesterId: string, memberId: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode convocar jogadores do elenco.');
  assertNotFinished(partida);

  const clan = await getClanById(partida.clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  const member = clan.members.find((m) => m.id === memberId);
  if (!member) throw new FutError('Essa pessoa não faz parte do elenco desse clã.');

  const jaNaPartida = partida.players.some((p) => (member.discordId && p.discordId === member.discordId) || p.clanMemberId === member.id);
  if (jaNaPartida) throw new FutError(`**${member.displayName}** já está nessa partida.`);

  const position = member.discordId ? await defaultPositionFor(member.discordId, partida.mode as FutMode) : null;

  return prisma.futPartidaPlayer.create({
    data: { partidaId, discordId: member.discordId, clanMemberId: member.id, displayName: member.displayName, position },
  });
}

// Lista quem do elenco AINDA não está na partida — pra montar o seletor de
// "convocar do elenco" no site/Discord.
export async function listAvailableClanMembers(partidaId: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  const clan = await getClanById(partida.clanId);
  if (!clan) throw new FutError('Clã não encontrado.');

  return clan.members.filter((m) => !partida.players.some((p) => (m.discordId && p.discordId === m.discordId) || p.clanMemberId === m.id));
}

export async function setTeam(partidaId: string, player: { discordId?: string; apelido?: string }, team: FutTeam) {
  const target = await resolvePlayer(partidaId, player);
  await prisma.futPartidaPlayer.update({ where: { id: target.id }, data: { team } });
  return target;
}

// Tira alguém da partida por completo (sai dos times A/B e da lista de
// participantes de uma vez só). Só quem criou a partida pode tirar outra
// pessoa; qualquer jogador pode tirar A SI MESMO (sair da partida). Uma vez
// finalizada a partida as estatísticas já foram salvas no clã — pra corrigir
// isso é preciso reabrir a partida (`reopenPartida`) antes.
export async function removePlayerFromPartida(partidaId: string, requesterId: string, playerRef: { discordId?: string; apelido?: string }) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  assertNotFinished(partida);

  const target = await resolvePlayer(partidaId, playerRef);
  const souOAlvo = !!target.discordId && target.discordId === requesterId;
  if (partida.creatorId !== requesterId && !souOAlvo) {
    throw new FutError('Só quem criou a partida pode remover outras pessoas — você só pode sair da própria participação.');
  }

  await prisma.futPartidaPlayer.delete({ where: { id: target.id } });
  return getPartidaById(partidaId);
}

// "Criador de time": distribui os jogadores em A/B tentando equilibrar o
// nível médio dos dois lados, usando o XP acumulado de cada um NO MODO da
// partida (futsal e campo têm níveis separados). Quem ainda não tem
// estatística nesse modo (jogador novo ou offline) entra com XP 0 — fica
// misturado com o resto pelo algoritmo guloso abaixo.
export async function autoBalanceTeams(partidaId: string, requesterId: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode usar o auto-equilibrar.');
  assertNotFinished(partida);
  if (partida.players.length < 2) throw new FutError('Precisa de pelo menos 2 jogadores pra equilibrar os times.');

  const scored = await Promise.all(partida.players.map(async (p) => {
    if (!p.discordId) return { player: p, score: 0 };
    const stats = await prisma.futClanPlayerStats.findUnique({
      where: { clanId_discordId_mode: { clanId: partida.clanId, discordId: p.discordId, mode: partida.mode } },
    });
    return { player: p, score: stats?.xp ?? 0 };
  }));

  // Maior XP primeiro, depois vai alternando pro time com menor soma —
  // técnica clássica de particionamento guloso pra minimizar a diferença.
  scored.sort((a, b) => b.score - a.score);

  let totalA = 0;
  let totalB = 0;
  const assignments: { id: string; team: FutTeam }[] = [];
  for (const { player, score } of scored) {
    const team: FutTeam = totalA <= totalB ? 'A' : 'B';
    if (team === 'A') totalA += score; else totalB += score;
    assignments.push({ id: player.id, team });
  }

  await prisma.$transaction(assignments.map((a) => prisma.futPartidaPlayer.update({ where: { id: a.id }, data: { team: a.team } })));

  return getPartidaById(partidaId);
}

export async function startPartida(partidaId: string, requesterId: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode iniciar ela.');
  if (partida.status !== 'aberta') throw new FutError('Essa partida já foi iniciada ou finalizada.');
  if (partida.players.length < 2) throw new FutError('Precisa de pelo menos 2 jogadores inscritos pra iniciar.');

  return prisma.futPartida.update({
    where: { id: partidaId },
    data: { status: 'em_andamento', startedAt: new Date() },
    include: { players: true },
  });
}

// Acha o jogador da partida por ID do Discord OU por apelido (jogador offline).
export async function resolvePlayer(partidaId: string, ref: { discordId?: string; apelido?: string }) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');

  let player = null;
  if (ref.discordId) {
    player = partida.players.find((p) => p.discordId === ref.discordId) || null;
  } else if (ref.apelido) {
    const clean = ref.apelido.trim().toLowerCase();
    player = partida.players.find((p) => p.displayName.toLowerCase() === clean) || null;
  }

  if (!player) throw new FutError('Não achei esse jogador inscrito nessa partida. Confira o apelido/menção ou use `entrar`/`adicionar` primeiro.');
  return player;
}

// Só aceita link http/https de verdade — evita salvar lixo no campo videoUrl.
function sanitizeVideoUrl(url?: string | null): string | null {
  if (!url) return null;
  const clean = url.trim();
  if (!/^https?:\/\/\S+$/i.test(clean)) throw new FutError('O link do vídeo precisa ser uma URL válida (começando com http:// ou https://).');
  return clean.slice(0, 300);
}

export async function recordEvent(partidaId: string, playerRef: { discordId?: string; apelido?: string }, type: FutEventType, assistRef?: { discordId?: string; apelido?: string }, videoUrl?: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.status !== 'em_andamento') throw new FutError('A partida precisa estar em andamento (`iniciar`) pra registrar eventos.');

  const player = await resolvePlayer(partidaId, playerRef);
  const cleanVideoUrl = type === 'gol' ? sanitizeVideoUrl(videoUrl) : null;

  switch (type) {
    case 'gol':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { goals: { increment: 1 } } });
      break;
    case 'assistencia':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { assists: { increment: 1 } } });
      break;
    case 'defesa':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { defesas: { increment: 1 } } });
      break;
    case 'concedido':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { golsConcedidos: { increment: 1 } } });
      break;
    case 'erro':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { errosGraves: { increment: 1 } } });
      break;
    case 'desarme':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { desarmes: { increment: 1 } } });
      break;
    case 'boa_jogada':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { boasJogadas: { increment: 1 } } });
      break;
    case 'bloqueio':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { bloqueios: { increment: 1 } } });
      break;
    case 'falha_defensiva':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { falhasDefensivas: { increment: 1 } } });
      break;
    case 'falha_ofensiva':
      await prisma.futPartidaPlayer.update({ where: { id: player.id }, data: { falhasOfensivas: { increment: 1 } } });
      break;
  }
  const event = await prisma.futMatchEvent.create({ data: { partidaId, playerId: player.id, type, videoUrl: cleanVideoUrl } });

  if (type === 'gol' && player.team) {
    await prisma.futPartida.update({
      where: { id: partidaId },
      data: player.team === 'A' ? { scoreA: { increment: 1 } } : { scoreB: { increment: 1 } },
    });
  }

  let assistPlayer = null;
  if (type === 'gol' && assistRef && (assistRef.discordId || assistRef.apelido)) {
    assistPlayer = await resolvePlayer(partidaId, assistRef);
    await prisma.futPartidaPlayer.update({ where: { id: assistPlayer.id }, data: { assists: { increment: 1 } } });
    await prisma.futMatchEvent.create({ data: { partidaId, playerId: assistPlayer.id, type: 'assistencia' } });
  }

  return { player, assistPlayer, event };
}

// ── Animação do gol (montada no pós-partida, por frames arrastáveis) ────
// Lista os gols de uma partida (pra escolher qual animar no site).
export async function listPartidaGoals(partidaId: string) {
  const events = await prisma.futMatchEvent.findMany({
    where: { partidaId, type: 'gol' },
    orderBy: { createdAt: 'asc' },
    include: { player: true },
  });
  return events.map((e) => ({
    id: e.id,
    displayName: e.player?.displayName || 'Desconhecido',
    videoUrl: e.videoUrl,
    hasAnimation: !!e.animationFrames,
    createdAt: e.createdAt,
  }));
}

export interface FutAnimationToken {
  id: string;
  type: string; // 'bola' | 'jogadorA' | 'jogadorB' | 'seta'
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
  angle: number; // 0-359, só usado por 'seta'
}
export type FutAnimationFrame = FutAnimationToken[];

const MAX_ANIM_FRAMES = 20;
const MAX_TOKENS_PER_FRAME = 24;

function sanitizeFrames(frames: unknown): FutAnimationFrame[] {
  if (!Array.isArray(frames)) throw new FutError('Formato de animação inválido.');
  if (frames.length === 0) throw new FutError('A animação precisa ter pelo menos 1 frame.');
  if (frames.length > MAX_ANIM_FRAMES) throw new FutError(`No máximo ${MAX_ANIM_FRAMES} frames por animação.`);

  return frames.map((frame): FutAnimationFrame => {
    if (!Array.isArray(frame)) throw new FutError('Formato de animação inválido.');
    if (frame.length > MAX_TOKENS_PER_FRAME) throw new FutError(`No máximo ${MAX_TOKENS_PER_FRAME} itens por frame.`);
    return frame.map((t: any): FutAnimationToken => ({
      id: String(t?.id ?? '').slice(0, 40) || Math.random().toString(36).slice(2, 10),
      type: ['bola', 'jogadorA', 'jogadorB', 'seta'].includes(t?.type) ? t.type : 'bola',
      x: Math.max(0, Math.min(100, Number(t?.x) || 0)),
      y: Math.max(0, Math.min(100, Number(t?.y) || 0)),
      angle: Math.max(0, Math.min(359, Number(t?.angle) || 0)),
    }));
  });
}

// Só aceita um ponto dentro do desenho do gol (0-100 em cada eixo) ou null
// (sem marcação ainda / removida).
function sanitizeShot(shot: unknown): { x: number; y: number } | null {
  if (shot == null) return null;
  const s = shot as any;
  if (typeof s.x !== 'number' || typeof s.y !== 'number' || Number.isNaN(s.x) || Number.isNaN(s.y)) return null;
  return { x: Math.max(0, Math.min(100, s.x)), y: Math.max(0, Math.min(100, s.y)) };
}

// Salva a animação (sequência de frames) e/ou o local do chute dentro do gol
// de um evento de gol específico. Feito no PÓS-PARTIDA, no site — só quem
// criou a partida pode editar. `shot` é opcional — quando omitido, o local
// do chute salvo anteriormente (se tiver) não é mexido.
export async function saveGoalAnimation(eventId: string, requesterId: string, frames: unknown, shot?: unknown) {
  const event = await prisma.futMatchEvent.findUnique({ where: { id: eventId }, include: { partida: true } });
  if (!event) throw new FutError('Gol não encontrado.');
  if (event.type !== 'gol') throw new FutError('Só dá pra montar animação em eventos de gol.');
  if (event.partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode editar a animação desse gol.');

  const clean = sanitizeFrames(frames);
  const data: { animationFrames: string; shotX?: number | null; shotY?: number | null } = { animationFrames: JSON.stringify(clean) };
  if (shot !== undefined) {
    const cleanShot = sanitizeShot(shot);
    data.shotX = cleanShot?.x ?? null;
    data.shotY = cleanShot?.y ?? null;
  }
  await prisma.futMatchEvent.update({ where: { id: eventId }, data });
  return clean;
}

export async function getGoalAnimation(eventId: string) {
  const event = await prisma.futMatchEvent.findUnique({ where: { id: eventId }, include: { player: true, partida: true } });
  if (!event) throw new FutError('Gol não encontrado.');
  let frames: FutAnimationFrame[] = [];
  if (event.animationFrames) {
    try { frames = JSON.parse(event.animationFrames); } catch { frames = []; }
  }
  const shot = (event.shotX != null && event.shotY != null) ? { x: event.shotX, y: event.shotY } : null;
  return { eventId: event.id, displayName: event.player?.displayName || 'Desconhecido', partidaId: event.partidaId, clanId: event.partida.clanId, creatorId: event.partida.creatorId, frames, shot };
}

// Log completo de eventos da partida (play-by-play) — pra acessar/revisar
// as estatísticas de uma partida já finalizada em detalhe.
export async function listMatchEvents(partidaId: string) {
  const events = await prisma.futMatchEvent.findMany({
    where: { partidaId },
    orderBy: { createdAt: 'asc' },
    include: { player: true },
  });
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    displayName: e.player?.displayName || 'Desconhecido',
    videoUrl: e.videoUrl,
    hasAnimation: !!e.animationFrames,
    createdAt: e.createdAt,
  }));
}

// Reverte o efeito estatístico de um evento (usado tanto pra desfazer
// durante o jogo quanto pra reabrir uma partida já finalizada).
async function revertEventEffect(playerId: string, type: FutEventType) {
  switch (type) {
    case 'gol':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { goals: { decrement: 1 } } });
      break;
    case 'assistencia':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { assists: { decrement: 1 } } });
      break;
    case 'defesa':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { defesas: { decrement: 1 } } });
      break;
    case 'concedido':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { golsConcedidos: { decrement: 1 } } });
      break;
    case 'erro':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { errosGraves: { decrement: 1 } } });
      break;
    case 'desarme':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { desarmes: { decrement: 1 } } });
      break;
    case 'boa_jogada':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { boasJogadas: { decrement: 1 } } });
      break;
    case 'bloqueio':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { bloqueios: { decrement: 1 } } });
      break;
    case 'falha_defensiva':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { falhasDefensivas: { decrement: 1 } } });
      break;
    case 'falha_ofensiva':
      await prisma.futPartidaPlayer.update({ where: { id: playerId }, data: { falhasOfensivas: { decrement: 1 } } });
      break;
  }
}

// Desfaz o último evento registrado na partida (em andamento) — cobre o
// "subtrair coisa durante o jogo em caso de erro". Só quem criou a partida
// pode desfazer. Um gol com assistência conta como 2 eventos (1 chamada
// desfaz o mais recente dos dois por vez).
export async function undoLastEvent(partidaId: string, requesterId: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode desfazer um evento.');
  if (partida.status !== 'em_andamento') throw new FutError('Só dá pra desfazer eventos de uma partida em andamento.');

  const lastEvent = await prisma.futMatchEvent.findFirst({
    where: { partidaId },
    orderBy: { createdAt: 'desc' },
    include: { player: true },
  });
  if (!lastEvent) throw new FutError('Não tem nenhum evento registrado nessa partida ainda.');
  if (!lastEvent.playerId || !lastEvent.player) throw new FutError('Não foi possível identificar o jogador desse evento.');

  await revertEventEffect(lastEvent.playerId, lastEvent.type as FutEventType);

  if (lastEvent.type === 'gol' && lastEvent.player.team) {
    await prisma.futPartida.update({
      where: { id: partidaId },
      data: lastEvent.player.team === 'A' ? { scoreA: { decrement: 1 } } : { scoreB: { decrement: 1 } },
    });
  }

  await prisma.futMatchEvent.delete({ where: { id: lastEvent.id } });

  return { type: lastEvent.type, player: lastEvent.player };
}

// Nota estilo Sofascore/Betano (0.0 a 10.0), calculada a partir do
// desempenho na partida. Começa numa base "de jogo normal" (6.0) e sobe ou
// desce conforme os números da partida — parecido com o que os sites de
// futebol fazem, sem ser exatamente igual (eles usam dados que a gente não
// tem, tipo passes certos e desarmes).
function calcNota(p: {
  goals: number; assists: number; defesas: number; golsConcedidos: number; errosGraves: number;
  desarmes: number; boasJogadas: number; bloqueios: number; falhasDefensivas: number; falhasOfensivas: number;
}, resultLabel: 'vitorias' | 'derrotas' | 'empates') {
  let nota = 6.0
    + p.goals * 1.0
    + p.assists * 0.6
    + p.defesas * 0.25
    - p.golsConcedidos * 0.25
    - p.errosGraves * 0.7 // erro grave = "CAGADA MASTER", pesa o mais pesado da lista
    + p.desarmes * 0.35
    + p.boasJogadas * 0.2
    + p.bloqueios * 0.3
    // Falhas (defensiva/ofensiva) pesam MENOS que um erro grave — é um
    // deslize, não uma cagada master.
    - p.falhasDefensivas * 0.35
    - p.falhasOfensivas * 0.3;

  if (resultLabel === 'vitorias') nota += 0.3;
  else if (resultLabel === 'derrotas') nota -= 0.3;

  nota = Math.max(0, Math.min(10, nota));
  return Math.round(nota * 10) / 10;
}

// Faixa da nota (estilo Sofascore/Betano) — usada tanto no Discord (emoji
// colorido) quanto no site (badge colorido), pra sempre bater a mesma cor
// pro mesmo número, nos dois lugares.
export type NotaBand = 'ruim' | 'mediano' | 'bom' | 'excelente';
export function notaBand(nota: number): NotaBand {
  if (nota < 6) return 'ruim';
  if (nota < 7) return 'mediano';
  if (nota < 8) return 'bom';
  return 'excelente';
}

export async function finishPartida(partidaId: string, requesterId: string, resultadoOverride?: FutResultado) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode finalizar ela.');
  assertNotFinished(partida);

  const resultado: FutResultado = resultadoOverride
    ?? (partida.scoreA > partida.scoreB ? 'vitoria_a' : partida.scoreB > partida.scoreA ? 'vitoria_b' : 'empate');

  const updated = await prisma.futPartida.update({
    where: { id: partidaId },
    data: { status: 'finalizada', finishedAt: new Date(), resultado },
    include: { players: true },
  });

  const mode = updated.mode as FutMode;

  // Atualiza a estatística agregada de cada jogador DENTRO DO CLÃ, separada
  // por modo (futsal x campo não se misturam). TODO MUNDO que jogou recebe
  // nota da partida — mesmo quem não tem conta do Discord vinculada
  // (offline). A chave da estatística acumulada é o discordId quando tem
  // conta, ou "offline:<clanMemberId>" quando a pessoa veio do elenco sem
  // conta — sem essa chave estável, dá pra dar a nota da partida mas não
  // dá pra acumular histórico entre partidas (não tem como saber que é a
  // mesma pessoa da próxima vez).
  for (const p of updated.players) {
    let resultLabel: 'vitorias' | 'derrotas' | 'empates' = 'empates';
    if (resultado !== 'empate' && p.team) {
      const won = (resultado === 'vitoria_a' && p.team === 'A') || (resultado === 'vitoria_b' && p.team === 'B');
      resultLabel = won ? 'vitorias' : 'derrotas';
    }

    const xpGain = Math.max(0, XP_PARTICIPACAO
      + p.goals * XP_POR_GOL
      + p.assists * XP_POR_ASSIST
      + p.defesas * XP_POR_DEFESA
      + p.errosGraves * XP_POR_ERRO
      + p.desarmes * XP_POR_DESARME
      + p.boasJogadas * XP_POR_BOA_JOGADA
      + p.bloqueios * XP_POR_BLOQUEIO
      + p.falhasDefensivas * XP_POR_FALHA_DEFENSIVA
      + p.falhasOfensivas * XP_POR_FALHA_OFENSIVA
      + (resultLabel === 'vitorias' ? XP_BONUS_VITORIA : 0));

    const nota = calcNota(p, resultLabel);
    await prisma.futPartidaPlayer.update({ where: { id: p.id }, data: { nota } });

    const statsKey = p.discordId || (p.clanMemberId ? `offline:${p.clanMemberId}` : null);
    if (!statsKey) continue; // ad-hoc offline sem vínculo com o elenco: só a nota da partida mesmo

    const existingStats = await prisma.futClanPlayerStats.findUnique({
      where: { clanId_discordId_mode: { clanId: updated.clanId, discordId: statsKey, mode } },
    });
    const novoCount = (existingStats?.notaCount ?? 0) + 1;
    const novaMedia = existingStats
      ? Math.round(((existingStats.notaMedia * existingStats.notaCount + nota) / novoCount) * 100) / 100
      : nota;

    await prisma.futClanPlayerStats.upsert({
      where: { clanId_discordId_mode: { clanId: updated.clanId, discordId: statsKey, mode } },
      create: {
        clanId: updated.clanId,
        discordId: statsKey,
        displayName: p.displayName,
        mode,
        totalPartidas: 1,
        vitorias: resultLabel === 'vitorias' ? 1 : 0,
        derrotas: resultLabel === 'derrotas' ? 1 : 0,
        empates: resultLabel === 'empates' ? 1 : 0,
        goals: p.goals,
        assists: p.assists,
        defesas: p.defesas,
        golsConcedidos: p.golsConcedidos,
        errosGraves: p.errosGraves,
        desarmes: p.desarmes,
        boasJogadas: p.boasJogadas,
        bloqueios: p.bloqueios,
        falhasDefensivas: p.falhasDefensivas,
        falhasOfensivas: p.falhasOfensivas,
        xp: xpGain,
        notaMedia: novaMedia,
        notaCount: novoCount,
      },
      update: {
        displayName: p.displayName,
        totalPartidas: { increment: 1 },
        vitorias: { increment: resultLabel === 'vitorias' ? 1 : 0 },
        derrotas: { increment: resultLabel === 'derrotas' ? 1 : 0 },
        empates: { increment: resultLabel === 'empates' ? 1 : 0 },
        goals: { increment: p.goals },
        assists: { increment: p.assists },
        defesas: { increment: p.defesas },
        golsConcedidos: { increment: p.golsConcedidos },
        errosGraves: { increment: p.errosGraves },
        desarmes: { increment: p.desarmes },
        boasJogadas: { increment: p.boasJogadas },
        bloqueios: { increment: p.bloqueios },
        falhasDefensivas: { increment: p.falhasDefensivas },
        falhasOfensivas: { increment: p.falhasOfensivas },
        xp: { increment: xpGain },
        notaMedia: novaMedia,
        notaCount: novoCount,
      },
    });
  }

  return updated;
}

// Reabre uma partida já finalizada pra editar gols/estatísticas/resultado
// ("no pós partida, tudo pode ser capaz de ser alterado"). Reverte
// exatamente o que `finishPartida` aplicou (XP, nota média, agregados do
// clã) e volta o status pra 'em_andamento' — depois de editar, é só
// finalizar de novo (`finalizar`) que os números são recalculados do zero.
export async function reopenPartida(partidaId: string, requesterId: string) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode reabrir ela pra editar.');
  if (partida.status !== 'finalizada') throw new FutError('Essa partida não está finalizada.');

  const mode = partida.mode as FutMode;
  const resultado = partida.resultado as FutResultado | null;

  for (const p of partida.players) {
    if (p.nota == null) continue;
    const statsKey = p.discordId || (p.clanMemberId ? `offline:${p.clanMemberId}` : null);

    let resultLabel: 'vitorias' | 'derrotas' | 'empates' = 'empates';
    if (resultado && resultado !== 'empate' && p.team) {
      const won = (resultado === 'vitoria_a' && p.team === 'A') || (resultado === 'vitoria_b' && p.team === 'B');
      resultLabel = won ? 'vitorias' : 'derrotas';
    }

    const xpGain = Math.max(0, XP_PARTICIPACAO
      + p.goals * XP_POR_GOL
      + p.assists * XP_POR_ASSIST
      + p.defesas * XP_POR_DEFESA
      + p.errosGraves * XP_POR_ERRO
      + p.desarmes * XP_POR_DESARME
      + p.boasJogadas * XP_POR_BOA_JOGADA
      + p.bloqueios * XP_POR_BLOQUEIO
      + p.falhasDefensivas * XP_POR_FALHA_DEFENSIVA
      + p.falhasOfensivas * XP_POR_FALHA_OFENSIVA
      + (resultLabel === 'vitorias' ? XP_BONUS_VITORIA : 0));

    if (statsKey) {
      const existingStats = await prisma.futClanPlayerStats.findUnique({
        where: { clanId_discordId_mode: { clanId: partida.clanId, discordId: statsKey, mode } },
      });
      if (existingStats) {
        const novoCount = Math.max(0, existingStats.notaCount - 1);
        const novaMedia = novoCount > 0
          ? Math.round(((existingStats.notaMedia * existingStats.notaCount - p.nota) / novoCount) * 100) / 100
          : 0;

        await prisma.futClanPlayerStats.update({
          where: { clanId_discordId_mode: { clanId: partida.clanId, discordId: statsKey, mode } },
          data: {
            totalPartidas: { decrement: 1 },
            vitorias: { decrement: resultLabel === 'vitorias' ? 1 : 0 },
            derrotas: { decrement: resultLabel === 'derrotas' ? 1 : 0 },
            empates: { decrement: resultLabel === 'empates' ? 1 : 0 },
            goals: { decrement: p.goals },
            assists: { decrement: p.assists },
            defesas: { decrement: p.defesas },
            golsConcedidos: { decrement: p.golsConcedidos },
            errosGraves: { decrement: p.errosGraves },
            desarmes: { decrement: p.desarmes },
            boasJogadas: { decrement: p.boasJogadas },
            bloqueios: { decrement: p.bloqueios },
            falhasDefensivas: { decrement: p.falhasDefensivas },
            falhasOfensivas: { decrement: p.falhasOfensivas },
            xp: { decrement: xpGain },
            notaMedia: novaMedia,
            notaCount: novoCount,
          },
        });
      }
    }

    await prisma.futPartidaPlayer.update({ where: { id: p.id }, data: { nota: null } });
  }

  return prisma.futPartida.update({
    where: { id: partidaId },
    data: { status: 'em_andamento', finishedAt: null, resultado: null },
    include: { players: true },
  });
}

export async function getProfile(clanId: string, discordId: string, mode: FutMode) {
  return prisma.futClanPlayerStats.findUnique({ where: { clanId_discordId_mode: { clanId, discordId, mode } } });
}

const EDITABLE_STATS_FIELDS = [
  'totalPartidas', 'vitorias', 'derrotas', 'empates',
  'goals', 'assists', 'defesas', 'golsConcedidos', 'errosGraves',
  'desarmes', 'boasJogadas', 'bloqueios', 'falhasDefensivas', 'falhasOfensivas',
  'xp', 'notaMedia', 'notaCount',
] as const;
type EditableStatsField = (typeof EDITABLE_STATS_FIELDS)[number];

// Correção manual da estatística acumulada de alguém no clã — pra quando um
// número ficou errado (engano ao registrar, partida antiga já sem como
// reabrir, etc) e não compensa refazer a partida inteira. Só quem pode
// registrar partida nesse clã (dono ou autorizado) pode editar. Edita
// diretamente o total salvo (FutClanPlayerStats) — não mexe em nenhuma
// partida específica.
export async function updateClanPlayerStats(clanId: string, requesterId: string, targetDiscordId: string, mode: FutMode, changes: Partial<Record<EditableStatsField, number>>) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (!isClanRecorder(clan, requesterId)) throw new FutError('Só o dono do clã ou quem foi autorizado nas configurações pode editar estatísticas.');

  const data: Partial<Record<EditableStatsField, number>> = {};
  for (const field of EDITABLE_STATS_FIELDS) {
    const value = changes[field];
    if (value === undefined || value === null || Number.isNaN(Number(value))) continue;
    if (field === 'notaMedia') data[field] = Math.max(0, Math.min(10, Number(value)));
    else data[field] = Math.max(0, Math.round(Number(value) * 100) / 100);
  }
  if (Object.keys(data).length === 0) throw new FutError('Nenhum campo válido pra atualizar.');

  const existing = await prisma.futClanPlayerStats.findUnique({ where: { clanId_discordId_mode: { clanId, discordId: targetDiscordId, mode } } });
  if (!existing) throw new FutError('Essa pessoa ainda não tem estatística salva nesse clã/modo.');

  return prisma.futClanPlayerStats.update({ where: { clanId_discordId_mode: { clanId, discordId: targetDiscordId, mode } }, data });
}

export async function getRanking(clanId: string, mode: FutMode, limit = 10) {
  return prisma.futClanPlayerStats.findMany({ where: { clanId, mode }, orderBy: { xp: 'desc' }, take: limit });
}

// Estatísticas de TODO o elenco (sem limite) — usado na visão "estatísticas
// do clã inteiro" do item 4, tanto no Discord quanto no site.
export async function listFullClanStats(clanId: string, mode: FutMode) {
  return prisma.futClanPlayerStats.findMany({ where: { clanId, mode }, orderBy: { xp: 'desc' } });
}

// Visão geral agregada do clã: totais somados de todo o elenco + destaques
// (artilheiro, garçom, melhor nota). Junto com `listFullClanStats`, cobre o
// item 4: "salvar tanto os da pelada inteira quanto individualmente".
export async function getClanOverview(clanId: string, mode: FutMode) {
  const [agg, totalPartidas, artilheiro, garcom, melhorNota] = await Promise.all([
    prisma.futClanPlayerStats.aggregate({
      where: { clanId, mode },
      _sum: {
        goals: true, assists: true, defesas: true, golsConcedidos: true, errosGraves: true, vitorias: true, derrotas: true, empates: true,
        desarmes: true, boasJogadas: true, bloqueios: true, falhasDefensivas: true, falhasOfensivas: true,
      },
      _count: { _all: true },
    }),
    prisma.futPartida.count({ where: { clanId, mode, status: 'finalizada' } }),
    prisma.futClanPlayerStats.findFirst({ where: { clanId, mode, goals: { gt: 0 } }, orderBy: { goals: 'desc' } }),
    prisma.futClanPlayerStats.findFirst({ where: { clanId, mode, assists: { gt: 0 } }, orderBy: { assists: 'desc' } }),
    prisma.futClanPlayerStats.findFirst({ where: { clanId, mode, notaCount: { gt: 0 } }, orderBy: { notaMedia: 'desc' } }),
  ]);

  return {
    totalPartidas,
    totalJogadores: agg._count._all,
    totalGols: agg._sum.goals ?? 0,
    totalAssists: agg._sum.assists ?? 0,
    totalDefesas: agg._sum.defesas ?? 0,
    totalConcedidos: agg._sum.golsConcedidos ?? 0,
    totalErros: agg._sum.errosGraves ?? 0,
    totalDesarmes: agg._sum.desarmes ?? 0,
    totalBoasJogadas: agg._sum.boasJogadas ?? 0,
    totalBloqueios: agg._sum.bloqueios ?? 0,
    totalFalhasDefensivas: agg._sum.falhasDefensivas ?? 0,
    totalFalhasOfensivas: agg._sum.falhasOfensivas ?? 0,
    totalVitorias: agg._sum.vitorias ?? 0,
    totalDerrotas: agg._sum.derrotas ?? 0,
    totalEmpates: agg._sum.empates ?? 0,
    artilheiro,
    garcom,
    melhorNota,
  };
}

// ── Simulação (brincadeira) ─────────────────────────────────────────────
// Partida FICTÍCIA gerada minuto a minuto com base na nota de cada um —
// não é uma partida de verdade, então não mexe em FutPartida/estatísticas,
// é só pra rir com a galera. Reaproveitada tanto pelo site (escalação manual,
// arrastando gente do elenco pros times) quanto pelo Discord (auto-balanceado).

async function notaDoMembro(clanId: string, mode: FutMode, member: { id: string; discordId: string | null }) {
  const statsKey = member.discordId || `offline:${member.id}`;
  const stats = await prisma.futClanPlayerStats.findUnique({ where: { clanId_discordId_mode: { clanId, discordId: statsKey, mode } } });
  return stats && stats.notaCount > 0 ? stats.notaMedia : 6.0; // ninguém jogou ainda → nota neutra
}

export type FutSimTimelineEntry = { minuto: number; tipo: 'gol' | 'chance' | 'defesa'; team: 'A' | 'B'; jogador: string; assistencia?: string };

export async function simulateClanMatch(clanId: string, mode: FutMode, escalacao?: { memberId: string; team: 'A' | 'B' }[]) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');

  let selecionados: { memberId: string; team: 'A' | 'B' }[];
  if (escalacao && escalacao.length) {
    const validIds = new Set(clan.members.map((m) => m.id));
    selecionados = escalacao.filter((e) => validIds.has(e.memberId) && (e.team === 'A' || e.team === 'B'));
  } else {
    // Sem escalação manual: pega o elenco inteiro e distribui alternando por
    // nota (do melhor pro pior) pra sair um jogo mais ou menos parelho.
    if (clan.members.length < 2) throw new FutError('O elenco desse clã precisa de pelo menos 2 jogadores pra simular.');
    const comNota = await Promise.all(clan.members.map(async (m) => ({ memberId: m.id, nota: await notaDoMembro(clanId, mode, m) })));
    comNota.sort((a, b) => b.nota - a.nota);
    selecionados = comNota.map((p, i) => ({ memberId: p.memberId, team: (i % 2 === 0 ? 'A' : 'B') as 'A' | 'B' }));
  }

  const timeARefs = selecionados.filter((e) => e.team === 'A');
  const timeBRefs = selecionados.filter((e) => e.team === 'B');
  if (!timeARefs.length || !timeBRefs.length) throw new FutError('Escale pelo menos 1 jogador em cada time pra simular.');

  // Guardado numa const à parte (em vez de usar `clan.members` direto) porque
  // o TypeScript não carrega o `if (!clan) throw` acima pra dentro de uma
  // função aninhada — `clan` voltaria a contar como possivelmente nulo aqui.
  const membrosDoClan = clan.members;
  async function comNotaEDados(refs: { memberId: string; team: 'A' | 'B' }[]) {
    return Promise.all(refs.map(async (r) => {
      const member = membrosDoClan.find((m) => m.id === r.memberId)!;
      const nota = await notaDoMembro(clanId, mode, member);
      return { memberId: member.id, displayName: member.displayName, nota };
    }));
  }

  const jogadoresA = await comNotaEDados(timeARefs);
  const jogadoresB = await comNotaEDados(timeBRefs);
  const forcaA = jogadoresA.reduce((s, p) => s + p.nota, 0) / jogadoresA.length;
  const forcaB = jogadoresB.reduce((s, p) => s + p.nota, 0) / jogadoresB.length;

  function clampNum(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
  function pickWeighted(players: { memberId: string; displayName: string; nota: number }[]) {
    const total = players.reduce((s, p) => s + Math.max(1, p.nota), 0);
    let r = Math.random() * total;
    for (const p of players) { r -= Math.max(1, p.nota); if (r <= 0) return p; }
    return players[players.length - 1];
  }

  const duracao = mode === 'futsal' ? 40 : 90;
  const timeline: FutSimTimelineEntry[] = [];
  let scoreA = 0;
  let scoreB = 0;

  for (let minuto = 1; minuto <= duracao; minuto++) {
    if (Math.random() > 0.14) continue; // nem todo minuto tem lance
    const pesoA = Math.max(1, forcaA);
    const pesoB = Math.max(1, forcaB);
    const timeAtacante: 'A' | 'B' = Math.random() * (pesoA + pesoB) < pesoA ? 'A' : 'B';
    const jogadores = timeAtacante === 'A' ? jogadoresA : jogadoresB;
    const atacante = pickWeighted(jogadores);
    const forcaAtq = timeAtacante === 'A' ? forcaA : forcaB;
    const forcaDef = timeAtacante === 'A' ? forcaB : forcaA;
    const chanceGol = clampNum(0.26 + (atacante.nota - 6) / 18 + (forcaAtq - forcaDef) / 40, 0.08, 0.62);

    if (Math.random() < chanceGol) {
      let assistente: typeof atacante | undefined;
      if (jogadores.length > 1 && Math.random() < 0.55) {
        assistente = pickWeighted(jogadores.filter((j) => j.memberId !== atacante.memberId));
      }
      if (timeAtacante === 'A') scoreA += 1; else scoreB += 1;
      timeline.push({ minuto, tipo: 'gol', team: timeAtacante, jogador: atacante.displayName, assistencia: assistente?.displayName });
    } else {
      timeline.push({ minuto, tipo: Math.random() < 0.5 ? 'chance' : 'defesa', team: timeAtacante, jogador: atacante.displayName });
    }
  }

  const resultado: FutResultado = scoreA === scoreB ? 'empate' : scoreA > scoreB ? 'vitoria_a' : 'vitoria_b';
  return {
    clanId,
    mode,
    duracao,
    jogadoresA: jogadoresA.map((p) => ({ memberId: p.memberId, displayName: p.displayName, nota: Math.round(p.nota * 100) / 100 })),
    jogadoresB: jogadoresB.map((p) => ({ memberId: p.memberId, displayName: p.displayName, nota: Math.round(p.nota * 100) / 100 })),
    forcaA: Math.round(forcaA * 100) / 100,
    forcaB: Math.round(forcaB * 100) / 100,
    timeline,
    scoreA,
    scoreB,
    resultado,
  };
}

// ── Vídeos de gol ────────────────────────────────────────────────────────
// Lista os gols de uma partida que têm link de vídeo, com o autor do gol.
export async function listGoalVideos(partidaId: string) {
  const events = await prisma.futMatchEvent.findMany({
    where: { partidaId, type: 'gol', videoUrl: { not: null } },
    orderBy: { createdAt: 'asc' },
    include: { player: true },
  });
  return events.map((e) => ({ id: e.id, videoUrl: e.videoUrl!, createdAt: e.createdAt, player: e.player }));
}

// ── "Chamar o fut" — convite pra combinar uma pelada ────────────────────
// Local, horário, PIX (pra dividir o custo) e um link (grupo/WhatsApp/etc).
// Anunciado no Discord, mas confirmado (RSVP) pelo site — que é onde a
// "chamada" realmente vive, como o resto do sistema.

export type FutRsvpStatus = 'vou' | 'talvez' | 'nao_vou';

export async function createChamada(clanId: string, creatorId: string, data: { local: string; horario: string; pix?: string; valorTotal?: number; link?: string; mensagem?: string }) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');

  const local = data.local?.trim().slice(0, 100);
  const horario = data.horario?.trim().slice(0, 60);
  if (!local) throw new FutError('Informe o local do fut.');
  if (!horario) throw new FutError('Informe o horário do fut.');
  if (data.valorTotal != null && (!Number.isFinite(data.valorTotal) || data.valorTotal < 0)) throw new FutError('Valor total inválido.');

  return prisma.futChamada.create({
    data: {
      clanId,
      creatorId,
      local,
      horario,
      pix: data.pix?.trim().slice(0, 100) || null,
      valorTotal: data.valorTotal != null ? Math.round(data.valorTotal * 100) / 100 : null,
      link: data.link?.trim().slice(0, 300) || null,
      mensagem: data.mensagem?.trim().slice(0, 300) || null,
    },
  });
}

// Divide o valorTotal da chamada pelo nº de confirmados ("vou") — usado no
// site, no Discord (embed/DM) e recalculado sempre que alguém confirma/desmarca
// presença, já que o número de confirmados muda com o tempo.
export function calcValorPorPessoa(valorTotal: number | null | undefined, confirmados: number): number | null {
  if (!valorTotal || valorTotal <= 0) return null;
  return Math.round((valorTotal / Math.max(1, confirmados)) * 100) / 100;
}

export async function getChamada(id: string) {
  return prisma.futChamada.findUnique({ where: { id }, include: { respostas: true, clan: true } });
}

export async function listChamadas(clanId: string, limit = 5) {
  return prisma.futChamada.findMany({ where: { clanId }, orderBy: { createdAt: 'desc' }, take: limit, include: { respostas: true } });
}

export async function deleteChamada(id: string, requesterId: string) {
  const chamada = await prisma.futChamada.findUnique({ where: { id } });
  if (!chamada) throw new FutError('Chamada não encontrada.');
  if (chamada.creatorId !== requesterId) throw new FutError('Só quem criou a chamada pode deletar ela.');

  await prisma.futChamada.delete({ where: { id } });
  return chamada;
}

export async function respondChamada(chamadaId: string, discordId: string, displayName: string, status: FutRsvpStatus) {
  const chamada = await prisma.futChamada.findUnique({ where: { id: chamadaId } });
  if (!chamada) throw new FutError('Chamada não encontrada.');

  return prisma.futChamadaResposta.upsert({
    where: { chamadaId_discordId: { chamadaId, discordId } },
    create: { chamadaId, discordId, displayName: displayName.slice(0, 40), status },
    update: { status, displayName: displayName.slice(0, 40), respondedAt: new Date() },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// RANQUE — tier estilo "nível de dificuldade do FIFA", tanto individual
// quanto de clã. Todo mundo/clã COM pelo menos 1 partida jogada TEM um
// ranque (calculado on-the-fly a partir da estatística já salva — não fica
// guardado em coluna nenhuma, então nunca fica "desatualizado"). Aparecer
// num LEADERBOARD é outra coisa, gated separadamente (ver seção de
// leaderboard abaixo): o ranque em si nunca é escondido de quem já tem.
//
// Ranque Oficial = tier tirado do notaMedia (a média de todas as notas
// estilo Sofascore) — é o "resumo geral" da pessoa/clã.
// Ranques por HABILIDADE = tiers separados por área específica (ex: um
// artilheiro pode ser "Lendário" em Finalização mas só "Amador" em Defesa),
// tirados de uma taxa por partida de cada área (pra não virar "quem jogou
// mais é melhor" — normaliza pelo número de partidas).
// ═══════════════════════════════════════════════════════════════════════

export type RankTier = {
  key: string;
  name: string;
  icon: string;
  color: string;
  order: number; // 1 (mais baixo) .. 7 (mais alto) — pra ordenar/comparar
};

// Nomeação inspirada nos níveis de dificuldade clássicos do FIFA/EA FC.
// Ícone e cor são invenção livre (o pedido do usuário foi literal: "o
// simbolo e cor tu inventa") — uma progressão cinza → bronze → verde →
// azul → roxo → laranja → dourado, do mais fácil/iniciante ao topo.
export const RANK_TIERS: RankTier[] = [
  { key: 'iniciante',        name: 'Iniciante',        icon: '⚪', color: '#9aa0a6', order: 1 },
  { key: 'amador',           name: 'Amador',           icon: '🟤', color: '#a9744f', order: 2 },
  { key: 'semiprofissional', name: 'Semiprofissional', icon: '🟢', color: '#2ecc71', order: 3 },
  { key: 'profissional',     name: 'Profissional',     icon: '🔵', color: '#3498db', order: 4 },
  { key: 'world_class',      name: 'World Class',      icon: '🟣', color: '#9b59b6', order: 5 },
  { key: 'lendario',         name: 'Lendário',         icon: '🟠', color: '#e67e22', order: 6 },
  { key: 'icone',            name: 'Ícone',             icon: '⭐', color: '#f1c40f', order: 7 },
];

function pickTier(value: number, thresholds: number[]): RankTier {
  // thresholds[i] = valor mínimo pra alcançar RANK_TIERS[i]. Pega o mais
  // alto cujo mínimo a pessoa bateu.
  let idx = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) idx = i;
  }
  return RANK_TIERS[idx];
}

// Faixas do RANQUE OFICIAL — tirado direto do notaMedia (escala 0-10). Uma
// nota 6.0 (a nota "base", sem nenhum destaque nem cagada) cai bem no meio
// (Semiprofissional), o que faz sentido: jogo mediano = ranque médio.
const NOTA_TIER_THRESHOLDS = [0, 5.0, 5.8, 6.4, 7.0, 7.7, 8.5];

export function getRankTier(notaMedia: number): RankTier {
  return pickTier(notaMedia, NOTA_TIER_THRESHOLDS);
}

// Definição de cada RANQUE POR HABILIDADE: como calcular a "taxa" (por
// partida) que representa aquela habilidade, e as faixas específicas dela
// (escalas bem diferentes entre si — não dá pra usar o mesmo corte de 0-10
// da nota geral).
type StatsLike = {
  totalPartidas: number; goals: number; assists: number; defesas: number;
  desarmes: number; boasJogadas: number; bloqueios: number;
  errosGraves: number; falhasDefensivas: number; falhasOfensivas: number;
};

const SKILL_DEFS: { key: string; label: string; rate: (s: StatsLike) => number; thresholds: number[] }[] = [
  {
    key: 'finalizacao',
    label: 'Finalização',
    rate: (s) => (s.goals + s.boasJogadas * 0.3) / s.totalPartidas,
    thresholds: [0, 0.15, 0.35, 0.60, 0.90, 1.30, 1.80],
  },
  {
    key: 'criacao',
    label: 'Criação',
    rate: (s) => s.assists / s.totalPartidas,
    thresholds: [0, 0.10, 0.25, 0.45, 0.70, 1.00, 1.40],
  },
  {
    key: 'defesa',
    label: 'Defesa',
    rate: (s) => (s.defesas + s.bloqueios + s.desarmes) / s.totalPartidas,
    thresholds: [0, 0.5, 1.2, 2.0, 3.0, 4.0, 5.5],
  },
  {
    key: 'disciplina',
    label: 'Disciplina',
    // Quanto MENOS erro/falha por partida, melhor — é a única habilidade
    // "invertida" (parte de 10 e desconta em vez de somar).
    rate: (s) => Math.max(0, 10 - (s.errosGraves * 1.5 + s.falhasDefensivas * 0.7 + s.falhasOfensivas * 0.6) / s.totalPartidas),
    thresholds: NOTA_TIER_THRESHOLDS,
  },
];

export type SkillRank = { key: string; label: string; rate: number; tier: RankTier };

// Ranques por habilidade específica de um jogador — null se ele ainda não
// jogou nenhuma partida nesse modo (não tem taxa pra calcular).
export function getPlayerSkillRanks(stats: StatsLike): SkillRank[] | null {
  if (!stats.totalPartidas || stats.totalPartidas <= 0) return null;
  return SKILL_DEFS.map((def) => {
    const rate = Math.round(def.rate(stats) * 100) / 100;
    return { key: def.key, label: def.label, rate, tier: pickTier(rate, def.thresholds) };
  });
}

// Ranque agregado de um CLÃ inteiro (num modo): média das notas de TODO o
// elenco, ponderada por quantas partidas cada um jogou — assim um clã não
// vira "Ícone" só porque teve UM cara com nota alta em UMA partida.
export async function getClanRankInfo(clanId: string, mode: FutMode) {
  const stats = await prisma.futClanPlayerStats.findMany({ where: { clanId, mode, notaCount: { gt: 0 } } });
  if (stats.length === 0) return { notaMedia: null, totalPartidas: 0, jogadoresRanqueados: 0, tier: null as RankTier | null };

  const notaSomada = stats.reduce((s, x) => s + x.notaMedia * x.notaCount, 0);
  const notaCount = stats.reduce((s, x) => s + x.notaCount, 0);
  const totalPartidas = stats.reduce((s, x) => s + x.totalPartidas, 0);
  const notaMedia = notaCount > 0 ? Math.round((notaSomada / notaCount) * 100) / 100 : null;

  return {
    notaMedia,
    totalPartidas,
    jogadoresRanqueados: stats.length,
    tier: notaMedia != null ? getRankTier(notaMedia) : null,
  };
}

// ── Leaderboard ──────────────────────────────────────────────────────────
// Dois níveis, cada um com seu próprio dono de decisão:
//   • Servidor: o DONO DE VERDADE daquele servidor Discord (guild.ownerId
//     — não qualquer admin/aliança) autoriza no próprio painel do clã/
//     servidor. Guardado em guild_config.featFutLeaderboard.
//   • Global (cross-server): só quem tem BOT_OWNER_ID decide incluir um
//     servidor ali. Guardado em guild_config.futGlobalLeaderboard.
// As funções abaixo SÓ fazem a consulta/agregação — a permissão de quem
// pode LIGAR cada flag é checada em quem chama (comando/rota), não aqui.

type AggregatedPlayer = {
  discordId: string; displayName: string | null;
  totalPartidas: number; goals: number; assists: number; defesas: number; golsConcedidos: number; errosGraves: number;
  desarmes: number; boasJogadas: number; bloqueios: number; falhasDefensivas: number; falhasOfensivas: number;
  xp: number; notaMedia: number; notaCount: number;
};

function aggregatePlayerStats(rows: {
  discordId: string; displayName: string | null; totalPartidas: number; goals: number; assists: number; defesas: number;
  golsConcedidos: number; errosGraves: number; desarmes: number; boasJogadas: number; bloqueios: number;
  falhasDefensivas: number; falhasOfensivas: number; xp: number; notaMedia: number; notaCount: number;
}[]): AggregatedPlayer[] {
  const byId = new Map<string, AggregatedPlayer & { notaSomada: number }>();
  for (const s of rows) {
    // Leaderboard cross-clã só faz sentido pra quem tem conta de verdade —
    // gente do elenco offline ("offline:<id>") não é a "mesma pessoa" fora
    // daquele clã específico, então não entra na agregação.
    if (s.discordId.startsWith('offline:')) continue;

    const cur = byId.get(s.discordId) ?? {
      discordId: s.discordId, displayName: s.displayName,
      totalPartidas: 0, goals: 0, assists: 0, defesas: 0, golsConcedidos: 0, errosGraves: 0,
      desarmes: 0, boasJogadas: 0, bloqueios: 0, falhasDefensivas: 0, falhasOfensivas: 0,
      xp: 0, notaMedia: 0, notaCount: 0, notaSomada: 0,
    };
    cur.displayName = s.displayName || cur.displayName;
    cur.totalPartidas += s.totalPartidas;
    cur.goals += s.goals; cur.assists += s.assists; cur.defesas += s.defesas;
    cur.golsConcedidos += s.golsConcedidos; cur.errosGraves += s.errosGraves;
    cur.desarmes += s.desarmes; cur.boasJogadas += s.boasJogadas; cur.bloqueios += s.bloqueios;
    cur.falhasDefensivas += s.falhasDefensivas; cur.falhasOfensivas += s.falhasOfensivas;
    cur.xp += s.xp;
    cur.notaSomada += s.notaMedia * s.notaCount;
    cur.notaCount += s.notaCount;
    byId.set(s.discordId, cur);
  }

  return [...byId.values()]
    .map((c) => ({ ...c, notaMedia: c.notaCount > 0 ? Math.round((c.notaSomada / c.notaCount) * 100) / 100 : 0 }))
    .filter((c) => c.notaCount > 0);
}

export type LeaderboardEntry = AggregatedPlayer & { tier: RankTier; skills: SkillRank[] | null };

function toLeaderboardEntries(agg: AggregatedPlayer[], limit: number): LeaderboardEntry[] {
  return agg
    .sort((a, b) => b.notaMedia - a.notaMedia || b.xp - a.xp)
    .slice(0, limit)
    .map((p) => ({ ...p, tier: getRankTier(p.notaMedia), skills: getPlayerSkillRanks(p) }));
}

// Leaderboard INDIVIDUAL desse servidor — agrega todos os clãs (públicos e
// privados) do guildId informado, por discordId. Chamador é responsável por
// checar guild_config.featFutLeaderboard antes de mostrar isso pra alguém.
export async function getServerLeaderboard(guildId: string, mode: FutMode, limit = 20): Promise<LeaderboardEntry[]> {
  const clans = await prisma.futClan.findMany({ where: { guildId }, select: { id: true } });
  if (clans.length === 0) return [];
  const stats = await prisma.futClanPlayerStats.findMany({ where: { clanId: { in: clans.map((c) => c.id) }, mode } });
  return toLeaderboardEntries(aggregatePlayerStats(stats), limit);
}

// Leaderboard INDIVIDUAL global — só entram clãs de servidores cujo dono do
// BOT liberou (guild_config.futGlobalLeaderboard = true). Chamador é quem
// filtra os guildIds elegíveis (ver getGlobalLeaderboardGuildIds).
export async function getGlobalLeaderboard(mode: FutMode, limit = 50): Promise<LeaderboardEntry[]> {
  const guildIds = await getGlobalLeaderboardGuildIds();
  if (guildIds.length === 0) return [];
  const clans = await prisma.futClan.findMany({ where: { guildId: { in: guildIds } }, select: { id: true } });
  if (clans.length === 0) return [];
  const stats = await prisma.futClanPlayerStats.findMany({ where: { clanId: { in: clans.map((c) => c.id) }, mode } });
  return toLeaderboardEntries(aggregatePlayerStats(stats), limit);
}

// Servidores autorizados pelo DONO DO BOT a entrar no leaderboard global.
export async function getGlobalLeaderboardGuildIds(): Promise<string[]> {
  const rows = await prisma.guildConfig.findMany({ where: { futGlobalLeaderboard: true }, select: { guildId: true } });
  return rows.map((r) => r.guildId);
}

export type ClanLeaderboardEntry = { clanId: string; clanName: string; guildId: string; notaMedia: number; totalPartidas: number; jogadoresRanqueados: number; tier: RankTier };

async function buildClanLeaderboard(clans: { id: string; name: string; guildId: string }[], mode: FutMode, limit: number): Promise<ClanLeaderboardEntry[]> {
  const entries = await Promise.all(clans.map(async (c) => {
    const info = await getClanRankInfo(c.id, mode);
    if (info.notaMedia == null || !info.tier) return null;
    return { clanId: c.id, clanName: c.name, guildId: c.guildId, notaMedia: info.notaMedia, totalPartidas: info.totalPartidas, jogadoresRanqueados: info.jogadoresRanqueados, tier: info.tier };
  }));
  return entries
    .filter((e): e is ClanLeaderboardEntry => e != null)
    .sort((a, b) => b.notaMedia - a.notaMedia)
    .slice(0, limit);
}

// Leaderboard de CLÃS desse servidor (ranqueia os clãs entre si).
export async function getServerClanLeaderboard(guildId: string, mode: FutMode, limit = 20): Promise<ClanLeaderboardEntry[]> {
  const clans = await prisma.futClan.findMany({ where: { guildId }, select: { id: true, name: true, guildId: true } });
  return buildClanLeaderboard(clans, mode, limit);
}

// Leaderboard de CLÃS global (só servidores liberados pelo dono do bot).
export async function getGlobalClanLeaderboard(mode: FutMode, limit = 50): Promise<ClanLeaderboardEntry[]> {
  const guildIds = await getGlobalLeaderboardGuildIds();
  if (guildIds.length === 0) return [];
  const clans = await prisma.futClan.findMany({ where: { guildId: { in: guildIds } }, select: { id: true, name: true, guildId: true } });
  return buildClanLeaderboard(clans, mode, limit);
}

// ── Config do leaderboard (flags por servidor) ──────────────────────────

export async function getLeaderboardConfig(guildId: string) {
  const cfg = await prisma.guildConfig.findUnique({ where: { guildId } });
  return { featFutLeaderboard: cfg?.featFutLeaderboard ?? false, futGlobalLeaderboard: cfg?.futGlobalLeaderboard ?? false };
}

// Liga/desliga o leaderboard DO SERVIDOR — só quem chama essa função depois
// de confirmar que é o DONO DE VERDADE do servidor (guild.ownerId) deveria
// invocar isso (a checagem em si fica na rota/comando, que tem acesso ao
// objeto `guild` de verdade do Discord).
export async function setServerLeaderboardEnabled(guildId: string, enabled: boolean) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: { featFutLeaderboard: enabled },
    create: { guildId, featFutLeaderboard: enabled },
  });
}

// Liga/desliga a entrada de um servidor no leaderboard GLOBAL — só o dono
// do BOT deveria chamar isso (checagem de BOT_OWNER_ID fica em quem chama).
export async function setGlobalLeaderboardEnabled(guildId: string, enabled: boolean) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: { futGlobalLeaderboard: enabled },
    create: { guildId, futGlobalLeaderboard: enabled },
  });
}
