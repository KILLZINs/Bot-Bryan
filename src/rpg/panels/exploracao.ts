// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE EXPLORAÇÃO
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client';
import { FullCharacter, computeStats, addRpgXp } from '../services/character';
import { rollExploreEvent, EXPLORE_COOLDOWN_MS, EXPLORE_ENERGY_COST } from '../constants/exploration';
import { addTempBuff } from '../services/temp-buffs';
import { getLocation } from '../constants/locations';
import { getDayPhase, PHASE_INFO } from '../services/day-night';
import { incrementMissionProgress } from '../services/class-missions';

export async function buildExploracaoEmbed(char: FullCharacter): Promise<EmbedBuilder> {
  const stats = computeStats(char);
  const loc = getLocation(char.currentLocation);
  const phase = getDayPhase();
  const phaseInfo = PHASE_INFO[phase];

  const lastExplore = char.lastExplore;
  const onCooldown = lastExplore && (Date.now() - lastExplore.getTime()) < EXPLORE_COOLDOWN_MS;
  const cooldownRem = onCooldown
    ? Math.ceil((EXPLORE_COOLDOWN_MS - (Date.now() - lastExplore!.getTime())) / 60000)
    : 0;

  return new EmbedBuilder()
    .setColor(0x27AE60)
    .setTitle(`🌍 Exploração — ${loc.emoji} ${loc.name}`)
    .setDescription(
      onCooldown
        ? `⏳ Recuperando fôlego... próxima exploração em **${cooldownRem} min**`
        : `Explore os arredores de **${loc.name}** em busca de tesouros, perigos e segredos!\nCada exploração tem um evento **aleatório** diferente.`,
    )
    .addFields(
      { name: '⚡ Energia',  value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true },
      { name: '⏱️ Cooldown', value: onCooldown ? `🔴 ${cooldownRem} min` : '🟢 Pronto!', inline: true },
      {
        name: `${phaseInfo.emoji} Fase: ${phaseInfo.name}`,
        value: phaseInfo.xpBonus > 0 ? `+${Math.round(phaseInfo.xpBonus * 100)}% XP extra ✨` : phaseInfo.desc,
        inline: true,
      },
      {
        name: '🎲 Possíveis Eventos',
        value: [
          '💰 Tesouro Escondido',
          '⚔️ Emboscada',
          '🧙 Viajante Amigável',
          '🪤 Armadilha',
          '🏛️ Ruínas Antigas',
          '⛩️ Santuário',
          '🛒 Mercador Itinerante',
          '💎 Item Raro',
          '🌿 Caminho Tranquilo',
        ].join(' · '),
        inline: false,
      },
      {
        name: '💡 Custo',
        value: `**${EXPLORE_ENERGY_COST}⚡ Energia** por exploração`,
        inline: false,
      },
    )
    .setFooter({ text: '🌍 Exploração disponível a cada 3 minutos' });
}

