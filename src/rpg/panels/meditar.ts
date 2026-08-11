// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE MEDITAÇÃO
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client';
import { FullCharacter, computeStats, hpBar } from '../services/character';
import { getDayPhase, PHASE_INFO } from '../services/day-night';

interface MeditationOption {
  id: string;
  label: string;
  emoji: string;
  durationMs: number;
  hpPercent: number;   // % do maxHp que restaura
  energyFlat: number;  // energia restaurada
  buffChance: number;  // chance de buff de XP temporário (0–1)
}

const OPTIONS: MeditationOption[] = [
  { id: 'rapida',  label: '5 minutos',  emoji: '⏱️', durationMs: 5  * 60 * 1000, hpPercent: 0.25, energyFlat: 15, buffChance: 0    },
  { id: 'media',   label: '15 minutos', emoji: '⏰', durationMs: 15 * 60 * 1000, hpPercent: 0.55, energyFlat: 30, buffChance: 0.3  },
  { id: 'profunda',label: '30 minutos', emoji: '🕰️', durationMs: 30 * 60 * 1000, hpPercent: 1.0,  energyFlat: 99, buffChance: 0.7  },
];

export function buildMeditarEmbed(char: FullCharacter): EmbedBuilder {
  const stats = computeStats(char);
  const phase = getDayPhase();
  const phaseInfo = PHASE_INFO[phase];
  const isMeditating = char.meditatingUntil && char.meditatingUntil > new Date();
  const isReady = char.meditatingUntil && char.meditatingUntil <= new Date();

  let status: string;
  if (isMeditating) {
    const remMs = char.meditatingUntil!.getTime() - Date.now();
    const remMin = Math.ceil(remMs / 60000);
    status = `🧘 **Meditando...** — ${remMin} min restante(s)\n*Use 🪷 Coletar quando terminar!*`;
  } else if (isReady) {
    status = `✅ **Meditação concluída!** Clique em 🪷 Coletar para receber os bônus!`;
  } else {
    status = `Escolha a duração da meditação abaixo.\nQuanto mais longa, maior a recuperação.`;
  }

  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🧘 Meditação')
    .setDescription(status)
    .addFields(
      { name: '❤️ HP Atual', value: `${hpBar(char.currentHp, stats.maxHp)} **${char.currentHp}/${stats.maxHp}**`, inline: false },
      { name: '⚡ Energia',  value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true },
      {
        name: `${phaseInfo.emoji} Fase do Dia — ${phaseInfo.name}`,
        value: phaseInfo.meditaBonus > 0
          ? `+${Math.round(phaseInfo.meditaBonus * 100)}% eficiência de meditação ✨`
          : phaseInfo.desc,
        inline: true,
      },
      {
        name: '📋 Opções',
        value: OPTIONS.map(o => {
          const bonusMult = 1 + phaseInfo.meditaBonus;
          const hp = Math.round(o.hpPercent * 100 * bonusMult);
          const en = Math.round(o.energyFlat * bonusMult);
          const buff = o.buffChance > 0 ? ` | ${Math.round(o.buffChance * 100)}% chance de +15% XP (1h)` : '';
          return `${o.emoji} **${o.label}** — Restaura ${hp}% HP + ${en} Energia${buff}`;
        }).join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: '🧘 Meditação recarrega a cada 30 minutos' });
}

export function buildMeditarButtons(char: FullCharacter): ActionRowBuilder<ButtonBuilder>[] {
  const isMeditating = char.meditatingUntil && char.meditatingUntil > new Date();
  const isReady = char.meditatingUntil && char.meditatingUntil <= new Date();

  if (isReady) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('rpg:meditar_coletar').setLabel('🪷 Coletar Bônus').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:meditar_rapida').setLabel('⏱️ 5 min').setStyle(ButtonStyle.Primary).setDisabled(!!isMeditating),
    new ButtonBuilder().setCustomId('rpg:meditar_media').setLabel('⏰ 15 min').setStyle(ButtonStyle.Primary).setDisabled(!!isMeditating),
    new ButtonBuilder().setCustomId('rpg:meditar_profunda').setLabel('🕰️ 30 min').setStyle(ButtonStyle.Primary).setDisabled(!!isMeditating),
    new ButtonBuilder().setCustomId('rpg:meditar_coletar').setLabel('🪷 Coletar').setStyle(ButtonStyle.Success).setDisabled(!isReady),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
  );
  return [row1];
}

