// ═══════════════════════════════════════════════════════════════════════
// SISTEMA "RACHÃO" — núcleo (fase 1)
// Toda a lógica de criar pelada, inscrever jogadores, registrar eventos
// (gol/assistência/defesa/gol concedido/erro grave) e fechar a partida
// atualizando o perfil agregado de cada jogador. Comandos do Discord (e no
// futuro o site) chamam SOMENTE essas funções — nunca reimplementam a regra.
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';

export type FutMode = 'futsal' | 'campo';
export type FutEventType = 'gol' | 'assistencia' | 'defesa' | 'concedido' | 'erro';
export type FutTeam = 'A' | 'B';
export type FutResultado = 'vitoria_a' | 'vitoria_b' | 'empate';

export class FutError extends Error {}

// XP por participação e desempenho — deliberadamente simples na fase 1,
// dá pra calibrar depois sem mexer no resto do sistema.
const XP_PARTICIPACAO = 10;
const XP_POR_GOL = 15;
const XP_POR_ASSIST = 8;
const XP_POR_DEFESA = 5;
const XP_POR_ERRO = -3;
const XP_BONUS_VITORIA = 20;

export async function getOpenPelada(guildId: string) {
  return prisma.futPelada.findFirst({
    where: { guildId, status: { in: ['aberta', 'em_andamento'] } },
    orderBy: { createdAt: 'desc' },
    include: { players: true },
  });
}

export async function getPeladaById(peladaId: string) {
  return prisma.futPelada.findUnique({
    where: { id: peladaId },
    include: { players: true },
  });
}

export async function createPelada(guildId: string, creatorId: string, creatorName: string, mode: FutMode, name?: string) {
  const existing = await getOpenPelada(guildId);
  if (existing) {
    throw new FutError(`Já tem uma pelada em aberto neste servidor (**${existing.name || 'sem nome'}**). Finalize ela antes de criar outra.`);
  }

  return prisma.futPelada.create({
    data: {
      guildId,
      creatorId,
      name: name?.slice(0, 60) || null,
      mode,
      players: {
        create: [{ discordId: creatorId, displayName: creatorName.slice(0, 40) }],
      },
    },
    include: { players: true },
  });
}

function assertNotFinished(pelada: { status: string }) {
  if (pelada.status === 'finalizada') {
    throw new FutError('Essa pelada já foi finalizada.');
  }
}

export async function joinPelada(peladaId: string, discordId: string, displayName: string, position?: string) {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) throw new FutError('Pelada não encontrada.');
  assertNotFinished(pelada);

  const already = pelada.players.find((p) => p.discordId === discordId);
  if (already) throw new FutError('Você já está inscrito nessa pelada.');

  return prisma.futPeladaPlayer.create({
    data: { peladaId, discordId, displayName: displayName.slice(0, 40), position: position?.slice(0, 30) || null },
  });
}

export async function addOfflinePlayer(peladaId: string, apelido: string, position?: string) {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) throw new FutError('Pelada não encontrada.');
  assertNotFinished(pelada);

  const clean = apelido.trim().slice(0, 40);
  if (!clean) throw new FutError('Dê um apelido válido pro jogador.');

  const already = pelada.players.find((p) => p.displayName.toLowerCase() === clean.toLowerCase());
  if (already) throw new FutError('Já existe um jogador com esse apelido nessa pelada.');

  return prisma.futPeladaPlayer.create({
    data: { peladaId, displayName: clean, position: position?.slice(0, 30) || null },
  });
}

export async function setTeam(peladaId: string, player: { discordId?: string; apelido?: string }, team: FutTeam) {
  const target = await resolvePlayer(peladaId, player);
  await prisma.futPeladaPlayer.update({ where: { id: target.id }, data: { team } });
  return target;
}

export async function startPelada(peladaId: string, requesterId: string) {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) throw new FutError('Pelada não encontrada.');
  if (pelada.creatorId !== requesterId) throw new FutError('Só quem criou a pelada pode iniciar ela.');
  if (pelada.status !== 'aberta') throw new FutError('Essa pelada já foi iniciada ou finalizada.');
  if (pelada.players.length < 2) throw new FutError('Precisa de pelo menos 2 jogadores inscritos pra iniciar.');

  return prisma.futPelada.update({
    where: { id: peladaId },
    data: { status: 'em_andamento', startedAt: new Date() },
    include: { players: true },
  });
}

