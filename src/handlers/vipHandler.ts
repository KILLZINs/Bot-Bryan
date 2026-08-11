// ════════════════════════════════════════════════════════════════════════════
// HANDLER: Sistema de Cargos VIP
// ════════════════════════════════════════════════════════════════════════════
//
// Fluxo:
//  /vip painel → buildVipPanel (ephemeral)
//    [👑 Meu Cargo]          → modal (nome, cor, ícone) → cria/edita cargo pessoal
//    [⭐ Cargo de Favoritos]  → modal (nome, cor, ícone) → cria/edita cargo de favs
//    [👥 Gerenciar Favoritos] → UserSelect para adicionar/remover membros
//    [🗑️ Excluir Meus Cargos] → confirmação → apaga ambos os cargos
//  /vip config (admin) → buildVipAdminPanel
//    [➕ Adicionar VIP]  → RoleSelect → salva role como VIP
//    [➖ Remover VIP]    → StringSelect das roles configuradas → remove
//    [➕ Cargo + Slots]   → RoleSelect + modal → salva slots extras por cargo
//    [➖ Remover + Slots] → StringSelect → remove cargo de slots extras
//    [😀 Personalizar Ícone] → escolhe cargo → modal com emoji Unicode ou URL
//
// ════════════════════════════════════════════════════════════════════════════

import {
  ButtonInteraction, ModalSubmitInteraction,
  UserSelectMenuInteraction, StringSelectMenuInteraction, AnySelectMenuInteraction,
  Guild, GuildMember, Role,
  EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  UserSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder, RoleSelectMenuInteraction,
  ChannelSelectMenuBuilder, ChannelSelectMenuInteraction,
  PermissionFlagsBits, ChannelType,
} from 'discord.js';
import { prisma } from '../database/client';
import { COLORS, baseEmbed, successEmbed, errorEmbed } from '../utils/embeds';
import { createTicketForUser, findOpenTicket } from '../utils/ticketCreation';

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToInt(hex: string): number | null {
  const clean = hex.replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  return parseInt(clean, 16);
}

async function isVip(guild: Guild, userId: string): Promise<boolean> {
  const vipConfigs = await prisma.vipConfig.findMany({ where: { guildId: guild.id } });
  if (!vipConfigs.length) return false;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  return vipConfigs.some(vc => member.roles.cache.has(vc.roleId));
}

async function isAdmin(guild: Guild, userId: string): Promise<boolean> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.ManageGuild) || guild.ownerId === userId;
}

async function getGuildCategory(guild: Guild, channelId: string | null | undefined) {
  if (!channelId) return null;
  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  return channel?.type === ChannelType.GuildCategory ? channel : null;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isUnicodeEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value);
}

async function applyRoleIcon(role: Role, value: string): Promise<void> {
  if (!value) {
    await role.edit({ icon: null, unicodeEmoji: null });
    return;
  }

  if (isHttpUrl(value)) {
    await role.edit({ unicodeEmoji: null });
    await role.setIcon(value);
    return;
  }

  if (!isUnicodeEmoji(value)) {
    throw new Error('Ícone inválido: informe uma URL HTTPS ou um emoji Unicode.');
  }

  await role.edit({ icon: null, unicodeEmoji: value });
}
async function getFavoriteLimit(guild: Guild, userId: string, vipRole?: Awaited<ReturnType<typeof prisma.vipRole.findUnique>>): Promise<number> {
  if (vipRole?.favoriteLimit !== null && vipRole?.favoriteLimit !== undefined) {
    return vipRole.favoriteLimit;
  }

  const [config, member, limitRoles] = await Promise.all([
    prisma.vipGuildConfig.findUnique({ where: { guildId: guild.id } }),
    guild.members.fetch(userId).catch(() => null),
    prisma.vipFavoriteLimitRole.findMany({ where: { guildId: guild.id } }),
  ]);

  const additionalLimit = member
    ? limitRoles
        .filter(limitRole => member.roles.cache.has(limitRole.roleId))
        .reduce((total, limitRole) => total + limitRole.additionalLimit, 0)
    : 0;

  return (config?.defaultFavoriteLimit ?? 3) + additionalLimit;
}

// ── Painel principal VIP ──────────────────────────────────────────────────────

