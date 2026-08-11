import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { prisma } from '../database/client';
import { COLORS, baseEmbed, successEmbed } from '../utils/embeds';

const GENEROS: Record<string, { label: string; emoji: string; pronoun: string }> = {
  M:  { label: 'Masculino',    emoji: '♂️',  pronoun: 'o' },
  F:  { label: 'Feminino',     emoji: '♀️',  pronoun: 'a' },
  NB: { label: 'Não-binário',  emoji: '⚧️',  pronoun: '' },
};

export default {
  category: 'geral',
  data: new SlashCommandBuilder()
    .setName('genero')
    .setDescription('Define ou vê o seu gênero (afeta mensagens e GIFs de roleplay)')
    .addStringOption(o =>
      o.setName('genero')
        .setDescription('Seu gênero')
        .setRequired(false)
        .addChoices(
          { name: '♂️ Masculino',   value: 'M'  },
          { name: '♀️ Feminino',    value: 'F'  },
          { name: '⚧️ Não-binário', value: 'NB' },
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const novoGenero = interaction.options.getString('genero');

    if (!novoGenero) {
      // só mostrar o atual
      const m = await prisma.member.findUnique({ where: { discordId: interaction.user.id } });
      const genero = GENEROS[m?.gender ?? 'NB'] ?? GENEROS.NB;
      return interaction.reply({
        embeds: [
          baseEmbed(COLORS.INFO)
            .setTitle('⚧️ Seu Gênero')
            .setDescription(`Seu gênero atual é: **${genero.emoji} ${genero.label}**\n\nUse \`/genero genero:[opção]\` para alterar.`)
        ],
        ephemeral: true,
      });
    }

    await prisma.member.upsert({
      where:  { discordId: interaction.user.id },
      update: { gender: novoGenero, username: interaction.user.username },
      create: { discordId: interaction.user.id, username: interaction.user.username, gender: novoGenero },
    });

    const g = GENEROS[novoGenero];
    return interaction.reply({
      embeds: [
        successEmbed('Gênero Definido!', `Seu gênero foi definido como **${g.emoji} ${g.label}**.\nAs mensagens de roleplay serão adaptadas.`)
      ],
      ephemeral: true,
    });
  },
} satisfies Command;
