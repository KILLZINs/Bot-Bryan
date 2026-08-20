import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';

import {
  useMainPlayer,
  QueryType,
} from 'discord-player';

import { errorEmbed } from '../../utils/embeds';

const YOUTUBE_URL =
  /(?:youtube\.com|youtu\.be)/i;

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription(
      '▶️ Toca uma música nos canais de voz',
    )
    .addStringOption((option) =>
      option
        .setName('musica')
        .setDescription(
          'Nome da música ou link do Spotify ou SoundCloud',
        )
        .setRequired(true),
    ),

  async execute(
    interaction: ChatInputCommandInteraction,
  ) {
    const player = useMainPlayer();

    const query = interaction.options.getString(
      'musica',
      true,
    );

    const member =
      interaction.member as GuildMember;

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

    if (YOUTUBE_URL.test(query)) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Bloqueio',
            'Links diretos do YouTube estão instáveis. 🎧 Use links do Spotify, SoundCloud ou digite o nome da música!',
          ),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const isLink =
        /^https?:\/\//i.test(query);

      const searchResult = await player.search(
        query,
        {
          requestedBy: interaction.user,
          searchEngine: isLink
            ? QueryType.AUTO
            : QueryType.SOUNDCLOUD_SEARCH,
        },
      );

      if (!searchResult.hasTracks()) {
        return interaction.editReply(
          '❌ Não encontrei essa música. Tente usar o nome completo ou um link do Spotify/SoundCloud.',
        );
      }

      const { track } = await player.play(
        member.voice.channel,
        searchResult,
        {
          nodeOptions: {
            metadata: interaction,

            leaveOnEmpty: true,
            leaveOnEmptyCooldown: 300000,

            leaveOnEnd: false,
            leaveOnStop: true,
            leaveOnStopCooldown: 5000,

            connectionTimeout: 120000,
            bufferingTimeout: 30000,

            /*
             * O áudio passa pelo FFmpeg configurado no Player.
             * Não use volume 99 para tentar "forçar" o FFmpeg.
             */
            volume: 100,
          },
        },
      );

      return interaction.editReply(
        `🎶 **${track.title}** adicionada à fila com sucesso!`,
      );
    } catch (error) {
      console.error(
        '[ERRO AO INICIAR MÚSICA]',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return interaction.editReply(
        `❌ Não consegui iniciar o áudio.\n\nDetalhes: \`${message.slice(
          0,
          800,
        )}\`\n\nVerifique se o bot tem as permissões **Conectar** e **Falar** no canal de voz.`,
      );
    }
  },
};
