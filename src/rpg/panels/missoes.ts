// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE MISSÕES — diárias e semanais
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { prisma } from '../../database/client';
import { todayStr, thisWeekStr, DAILY_MISSION_POOL, WEEKLY_MISSION_POOL } from '../../commands/utility/missoes';

// ─── Embed de missões ──────────────────────────────────────────────────

export async function buildMissoesEmbed(discordId: string, guildId: string): Promise<EmbedBuilder> {
  const today = todayStr();
  const week  = thisWeekStr();

  const [dailyMissions, weeklyMissions] = await Promise.all([
    prisma.dailyMission.findMany({ where: { memberId: discordId, guildId, dateStr: today }, orderBy: { completed: 'asc' } }),
    prisma.weeklyMission.findMany({ where: { memberId: discordId, guildId, weekStr: week }, orderBy: { completed: 'asc' } }),
  ]);

  // ─── Formatar missões diárias ─────────────────────────────────────
  const dailyLines = dailyMissions.map(m => {
    const pool = DAILY_MISSION_POOL.find(p => p.type === m.type);
    const label = pool?.label ?? m.type;
    const pct   = Math.min(100, Math.floor((m.progress / m.target) * 100));
    const bar   = progressBar(m.progress, m.target);
    const status = m.claimed ? '✅' : m.completed ? '🎁' : '🔘';
    return `${status} **${label}**\n${bar} ${pct}% (${m.progress}/${m.target}) | +${m.xpReward} XP +${m.coinReward} 🪙`;
  }).join('\n\n') || '*Carregando missões...*';

  // ─── Formatar missões semanais ────────────────────────────────────
  const weeklyLines = weeklyMissions.map(m => {
    const pool = WEEKLY_MISSION_POOL.find(p => p.type === m.type);
    const label = pool?.label ?? m.type;
    const pct   = Math.min(100, Math.floor((m.progress / m.target) * 100));
    const bar   = progressBar(m.progress, m.target, 10);
    const status = m.claimed ? '✅' : m.completed ? '🎁' : '🔘';
    return `${status} **${label}**\n${bar} ${pct}% (${m.progress}/${m.target}) | +${m.xpReward} XP +${m.coinReward} 🪙`;
  }).join('\n\n') || '*Carregando missões semanais...*';

  const dailyDone  = dailyMissions.filter(m => m.completed && !m.claimed).length;
  const weeklyDone = weeklyMissions.filter(m => m.completed && !m.claimed).length;

  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📋 Missões')
    .setDescription(`Cumpra missões para ganhar XP e Moedas!\n🎁 = pronto para coletar | ✅ = já coletado | 🔘 = em progresso`)
    .addFields(
      { name: `📅 Missões Diárias${dailyDone > 0 ? ` (${dailyDone} prontas!)` : ''}`, value: dailyLines, inline: false },
      { name: `📆 Missões Semanais${weeklyDone > 0 ? ` (${weeklyDone} prontas!)` : ''}`, value: weeklyLines, inline: false },
    )
    .setFooter({ text: `⚔️ Aliança Skyline RPG — Semana: ${week}` });
}

// ─── Select para coletar recompensas ──────────────────────────────────

export async function buildMissoesClaimSelect(discordId: string, guildId: string): Promise<ActionRowBuilder<StringSelectMenuBuilder> | null> {
  const today = todayStr();
  const week  = thisWeekStr();

  const [dailyReady, weeklyReady] = await Promise.all([
    prisma.dailyMission.findMany({ where: { memberId: discordId, guildId, dateStr: today, completed: true, claimed: false } }),
    prisma.weeklyMission.findMany({ where: { memberId: discordId, guildId, weekStr: week, completed: true, claimed: false } }),
  ]);

  const options = [
    ...dailyReady.map(m => {
      const pool = DAILY_MISSION_POOL.find(p => p.type === m.type);
      return new StringSelectMenuOptionBuilder()
        .setLabel(`📅 ${pool?.label ?? m.type}`)
        .setValue(`daily:${m.id}`)
        .setDescription(`+${m.xpReward} XP, +${m.coinReward} moedas`)
        .setEmoji('🎁');
    }),
    ...weeklyReady.map(m => {
      const pool = WEEKLY_MISSION_POOL.find(p => p.type === m.type);
      return new StringSelectMenuOptionBuilder()
        .setLabel(`📆 ${pool?.label ?? m.type}`)
        .setValue(`weekly:${m.id}`)
        .setDescription(`+${m.xpReward} XP, +${m.coinReward} moedas`)
        .setEmoji('🎁');
    }),
  ];

  if (options.length === 0) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:missao_coletar')
      .setPlaceholder('🎁 Coletar recompensa...')
      .addOptions(options.slice(0, 25)),
  );
}

// ─── Botões de missões ─────────────────────────────────────────────────

export function buildMissoesButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:missoes').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('⚔️ Dungeon').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏰 Cidade').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
  );
}

// ─── Helper: barra de progresso ───────────────────────────────────────

function progressBar(current: number, max: number, size = 8): string {
  const pct = Math.min(1, current / max);
  const filled = Math.round(pct * size);
  return '`' + '█'.repeat(filled) + '░'.repeat(size - filled) + '`';
}
