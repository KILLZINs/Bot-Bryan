import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { useMainPlayer, QueryType } from 'discord-player';
import { errorEmbed } from '../../utils/embeds'; 

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('▶️ Toca uma música nos canais de voz')
    .addStringOption(option => 
      option.setName('musica')
        .setDescription('Nome da música ou link (Spotify / SoundCloud)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const player = useMainPlayer();
    const query = interaction.options.getString('musica', true);
    const member = interaction.member as GuildMember;

    if (!member?.voice?.channel) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Você precisa estar em um canal de voz para colocar música!')], ephemeral: true });
    }

    // 🛡️ TRAVA DE SEGURANÇA: Bloqueia links brutos do YouTube
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      return interaction.reply({ 
        embeds: [errorEmbed('Bloqueio do YouTube', 'Links diretos do YouTube estão temporariamente desativados devido a restrições de sistema do Google.\n\n🎧 **Use links do Spotify, SoundCloud ou digite o nome da música!**')], 
        ephemeral: true 
      });
    }

    // Dá tempo pro bot pesquisar (evita o erro "A interação falhou")
    await interaction.deferReply();

    try {
      // 🧠 BUSCA SUPER RÁPIDA:
      // Se for link, deixa ler no automático (perfeito pro Spotify).
      // Se for texto, pesquisa e baixa direto do SoundCloud (anti-block + instantâneo).
      const isLink = query.startsWith('http://') || query.startsWith('https://');
      const engineToUse = isLink ? QueryType.AUTO : QueryType.SOUNDCLOUD_SEARCH;

      const searchResult = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: engineToUse
      });

      if (!searchResult.hasTracks()) {
         return interaction.followUp('❌ Não consegui encontrar nenhuma música. Verifique o nome ou o link enviado.');
      }

      // 🎧 Entra na call e roda o som
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
      return interaction.followUp(`❌ Falha crítica ao processar o comando. Erro: \`${e.message || 'Desconhecido'}\``);
    }
  }
};
