// ═══════════════════════════════════════════════════════════════════════
// COMANDO /fut — Sistema "Rachão" (fase 2: clãs + partidas por modo)
// ═══════════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../types';
import { errorEmbed, successEmbed, COLORS } from '../utils/embeds';
import {
  FutError,
  createClan, joinClan, addClanMember, listClans, getClanByName, deleteClan,
  listTeams, createTeam, deleteTeam, setMemberTeam,
  createPartida, getOpenPartida, getPartidaById, deletePartida, listPartidaHistory,
  joinPartida, addOfflinePlayer, setTeam, autoBalanceTeams, startPartida, recordEvent, finishPartida,
  getProfile, getRanking, getUserProfile, setUserPosition, listGoalVideos, notaBand,
  createChamada, listChamadas, deleteChamada, respondChamada,
  undoLastEvent, reopenPartida, getClanOverview, listFullClanStats,
  type FutEventType, type FutMode, type FutRsvpStatus, type FutVisibility,
} from '../fut/services/pelada';

// Mesma faixa (notaBand) usada no site, só que como emoji colorido — pra
// bater a mesma cor pro mesmo número nos dois lugares.
const NOTA_EMOJI: Record<ReturnType<typeof notaBand>, string> = { ruim: '🟥', mediano: '🟧', bom: '🟩', excelente: '🟨' };
function notaTag(nota: number): string {
  return `${NOTA_EMOJI[notaBand(nota)]} ${nota.toFixed(1)}`;
}

function playerRefFrom(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('jogador');
  const apelido = interaction.options.getString('apelido');
  return { discordId: user?.id, apelido: apelido ?? undefined };
}

async function resolveClan(interaction: ChatInputCommandInteraction) {
  const nome = interaction.options.getString('cla', true);
  const clan = await getClanByName(interaction.guildId!, nome);
  if (!clan) throw new FutError(`Não achei nenhum clã chamado **${nome}** neste servidor. Use \`/fut cla criar\` primeiro.`);
  return clan;
}

