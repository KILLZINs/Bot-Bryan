// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE MISSÕES DIÁRIAS POR CLASSE
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { prisma } from '../../database/client';
import { FullCharacter } from '../services/character';
import { CLASS_MISSIONS } from '../constants/class-missions';
import { ensureClassMissions } from '../services/class-missions';
import { getClass } from '../constants/classes';

function today() { return new Date().toISOString().slice(0, 10); }

export async function buildClassMissionsEmbed(char: FullCharacter): Promise<EmbedBuilder> {
  await ensureClassMissions(char.discordId, char.class);
  const cls = getClass(char.class);

  const missions = await prisma.rpgClassMission.findMany({
    where: { discordId: char.discordId, dateStr: today() },
  });

  const missionLines = missions.map((m: any) => {
    const tpl = CLASS_MISSIONS.find((t: any) => t.key === m.missionKey);
    if (!tpl) return '';
    const bar = `[${Math.min(m.progress, m.target)}/${m.target}]`;
    const status = m.claimed ? '✅' : m.completed ? '🎁' : '🔄';
    return `${status} ${tpl.emoji} **${tpl.title}** ${bar}\n> ${tpl.description}\n> 🏆 +${m.xpReward}XP | +${m.goldReward}🪙 | +${m.energyReward}⚡`;
  }).filter(Boolean);

  const completed = missions.filter((m: any) => m.completed && !m.claimed).length;
  const all = missions.filter((m: any) => m.claimed).length;

  return new EmbedBuilder()
    .setColor(cls?.color ?? 0x5865F2)
    .setTitle(`📜 Missões de Classe — ${cls?.emoji ?? ''} ${cls?.name ?? char.class}`)
    .setDescription(
      `Missões diárias exclusivas para **${cls?.name ?? char.class}**.\nResetam todos os dias à meia-noite UTC.\n\n` +
      (missionLines.length ? missionLines.join('\n\n') : '*Nenhuma missão disponível.*'),
    )
    .addFields(
      { name: '✅ Concluídas', value: `${all}/3`, inline: true },
      { name: '🎁 Para Coletar', value: `${completed}`, inline: true },
    )
    .setFooter({ text: '📜 Missões de classe · Progresso tracked automaticamente' });
}

export async function buildClassMissionsClaimSelect(discordId: string): Promise<ActionRowBuilder<StringSelectMenuBuilder> | null> {
  const missions = await prisma.rpgClassMission.findMany({
    where: { discordId, dateStr: today(), completed: true, claimed: false },
  });
  if (!missions.length) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:class_mission_claim')
      .setPlaceholder('🎁 Coletar recompensa de missão...')
      .addOptions(
        missions.map((m: any) => {
          const tpl = CLASS_MISSIONS.find((t: any) => t.key === m.missionKey);
          return new StringSelectMenuOptionBuilder()
            .setLabel(tpl?.title ?? m.missionKey)
            .setValue(m.id)
            .setDescription(`+${m.xpReward}XP | +${m.goldReward}🪙 | +${m.energyReward}⚡`)
            .setEmoji(tpl?.emoji ?? '🎁');
        }),
      ),
  );
}

export function buildClassMissionsButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:missoes_classe').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:missoes').setLabel('📋 Todas Missões').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
  );
}
