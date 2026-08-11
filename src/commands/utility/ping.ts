import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';
import { COLORS, baseEmbed } from '../../utils/embeds';

export default {
  category: 'utility',
  data: new SlashCommandBuilder().setName('ping').setDescription('Verifica a latência do bot'),
  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ embeds: [baseEmbed().setTitle('🏓 Calculando latência...')], fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;
    const color = roundtrip < 100 ? COLORS.SUCCESS : roundtrip < 250 ? COLORS.WARNING : COLORS.ERROR;
    const quality = roundtrip < 100 ? '🟢 Excelente' : roundtrip < 250 ? '🟡 Boa' : '🔴 Alta';
    await interaction.editReply({
      embeds: [baseEmbed(color)
        .setTitle('🏓 Pong!')
        .addFields(
          { name: '📡 Latência Roundtrip', value: `**${roundtrip}ms**`, inline: true },
          { name: '💜 WebSocket', value: `**${ws}ms**`, inline: true },
          { name: '📊 Qualidade', value: quality, inline: true },
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })],
    });
  },
} satisfies Command;