function buildPartidaEmbed(partida: Awaited<ReturnType<typeof getPartidaById>>, clanName: string) {
  if (!partida) return errorEmbed('Partida não encontrada.');

  const timeA = partida.players.filter((p) => p.team === 'A');
  const timeB = partida.players.filter((p) => p.team === 'B');
  const semTime = partida.players.filter((p) => !p.team);
  const statusLabel = partida.status === 'aberta' ? '🟡 Aberta (inscrições)' : partida.status === 'em_andamento' ? '🟢 Em andamento' : '🔴 Finalizada';
  const finalizada = partida.status === 'finalizada';
  const notaTxt = (p: (typeof partida.players)[number]) => (finalizada && p.nota != null ? ` — ${notaTag(p.nota)}` : '');

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`⚽ ${partida.name || 'Partida'} — clã ${clanName}`)
    .setDescription(`**Modo:** ${partida.mode === 'futsal' ? 'Futsal' : 'Campo'}\n**Status:** ${statusLabel}`)
    .addFields(
      { name: `Time A (${timeA.length})`, value: timeA.length ? timeA.map((p) => `${p.displayName} — ⚽${p.goals} 🅰️${p.assists}${notaTxt(p)}`).join('\n') : '_vazio_', inline: true },
      { name: `Time B (${timeB.length})`, value: timeB.length ? timeB.map((p) => `${p.displayName} — ⚽${p.goals} 🅰️${p.assists}${notaTxt(p)}`).join('\n') : '_vazio_', inline: true },
    );

  if (semTime.length) embed.addFields({ name: 'Sem time definido', value: semTime.map((p) => p.displayName).join(', ') });
  if (partida.status !== 'aberta') embed.addFields({ name: 'Placar', value: `**${partida.scoreA} x ${partida.scoreB}**` });

  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('fut')
    .setDescription('⚽ Sistema de Rachão — clãs, partidas e estatísticas')
    .addSubcommandGroup((group) => group
      .setName('cla')
      .setDescription('Gerenciar clãs (grupos persistentes de rachão)')
      .addSubcommand((sub) => sub.setName('criar').setDescription('Cria um novo clã')
        .addStringOption((o) => o.setName('nome').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('visibilidade').setDescription('Público (padrão) ou privado (só entra com código)')
          .addChoices({ name: 'Público', value: 'publico' }, { name: 'Privado', value: 'privado' })))
      .addSubcommand((sub) => sub.setName('entrar').setDescription('Entra em um clã existente')
        .addStringOption((o) => o.setName('nome').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('codigo').setDescription('Código de convite (só pra clãs privados)')))
      .addSubcommand((sub) => sub.setName('listar').setDescription('Lista os clãs deste servidor'))
      .addSubcommand((sub) => sub.setName('deletar').setDescription('Deleta um clã (só quem criou)')
        .addStringOption((o) => o.setName('nome').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('adicionar').setDescription('Adiciona alguém direto no elenco do clã, com nome e ID (só quem criou o clã)')
        .addStringOption((o) => o.setName('nome').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('apelido').setDescription('Nome/apelido da pessoa').setRequired(true))
        .addUserOption((o) => o.setName('jogador').setDescription('A pessoa, se ela estiver nesse servidor (preenche o ID sozinho)'))
        .addStringOption((o) => o.setName('id_discord').setDescription('ID do Discord da pessoa (se ela não aparecer em "jogador") — Copiar ID, com modo desenvolvedor ativado')))
      .addSubcommand((sub) => sub.setName('stats').setDescription('Estatísticas do clã inteiro (elenco completo) num modo')
        .addStringOption((o) => o.setName('nome').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('modo').setDescription('Futsal ou campo').setRequired(true)
          .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' }))))
    .addSubcommandGroup((group) => group
      .setName('elenco')
      .setDescription('Times internos e fixos do clã (ex: Time Amarelo x Time Azul)')
      .addSubcommand((sub) => sub.setName('criar').setDescription('Cria um time interno no clã (só quem criou o clã)')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('nome').setDescription('Nome do time').setRequired(true))
        .addStringOption((o) => o.setName('cor').setDescription('Cor do time (opcional, ex: Amarelo, #FFD700)')))
      .addSubcommand((sub) => sub.setName('deletar').setDescription('Deleta um time interno (só quem criou o clã)')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('nome').setDescription('Nome do time').setRequired(true)))
      .addSubcommand((sub) => sub.setName('listar').setDescription('Lista os times internos do clã e seus jogadores')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('definir').setDescription('Coloca um membro do clã dentro de um time interno')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('nome').setDescription('Nome do time (deixe vazio pra tirar do time atual)'))
        .addUserOption((o) => o.setName('jogador').setDescription('Membro com conta no Discord'))
        .addStringOption((o) => o.setName('apelido').setDescription('Apelido (membro offline)'))))
    .addSubcommandGroup((group) => group
      .setName('partida')
      .setDescription('Gerenciar a partida em aberto de um clã')
      .addSubcommand((sub) => sub.setName('criar').setDescription('Cria uma nova partida dentro de um clã')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('modo').setDescription('Futsal ou campo').setRequired(true)
          .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' }))
        .addStringOption((o) => o.setName('nome').setDescription('Nome da partida (opcional)')))
      .addSubcommand((sub) => sub.setName('deletar').setDescription('Deleta a partida em aberto do clã (só quem criou ela)')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('entrar').setDescription('Entra na partida em aberto do clã')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('posicao').setDescription('Sua posição (opcional)')))
      .addSubcommand((sub) => sub.setName('adicionar').setDescription('Adiciona um jogador sem conta no Discord (offline)')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('apelido').setDescription('Apelido do jogador').setRequired(true))
        .addStringOption((o) => o.setName('posicao').setDescription('Posição (opcional)')))
      .addSubcommand((sub) => sub.setName('time').setDescription('Define o time (A ou B) de um jogador')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('time').setDescription('Time').setRequired(true)
          .addChoices({ name: 'Time A', value: 'A' }, { name: 'Time B', value: 'B' }))
        .addUserOption((o) => o.setName('jogador').setDescription('Jogador com conta no Discord'))
        .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)')))
      .addSubcommand((sub) => sub.setName('auto_equilibrar').setDescription('Distribui os jogadores em times A/B tentando equilibrar o nível (só quem criou a partida)')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('iniciar').setDescription('Inicia a partida (fecha as inscrições)')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('gol').setDescription('Registra um gol')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addUserOption((o) => o.setName('jogador').setDescription('Quem fez o gol'))
        .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)'))
        .addUserOption((o) => o.setName('assistencia_de').setDescription('Quem deu a assistência (opcional)'))
        .addStringOption((o) => o.setName('assistencia_apelido').setDescription('Apelido de quem assistiu (opcional)'))
        .addStringOption((o) => o.setName('video').setDescription('Link do vídeo do gol (opcional, ex: YouTube)')))
      .addSubcommand((sub) => sub.setName('gols').setDescription('Lista os gols com vídeo salvos na partida')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('desfazer').setDescription('Desfaz o último evento registrado (gol/defesa/erro/etc), em caso de engano')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('reabrir').setDescription('Reabre uma partida finalizada pra corrigir gols/estatísticas/resultado (só quem criou)')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addIntegerOption((o) => o.setName('posicao').setDescription('Qual partida do histórico (1 = mais recente, padrão). Veja `/fut partida historico`.').setMinValue(1)))
      .addSubcommand((sub) => sub.setName('detalhes').setDescription('Mostra os detalhes/estatísticas completas de uma partida do histórico')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addIntegerOption((o) => o.setName('posicao').setDescription('Qual partida do histórico (1 = mais recente, padrão). Veja `/fut partida historico`.').setMinValue(1)))
      .addSubcommand((sub) => sub.setName('defesa').setDescription('Registra uma defesa')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addUserOption((o) => o.setName('jogador').setDescription('Quem defendeu'))
        .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)')))
      .addSubcommand((sub) => sub.setName('concedido').setDescription('Registra um gol concedido (sofrido)')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addUserOption((o) => o.setName('jogador').setDescription('Quem sofreu o gol'))
        .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)')))
      .addSubcommand((sub) => sub.setName('erro').setDescription('Registra um erro grave / lance ruim')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addUserOption((o) => o.setName('jogador').setDescription('Quem errou'))
        .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)')))
      .addSubcommand((sub) => sub.setName('placar').setDescription('Mostra o placar da partida em aberto do clã')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('historico').setDescription('Mostra as últimas partidas finalizadas do clã')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('finalizar').setDescription('Finaliza a partida e salva as estatísticas')
        .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
        .addStringOption((o) => o.setName('resultado').setDescription('Forçar um resultado (opcional — por padrão usa o placar)')
          .addChoices({ name: 'Vitória Time A', value: 'vitoria_a' }, { name: 'Vitória Time B', value: 'vitoria_b' }, { name: 'Empate', value: 'empate' }))))
    .addSubcommand((sub) => sub.setName('perfil').setDescription('Mostra suas estatísticas num clã')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
      .addStringOption((o) => o.setName('modo').setDescription('Futsal ou campo').setRequired(true)
        .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' }))
      .addUserOption((o) => o.setName('usuario').setDescription('Ver o perfil de outra pessoa (opcional)')))
    .addSubcommand((sub) => sub.setName('ranking').setDescription('Mostra o ranking de um clã')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
      .addStringOption((o) => o.setName('modo').setDescription('Futsal ou campo').setRequired(true)
        .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' })))
    .addSubcommand((sub) => sub.setName('posicao').setDescription('Define sua posição preferida (usada como padrão ao entrar em partidas)')
      .addStringOption((o) => o.setName('modo').setDescription('Futsal ou campo').setRequired(true)
        .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' }))
      .addStringOption((o) => o.setName('posicao').setDescription('Ex: Goleiro, Zagueiro, Meia, Atacante, Pivô...').setRequired(true)))
    .addSubcommand((sub) => sub.setName('chamar').setDescription('Chama o fut! Anuncia local, horário, PIX e link pro clã')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
      .addStringOption((o) => o.setName('local').setDescription('Onde vai ser').setRequired(true))
      .addStringOption((o) => o.setName('horario').setDescription('Quando (ex: "Hoje 20h", "Sáb 09/08 16h")').setRequired(true))
      .addStringOption((o) => o.setName('pix').setDescription('Chave PIX pra dividir a quadra (opcional)'))
      .addStringOption((o) => o.setName('link').setDescription('Link do grupo/WhatsApp/outra plataforma (opcional)'))
      .addStringOption((o) => o.setName('mensagem').setDescription('Mensagem extra (opcional)')))
    .addSubcommand((sub) => sub.setName('chamadas').setDescription('Mostra as últimas chamadas do clã e quem confirmou')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true)))
    .addSubcommand((sub) => sub.setName('confirmar').setDescription('Confirma presença na última chamada do clã')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true))
      .addStringOption((o) => o.setName('status').setDescription('Sua resposta').setRequired(true)
        .addChoices({ name: '✅ Vou', value: 'vou' }, { name: '🤔 Talvez', value: 'talvez' }, { name: '❌ Não vou', value: 'nao_vou' }))),

  async execute(interaction: ChatInputCommandInteraction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      // ── /fut cla ─────────────────────────────────────────────────────
      if (group === 'cla') {
        if (sub === 'criar') {
          const nome = interaction.options.getString('nome', true);
          const visibilidade = (interaction.options.getString('visibilidade') ?? 'publico') as FutVisibility;
          const clan = await createClan(guildId, interaction.user.id, interaction.user.username, nome, visibilidade);
          const desc = clan.visibility === 'privado'
            ? `**${clan.name}** (privado) — use \`/fut partida criar\` pra começar. Código de convite: \`${clan.joinCode}\` (compartilhe só com quem quiser trazer).`
            : `**${clan.name}** — use \`/fut partida criar\` pra começar uma partida.`;
          await interaction.reply({ embeds: [successEmbed('Clã criado!', desc)], ephemeral: clan.visibility === 'privado' });
          return;
        }
        if (sub === 'entrar') {
          const nome = interaction.options.getString('nome', true);
          const codigo = interaction.options.getString('codigo') ?? undefined;
          const clan = await getClanByName(guildId, nome);
          if (!clan) throw new FutError(`Não achei nenhum clã chamado **${nome}**.`);
          await joinClan(clan.id, interaction.user.id, interaction.user.username, codigo);
          await interaction.reply({ embeds: [successEmbed('Você entrou no clã!', `Bem-vindo ao **${clan.name}**.`)] });
          return;
        }
        if (sub === 'listar') {
          const clans = await listClans(guildId, interaction.user.id);
          if (!clans.length) {
            await interaction.reply({ embeds: [errorEmbed('Nenhum clã ainda', 'Crie um com `/fut cla criar`.')], ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle('⚽ Clãs do servidor')
            .setDescription(clans.map((c) => `**${c.name}**${c.visibility === 'privado' ? ' 🔒' : ''} — ${c.members.length} membro(s)`).join('\n'));
          await interaction.reply({ embeds: [embed] });
          return;
        }
        if (sub === 'deletar') {
          const nome = interaction.options.getString('nome', true);
          const clan = await getClanByName(guildId, nome);
          if (!clan) throw new FutError(`Não achei nenhum clã chamado **${nome}**.`);
          await deleteClan(clan.id, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed('Clã deletado', `**${clan.name}** e todas as partidas dele foram apagados.`)] });
          return;
        }
        if (sub === 'adicionar') {
          const nome = interaction.options.getString('nome', true);
          const apelido = interaction.options.getString('apelido', true);
          const jogador = interaction.options.getUser('jogador');
          const idManual = interaction.options.getString('id_discord') ?? undefined;
          const clan = await getClanByName(guildId, nome);
          if (!clan) throw new FutError(`Não achei nenhum clã chamado **${nome}**.`);

          const discordId = jogador?.id ?? idManual;
          const member = await addClanMember(clan.id, interaction.user.id, { discordId, displayName: apelido });
          const desc = member.discordId
            ? `**${member.displayName}** (<@${member.discordId}>) agora faz parte do elenco de **${clan.name}**.`
            : `**${member.displayName}** agora faz parte do elenco de **${clan.name}** (sem conta do Discord vinculada).`;
          await interaction.reply({ embeds: [successEmbed('Membro adicionado!', desc)] });
          return;
        }
        if (sub === 'stats') {
          const nome = interaction.options.getString('nome', true);
          const modo = interaction.options.getString('modo', true) as FutMode;
          const clan = await getClanByName(guildId, nome);
          if (!clan) throw new FutError(`Não achei nenhum clã chamado **${nome}**.`);

          const [overview, elenco] = await Promise.all([getClanOverview(clan.id, modo), listFullClanStats(clan.id, modo)]);
          if (!overview.totalJogadores) {
            await interaction.reply({ embeds: [errorEmbed('Sem estatísticas ainda', `Ninguém finalizou uma partida de ${modo} nesse clã ainda.`)], ephemeral: true });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(COLORS.GOLD)
            .setTitle(`📊 Estatísticas do clã — ${clan.name} (${modo})`)
            .addFields(
              { name: 'Partidas finalizadas', value: `${overview.totalPartidas}`, inline: true },
              { name: 'Jogadores com stats', value: `${overview.totalJogadores}`, inline: true },
              { name: 'V / D / E (somado)', value: `${overview.totalVitorias} / ${overview.totalDerrotas} / ${overview.totalEmpates}`, inline: true },
              { name: 'Gols (elenco)', value: `${overview.totalGols}`, inline: true },
              { name: 'Assistências (elenco)', value: `${overview.totalAssists}`, inline: true },
              { name: 'Defesas (elenco)', value: `${overview.totalDefesas}`, inline: true },
              { name: 'Gols concedidos', value: `${overview.totalConcedidos}`, inline: true },
              { name: 'Erros graves', value: `${overview.totalErros}`, inline: true },
            );
          if (overview.artilheiro) embed.addFields({ name: '👑 Artilheiro', value: `<@${overview.artilheiro.discordId}> — ${overview.artilheiro.goals} gols`, inline: false });
          if (overview.garcom) embed.addFields({ name: '🎯 Garçom (mais assistências)', value: `<@${overview.garcom.discordId}> — ${overview.garcom.assists} assists`, inline: false });
          if (overview.melhorNota) embed.addFields({ name: '⭐ Melhor nota média', value: `<@${overview.melhorNota.discordId}> — ${notaTag(overview.melhorNota.notaMedia)}`, inline: false });

          // Elenco completo (individual) — corta se passar do limite de um
          // campo de embed do Discord (1024 caracteres).
          const linhasElenco = elenco.map((p, i) => `**${i + 1}.** <@${p.discordId}> — ${notaTag(p.notaMedia)} — ⚽${p.goals} 🅰️${p.assists} 🧤${p.defesas} — ${p.totalPartidas}J`);
          let elencoTxt = linhasElenco.join('\n');
          if (elencoTxt.length > 1000) elencoTxt = `${elencoTxt.slice(0, 990)}\n… (veja o elenco completo no site)`;
          embed.addFields({ name: `Elenco completo (${elenco.length})`, value: elencoTxt || '_sem dados_', inline: false });

          await interaction.reply({ embeds: [embed] });
          return;
        }
      }

      // ── /fut elenco ──────────────────────────────────────────────────
      if (group === 'elenco') {
        const clan = await resolveClan(interaction);

        if (sub === 'criar') {
          const nome = interaction.options.getString('nome', true);
          const cor = interaction.options.getString('cor') ?? undefined;
          const team = await createTeam(clan.id, interaction.user.id, nome, cor);
          await interaction.reply({ embeds: [successEmbed('Time criado!', `**${team.name}** agora faz parte do elenco do clã **${clan.name}**. Use \`/fut elenco definir\` pra colocar jogadores nele.`)] });
          return;
        }
        if (sub === 'deletar') {
          const nome = interaction.options.getString('nome', true);
          const teams = await listTeams(clan.id);
          const team = teams.find((t) => t.name.toLowerCase() === nome.trim().toLowerCase());
          if (!team) throw new FutError(`Não achei nenhum time chamado **${nome}** nesse clã.`);
          await deleteTeam(team.id, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed('Time deletado', `**${team.name}** foi removido do elenco.`)] });
          return;
        }
        if (sub === 'listar') {
          const teams = await listTeams(clan.id);
          if (!teams.length) { await interaction.reply({ embeds: [errorEmbed('Nenhum time interno ainda', 'Crie um com `/fut elenco criar`.')], ephemeral: true }); return; }
          const embed = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle(`👕 Elenco — ${clan.name}`);
          for (const t of teams) {
            embed.addFields({ name: `${t.name}${t.color ? ` (${t.color})` : ''} — ${t.members.length} jogador(es)`, value: t.members.length ? t.members.map((m) => m.displayName).join(', ') : '_vazio_' });
          }
          await interaction.reply({ embeds: [embed] });
          return;
        }
        if (sub === 'definir') {
          const nome = interaction.options.getString('nome');
          const ref = playerRefFrom(interaction);
          if (!ref.discordId && !ref.apelido) { await interaction.reply({ embeds: [errorEmbed('Faltou o jogador', 'Informe `jogador` ou `apelido`.')], ephemeral: true }); return; }

          let teamId: string | null = null;
          if (nome && nome.trim()) {
            const teams = await listTeams(clan.id);
            const team = teams.find((t) => t.name.toLowerCase() === nome.trim().toLowerCase());
            if (!team) throw new FutError(`Não achei nenhum time chamado **${nome}** nesse clã.`);
            teamId = team.id;
          }
          const member = await setMemberTeam(clan.id, ref, teamId);
          await interaction.reply({ embeds: [successEmbed('Elenco atualizado', teamId ? `**${member.displayName}** agora faz parte de um time interno do clã.` : `**${member.displayName}** saiu do time interno.`)] });
          return;
        }
      }

      // ── /fut partida ─────────────────────────────────────────────────
      if (group === 'partida') {
        if (sub === 'criar') {
          const clan = await resolveClan(interaction);
          const modo = interaction.options.getString('modo', true) as FutMode;
          const nome = interaction.options.getString('nome') ?? undefined;
          const partida = await createPartida(clan.id, interaction.user.id, interaction.user.username, modo, nome);
          await interaction.reply({ embeds: [successEmbed('Partida criada!', 'Use `/fut partida entrar` pra se inscrever. Quando estiver pronto, `/fut partida iniciar`.'), buildPartidaEmbed(partida, clan.name)] });
          return;
        }

        if (sub === 'historico') {
          const clan = await resolveClan(interaction);
          const partidas = await listPartidaHistory(clan.id, 10);
          if (!partidas.length) {
            await interaction.reply({ embeds: [errorEmbed('Sem histórico ainda', 'Nenhuma partida finalizada nesse clã ainda.')], ephemeral: true });
            return;
          }
          const lines = partidas.map((p) => {
            const resLabel = p.resultado === 'empate' ? 'Empate' : p.resultado === 'vitoria_a' ? 'Vitória A' : 'Vitória B';
            const data = p.finishedAt ? p.finishedAt.toLocaleDateString('pt-BR') : '';
            return `**${p.name || 'Partida'}** (${p.mode}) — ${p.scoreA}x${p.scoreB} — ${resLabel} — ${data}`;
          });
          const embed = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle(`📜 Histórico — ${clan.name}`).setDescription(lines.join('\n'));
          await interaction.reply({ embeds: [embed] });
          return;
        }

        if (sub === 'gols') {
          const clan = await resolveClan(interaction);
          const partidaAtual = await getOpenPartida(clan.id) ?? (await listPartidaHistory(clan.id, 1))[0];
          if (!partidaAtual) { await interaction.reply({ embeds: [errorEmbed('Nenhuma partida ainda', 'Esse clã ainda não tem nenhuma partida.')], ephemeral: true }); return; }
          const videos = await listGoalVideos(partidaAtual.id);
          if (!videos.length) { await interaction.reply({ embeds: [errorEmbed('Sem vídeos ainda', 'Nenhum gol com vídeo salvo nessa partida. Use `video:` ao registrar um gol.')], ephemeral: true }); return; }
          const embed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle(`🎬 Gols com vídeo — ${partidaAtual.name || 'Partida'}`)
            .setDescription(videos.map((v, i) => `**${i + 1}.** ${v.player?.displayName || 'Desconhecido'} — [assistir](${v.videoUrl})`).join('\n'));
          await interaction.reply({ embeds: [embed] });
          return;
        }

        if (sub === 'detalhes') {
          const clan = await resolveClan(interaction);
          const posicao = interaction.options.getInteger('posicao') ?? 1;
          const historico = await listPartidaHistory(clan.id, Math.max(posicao, 20));
          const alvo = historico[posicao - 1];
          if (!alvo) { await interaction.reply({ embeds: [errorEmbed('Não encontrada', `Não achei a partida #${posicao} do histórico. Veja \`/fut partida historico\`.`)], ephemeral: true }); return; }
          const siteUrl = process.env.DASHBOARD_URL || 'https://bryanfut.up.railway.app';
          const embed = buildPartidaEmbed(alvo, clan.name);
          embed.setFooter({ text: `Partida #${posicao} do histórico · edite/veja a animação dos gols no site` });
          const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('🌐 Ver/editar no site').setURL(`${siteUrl.replace(/\/$/, '')}/atividades/fut`),
          )];
          await interaction.reply({ embeds: [embed], components });
          return;
        }

        if (sub === 'reabrir') {
          const clan = await resolveClan(interaction);
          const posicao = interaction.options.getInteger('posicao') ?? 1;
          const historico = await listPartidaHistory(clan.id, Math.max(posicao, 20));
          const alvo = historico[posicao - 1];
          if (!alvo) { await interaction.reply({ embeds: [errorEmbed('Não encontrada', `Não achei a partida #${posicao} do histórico. Veja \`/fut partida historico\`.`)], ephemeral: true }); return; }
          const reaberta = await reopenPartida(alvo.id, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed('Partida reaberta!', 'As estatísticas dela foram revertidas do clã. Corrija o que precisar (`gol`, `defesa`, `desfazer`, `time`, etc.) e finalize de novo com `/fut partida finalizar` quando terminar.'), buildPartidaEmbed(reaberta, clan.name)] });
          return;
        }

        const clan = await resolveClan(interaction);
        const partida = await getOpenPartida(clan.id);
        if (!partida && sub !== 'deletar') {
          await interaction.reply({ embeds: [errorEmbed('Nenhuma partida em aberto', `Crie uma com \`/fut partida criar cla:${clan.name}\`.`)], ephemeral: true });
          return;
        }

        if (sub === 'deletar') {
          if (!partida) { await interaction.reply({ embeds: [errorEmbed('Nenhuma partida em aberto', 'Não tem nada pra deletar.')], ephemeral: true }); return; }
          await deletePartida(partida.id, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed('Partida deletada', 'A partida em aberto foi apagada.')] });
          return;
        }

        if (sub === 'entrar') {
          const posicao = interaction.options.getString('posicao') ?? undefined;
          await joinPartida(partida!.id, interaction.user.id, interaction.user.username, posicao);
          await interaction.reply({ embeds: [buildPartidaEmbed(await getPartidaById(partida!.id), clan.name)] });
          return;
        }

        if (sub === 'adicionar') {
          const apelido = interaction.options.getString('apelido', true);
          const posicao = interaction.options.getString('posicao') ?? undefined;
          await addOfflinePlayer(partida!.id, apelido, posicao);
          await interaction.reply({ embeds: [buildPartidaEmbed(await getPartidaById(partida!.id), clan.name)] });
          return;
        }

        if (sub === 'time') {
          const time = interaction.options.getString('time', true) as 'A' | 'B';
          const ref = playerRefFrom(interaction);
          if (!ref.discordId && !ref.apelido) { await interaction.reply({ embeds: [errorEmbed('Faltou o jogador', 'Informe `jogador` ou `apelido`.')], ephemeral: true }); return; }
          await setTeam(partida!.id, ref, time);
          await interaction.reply({ embeds: [buildPartidaEmbed(await getPartidaById(partida!.id), clan.name)] });
          return;
        }

        if (sub === 'auto_equilibrar') {
          const balanced = await autoBalanceTeams(partida!.id, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed('Times equilibrados!', 'Distribuí com base no XP de cada um nesse modo.'), buildPartidaEmbed(balanced, clan.name)] });
          return;
        }

        if (sub === 'iniciar') {
          const started = await startPartida(partida!.id, interaction.user.id);
          await interaction.reply({ embeds: [successEmbed('Partida iniciada!', 'Já dá pra registrar `gol`, `defesa`, `concedido` e `erro`.'), buildPartidaEmbed(started, clan.name)] });
          return;
        }

        if (sub === 'gol' || sub === 'defesa' || sub === 'concedido' || sub === 'erro') {
          const ref = playerRefFrom(interaction);
          if (!ref.discordId && !ref.apelido) { await interaction.reply({ embeds: [errorEmbed('Faltou o jogador', 'Informe `jogador` ou `apelido`.')], ephemeral: true }); return; }

          let assistRef: { discordId?: string; apelido?: string } | undefined;
          let videoUrl: string | undefined;
          if (sub === 'gol') {
            const assistUser = interaction.options.getUser('assistencia_de');
            const assistApelido = interaction.options.getString('assistencia_apelido');
            if (assistUser || assistApelido) assistRef = { discordId: assistUser?.id, apelido: assistApelido ?? undefined };
            videoUrl = interaction.options.getString('video') ?? undefined;
          }

          const { player, assistPlayer } = await recordEvent(partida!.id, ref, sub as FutEventType, assistRef, videoUrl);
          const labelMap: Record<string, string> = { gol: '⚽ Gol', defesa: '🧤 Defesa', concedido: '🥅 Gol concedido', erro: '⚠️ Erro grave' };
          let desc = `${labelMap[sub]} de **${player.displayName}**`;
          if (assistPlayer) desc += ` (assistência de **${assistPlayer.displayName}**)`;
          if (videoUrl) desc += `\n🎬 [Ver vídeo](${videoUrl})`;
          if (sub === 'gol') desc += `\n🎬 Monte a animação desse gol no site (pós-partida), em Histórico.`;
          await interaction.reply({ embeds: [successEmbed('Evento registrado', desc), buildPartidaEmbed(await getPartidaById(partida!.id), clan.name)] });
          return;
        }

        if (sub === 'desfazer') {
          const desfeito = await undoLastEvent(partida!.id, interaction.user.id);
          const labelMap: Record<string, string> = { gol: 'gol', assistencia: 'assistência', defesa: 'defesa', concedido: 'gol concedido', erro: 'erro grave' };
          await interaction.reply({ embeds: [successEmbed('Evento desfeito', `Removi o último evento (**${labelMap[desfeito.type] || desfeito.type}** de **${desfeito.player.displayName}**).`), buildPartidaEmbed(await getPartidaById(partida!.id), clan.name)] });
          return;
        }

        if (sub === 'placar') {
          await interaction.reply({ embeds: [buildPartidaEmbed(partida, clan.name)] });
          return;
        }

        if (sub === 'finalizar') {
          const resultado = interaction.options.getString('resultado') as 'vitoria_a' | 'vitoria_b' | 'empate' | null;
          const finished = await finishPartida(partida!.id, interaction.user.id, resultado ?? undefined);
          const resultLabel = finished.resultado === 'empate' ? 'Empate' : finished.resultado === 'vitoria_a' ? 'Vitória do Time A' : 'Vitória do Time B';
          await interaction.reply({ embeds: [successEmbed('Partida finalizada!', `**${resultLabel}** — placar final **${finished.scoreA} x ${finished.scoreB}**.\nEstatísticas de quem tem conta vinculada foram salvas no clã (modo ${finished.mode}).`), buildPartidaEmbed(finished, clan.name)] });
          return;
        }
      }

      // ── /fut perfil / ranking (sem grupo) ────────────────────────────
      if (sub === 'perfil') {
        const clan = await resolveClan(interaction);
        const modo = interaction.options.getString('modo', true) as FutMode;
        const target = interaction.options.getUser('usuario') ?? interaction.user;
        const [profile, userProfile] = await Promise.all([getProfile(clan.id, target.id, modo), getUserProfile(target.id)]);
        const posicao = (modo === 'futsal' ? userProfile?.positionFutsal : userProfile?.positionCampo) || 'Não definida';

        if (!profile) {
          await interaction.reply({ embeds: [errorEmbed('Sem estatísticas ainda', `${target.username} ainda não finalizou nenhuma partida de ${modo} nesse clã.\nPosição preferida: **${posicao}**.`)], ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle(`⚽ Perfil de ${target.username} — ${clan.name} (${modo})`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'Posição', value: posicao, inline: true },
            { name: 'Nota média', value: notaTag(profile.notaMedia), inline: true },
            { name: 'Partidas', value: `${profile.totalPartidas}`, inline: true },
            { name: 'V / D / E', value: `${profile.vitorias} / ${profile.derrotas} / ${profile.empates}`, inline: true },
            { name: 'XP', value: `${profile.xp}`, inline: true },
            { name: 'Gols', value: `${profile.goals}`, inline: true },
            { name: 'Assistências', value: `${profile.assists}`, inline: true },
            { name: 'Defesas', value: `${profile.defesas}`, inline: true },
            { name: 'Gols Concedidos', value: `${profile.golsConcedidos}`, inline: true },
            { name: 'Erros Graves', value: `${profile.errosGraves}`, inline: true },
          );
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'chamar') {
        const clan = await resolveClan(interaction);
        const local = interaction.options.getString('local', true);
        const horario = interaction.options.getString('horario', true);
        const pix = interaction.options.getString('pix') ?? undefined;
        const link = interaction.options.getString('link') ?? undefined;
        const mensagem = interaction.options.getString('mensagem') ?? undefined;

        const chamada = await createChamada(clan.id, interaction.user.id, { local, horario, pix, link, mensagem });

        const embed = new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle(`📣 Vai ter fut! — ${clan.name}`)
          .setDescription(mensagem || `${interaction.user.username} tá chamando o pessoal pra jogar!`)
          .addFields(
            { name: '📍 Local', value: local, inline: true },
            { name: '🕒 Horário', value: horario, inline: true },
          );
        if (pix) embed.addFields({ name: '💸 PIX (dividir a quadra)', value: `\`${pix}\``, inline: false });
        if (link) embed.addFields({ name: '🔗 Link', value: link, inline: false });
        embed.setFooter({ text: `Confirme presença com /fut confirmar cla:${clan.name}` });

        // Mesma variável usada pro OAuth do dashboard (src/dashboard/server.ts) —
        // um único lugar define o domínio do site pra tudo (login, /fut, etc).
        const siteUrl = process.env.DASHBOARD_URL || 'https://bryanfut.up.railway.app';
        const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('📣 Confirmar no site').setURL(`${siteUrl.replace(/\/$/, '')}/atividades/fut`),
        )];

        await interaction.reply({ embeds: [embed], components });
        return;
      }

      if (sub === 'chamadas') {
        const clan = await resolveClan(interaction);
        const chamadas = await listChamadas(clan.id, 5);
        if (!chamadas.length) { await interaction.reply({ embeds: [errorEmbed('Nenhuma chamada ainda', 'Use `/fut chamar` pra marcar um fut.')], ephemeral: true }); return; }

        const embed = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle(`📣 Últimas chamadas — ${clan.name}`);
        for (const c of chamadas) {
          const vou = c.respostas.filter((r) => r.status === 'vou').length;
          const talvez = c.respostas.filter((r) => r.status === 'talvez').length;
          const naoVou = c.respostas.filter((r) => r.status === 'nao_vou').length;
          embed.addFields({
            name: `${c.local} — ${c.horario}`,
            value: `✅ ${vou} vão · 🤔 ${talvez} talvez · ❌ ${naoVou} não vão`,
          });
        }
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'confirmar') {
        const clan = await resolveClan(interaction);
        const status = interaction.options.getString('status', true) as FutRsvpStatus;
        const chamadas = await listChamadas(clan.id, 1);
        if (!chamadas.length) { await interaction.reply({ embeds: [errorEmbed('Nenhuma chamada ainda', 'Ninguém chamou o fut nesse clã ainda.')], ephemeral: true }); return; }

        await respondChamada(chamadas[0].id, interaction.user.id, interaction.user.username, status);
        const labelMap: Record<FutRsvpStatus, string> = { vou: '✅ Você confirmou presença!', talvez: '🤔 Você marcou como talvez.', nao_vou: '❌ Você marcou que não vai.' };
        await interaction.reply({ embeds: [successEmbed('Resposta registrada', labelMap[status])], ephemeral: true });
        return;
      }

      if (sub === 'posicao') {
        const modo = interaction.options.getString('modo', true) as FutMode;
        const posicao = interaction.options.getString('posicao', true);
        await setUserPosition(interaction.user.id, modo, posicao);
        await interaction.reply({ embeds: [successEmbed('Posição salva!', `Sua posição preferida de **${modo}** agora é **${posicao}**. Ela é usada como padrão sempre que você entra numa partida (mas dá pra sobrescrever na hora, se quiser).`)], ephemeral: true });
        return;
      }

      if (sub === 'ranking') {
        const clan = await resolveClan(interaction);
        const modo = interaction.options.getString('modo', true) as FutMode;
        const ranking = await getRanking(clan.id, modo, 10);
        if (!ranking.length) { await interaction.reply({ embeds: [errorEmbed('Ranking vazio', `Ninguém finalizou uma partida de ${modo} nesse clã ainda.`)], ephemeral: true }); return; }
        const lines = await Promise.all(ranking.map(async (p, i) => {
          const user = await interaction.client.users.fetch(p.discordId).catch(() => null);
          return `**${i + 1}.** ${user ? user.username : p.discordId} — ${p.xp} XP — ${notaTag(p.notaMedia)} (${p.vitorias}V/${p.derrotas}D/${p.empates}E, ⚽${p.goals})`;
        }));
        const embed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle(`🏆 Ranking — ${clan.name} (${modo})`).setDescription(lines.join('\n'));
        await interaction.reply({ embeds: [embed] });
        return;
      }
    } catch (err) {
      if (err instanceof FutError) {
        await interaction.reply({ embeds: [errorEmbed('Rachão', err.message)], ephemeral: true });
        return;
      }
      console.error('[Rachão] Erro inesperado:', err);
      await interaction.reply({ embeds: [errorEmbed('Erro', 'Alguma coisa deu errado. Tenta de novo.')], ephemeral: true });
    }
  },
} as Command;
