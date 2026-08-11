import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { COLORS, EMOJIS } from '../../utils/embeds';

const COMMANDS = [
  {
    category: `${EMOJIS.SHIELD} Membros`,
    items: [
      '`/membro info` — Veja as informações de um membro',
      '`/membro lista` — Lista todos os membros',
      '`/membro adicionar` — [MOD] Adiciona um membro',
      '`/membro remover` — [MOD] Remove um membro',
      '`/rank definir` — [MOD] Define o rank de um membro',
      '`/rank lista` — Lista os ranks disponíveis',
      '`/nivel` — Veja seu nível ou de outro membro',
      '`/ranking` — Ranking de XP ou moedas',
    ],
  },
  {
    category: `${EMOJIS.COINS} Recompensas`,
    items: [
      '`/recompensa saldo` — Consulte o saldo de moedas',
      '`/recompensa dar` — [MOD] Dê moedas a um membro',
      '`/recompensa remover` — [MOD] Remova moedas',
      '`/recompensa transferir` — Transfira moedas',
      '`/conquista listar` — Veja conquistas de um membro',
      '`/conquista todas` — Veja todas as conquistas',
      '`/conquista conceder` — [MOD] Conceda uma conquista',
    ],
  },
  {
    category: `${EMOJIS.SPARKLES} Eventos`,
    items: [
      '`/evento listar` — Próximos eventos',
      '`/evento entrar` — Participe de um evento',
      '`/evento criar` — [MOD] Crie um evento',
      '`/evento presenca` — [MOD] Veja a presença',
      '`/evento finalizar` — [MOD] Finalize e recompense',
    ],
  },
  {
    category: `${EMOJIS.TICKET} Suporte`,
    items: [
      '`/ticket criar` — Abra um ticket de suporte',
      '`/ticket fechar` — Feche o ticket atual',
      '`/ticket listar` — [MOD] Tickets abertos',
    ],
  },
  {
    category: `💬 Feedback`,
    items: [
      '`/feedback enviar` — Envie um feedback',
      '`/sugestao enviar` — Faça uma sugestão',
      '`/sugestao listar` — Veja as sugestões',
      '`/enquete` — Crie uma enquete',
    ],
  },
  {
    category: `${EMOJIS.GIFT} Sorteios`,
    items: [
      '`/sorteio criar` — [MOD] Crie um sorteio',
      '`/sorteio entrar` — Participe de um sorteio',
    ],
  },
  {
    category: `${EMOJIS.CROWN} Admin`,
    items: [
      '`/anuncio` — [MOD] Envie um anúncio oficial',
      '`/serverinfo` — Estatísticas do servidor',
      '`/mod warn` — [MOD] Advertência',
      '`/mod kick` — [MOD] Expulsar membro',
      '`/mod ban` — [ADMIN] Banir membro',
      '`/mod mute` — [MOD] Silenciar membro',
      '`/mod purge` — [MOD] Deletar mensagens',
    ],
  },
];

export default {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra todos os comandos disponíveis')
    .addStringOption((opt) =>
      opt
        .setName('categoria')
        .setDescription('Ver comandos de uma categoria específica')
        .addChoices(
          { name: 'Membros', value: 'membros' },
          { name: 'Recompensas', value: 'recompensas' },
          { name: 'Eventos', value: 'eventos' },
          { name: 'Suporte', value: 'suporte' },
          { name: 'Feedback', value: 'feedback' },
          { name: 'Sorteios', value: 'sorteios' },
          { name: 'Admin', value: 'admin' },
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const categoria = interaction.options.getString('categoria');

    if (categoria) {
      const map: Record<string, number> = {
        membros: 0,
        recompensas: 1,
        eventos: 2,
        suporte: 3,
        feedback: 4,
        sorteios: 5,
        admin: 6,
      };
      const idx = map[categoria] ?? 0;
      const cat = COMMANDS[idx];
      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${cat.category}`)
        .setDescription(cat.items.join('\n'))
        .setFooter({ text: '⚔️ Aliança Skyline' });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.SCROLL} Comandos — Aliança Skyline`)
      .setDescription('Bem-vindo ao bot oficial da **Aliança Skyline**! Aqui estão todos os comandos disponíveis.\n\n*[MOD] = Moderadores | [ADMIN] = Administradores*')
      .setThumbnail(interaction.guild?.iconURL() ?? null)
      .setFooter({ text: 'Use /ajuda <categoria> para detalhes • ⚔️ Aliança Skyline' })
      .setTimestamp();

    for (const cat of COMMANDS) {
      embed.addFields({ name: cat.category, value: cat.items.slice(0, 3).join('\n') + (cat.items.length > 3 ? `\n*+${cat.items.length - 3} mais...*` : ''), inline: true });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
} satisfies Command;
