// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE TREINAMENTO
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client';
import { FullCharacter, computeStats } from '../services/character';
import { addTempBuff, getActiveBuffs, formatBuffList } from '../services/temp-buffs';
import { incrementMissionProgress } from '../services/class-missions';

const TRAIN_COOLDOWN_MS = 20 * 60 * 1000; // 20 min entre treinos

interface TrainOption {
  id: string;
  stat: string;
  label: string;
  emoji: string;
  buffType: string;
  buffValue: number;
  durationMs: number;
  energyCost: number;
  description: string;
}

const TRAIN_OPTIONS: TrainOption[] = [
  { id: 'str', stat: 'FOR', label: 'Força',        emoji: '💪', buffType: 'atk_pct', buffValue: 0.12, durationMs: 45*60*1000, energyCost: 15, description: '+12% Ataque por 45min' },
  { id: 'agi', stat: 'AGI', label: 'Agilidade',    emoji: '🏃', buffType: 'agi_pct', buffValue: 0.12, durationMs: 45*60*1000, energyCost: 15, description: '+12% AGI → Esquiva/Crítico por 45min' },
  { id: 'int', stat: 'INT', label: 'Inteligência', emoji: '🧠', buffType: 'int_pct', buffValue: 0.12, durationMs: 45*60*1000, energyCost: 15, description: '+12% INT → Dano mágico por 45min' },
  { id: 'vit', stat: 'VIT', label: 'Vitalidade',   emoji: '❤️', buffType: 'def_pct', buffValue: 0.12, durationMs: 45*60*1000, energyCost: 15, description: '+12% Defesa por 45min' },
  { id: 'lck', stat: 'SOR', label: 'Sorte',        emoji: '🍀', buffType: 'gold_pct',buffValue: 0.20, durationMs: 60*60*1000, energyCost: 15, description: '+20% Ouro em batalha por 1h' },
  { id: 'all', stat: 'ALL', label: 'Treino Geral', emoji: '⚡', buffType: 'xp_pct',  buffValue: 0.15, durationMs: 60*60*1000, energyCost: 20, description: '+15% XP em batalha por 1h' },
];

export async function buildTreinarEmbed(char: FullCharacter): Promise<EmbedBuilder> {
  const stats = computeStats(char);
  const buffs = await getActiveBuffs(char.discordId);
  const buffText = formatBuffList(buffs);

  const lastTrain = char.lastTrain;
  const onCooldown = lastTrain && (Date.now() - lastTrain.getTime()) < TRAIN_COOLDOWN_MS;
  const cooldownRem = onCooldown
    ? Math.ceil((TRAIN_COOLDOWN_MS - (Date.now() - lastTrain!.getTime())) / 60000)
    : 0;

  return new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('🥊 Centro de Treinamento')
    .setDescription(
      onCooldown
        ? `⏳ Descansando... próximo treino em **${cooldownRem} min**\n\nSeus músculos precisam se recuperar!`
        : `Escolha um atributo para treinar e ganhe um buff temporário poderoso.\n**Custo:** 15–20 ⚡ Energia por treino.`,
    )
    .addFields(
      { name: '⚡ Energia Atual', value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true },
      { name: '⏱️ Cooldown', value: onCooldown ? `🔴 ${cooldownRem} min` : '🟢 Pronto!', inline: true },
      { name: '✨ Buffs Ativos', value: buffText, inline: false },
      {
        name: '📋 Treinos Disponíveis',
        value: TRAIN_OPTIONS.map(o => `${o.emoji} **${o.label}** — ${o.description} (${o.energyCost}⚡)`).join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: '🥊 Treinos têm cooldown de 20 minutos entre sessões' });
}

export function buildTreinarSelect(disabled: boolean): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:treinar_stat')
      .setPlaceholder('Escolha o atributo para treinar...')
      .setDisabled(disabled)
      .addOptions(
        TRAIN_OPTIONS.map(o =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${o.emoji} ${o.label}`)
            .setValue(o.id)
            .setDescription(o.description),
        ),
      ),
  );
}

export function buildTreinarButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:treinar').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
  );
}

export async function doTrain(char: FullCharacter, statId: string): Promise<{ success: boolean; message: string }> {
  const option = TRAIN_OPTIONS.find(o => o.id === statId);
  if (!option) return { success: false, message: 'Treino inválido.' };

  const lastTrain = char.lastTrain;
  if (lastTrain && (Date.now() - lastTrain.getTime()) < TRAIN_COOLDOWN_MS) {
    const rem = Math.ceil((TRAIN_COOLDOWN_MS - (Date.now() - lastTrain.getTime())) / 60000);
    return { success: false, message: `Aguarde **${rem} min** antes do próximo treino.` };
  }

  const stats = computeStats(char);
  if (char.currentEnergy < option.energyCost) {
    return { success: false, message: `Energia insuficiente! Precisa de **${option.energyCost}⚡**, você tem **${char.currentEnergy}⚡**.` };
  }

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: {
      currentEnergy: char.currentEnergy - option.energyCost,
      lastTrain: new Date(),
    },
  });

  await addTempBuff(char.discordId, option.buffType as any, option.buffValue, option.durationMs, 'treinar', option.label);

  await incrementMissionProgress(char.discordId, 'train', 1).catch(() => null);

  const dur = option.durationMs / 60000;
  return {
    success: true,
    message: `💪 Treino de **${option.label}** concluído!\n${option.emoji} **${option.description}** ativado por ${dur} min!\n−${option.energyCost}⚡ Energia`,
  };
}
