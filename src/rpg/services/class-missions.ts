// ═══════════════════════════════════════════════════════════════════════
// SERVIÇO DE MISSÕES DIÁRIAS POR CLASSE
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';
import { getMissionsForClass, CLASS_MISSIONS, type MissionTrigger } from '../constants/class-missions';
import { addRpgXp } from './character';

function today() { return new Date().toISOString().slice(0, 10); }

/** Garante que o personagem tem 3 missões de classe para hoje. Idempotente. */
export async function ensureClassMissions(discordId: string, playerClass: string): Promise<void> {
  const dateStr = today();
  const existing = await prisma.rpgClassMission.findMany({ where: { discordId, dateStr } });
  if (existing.length >= 3) return;

  const templates = getMissionsForClass(playerClass);
  for (const tpl of templates) {
    await prisma.rpgClassMission.upsert({
      where: { discordId_dateStr_missionKey: { discordId, dateStr, missionKey: tpl.key } },
      update: {},
      create: {
        discordId, dateStr,
        missionKey: tpl.key,
        target: tpl.target,
        xpReward: tpl.xpReward,
        goldReward: tpl.goldReward,
        energyReward: tpl.energyReward,
      },
    });
  }
}

/** Incrementa progresso de missões pelo tipo de trigger */
export async function incrementMissionProgress(discordId: string, trigger: MissionTrigger, amount: number): Promise<void> {
  const dateStr = today();
  const missions = await prisma.rpgClassMission.findMany({
    where: { discordId, dateStr, completed: false },
  });

  const relevant = missions.filter((m: any) => {
    const tpl = CLASS_MISSIONS.find((t: any) => t.key === m.missionKey);
    return tpl?.trigger === trigger;
  });

  for (const m of relevant) {
    const newProgress = Math.min(m.target, m.progress + amount);
    const completed   = newProgress >= m.target;
    await prisma.rpgClassMission.update({
      where: { id: m.id },
      data: { progress: newProgress, completed },
    });
  }
}

/** Reivindica recompensa de uma missão concluída */
export async function claimClassMission(discordId: string, missionId: string): Promise<{
  success: boolean; message: string; xp?: number; gold?: number; energy?: number;
}> {
  const mission = await prisma.rpgClassMission.findUnique({ where: { id: missionId } });
  if (!mission || mission.discordId !== discordId)
    return { success: false, message: 'Missão não encontrada.' };
  if (!mission.completed)
    return { success: false, message: 'Missão ainda não concluída.' };
  if (mission.claimed)
    return { success: false, message: 'Recompensa já coletada!' };

  const char = await prisma.rpgCharacter.findUnique({
    where: { discordId },
    include: { equipment: true },
  });
  if (!char) return { success: false, message: 'Personagem não encontrado.' };

  const claimed = await prisma.rpgClassMission.updateMany({
    where: { id: missionId, discordId, claimed: false },
    data: { claimed: true },
  });
  if (!claimed.count) return { success: false, message: 'Essa recompensa já foi coletada.' };
  await addRpgXp(char, mission.xpReward, {
    currentEnergy: Math.min(char.maxEnergy, char.currentEnergy + mission.energyReward),
  });
  await prisma.rpgCharacter.update({
    where: { discordId },
    data: { gold: { increment: mission.goldReward } },
  });

  return {
    success: true,
    message: `🎁 Recompensa coletada!`,
    xp: mission.xpReward, gold: mission.goldReward, energy: mission.energyReward,
  };
}
