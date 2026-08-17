import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { useMainPlayer, QueryType } from 'discord-player'; // 👈 IMPORTANTE: QueryType adicionado
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
      // 1. Pesquisa a música antes de qualquer coisa
      const searchResult = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO // Procura em todas as plataformas
      });

      // Se não achou NADA, avisa e para aqui
      if (!searchResult.hasTracks()) {
         return interaction.followUp('❌ Não consegui encontrar nenhuma música com esse nome/link.');
      }

      // 2. Se achou, entra na call e toca!
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
      // Se der erro de novo, agora o bot vai falar EXATAMENTE o motivo no chat do Discord
      return interaction.followUp(`❌ Falha crítica ao tocar: \`${e.message || 'Erro Desconhecido'}\``);
    }
  }
};
