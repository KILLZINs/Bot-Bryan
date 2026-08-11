// ═══════════════════════════════════════════════════════════════════════
// COMANDO /rpgwipe — Wipe total de todos os dados de RPG
// ═══════════════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../types';
import { isOwner } from '../utils/permissions';
import { prisma } from '../database/client';
import { errorEmbed } from '../utils/embeds';

export default {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('rpgwipe')
    .setDescription('[OWNER] Apaga TODOS os dados de RPG de todos os jogadores. Irreversível.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        embeds: [errorEmbed('Sem Permissão', 'Apenas o dono do bot pode usar este comando.')],
        ephemeral: true,
      });
      return;
    }

    const [charCount, guildCount] = await Promise.all([
      prisma.rpgCharacter.count(),
      prisma.rpgGuild.count(),
    ]);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('☢️ RPG WIPE — Confirmação Necessária')
      .setDescription(
        `Você está prestes a **apagar permanentemente** todos os dados de RPG do servidor.\n\n` +
        `> 🧑 **${charCount}** personagem(ns) serão deletados\n` +
        `> 🏛️ **${guildCount}** guilda(s) serão deletadas\n` +
        `> Inventários, equipamentos, habilidades, logs de combate e filas de craft também serão removidos.\n\n` +
        `⚠️ **Esta ação é irreversível.** Tem certeza absoluta?`
      )
      .setFooter({ text: '⏱️ Expira em 30 segundos — reaja rápido' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('rpgwipe:confirm')
        .setLabel('☢️ SIM, WIPAR TUDO')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('rpgwipe:cancel')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    // Desabilitar botões após 30s automaticamente
    setTimeout(async () => {
      const disabled = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('rpgwipe:confirm').setLabel('☢️ SIM, WIPAR TUDO').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('rpgwipe:cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      await interaction.editReply({ components: [disabled] }).catch(() => null);
    }, 30_000);
  },
} satisfies Command;
