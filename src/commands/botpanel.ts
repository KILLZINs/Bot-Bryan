import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../types';
import { COLORS, errorEmbed } from '../utils/embeds';
import { getBotConfig } from '../utils/botConfig';
import { isBotOwner } from '../utils/allowlist';

export function buildBotPanelEmbed() {
  const cfg = getBotConfig();
  return new EmbedBuilder()
    .setColor(COLORS.DARK)
    .setTitle('🛠️ Painel de Features do Bot')
    .setDescription('Ative ou desative funcionalidades globais do bot.\nSomente donos do bot podem usar este painel.')
    .addFields(
      {
        name: '💤 Sistema AFK',
        value: cfg.featAfk
          ? '✅ **Ativado** — `/afk` disponível, menções detectadas'
          : '❌ **Desativado** — comando e detecção desligados',
        inline: false,
      },
      {
        name: '📩 DM de Boas-vindas',
        value: cfg.featWelcomeDm
          ? '✅ **Ativado** — novos membros recebem DM da aliança'
          : '❌ **Desativado** — DM não é enviada',
        inline: false,
      },
    )
    .setFooter({ text: '⚔️ Aliança Skyline — Bot Owner Panel' })
    .setTimestamp();
}

export function buildBotPanelRow() {
  const cfg = getBotConfig();
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('botpanel:toggle_afk')
      .setLabel(cfg.featAfk ? 'Desativar AFK' : 'Ativar AFK')
      .setEmoji(cfg.featAfk ? '❌' : '✅')
      .setStyle(cfg.featAfk ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('botpanel:toggle_welcomedm')
      .setLabel(cfg.featWelcomeDm ? 'Desativar DM Boas-vindas' : 'Ativar DM Boas-vindas')
      .setEmoji(cfg.featWelcomeDm ? '❌' : '✅')
      .setStyle(cfg.featWelcomeDm ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('botpanel:refresh')
      .setLabel('Atualizar')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
  );
}

export default {
  category: 'sistema',
  data: new SlashCommandBuilder()
    .setName('botpanel')
    .setDescription('Painel de controle de features globais do bot (somente donos)')
    .setDMPermission(true),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isBotOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Acesso Negado', 'Apenas donos do bot podem usar este painel.')],
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [buildBotPanelEmbed()],
      components: [buildBotPanelRow()],
      ephemeral: true,
    });
  },
} satisfies Command;
