import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { Command } from '../types';
import { isBotManager } from '../utils/allowlist';
import { getBotConfig, intToHex, BotConfigData } from '../utils/botConfig';
import { errorEmbed } from '../utils/embeds';

export default {
  category: 'sistema',
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurar a aparência dos embeds do bot (donos e managers)'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isBotManager(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Acesso Negado', 'Apenas donos e managers do bot podem usar este comando.')],
        ephemeral: true,
      });
    }

    const cfg  = getBotConfig();
    const embed = buildConfigEmbed(cfg, interaction.user.tag);
    const rows  = buildConfigRows();
    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  },
} satisfies Command;

// ─── Helpers exportados para o handler ───────────────────────────────────────

export function buildConfigEmbed(cfg: BotConfigData, editor?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(cfg.primaryColor)
    .setTitle('⚙️ Configuração de Embeds')
    .setDescription(
      'Personalize a aparência dos embeds do bot em todos os servidores.\n' +
      'As mudanças valem imediatamente para novos embeds gerados.',
    )
    .addFields(
      { name: '📝 Rodapé Padrão',  value: `\`${cfg.footerText}\``,            inline: false },
      { name: '🎨 Cor Principal',  value: `\`${intToHex(cfg.primaryColor)}\``, inline: true  },
      { name: '🖼️ Ícone do Bot',   value: cfg.botIconUrl ? `[Ver link](${cfg.botIconUrl})` : '_Não definido_', inline: true },
      { name: '📜 Rodapé do /rp',  value: `\`${cfg.rpFooterText}\``,           inline: false },
    )
    .setThumbnail(cfg.botIconUrl ?? null)
    .setFooter({ text: editor ? `Última edição por ${editor}` : cfg.footerText })
    .setTimestamp();
}

export function buildConfigRows(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embedcfg:footer')  .setLabel('Rodapé Padrão').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embedcfg:color')   .setLabel('Cor Principal') .setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embedcfg:icon')    .setLabel('Ícone do Bot')  .setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embedcfg:rpfooter').setLabel('Rodapé /rp')    .setEmoji('📜').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embedcfg:reset')  .setLabel('Restaurar Padrões').setEmoji('↩️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('embedcfg:refresh').setLabel('Atualizar')         .setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
  return [row1, row2];
}
