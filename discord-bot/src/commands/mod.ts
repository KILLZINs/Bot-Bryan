import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { COLORS } from '../utils/embeds';
import { isMod } from '../utils/helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Painel de moderação da Aliança Skyline'),
  category: 'moderation',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({ content: '❌ Apenas em servidores.', ephemeral: true });
    }
    if (!isMod(interaction.member as GuildMember)) {
      return interaction.reply({ content: '❌ Apenas moderadores podem usar este painel.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle('🛡️ Painel de Moderação')
      .setDescription(
        '> **1.** Selecione o membro no menu abaixo.\n' +
        '> **2.** Escolha a ação de moderação desejada.\n\n' +
        '⚠️ Use com responsabilidade.'
      )
      .setTimestamp()
      .setFooter({ text: '⚔️ Aliança Skyline — Moderação' });

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('select_mod_user')
        .setPlaceholder('🔍 Selecione um membro para moderar...')
        .setMinValues(1)
        .setMaxValues(1),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
