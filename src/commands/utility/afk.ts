import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';
import { successEmbed, errorEmbed } from '../../utils/embeds';
import { getBotConfig } from '../../utils/botConfig';
import { prisma } from '../../database/client';

export default {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Define seu status de AFK')
    .addStringOption(option =>
      option
        .setName('motivo')
        .setDescription('Motivo do AFK (opcional)')
        .setRequired(false)
        .setMaxLength(200),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!getBotConfig().featAfk) {
      return interaction.reply({
        embeds: [errorEmbed('Desativado', 'O sistema AFK está desativado no momento.')],
        ephemeral: true,
      });
    }

    const motivo = interaction.options.getString('motivo') ?? 'Ausente';
    const userId = interaction.user.id;

    const existing = await prisma.afkStatus.findUnique({ where: { userId } });

    if (existing) {
      return interaction.reply({
        embeds: [errorEmbed('Já em AFK', `Você já está em AFK com o motivo: **${existing.message}**\nEnvie qualquer mensagem para sair do AFK automaticamente.`)],
        ephemeral: true,
      });
    }

    await prisma.afkStatus.create({
      data: { userId, message: motivo },
    });

    await interaction.reply({
      embeds: [
        successEmbed('AFK Ativado', `Você entrou em modo AFK.\n**Motivo:** ${motivo}\n\nVocê será retirado do AFK automaticamente ao enviar uma mensagem.`),
      ],
      ephemeral: true,
    });
  },
} satisfies Command;
