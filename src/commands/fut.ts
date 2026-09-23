// ═══════════════════════════════════════════════════════════════════════
// COMANDO /fut — Sistema "Rachão" (fase 1: núcleo de pelada + estatísticas)
// ═══════════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types';
import { errorEmbed, successEmbed, COLORS } from '../utils/embeds';
import {
  FutError,
  createPelada,
  getOpenPelada,
  getPeladaById,
  joinPelada,
  addOfflinePlayer,
  setTeam,
  startPelada,
  recordEvent,
  finishPelada,
  getProfile,
  getRanking,
  type FutEventType,
} from '../fut/services/pelada';

function playerRefFrom(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('jogador');
  const apelido = interaction.options.getString('apelido');
  return { discordId: user?.id, apelido: apelido ?? undefined };
}

function buildPeladaEmbed(pelada: Awaited<ReturnType<typeof getPeladaById>>) {
  if (!pelada) return errorEmbed('Pelada não encontrada.');

  const timeA = pelada.players.filter((p) => p.team === 'A');
  const timeB = pelada.players.filter((p) => p.team === 'B');
  const semTime = pelada.players.filter((p) => !p.team);

  const statusLabel = pelada.status === 'aberta' ? '🟡 Aberta (inscrições)' : pelada.status === 'em_andamento' ? '🟢 Em andamento' : '🔴 Finalizada';

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`⚽ ${pelada.name || 'Rachão'}`)
    .setDescription(`**Modo:** ${pelada.mode === 'futsal' ? 'Futsal' : 'Campo'}\n**Status:** ${statusLabel}`)
    .addFields(
      { name: `Time A (${timeA.length})`, value: timeA.length ? timeA.map((p) => `${p.displayName} — ⚽${p.goals} 🅰️${p.assists}`).join('\n') : '_vazio_', inline: true },
      { name: `Time B (${timeB.length})`, value: timeB.length ? timeB.map((p) => `${p.displayName} — ⚽${p.goals} 🅰️${p.assists}`).join('\n') : '_vazio_', inline: true },
    );

  if (semTime.length) {
    embed.addFields({ name: 'Sem time definido', value: semTime.map((p) => p.displayName).join(', ') });
  }

  if (pelada.status !== 'aberta') {
    embed.addFields({ name: 'Placar', value: `**${pelada.scoreA} x ${pelada.scoreB}**` });
  }

  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('fut')
    .setDescription('⚽ Sistema de Rachão — organize peladas e registre estatísticas')
    .addSubcommand((sub) => sub
      .setName('criar')
      .setDescription('Cria uma nova pelada neste servidor')
      .addStringOption((o) => o.setName('modo').setDescription('Futsal ou campo').setRequired(true)
        .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' }))
      .addStringOption((o) => o.setName('nome').setDescription('Nome da pelada (opcional)')))
    .addSubcommand((sub) => sub
      .setName('entrar')
      .setDescription('Entra na pelada aberta atual')
      .addStringOption((o) => o.setName('posicao').setDescription('Sua posição (opcional)')))
    .addSubcommand((sub) => sub
      .setName('adicionar')
      .setDescription('Adiciona um jogador sem conta no Discord (offline)')
      .addStringOption((o) => o.setName('apelido').setDescription('Apelido do jogador').setRequired(true))
      .addStringOption((o) => o.setName('posicao').setDescription('Posição do jogador (opcional)')))
    .addSubcommand((sub) => sub
      .setName('time')
      .setDescription('Define o time (A ou B) de um jogador da pelada')
      .addStringOption((o) => o.setName('time').setDescription('Time').setRequired(true)
        .addChoices({ name: 'Time A', value: 'A' }, { name: 'Time B', value: 'B' }))
      .addUserOption((o) => o.setName('jogador').setDescription('Jogador com conta no Discord'))
      .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)')))
    .addSubcommand((sub) => sub
      .setName('iniciar')
      .setDescription('Inicia a pelada (fecha as inscrições)'))
    .addSubcommand((sub) => sub
      .setName('gol')
      .setDescription('Registra um gol')
      .addUserOption((o) => o.setName('jogador').setDescription('Quem fez o gol'))
      .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)'))
      .addUserOption((o) => o.setName('assistencia_de').setDescription('Quem deu a assistência (opcional)'))
      .addStringOption((o) => o.setName('assistencia_apelido').setDescription('Apelido de quem assistiu (opcional)')))
    .addSubcommand((sub) => sub
      .setName('defesa')
      .setDescription('Registra uma defesa')
      .addUserOption((o) => o.setName('jogador').setDescription('Quem defendeu'))
      .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)')))
    .addSubcommand((sub) => sub
      .setName('concedido')
      .setDescription('Registra um gol concedido (sofrido)')
      .addUserOption((o) => o.setName('jogador').setDescription('Quem sofreu o gol'))
      .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)')))
    .addSubcommand((sub) => sub
      .setName('erro')
      .setDescription('Registra um erro grave / lance ruim')
      .addUserOption((o) => o.setName('jogador').setDescription('Quem errou'))
      .addStringOption((o) => o.setName('apelido').setDescription('Apelido (jogador offline)')))
    .addSubcommand((sub) => sub
      .setName('placar')
      .setDescription('Mostra o placar e estatísticas da pelada atual'))
    .addSubcommand((sub) => sub
      .setName('finalizar')
      .setDescription('Finaliza a pelada e salva as estatísticas de todo mundo')
      .addStringOption((o) => o.setName('resultado').setDescription('Forçar um resultado (opcional — por padrão usa o placar)')
        .addChoices({ name: 'Vitória Time A', value: 'vitoria_a' }, { name: 'Vitória Time B', value: 'vitoria_b' }, { name: 'Empate', value: 'empate' })))
    .addSubcommand((sub) => sub
      .setName('perfil')
      .setDescription('Mostra suas estatísticas gerais de Rachão')
      .addUserOption((o) => o.setName('usuario').setDescription('Ver o perfil de outra pessoa (opcional)')))
    .addSubcommand((sub) => sub
      .setName('ranking')
      .setDescription('Mostra o ranking de Rachão do servidor')),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      if (sub === 'criar') {
        const modo = interaction.options.getString('modo', true) as 'futsal' | 'campo';
        const nome = interaction.options.getString('nome') ?? undefined;
        const pelada = await createPelada(guildId, interaction.user.id, interaction.user.username, modo, nome);
        await interaction.reply({ embeds: [successEmbed('Pelada criada!', `Use \`/fut entrar\` pra se inscrever, ou \`/fut adicionar\` pra colocar gente sem Discord. Quando estiver pronto, \`/fut iniciar\`.`), buildPeladaEmbed(pelada)] });
        return;
      }

      const pelada = await getOpenPelada(guildId);
      if (!pelada) {
        await interaction.reply({ embeds: [errorEmbed('Nenhuma pelada em aberto', 'Crie uma com `/fut criar` primeiro.')], ephemeral: true });
        return;
      }

      if (sub === 'entrar') {
        const posicao = interaction.options.getString('posicao') ?? undefined;
        await joinPelada(pelada.id, interaction.user.id, interaction.user.username, posicao);
        const updated = await getPeladaById(pelada.id);
        await interaction.reply({ embeds: [buildPeladaEmbed(updated)] });
        return;
      }

      if (sub === 'adicionar') {
        const apelido = interaction.options.getString('apelido', true);
        const posicao = interaction.options.getString('posicao') ?? undefined;
        await addOfflinePlayer(pelada.id, apelido, posicao);
        const updated = await getPeladaById(pelada.id);
        await interaction.reply({ embeds: [buildPeladaEmbed(updated)] });
        return;
      }

      if (sub === 'time') {
        const time = interaction.options.getString('time', true) as 'A' | 'B';
        const ref = playerRefFrom(interaction);
        if (!ref.discordId && !ref.apelido) {
          await interaction.reply({ embeds: [errorEmbed('Faltou o jogador', 'Informe `jogador` (menção) ou `apelido`.')], ephemeral: true });
          return;
        }
        await setTeam(pelada.id, ref, time);
        const updated = await getPeladaById(pelada.id);
        await interaction.reply({ embeds: [buildPeladaEmbed(updated)] });
        return;
      }

      if (sub === 'iniciar') {
        const started = await startPelada(pelada.id, interaction.user.id);
        await interaction.reply({ embeds: [successEmbed('Pelada iniciada!', 'Já dá pra registrar `/fut gol`, `/fut defesa`, `/fut concedido` e `/fut erro`.'), buildPeladaEmbed(started)] });
        return;
      }

      if (sub === 'gol' || sub === 'defesa' || sub === 'concedido' || sub === 'erro') {
        const ref = playerRefFrom(interaction);
        if (!ref.discordId && !ref.apelido) {
          await interaction.reply({ embeds: [errorEmbed('Faltou o jogador', 'Informe `jogador` (menção) ou `apelido`.')], ephemeral: true });
          return;
        }

        let assistRef: { discordId?: string; apelido?: string } | undefined;
        if (sub === 'gol') {
          const assistUser = interaction.options.getUser('assistencia_de');
          const assistApelido = interaction.options.getString('assistencia_apelido');
          if (assistUser || assistApelido) assistRef = { discordId: assistUser?.id, apelido: assistApelido ?? undefined };
        }

        const { player, assistPlayer } = await recordEvent(pelada.id, ref, sub as FutEventType, assistRef);
        const labelMap: Record<string, string> = { gol: '⚽ Gol', defesa: '🧤 Defesa', concedido: '🥅 Gol concedido', erro: '⚠️ Erro grave' };
        let desc = `${labelMap[sub]} de **${player.displayName}**`;
        if (assistPlayer) desc += ` (assistência de **${assistPlayer.displayName}**)`;

        const updated = await getPeladaById(pelada.id);
        await interaction.reply({ embeds: [successEmbed('Evento registrado', desc), buildPeladaEmbed(updated)] });
        return;
      }

      if (sub === 'placar') {
        await interaction.reply({ embeds: [buildPeladaEmbed(pelada)] });
        return;
      }

      if (sub === 'finalizar') {
        const resultado = interaction.options.getString('resultado') as 'vitoria_a' | 'vitoria_b' | 'empate' | null;
        const finished = await finishPelada(pelada.id, interaction.user.id, resultado ?? undefined);
        const resultLabel = finished.resultado === 'empate' ? 'Empate' : finished.resultado === 'vitoria_a' ? 'Vitória do Time A' : 'Vitória do Time B';
        await interaction.reply({ embeds: [successEmbed('Pelada finalizada!', `**${resultLabel}** — placar final **${finished.scoreA} x ${finished.scoreB}**.\nEstatísticas de todo mundo com conta vinculada foram salvas no perfil.`), buildPeladaEmbed(finished)] });
        return;
      }

      if (sub === 'perfil') {
        const target = interaction.options.getUser('usuario') ?? interaction.user;
        const profile = await getProfile(guildId, target.id);
        if (!profile) {
          await interaction.reply({ embeds: [errorEmbed('Sem estatísticas ainda', `${target.username} ainda não finalizou nenhuma pelada.`)], ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle(`⚽ Perfil de Rachão — ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'Peladas', value: `${profile.totalPeladas}`, inline: true },
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
        const ranking = await getRanking(guildId, 10);
        if (!ranking.length) {
          await interaction.reply({ embeds: [errorEmbed('Ranking vazio', 'Ninguém finalizou uma pelada ainda neste servidor.')], ephemeral: true });
          return;
        }
        const lines = await Promise.all(ranking.map(async (p, i) => {
          const user = await interaction.client.users.fetch(p.discordId).catch(() => null);
          return `**${i + 1}.** ${user ? user.username : p.discordId} — ${p.xp} XP (${p.vitorias}V/${p.derrotas}D/${p.empates}E, ⚽${p.goals})`;
        }));
        const embed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle('🏆 Ranking de Rachão').setDescription(lines.join('\n'));
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
