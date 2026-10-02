// ═══════════════════════════════════════════════════════════════════════
// COMANDO /fut — Sistema "Rachão"
// ═══════════════════════════════════════════════════════════════════════
// Gerenciar clã/elenco/partida (criar, times, gols, finalizar, ranking,
// leaderboard etc.) virou tudo Activity no site — fica mais rápido e visual
// por lá do que digitando opção por opção aqui. Este comando ficou só com o
// que faz sentido continuar sendo um comando rápido de Discord: avisar que
// vai ter fut, responder presença, ver os gols com vídeo e conferir
// stats/ranque sem precisar abrir o navegador.

import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../types';
import { errorEmbed, successEmbed, COLORS } from '../utils/embeds';
import {
  FutError, getClanByName, listClans,
  getOpenPartida, listPartidaHistory,
  getProfile, getUserProfile, listGoalVideos, notaBand,
  createChamada, listChamadas, respondChamada, calcValorPorPessoa,
  getRankTier, getPlayerSkillRanks,
  type FutMode, type FutRsvpStatus,
} from '../fut/services/pelada';

// Mesma faixa (notaBand) usada no site, só que como emoji colorido — pra
// bater a mesma cor pro mesmo número nos dois lugares.
const NOTA_EMOJI: Record<ReturnType<typeof notaBand>, string> = { ruim: '🟥', mediano: '🟧', bom: '🟩', excelente: '🟨' };
function notaTag(nota: number): string {
  return `${NOTA_EMOJI[notaBand(nota)]} ${nota.toFixed(1)}`;
}

async function resolveClan(interaction: ChatInputCommandInteraction) {
  const nome = interaction.options.getString('cla', true);
  const clan = await getClanByName(interaction.guildId!, nome);
  if (!clan) throw new FutError(`Não achei nenhum clã chamado **${nome}** neste servidor. Crie um pela Activity (Atividades → Rachão) primeiro.`);
  return clan;
}

