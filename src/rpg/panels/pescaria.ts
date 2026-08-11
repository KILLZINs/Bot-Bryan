// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE PESCA
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client';
import { FullCharacter, computeStats } from '../services/character';
import { rollFish, RARITY_COLOR, RARITY_LABEL, FISHING_COOLDOWN_MS, FISHING_ENERGY_COST } from '../constants/fishing';
import { getDayPhase, PHASE_INFO } from '../services/day-night';
import { incrementMissionProgress } from '../services/class-missions';

export async function buildPescariaEmbed(char: FullCharacter): Promise<EmbedBuilder> {
  const phase = getDayPhase();
  const phaseInfo = PHASE_INFO[phase];
  const stats = computeStats(char);

  // Verificar se há uma sessão ativa
  const session = await prisma.rpgFishingSession.findUnique({ where: { discordId: char.discordId } });
  const isWaiting = session && session.reelableAt > new Date();
  const isReady   = session && session.reelableAt <= new Date();

  let status: string;
  if (isWaiting) {
    // <t:UNIX:R> atualiza em tempo real no Discord (ex: "daqui 1 minuto")
    const ts = Math.floor(session.reelableAt.getTime() / 1000);
    status = `🎣 **Aguardando...** isca na água!\n⏳ Pronto para puxar <t:${ts}:R>`;
  } else if (isReady) {
    status = `🐟 **Algo puxou a isca!** Clique em 🪝 Puxar para recolher!`;
  } else {
    status = `Jogue a isca na água e espere. Pesque para ganhar peixes, ouro e itens raros!\n\n**Custo:** ${FISHING_ENERGY_COST}⚡ Energia · **Espera:** 2 minutos`;
  }

  return new EmbedBuilder()
    .setColor(0x1E90FF)
    .setTitle('🎣 Área de Pesca')
    .setDescription(status)
    .addFields(
      { name: '⚡ Energia', value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true },
      {
        name: `${phaseInfo.emoji} ${phaseInfo.name}`,
        value: phaseInfo.fishBonus > 0
          ? `+${Math.round(phaseInfo.fishBonus * 100)}% chance de peixe raro! 🐟`
          : 'Sem bônus de pesca agora.',
        inline: true,
      },
      {
        name: '📋 Peixes Possíveis',
        value: [
          '🐟 Comum — Peixes pequenos e lixo',
          '🐠 Incomum — Frutos do mar, restauram HP/Energia',
          '🔵 Raro — Peixes grandes e baús afogados',
          '🟣 Épico — Criaturas marinhas lendárias',
          '⭐ Lendário — Dragão do Mar (muy difícil)',
        ].join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: '🎣 Pesca disponível a cada 10 minutos' });
}

export function buildPescariaButtons(char: FullCharacter, sessionExists: boolean, isReady: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const stats = computeStats(char);
  const semEnergia = char.currentEnergy < FISHING_ENERGY_COST;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rpg:pesca_lancar')
      .setLabel(`🎣 Lançar Isca (${FISHING_ENERGY_COST}⚡)`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(sessionExists || semEnergia),
    new ButtonBuilder()
      .setCustomId('rpg:pesca_puxar')
      .setLabel('🪝 Puxar!')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isReady),
    new ButtonBuilder()
      .setCustomId('rpg:pescaria').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
  );
  return [row];
}

// ─── Lançar isca ──────────────────────────────────────────────────────────────