export async function buildVipPanel(
  guild: Guild,
  userId: string,
): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const vipRole = await prisma.vipRole.findUnique({ where: { guildId_userId: { guildId: guild.id, userId } } });

  const personalRole  = vipRole?.personalRoleId  ? guild.roles.cache.get(vipRole.personalRoleId)  : null;
  const favRole       = vipRole?.favRoleId        ? guild.roles.cache.get(vipRole.favRoleId)        : null;
  const favMembers    = vipRole?.favMembers ?? [];
  const vipGuildConfig = await prisma.vipGuildConfig.findUnique({ where: { guildId: guild.id } });
  const favoriteLimit = await getFavoriteLimit(guild, userId, vipRole);
  const gradientCategory = await getGuildCategory(guild, vipGuildConfig?.gradientTicketCategoryId);

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('👑 Painel VIP — Cargos Personalizados')
    .setDescription(
      'Crie e personalize seus próprios cargos exclusivos!\n\n' +
      '**👑 Seu Cargo Pessoal**\n' +
      (personalRole ? `${personalRole} — \`${personalRole.name}\`` : '*(não criado)*') +
      '\n\n**⭐ Cargo de Favoritos**\n' +
      (favRole ? `${favRole} — \`${favRole.name}\`` : '*(não criado)*') +
      '\n\n**👥 Membros no Cargo de Favoritos**\n' +
      (favMembers.length
        ? favMembers.map(id => `<@${id}>`).join(', ')
        : '*(nenhum)*') +
      `\n\n**Limite de favoritos:** ${favMembers.length}/${favoriteLimit}`,
    )
    .setFooter({ text: '⚔️ Aliança Skyline • Sistema VIP' })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vip:personal_modal:' + userId)
      .setLabel(personalRole ? '✏️ Editar Meu Cargo' : '👑 Criar Meu Cargo')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('vip:fav_modal:' + userId)
      .setLabel(favRole ? '✏️ Editar Cargo de Favs' : '⭐ Criar Cargo de Favs')
      .setStyle(ButtonStyle.Success),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vip:manage_favs:' + userId)
      .setLabel('👥 Gerenciar Favoritos')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!favRole),
    new ButtonBuilder()
      .setCustomId('vip:gradient_ticket:' + userId)
      .setLabel('🎨 Personalizar Gradiente')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!gradientCategory || gradientCategory.type !== ChannelType.GuildCategory),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vip:icon_menu:' + userId)
      .setLabel('😀 Personalizar Ícone')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!personalRole && !favRole),
    new ButtonBuilder()
      .setCustomId('vip:delete_confirm:' + userId)
      .setLabel('🗑️ Excluir Meus Cargos')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!personalRole && !favRole),
  );

  return { embed, rows: [row1, row2, row3] };
}

// ── Painel de configuração (admin) ────────────────────────────────────────────

export async function buildVipAdminPanel(
  guild: Guild,
): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const [configs, limitConfigs] = await Promise.all([
    prisma.vipConfig.findMany({ where: { guildId: guild.id } }),
    prisma.vipFavoriteLimitRole.findMany({ where: { guildId: guild.id } }),
  ]);
  const roles = configs.map(c => guild.roles.cache.get(c.roleId)).filter(Boolean);
  const limitRoles = limitConfigs
    .map(config => {
      const role = guild.roles.cache.get(config.roleId);
      return role ? `${role} (+${config.additionalLimit})` : null;
    })
    .filter((role): role is string => role !== null);

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('⚙️ Config VIP — Cargos com Acesso')
    .setDescription(
      'Cargos abaixo dão acesso ao sistema VIP.\n' +
      'Membros com estes cargos poderão criar seus próprios cargos personalizados.\n\n' +
      '**Cargos VIP configurados:**\n' +
      (roles.length ? roles.map(r => `• ${r}`).join('\n') : '*(nenhum configurado)*') +
      '\n\n**Cargos com slots adicionais:**\n' +
      (limitRoles.length ? limitRoles.map(role => `• ${role} slots`).join('\n') : '*(nenhum configurado)*'),
    )
    .setFooter({ text: '⚔️ Aliança Skyline • Config VIP' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vip:admin_add')
      .setLabel('➕ Adicionar Cargo VIP')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('vip:admin_remove')
      .setLabel('➖ Remover Cargo VIP')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(configs.length === 0),
  );

  const configRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vip:admin_status')
      .setLabel('📋 Status')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vip:admin_limit')
      .setLabel('⭐ Limite Padrão')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vip:admin_category')
      .setLabel('🎨 Categoria')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vip:admin_user_limit')
      .setLabel('👤 Limite Individual')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vip:admin_user_reset')
      .setLabel('↩️ Resetar Limite')
      .setStyle(ButtonStyle.Secondary),
  );

  const limitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vip:admin_add_limit_role')
      .setLabel('➕ Cargo + Slots')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('vip:admin_remove_limit_role')
      .setLabel('➖ Remover + Slots')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(limitConfigs.length === 0),
  );

  return { embed, rows: [row, configRow, limitRow] };
}

// ════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ════════════════════════════════════════════════════════════════════════════

