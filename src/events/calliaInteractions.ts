import { Interaction } from 'discord.js';
import { handleCalliaButton } from '../commands/callia';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction) {
    if (
      interaction.isButton() &&
      interaction.customId.startsWith('callia:')
    ) {
      await handleCalliaButton(interaction);
    }
  },
};
