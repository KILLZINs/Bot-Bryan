import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  GuildMember,
} from 'discord.js';
import { isAdmin } from '../utils/helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configura os canais e cargos da Aliança Skyline'),
  category: 'admin',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({ content: '❌ Apenas em servidores.', ephemeral: true });
    }
    if (!isAdmin(interaction.member as GuildMember)) {
      return interaction.reply({ content: '❌ Apenas administradores podem configurar o bot.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_setup')
      .setTitle('⚙️ Configuração da Guild');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('log_channel')
          .setLabel('ID do Canal de Logs')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('Cole o ID do canal de logs aqui'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('welcome_channel')
          .setLabel('ID do Canal de Boas-vindas')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('Cole o ID do canal de boas-vindas aqui'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('mod_role')
          .setLabel('ID do Cargo de Moderador')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('Cole o ID do cargo de moderador aqui'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('member_role')
          .setLabel('ID do Cargo de Membro')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('Cole o ID do cargo de membro aqui'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket_category')
          .setLabel('ID da Categoria de Tickets')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('Cole o ID da categoria de tickets aqui'),
      ),
    );

    await interaction.showModal(modal);
  },
};
