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

    // Dá tempo pro bot pesquisar (evita "A interação falhou")
    await interaction.deferReply();

    try {
      // 🧠 BUSCA GLOBAL: Tenta achar em qualquer plataforma
      const searchResult = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO
      });

      if (!searchResult.hasTracks()) {
         return interaction.followUp('❌ Não consegui encontrar nenhuma música. Verifique o nome ou o link enviado.');
      }

      const { track } = await player.play(member.voice.channel, searchResult, {
        nodeOptions: {
          metadata: interaction, // Passamos a interação para o index.ts avisar se der erro
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000, 
          leaveOnEnd: false, 
          bufferingTimeout: 10000, // Dá mais tempo pro Railway baixar a música
        }
      });

      return interaction.followUp(`🎶 **${track.title}** adicionada à fila com sucesso!`);
      
    } catch (e: any) {
      console.error('[ERRO DE MÚSICA]', e);
      return interaction.followUp(`❌ Falha crítica ao processar o comando. Erro: \`${e.message || 'Desconhecido'}\``);
    }
  }
};
