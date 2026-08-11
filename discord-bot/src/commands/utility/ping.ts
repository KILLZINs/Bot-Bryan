import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { COLORS, EMOJIS } from '../../utils/embeds';
import { prisma } from '../../database/client';

export default {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica a latência do bot'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    const wsLatency = interaction.client.ws.ping;
    const botLatency = Date.now() - interaction.createdTimestamp;

    const getStatus = (ms: number) => {
      if (ms < 100) return '🟢 Excelente';
      if (ms < 250) return '🟡 Bom';
      if (ms < 500) return '🟠 Regular';
      return '🔴 Alto';
    };

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.LIGHTNING} Pong!`)
      .addFields(
        { name: '🤖 Latência do Bot', value: `${botLatency}ms — ${getStatus(botLatency)}`, inline: true },
        { name: '💬 WebSocket', value: `${wsLatency}ms — ${getStatus(wsLatency)}`, inline: true },
        { name: '🗄️ Banco de Dados', value: `${dbLatency}ms — ${getStatus(dbLatency)}`, inline: true },
      )
      .setFooter({ text: '⚔️ Aliança Skyline' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;