export async function castFishingLine(char: FullCharacter): Promise<{ success: boolean; message: string }> {
  if (char.currentEnergy < FISHING_ENERGY_COST) {
    return { success: false, message: `Energia insuficiente! Precisa de **${FISHING_ENERGY_COST}⚡**.` };
  }

  const existing = await prisma.rpgFishingSession.findUnique({ where: { discordId: char.discordId } });
  if (existing) {
    if (existing.reelableAt > new Date()) {
      const rem = Math.ceil((existing.reelableAt.getTime() - Date.now()) / 1000);
      return { success: false, message: `Já tem isca na água! Aguarde **${Math.ceil(rem/60)} min**.` };
    }
    // Sessão expirada sem coletar — limpar
    await prisma.rpgFishingSession.delete({ where: { discordId: char.discordId } });
  }

  // Cooldown de 10 min desde última pesca
  if (char.lastFishing) {
    const elapsed = Date.now() - char.lastFishing.getTime();
    if (elapsed < 10 * 60 * 1000) {
      const rem = Math.ceil((10 * 60 * 1000 - elapsed) / 60000);
      return { success: false, message: `Aguarde **${rem} min** antes de pescar novamente.` };
    }
  }

  const castAt = new Date();
  const reelableAt = new Date(Date.now() + FISHING_COOLDOWN_MS);

  await Promise.all([
    prisma.rpgFishingSession.create({ data: { discordId: char.discordId, castAt, reelableAt } }),
    prisma.rpgCharacter.update({ where: { discordId: char.discordId }, data: { currentEnergy: char.currentEnergy - FISHING_ENERGY_COST } }),
  ]);

  return { success: true, message: `🎣 Isca lançada! Volte em **2 minutos** para puxar!` };
}

// ─── Puxar a linha ────────────────────────────────────────────────────────────

export async function reelFishingLine(char: FullCharacter): Promise<{
  success: boolean; embed?: EmbedBuilder; message?: string;
}> {
  const session = await prisma.rpgFishingSession.findUnique({ where: { discordId: char.discordId } });
  if (!session) return { success: false, message: 'Não há isca na água!' };
  if (session.reelableAt > new Date()) {
    const rem = Math.ceil((session.reelableAt.getTime() - Date.now()) / 1000);
    return { success: false, message: `Aguente! Ainda faltam **${Math.ceil(rem/60)} min ${rem%60} seg**.` };
  }

  // Deletar sessão
  await prisma.rpgFishingSession.delete({ where: { discordId: char.discordId } });

  const phase = getDayPhase();
  const fishBonus = PHASE_INFO[phase].fishBonus;
  const fish = rollFish(fishBonus);

  // Aplicar recompensa
  let newHp = char.currentHp;
  let newEnergy = char.currentEnergy;
  const stats = computeStats(char);
  if (fish.hpRestore)     newHp     = Math.min(stats.maxHp,     newHp     + fish.hpRestore);
  if (fish.energyRestore) newEnergy = Math.min(stats.maxEnergy, newEnergy + fish.energyRestore);

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: {
      gold: char.gold + fish.goldValue,
      currentHp: newHp,
      currentEnergy: newEnergy,
      lastFishing: new Date(),
    },
  });

  await incrementMissionProgress(char.discordId, 'fish', 1).catch(() => null);

  const extras: string[] = [];
  if (fish.hpRestore && newHp > char.currentHp)         extras.push(`+${newHp - char.currentHp} ❤️ HP`);
  if (fish.energyRestore && newEnergy > char.currentEnergy) extras.push(`+${newEnergy - char.currentEnergy} ⚡ Energia`);

  const embed = new EmbedBuilder()
    .setColor(RARITY_COLOR[fish.rarity] ?? 0x1E90FF)
    .setTitle(`${fish.emoji} Você pescou: ${fish.name}!`)
    .setDescription(
      `**Raridade:** ${RARITY_LABEL[fish.rarity]}\n` +
      `**Valor:** +${fish.goldValue} 🪙\n` +
      (extras.length ? extras.join(' | ') : '') +
      `\n\n${fishBonus > 0 ? `✨ Bônus de ${PHASE_INFO[phase].emoji} ${PHASE_INFO[phase].name} aplicado!` : ''}`,
    )
    .addFields({ name: '💰 Ouro Total', value: `**${char.gold + fish.goldValue}🪙**`, inline: true })
    .setFooter({ text: '🎣 Lance novamente em 10 minutos!' });

  return { success: true, embed };
}
