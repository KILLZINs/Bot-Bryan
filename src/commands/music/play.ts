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

// Mesma lógica do site (/atividades/musica): só tratamos como "link direto"
// quando é de fato um link de uma plataforma conhecida apontando pra algo
// específico (vídeo/track/playlist) — não só o domínio sozinho.
function isRealMediaLink(q: string): boolean {
  if (!/^https?:\/\//i.test(q)) return false;
  try {
    const u = new URL(q);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const knownHosts = ['youtube.com', 'youtu.be', 'open.spotify.com', 'soundcloud.com', 'music.apple.com', 'vimeo.com'];
    if (!knownHosts.some((h) => host === h || host.endsWith('.' + h))) return false;
    const hasPath = !!u.pathname && u.pathname !== '/' && u.pathname.length > 1;
    const hasQuery = !!u.search && u.search.length > 1;
    return hasPath || hasQuery;
  } catch {
    return false;
  }
}

const ENGINE_BY_SOURCE: Record<string, any> = {
  soundcloud: QueryType.SOUNDCLOUD_SEARCH,
  youtube: QueryType.YOUTUBE_SEARCH,
  spotify: QueryType.SPOTIFY_SEARCH,
};

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
          'Nome da música ou link do Spotify, YouTube ou SoundCloud',
        )
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('fonte')
        .setDescription(
          'De onde buscar (padrão: SoundCloud) — ignorado se você colar um link',
        )
        .setRequired(false)
        .addChoices(
          { name: '☁️ SoundCloud', value: 'soundcloud' },
          { name: '▶️ YouTube', value: 'youtube' },
          { name: '🟢 Spotify', value: 'spotify' },
        ),
    ),

  async execute(
    interaction: ChatInputCommandInteraction,
  ) {
    const player = useMainPlayer();

    const query = interaction.options.getString(
      'musica',
      true,
    );
    const fonte = (interaction.options.getString('fonte') || 'soundcloud').toLowerCase();

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

    await interaction.deferReply();

    try {
      const isLink = isRealMediaLink(query);

      const searchResult = await player.search(
        query,
        {
          requestedBy: interaction.user,
          searchEngine: isLink
            ? QueryType.AUTO
            : (ENGINE_BY_SOURCE[fonte] || QueryType.SOUNDCLOUD_SEARCH),
        },
      );

      if (!searchResult.hasTracks()) {
        return interaction.editReply(
          '❌ Não encontrei essa música. Tente usar o nome completo, trocar a `fonte` ou colar um link do Spotify/YouTube/SoundCloud.',
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
