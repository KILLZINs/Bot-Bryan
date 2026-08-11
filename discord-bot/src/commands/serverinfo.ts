import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { COLORS } from '../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Exibe informações sobre o servidor'),
  category: 'utility',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ Apenas em servidores.', ephemeral: true });
    }
    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`⚔️ ${guild.name}`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: '👑 Dono', value: owner ? `<@${owner.id}>` : 'Desconhecido', inline: true },
        { name: '👥 Membros', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '💬 Canais', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Cargos', value: `${guild.roles.cache.size}`, inline: true },
        { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: '⚔️ Aliança Skyline' });

    await interaction.reply({ embeds: [embed] });
  },
};