export async function handleVipButton(i: ButtonInteraction, action: string, extra: string[]): Promise<void> {
  if (!i.guild) return;

  // ── Configuração VIP: status ───────────────────────────────────────────────
  if (action === 'admin_status') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const [config, overrides] = await Promise.all([
      prisma.vipGuildConfig.findUnique({ where: { guildId: i.guild.id } }),
      prisma.vipRole.count({ where: { guildId: i.guild.id, favoriteLimit: { not: null } } }),
    ]);
    const { embed, rows } = await buildVipAdminPanel(i.guild);
    const status = successEmbed(
      'Configuração VIP',
      `**Limite padrão de favoritos:** ${config?.defaultFavoriteLimit ?? 3}\n` +
        `**Categoria de gradiente:** ${config?.gradientTicketCategoryId ? `<#${config.gradientTicketCategoryId}>` : 'Não configurada'}\n` +
        `**Limites individuais:** ${overrides} usuário(s)`,
    );
    return void i.editReply({ embeds: [status, embed], components: rows });
  }

  // ── Configuração VIP: abrir modal do limite padrão ──────────────────────────
  if (action === 'admin_limit') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    const current = await prisma.vipGuildConfig.findUnique({ where: { guildId: i.guild.id } });
    const modal = new ModalBuilder()
      .setCustomId('vip_modal:admin_limit')
      .setTitle('⭐ Limite Padrão de Favoritos')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('quantity')
            .setLabel('Quantidade máxima por VIP')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(3)
            .setValue(String(current?.defaultFavoriteLimit ?? 3)),
        ),
      );
    return void i.showModal(modal);
  }

  // ── Configuração VIP: selecionar categoria de tickets ───────────────────────
  if (action === 'admin_category') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const select = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('vip_select:admin_category')
        .setPlaceholder('Selecione a categoria dos tickets...')
        .setChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1),
    );
    return void i.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🎨 Categoria dos Tickets').setDescription('Selecione a categoria onde os tickets de personalização serão criados.')],
      components: [select],
    });
  }

  // ── Configuração VIP: adicionar cargo com slots extras ───────────────────────
  if (action === 'admin_add_limit_role') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const select = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('vip_select:admin_add_limit_role')
        .setPlaceholder('Selecione o cargo que dará slots extras...')
        .setMinValues(1)
        .setMaxValues(1),
    );
    return void i.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('➕ Cargo com Slots Adicionais').setDescription('Selecione o cargo que concederá slots extras de favoritos.')],
      components: [select],
    });
  }

  // ── Configuração VIP: remover cargo com slots extras ─────────────────────────
  if (action === 'admin_remove_limit_role') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const limitConfigs = await prisma.vipFavoriteLimitRole.findMany({ where: { guildId: i.guild.id } });
    if (!limitConfigs.length) {
      return void i.editReply({ embeds: [errorEmbed('Nenhum cargo configurado', 'Não há cargos com slots adicionais configurados.')], components: [] });
    }
    const options = limitConfigs.map(config => {
      const role = i.guild!.roles.cache.get(config.roleId);
      return new StringSelectMenuOptionBuilder()
        .setValue(config.roleId)
        .setLabel(role?.name ?? config.roleId)
        .setDescription(`+${config.additionalLimit} slot(s)`);
    });
    const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('vip_select:admin_remove_limit_role')
        .setPlaceholder('Selecione o cargo para remover...')
        .addOptions(options),
    );
    return void i.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.WARNING).setTitle('➖ Remover Cargo com Slots').setDescription('Selecione o cargo que deixará de conceder slots adicionais.')],
      components: [select],
    });
  }

  // ── Configuração VIP: selecionar usuário para limite/reset ──────────────────
  if (action === 'admin_user_limit' || action === 'admin_user_reset') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const select = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`vip_select:${action}`)
        .setPlaceholder('Selecione o usuário VIP...')
        .setMinValues(1)
        .setMaxValues(1),
    );
    return void i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(action === 'admin_user_limit' ? COLORS.INFO : COLORS.WARNING)
          .setTitle(action === 'admin_user_limit' ? '👤 Limite Individual' : '↩️ Resetar Limite Individual')
          .setDescription(action === 'admin_user_limit'
            ? 'Selecione o usuário que receberá um limite personalizado de favoritos.'
            : 'Selecione o usuário que voltará a usar o limite padrão do servidor.'),
      ],
      components: [select],
    });
  }

  // ── Admin: adicionar cargo VIP ─────────────────────────────────────────────
  if (action === 'admin_add') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const select = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('vip_select:admin_add_role')
        .setPlaceholder('Selecione o cargo VIP...')
        .setMinValues(1)
        .setMaxValues(1),
    );
    await i.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('➕ Adicionar Cargo VIP').setDescription('Selecione o cargo que dará acesso ao sistema VIP:')],
      components: [select],
    });
    return;
  }

  // ── Admin: remover cargo VIP ───────────────────────────────────────────────
  if (action === 'admin_remove') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const configs = await prisma.vipConfig.findMany({ where: { guildId: i.guild.id } });
    if (!configs.length) {
      return void i.editReply({ embeds: [errorEmbed('Nenhum VIP', 'Não há cargos VIP configurados.')], components: [] });
    }
    const options = configs.map(c => {
      const role = i.guild!.roles.cache.get(c.roleId);
      return new StringSelectMenuOptionBuilder()
        .setValue(c.roleId)
        .setLabel(role?.name ?? c.roleId)
        .setDescription('ID: ' + c.roleId);
    });
    const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('vip_select:admin_remove_role')
        .setPlaceholder('Selecione o cargo para remover...')
        .addOptions(options),
    );
    await i.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.WARNING).setTitle('➖ Remover Cargo VIP').setDescription('Selecione o cargo a remover da lista de VIPs:')],
      components: [select],
    });
    return;
  }

  // ── Ações do usuário: verifica acesso VIP ─────────────────────────────────
  if (!(await isVip(i.guild, i.user.id))) {
    return void i.reply({ embeds: [errorEmbed('Sem Acesso VIP', 'Você não possui cargo VIP neste servidor.')], ephemeral: true });
  }

  const targetUserId = extra[0] ?? i.user.id;

  // Apenas o próprio usuário pode gerenciar seus cargos
  if (targetUserId !== i.user.id) {
    return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Você só pode gerenciar seus próprios cargos VIP.')], ephemeral: true });
  }

  if (action === 'gradient_ticket') {
    const vipConfig = await prisma.vipGuildConfig.findUnique({ where: { guildId: i.guild.id } });
    const categoryId = vipConfig?.gradientTicketCategoryId;
    const category = await getGuildCategory(i.guild, categoryId);
    if (!categoryId || !category) {
      return void i.reply({
        embeds: [errorEmbed('Gradiente não configurado', 'A categoria de tickets para personalização ainda não foi configurada pelos responsáveis do servidor.')],
        ephemeral: true,
      });
    }

    const existing = await findOpenTicket(i.guild, i.user.id, 'vip_gradiente');
    if (existing) {
      const channel = i.guild.channels.cache.get(existing.channelId);
      return void i.reply({
        embeds: [errorEmbed('Ticket Existente', channel ? `Você já tem um ticket aberto: ${channel}` : 'Você já tem um ticket aberto.')],
        ephemeral: true,
      });
    }

    await i.deferReply({ ephemeral: true });
    const { success } = await createTicketForUser(i.guild, i.user, 'vip_gradiente', {
      parentId: categoryId,
      title: '🎨 Personalização de Gradiente',
      description:
        `Olá ${i.user}! Este ticket é para solicitar um cargo VIP com cor em gradiente.\n\n` +
        'Envie as duas ou mais cores desejadas, o nome do cargo e qualquer referência visual. A equipe vai aplicar o gradiente manualmente.',
    });
    return void i.editReply({ embeds: [success] });
  }

  if (action === 'icon_menu') {
    const vipRole = await prisma.vipRole.findUnique({
      where: { guildId_userId: { guildId: i.guild.id, userId: i.user.id } },
    });
    const personalRole = vipRole?.personalRoleId ? i.guild.roles.cache.get(vipRole.personalRoleId) : null;
    const favRole = vipRole?.favRoleId ? i.guild.roles.cache.get(vipRole.favRoleId) : null;
    const options = [
      personalRole
        ? new StringSelectMenuOptionBuilder()
            .setLabel('Meu Cargo')
            .setValue('personal')
            .setDescription(personalRole.name)
            .setEmoji('👑')
        : null,
      favRole
        ? new StringSelectMenuOptionBuilder()
            .setLabel('Cargo de Favoritos')
            .setValue('fav')
            .setDescription(favRole.name)
            .setEmoji('⭐')
        : null,
    ].filter((option): option is StringSelectMenuOptionBuilder => option !== null);

    if (!options.length) {
      return void i.reply({ embeds: [errorEmbed('Nenhum cargo encontrado', 'Crie primeiro um cargo personalizado ou de favoritos.')], ephemeral: true });
    }

    await i.deferUpdate();
    const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`vip_select:icon_role:${i.user.id}`)
        .setPlaceholder('Selecione o cargo para personalizar...')
        .addOptions(options),
    );
    return void i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle('😀 Personalizar Ícone')
          .setDescription('Escolha o cargo e informe um emoji Unicode, como ⭐, 🔥, 💎 ou 🛡️.'),
      ],
      components: [select],
    });
  }

  // ── Abrir modal: cargo pessoal ─────────────────────────────────────────────
  if (action === 'personal_modal') {
    const vipRole = await prisma.vipRole.findUnique({ where: { guildId_userId: { guildId: i.guild.id, userId: i.user.id } } });
    const existing = vipRole?.personalRoleId ? i.guild.roles.cache.get(vipRole.personalRoleId) : null;

    const modal = new ModalBuilder()
      .setCustomId('vip_modal:personal:' + i.user.id)
      .setTitle('👑 Meu Cargo Personalizado');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Nome do Cargo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setPlaceholder('Ex: ✨ DJ Isaac')
          .setValue(existing?.name ?? ''),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Cor (hex, ex: #9B59B6)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7)
          .setPlaceholder('#9B59B6')
          .setValue(existing ? '#' + existing.color.toString(16).padStart(6, '0') : ''),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('icon')
          .setLabel('URL ou emoji Unicode (opcional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(512)
          .setPlaceholder('https://... ou ⭐'),
      ),
    );

    await i.showModal(modal);
    return;
  }

  // ── Abrir modal: cargo de favoritos ────────────────────────────────────────
  if (action === 'fav_modal') {
    const vipRole = await prisma.vipRole.findUnique({ where: { guildId_userId: { guildId: i.guild.id, userId: i.user.id } } });
    const existing = vipRole?.favRoleId ? i.guild.roles.cache.get(vipRole.favRoleId) : null;

    const modal = new ModalBuilder()
      .setCustomId('vip_modal:fav:' + i.user.id)
      .setTitle('⭐ Cargo de Favoritos');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Nome do Cargo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setPlaceholder('Ex: 💜 Favoritos do Isaac')
          .setValue(existing?.name ?? ''),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Cor (hex, ex: #FF69B4)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7)
          .setPlaceholder('#FF69B4')
          .setValue(existing ? '#' + existing.color.toString(16).padStart(6, '0') : ''),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('icon')
          .setLabel('URL ou emoji Unicode (opcional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(512)
          .setPlaceholder('https://... ou ⭐'),
      ),
    );

    await i.showModal(modal);
    return;
  }

  // ── Gerenciar favoritos: mostrar user select ───────────────────────────────
  if (action === 'manage_favs') {
    await i.deferUpdate();
    const vipRole = await prisma.vipRole.findUnique({ where: { guildId_userId: { guildId: i.guild.id, userId: i.user.id } } });
    const favRole = vipRole?.favRoleId ? i.guild.roles.cache.get(vipRole.favRoleId) : null;
    if (!favRole) {
      return void i.editReply({ embeds: [errorEmbed('Sem Cargo de Favoritos', 'Crie primeiro o cargo de favoritos.')] });
    }

    const favMembers = vipRole?.favMembers ?? [];
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('👥 Gerenciar Favoritos — ' + favRole.name)
      .setDescription(
        '**Selecione um membro para adicionar ou remover do seu cargo de favoritos.**\n' +
        'Se o membro já tiver o cargo, ele será **removido**. Caso contrário, será **adicionado**.\n\n' +
        '**Membros atuais:**\n' +
        (favMembers.length ? favMembers.map(id => `<@${id}>`).join(', ') : '*(nenhum)*'),
      )
      .setFooter({ text: '⚔️ Aliança Skyline • Sistema VIP' });

    const userSelect = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('vip_select:toggle_fav:' + i.user.id)
        .setPlaceholder('Selecione um membro...')
        .setMinValues(1)
        .setMaxValues(1),
    );

    const backBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('vip:refresh_panel:' + i.user.id)
        .setLabel('◀ Voltar ao Painel')
        .setStyle(ButtonStyle.Secondary),
    );

    await i.editReply({ embeds: [embed], components: [userSelect, backBtn] });
    return;
  }

  // ── Confirmar exclusão ────────────────────────────────────────────────────
  if (action === 'delete_confirm') {
    await i.deferUpdate();
    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle('🗑️ Excluir Cargos VIP')
      .setDescription('Tem certeza? Seus cargos personalizados e de favoritos serão **permanentemente excluídos** do servidor.');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('vip:delete_exec:' + i.user.id).setLabel('✅ Confirmar Exclusão').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('vip:refresh_panel:' + i.user.id).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
    );
    await i.editReply({ embeds: [embed], components: [row] });
    return;
  }

  // ── Executar exclusão ─────────────────────────────────────────────────────
  if (action === 'delete_exec') {
    await i.deferUpdate();
    await deleteVipRoles(i.guild, i.user.id);
    const { embed, rows } = await buildVipPanel(i.guild, i.user.id);
    await i.editReply({ embeds: [successEmbed('Cargos Excluídos', 'Seus cargos VIP foram removidos com sucesso.'), embed], components: rows });
    return;
  }

  // ── Recarregar painel ─────────────────────────────────────────────────────
  if (action === 'refresh_panel') {
    await i.deferUpdate();
    const { embed, rows } = await buildVipPanel(i.guild, i.user.id);
    await i.editReply({ embeds: [embed], components: rows });
    return;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL HANDLER
// ════════════════════════════════════════════════════════════════════════════

export async function handleVipModal(i: ModalSubmitInteraction, action: string, extra: string[]): Promise<void> {
  if (!i.guild) return;

  if (action === 'icon') {
    if (!(await isVip(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Acesso VIP', 'Você não possui um cargo VIP neste servidor.')], ephemeral: true });
    }

    const roleType = extra[0];
    const vipRole = await prisma.vipRole.findUnique({
      where: { guildId_userId: { guildId: i.guild.id, userId: i.user.id } },
    });
    const roleId = roleType === 'fav' ? vipRole?.favRoleId : vipRole?.personalRoleId;
    const role = roleId ? i.guild.roles.cache.get(roleId) ?? await i.guild.roles.fetch(roleId).catch(() => null) : null;
    if (!role) {
      return void i.reply({ embeds: [errorEmbed('Cargo não encontrado', 'Esse cargo não existe mais. Atualize o painel VIP e tente novamente.')], ephemeral: true });
    }

    const icon = i.fields.getTextInputValue('icon').trim();
    if (icon && !isHttpUrl(icon) && !isUnicodeEmoji(icon)) {
      return void i.reply({ embeds: [errorEmbed('Ícone inválido', 'Informe uma URL HTTPS ou um emoji Unicode, como ⭐ ou 🔥.')], ephemeral: true });
    }

    try {
      await i.deferUpdate();
      await applyRoleIcon(role, icon);
    } catch (error) {
      console.error('VIP icon error:', error);
      return void i.editReply({
        embeds: [errorEmbed('Não foi possível definir o ícone', 'O Discord recusou esse ícone. Verifique se a URL é HTTPS ou use um emoji Unicode.')],
        components: [],
      });
    }

    const { embed, rows } = await buildVipPanel(i.guild, i.user.id);
    return void i.editReply({
      embeds: [successEmbed('Ícone Atualizado', icon ? `O ícone do cargo foi definido como ${icon}.` : 'O ícone do cargo foi removido.'), embed],
      components: rows,
    });
  }

  if (action === 'admin_limit_role') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    const quantity = Number.parseInt(i.fields.getTextInputValue('quantity').trim(), 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return void i.reply({ embeds: [errorEmbed('Quantidade inválida', 'Informe um número inteiro entre 1 e 100.')], ephemeral: true });
    }
    const roleId = extra[0];
    if (!roleId) {
      return void i.reply({ embeds: [errorEmbed('Cargo não encontrado', 'Selecione novamente o cargo que dará slots extras.')], ephemeral: true });
    }
    await i.deferUpdate();
    await prisma.vipFavoriteLimitRole.upsert({
      where: { guildId_roleId: { guildId: i.guild.id, roleId } },
      update: { additionalLimit: quantity },
      create: { guildId: i.guild.id, roleId, additionalLimit: quantity },
    });
    const { embed, rows } = await buildVipAdminPanel(i.guild);
    return void i.editReply({
      embeds: [successEmbed('Cargo de Slots Configurado', `<@&${roleId}> agora concede **+${quantity}** slot(s) de favoritos.`), embed],
      components: rows,
    });
  }

  if (action === 'admin_limit' || action === 'admin_user_limit') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    const quantity = Number.parseInt(i.fields.getTextInputValue('quantity').trim(), 10);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) {
      return void i.reply({ embeds: [errorEmbed('Quantidade inválida', 'Informe um número inteiro entre 0 e 100.')], ephemeral: true });
    }
    await i.deferUpdate();
    if (action === 'admin_limit') {
      await prisma.vipGuildConfig.upsert({
        where: { guildId: i.guild.id },
        update: { defaultFavoriteLimit: quantity },
        create: { guildId: i.guild.id, defaultFavoriteLimit: quantity },
      });
      const { embed, rows } = await buildVipAdminPanel(i.guild);
      return void i.editReply({
        embeds: [successEmbed('Limite Padrão Atualizado', `O limite padrão agora é de **${quantity}** favorito(s) por usuário VIP.`), embed],
        components: rows,
      });
    }

    const targetId = extra[0];
    if (!targetId) {
      return void i.editReply({ embeds: [errorEmbed('Usuário não encontrado', 'Selecione novamente o usuário VIP.')], components: [] });
    }
    await prisma.vipRole.upsert({
      where: { guildId_userId: { guildId: i.guild.id, userId: targetId } },
      update: { favoriteLimit: quantity },
      create: { guildId: i.guild.id, userId: targetId, favoriteLimit: quantity },
    });
    const { embed, rows } = await buildVipAdminPanel(i.guild);
    return void i.editReply({
      embeds: [successEmbed('Limite Individual Atualizado', `<@${targetId}> agora pode ter até **${quantity}** favorito(s).`), embed],
      components: rows,
    });
  }

  if (!(await isVip(i.guild, i.user.id))) {
    return void i.reply({ embeds: [errorEmbed('Sem Acesso VIP', 'Você não possui cargo VIP neste servidor.')], ephemeral: true });
  }

  await i.deferUpdate();

  const guild  = i.guild;
  const userId = i.user.id;

  const name    = i.fields.getTextInputValue('name').trim();
  const colorRaw = i.fields.getTextInputValue('color').trim();
  const iconUrl  = i.fields.getTextInputValue('icon').trim() || null;
  const colorInt = colorRaw ? (hexToInt(colorRaw) ?? 0x9B59B6) : 0x9B59B6;

  if (iconUrl && !isHttpUrl(iconUrl) && !isUnicodeEmoji(iconUrl)) {
    return void i.reply({
      embeds: [errorEmbed('Ícone inválido', 'Informe uma URL HTTPS ou um emoji Unicode, como ⭐ ou 🔥.')],
      ephemeral: true,
    });
  }

  const isPersonal = action === 'personal';
  const roleType   = isPersonal ? 'personal' : 'fav';

  // Pega ou cria o registro VipRole no banco
  let vipData = await prisma.vipRole.findUnique({ where: { guildId_userId: { guildId: guild.id, userId } } });

  const existingRoleId = isPersonal ? vipData?.personalRoleId : vipData?.favRoleId;
  const existingRole   = existingRoleId ? guild.roles.cache.get(existingRoleId) : null;

  // Posição: logo abaixo do cargo VIP mais alto do usuário
  const botMember = await guild.members.fetchMe();
  const botTopPos = botMember.roles.highest.position;
  const rolePosition = Math.max(1, botTopPos - 1);

  let discordRole;

  if (existingRole) {
    // Editar cargo existente
    discordRole = await existingRole.edit({
      name,
      color: colorInt,
      position: rolePosition,
    }).catch(e => { console.error('VIP edit role error:', e); return existingRole; });

    if (iconUrl) await applyRoleIcon(discordRole, iconUrl);
  } else {
    // Criar novo cargo
    discordRole = await guild.roles.create({
      name,
      color: colorInt,
      position: rolePosition,
      reason: `VIP ${roleType} — criado por ${i.user.tag}`,
    });

    if (iconUrl) await applyRoleIcon(discordRole, iconUrl);
  }

  // Salvar no banco
  if (isPersonal) {
    vipData = await prisma.vipRole.upsert({
      where:  { guildId_userId: { guildId: guild.id, userId } },
      update: { personalRoleId: discordRole.id },
      create: { guildId: guild.id, userId, personalRoleId: discordRole.id },
    });
    // Dar o cargo ao próprio usuário
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) await member.roles.add(discordRole.id).catch(() => null);
  } else {
    vipData = await prisma.vipRole.upsert({
      where:  { guildId_userId: { guildId: guild.id, userId } },
      update: { favRoleId: discordRole.id },
      create: { guildId: guild.id, userId, favRoleId: discordRole.id },
    });
  }

  const { embed, rows } = await buildVipPanel(guild, userId);
  const label = isPersonal ? 'Cargo Pessoal' : 'Cargo de Favoritos';
  await i.editReply({
    embeds: [successEmbed(`✅ ${label} ${existingRole ? 'Atualizado' : 'Criado'}`, `${discordRole} criado com sucesso!`), embed],
    components: rows,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SELECT HANDLER
// ════════════════════════════════════════════════════════════════════════════

export async function handleVipSelect(i: AnySelectMenuInteraction, action: string, extra: string[]): Promise<void> {
  if (!i.guild) return;

  if (action === 'icon_role') {
    if (!(await isVip(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Acesso VIP', 'Você não possui um cargo VIP neste servidor.')], ephemeral: true });
    }

    const roleType = (i as StringSelectMenuInteraction).values[0];
    await i.showModal(
      new ModalBuilder()
        .setCustomId(`vip_modal:icon:${roleType}`)
        .setTitle(roleType === 'fav' ? '⭐ Ícone do Cargo de Favs' : '👑 Ícone do Meu Cargo')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('icon')
              .setLabel('Emoji Unicode ou URL HTTPS')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(512)
              .setPlaceholder('⭐ ou https://...'),
          ),
        ),
    );
    return;
  }

  if (action === 'admin_category') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const category = (i as ChannelSelectMenuInteraction).channels.first();
    if (!category || category.type !== ChannelType.GuildCategory) {
      return void i.editReply({ embeds: [errorEmbed('Categoria inválida', 'Selecione uma categoria de canais do Discord.')], components: [] });
    }
    await prisma.vipGuildConfig.upsert({
      where: { guildId: i.guild.id },
      update: { gradientTicketCategoryId: category.id },
      create: { guildId: i.guild.id, gradientTicketCategoryId: category.id },
    });
    const { embed, rows } = await buildVipAdminPanel(i.guild);
    return void i.editReply({
      embeds: [successEmbed('Categoria Configurada', `Os tickets de personalização de gradiente serão criados em ${category}.`), embed],
      components: rows,
    });
  }

  if (action === 'admin_add_limit_role') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    const roleId = (i as RoleSelectMenuInteraction).values[0];
    const current = await prisma.vipFavoriteLimitRole.findUnique({
      where: { guildId_roleId: { guildId: i.guild.id, roleId } },
    });
    const modal = new ModalBuilder()
      .setCustomId(`vip_modal:admin_limit_role:${roleId}`)
      .setTitle('➕ Slots Adicionais')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('quantity')
            .setLabel('Quantidade de slots adicionais')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(3)
            .setValue(String(current?.additionalLimit ?? 1)),
        ),
      );
    return void i.showModal(modal);
  }

  if (action === 'admin_remove_limit_role') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const roleId = (i as StringSelectMenuInteraction).values[0];
    await prisma.vipFavoriteLimitRole.deleteMany({ where: { guildId: i.guild.id, roleId } });
    const { embed, rows } = await buildVipAdminPanel(i.guild);
    return void i.editReply({
      embeds: [successEmbed('Cargo de Slots Removido', `<@&${roleId}> não concederá mais slots adicionais.`), embed],
      components: rows,
    });
  }

  if (action === 'admin_user_limit') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    const targetId = (i as UserSelectMenuInteraction).values[0];
    const modal = new ModalBuilder()
      .setCustomId(`vip_modal:admin_user_limit:${targetId}`)
      .setTitle('👤 Limite Individual')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('quantity')
            .setLabel('Quantidade máxima de favoritos')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(3),
        ),
      );
    return void i.showModal(modal);
  }

  if (action === 'admin_user_reset') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const targetId = (i as UserSelectMenuInteraction).values[0];
    await prisma.vipRole.updateMany({
      where: { guildId: i.guild.id, userId: targetId },
      data: { favoriteLimit: null },
    });
    const { embed, rows } = await buildVipAdminPanel(i.guild);
    return void i.editReply({
      embeds: [successEmbed('Limite Individual Removido', `<@${targetId}> voltou a usar o limite padrão do servidor.`), embed],
      components: rows,
    });
  }

  // ── Admin: adicionar cargo VIP ─────────────────────────────────────────────
  if (action === 'admin_add_role') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const roleId = (i as RoleSelectMenuInteraction).values[0];
    await prisma.vipConfig.upsert({
      where:  { guildId_roleId: { guildId: i.guild.id, roleId } },
      update: {},
      create: { guildId: i.guild.id, roleId },
    });
    const { embed, rows } = await buildVipAdminPanel(i.guild);
    await i.editReply({ embeds: [successEmbed('Cargo VIP Adicionado', `<@&${roleId}> agora dá acesso ao sistema VIP.`), embed], components: rows });
    return;
  }

  // ── Admin: remover cargo VIP ───────────────────────────────────────────────
  if (action === 'admin_remove_role') {
    if (!(await isAdmin(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem usar isto.')], ephemeral: true });
    }
    await i.deferUpdate();
    const roleId = (i as StringSelectMenuInteraction).values[0];
    await prisma.vipConfig.deleteMany({ where: { guildId: i.guild.id, roleId } });
    const { embed, rows } = await buildVipAdminPanel(i.guild);
    await i.editReply({ embeds: [successEmbed('Cargo VIP Removido', `<@&${roleId}> não dá mais acesso ao sistema VIP.`), embed], components: rows });
    return;
  }

  // ── Toggle favorito (adicionar ou remover membro do cargo de favs) ─────────
  if (action === 'toggle_fav') {
    if (!(await isVip(i.guild, i.user.id))) {
      return void i.reply({ embeds: [errorEmbed('Sem Acesso VIP', 'Você não possui cargo VIP neste servidor.')], ephemeral: true });
    }
    await i.deferUpdate();

    const ownerId  = extra[0] ?? i.user.id;
    if (ownerId !== i.user.id) {
      return void i.editReply({ embeds: [errorEmbed('Sem Permissão', 'Você só pode gerenciar seus próprios favoritos.')] });
    }

    const targetId = (i as UserSelectMenuInteraction).values[0];

    // Não permitir que o próprio usuário entre no cargo de favoritos
    if (targetId === i.user.id) {
      return void i.editReply({ embeds: [errorEmbed('Inválido', 'Você não pode adicionar a si mesmo ao cargo de favoritos.')] });
    }

    const vipData = await prisma.vipRole.findUnique({ where: { guildId_userId: { guildId: i.guild.id, userId: i.user.id } } });
    if (!vipData?.favRoleId) {
      return void i.editReply({ embeds: [errorEmbed('Sem Cargo de Favoritos', 'Crie primeiro o cargo de favoritos.')] });
    }

    const favRole      = i.guild.roles.cache.get(vipData.favRoleId);
    const targetMember = await i.guild.members.fetch(targetId).catch(() => null);

    if (!favRole || !targetMember) {
      return void i.editReply({ embeds: [errorEmbed('Não Encontrado', 'Cargo ou membro não encontrado.')] });
    }

    const alreadyHas = vipData.favMembers.includes(targetId);

    if (alreadyHas) {
      // Remover
      await targetMember.roles.remove(favRole.id).catch(() => null);
      await prisma.vipRole.update({
        where:  { guildId_userId: { guildId: i.guild.id, userId: i.user.id } },
        data:   { favMembers: { set: vipData.favMembers.filter(id => id !== targetId) } },
      });
    } else {
      const favoriteLimit = await getFavoriteLimit(i.guild, i.user.id, vipData);
      if (vipData.favMembers.length >= favoriteLimit) {
        return void i.editReply({
          embeds: [errorEmbed('Limite de Favoritos Atingido', `Seu limite atual é de **${favoriteLimit}** favorito(s). Fale com os responsáveis para adquirir slots adicionais.`)],
        });
      }

      // Adicionar
      await targetMember.roles.add(favRole.id).catch(() => null);
      await prisma.vipRole.update({
        where:  { guildId_userId: { guildId: i.guild.id, userId: i.user.id } },
        data:   { favMembers: { push: targetId } },
      });
    }

    // Recarregar painel de gerenciamento
    const updatedData  = await prisma.vipRole.findUnique({ where: { guildId_userId: { guildId: i.guild.id, userId: i.user.id } } });
    const favMembers   = updatedData?.favMembers ?? [];

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('👥 Gerenciar Favoritos — ' + favRole.name)
      .setDescription(
        '**Selecione um membro para adicionar ou remover do seu cargo de favoritos.**\n' +
        'Se o membro já tiver o cargo, ele será **removido**. Caso contrário, será **adicionado**.\n\n' +
        `**${alreadyHas ? '➖ Removido:' : '➕ Adicionado:'}** ${targetMember}\n\n` +
        '**Membros atuais:**\n' +
        (favMembers.length ? favMembers.map(id => `<@${id}>`).join(', ') : '*(nenhum)*'),
      )
      .setFooter({ text: '⚔️ Aliança Skyline • Sistema VIP' });

    const userSelect = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('vip_select:toggle_fav:' + i.user.id)
        .setPlaceholder('Selecione um membro...')
        .setMinValues(1)
        .setMaxValues(1),
    );

    const backBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('vip:refresh_panel:' + i.user.id)
        .setLabel('◀ Voltar ao Painel')
        .setStyle(ButtonStyle.Secondary),
    );

    await i.editReply({ embeds: [embed], components: [userSelect, backBtn] });
    return;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER: Excluir cargos VIP de um usuário (chamado por guildMemberUpdate)
// ════════════════════════════════════════════════════════════════════════════

export async function deleteVipRoles(guild: Guild, userId: string): Promise<void> {
  const vipData = await prisma.vipRole.findUnique({ where: { guildId_userId: { guildId: guild.id, userId } } });
  if (!vipData) return;

  // Remover o cargo de favoritos de todos os membros que o têm
  if (vipData.favRoleId) {
    const favRole = guild.roles.cache.get(vipData.favRoleId);
    if (favRole) {
      await favRole.delete(`VIP perdido por ${userId}`).catch(() => null);
    }
  }

  // Remover o cargo pessoal
  if (vipData.personalRoleId) {
    const personalRole = guild.roles.cache.get(vipData.personalRoleId);
    if (personalRole) {
      await personalRole.delete(`VIP perdido por ${userId}`).catch(() => null);
    }
  }

  // Limpar o banco
  await prisma.vipRole.delete({ where: { guildId_userId: { guildId: guild.id, userId } } }).catch(() => null);
}
