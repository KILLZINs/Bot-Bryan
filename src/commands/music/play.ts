import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { useMainPlayer, QueryType } from 'discord-player';
import play from 'play-dl';
import { errorEmbed } from '../../utils/embeds';

const YOUTUBE_URL = /(?:youtube\.com|youtu\.be)/i;

async function soundCloudSearch(
  player: ReturnType<typeof useMainPlayer>,
  query: string,
) {
  const result = await player.search(query, {
    searchEngine: QueryType.SOUNDCLOUD_SEARCH,
  });

  if (result.hasTracks()) {
    return result;
  }

  /*
   * Alguns títulos não aparecem com a grafia exata no SoundCloud.
   * Nesse caso, usamos o primeiro resultado do YouTube apenas como
   * referência e pesquisamos o título final no SoundCloud.
   */
  const youtubeResults = await play.search(query, { limit: 3 });
  const firstResult = youtubeResults[0];

  if (!firstResult) {
    return result;
  }

  return player.search(
    `${firstResult.title} ${firstResult.channel?.name ?? ''}`,
    {
      searchEngine: QueryType.SOUNDCLOUD_SEARCH,
    },
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('▶️ Toca uma música nos canais de voz')
    .addStringOption((option) =>
      option
        .setName('musica')
        .setDescription(
          'Nome da música ou link do YouTube, Spotify ou SoundCloud',
        )
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const player = useMainPlayer();
    const query = interaction.options.getString('musica', true);
    const member = interaction.member as GuildMember;

    if (!member?.voice?.channel) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Erro',
            'Você precisa estar em um canal de voz para colocar música!',
          ),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      let searchResult;

      if (YOUTUBE_URL.test(query)) {
        /*
         * O link do YouTube não é enviado diretamente para o player,
         * pois o sistema de stream do YouTube sofre bloqueios e alterações
         * frequentes. Pegamos o título e localizamos a mesma música no
         * SoundCloud para reproduzir de forma mais estável.
         */
        const info = await play.video_basic_info(query);

        const title = info.video_details.title;
        const author = info.video_details.channel?.name ?? '';

        searchResult = await soundCloudSearch(
          player,
          `${title} ${author}`,
        );
      } else if (/^https?:\/\//i.test(query)) {
        // Spotify e SoundCloud continuam usando os extractors nativos.
        searchResult = await player.search(query, {
          requestedBy: interaction.user,
          searchEngine: QueryType.AUTO,
        });
      } else {
        // Pesquisa por nome, com fallback usando o YouTube como índice.
        searchResult = await soundCloudSearch(player, query);
      }

      if (!searchResult.hasTracks()) {
        return interaction.editReply(
          '❌ Não encontrei essa música. Tente informar o artista junto com o título ou enviar um link do Spotify/SoundCloud.',
        );
      }

      const { track } = await player.play(member.voice.channel, searchResult, {
        nodeOptions: {
          metadata: interaction,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000,
          leaveOnEnd: false,
        },
      });

      return interaction.editReply(
        `🎶 **${track.title}** adicionada à fila com sucesso!`,
      );
    } catch (error) {
      console.error('[ERRO DE MÚSICA]', error);

      return interaction.editReply(
        '❌ Não consegui iniciar o áudio. Verifique se o bot tem as permissões **Conectar** e **Falar** no canal de voz e tente novamente.',
      );
    }
  },
};
