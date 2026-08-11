import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { buildLogsPanel } from '../../handlers/logsHandler';

export default {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('⚙️ Configura o canal e categorias de log do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const { embed, rows } = await buildLogsPanel(interaction.guild!);
    await interaction.editReply({ embeds: [embed], components: rows });
  },
};
