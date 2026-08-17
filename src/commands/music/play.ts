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

    if (!member.voice.channel) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Você precisa estar em um canal de voz para colocar música!')], ephemeral: true });
    }

    await interaction.deferReply();

    try {
      // 🧠 BUSCA INTELIGENTE
      // Se tiver "http" no texto, é um link. Se não tiver, é uma pesquisa por nome.
      const isLink = query.startsWith('http://') || query.startsWith('https://');
      
      // Força a busca no YouTube se for apenas texto (muito mais preciso)
      const engineToUse = isLink ? QueryType.AUTO : QueryType.YOUTUBE_SEARCH;

      const searchResult = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: engineToUse
      });

      if (!searchResult.hasTracks()) {
         return interaction.followUp('❌ Não consegui encontrar nenhuma música com esse nome/link. Tente ser mais específico.');
      }

      const { track } = await player.play(member.voice.channel, searchResult, {
        nodeOptions: {
          metadata: interaction,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000, 
          leaveOnEnd: false, 
        }
      });

      return interaction.followUp(`🎶 **${track.title}** adicionada à fila com sucesso!`);
      
    } catch (e: any) {
      console.error('[ERRO DE MÚSICA]', e);
      return interaction.followUp(`❌ Falha ao tocar. O erro foi: \`${e.message || 'Erro Desconhecido'}\``);
    }
  }
};
