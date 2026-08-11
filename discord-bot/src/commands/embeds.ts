// ═══════════════════════════════════════════════════════════════════════
// COMANDO /embeds — painel de customização de embeds
// ═══════════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { isBotManager } from '../utils/allowlist';
import { errorEmbed, successEmbed } from '../utils/embeds';

export default {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('embeds')
    .setDescription('Customização dos embeds do bot (apenas managers da aliança)'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!await isBotManager(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Sem permissão', 'Apenas gerenciadores da aliança podem usar este comando.')],
        ephemeral: true,
      });
    }

    return interaction.reply({
      embeds: [successEmbed(
        '🎨 Customização de Embeds',
        'Para gerenciar embeds da aliança use `/alianca` → **Enviar Embed** ou **Atualizar Embed**.\n\n' +
        'Customizações avançadas de embed estarão disponíveis em breve.',
      )],
      ephemeral: true,
    });
  },
} satisfies Command;
