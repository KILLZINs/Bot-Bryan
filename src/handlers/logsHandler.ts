// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE LOGS — configuração via /logs
// ═══════════════════════════════════════════════════════════════════════

import {
  ButtonInteraction, ModalSubmitInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  Guild,
} from 'discord.js';
import { prisma } from '../database/client';
import { getConfig } from '../utils/helpers';
import { COLORS, errorEmbed, successEmbed } from '../utils/embeds';
import { LOG, LOG_ALL, LOG_LABELS, invalidateLogCache } from '../utils/logger';

// ── Helpers ───────────────────────────────────────────────────────────
function getFlags(cfg: any): number {
  return cfg?.logFlags ?? LOG_ALL;
}

function flagStatus(flags: number, bit: number): string {
  return (flags & bit) !== 0 ? '✅' : '❌';
}

// ── Build embed do painel ─────────────────────────────────────────────
export async function buildLogsPanel(guild: Guild): Promise<{
  embed: EmbedBuilder;
  rows: ActionRowBuilder<ButtonBuilder>[];
}> {
  const cfg   = await getConfig(guild.id);
  const flags = getFlags(cfg);
  const chan   = cfg.logChannelId ? `<#${cfg.logChannelId}>` : '❌ **Não configurado**';

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('📋 Painel de Logs')
    .setDescription(
      `Configure o canal e as categorias de log do servidor.\n\n` +
      `📢 **Canal de logs:** ${chan}`
    )
    .addFields(
      Object.entries(LOG_LABELS).map(([bit, { emoji, name }]) => ({
        name: `${flagStatus(flags, Number(bit))} ${emoji} ${name}`,
        value: `Bit \`${Number(bit)}\``,
        inline: true,
      }))
    )
    .setFooter({ text: '⚔️ Use os botões abaixo para configurar' });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('logs:set_channel')
        .setLabel('📌 Definir Canal')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('logs:clear_channel')
        .setLabel('🗑️ Remover Canal')
        .setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`logs:toggle:${LOG.MESSAGES}`)
        .setLabel(`${flagStatus(flags, LOG.MESSAGES)} 📩 Mensagens`)
        .setStyle((flags & LOG.MESSAGES) ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`logs:toggle:${LOG.MEMBERS}`)
        .setLabel(`${flagStatus(flags, LOG.MEMBERS)} 👥 Membros`)
        .setStyle((flags & LOG.MEMBERS) ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`logs:toggle:${LOG.MODERATION}`)
        .setLabel(`${flagStatus(flags, LOG.MODERATION)} 🔨 Moderação`)
        .setStyle((flags & LOG.MODERATION) ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`logs:toggle:${LOG.CHANNELS}`)
        .setLabel(`${flagStatus(flags, LOG.CHANNELS)} 📢 Canais`)
        .setStyle((flags & LOG.CHANNELS) ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`logs:toggle:${LOG.VOICE}`)
        .setLabel(`${flagStatus(flags, LOG.VOICE)} 🔊 Voz`)
        .setStyle((flags & LOG.VOICE) ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('logs:toggle_all')
        .setLabel(flags === LOG_ALL ? '⬛ Desativar Tudo' : '✅ Ativar Tudo')
        .setStyle(flags === LOG_ALL ? ButtonStyle.Danger : ButtonStyle.Success),
    ),
  ];

  return { embed, rows };
}

// ═══════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════════════

