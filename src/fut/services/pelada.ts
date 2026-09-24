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
export type FutEventType = 'gol' | 'assistencia' | 'defesa' | 'concedido' | 'erro';
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
    throw new FutError(`Esse servidor já tem o máximo de ${MAX_CLANS_PER_GUILD} clãs. Delete um clã existente (\`/fut cla deletar\`) pra liberar um espaço.`);
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

export async function createPartida(clanId: string, creatorId: string, creatorName: string, mode: FutMode, name?: string) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');

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

// Salva a animação (sequência de frames) de um gol específico. Feito no
// PÓS-PARTIDA, no site — só quem criou a partida pode editar.
export async function saveGoalAnimation(eventId: string, requesterId: string, frames: unknown) {
  const event = await prisma.futMatchEvent.findUnique({ where: { id: eventId }, include: { partida: true } });
  if (!event) throw new FutError('Gol não encontrado.');
  if (event.type !== 'gol') throw new FutError('Só dá pra montar animação em eventos de gol.');
  if (event.partida.creatorId !== requesterId) throw new FutError('Só quem criou a partida pode editar a animação desse gol.');

  const clean = sanitizeFrames(frames);
  await prisma.futMatchEvent.update({ where: { id: eventId }, data: { animationFrames: JSON.stringify(clean) } });
  return clean;
}

export async function getGoalAnimation(eventId: string) {
  const event = await prisma.futMatchEvent.findUnique({ where: { id: eventId }, include: { player: true, partida: true } });
  if (!event) throw new FutError('Gol não encontrado.');
  let frames: FutAnimationFrame[] = [];
  if (event.animationFrames) {
    try { frames = JSON.parse(event.animationFrames); } catch { frames = []; }
  }
  return { eventId: event.id, displayName: event.player?.displayName || 'Desconhecido', partidaId: event.partidaId, clanId: event.partida.clanId, creatorId: event.partida.creatorId, frames };
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
function calcNota(p: { goals: number; assists: number; defesas: number; golsConcedidos: number; errosGraves: number }, resultLabel: 'vitorias' | 'derrotas' | 'empates') {
  let nota = 6.0
    + p.goals * 1.0
    + p.assists * 0.6
    + p.defesas * 0.25
    - p.golsConcedidos * 0.25
    - p.errosGraves * 0.7;

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
      _sum: { goals: true, assists: true, defesas: true, golsConcedidos: true, errosGraves: true, vitorias: true, derrotas: true, empates: true },
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
