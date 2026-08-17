import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { useQueue } from 'discord-player';
import { errorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('⏭️ Pula para a próxima música da fila'),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Você precisa estar no canal de voz para pular!')], ephemeral: true });
    }

    const queue = useQueue(interaction.guildId!);
    if (!queue || !queue.isPlaying()) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Não há nenhuma música tocando no momento.')], ephemeral: true });
    }

    queue.node.skip();
    return interaction.reply('⏭️ A música atual foi pulada!');
  }
};
