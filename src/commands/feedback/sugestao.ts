import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { Command } from '../../types';

export default {
  category: 'feedback',
  data: new SlashCommandBuilder().setName('sugestao').setDescription('Envie uma sugestão para melhorar o servidor'),
  async execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder().setCustomId('modal:sugestaosubmit').setTitle('💡 Nova Sugestão');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('titulo').setLabel('Título da Sugestão').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('descricao').setLabel('Descreva sua sugestão').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Explique sua ideia com detalhes...')
      ),
    );
    await interaction.showModal(modal);
  },
} satisfies Command;
