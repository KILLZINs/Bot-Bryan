import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { useMainPlayer } from 'discord-player';
import { errorEmbed } from '../../utils/embeds'; 

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('▶️ Toca uma música ou playlist nos canais de voz')
    .addStringOption(option => 
      option.setName('musica')
        .setDescription('Nome da música ou link (YouTube, Spotify, Soundcloud)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const player = useMainPlayer();
    const query = interaction.options.getString('musica', true);
    const member = interaction.member as GuildMember;

    // Trava: O usuário precisa estar em uma call
    if (!member.voice.channel) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Você precisa estar em um canal de voz para colocar música!')], ephemeral: true });
    }

    // DeferReply é essencial porque pesquisar a música pode demorar mais de 3 segundos
    await interaction.deferReply();

    try {
      const { track } = await player.play(member.voice.channel, query, {
        nodeOptions: {
          metadata: interaction,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000, // Sai após 5 minutos sozinho
          leaveOnEnd: false, // Fica na call quando a música acabar
        }
      });

      return interaction.followUp(`🎶 **${track.title}** adicionada à fila com sucesso!`);
      
    } catch (e) {
      console.error('[ERRO DE MÚSICA]', e);
      return interaction.followUp('❌ Não consegui encontrar/tocar essa música. Verifique o link ou o nome.');
    }
  }
};
