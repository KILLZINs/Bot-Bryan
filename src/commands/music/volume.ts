import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { useQueue } from 'discord-player';
import { errorEmbed } from '../../utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('🔊 Altera o volume do bot')
    .addIntegerOption(option => 
      option.setName('nivel')
        .setDescription('Nível do volume (1 a 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Você precisa estar no canal de voz para alterar o volume!')], ephemeral: true });
    }

    const queue = useQueue(interaction.guildId!);
    if (!queue || !queue.isPlaying()) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Não há nenhuma música tocando no momento.')], ephemeral: true });
    }

    const vol = interaction.options.getInteger('nivel', true);
    queue.node.setVolume(vol);

    return interaction.reply(`🔊 Volume ajustado para **${vol}%**!`);
  }
};