export function buildExploracaoButtons(disabled: boolean): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('rpg:explorar')
        .setLabel(`🌍 Explorar! (${EXPLORE_ENERGY_COST}⚡)`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder().setCustomId('rpg:exploracao').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export async function doExplore(char: FullCharacter): Promise<{ success: boolean; embed?: EmbedBuilder; message?: string }> {
  if (char.currentEnergy < EXPLORE_ENERGY_COST) {
    return { success: false, message: `Energia insuficiente! Precisa de **${EXPLORE_ENERGY_COST}⚡**.` };
  }
  if (char.currentHp <= 0) {
    return { success: false, message: 'Você está sem HP! Cure-se na cidade antes de explorar.' };
  }

  const startedAt = new Date();
  const cutoff = new Date(startedAt.getTime() - EXPLORE_COOLDOWN_MS);
  const claimed = await prisma.rpgCharacter.updateMany({
    where: {
      discordId: char.discordId,
      currentHp: { gt: 0 },
      currentEnergy: { gte: EXPLORE_ENERGY_COST },
      OR: [{ lastExplore: null }, { lastExplore: { lte: cutoff } }],
    },
    data: { lastExplore: startedAt },
  });
  if (claimed.count === 0) {
    const fresh = await prisma.rpgCharacter.findUnique({ where: { discordId: char.discordId } });
    const rem = fresh?.lastExplore
      ? Math.ceil((EXPLORE_COOLDOWN_MS - (Date.now() - fresh.lastExplore.getTime())) / 60000)
      : 0;
    if (fresh && fresh.currentEnergy < EXPLORE_ENERGY_COST) {
      return { success: false, message: `Energia insuficiente! Precisa de **${EXPLORE_ENERGY_COST}⚡**.` };
    }
    return { success: false, message: `Aguarde **${rem} min** antes de explorar novamente.` };
  }

  const phase = getDayPhase();
  const phaseXpBonus = 1 + PHASE_INFO[phase].xpBonus;
  const current = await prisma.rpgCharacter.findUnique({ where: { discordId: char.discordId }, include: { equipment: true } });
  if (!current) return { success: false, message: 'Personagem não encontrado.' };
  const event = rollExploreEvent(current.level);

  const stats = computeStats(current);

  // Calcular resultados finais
  const xpGained   = Math.round(event.xpResult * phaseXpBonus);
  const goldGained  = Math.max(0, event.goldResult);
  const goldLost    = event.goldResult < 0 ? Math.min(current.gold, Math.abs(event.goldResult)) : 0;
  const hpChange    = event.hpResult;
  const newHp       = Math.max(0, Math.min(stats.maxHp, current.currentHp + hpChange));
  const newEnergy   = Math.max(0, Math.min(stats.maxEnergy, current.currentEnergy - EXPLORE_ENERGY_COST + Math.max(0, event.energyResult)));

  // Buff de mercador
  if (event.type === 'merchant' && event.buff && current.gold >= Math.abs(event.goldResult)) {
    await addTempBuff(current.discordId, event.buff.type as any, event.buff.value, event.buff.durationMs, 'exploracao', event.buff.label);
  }

  if (xpGained > 0) {
    await addRpgXp(current, xpGained, { currentHp: newHp, currentEnergy: newEnergy });
  }
  await prisma.rpgCharacter.update({
    where: { discordId: current.discordId },
    data: {
      gold: { increment: goldGained - goldLost },
      ...(xpGained > 0 ? {} : { currentHp: newHp, currentEnergy: newEnergy }),
      lastExplore: startedAt,
    },
  });

  // Missões
  await incrementMissionProgress(current.discordId, 'explore', 1).catch(() => null);

  // Construir embed do resultado
  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (xpGained > 0)  fields.push({ name: '⭐ XP',   value: `+**${xpGained}**`,  inline: true });
  if (goldGained > 0) fields.push({ name: '💰 Ouro', value: `+**${goldGained}🪙**`, inline: true });
  if (goldLost > 0)   fields.push({ name: '💸 Ouro Perdido', value: `-**${goldLost}🪙**`, inline: true });
  if (hpChange !== 0) fields.push({
    name: hpChange > 0 ? '❤️ HP' : '💔 Dano',
    value: `${hpChange > 0 ? '+' : ''}**${hpChange}** (${newHp}/${stats.maxHp})`,
    inline: true,
  });
  if (event.energyResult !== 0) fields.push({ name: '⚡ Energia', value: `${event.energyResult > 0 ? '+' : ''}**${event.energyResult}**`, inline: true });
  if (event.type === 'merchant' && event.buff) fields.push({ name: '✨ Buff', value: event.buff.label, inline: true });

  const color = event.type === 'ambush' || event.type === 'trap'
    ? 0xE74C3C
    : event.type === 'treasure' || event.type === 'rare_item'
    ? 0xFFD700
    : 0x27AE60;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${event.emoji} ${event.title}`)
    .setDescription(event.descriptions[0])
    .addFields(fields)
    .setFooter({ text: '🌍 Próxima exploração disponível em 3 minutos' });

  return { success: true, embed };
}
