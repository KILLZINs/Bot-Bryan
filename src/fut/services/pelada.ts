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

export class FutError extends Error {}

const XP_PARTICIPACAO = 10;
const XP_POR_GOL = 15;
const XP_POR_ASSIST = 8;
const XP_POR_DEFESA = 5;
const XP_POR_ERRO = -3;
const XP_BONUS_VITORIA = 20;

// ── Clã ──────────────────────────────────────────────────────────────────

export async function listClans(guildId: string) {
  return prisma.futClan.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, include: { members: true } });
}

export async function getClanByName(guildId: string, name: string) {
  const clean = name.trim();
  return prisma.futClan.findFirst({
    where: { guildId, name: { equals: clean, mode: 'insensitive' } },
    include: { members: true },
  });
}

export async function getClanById(clanId: string) {
  return prisma.futClan.findUnique({ where: { id: clanId }, include: { members: true } });
}

export async function createClan(guildId: string, creatorId: string, creatorName: string, name: string) {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new FutError('Dê um nome válido pro clã.');

  const existing = await getClanByName(guildId, clean);
  if (existing) throw new FutError(`Já existe um clã chamado **${existing.name}** neste servidor.`);

  return prisma.futClan.create({
    data: {
      guildId,
      creatorId,
      name: clean,
      members: { create: [{ discordId: creatorId, displayName: creatorName.slice(0, 40) }] },
    },
    include: { members: true },
  });
}

export async function joinClan(clanId: string, discordId: string, displayName: string) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (clan.members.some((m) => m.discordId === discordId)) throw new FutError('Você já faz parte desse clã.');

  return prisma.futClanMember.create({ data: { clanId, discordId, displayName: displayName.slice(0, 40) } });
}

export async function deleteClan(clanId: string, requesterId: string) {
  const clan = await getClanById(clanId);
  if (!clan) throw new FutError('Clã não encontrado.');
  if (clan.creatorId !== requesterId) throw new FutError('Só quem criou o clã pode deletar ele.');

  await prisma.futClan.delete({ where: { id: clanId } });
  return clan;
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

export async function recordEvent(partidaId: string, playerRef: { discordId?: string; apelido?: string }, type: FutEventType, assistRef?: { discordId?: string; apelido?: string }) {
  const partida = await getPartidaById(partidaId);
  if (!partida) throw new FutError('Partida não encontrada.');
  if (partida.status !== 'em_andamento') throw new FutError('A partida precisa estar em andamento (`iniciar`) pra registrar eventos.');

  const player = await resolvePlayer(partidaId, playerRef);

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
  await prisma.futMatchEvent.create({ data: { partidaId, playerId: player.id, type } });

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

  return { player, assistPlayer };
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
  // por modo (futsal x campo não se misturam).
  for (const p of updated.players) {
    if (!p.discordId) continue;

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

    await prisma.futClanPlayerStats.upsert({
      where: { clanId_discordId_mode: { clanId: updated.clanId, discordId: p.discordId, mode } },
      create: {
        clanId: updated.clanId,
        discordId: p.discordId,
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
      },
      update: {
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
      },
    });
  }

  return updated;
}

export async function getProfile(clanId: string, discordId: string, mode: FutMode) {
  return prisma.futClanPlayerStats.findUnique({ where: { clanId_discordId_mode: { clanId, discordId, mode } } });
}

export async function getRanking(clanId: string, mode: FutMode, limit = 10) {
  return prisma.futClanPlayerStats.findMany({ where: { clanId, mode }, orderBy: { xp: 'desc' }, take: limit });
}
