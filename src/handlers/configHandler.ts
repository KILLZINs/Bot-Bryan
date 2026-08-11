import {
  ButtonInteraction, ModalSubmitInteraction,
  ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { getBotConfig, updateBotConfig, hexToInt, intToHex, CONFIG_DEFAULTS } from '../utils/botConfig';
import { isBotManager } from '../utils/allowlist';
import { errorEmbed } from '../utils/embeds';
import { buildConfigEmbed, buildConfigRows } from '../commands/config';

function guard(i: ButtonInteraction | ModalSubmitInteraction): boolean {
  return isBotManager(i.user.id);
}

// ─── Botões ───────────────────────────────────────────────────────────────────

export async function handleEmbedCfgButton(i: ButtonInteraction, action: string): Promise<void> {
  if (!guard(i)) {
    return void i.reply({ embeds: [errorEmbed('Acesso Negado', 'Sem permissão.')], ephemeral: true });
  }

  // ── Atualizar painel ──
  if (action === 'refresh') {
    const cfg = getBotConfig();
    await i.update({ embeds: [buildConfigEmbed(cfg, i.user.tag)], components: buildConfigRows() });
    return;
  }

  // ── Restaurar padrões ──
  if (action === 'reset') {
    await i.deferUpdate();
    await updateBotConfig({ ...CONFIG_DEFAULTS });
    const cfg = getBotConfig();
    await i.editReply({ embeds: [buildConfigEmbed(cfg, i.user.tag)], components: buildConfigRows() });
    return;
  }

  // ── Abrir modal conforme ação ──
  const titles: Record<string, string> = {
    footer:   '📝 Rodapé Padrão dos Embeds',
    color:    '🎨 Cor Principal dos Embeds',
    icon:     '🖼️ Ícone / Thumbnail do Bot',
    rpfooter: '📜 Rodapé dos Embeds de /rp',
  };
  const modal = new ModalBuilder()
    .setTitle(titles[action] ?? 'Configurar')
    .setCustomId(`embedcfg_modal:${action}`);

  const cfg = getBotConfig();
  let input: TextInputBuilder;

  if (action === 'footer') {
    input = new TextInputBuilder()
      .setCustomId('value').setLabel('Texto do rodapé (ex: ⚔️ Meu Bot)')
      .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      .setValue(cfg.footerText);

  } else if (action === 'color') {
    input = new TextInputBuilder()
      .setCustomId('value').setLabel('Cor em hexadecimal (ex: #9b59b6 ou 9b59b6)')
      .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7)
      .setValue(intToHex(cfg.primaryColor));

  } else if (action === 'icon') {
    input = new TextInputBuilder()
      .setCustomId('value').setLabel('URL da imagem (deixe vazio para remover)')
      .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500)
      .setValue(cfg.botIconUrl ?? '');

  } else {
    // rpfooter
    input = new TextInputBuilder()
      .setCustomId('value').setLabel('Texto do rodapé específico do /rp')
      .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      .setValue(cfg.rpFooterText);
  }

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await i.showModal(modal);
}

// ─── Modais ───────────────────────────────────────────────────────────────────

export async function handleEmbedCfgModal(i: ModalSubmitInteraction, action: string): Promise<void> {
  if (!guard(i)) {
    return void i.reply({ embeds: [errorEmbed('Acesso Negado', 'Sem permissão.')], ephemeral: true });
  }
  await i.deferUpdate();

  const raw = i.fields.getTextInputValue('value').trim();

  if (action === 'footer') {
    if (!raw) return void i.followUp({ embeds: [errorEmbed('Inválido', 'O texto não pode ser vazio.')], ephemeral: true });
    await updateBotConfig({ footerText: raw });

  } else if (action === 'color') {
    const n = hexToInt(raw);
    if (n === null) {
      return void i.followUp({
        embeds: [errorEmbed('Cor Inválida', 'Use formato hexadecimal válido, como `#9b59b6` ou `9b59b6`.')],
        ephemeral: true,
      });
    }
    await updateBotConfig({ primaryColor: n });

  } else if (action === 'icon') {
    const url = raw || null;
    if (url && !/^https?:\/\/.+\..+/.test(url)) {
      return void i.followUp({
        embeds: [errorEmbed('URL Inválida', 'A URL precisa começar com `https://` e apontar para uma imagem.')],
        ephemeral: true,
      });
    }
    await updateBotConfig({ botIconUrl: url });

  } else if (action === 'rpfooter') {
    if (!raw) return void i.followUp({ embeds: [errorEmbed('Inválido', 'O texto não pode ser vazio.')], ephemeral: true });
    await updateBotConfig({ rpFooterText: raw });
  }

  const cfg = getBotConfig();
  await i.editReply({ embeds: [buildConfigEmbed(cfg, i.user.tag)], components: buildConfigRows() });
}
