import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { useQueue } from 'discord-player';
import { errorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('⏹️ Para a música, limpa a fila e sai do canal'),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Você precisa estar no canal de voz para parar o bot!')], ephemeral: true });
    }

    const queue = useQueue(interaction.guildId!);
    if (!queue || !queue.isPlaying()) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Não há nenhuma música tocando no momento.')], ephemeral: true });
    }

    queue.delete(); // Deleta a fila inteira e força o bot a desconectar
    return interaction.reply('⏹️ A música foi parada e a fila foi limpa. Saindo...');
  }
};