// Acha o jogador da pelada por ID do Discord OU por apelido (jogador offline).
export async function resolvePlayer(peladaId: string, ref: { discordId?: string; apelido?: string }) {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) throw new FutError('Pelada não encontrada.');

  let player = null;
  if (ref.discordId) {
    player = pelada.players.find((p) => p.discordId === ref.discordId) || null;
  } else if (ref.apelido) {
    const clean = ref.apelido.trim().toLowerCase();
    player = pelada.players.find((p) => p.displayName.toLowerCase() === clean) || null;
  }

  if (!player) throw new FutError('Não achei esse jogador inscrito nessa pelada. Confira o apelido/menção ou use `/fut entrar` ou `/fut adicionar` primeiro.');
  return player;
}

export async function recordEvent(peladaId: string, playerRef: { discordId?: string; apelido?: string }, type: FutEventType, assistRef?: { discordId?: string; apelido?: string }) {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) throw new FutError('Pelada não encontrada.');
  if (pelada.status !== 'em_andamento') throw new FutError('A pelada precisa estar em andamento (`/fut iniciar`) pra registrar eventos.');

  const player = await resolvePlayer(peladaId, playerRef);

  // Branches explícitos (em vez de chave computada) pra ficar seguro em tipo
  // com o Prisma — um objeto com chave dinâmica não bate com o tipo estrito
  // de update que o Prisma Client gera pra cada model.
  switch (type) {
    case 'gol':
      await prisma.futPeladaPlayer.update({ where: { id: player.id }, data: { goals: { increment: 1 } } });
      break;
    case 'assistencia':
      await prisma.futPeladaPlayer.update({ where: { id: player.id }, data: { assists: { increment: 1 } } });
      break;
    case 'defesa':
      await prisma.futPeladaPlayer.update({ where: { id: player.id }, data: { defesas: { increment: 1 } } });
      break;
    case 'concedido':
      await prisma.futPeladaPlayer.update({ where: { id: player.id }, data: { golsConcedidos: { increment: 1 } } });
      break;
    case 'erro':
      await prisma.futPeladaPlayer.update({ where: { id: player.id }, data: { errosGraves: { increment: 1 } } });
      break;
  }
  await prisma.futMatchEvent.create({ data: { peladaId, playerId: player.id, type } });

  if (type === 'gol' && player.team) {
    await prisma.futPelada.update({
      where: { id: peladaId },
      data: player.team === 'A' ? { scoreA: { increment: 1 } } : { scoreB: { increment: 1 } },
    });
  }

  let assistPlayer = null;
  if (type === 'gol' && assistRef && (assistRef.discordId || assistRef.apelido)) {
    assistPlayer = await resolvePlayer(peladaId, assistRef);
    await prisma.futPeladaPlayer.update({ where: { id: assistPlayer.id }, data: { assists: { increment: 1 } } });
    await prisma.futMatchEvent.create({ data: { peladaId, playerId: assistPlayer.id, type: 'assistencia' } });
  }

  return { player, assistPlayer };
}

export async function finishPelada(peladaId: string, requesterId: string, resultadoOverride?: FutResultado) {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) throw new FutError('Pelada não encontrada.');
  if (pelada.creatorId !== requesterId) throw new FutError('Só quem criou a pelada pode finalizar ela.');
  assertNotFinished(pelada);

  const resultado: FutResultado = resultadoOverride
    ?? (pelada.scoreA > pelada.scoreB ? 'vitoria_a' : pelada.scoreB > pelada.scoreA ? 'vitoria_b' : 'empate');

  const updated = await prisma.futPelada.update({
    where: { id: peladaId },
    data: { status: 'finalizada', finishedAt: new Date(), resultado },
    include: { players: true },
  });

  // Atualiza o perfil agregado de cada jogador com conta do Discord vinculada.
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

    await prisma.futPlayerProfile.upsert({
      where: { guildId_discordId: { guildId: pelada.guildId, discordId: p.discordId } },
      create: {
        guildId: pelada.guildId,
        discordId: p.discordId,
        totalPeladas: 1,
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
        totalPeladas: { increment: 1 },
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

export async function getProfile(guildId: string, discordId: string) {
  return prisma.futPlayerProfile.findUnique({ where: { guildId_discordId: { guildId, discordId } } });
}

export async function getRanking(guildId: string, limit = 10) {
  return prisma.futPlayerProfile.findMany({
    where: { guildId },
    orderBy: { xp: 'desc' },
    take: limit,
  });
}
