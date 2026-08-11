// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE CASAMENTO — propor, aceitar, rejeitar, divorciar
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';

const PROPOSAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas

// ─── Obter casamento do usuário ────────────────────────────────────────

export async function getMarriage(userId: string) {
  return prisma.marriage.findFirst({
    where: {
      OR: [{ userId1: userId }, { userId2: userId }],
    },
  });
}

// ─── Obter parceiro ────────────────────────────────────────────────────

export function getPartner(marriage: { userId1: string; userId2: string }, userId: string): string {
  return marriage.userId1 === userId ? marriage.userId2 : marriage.userId1;
}

// ─── Obter propostas recebidas pendentes ───────────────────────────────

export async function getPendingProposals(targetId: string) {
  return prisma.marriageProposal.findMany({
    where: {
      targetId,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Propor casamento ─────────────────────────────────────────────────

export async function proposeMarriage(
  proposerId: string,
  targetId: string,
  guildId: string,
): Promise<{ success: boolean; message: string }> {
  if (proposerId === targetId) {
    return { success: false, message: 'Você não pode se casar consigo mesmo! 😅' };
  }

  // Verificar se já está casado
  const myMarriage = await getMarriage(proposerId);
  if (myMarriage) return { success: false, message: 'Você já está casado(a)! Divorce-se primeiro.' };

  const theirMarriage = await getMarriage(targetId);
  if (theirMarriage) return { success: false, message: 'Esta pessoa já está casada com alguém!' };

  // Verificar proposta existente
  const existing = await prisma.marriageProposal.findFirst({
    where: { proposerId, targetId, status: 'pending' },
  });
  if (existing) return { success: false, message: 'Você já enviou uma proposta para esta pessoa!' };

  // Verificar se o alvo também me propôs (aceitar automaticamente?)
  const reverseProposal = await prisma.marriageProposal.findFirst({
    where: { proposerId: targetId, targetId: proposerId, status: 'pending' },
  });

  if (reverseProposal) {
    // Aceitar automaticamente
    await acceptProposal(reverseProposal.id, proposerId);
    return { success: true, message: '💍 Vocês dois se propuseram mutuamente! Casamento realizado! 💕' };
  }

  await prisma.marriageProposal.create({
    data: {
      proposerId,
      targetId,
      guildId,
      status: 'pending',
      expiresAt: new Date(Date.now() + PROPOSAL_EXPIRY_MS),
    },
  });

  return { success: true, message: `💍 Proposta enviada! A pessoa tem 24 horas para aceitar via painel de Casamento.` };
}

// ─── Aceitar proposta ──────────────────────────────────────────────────

export async function acceptProposal(
  proposalId: string,
  targetId: string,
): Promise<{ success: boolean; message: string; proposerId?: string }> {
  const proposal = await prisma.marriageProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.targetId !== targetId) {
    return { success: false, message: 'Proposta não encontrada ou não é sua.' };
  }
  if (proposal.status !== 'pending') {
    return { success: false, message: 'Esta proposta já foi respondida.' };
  }
  if (proposal.expiresAt < new Date()) {
    await prisma.marriageProposal.update({ where: { id: proposalId }, data: { status: 'expired' } });
    return { success: false, message: 'Esta proposta já expirou.' };
  }

  // Verificar se algum dos dois já se casou enquanto isso
  const [myMarriage, theirMarriage] = await Promise.all([
    getMarriage(targetId),
    getMarriage(proposal.proposerId),
  ]);
  if (myMarriage || theirMarriage) {
    await prisma.marriageProposal.update({ where: { id: proposalId }, data: { status: 'expired' } });
    return { success: false, message: 'Um dos dois já está casado com outra pessoa.' };
  }

  await prisma.$transaction([
    prisma.marriageProposal.update({ where: { id: proposalId }, data: { status: 'accepted' } }),
    prisma.marriage.create({
      data: { userId1: proposal.proposerId, userId2: targetId },
    }),
    // Expirar outras propostas pendentes dos dois
    prisma.marriageProposal.updateMany({
      where: { OR: [{ proposerId: targetId }, { targetId }], status: 'pending', id: { not: proposalId } },
      data: { status: 'expired' },
    }),
  ]);

  return { success: true, message: '💍 Casamento realizado! Felicidades! 💕', proposerId: proposal.proposerId };
}

// ─── Rejeitar proposta ─────────────────────────────────────────────────

export async function rejectProposal(
  proposalId: string,
  targetId: string,
): Promise<{ success: boolean; message: string }> {
  const proposal = await prisma.marriageProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.targetId !== targetId) {
    return { success: false, message: 'Proposta não encontrada.' };
  }
  await prisma.marriageProposal.update({ where: { id: proposalId }, data: { status: 'rejected' } });
  return { success: true, message: '💔 Proposta recusada.' };
}

// ─── Divorciar ────────────────────────────────────────────────────────

export async function divorce(userId: string): Promise<{ success: boolean; message: string }> {
  const marriage = await getMarriage(userId);
  if (!marriage) return { success: false, message: 'Você não está casado(a).' };

  await prisma.marriage.delete({ where: { id: marriage.id } });
  return { success: true, message: '💔 Divórcio realizado. Você está solteiro(a) novamente.' };
}

// ─── Expirar propostas antigas ─────────────────────────────────────────

export async function expireOldProposals() {
  await prisma.marriageProposal.updateMany({
    where: { status: 'pending', expiresAt: { lte: new Date() } },
    data: { status: 'expired' },
  });
}
