import {
  ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ModalSubmitInteraction, EmbedBuilder, TextChannel,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits,
} from 'discord.js';
import { prisma } from '../database/client';
import { getConfig } from '../utils/helpers';
import { isBotManager } from '../utils/allowlist';
import { COLORS, EMOJIS, successEmbed, errorEmbed, baseEmbed } from '../utils/embeds';
import {
  getServerClass, getNextClass, getAllianceServers,
  buildOfficialAllianceEmbed, updateAllServerClasses, SERVER_CLASSES, getAlliancePanelEmoji,
  isAllianceServerRepresentative,
} from '../utils/alliance';

function resolveId(s: string) { return s.replace(/[<@!&#]/g, '').trim(); }

// ─── Botões da aliança ────────────────────────────────────────────────────────

export async function handleAliancaButton(i: ButtonInteraction, action: string) {
  if (!isBotManager(i.user.id)) {
    return i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores da aliança podem usar isso.')], ephemeral: true });
  }

  switch (action) {
    case 'add_server': {
      const modal = new ModalBuilder().setCustomId('alliance_modal:add_server').setTitle('Adicionar Servidor à Aliança');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('guild_id').setLabel('ID do Servidor (Guild ID)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ex: 123456789012345678'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('guild_name').setLabel('Nome do Servidor').setStyle(TextInputStyle.Short).setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('invite_link').setLabel('Link de Convite (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('ex: https://discord.gg/exemplo'),
        ),
      );
      return i.showModal(modal);
    }

    case 'remove_server': {
      const modal = new ModalBuilder().setCustomId('alliance_modal:remove_server').setTitle('Remover Servidor da Aliança');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('guild_id').setLabel('ID do Servidor').setStyle(TextInputStyle.Short).setRequired(true),
        ),
      );
      return i.showModal(modal);
    }

    case 'update_classes': {
      await i.deferReply({ ephemeral: true });
      const { updated, notFound } = await updateAllServerClasses(i.client);
      return i.editReply({
        embeds: [successEmbed(
          'Classes Atualizadas',
          `**${updated}** servidor(es) atualizados.\n${notFound > 0 ? `⚠️ **${notFound}** servidor(es) não encontrados no cache (bot pode não estar neles).` : ''}`,
        )],
      });
    }

    case 'set_member': {
      const modal = new ModalBuilder().setCustomId('alliance_modal:set_member').setTitle('Definir Representante/Dono');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('guild_id').setLabel('ID do Servidor').setStyle(TextInputStyle.Short).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('user_id').setLabel('ID do Usuário Discord').setStyle(TextInputStyle.Short).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('username').setLabel('Nome do Usuário (referência)').setStyle(TextInputStyle.Short).setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('role').setLabel('Cargo: owner ou representative').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('owner  ou  representative'),
        ),
      );
      return i.showModal(modal);
    }

    case 'remove_member': {
      const modal = new ModalBuilder().setCustomId('alliance_modal:remove_member').setTitle('Remover Representante/Dono');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('guild_id').setLabel('ID do Servidor').setStyle(TextInputStyle.Short).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('user_id').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true),
        ),
      );
      return i.showModal(modal);
    }

    case 'view_members': {
      await i.deferReply({ ephemeral: true });
      const servers = await getAllianceServers();
      if (servers.length === 0) {
        return i.editReply({ embeds: [errorEmbed('Sem Servidores', 'Nenhum servidor cadastrado na aliança.')] });
      }

      const lines: string[] = [];
      for (const s of servers) {
        const cls = getServerClass(s.memberCount);
        lines.push(`**${cls.emoji} ${s.guildName ?? s.guildId}**`);
        const owners = s.members.filter(m => m.role === 'owner');
        const reps   = s.members.filter(m => m.role === 'representative');
        if (owners.length > 0) lines.push(`👑 Donos: ${owners.map(m => `<@${m.userId}>`).join(', ')}`);
        if (reps.length > 0)   lines.push(`🎖️ Reps: ${reps.map(m => `<@${m.userId}>`).join(', ')}`);
        if (owners.length === 0 && reps.length === 0) lines.push('*Nenhum cadastrado*');
        lines.push('');
      }

      const embed = baseEmbed(COLORS.PRIMARY)
        .setTitle('👥 Representantes e Donos — Aliança Skyline')
        .setDescription(lines.join('\n').slice(0, 4000) || '*Vazio*');

      return i.editReply({ embeds: [embed] });
    }

    case 'analysis': {
      await i.deferReply({ ephemeral: true });
      const servers = await getAllianceServers();

      if (servers.length === 0) {
        return i.editReply({ embeds: [errorEmbed('Sem Dados', 'Nenhum servidor cadastrado.')] });
      }

      const lines: string[] = [];
      for (const s of servers) {
        const cls     = getServerClass(s.memberCount);
        const hasLink = s.inviteLink ? '✅' : '❌';
        const hasCh   = s.channelId  ? '✅' : '❌';

        // Verificar se canal ainda existe no Discord
        let chStatus = '❌ Não configurado';
        if (s.channelId) {
          const guild = i.client.guilds.cache.get(s.guildId);
          const ch    = guild?.channels.cache.get(s.channelId);
          chStatus = ch ? `✅ <#${s.channelId}>` : '⚠️ Canal não encontrado';
        }

        const link = s.inviteLink ? `[🔗 Convite](${s.inviteLink})` : '🔗 Sem link';
        lines.push(
          `**${cls.emoji} ${s.guildName ?? s.guildId}**  •  ${s.memberCount.toLocaleString('pt-BR')} membros\n` +
          `> Classe: **${cls.name}** | Link: ${hasLink} | Canal: ${chStatus}\n` +
          `> ${link} | ID: \`${s.guildId}\``
        );
      }

      const totalMembers = servers.reduce((a, s) => a + s.memberCount, 0);

      const embed = baseEmbed(COLORS.DARK)
        .setTitle('📊 Análise — Servidores da Aliança Skyline')
        .setDescription(lines.join('\n\n').slice(0, 4000))
        .addFields({
          name:  '📋 Totais',
          value: `**${servers.length}** servidores • **${totalMembers.toLocaleString('pt-BR')}** membros`,
        });

      return i.editReply({ embeds: [embed] });
    }

    case 'send_embed': {
      const modal = new ModalBuilder().setCustomId('alliance_modal:send_embed').setTitle('Enviar Embed Oficial');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('channel_id').setLabel('ID do Canal onde enviar').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ex: 987654321098765432'),
        ),
      );
      return i.showModal(modal);
    }

    case 'update_embed': {
      await i.deferReply({ ephemeral: true });

      const records = await prisma.allianceEmbed.findMany();
      if (records.length === 0) {
        return i.editReply({ embeds: [errorEmbed('Sem Embed', 'Nenhum embed oficial enviado ainda. Use **Enviar Embed** primeiro.')] });
      }

      const newEmbed = await buildOfficialAllianceEmbed(i.client);
      let updatedCount = 0;

      for (const rec of records) {
        const guild = i.client.guilds.cache.get(rec.guildId);
        if (!guild) continue;
        const ch = guild.channels.cache.get(rec.channelId) as TextChannel | undefined;
        if (!ch) continue;
        const msg = await ch.messages.fetch(rec.messageId).catch(() => null);
        if (!msg) continue;
        await msg.edit({ embeds: [newEmbed] }).catch(() => null);
        await prisma.allianceEmbed.update({ where: { id: rec.id }, data: { updatedAt: new Date() } });
        updatedCount++;
      }

      return i.editReply({
        embeds: [successEmbed(
          'Embed Atualizado',
          `**${updatedCount}** embed(s) atualizado(s) em ${records.length} local(is).`,
        )],
      });
    }

    case 'blacklist_add': {
      const modal = new ModalBuilder().setCustomId('alliance_modal:blacklist_add').setTitle('Adicionar à Blacklist');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('user_id').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('username').setLabel('Nome do Usuário (referência)').setStyle(TextInputStyle.Short).setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(false),
        ),
      );
      return i.showModal(modal);
    }

    case 'blacklist_remove': {
      const modal = new ModalBuilder().setCustomId('alliance_modal:blacklist_remove').setTitle('Remover da Blacklist');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('user_id').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true),
        ),
      );
      return i.showModal(modal);
    }

    // ─── Allowlist (servidores e managers autorizados) ────────────────────────
    case 'allowlist': {
      const { isEnforcementActive, allowedGuildCount, getOwnerIds } = await import('../utils/allowlist');
      const enforcement = isEnforcementActive();
      const guildCount  = allowedGuildCount();
      const owners      = getOwnerIds();

      const embed = new EmbedBuilder()
        .setColor(COLORS.DARK)
        .setTitle('🌐 Allowlist — Controle de Acesso')
        .setDescription(
          'Gerencie quais servidores o bot pode entrar e quem são os managers.

' +
          `**Enforcement:** ${enforcement ? '✅ Ativo (bot só entra em servidores autorizados)' : '❌ Inativo (bot entra em qualquer servidor)'}
` +
          `**Servidores autorizados:** ${guildCount}
` +
          `**Owners do bot:** ${owners.length}`
        )
        .addFields(
          { name: '🏠 Guilds',    value: 'Adicionar/remover servidores autorizados', inline: true },
          { name: '👤 Managers',  value: 'Adicionar/remover managers do bot',        inline: true },
          { name: '📋 Listagem',  value: 'Ver lista completa de acessos',            inline: true },
          { name: '🔒 Enforce',   value: 'Ativar/desativar restrição de acesso',     inline: true },
        )
        .setFooter({ text: '⚔️ Aliança Skyline — Controle de Acesso' })
        .setTimestamp();

      const r1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('allowlist:add_guild')      .setLabel('Add Servidor')     .setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('allowlist:remove_guild')   .setLabel('Remover Servidor') .setEmoji('➖').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('allowlist:add_manager')    .setLabel('Add Manager')      .setEmoji('👤').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('allowlist:remove_manager') .setLabel('Remover Manager')  .setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
      );
      const r2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('allowlist:list')            .setLabel('Ver Allowlist')    .setEmoji('📋').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('allowlist:enforcement')     .setLabel(`Enforcement: ${enforcement ? 'ON' : 'OFF'}`).setEmoji('🔒').setStyle(enforcement ? ButtonStyle.Success : ButtonStyle.Danger),
      );

      return i.reply({ embeds: [embed], components: [r1, r2], ephemeral: true });
    }

  }
}