export async function startMeditation(char: FullCharacter, optionId: string): Promise<{ success: boolean; message: string }> {
  // Verificar cooldown (30min desde última meditação completa)
  if (char.lastRest) {
    const elapsed = Date.now() - char.lastRest.getTime();
    const cooldownMs = 30 * 60 * 1000;
    if (elapsed < cooldownMs && !char.meditatingUntil) {
      const rem = Math.ceil((cooldownMs - elapsed) / 60000);
      return { success: false, message: `Você precisa esperar **${rem} min** antes de meditar novamente.` };
    }
  }
  if (char.meditatingUntil && char.meditatingUntil > new Date()) {
    return { success: false, message: 'Você já está meditando!' };
  }

  const option = OPTIONS.find(o => o.id === optionId);
  if (!option) return { success: false, message: 'Opção inválida.' };

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: { meditatingUntil: new Date(Date.now() + option.durationMs) },
  });
  return { success: true, message: `🧘 Iniciando meditação de **${option.label}**...` };
}

export async function collectMeditation(char: FullCharacter): Promise<{
  success: boolean; message: string;
  hpGained: number; energyGained: number; buffGiven: boolean;
}> {
  if (!char.meditatingUntil) {
    return { success: false, message: 'Você não estava meditando.', hpGained: 0, energyGained: 0, buffGiven: false };
  }
  if (char.meditatingUntil > new Date()) {
    const rem = Math.ceil((char.meditatingUntil.getTime() - Date.now()) / 60000);
    return { success: false, message: `Ainda faltam **${rem} min** para terminar.`, hpGained: 0, energyGained: 0, buffGiven: false };
  }

  // Determinar qual opção pelo tempo de meditação estimado
  const durMs = (char.meditatingUntil.getTime() - (char.lastRest?.getTime() ?? char.meditatingUntil.getTime() - 5 * 60 * 1000));
  const option = OPTIONS.reduce((prev, cur) =>
    Math.abs(cur.durationMs - durMs) < Math.abs(prev.durationMs - durMs) ? cur : prev,
  ) ?? OPTIONS[0];

  const phase = getDayPhase();
  const bonusMult = 1 + PHASE_INFO[phase].meditaBonus;
  const stats = computeStats(char);

  const hpGained = Math.min(
    stats.maxHp - char.currentHp,
    Math.round(stats.maxHp * option.hpPercent * bonusMult),
  );
  const energyGained = Math.min(
    stats.maxEnergy - char.currentEnergy,
    Math.round(option.energyFlat * bonusMult),
  );
  const buffGiven = Math.random() < option.buffChance;

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: {
      currentHp: Math.min(stats.maxHp, char.currentHp + hpGained),
      currentEnergy: Math.min(stats.maxEnergy, char.currentEnergy + energyGained),
      meditatingUntil: null,
      lastRest: new Date(),
    },
  });

  if (buffGiven) {
    const { addTempBuff } = await import('../services/temp-buffs');
    await addTempBuff(char.discordId, 'xp_pct', 0.15, 60 * 60 * 1000, 'meditacao', 'XP (Meditação)');
  }

  // Progresso de missões
  const { incrementMissionProgress } = await import('../services/class-missions');
  await incrementMissionProgress(char.discordId, 'meditate', 1).catch(() => null);

  return { success: true, message: 'Meditação concluída!', hpGained, energyGained, buffGiven };
}
