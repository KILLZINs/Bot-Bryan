import {
  ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ModalSubmitInteraction, EmbedBuilder, TextChannel,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ChannelType, PermissionFlagsBits, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
} from 'discord.js';
import { prisma } from '../database/client';
import { getConfig } from '../utils/helpers';
import { isBotManager, isEnforcementActive, allowedGuildCount, getOwnerIds } from '../utils/allowlist';
import { COLORS, successEmbed, errorEmbed, baseEmbed } from '../utils/embeds';
import {
  getServerClass, getNextClass, getAllianceServers,
  buildOfficialAllianceEmbed, updateAllServerClasses, SERVER_CLASSES, getAlliancePanelEmoji,
  isAllianceServerRepresentative,
} from '../utils/alliance';
import { FEATURE_META, FEATURE_KEYS, type FeatureKey } from '../utils/features';
import { RANKS } from '../types';

function resolveId(s: string) { return s.replace(/[<@!&#]/g, '').trim(); }

// ─── Painel Allowlist (compartilhado) ─────────────────────────────────────────

async function showAllowlistPanel(i: ButtonInteraction) {
  await i.deferReply({ ephemeral: true });
  const guilds   = await prisma.allowedGuild.findMany({ where: { active: true }, orderBy: { addedAt: 'asc' } });
  const managers = await prisma.botManager.findMany({ orderBy: { addedAt: 'asc' } });
  const active   = isEnforcementActive();
  const botIn    = i.client.guilds.cache.size;

  const guildLines = guilds.length
    ? guilds.map(g => {
        const live = i.client.guilds.cache.get(g.guildId);
        return `${live ? '🟢' : '⚫'} **${g.guildName ?? g.guildId}** \`${g.guildId}\`` + (g.note ? ` — ${g.note}` : '');
      }).join('\n')
    : '*Nenhum servidor autorizado — modo bootstrap ativo (todos podem usar o bot)*';

  const ownerIds   = getOwnerIds();
  const ownerLines = ownerIds.map(id => `👑 <@${id}> — Dono (env)`).join('\n') || '*Nenhum OWNER_ID configurado*';
  const mgrLines   = managers.length
    ? managers.map(m => `🔧 <@${m.userId}>${m.username ? ` — ${m.username}` : ''}`).join('\n')
    : '*Nenhum manager adicionado*';

  const embed = baseEmbed(active ? COLORS.SUCCESS : COLORS.WARNING)
    .setTitle('🌐 Gerenciamento de Acesso (Allowlist)')
    .addFields(
      { name: '📋 Modo atual', value: active
        ? '🔒 **Enforcement ativo** — apenas servidores da lista podem usar o bot'
        : '🔓 **Bootstrap** — qualquer servidor pode usar o bot', inline: false },
      { name: `✅ Servidores autorizados (${guilds.length})`, value: guildLines.slice(0, 1000), inline: false },
      { name: '👑 Donos',                                     value: ownerLines,                inline: true  },
      { name: `🔧 Managers (${managers.length})`,             value: mgrLines,                  inline: true  },
      { name: '🤖 Bot está em',                               value: `**${botIn}** servidor(es)`, inline: true },
    )
    .setFooter({ text: '🟢 = bot está no servidor  ⚫ = bot não está lá' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('allowlist:add_guild')     .setLabel('+ Servidor').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('allowlist:remove_guild')  .setLabel('− Servidor').setEmoji('🚫').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('allowlist:add_manager')   .setLabel('+ Manager') .setEmoji('🔧').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('allowlist:remove_manager').setLabel('− Manager') .setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('refresh:allowlist')       .setLabel('Atualizar') .setEmoji('🔄').setStyle(ButtonStyle.Secondary),
  );

  return i.editReply({ embeds: [embed], components: [row] });
}

// ─── Helpers — Módulos ────────────────────────────────────────────────────────

function buildModulosEmbed(cfg: Record<string, unknown>, guildName: string): EmbedBuilder {
  const lines = FEATURE_KEYS.map(k => {
    const m  = FEATURE_META[k];
    const on = (cfg[k] as boolean) !== false;
    return (on ? '✅' : '❌') + ' ' + m.emoji + ' **' + m.label + '** — ' + m.desc;
  });
  return baseEmbed(COLORS.PRIMARY)
    .setTitle('🔧 Módulos — ' + guildName)
    .setDescription(
      'Clique em um módulo para **habilitar** ou **desabilitar** neste servidor.\n\n' +
      lines.join('\n')
    )
    .setFooter({ text: 'Mudanças têm efeito imediato • ✅ = ativo • ❌ = inativo' });
}

function buildModulosRows(cfg: Record<string, unknown>): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let row = new ActionRowBuilder<ButtonBuilder>();
  let count = 0;
  for (const k of FEATURE_KEYS) {
    if (count > 0 && count % 5 === 0) { rows.push(row); row = new ActionRowBuilder<ButtonBuilder>(); }
    const m  = FEATURE_META[k];
    const on = (cfg[k] as boolean) !== false;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('servidor:toggle_feat:' + k)
        .setLabel(m.label)
        .setEmoji(on ? '✅' : '❌')
        .setStyle(on ? ButtonStyle.Success : ButtonStyle.Danger),
    );
    count++;
  }
  if (count % 5 !== 0 || count === 0) rows.push(row);
  return rows;
}

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
          `**${updated}** servidor(es) atualizados.\n${notFound > 0 ? `⚠️ **${notFound}** servidor(es) não encontrados no cache.` : ''}`,
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
        const cls  = getServerClass(s.memberCount);
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
        const cls    = getServerClass(s.memberCount);
        const hasLink = s.inviteLink ? '✅' : '❌';
        let chStatus = '❌ Não configurado';
        if (s.channelId) {
          const guild = i.client.guilds.cache.get(s.guildId);
          const ch    = guild?.channels.cache.get(s.channelId);
          chStatus    = ch ? `✅ <#${s.channelId}>` : '⚠️ Canal não encontrado';
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
        .addFields({ name: '📋 Totais', value: `**${servers.length}** servidores • **${totalMembers.toLocaleString('pt-BR')}** membros` });
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
        const ch  = guild.channels.cache.get(rec.channelId) as TextChannel | undefined;
        if (!ch)  continue;
        const msg = await ch.messages.fetch(rec.messageId).catch(() => null);
        if (!msg) continue;
        await msg.edit({ embeds: [newEmbed] }).catch(() => null);
        await prisma.allianceEmbed.update({ where: { id: rec.id }, data: { updatedAt: new Date() } });
        updatedCount++;
      }
      return i.editReply({
        embeds: [successEmbed('Embed Atualizado', `**${updatedCount}** embed(s) atualizado(s) em ${records.length} local(is).`)],
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

    case 'allowlist': {
      return showAllowlistPanel(i);
    }
  }
}

// ─── Botões do servidor (donos e representantes) ──────────────────────────────

export async function handleServidorButton(i: ButtonInteraction, action: string) {
  if (!i.guild) return i.reply({ embeds: [errorEmbed('Erro', 'Use em um servidor.')], ephemeral: true });

  const guildId = i.guild.id;

  // Ações de toggle de módulo não precisam verificar cadastro na aliança
  if (action === 'toggle_feat') {
    const isOwner = i.guild.ownerId === i.user.id;
    const isRep   = await isAllianceServerRepresentative(guildId, i.user.id);
    if (!isOwner && !isRep) {
      return i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas o dono do servidor ou representantes podem usar isso.')], ephemeral: true });
    }
    await i.deferUpdate();
    const feat = i.customId.split(':')[2] as FeatureKey;
    if (!feat || !FEATURE_KEYS.includes(feat)) return;
    const cfg     = await getConfig(guildId);
    const current = ((cfg as Record<string, unknown>)[feat] as boolean) ?? true;
    await prisma.guildConfig.update({ where: { guildId }, data: { [feat]: !current } });
    const updated = await getConfig(guildId);
    const embed   = buildModulosEmbed(updated as Record<string, unknown>, i.guild.name);
    const rows    = buildModulosRows(updated as Record<string, unknown>);
    return i.editReply({ embeds: [embed], components: rows });
  }

  const allianceServer = await prisma.allianceServer.findUnique({ where: { guildId } });
  if (!allianceServer) {
    return i.reply({ embeds: [errorEmbed('Não Cadastrado', 'Este servidor não está na aliança.')], ephemeral: true });
  }

  const isOwner = i.guild.ownerId === i.user.id;
  const isRep   = await isAllianceServerRepresentative(guildId, i.user.id);

  if (!isOwner && !isRep) {
    return i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas o dono do servidor ou representantes definidos em `/alianca` podem usar isso.')], ephemeral: true });
  }

  switch (action) {

    // ── Configuração da aliança ──────────────────────────────────────────────

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

    // ── Estatísticas melhoradas ───────────────────────────────────────────────

    case 'stats_server': {
      await i.deferReply({ ephemeral: true });
      const g      = i.guild!;
      const today  = new Date().toISOString().slice(0, 10);
      const memberIds = [...g.members.cache.filter(m => !m.user.bot).keys()];
      const bots   = g.members.cache.filter(m => m.user.bot).size;

      const [config, stat, totalGiveaways, totalTickets, totalAchievements, topMember] = await Promise.all([
        getConfig(g.id),
        prisma.serverStat.findUnique({ where: { guildId_date: { guildId: g.id, date: today } } }),
        prisma.giveaway.count({ where: { guildId: g.id } }),
        prisma.ticket.count({ where: { authorId: { in: memberIds } } }),
        prisma.achievement.count({ where: { memberId: { in: memberIds } } }),
        prisma.member.findFirst({
          where: { discordId: { in: memberIds } },
          orderBy: [{ level: 'desc' }, { xp: 'desc' }],
        }),
      ]);

      const embed = baseEmbed(0x470F78)
        .setTitle(`🎚️ ${g.name} — Estatísticas Completas`)
        .setThumbnail(g.iconURL() ?? null)
        .addFields(
          { name: '🦴 Membros',           value: `**${g.memberCount}** (${bots} bots, ${memberIds.length} humanos)`, inline: true  },
          { name: '💬 Canais',            value: `**${g.channels.cache.size}**`,                                     inline: true  },
          { name: '♟️ Cargos',            value: `**${g.roles.cache.size}**`,                                        inline: true  },
          { name: '🕷️ Emojis',            value: `**${g.emojis.cache.size}**`,                                       inline: true  },
          { name: '☁️ Boosts',            value: `**${g.premiumSubscriptionCount ?? 0}** (Tier ${g.premiumTier})`,   inline: true  },
          { name: '📅 Criado em',         value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`,                   inline: true  },
          { name: '🖤 Dono',              value: `<@${g.ownerId}>`,                                                  inline: true  },
          { name: '🧾 Canal de Logs',     value: config.logChannelId ? `<#${config.logChannelId}>` : 'Não configurado', inline: true },
          { name: '📄 Hoje — Entradas',   value: `**${stat?.joins ?? 0}**`,                                          inline: true  },
          { name: '📃 Hoje — Saídas',     value: `**${stat?.leaves ?? 0}**`,                                         inline: true  },
          { name: '🔩 Hoje — Bans',       value: `**${stat?.bans ?? 0}**`,                                           inline: true  },
          { name: '💬 Hoje — Mensagens',  value: `**${(stat?.messages ?? 0).toLocaleString('pt-BR')}**`,             inline: true  },
          { name: '🎁 Sorteios',          value: `**${totalGiveaways}**`,                                            inline: true  },
          { name: '🎫 Tickets',           value: `**${totalTickets}**`,                                              inline: true  },
          { name: '🏅 Conquistas',        value: `**${totalAchievements}**`,                                         inline: true  },
          { name: '🏆 Membro #1',         value: topMember ? `**${topMember.username}** (Nv ${topMember.level})` : 'N/A', inline: true },
        )
        .setFooter({ text: '🖤 Aliança Skyline' })
        .setTimestamp();
      return i.editReply({ embeds: [embed] });
    }

    case 'performance': {
      await i.deferReply({ ephemeral: true });
      const now     = new Date();
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
      const netGrowth     = totalJoins7d - totalLeaves7d;
      const avgPerDay     = stats.length > 0 ? (totalJoins7d / stats.length).toFixed(1) : '0';
      const cls           = getServerClass(allianceServer.memberCount);
      const next          = getNextClass(allianceServer.memberCount);
      const daysToNext    = next && Number(avgPerDay) > 0
        ? Math.ceil(next.needed / Number(avgPerDay))
        : null;

      const statsLines = stats.slice(0, 7).map(s =>
        `\`${s.date}\` +${s.joins} -${s.leaves} (Δ${s.joins - s.leaves >= 0 ? '+' : ''}${s.joins - s.leaves})`
      ).join('\n') || '*Sem dados disponíveis*';

      const embed = baseEmbed(0x470F78)
        .setTitle(`⚙️ Desempenho — ${i.guild!.name}`)
        .setThumbnail(i.guild!.iconURL() ?? null)
        .addFields(
          { name: '🕸️ Classe Atual',         value: `${getAlliancePanelEmoji(cls.name)} **${cls.name}**`,               inline: true },
          { name: '🦴 Membros Atual',          value: `**${allianceServer.memberCount.toLocaleString('pt-BR')}**`,        inline: true },
          { name: '📄 Entradas (7 dias)',       value: `**+${totalJoins7d}**`,                                            inline: true },
          { name: '📃 Saídas (7 dias)',         value: `**-${totalLeaves7d}**`,                                           inline: true },
          { name: '📈 Crescimento Líquido',     value: `**${netGrowth >= 0 ? '+' : ''}${netGrowth}**`,                   inline: true },
          { name: '🎚️ Média Diária (Entradas)', value: `**${avgPerDay}**/dia`,                                           inline: true },
          {
            name:  next ? `🌪️ Próxima Classe: ${getAlliancePanelEmoji(next.cls.name)} ${next.cls.name}` : '🎱 Classe Máxima!',
            value: next
              ? `Faltam **${next.needed.toLocaleString('pt-BR')}** membros` +
                (daysToNext ? ` • estimativa: **~${daysToNext} dias**` : '')
              : 'Você está no topo da aliança!',
            inline: false,
          },
          { name: '🧾 Histórico (últimos 7 dias)', value: statsLines, inline: false },
        )
        .setFooter({ text: '🖤 Aliança Skyline — +entradas / -saídas / (Δ líquido)' })
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
          { name: '🦴 Total membros',     value: `**${(totalH + totalB).toLocaleString('pt-BR')}** (${totalB} bots)`, inline: true },
          { name: '📄 Hoje — Entradas',   value: `**${totalJ}**`,                                                     inline: true },
          { name: '📃 Hoje — Saídas',     value: `**${totalL}**`,                                                     inline: true },
          { name: '🔩 Hoje — Bans',       value: `**${totalBans}**`,                                                  inline: true },
          { name: '💬 Hoje — Mensagens',  value: `**${totalM.toLocaleString('pt-BR')}**`,                              inline: true },
          { name: '🗄️ Servidores',         value: lines.join('\n') || '*Nenhum*',                                      inline: false },
        )
        .setFooter({ text: '🖤 Aliança Skyline — Rede Interna' })
        .setTimestamp();
      return i.editReply({ embeds: [embed] });
    }

    // ── Comunicação e eventos ────────────────────────────────────────────────

    case 'anuncio': {
      const modal = new ModalBuilder().setCustomId('modal:anuncio').setTitle('Criar Anúncio');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('mensagem').setLabel('Mensagem').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('canal').setLabel('ID do canal (vazio = canal atual)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'poll': {
      const modal = new ModalBuilder().setCustomId('modal:poll').setTitle('Criar Enquete');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('pergunta').setLabel('Pergunta').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('opcoes').setLabel('Opções (uma por linha, máx 4)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(400)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('duracao').setLabel('Duração (ex: 1h, 30m, 1d)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'sorteio': {
      const modal = new ModalBuilder().setCustomId('modal:sorteio').setTitle('Criar Sorteio');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('premio').setLabel('Prêmio').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('vencedores').setLabel('Quantidade de vencedores').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('1').setMaxLength(2)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('duracao').setLabel('Duração (ex: 1h, 30m, 1d)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('canal').setLabel('ID do canal (vazio = canal atual)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'encerrar_sorteio': {
      const modal = new ModalBuilder().setCustomId('modal:encerrar_sorteio').setTitle('Encerrar Sorteio');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('id').setLabel('ID do sorteio').setStyle(TextInputStyle.Short).setRequired(true)),
      );
      return i.showModal(modal);
    }

    case 'evento': {
      const modal = new ModalBuilder().setCustomId('modal:evento').setTitle('Criar Evento');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título do evento').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('inicio').setLabel('Início (ex: 2h, 1d, 30m a partir de agora)').setStyle(TextInputStyle.Short).setRequired(true)),
      );
      return i.showModal(modal);
    }

    // ── Recompensas e economia ───────────────────────────────────────────────

    case 'conquista': {
      const modal = new ModalBuilder().setCustomId('modal:conquista').setTitle('Gerenciar Conquistas');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('acao').setLabel('Ação: "criar" ou "dar"').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('nome').setLabel('Nome da conquista').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descrição / ID do usuário (ao dar)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('recompensa').setLabel('Recompensa XP,Moedas (ex: 100,50)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'nivel_reward': {
      const modal = new ModalBuilder().setCustomId('modal:nivel_reward').setTitle('Recompensa por Nível');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('nivel').setLabel('Nível').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('cargo').setLabel('ID do cargo (ou vazio para remover)').setStyle(TextInputStyle.Short).setRequired(false)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('moedas').setLabel('Moedas de recompensa (padrão 0)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'economia': {
      const modal = new ModalBuilder().setCustomId('modal:admin_economia').setTitle('Gerenciar Economia');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('acao').setLabel('Ação: "dar" ou "remover"').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('tipo').setLabel('Tipo: "moedas" ou "xp"').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('usuario').setLabel('ID ou @menção do usuário').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('quantidade').setLabel('Quantidade').setStyle(TextInputStyle.Short).setRequired(true)),
      );
      return i.showModal(modal);
    }

    case 'loja': {
      const modal = new ModalBuilder().setCustomId('modal:admin_loja').setTitle('Gerenciar Loja');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('acao').setLabel('Ação: "criar" ou "remover"').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('nome').setLabel('Nome do item').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('preco').setLabel('Preço em moedas (ao criar)').setStyle(TextInputStyle.Short).setRequired(false)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descrição (ao criar)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(150)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('cargo').setLabel('ID do cargo concedido (ao criar, opcional)').setStyle(TextInputStyle.Short).setRequired(false)),
      );
      return i.showModal(modal);
    }

    case 'rank': {
      const modal = new ModalBuilder().setCustomId('modal:rank').setTitle('Definir Rank');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('usuario').setLabel('ID ou @menção do usuário').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('rank').setLabel('Rank').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(RANKS.join(', '))),
      );
      return i.showModal(modal);
    }

    // ── Gestão do servidor ───────────────────────────────────────────────────

    case 'cargo_menu': {
      const menus = await prisma.selfRoleMenu.findMany({
        where: { guildId },
        include: { entries: true },
        orderBy: { createdAt: 'desc' },
      });
      const embed = baseEmbed(COLORS.DARK)
        .setTitle('🎭 Registro de Cargos')
        .setDescription(
          'Crie menus onde membros escolhem seus próprios cargos com um clique.\n\n' +
          (menus.length
            ? menus.map(m => `**${m.title}** — <#${m.channelId}> — ${m.entries.length} cargo(s)${m.messageId ? ' ✅' : ' ⏳'}`).join('\n')
            : '*Nenhum menu criado ainda.*')
        );
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin:cargo_criar')    .setLabel('Criar Menu')       .setEmoji('🆕').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('admin:cargo_adicionar').setLabel('Adicionar Cargo')  .setEmoji('➕').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('admin:cargo_publicar') .setLabel('Publicar')         .setEmoji('📤').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('admin:cargo_remover')  .setLabel('Remover Cargo')    .setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      );
      return i.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    case 'modulos': {
      await i.deferReply({ ephemeral: true });
      const cfg  = await getConfig(guildId);
      const embed = buildModulosEmbed(cfg as Record<string, unknown>, i.guild!.name);
      const rows  = buildModulosRows(cfg as Record<string, unknown>);
      return i.editReply({ embeds: [embed], components: rows });
    }

    case 'mod': {
      const embed = baseEmbed(COLORS.ERROR ?? 0xED4245)
        .setTitle('🔨 Painel de Moderação')
        .setDescription('Selecione uma ação de moderação abaixo.\nTodas as ações são registradas no canal de logs.')
        .addFields(
          { name: '🔨 Ban',          value: 'Banir um membro permanentemente',  inline: true },
          { name: '👟 Kick',         value: 'Expulsar um membro do servidor',   inline: true },
          { name: '🔇 Mute',         value: 'Silenciar membro por um tempo',    inline: true },
          { name: '🔊 Unmute',       value: 'Remover silêncio de um membro',    inline: true },
          { name: '⚠️ Warn',         value: 'Advertir um membro',              inline: true },
          { name: '📋 Warns',        value: 'Ver histórico de avisos',          inline: true },
          { name: '🗑️ Limpar',       value: 'Deletar mensagens em massa',       inline: true },
          { name: '🚫 Unban',        value: 'Desbanir um usuário pelo ID',      inline: true },
          { name: '🔄 Remover Warn', value: 'Remover último aviso de um membro', inline: true },
          { name: '🐢 Slowmode',     value: 'Definir cooldown de mensagens',    inline: true },
          { name: '🔒 Trancar Canal',value: 'Impedir envio de mensagens',       inline: true },
          { name: '🔓 Destrancar',   value: 'Liberar canal trancado',           inline: true },
        )
        .setTimestamp()
        .setFooter({ text: '⚔️ Aliança Skyline — Moderação' });
      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('mod:ban')    .setLabel('Ban')    .setEmoji('🔨').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('mod:kick')   .setLabel('Kick')   .setEmoji('👟').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('mod:mute')   .setLabel('Mute')   .setEmoji('🔇').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('mod:unmute') .setLabel('Unmute') .setEmoji('🔊').setStyle(ButtonStyle.Secondary),
      );
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('mod:warn')        .setLabel('Warn')        .setEmoji('⚠️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('mod:warns')       .setLabel('Warns')       .setEmoji('📋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('mod:limpar')      .setLabel('Limpar')      .setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('mod:unban')       .setLabel('Unban')       .setEmoji('🚫').setStyle(ButtonStyle.Secondary),
      );
      const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('mod:remover_warn').setLabel('Remover Warn').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('mod:slowmode')    .setLabel('Slowmode')    .setEmoji('🐢').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('mod:lock')        .setLabel('Trancar Canal').setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('mod:unlock')      .setLabel('Destrancar')  .setEmoji('🔓').setStyle(ButtonStyle.Success),
      );
      return i.reply({ embeds: [embed], components: [row1, row2, row3], ephemeral: true });
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
      return i.editReply({ embeds: [successEmbed('Definido', `<@${userId}> agora é **${roleLabel}** do servidor **${server.guildName ?? guildId}**.`)] });
    }

    case 'remove_member': {
      const guildId = resolveId(getField('guild_id') ?? '');
      const userId  = resolveId(getField('user_id') ?? '');
      if (!guildId || !userId) return i.editReply({ embeds: [errorEmbed('Inválido', 'IDs inválidos.')] });
      const existing = await prisma.allianceServerMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
      if (!existing) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Usuário não é rep/dono deste servidor.')] });
      await prisma.allianceServerMember.delete({ where: { guildId_userId: { guildId, userId } } });
      return i.editReply({ embeds: [successEmbed('Removido', `<@${userId}> foi removido como rep/dono do servidor \`${guildId}\`.`)] });
    }

    case 'send_embed': {
      const channelId = resolveId(getField('channel_id') ?? '');
      if (!channelId) return i.editReply({ embeds: [errorEmbed('Inválido', 'ID de canal inválido.')] });
      const guild = i.guild ?? i.client.guilds.cache.find(g => g.channels.cache.has(channelId));
      const ch    = guild?.channels.cache.get(channelId) as TextChannel | undefined;
      if (!ch) return i.editReply({ embeds: [errorEmbed('Não encontrado', `Canal \`${channelId}\` não encontrado.`)] });
      const allianceEmbed = await buildOfficialAllianceEmbed(i.client);
      const msg           = await ch.send({ embeds: [allianceEmbed] });
      await prisma.allianceEmbed.create({
        data: { guildId: guild!.id, channelId, messageId: msg.id },
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
      const servers  = await prisma.allianceServer.findMany();
      let bannedFrom = 0;
      for (const s of servers) {
        const g = i.client.guilds.cache.get(s.guildId);
        if (!g) continue;
        await g.bans.create(userId, { reason: `[Blacklist Aliança] ${reason ?? 'Sem motivo'}` }).catch(() => null);
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

// ─── Modais do servidor (dono/representante) ──────────────────────────────────

export async function handleServidorModal(i: ModalSubmitInteraction, action: string) {
  if (!i.guild) return i.reply({ embeds: [errorEmbed('Erro', 'Use em um servidor.')], ephemeral: true });

  const guildId = i.guild.id;
  const server  = await prisma.allianceServer.findUnique({ where: { guildId } });
  if (!server) return i.reply({ embeds: [errorEmbed('Não Cadastrado', 'Servidor não está na aliança.')], ephemeral: true });

  const isOwner = i.guild.ownerId === i.user.id;
  const isRep   = await isAllianceServerRepresentative(guildId, i.user.id);

  if (!isOwner && !isRep) {
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
  }
}
