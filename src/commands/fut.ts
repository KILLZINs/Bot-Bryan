// ═══════════════════════════════════════════════════════════════════════
// COMANDO /fut — Sistema "Rachão" (fase 2: clãs + partidas por modo)
// ═══════════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types';
import { errorEmbed, successEmbed, COLORS } from '../utils/embeds';
import {
  FutError,
  createClan, joinClan, listClans, getClanByName, deleteClan,
  createPartida, getOpenPartida, getPartidaById, deletePartida, listPartidaHistory,
  joinPartida, addOfflinePlayer, setTeam, autoBalanceTeams, startPartida, recordEvent, finishPartida,
  getProfile, getRanking,
  type FutEventType, type FutMode,
} from '../fut/services/pelada';

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

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`⚽ ${partida.name || 'Partida'} — clã ${clanName}`)
    .setDescription(`**Modo:** ${partida.mode === 'futsal' ? 'Futsal' : 'Campo'}\n**Status:** ${statusLabel}`)
    .addFields(
      { name: `Time A (${timeA.length})`, value: timeA.length ? timeA.map((p) => `${p.displayName} — ⚽${p.goals} 🅰️${p.assists}`).join('\n') : '_vazio_', inline: true },
      { name: `Time B (${timeB.length})`, value: timeB.length ? timeB.map((p) => `${p.displayName} — ⚽${p.goals} 🅰️${p.assists}`).join('\n') : '_vazio_', inline: true },
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
        .addStringOption((o) => o.setName('nome').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('entrar').setDescription('Entra em um clã existente')
        .addStringOption((o) => o.setName('nome').setDescription('Nome do clã').setRequired(true)))
      .addSubcommand((sub) => sub.setName('listar').setDescription('Lista os clãs deste servidor'))
      .addSubcommand((sub) => sub.setName('deletar').setDescription('Deleta um clã (só quem criou)')
        .addStringOption((o) => o.setName('nome').setDescription('Nome do clã').setRequired(true))))
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
        .addStringOption((o) => o.setName('assistencia_apelido').setDescription('Apelido de quem assistiu (opcional)')))
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
        .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' }))),

  async execute(interaction: ChatInputCommandInteraction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      // ── /fut cla ─────────────────────────────────────────────────────
      if (group === 'cla') {
        if (sub === 'criar') {
          const nome = interaction.options.getString('nome', true);
          const clan = await createClan(guildId, interaction.user.id, interaction.user.username, nome);
          await interaction.reply({ embeds: [successEmbed('Clã criado!', `**${clan.name}** — use \`/fut partida criar\` pra começar uma partida.`)] });
          return;
        }
        if (sub === 'entrar') {
          const nome = interaction.options.getString('nome', true);
          const clan = await getClanByName(guildId, nome);
          if (!clan) throw new FutError(`Não achei nenhum clã chamado **${nome}**.`);
          await joinClan(clan.id, interaction.user.id, interaction.user.username);
          await interaction.reply({ embeds: [successEmbed('Você entrou no clã!', `Bem-vindo ao **${clan.name}**.`)] });
          return;
        }
        if (sub === 'listar') {
          const clans = await listClans(guildId);
          if (!clans.length) {
            await interaction.reply({ embeds: [errorEmbed('Nenhum clã ainda', 'Crie um com `/fut cla criar`.')], ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle('⚽ Clãs do servidor')
            .setDescription(clans.map((c) => `**${c.name}** — ${c.members.length} membro(s)`).join('\n'));
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
          if (sub === 'gol') {
            const assistUser = interaction.options.getUser('assistencia_de');
            const assistApelido = interaction.options.getString('assistencia_apelido');
            if (assistUser || assistApelido) assistRef = { discordId: assistUser?.id, apelido: assistApelido ?? undefined };
          }

          const { player, assistPlayer } = await recordEvent(partida!.id, ref, sub as FutEventType, assistRef);
          const labelMap: Record<string, string> = { gol: '⚽ Gol', defesa: '🧤 Defesa', concedido: '🥅 Gol concedido', erro: '⚠️ Erro grave' };
          let desc = `${labelMap[sub]} de **${player.displayName}**`;
          if (assistPlayer) desc += ` (assistência de **${assistPlayer.displayName}**)`;
          await interaction.reply({ embeds: [successEmbed('Evento registrado', desc), buildPartidaEmbed(await getPartidaById(partida!.id), clan.name)] });
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
        const profile = await getProfile(clan.id, target.id, modo);
        if (!profile) { await interaction.reply({ embeds: [errorEmbed('Sem estatísticas ainda', `${target.username} ainda não finalizou nenhuma partida de ${modo} nesse clã.`)], ephemeral: true }); return; }
        const embed = new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle(`⚽ Perfil de ${target.username} — ${clan.name} (${modo})`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
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

      if (sub === 'ranking') {
        const clan = await resolveClan(interaction);
        const modo = interaction.options.getString('modo', true) as FutMode;
        const ranking = await getRanking(clan.id, modo, 10);
        if (!ranking.length) { await interaction.reply({ embeds: [errorEmbed('Ranking vazio', `Ninguém finalizou uma partida de ${modo} nesse clã ainda.`)], ephemeral: true }); return; }
        const lines = await Promise.all(ranking.map(async (p, i) => {
          const user = await interaction.client.users.fetch(p.discordId).catch(() => null);
          return `**${i + 1}.** ${user ? user.username : p.discordId} — ${p.xp} XP (${p.vitorias}V/${p.derrotas}D/${p.empates}E, ⚽${p.goals})`;
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
