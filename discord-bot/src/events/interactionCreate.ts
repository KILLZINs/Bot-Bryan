import { Interaction, Collection } from 'discord.js';
import { ExtendedClient } from '../types';
import { errorEmbed } from '../utils/embeds';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction, client: ExtendedClient) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Cooldown
    const { cooldowns } = client;
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name)!;
    const cooldownAmount = 3_000;
    if (timestamps.has(interaction.user.id)) {
      const expiry = timestamps.get(interaction.user.id)! + cooldownAmount;
      if (now < expiry) {
        const left = ((expiry - now) / 1000).toFixed(1);
        await interaction.reply({
          embeds: [errorEmbed('Aguarde!', `Você precisa esperar **${left}s** antes de usar este comando novamente.`)],
          ephemeral: true,
        });
        return;
      }
    }
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Erro no comando ${interaction.commandName}:`, err);
      const embed = errorEmbed('Erro Inesperado', 'Ocorreu um erro ao executar este comando. Tente novamente.');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
