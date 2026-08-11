import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, TextChannel } from 'discord.js';
import { Command } from '../../types';
import { getConfig } from '../../utils/helpers';
import { COLORS, baseEmbed } from '../../utils/embeds';

export default {
  category: 'feedback',
  data: new SlashCommandBuilder().setName('feedback').setDescription('Envia um feedback para a equipe da aliança'),
  async execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder().setCustomId('modal:feedbacksubmit').setTitle('💬 Enviar Feedback');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('assunto').setLabel('Assunto').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('mensagem').setLabel('Sua mensagem').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Descreva seu feedback com detalhes...')
      ),
    );
    await interaction.showModal(modal);
  },
} satisfies Command;
