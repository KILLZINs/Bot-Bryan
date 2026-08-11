// ═══════════════════════════════════════════════════════════════════════
// COMANDO /embeds — painel de customização total de embeds
// ═══════════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { isBotManager } from '../utils/allowlist';
import { errorEmbed } from '../utils/embeds';
import { buildEmbedsHome } from '../handlers/embedsHandler';

export default {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('embeds')
    .setDescription('Customização total dos embeds do bot (cor, título, imagens, rodapé, descrição)'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!await isBotManager(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Sem permissão', 'Apenas gerenciadores do bot podem usar este comando.')],
        ephemeral: true,
      });
    }

    const { embed, rows } = buildEmbedsHome();
    return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  },
} satisfies Command;