export async function handleServidorButton(i: ButtonInteraction, action: string) {
  if (!i.guild) return i.reply({ embeds: [errorEmbed('Erro', 'Use em um servidor.')], ephemeral: true });

  const guildId = i.guild.id;

  const allianceServer = await prisma.allianceServer.findUnique({ where: { guildId } });
  if (!allianceServer) {
    return i.reply({ embeds: [errorEmbed('Não Cadastrado', 'Este servidor não está na aliança.')], ephemeral: true });
  }

  const isOwner = i.guild.ownerId === i.user.id;
  const isRepresentative = await isAllianceServerRepresentative(guildId, i.user.id);

  if (!isOwner && !isRepresentative) {
    return i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas o dono do servidor ou representantes definidos em `/alianca` podem usar isso.')], ephemeral: true });
  }

  switch (action) {
    case 'set_channel': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:set_channel').setTitle('Definir Canal da Aliança');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('channel_id').setLabel('ID do Canal da Aliança neste servidor').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ex: 111222333444555666'),
        ),
      );
      return i.showModal(modal);
    }

    case 'set_invite': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:set_invite').setTitle('Definir Link de Convite');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('invite_link').setLabel('Link de Convite permanente').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ex: https://discord.gg/exemplo'),
        ),
      );
      return i.showModal(modal);
    }

    case 'performance': {
      await i.deferReply({ ephemeral: true });

      const now      = new Date();
      const dates7d: string[] = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - d);
        dates7d.push(dt.toISOString().slice(0, 10));
      }

      const stats = await prisma.serverStat.findMany({
        where: { guildId, date: { in: dates7d } },
        orderBy: { date: 'desc' },
      });

      const totalJoins7d  = stats.reduce((a, s) => a + s.joins, 0);
      const totalLeaves7d = stats.reduce((a, s) => a + s.leaves, 0);
      const avgPerDay     = stats.length > 0 ? (totalJoins7d / stats.length).toFixed(1) : '0';

      const cls  = getServerClass(allianceServer.memberCount);
      const next = getNextClass(allianceServer.memberCount);

      const statsLines = stats.slice(0, 7).map(s =>
        `\`${s.date}\` +${s.joins} -${s.leaves}`
      ).join('\n') || '*Sem dados disponíveis*';

      const embed = baseEmbed(0x470F78)
        .setTitle(`🎚️ Desempenho — ${i.guild!.name}`)
        .setThumbnail(i.guild!.iconURL() ?? null)
        .addFields(
          { name: '🕸️ Classe Atual',        value: `${getAlliancePanelEmoji(cls.name)} **${cls.name}**`,                  inline: true },
          { name: '🦴 Membros Atual',         value: `**${allianceServer.memberCount.toLocaleString('pt-BR')}**`,           inline: true },
          { name: '📄 Entradas (7 dias)',      value: `**+${totalJoins7d}**`,                                               inline: true },
          { name: '📃 Saídas (7 dias)',        value: `**-${totalLeaves7d}**`,                                              inline: true },
          { name: '🎚️ Média Diária (Entradas)',value: `**${avgPerDay}**/dia`,                                               inline: true },
          {
            name:  next ? `🌪️ Próxima Classe: ${getAlliancePanelEmoji(next.cls.name)} ${next.cls.name}` : '🎱 Classe Máxima!',
            value: next ? `Faltam **${next.needed.toLocaleString('pt-BR')}** membros` : 'Você está no topo da aliança!',
            inline: false,
          },
          { name: '🧾 Histórico (últimos 7 dias)', value: statsLines, inline: false },
        );

      return i.editReply({ embeds: [embed] });
    }

    case 'stats_server': {
      await i.deferReply({ ephemeral: true });
      const g     = i.guild!;
      const today = new Date().toISOString().slice(0, 10);
      const [config, stat] = await Promise.all([
        getConfig(g.id),
        prisma.serverStat.findUnique({ where: { guildId_date: { guildId: g.id, date: today } } }),
      ]);
      const bots = g.members.cache.filter(m => m.user.bot).size;
      const embed = baseEmbed(0x470F78)
        .setTitle(`🎚️ ${g.name} — Estatísticas`)
        .setThumbnail(g.iconURL() ?? null)
        .addFields(
          { name: '🦴 Membros',          value: `**${g.memberCount}** (${bots} bots)`,                                      inline: true },
          { name: '💬 Canais',           value: `**${g.channels.cache.size}**`,                                              inline: true },
          { name: '♟️ Cargos',           value: `**${g.roles.cache.size}**`,                                                 inline: true },
          { name: '🕷️ Emojis',           value: `**${g.emojis.cache.size}**`,                                                inline: true },
          { name: '☁️ Boosts',           value: `**${g.premiumSubscriptionCount ?? 0}** (Tier ${g.premiumTier})`,           inline: true },
          { name: '📅 Criado em',        value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`,                            inline: true },
          { name: '🖤 Dono',             value: `<@${g.ownerId}>`,                                                           inline: true },
          { name: '🧾 Canal de Logs',    value: config.logChannelId ? `<#${config.logChannelId}>` : 'Não configurado',       inline: true },
          { name: '📄 Hoje — Entradas',  value: `**${stat?.joins ?? 0}**`,                                                   inline: true },
          { name: '📃 Hoje — Saídas',    value: `**${stat?.leaves ?? 0}**`,                                                  inline: true },
          { name: '🔩 Hoje — Bans',      value: `**${stat?.bans ?? 0}**`,                                                    inline: true },
          { name: '💬 Hoje — Mensagens', value: `**${(stat?.messages ?? 0).toLocaleString('pt-BR')}**`,                      inline: true },
        )
        .setFooter({ text: '🖤 Aliança Skyline' })
        .setTimestamp();
      return i.editReply({ embeds: [embed] });
    }

    case 'rede': {
      await i.deferReply({ ephemeral: true });
      const today  = new Date().toISOString().slice(0, 10);
      const guilds = i.client.guilds.cache;
      const gIds   = [...guilds.keys()];
      const stats  = await prisma.serverStat.findMany({ where: { guildId: { in: gIds }, date: today } });
      const stMap  = new Map(stats.map(s => [s.guildId, s]));
      let totalH = 0, totalB = 0, totalJ = 0, totalL = 0, totalBans = 0, totalM = 0;
      const lines: string[] = [];
      for (const [id, g] of guilds) {
        const bots   = g.members.cache.filter(m => m.user.bot).size;
        const humans = g.memberCount - bots;
        const s      = stMap.get(id);
        totalH += humans; totalB += bots;
        totalJ += s?.joins ?? 0; totalL += s?.leaves ?? 0;
        totalBans += s?.bans ?? 0; totalM += s?.messages ?? 0;
        lines.push(`**${g.name}** — ${g.memberCount} membros${s ? ` • +${s.joins}/-${s.leaves}/${s.bans}🔩` : ''}`);
      }
      const embed = baseEmbed(0x470F78)
        .setTitle(`☁️ Rede Aliança Skyline — ${guilds.size} servidor(es)`)
        .addFields(
          { name: '🦴 Total membros',    value: `**${(totalH + totalB).toLocaleString('pt-BR')}** (${totalB} bots)`, inline: true },
          { name: '📄 Hoje — Entradas',  value: `**${totalJ}**`,                                                     inline: true },
          { name: '📃 Hoje — Saídas',    value: `**${totalL}**`,                                                     inline: true },
          { name: '🔩 Hoje — Bans',      value: `**${totalBans}**`,                                                  inline: true },
          { name: '💬 Hoje — Mensagens', value: `**${totalM.toLocaleString('pt-BR')}**`,                              inline: true },
          { name: '🗄️ Servidores',        value: lines.join('\n') || '*Nenhum*',                                       inline: false },
        )
        .setFooter({ text: '🖤 Aliança Skyline — Rede Interna' })
        .setTimestamp();
      return i.editReply({ embeds: [embed] });
    }

    case 'anuncio': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:anuncio').setTitle('Criar Anúncio');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('conteudo').setLabel('Conteúdo').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('canal_id').setLabel('ID do Canal (vazio = canal da aliança)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'poll': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:poll').setTitle('Criar Enquete');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('pergunta').setLabel('Pergunta').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('opcoes').setLabel('Opções (uma por linha, 2–5)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500).setPlaceholder('Opção A\nOpção B\nOpção C')),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('duracao').setLabel('Duração (ex: 1h, 30m, 2d)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('1h')),
      );
      return i.showModal(modal);
    }

    case 'sorteio': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:sorteio').setTitle('Criar Sorteio');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('premio').setLabel('Prêmio').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('duracao').setLabel('Duração (ex: 1h, 30m, 2d)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('1h')),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('ganhadores').setLabel('Número de ganhadores').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('1')),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('canal_id').setLabel('ID do Canal (vazio = canal da aliança)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'encerrar_sorteio': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:encerrar_sorteio').setTitle('Encerrar Sorteio');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('message_id').setLabel('ID da Mensagem do Sorteio').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ID da mensagem do sorteio ativo')),
      );
      return i.showModal(modal);
    }

    case 'evento': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:evento').setTitle('Criar Evento');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título do Evento').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('horario').setLabel('Horário (ex: 25/12 20:00)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('DD/MM HH:MM')),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('canal_id').setLabel('ID do Canal (vazio = canal da aliança)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'conquista': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:conquista').setTitle('Dar Conquista a Usuário');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('user_id').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título da Conquista').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300)),
      );
      return i.showModal(modal);
    }

    case 'nivel_reward': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:nivel_reward').setTitle('Recompensa de Nível');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('nivel').setLabel('Nível').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ex: 10')),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('cargo_id').setLabel('ID do Cargo (vazio = remover recompensa)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'economia': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:economia').setTitle('Gerenciar Economia');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('user_id').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('acao').setLabel('Ação: dar / remover').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('dar ou remover')),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('quantidade').setLabel('Quantidade de Moedas').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ex: 100')),
      );
      return i.showModal(modal);
    }

    case 'loja': {
      await i.deferReply({ ephemeral: true });
      try {
        const items = await (prisma as any).shopItem.findMany({ where: { guildId: i.guild!.id }, take: 10 });
        if (!items?.length) {
          return i.editReply({ embeds: [baseEmbed(0x470F78).setTitle('🛍️ Loja').setDescription('Nenhum item cadastrado na loja ainda.')] });
        }
        const list = items.map((item: any) => `**${item.name}** — 🪙 ${item.price}${item.roleId ? ` · <@&${item.roleId}>` : ''}`).join('\n');
        return i.editReply({ embeds: [baseEmbed(0x470F78).setTitle('🛍️ Loja').setDescription(list).setFooter({ text: 'Use /admin → Loja para gerenciar itens' })] });
      } catch {
        return i.editReply({ embeds: [errorEmbed('Erro', 'Não foi possível carregar a loja.')] });
      }
    }

    case 'rank': {
      const modal = new ModalBuilder().setCustomId('servidor_modal:rank').setTitle('Definir Rank do Usuário');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('user_id').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('rank').setLabel('Rank (Bronze/Silver/Gold/Diamond/Master/Grandmaster/Challenger)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ex: Gold')),
      );
      return i.showModal(modal);
    }

    case 'cargo_menu': {
      await i.deferReply({ ephemeral: true });
      try {
        const menus = await (prisma as any).selfRoleMenu.findMany({ where: { guildId: i.guild!.id }, take: 5 });
        if (!menus?.length) {
          return i.editReply({ embeds: [baseEmbed(0x470F78).setTitle('🎭 Registro de Cargos').setDescription('Nenhum menu de auto-cargo configurado.')] });
        }
        const list = menus.map((m: any) => `**${m.title || 'Menu de Cargos'}** — ${m.roles?.length ?? 0} cargos`).join('\n');
        return i.editReply({ embeds: [baseEmbed(0x470F78).setTitle('🎭 Registro de Cargos').setDescription(list)] });
      } catch {
        return i.editReply({ embeds: [errorEmbed('Erro', 'Não foi possível carregar os menus de cargo.')] });
      }
    }

    case 'modulos': {
      await i.deferReply({ ephemeral: true });
      const cfg = await getConfig(i.guild!.id);
      const lines = [
        `${(cfg as any).xpEnabled !== false    ? '✅' : '❌'} **Sistema de XP** — Ganho de XP por mensagens`,
        `${(cfg as any).welcomeEnabled !== false? '✅' : '❌'} **Boas-vindas** — Mensagem ao entrar no servidor`,
        `${(cfg as any).ticketEnabled !== false ? '✅' : '❌'} **Tickets** — Sistema de suporte`,
        `${(cfg as any).antiSpam             ? '✅' : '❌'} **Anti-Spam** — Bloquear mensagens repetidas`,
        `${(cfg as any).antiLinks            ? '✅' : '❌'} **Anti-Links** — Bloquear links externos`,
        `${cfg.logChannelId                  ? '✅' : '❌'} **Logs** — ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'canal não configurado'}`,
      ];
      return i.editReply({ embeds: [baseEmbed(0x470F78).setTitle('🔧 Módulos do Servidor').setDescription(lines.join('\n')).setFooter({ text: 'Use /admin → Configurações para gerenciar módulos' })] });
    }

    case 'mod': {
      await i.deferReply({ ephemeral: true });
      const embed = baseEmbed(0x470F78)
        .setTitle('🔨 Painel de Moderação')
        .setDescription(
          'Comandos disponíveis de moderação:
' +
          '`/ban` — Banir usuário
' +
          '`/kick` — Expulsar usuário
' +
          '`/mute` — Mutar usuário
' +
          '`/warn` — Advertir usuário
' +
          '`/clear` — Limpar mensagens
' +
          '`/unban` — Desbanir usuário
' +
          '`/infractions` — Ver histórico de infrações'
        )
        .setFooter({ text: 'Ações ficam registradas no canal de logs' })
        .setTimestamp();
      return i.editReply({ embeds: [embed] });
    }

  }
}

