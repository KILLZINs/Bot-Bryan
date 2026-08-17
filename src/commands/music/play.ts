import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { useMainPlayer, QueryType } from 'discord-player';
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

    if (!member?.voice?.channel) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Você precisa estar em um canal de voz para colocar música!')], ephemeral: true });
    }

    // Dá mais tempo pro bot pensar
    await interaction.deferReply();

    try {
      // 🧠 BUSCA INTELIGENTE TURBINADA
      // Se tiver "http", é link. Se for só texto, pesquisa direto no Spotify (muito mais rápido e preciso)
      const isLink = query.startsWith('http://') || query.startsWith('https://');
      const engineToUse = isLink ? QueryType.AUTO : QueryType.SPOTIFY_SEARCH;

      const searchResult = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: engineToUse
      });

      if (!searchResult.hasTracks()) {
         return interaction.followUp('❌ Não consegui encontrar nenhuma música. Verifique o nome/link.');
      }

      // Toca a música e força a engine a usar estratégias antiblock
      const { track } = await player.play(member.voice.channel, searchResult, {
        nodeOptions: {
          metadata: interaction,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000, 
          leaveOnEnd: false, 
          bufferingTimeout: 3000, // Tempo de espera para buffer
        }
      });

      return interaction.followUp(`🎶 **${track.title}** adicionada à fila com sucesso!`);
      
    } catch (e: any) {
      console.error('[ERRO DE MÚSICA]', e);
      return interaction.followUp(`❌ Falha crítica ao tocar. O bloqueio de IP pode estar ativo. Erro: \`${e.message || 'Desconhecido'}\``);
    }
  }
};
