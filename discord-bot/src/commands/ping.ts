import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { COLORS } from '../utils/embeds';
import { prisma } from '../database/client';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica a latência do bot e do banco de dados'),
  category: 'utility',
  async execute(interaction: ChatInputCommandInteraction) {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbPing = Date.now() - start;
    const wsPing = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(wsPing < 100 ? COLORS.SUCCESS : wsPing < 250 ? COLORS.WARNING : COLORS.ERROR)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '⚡ WebSocket', value: `\`${wsPing}ms\``, inline: true },
        { name: '🗄️ Banco de Dados', value: `\`${dbPing}ms\``, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: '⚔️ Aliança Skyline' });

    await interaction.reply({ embeds: [embed] });
  },
};
