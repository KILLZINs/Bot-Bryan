import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { Command } from '../../types';
import { checkAdmin } from '../../utils/permissions';

export default {
  category: 'utility',
  data: new SlashCommandBuilder().setName('anuncio').setDescription('Envia um anúncio no canal configurado (admin)'),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkAdmin(interaction))) return;
    const modal = new ModalBuilder().setCustomId('modal:anuncio').setTitle('📢 Novo Anúncio');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('titulo').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('mensagem').setLabel('Conteúdo do Anúncio').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
      ),
    );
    await interaction.showModal(modal);
  },
} satisfies Command;