export async function handleLogsButton(i: ButtonInteraction, action: string): Promise<void> {
  // Verificar permissão (ManageGuild)
  if (!i.memberPermissions?.has('ManageGuild')) {
    await i.reply({ embeds: [errorEmbed('Sem Permissão', 'Você precisa da permissão **Gerenciar Servidor**.')], ephemeral: true });
    return;
  }

  const guild = i.guild!;

  try {
    // ── Definir canal via modal ────────────────────────────────────────
    if (action === 'set_channel') {
      const modal = new ModalBuilder()
        .setCustomId('logs_modal:set_channel')
        .setTitle('📌 Definir Canal de Logs')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('channel_id')
              .setLabel('ID do Canal ou #menção')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Ex: 123456789012345678 ou #logs')
              .setRequired(true)
              .setMaxLength(32)
          )
        );
      await i.showModal(modal);
      return;
    }

    await i.deferUpdate();

    // ── Remover canal ─────────────────────────────────────────────────
    if (action === 'clear_channel') {
      await prisma.guildConfig.upsert({
        where:  { guildId: guild.id },
        update: { logChannelId: null },
        create: { guildId: guild.id, logChannelId: null },
      });
      invalidateLogCache(guild.id);
      const { embed, rows } = await buildLogsPanel(guild);
      await i.editReply({ embeds: [embed], components: rows });
      return;
    }

    // ── Toggle de categoria ───────────────────────────────────────────
    if (action.startsWith('toggle:')) {
      const bit = parseInt(action.split(':')[1], 10);
      const cfg = await getConfig(guild.id);
      const flags = getFlags(cfg);
      const newFlags = (flags & bit) ? (flags & ~bit) : (flags | bit);

      await prisma.guildConfig.upsert({
        where:  { guildId: guild.id },
        update: { logFlags: newFlags } as any,
        create: { guildId: guild.id, logFlags: newFlags } as any,
      });
      invalidateLogCache(guild.id);
      const { embed, rows } = await buildLogsPanel(guild);
      await i.editReply({ embeds: [embed], components: rows });
      return;
    }

    // ── Toggle tudo ───────────────────────────────────────────────────
    if (action === 'toggle_all') {
      const cfg = await getConfig(guild.id);
      const flags = getFlags(cfg);
      const newFlags = flags === LOG_ALL ? 0 : LOG_ALL;

      await prisma.guildConfig.upsert({
        where:  { guildId: guild.id },
        update: { logFlags: newFlags } as any,
        create: { guildId: guild.id, logFlags: newFlags } as any,
      });
      invalidateLogCache(guild.id);
      const { embed, rows } = await buildLogsPanel(guild);
      await i.editReply({ embeds: [embed], components: rows });
      return;
    }

    await i.editReply({ embeds: [errorEmbed('Ação desconhecida', `\`${action}\``)] });
  } catch (err) {
    console.error('[Logs Panel Error]', err);
    const e = errorEmbed('Erro', 'Ocorreu um erro ao processar.');
    if (i.replied || i.deferred) await i.editReply({ embeds: [e] }).catch(() => null);
    else await i.reply({ embeds: [e], ephemeral: true }).catch(() => null);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MODAL HANDLER
// ═══════════════════════════════════════════════════════════════════════

export async function handleLogsModal(i: ModalSubmitInteraction, action: string): Promise<void> {
  if (!i.memberPermissions?.has('ManageGuild')) {
    await i.reply({ embeds: [errorEmbed('Sem Permissão', 'Você precisa da permissão **Gerenciar Servidor**.')], ephemeral: true });
    return;
  }

  const guild = i.guild!;

  if (action === 'set_channel') {
    await i.deferUpdate();
    const raw = i.fields.getTextInputValue('channel_id').trim().replace(/[<#>]/g, '');

    if (!/^\d{17,20}$/.test(raw)) {
      await i.editReply({ embeds: [errorEmbed('ID Inválido', 'Informe o ID numérico do canal (17-20 dígitos) ou mencione com #.')] });
      return;
    }

    const channel = guild.channels.cache.get(raw);
    if (!channel) {
      await i.editReply({ embeds: [errorEmbed('Canal não encontrado', `ID \`${raw}\` não encontrado neste servidor.`)] });
      return;
    }
    if (!channel.isTextBased()) {
      await i.editReply({ embeds: [errorEmbed('Canal inválido', 'Informe um canal de **texto**.')] });
      return;
    }

    await prisma.guildConfig.upsert({
      where:  { guildId: guild.id },
      update: { logChannelId: raw },
      create: { guildId: guild.id, logChannelId: raw },
    });
    invalidateLogCache(guild.id);

    const { embed, rows } = await buildLogsPanel(guild);
    await i.editReply({
      embeds: [successEmbed('✅ Canal de Logs Definido', `Os logs serão enviados para <#${raw}>.`), embed],
      components: rows,
    });
    return;
  }

  await i.reply({ embeds: [errorEmbed('Ação desconhecida', action)], ephemeral: true });
}