// ─── Modais da aliança ────────────────────────────────────────────────────────

export async function handleAllianceModal(i: ModalSubmitInteraction, action: string) {
  if (!isBotManager(i.user.id)) {
    return i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores da aliança podem usar isso.')], ephemeral: true });
  }

  await i.deferReply({ ephemeral: true });

  const getField = (id: string) => {
    try { return i.fields.getTextInputValue(id).trim() || null; } catch { return null; }
  };

  switch (action) {
    case 'add_server': {
      const guildId   = resolveId(getField('guild_id') ?? '');
      const guildName = getField('guild_name');
      const invite    = getField('invite_link');

      if (!guildId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID do servidor inválido.')] });

      // Tentar pegar info real do servidor se bot estiver nele
      const discordGuild = i.client.guilds.cache.get(guildId);
      const finalName    = discordGuild?.name ?? guildName ?? guildId;
      const memberCount  = discordGuild?.memberCount ?? 0;
      const cls          = getServerClass(memberCount);

      await prisma.allianceServer.upsert({
        where:  { guildId },
        update: { guildName: finalName, memberCount, class: cls.name, inviteLink: invite },
        create: { guildId, guildName: finalName, memberCount, class: cls.name, inviteLink: invite, addedBy: i.user.id },
      });

      return i.editReply({
        embeds: [successEmbed(
          'Servidor Adicionado',
          `**${finalName}** foi adicionado à aliança!\nClasse: ${cls.emoji} **${cls.name}** (${memberCount.toLocaleString('pt-BR')} membros)`,
        )],
      });
    }

    case 'remove_server': {
      const guildId = resolveId(getField('guild_id') ?? '');
      if (!guildId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID inválido.')] });

      const existing = await prisma.allianceServer.findUnique({ where: { guildId } });
      if (!existing) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Servidor não está na aliança.')] });

      await prisma.allianceServer.delete({ where: { guildId } });
      return i.editReply({ embeds: [successEmbed('Removido', `**${existing.guildName ?? guildId}** foi removido da aliança.`)] });
    }

    case 'set_member': {
      const guildId  = resolveId(getField('guild_id') ?? '');
      const userId   = resolveId(getField('user_id') ?? '');
      const username = getField('username');
      const roleRaw  = (getField('role') ?? '').toLowerCase();
      const role     = roleRaw === 'owner' ? 'owner' : 'representative';

      if (!guildId || !userId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID do servidor ou usuário inválido.')] });

      const server = await prisma.allianceServer.findUnique({ where: { guildId } });
      if (!server) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Servidor não está na aliança.')] });

      await prisma.allianceServerMember.upsert({
        where:  { guildId_userId: { guildId, userId } },
        update: { role, username: username ?? undefined },
        create: { guildId, userId, role, username: username ?? undefined },
      });

      const roleLabel = role === 'owner' ? '👑 Dono' : '🎖️ Representante';
      return i.editReply({ embeds: [successEmbed('Definido', `<@${userId}> foi definido como **${roleLabel}** de **${server.guildName ?? guildId}**.`)] });
    }

    case 'remove_member': {
      const guildId = resolveId(getField('guild_id') ?? '');
      const userId  = resolveId(getField('user_id') ?? '');

      if (!guildId || !userId) return i.editReply({ embeds: [errorEmbed('Inválido', 'IDs inválidos.')] });

      const deleted = await prisma.allianceServerMember.deleteMany({ where: { guildId, userId } });
      if (deleted.count === 0) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não é rep/dono neste servidor.')] });

      return i.editReply({ embeds: [successEmbed('Removido', `<@${userId}> foi removido de **${guildId}**.`)] });
    }

    case 'send_embed': {
      const channelId = resolveId(getField('channel_id') ?? '');
      if (!channelId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID de canal inválido.')] });

      const guildId = i.guildId ?? '';
      const guild   = i.client.guilds.cache.get(guildId) ?? i.guild;
      const channel = (guild ?? i.client.guilds.cache.first())?.channels.cache.get(channelId) as TextChannel | undefined;

      if (!channel) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', `Canal \`${channelId}\` não encontrado neste servidor.`)] });

      const allianceEmbed = await buildOfficialAllianceEmbed(i.client);
      const msg = await channel.send({ embeds: [allianceEmbed] });

      await prisma.allianceEmbed.upsert({
        where:  { guildId: channel.guildId },
        update: { channelId, messageId: msg.id, updatedAt: new Date() },
        create: { guildId: channel.guildId, channelId, messageId: msg.id, updatedAt: new Date() },
      });

      return i.editReply({ embeds: [successEmbed('Embed Enviado', `Embed oficial enviado em <#${channelId}>!`)] });
    }

    case 'blacklist_add': {
      const userId   = resolveId(getField('user_id') ?? '');
      const username = getField('username');
      const reason   = getField('reason');

      if (!userId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID de usuário inválido.')] });

      await prisma.allianceBlacklist.upsert({
        where:  { userId },
        update: { username: username ?? undefined, reason: reason ?? undefined, addedBy: i.user.id },
        create: { userId, username: username ?? undefined, reason: reason ?? undefined, addedBy: i.user.id },
      });

      // Banir de todos os servidores da aliança automaticamente
      const servers  = await prisma.allianceServer.findMany();
      let bannedFrom = 0;
      for (const s of servers) {
        const guild = i.client.guilds.cache.get(s.guildId);
        if (!guild) continue;
        const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
        if (!member) continue;
        await guild.bans.create(userId, { reason: `[Blacklist Aliança] ${reason ?? 'Sem motivo'}` }).catch(() => null);
        bannedFrom++;
      }

      return i.editReply({
        embeds: [successEmbed(
          'Blacklist — Adicionado',
          `<@${userId}> (${username ?? userId}) foi adicionado à blacklist.\n` +
          `🔨 Banido de **${bannedFrom}** servidor(es) da aliança.\n` +
          `${reason ? `📝 Motivo: ${reason}` : ''}`,
        )],
      });
    }

    case 'blacklist_remove': {
      const userId = resolveId(getField('user_id') ?? '');
      if (!userId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID inválido.')] });

      const existing = await prisma.allianceBlacklist.findUnique({ where: { userId } });
      if (!existing) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não está na blacklist.')] });

      await prisma.allianceBlacklist.delete({ where: { userId } });
      return i.editReply({ embeds: [successEmbed('Blacklist — Removido', `<@${userId}> foi removido da blacklist da aliança.`)] });
    }
  }
}

// ─── Modais do servidor (dono do server) ─────────────────────────────────────

function parseDurationMs(str: string): number {
  const m = str.trim().match(/^(\d+)(m|h|d)$/i);
  if (!m) return 3600000; // default 1h
  const n = parseInt(m[1]);
  if (m[2] === 'm') return n * 60000;
  if (m[2] === 'h') return n * 3600000;
  return n * 86400000;
}



export async function handleServidorModal(i: ModalSubmitInteraction, action: string) {
  if (!i.guild) return i.reply({ embeds: [errorEmbed('Erro', 'Use em um servidor.')], ephemeral: true });

  const guildId = i.guild.id;
  const server  = await prisma.allianceServer.findUnique({ where: { guildId } });
  if (!server) return i.reply({ embeds: [errorEmbed('Não Cadastrado', 'Servidor não está na aliança.')], ephemeral: true });

  const isOwner = i.guild.ownerId === i.user.id;
  const isRepresentative = await isAllianceServerRepresentative(guildId, i.user.id);

  if (!isOwner && !isRepresentative) {
    return i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas o dono do servidor ou representantes definidos em `/alianca` podem usar isso.')], ephemeral: true });
  }

  await i.deferReply({ ephemeral: true });

  const getField = (id: string) => {
    try { return i.fields.getTextInputValue(id).trim() || null; } catch { return null; }
  };

  switch (action) {
    case 'set_channel': {
      const channelId = resolveId(getField('channel_id') ?? '');
      if (!channelId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID de canal inválido.')] });

      const channel = i.guild.channels.cache.get(channelId);
      if (!channel) return i.editReply({ embeds: [errorEmbed('Não encontrado', `Canal \`${channelId}\` não encontrado neste servidor.`)] });

      await prisma.allianceServer.update({ where: { guildId }, data: { channelId } });
      return i.editReply({ embeds: [successEmbed('Canal Definido', `Canal da aliança definido como <#${channelId}>!`)] });
    }

    case 'set_invite': {
      const invite = getField('invite_link');
      if (!invite) return i.editReply({ embeds: [errorEmbed('Inválido', 'Link inválido.')] });

      await prisma.allianceServer.update({ where: { guildId }, data: { inviteLink: invite } });
      return i.editReply({ embeds: [successEmbed('Link Definido', `Link de convite salvo:\n${invite}`)] });
    }

    case 'anuncio': {
      const titulo   = getField('titulo') ?? 'Anúncio';
      const conteudo = getField('conteudo') ?? '';
      const rawCh    = getField('canal_id');
      const targetId = rawCh ? resolveId(rawCh) : (server.channelId ?? '');
      if (!targetId) return i.editReply({ embeds: [errorEmbed('Canal não configurado', 'Informe um ID de canal ou configure o canal da aliança.')] });
      const ch = i.guild!.channels.cache.get(targetId) as TextChannel | undefined;
      if (!ch) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', `Canal \`${targetId}\` não encontrado.`)] });
      const embed = new EmbedBuilder().setColor(0x470F78).setTitle(`📢 ${titulo}`).setDescription(conteudo).setFooter({ text: `Anúncio por ${i.user.username}` }).setTimestamp();
      await (ch as TextChannel).send({ embeds: [embed] });
      return i.editReply({ embeds: [successEmbed('Anúncio Enviado', `Anúncio enviado em <#${targetId}>!`)] });
    }

    case 'poll': {
      const pergunta = getField('pergunta') ?? '';
      const rawOpts  = (getField('opcoes') ?? '').split('\n').map((o: string) => o.trim()).filter(Boolean).slice(0, 5);
      if (rawOpts.length < 2) return i.editReply({ embeds: [errorEmbed('Inválido', 'Forneça pelo menos 2 opções.')] });
      const durStr = getField('duracao') ?? '1h';
      const endAt  = new Date(Date.now() + parseDurationMs(durStr));
      const letters = ['🇦','🇧','🇨','🇩','🇪'];
      const opts = rawOpts.map((o: string, idx: number) => `${letters[idx]} ${o}`).join('\n');
      const targetId = server.channelId ?? '';
      if (!targetId) return i.editReply({ embeds: [errorEmbed('Canal não configurado', 'Configure o canal da aliança primeiro.')] });
      const ch = i.guild!.channels.cache.get(targetId) as TextChannel | undefined;
      if (!ch) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', 'Canal da aliança não encontrado.')] });
      const embed = new EmbedBuilder().setColor(0x470F78).setTitle(`📊 ${pergunta}`).setDescription(opts).addFields({ name: '⏱️ Encerra', value: `<t:${Math.floor(endAt.getTime()/1000)}:R>` }).setFooter({ text: `Poll por ${i.user.username}` }).setTimestamp();
      const msg = await (ch as TextChannel).send({ embeds: [embed] });
      for (const letter of letters.slice(0, rawOpts.length)) await msg.react(letter).catch(() => null);
      return i.editReply({ embeds: [successEmbed('Poll Criada', `Enquete enviada em <#${targetId}>!`)] });
    }

    case 'sorteio': {
      const premio    = getField('premio') ?? '';
      const durStr    = getField('duracao') ?? '1h';
      const winners   = Math.max(1, parseInt(getField('ganhadores') ?? '1') || 1);
      const rawCh     = getField('canal_id');
      const targetId  = rawCh ? resolveId(rawCh) : (server.channelId ?? '');
      if (!targetId) return i.editReply({ embeds: [errorEmbed('Canal não configurado', 'Informe um ID de canal ou configure o canal da aliança.')] });
      const ch = i.guild!.channels.cache.get(targetId) as TextChannel | undefined;
      if (!ch) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', `Canal \`${targetId}\` não encontrado.`)] });
      const endAt  = new Date(Date.now() + parseDurationMs(durStr));
      const embed  = new EmbedBuilder().setColor(0x2ECC71)
        .setTitle('🎁 SORTEIO')
        .setDescription(`**Prêmio:** ${premio}\n\nClique em 🎉 para participar!`)
        .addFields(
          { name: '🏆 Ganhadores', value: String(winners), inline: true },
          { name: '⏱️ Encerra',    value: `<t:${Math.floor(endAt.getTime()/1000)}:R>`, inline: true },
          { name: '🎗️ Criado por', value: `<@${i.user.id}>`, inline: true },
        )
        .setFooter({ text: 'Reaja com 🎉 para participar!' })
        .setTimestamp();
      const msg = await (ch as TextChannel).send({ embeds: [embed] });
      await msg.react('🎉').catch(() => null);
      try {
        await (prisma as any).giveaway.create({ data: { guildId: guildId, channelId: targetId, messageId: msg.id, prize: premio, endAt, winnerCount: winners, createdBy: i.user.id } });
      } catch { /* model may not exist */ }
      return i.editReply({ embeds: [successEmbed('Sorteio Criado', `Sorteio iniciado em <#${targetId}>! Encerra <t:${Math.floor(endAt.getTime()/1000)}:R>.`)] });
    }

    case 'encerrar_sorteio': {
      const messageId = getField('message_id') ?? '';
      if (!messageId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID da mensagem inválido.')] });
      try {
        const giveaway = await (prisma as any).giveaway.findFirst({ where: { guildId, messageId } });
        if (!giveaway) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Sorteio não encontrado com este ID de mensagem.')] });
        const ch = i.guild!.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
        const msg = ch ? await ch.messages.fetch(messageId).catch(() => null) : null;
        const reaction = msg?.reactions.cache.get('🎉');
        const participants = reaction ? [...(await reaction.users.fetch()).values()].filter(u => !u.bot) : [];
        if (!participants.length) {
          await (prisma as any).giveaway.update({ where: { id: giveaway.id }, data: { endAt: new Date() } });
          return i.editReply({ embeds: [errorEmbed('Sem participantes', 'Nenhum participante no sorteio.')] });
        }
        const winnersArr = participants.sort(() => Math.random() - 0.5).slice(0, giveaway.winnerCount);
        const winnerMentions = winnersArr.map((u: any) => `<@${u.id}>`).join(', ');
        if (ch) await ch.send({ content: `🎉 **Sorteio encerrado!** Parabéns ${winnerMentions}! Você ganhou **${giveaway.prize}**!` });
        await (prisma as any).giveaway.update({ where: { id: giveaway.id }, data: { endAt: new Date(), winnerIds: winnersArr.map((u: any) => u.id) } });
        return i.editReply({ embeds: [successEmbed('Sorteio Encerrado', `Ganhadores: ${winnerMentions}`)] });
      } catch (e) {
        return i.editReply({ embeds: [errorEmbed('Erro', 'Não foi possível encerrar o sorteio.')] });
      }
    }

    case 'evento': {
      const titulo    = getField('titulo') ?? '';
      const descricao = getField('descricao') ?? '';
      const horario   = getField('horario');
      const rawCh     = getField('canal_id');
      const targetId  = rawCh ? resolveId(rawCh) : (server.channelId ?? '');
      if (!targetId) return i.editReply({ embeds: [errorEmbed('Canal não configurado', 'Informe um ID de canal ou configure o canal da aliança.')] });
      const ch = i.guild!.channels.cache.get(targetId) as TextChannel | undefined;
      if (!ch) return i.editReply({ embeds: [errorEmbed('Canal não encontrado', `Canal \`${targetId}\` não encontrado.`)] });
      const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`📌 ${titulo}`).setDescription(descricao);
      if (horario) embed.addFields({ name: '🕐 Horário', value: horario, inline: true });
      embed.setFooter({ text: `Evento por ${i.user.username}` }).setTimestamp();
      await (ch as TextChannel).send({ embeds: [embed] });
      return i.editReply({ embeds: [successEmbed('Evento Criado', `Evento enviado em <#${targetId}>!`)] });
    }

    case 'conquista': {
      const userId    = resolveId(getField('user_id') ?? '');
      const titulo    = getField('titulo') ?? '';
      const descricao = getField('descricao') ?? '';
      if (!userId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID de usuário inválido.')] });
      try {
        await (prisma as any).achievement.create({ data: { memberId: userId, guildId, title: titulo, description: descricao } });
      } catch { /* model may differ */ }
      return i.editReply({ embeds: [successEmbed('Conquista Concedida', `Conquista **${titulo}** atribuída a <@${userId}>!`)] });
    }

    case 'nivel_reward': {
      const nivel   = parseInt(getField('nivel') ?? '0');
      const cargoId = resolveId(getField('cargo_id') ?? '');
      if (!nivel || nivel < 1) return i.editReply({ embeds: [errorEmbed('Inválido', 'Nível inválido.')] });
      try {
        if (cargoId) {
          await (prisma as any).levelReward.upsert({ where: { guildId_level: { guildId, level: nivel } }, update: { roleId: cargoId }, create: { guildId, level: nivel, roleId: cargoId } });
          return i.editReply({ embeds: [successEmbed('Recompensa Definida', `Nível **${nivel}** → <@&${cargoId}>`)] });
        } else {
          await (prisma as any).levelReward.deleteMany({ where: { guildId, level: nivel } });
          return i.editReply({ embeds: [successEmbed('Recompensa Removida', `Recompensa do nível **${nivel}** removida.`)] });
        }
      } catch { return i.editReply({ embeds: [errorEmbed('Erro', 'Não foi possível salvar a recompensa.')] }); }
    }

    case 'economia': {
      const userId    = resolveId(getField('user_id') ?? '');
      const acao      = (getField('acao') ?? '').toLowerCase().trim();
      const quantidade = parseInt(getField('quantidade') ?? '0');
      if (!userId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID de usuário inválido.')] });
      if (!['dar', 'remover'].includes(acao)) return i.editReply({ embeds: [errorEmbed('Inválido', 'Ação deve ser "dar" ou "remover".')] });
      if (!quantidade || quantidade < 1) return i.editReply({ embeds: [errorEmbed('Inválido', 'Quantidade inválida.')] });
      const delta = acao === 'dar' ? quantidade : -quantidade;
      await prisma.member.upsert({
        where: { discordId: userId },
        update: { coins: { increment: delta } },
        create: { discordId: userId, username: userId, coins: Math.max(0, delta) },
      });
      const action = acao === 'dar' ? 'adicionadas a' : 'removidas de';
      return i.editReply({ embeds: [successEmbed('Economia Atualizada', `🪙 **${quantidade}** moedas ${action} <@${userId}>.`)] });
    }

    case 'rank': {
      const userId = resolveId(getField('user_id') ?? '');
      const rank   = (getField('rank') ?? '').trim();
      const validRanks = ['Bronze','Silver','Gold','Diamond','Master','Grandmaster','Challenger'];
      if (!userId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID de usuário inválido.')] });
      const normalised = validRanks.find(r => r.toLowerCase() === rank.toLowerCase());
      if (!normalised) return i.editReply({ embeds: [errorEmbed('Rank Inválido', `Ranks válidos: ${validRanks.join(', ')}`)] });
      await prisma.member.upsert({
        where: { discordId: userId },
        update: { rank: normalised },
        create: { discordId: userId, username: userId, rank: normalised },
      });
      return i.editReply({ embeds: [successEmbed('Rank Definido', `<@${userId}> agora é **${normalised}**!`)] });
    }

  }
}
