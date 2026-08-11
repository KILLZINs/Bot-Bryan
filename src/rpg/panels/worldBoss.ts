// ═══════════════════════════════════════════════════════════════════════
// PAINEL DO BOSS MUNDIAL
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits, GuildMember,
} from 'discord.js';
import { getActiveBoss, bossHpBar, WORLD_BOSS_TEMPLATES } from '../services/worldBoss';
import { applyTemplate } from '../../utils/embedTemplates';

// ─── Embed do boss ─────────────────────────────────────────────────────

export async function buildWorldBossEmbed(guildId: string): Promise<EmbedBuilder> {
  const boss = await getActiveBoss(guildId);

  if (!boss) {
    return new EmbedBuilder()
      .setColor(0x2C3E50)
      .setTitle('🌍 Boss Mundial')
      .setDescription(
        '**Nenhum Boss Mundial ativo no momento.**\n\n' +
        'O Boss Mundial é um inimigo épico que toda a guilda enfrenta juntos! ' +
        'O dano é compartilhado e as recompensas são distribuídas baseadas na contribuição.\n\n' +
        '*Aguarde um administrador invocar o próximo Boss Mundial.*',
      )
      .setFooter({ text: '⚔️ Aliança Skyline RPG — Boss Mundial' });
  }

  const hpPct = Math.max(0, (boss.currentHp / boss.maxHp) * 100).toFixed(1);
  const color = boss.currentHp > boss.maxHp * 0.6 ? 0xE74C3C :
                boss.currentHp > boss.maxHp * 0.3 ? 0xF39C12 : 0x8E44AD;

  const topLines = boss.participants.slice(0, 5).map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const contrib = boss.maxHp > 0 ? ((p.damageDealt / boss.maxHp) * 100).toFixed(1) : '0.0';
    return `${medal} **${p.username}** — ${p.damageDealt.toLocaleString('pt-BR')} dmg (${contrib}%)`;
  }).join('\n') || '*Nenhum herói ainda. Seja o primeiro a atacar!*';

  const expiresIn = boss.expiresAt.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(expiresIn / 3600000));
  const minutesLeft = Math.max(0, Math.floor((expiresIn % 3600000) / 60000));

  const bossEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${boss.emoji} Boss Mundial — ${boss.name} [Nv.${boss.level}]`)
    .setDescription(
      `*${boss.description ?? ''}*\n\n` +
      `❤️ **HP:** ${bossHpBar(boss.currentHp, boss.maxHp)}\n` +
      `📊 **${boss.currentHp.toLocaleString('pt-BR')} / ${boss.maxHp.toLocaleString('pt-BR')}** (${hpPct}%)\n\n` +
      `⚔️ **Habilidades:** ${(boss as any).description ? '' : ''}\n` +
      `⏱️ **Expira em:** ${hoursLeft}h ${minutesLeft}m\n` +
      `👥 **Participantes:** ${boss.participants.length}`,
    )
    .addFields(
      { name: '🏆 Top Heróis', value: topLines, inline: false },
      { name: '⭐ Recompensas (Top Contribuidor)', value: `${boss.xpReward.toLocaleString('pt-BR')} XP | ${boss.goldReward.toLocaleString('pt-BR')} 💰`, inline: true },
      { name: '⏰ Cooldown de Ataque', value: '5 minutos por herói', inline: true },
    )
    .setFooter({ text: '⚔️ Ataque e contribua para a derrota do boss! Recompensas proporcionais ao dano.' });
  applyTemplate(bossEmbed, 'worldboss.spawn');
  return bossEmbed;
}

// ─── Botões do boss ────────────────────────────────────────────────────

export async function buildWorldBossButtons(guildId: string, isAdmin: boolean): Promise<ActionRowBuilder<ButtonBuilder>[]> {
  const boss = await getActiveBoss(guildId);
  const hasActiveBoss = !!boss && boss.currentHp > 0;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rpg:worldboss_atacar')
      .setLabel('⚔️ Atacar Boss!')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasActiveBoss),
    new ButtonBuilder()
      .setCustomId('rpg:worldboss')
      .setLabel('🔄 Atualizar')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('rpg:cidade')
      .setLabel('◀ Voltar')
      .setStyle(ButtonStyle.Secondary),
  );

  if (isAdmin) {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId('rpg:worldboss_spawn')
        .setLabel('⚡ Invocar Boss')
        .setStyle(ButtonStyle.Success)
        .setDisabled(hasActiveBoss),
    );
  }

  return [row1];
}

// ─── Modal de spawn ────────────────────────────────────────────────────

export function buildWorldBossSpawnSelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:worldboss_template')
      .setPlaceholder('Escolha o Boss Mundial...')
      .addOptions(
        WORLD_BOSS_TEMPLATES.map((t, i) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(t.name)
            .setValue(`${i}`)
            .setEmoji(t.emoji)
            .setDescription(`${t.abilities[0]} | HP base: ${(t.baseHp / 1000).toFixed(0)}k`),
        ),
      ),
  );
}

export function buildWorldBossLevelSelect(templateIndex: number): ActionRowBuilder<StringSelectMenuBuilder> {
  const levels = [1, 2, 3, 5, 7, 10];
  const hpMultipliers: Record<number, string> = { 1: '×1.0', 2: '×1.5', 3: '×2.0', 5: '×3.0', 7: '×4.0', 10: '×5.5' };

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`rpg_select:worldboss_level:${templateIndex}`)
      .setPlaceholder('Escolha a dificuldade...')
      .addOptions(
        levels.map(l =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`Nível ${l}`)
            .setValue(`${l}`)
            .setDescription(`HP ${hpMultipliers[l]} do base | ${l <= 2 ? '🟢 Fácil' : l <= 5 ? '🟡 Médio' : l <= 7 ? '🟠 Difícil' : '🔴 Lendário'}`),
        ),
      ),
  );
}