export default {
  data: new SlashCommandBuilder()
    .setName('fut')
    .setDescription('⚽ Rachão — chame o fut, confirme presença e veja suas stats (o resto é na Activity do site)')
    .addSubcommand((sub) => sub.setName('chamar').setDescription('Chama o fut! Anuncia local, horário, PIX e link pro clã')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('local').setDescription('Onde vai ser').setRequired(true))
      .addStringOption((o) => o.setName('horario').setDescription('Quando (ex: "Hoje 20h", "Sáb 09/08 16h")').setRequired(true))
      .addStringOption((o) => o.setName('pix').setDescription('Chave PIX pra dividir a quadra (opcional)'))
      .addNumberOption((o) => o.setName('valor_total').setDescription('Valor total da quadra, dividido entre os confirmados (opcional)').setMinValue(0))
      .addStringOption((o) => o.setName('link').setDescription('Link do grupo/WhatsApp/outra plataforma (opcional)'))
      .addStringOption((o) => o.setName('mensagem').setDescription('Mensagem extra (opcional)')))
    .addSubcommand((sub) => sub.setName('chamadas').setDescription('Mostra as últimas chamadas do clã e quem confirmou')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('confirmar').setDescription('Confirma presença na última chamada do clã')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('status').setDescription('Sua resposta').setRequired(true)
        .addChoices({ name: '✅ Vou', value: 'vou' }, { name: '🤔 Talvez', value: 'talvez' }, { name: '❌ Não vou', value: 'nao_vou' })))
    .addSubcommand((sub) => sub.setName('perfil').setDescription('Mostra suas estatísticas num clã')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('modo').setDescription('Futsal ou campo').setRequired(true)
        .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' }))
      .addUserOption((o) => o.setName('usuario').setDescription('Ver o perfil de outra pessoa (opcional)')))
    .addSubcommand((sub) => sub.setName('ranque').setDescription('Mostra o ranque (tier estilo FIFA) oficial e por habilidade de alguém')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('modo').setDescription('Futsal ou campo').setRequired(true)
        .addChoices({ name: 'Futsal', value: 'futsal' }, { name: 'Campo', value: 'campo' }))
      .addUserOption((o) => o.setName('usuario').setDescription('Ver o ranque de outra pessoa (opcional)')))
    .addSubcommand((sub) => sub.setName('gols').setDescription('Lista/compartilha os gols com vídeo da partida mais recente do clã')
      .addStringOption((o) => o.setName('cla').setDescription('Nome do clã').setRequired(true).setAutocomplete(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    try {
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
            { name: 'Desarmes', value: `${profile.desarmes}`, inline: true },
            { name: 'Boas Jogadas', value: `${profile.boasJogadas}`, inline: true },
            { name: 'Bloqueios', value: `${profile.bloqueios}`, inline: true },
            { name: 'Falhas Defensivas', value: `${profile.falhasDefensivas}`, inline: true },
            { name: 'Falhas Ofensivas', value: `${profile.falhasOfensivas}`, inline: true },
          );
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'ranque') {
        const clan = await resolveClan(interaction);
        const modo = interaction.options.getString('modo', true) as FutMode;
        const target = interaction.options.getUser('usuario') ?? interaction.user;
        const profile = await getProfile(clan.id, target.id, modo);

        if (!profile || !profile.totalPartidas) {
          await interaction.reply({ embeds: [errorEmbed('Sem ranque ainda', `${target.username} ainda não finalizou nenhuma partida de ${modo} nesse clã — o ranque só aparece depois da primeira partida.`)], ephemeral: true });
          return;
        }

        const oficial = getRankTier(profile.notaMedia);
        const skills = getPlayerSkillRanks(profile);
        const embed = new EmbedBuilder()
          .setColor(oficial.color as `#${string}`)
          .setTitle(`${oficial.icon} Ranque de ${target.username} — ${clan.name} (${modo})`)
          .setDescription(`**Ranque Oficial:** ${oficial.icon} **${oficial.name}** — nota média ${notaTag(profile.notaMedia)}`)
          .addFields((skills ?? []).map((s) => ({ name: `${s.tier.icon} ${s.label}`, value: `${s.tier.name} _(${s.rate.toFixed(2)}/partida)_`, inline: true })))
          .setFooter({ text: `${profile.totalPartidas} partida(s) jogada(s) nesse clã/modo` });
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'gols') {
        const clan = await resolveClan(interaction);
        const partidaAtual = await getOpenPartida(clan.id) ?? (await listPartidaHistory(clan.id, 1))[0];
        if (!partidaAtual) { await interaction.reply({ embeds: [errorEmbed('Nenhuma partida ainda', 'Esse clã ainda não tem nenhuma partida.')], ephemeral: true }); return; }
        const videos = await listGoalVideos(partidaAtual.id);
        if (!videos.length) { await interaction.reply({ embeds: [errorEmbed('Sem vídeos ainda', 'Nenhum gol com vídeo salvo nessa partida ainda. Registre o vídeo pela Activity (Atividades → Rachão) ao marcar o gol.')], ephemeral: true }); return; }
        const embed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle(`🎬 Gols com vídeo — ${partidaAtual.name || 'Partida'}`)
          .setDescription(videos.map((v, i) => `**${i + 1}.** ${v.player?.displayName || 'Desconhecido'} — [assistir](${v.videoUrl})`).join('\n'));
        await interaction.reply({ embeds: [embed] });
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
          const valorPorPessoa = calcValorPorPessoa(c.valorTotal, vou);
          embed.addFields({
            name: `${c.local} — ${c.horario}`,
            value: `✅ ${vou} vão · 🤔 ${talvez} talvez · ❌ ${naoVou} não vão${valorPorPessoa ? `\n💰 R$ ${valorPorPessoa.toFixed(2)} por pessoa (de R$ ${c.valorTotal!.toFixed(2)})` : ''}`,
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
        let desc = labelMap[status];
        if (status === 'vou' && chamadas[0].valorTotal) {
          const atualizada = await listChamadas(clan.id, 1);
          const vou = atualizada[0].respostas.filter((r) => r.status === 'vou').length;
          const valorPorPessoa = calcValorPorPessoa(atualizada[0].valorTotal, vou);
          if (valorPorPessoa) desc += `\n💰 Com você, dá R$ ${valorPorPessoa.toFixed(2)} por pessoa.`;
        }
        await interaction.reply({ embeds: [successEmbed('Resposta registrada', desc)], ephemeral: true });
        return;
      }

      if (sub === 'chamar') {
        const clan = await resolveClan(interaction);
        const local = interaction.options.getString('local', true);
        const horario = interaction.options.getString('horario', true);
        const pix = interaction.options.getString('pix') ?? undefined;
        const valorTotal = interaction.options.getNumber('valor_total') ?? undefined;
        const link = interaction.options.getString('link') ?? undefined;
        const mensagem = interaction.options.getString('mensagem') ?? undefined;

        const chamada = await createChamada(clan.id, interaction.user.id, { local, horario, pix, valorTotal, link, mensagem });

        // Mesma variável usada pro OAuth do dashboard (src/dashboard/server.ts) —
        // um único lugar define o domínio do site pra tudo (login, /fut, etc).
        const siteUrl = (process.env.DASHBOARD_URL || 'https://bryanfut.up.railway.app').replace(/\/$/, '');
        const chamadaUrl = `${siteUrl}/fut/chamada/${chamada.id}`;

        const embed = new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle(`📣 Vai ter fut! — ${clan.name}`)
          .setDescription(mensagem || `${interaction.user.username} tá chamando o pessoal pra jogar!`)
          .addFields(
            { name: '📍 Local', value: local, inline: true },
            { name: '🕒 Horário', value: horario, inline: true },
          );
        if (pix) embed.addFields({ name: '💸 PIX (dividir a quadra)', value: `\`${pix}\``, inline: false });
        if (valorTotal) embed.addFields({ name: '💰 Valor total', value: `R$ ${valorTotal.toFixed(2)} — o valor por pessoa aparece conforme a galera confirma`, inline: false });
        if (link) embed.addFields({ name: '🔗 Link', value: link, inline: false });
        embed.setFooter({ text: `Confirme presença com /fut confirmar cla:${clan.name}` });

        const whatsappTexto = `📣 Vai ter fut! (${clan.name})\n📍 ${local}\n🕒 ${horario}${mensagem ? `\n${mensagem}` : ''}\n\nConfirma presença aqui: ${chamadaUrl}`;
        const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('📣 Confirmar no site').setURL(chamadaUrl),
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('💬 Compartilhar no WhatsApp').setURL(`https://wa.me/?text=${encodeURIComponent(whatsappTexto)}`),
        )];

        await interaction.reply({ embeds: [embed], components });

        // Manda DM pra todo mundo do elenco que tem conta vinculada, INCLUSIVE
        // quem chamou — assim a pessoa sabe que a chamada realmente saiu e
        // consegue ver com os próprios olhos como o texto ficou.
        const alvos = clan.members.filter((m) => m.discordId);
        let enviados = 0;
        let falharam = 0;
        await Promise.all(alvos.map(async (m) => {
          try {
            const user = await interaction.client.users.fetch(m.discordId!);
            await user.send({ embeds: [embed], components });
            enviados += 1;
          } catch { falharam += 1; }
        }));
        if (alvos.length) {
          await interaction.followUp({ content: `📬 DM enviada pra ${enviados} pessoa(s) do elenco${falharam ? ` (${falharam} não recebeu — DM fechada)` : ''}.`, ephemeral: true });
        }
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

  // Sugere os clãs que a pessoa já faz parte neste servidor, conforme ela
  // digita no campo `cla` — assim não precisa decorar/digitar o nome certinho.
  // Clã público aparece pra todo mundo do servidor; privado só pra quem já é
  // membro (mesma regra de visibilidade de `listClans`).
  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'cla' || !interaction.guildId) { await interaction.respond([]); return; }

    try {
      const clans = await listClans(interaction.guildId, interaction.user.id);
      const meusClans = clans.filter((c) => c.members.some((m) => m.discordId === interaction.user.id));
      const termo = String(focused.value).trim().toLowerCase();
      const filtrados = (termo ? meusClans.filter((c) => c.name.toLowerCase().includes(termo)) : meusClans).slice(0, 25);
      await interaction.respond(filtrados.map((c) => ({ name: `${c.name} (${c.members.length} membro${c.members.length === 1 ? '' : 's'})`, value: c.name })));
    } catch {
      await interaction.respond([]).catch(() => null);
    }
  },
} as Command;
