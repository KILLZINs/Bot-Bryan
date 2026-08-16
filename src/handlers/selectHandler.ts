import {
  AnySelectMenuInteraction, StringSelectMenuInteraction, RoleSelectMenuInteraction, ChannelSelectMenuInteraction,
  TextChannel, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  GuildMember,
} from 'discord.js';
import { prisma } from '../database/client';
import { getConfig } from '../utils/helpers';
import { COLORS, EMOJIS, baseEmbed, successEmbed, errorEmbed } from '../utils/embeds';
import { applyTemplate } from '../utils/embedTemplates';
import { createTicketForUser, findOpenTicket, removeStaleTicket } from '../utils/ticketCreation';

export async function handleSelect(interaction: AnySelectMenuInteraction) {
  const parts = interaction.customId.split(':');
  const prefix = parts[0];
  const action = parts[1];
  try {
    if (prefix === 'ticket' && action === 'category') return await ticketCategory(interaction as StringSelectMenuInteraction);
    if (prefix === 'ticket_staff' && action === 'action') return await ticketStaffAction(interaction as StringSelectMenuInteraction, parts[2]);
    
    // ── Interceptador da Loja de Cosméticos ──────────────────────────────────
    if (prefix === 'rpg_select' && (action === 'comprar_cosmetico' || action === 'comprar_cosmetico_bg')) {
      return await rpgCosmetics(interaction as StringSelectMenuInteraction, action);
    }
    // ── Roteador Padrão do RPG ────────────────────────────────────────────────
    if (prefix === 'rpg_select') return await (await import('./../rpg/handlers/rpgSelectHandler')).handleRpgSelect(interaction as StringSelectMenuInteraction, action);
    
    if (prefix === 'selfrole' && action === 'choose') return await selfRoleChoose(interaction as StringSelectMenuInteraction);
    if (prefix === 'selfrole' && action === 'add')    return await selfRoleAdd(interaction as StringSelectMenuInteraction);
    if (prefix === 'selfrole' && action === 'remove') return await selfRoleRemove(interaction as StringSelectMenuInteraction);
    if (prefix === 'selfrole_admin') return await selfRoleAdminSelect(interaction, action, parts);
    if (prefix === 'vip_select')     return await (await import('./vipHandler')).handleVipSelect(interaction, action, parts.slice(2));
  } catch (err) {
    console.error('Select error:', err);
    const e = errorEmbed('Erro', 'Ocorreu um erro ao processar esta ação.');
    if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [e], ephemeral: true });
    else await interaction.reply({ embeds: [e], ephemeral: true });
  }
}

async function ticketCategory(i: StringSelectMenuInteraction) {
  await i.deferReply({ ephemeral: true });

  const category = i.values[0];
  const guild = i.guild!;
  const user = i.user;

  const existing = await findOpenTicket(guild, user.id);
  if (existing) {
    const ch = guild.channels.cache.get(existing.channelId);
    if (ch) return i.editReply({ embeds: [errorEmbed('Ticket Existente', `Você já tem um ticket aberto: ${ch}`)] });
    await removeStaleTicket(existing.id);
  }

  const { success } = await createTicketForUser(guild, user, category);
  await i.editReply({ embeds: [success] });
}

// ── Ticket Staff Panel ────────────────────────────────────────────────────────
async function ticketStaffAction(i: StringSelectMenuInteraction, ticketId: string) {
  // Permission: moderator or admin
  const member = i.member as GuildMember;
  const config = await getConfig(i.guild!.id);
  const isMod  = i.guild!.ownerId === i.user.id
    || member.permissions.has('ManageGuild')
    || (config.modRoleId   ? member.roles.cache.has(config.modRoleId)   : false)
    || (config.adminRoleId ? member.roles.cache.has(config.adminRoleId) : false);
  if (!isMod) {
    return i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas staff pode usar este painel.')], ephemeral: true });
  }

  const action = i.values[0];
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return i.reply({ embeds: [errorEmbed('Não encontrado', 'Ticket não encontrado.')], ephemeral: true });

  const guild = i.guild!;

  // ── criar_call ────────────────────────────────────────────────────────────────
  if (action === 'criar_call') {
    await i.deferReply({ ephemeral: true });
    if (ticket.voiceChannelId) {
      const existing = guild.channels.cache.get(ticket.voiceChannelId);
      if (existing) return i.editReply({ embeds: [errorEmbed('Call Já Existe', `Canal de voz já criado: <#${ticket.voiceChannelId}>`)] });
    }
    const textCh = guild.channels.cache.get(ticket.channelId);
    const voiceCh = await guild.channels.create({
      name: `📞 call-ticket-${ticket.id.slice(-6)}`,
      type: ChannelType.GuildVoice,
      parent: textCh?.parentId ?? undefined,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: ticket.authorId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
        ...(config.modRoleId   ? [{ id: config.modRoleId,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers] }] : []),
        ...(config.adminRoleId ? [{ id: config.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers] }] : []),
      ],
    });
    await prisma.ticket.update({ where: { id: ticketId }, data: { voiceChannelId: voiceCh.id } });
    return i.editReply({ embeds: [successEmbed('Call Criada', `Canal de voz criado: <#${voiceCh.id}>`)] });
  }

  // ── deletar_call ──────────────────────────────────────────────────────────────
  if (action === 'deletar_call') {
    await i.deferReply({ ephemeral: true });
    if (!ticket.voiceChannelId) return i.editReply({ embeds: [errorEmbed('Sem Call', 'Não há canal de voz associado a este ticket.')] });
    const voiceCh = guild.channels.cache.get(ticket.voiceChannelId);
    if (voiceCh) await voiceCh.delete().catch(() => null);
    await prisma.ticket.update({ where: { id: ticketId }, data: { voiceChannelId: null } });
    return i.editReply({ embeds: [successEmbed('Call Deletada', 'Canal de voz removido.')] });
  }

  // ── adicionar_membro ──────────────────────────────────────────────────────────
  if (action === 'adicionar_membro') {
    const { ModalBuilder: MB, TextInputBuilder: TIB, TextInputStyle: TIS, ActionRowBuilder: ARB } = await import('discord.js');
    const modal = new MB().setCustomId(`ticket_modal:add_member:${ticketId}`).setTitle('Adicionar Membro ao Ticket');
    modal.addComponents(
      new ARB<any>().addComponents(
        new TIB().setCustomId('user_id').setLabel('ID ou menção do usuário').setStyle(TIS.Short).setRequired(true).setPlaceholder('ex: 123456789012345678 ou @usuario'),
      ),
    );
    return i.showModal(modal);
  }

  // ── remover_membro ────────────────────────────────────────────────────────────
  if (action === 'remover_membro') {
    const { ModalBuilder: MB, TextInputBuilder: TIB, TextInputStyle: TIS, ActionRowBuilder: ARB } = await import('discord.js');
    const modal = new MB().setCustomId(`ticket_modal:remove_member:${ticketId}`).setTitle('Remover Membro do Ticket');
    modal.addComponents(
      new ARB<any>().addComponents(
        new TIB().setCustomId('user_id').setLabel('ID ou menção do usuário').setStyle(TIS.Short).setRequired(true).setPlaceholder('ex: 123456789012345678 ou @usuario'),
      ),
    );
    return i.showModal(modal);
  }

  // ── fechar_ticket ─────────────────────────────────────────────────────────────
  if (action === 'fechar_ticket') {
    await i.deferReply({ ephemeral: true });
    if (ticket.status === 'closed') return i.editReply({ embeds: [errorEmbed('Já Fechado', 'Este ticket já está fechado.')] });
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'closed', closedAt: new Date() } });

    if (config.ticketLogChannelId) {
      const logCh = guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
      if (logCh) await logCh.send({ embeds: [baseEmbed(COLORS.ERROR).setTitle('🎫 Ticket Fechado').addFields({ name: 'Fechado por', value: i.user.tag, inline: true }, { name: 'Canal', value: ticket.channelId, inline: true })] });
    }

    // DM de avaliação
    try {
      const author = await i.client.users.fetch(ticket.authorId).catch(() => null);
      if (author) {
        const dmEmbed = baseEmbed(COLORS.PRIMARY)
          .setTitle('📝 Como foi seu atendimento?')
          .setDescription(`Seu ticket no servidor **${guild.name}** foi encerrado.\n\nAvalie o atendimento clicando em uma das estrelas abaixo.`)
          .setFooter({ text: '⚔️ Aliança Skyline' });
        const { ButtonBuilder: BB, ButtonStyle: BS2, ActionRowBuilder: AR2 } = await import('discord.js');
        const fbRow = new AR2<any>().addComponents(
          new BB().setCustomId(`ticket_fb:1:${ticket.id}:${guild.id}:${i.user.id}`).setLabel('⭐').setStyle(BS2.Secondary),
          new BB().setCustomId(`ticket_fb:2:${ticket.id}:${guild.id}:${i.user.id}`).setLabel('⭐⭐').setStyle(BS2.Secondary),
          new BB().setCustomId(`ticket_fb:3:${ticket.id}:${guild.id}:${i.user.id}`).setLabel('⭐⭐⭐').setStyle(BS2.Primary),
          new BB().setCustomId(`ticket_fb:4:${ticket.id}:${guild.id}:${i.user.id}`).setLabel('⭐⭐⭐⭐').setStyle(BS2.Primary),
          new BB().setCustomId(`ticket_fb:5:${ticket.id}:${guild.id}:${i.user.id}`).setLabel('⭐⭐⭐⭐⭐').setStyle(BS2.Success),
        );
        await author.send({ embeds: [dmEmbed], components: [fbRow] }).catch(() => null);
      }
    } catch { /* DMs fechadas */ }

    await i.editReply({ embeds: [successEmbed('Ticket Fechado', 'Este canal será deletado em 5 segundos.')] });

    setTimeout(async () => {
      if (ticket.voiceChannelId) {
        const vc = guild.channels.cache.get(ticket.voiceChannelId);
        if (vc) await vc.delete().catch(() => null);
      }
      const ch = guild.channels.cache.get(ticket.channelId);
      if (ch) await ch.delete().catch(() => null);
    }, 5000);
  }
}

// ── Selfrole — toggle legado (backward compat com mensagens antigas) ─────────
async function selfRoleChoose(i: StringSelectMenuInteraction) {
  const roleId = i.values[0];
  await i.deferReply({ ephemeral: true });

  const member = i.member as GuildMember;
  if (!member) return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Não foi possível verificar seu perfil.')] });

  const role = i.guild?.roles.cache.get(roleId);
  if (!role) return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Este cargo não existe mais no servidor.')] });

  const hasRole = member.roles.cache.has(roleId);
  try {
    if (hasRole) {
      await member.roles.remove(roleId);
      return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription(`❌ O cargo ${role} foi **removido** do seu perfil.`)] });
    } else {
      await member.roles.add(roleId);
      return i.editReply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ O cargo ${role} foi **adicionado** ao seu perfil!`)] });
    }
  } catch {
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Não foi possível alterar o cargo. Verifique se o bot tem permissão de gerenciar cargos.')] });
  }
}

// ── Selfrole — adicionar cargo explicitamente ─────────────────────────────────
async function selfRoleAdd(i: StringSelectMenuInteraction) {
  const roleId = i.values[0];
  await i.deferReply({ ephemeral: true });

  const member = i.member as GuildMember;
  if (!member) return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Não foi possível verificar seu perfil.')] });

  const role = i.guild?.roles.cache.get(roleId);
  if (!role) return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Este cargo não existe mais no servidor.')] });

  if (member.roles.cache.has(roleId)) {
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0xF39C12).setDescription(`⚠️ Você já possui o cargo ${role}. Use o menu **🗑️ Remover** para removê-lo.`)] });
  }
  try {
    await member.roles.add(roleId);
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ O cargo ${role} foi **adicionado** ao seu perfil!`)] });
  } catch {
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Não foi possível adicionar o cargo. Verifique se o bot tem permissão de gerenciar cargos.')] });
  }
}

// ── Selfrole — remover cargo explicitamente ───────────────────────────────────
async function selfRoleRemove(i: StringSelectMenuInteraction) {
  const roleId = i.values[0];
  await i.deferReply({ ephemeral: true });

  const member = i.member as GuildMember;
  if (!member) return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Não foi possível verificar seu perfil.')] });

  const role = i.guild?.roles.cache.get(roleId);
  if (!role) return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Este cargo não existe mais no servidor.')] });

  if (!member.roles.cache.has(roleId)) {
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0xF39C12).setDescription(`⚠️ Você não possui o cargo ${role}.`)] });
  }
  try {
    await member.roles.remove(roleId);
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription(`🗑️ O cargo ${role} foi **removido** do seu perfil.`)] });
  } catch {
    return i.editReply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('❌ Não foi possível remover o cargo. Verifique se o bot tem permissão de gerenciar cargos.')] });
  }
}

// ── Selfrole Admin — select menu handlers ────────────────────────────────────
async function selfRoleAdminSelect(i: AnySelectMenuInteraction, action: string, parts: string[]) {
  const { checkAdmin } = await import('../utils/permissions');
  if (!(await checkAdmin(i as any))) return;
  await i.deferUpdate();

  const guildId = i.guildId!;
  const { prisma } = await import('../database/client');
  const { errorEmbed, successEmbed, baseEmbed } = await import('../utils/embeds');
  const COLORS = { DARK: 0x2C3E50 as number };

  // ── canal_for_criar: abre modal de título/descrição após escolher canal ──
  if (action === 'channel_for_criar') {
    const chanId = (i as ChannelSelectMenuInteraction).values[0];
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder: AR } = await import('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`cargo_menu:criar:${chanId}`)
      .setTitle('Criar Menu de Cargos — Passo 2/2');
    modal.addComponents(
      new AR<any>().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título do menu').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('Ex: 🎭 Escolha seus cargos')),
      new AR<any>().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descrição (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
    );
    return i.followUp({ content: '\u200b', components: [] }).then(() => (i as any).showModal(modal)).catch(async () => {
      // fallback: can't show modal after deferUpdate, send follow-up with instructions
      await i.editReply({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle('Passo 2 — Defina o Título').setDescription(`Canal selecionado: <#${chanId}>\n\nComo não é possível abrir um modal após selecionar o canal, clique em **🆕 Criar Menu** novamente e desta vez use o canal <#${chanId}>. Vamos melhorar isso em breve!`)], components: [] });
    });
  }

  // ── menu_for_add: escolheu o menu, mostrar seletor de cargo ──────────────
  if (action === 'menu_for_add') {
    const menuId = (i as StringSelectMenuInteraction).values[0];
    const menu = await prisma.selfRoleMenu.findUnique({ where: { id: menuId }, include: { entries: true } });
    if (!menu) return i.editReply({ embeds: [errorEmbed('Menu não encontrado', 'Este menu não existe mais.')], components: [] });
    if (menu.entries.length >= 25) return i.editReply({ embeds: [errorEmbed('Limite', 'Este menu já tem 25 cargos (máximo).')], components: [] });

    const embed = new EmbedBuilder().setColor(COLORS.DARK)
      .setTitle(`➕ Adicionar Cargo — ${menu.title}`)
      .setDescription(`Selecione o **cargo** que deseja adicionar.\n> Atualmente: **${menu.entries.length}** cargo(s)`);
    const { RoleSelectMenuBuilder: RSM, ActionRowBuilder: AR2 } = await import('discord.js');
    const roleSelect = new AR2<any>().addComponents(
      new RSM().setCustomId(`selfrole_admin:add_role:${menuId}`).setPlaceholder('🎭 Selecione o cargo a adicionar...'),
    );
    return i.editReply({ embeds: [embed], components: [roleSelect] });
  }

  // ── add_role: recebe o cargo selecionado pelo RoleSelectMenu ─────────────
  if (action === 'add_role') {
    const menuId = parts[2];
    const roleId = (i as RoleSelectMenuInteraction).values[0];
    const role = i.guild?.roles.cache.get(roleId);
    if (!role) return i.editReply({ embeds: [errorEmbed('Cargo inválido', 'Este cargo não foi encontrado.')], components: [] });

    const menu = await prisma.selfRoleMenu.findUnique({ where: { id: menuId }, include: { entries: true } });
    if (!menu) return i.editReply({ embeds: [errorEmbed('Menu não encontrado', 'Este menu não existe mais.')], components: [] });
    if (menu.entries.length >= 25) return i.editReply({ embeds: [errorEmbed('Limite', 'Este menu já atingiu o máximo de 25 cargos.')], components: [] });
    if (menu.entries.some(e => e.roleId === roleId)) return i.editReply({ embeds: [errorEmbed('Já existe', `O cargo ${role} já está neste menu.`)], components: [] });

    const label = role.name.slice(0, 80);
    await prisma.selfRoleEntry.create({ data: { menuId, roleId, label, emoji: null } });
    const count = await prisma.selfRoleEntry.count({ where: { menuId } });

    const { ButtonBuilder: BB, ButtonStyle: BS, ActionRowBuilder: AR3 } = await import('discord.js');
    const row = new AR3<any>().addComponents(
      new BB().setCustomId(`selfrole_admin:confirm_pub:${menuId}`).setLabel('📤 Publicar Agora').setStyle(BS.Success),
    );
    return i.editReply({
      embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('✅ Cargo Adicionado!').setDescription(`**${role.name}** adicionado ao menu **${menu.title}**.\nTotal: **${count}** cargo(s).\n\nClique em **📤 Publicar Agora** para atualizar o menu, ou feche para publicar depois.`)],
      components: [row],
    });
  }

  // ── menu_for_rem: escolheu o menu, mostrar lista de entradas ─────────────
  if (action === 'menu_for_rem') {
    const menuId = (i as StringSelectMenuInteraction).values[0];
    const menu = await prisma.selfRoleMenu.findUnique({ where: { id: menuId }, include: { entries: true } });
    if (!menu) return i.editReply({ embeds: [errorEmbed('Menu não encontrado', 'Este menu não existe mais.')], components: [] });
    if (!menu.entries.length) return i.editReply({ embeds: [errorEmbed('Menu Vazio', 'Este menu não tem cargos para remover.')], components: [] });

    const embed = new EmbedBuilder().setColor(COLORS.DARK)
      .setTitle(`🗑️ Remover Cargo — ${menu.title}`)
      .setDescription('Selecione o cargo que deseja remover:');
    const { StringSelectMenuBuilder: SSM, StringSelectMenuOptionBuilder: SSOB, ActionRowBuilder: AR4 } = await import('discord.js');
    const entrySelect = new AR4<any>().addComponents(
      new SSM()
        .setCustomId(`selfrole_admin:rem_entry:${menuId}`)
        .setPlaceholder('🗑️ Selecione o cargo a remover...')
        .addOptions(
          menu.entries.map(e =>
            new SSOB().setValue(e.id).setLabel(e.label.slice(0, 100)).setDescription(`ID: ${e.roleId}`).setEmoji({ name: '🏷️' })
          )
        ),
    );
    return i.editReply({ embeds: [embed], components: [entrySelect] });
  }

  // ── rem_entry: recebe a entrada a remover ─────────────────────────────────
  if (action === 'rem_entry') {
    const menuId = parts[2];
    const entryId = (i as StringSelectMenuInteraction).values[0];
    const entry = await prisma.selfRoleEntry.findUnique({ where: { id: entryId } });
    if (!entry) return i.editReply({ embeds: [errorEmbed('Não encontrado', 'Esta entrada não existe mais.')], components: [] });

    await prisma.selfRoleEntry.delete({ where: { id: entryId } });
    const remaining = await prisma.selfRoleEntry.count({ where: { menuId } });

    const { ButtonBuilder: BB2, ButtonStyle: BS2, ActionRowBuilder: AR5 } = await import('discord.js');
    const row = new AR5<any>().addComponents(
      new BB2().setCustomId(`selfrole_admin:confirm_pub:${menuId}`).setLabel('📤 Publicar Agora').setStyle(BS2.Primary),
    );
    return i.editReply({
      embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('✅ Cargo Removido!').setDescription(`**${entry.label}** removido do menu.\nRestam **${remaining}** cargo(s).\n\nClique em **📤 Publicar Agora** para atualizar o menu.`)],
      components: [row],
    });
  }

  // ── menu_for_pub: escolheu o menu, mostrar botão de confirmação ──────────
  if (action === 'menu_for_pub') {
    const menuId = (i as StringSelectMenuInteraction).values[0];
    const menu = await prisma.selfRoleMenu.findUnique({ where: { id: menuId }, include: { entries: true } });
    if (!menu) return i.editReply({ embeds: [errorEmbed('Menu não encontrado', 'Este menu não existe mais.')], components: [] });
    if (!menu.entries.length) return i.editReply({ embeds: [errorEmbed('Menu Vazio', 'Adicione pelo menos um cargo antes de publicar.')], components: [] });

    const embed = new EmbedBuilder().setColor(COLORS.DARK)
      .setTitle(`📤 Publicar — ${menu.title}`)
      .setDescription(
        `Canal: <#${menu.channelId}>\n` +
        `Cargos: **${menu.entries.length}**\n` +
        (menu.messageId ? '> ✅ Já publicado — será **atualizado**.' : '> ⏳ Ainda não publicado — será **enviado**.') +
        '\n\nConfirme para publicar:'
      )
      .addFields({ name: '🏷️ Cargos no menu', value: menu.entries.map(e => `${e.emoji ?? '•'} ${e.label}`).join('\n').slice(0, 1000) || 'Nenhum' });

    const { ButtonBuilder: BB3, ButtonStyle: BS3, ActionRowBuilder: AR6 } = await import('discord.js');
    const row = new AR6<any>().addComponents(
      new BB3().setCustomId(`selfrole_admin:confirm_pub:${menuId}`).setLabel('✅ Confirmar Publicação').setStyle(BS3.Success),
    );
    return i.editReply({ embeds: [embed], components: [row] });
  }
}

// ── Loja de Cosméticos (Títulos e Fundos) ────────────────────────────────────
async function rpgCosmetics(i: StringSelectMenuInteraction, action: string) {
  await i.deferReply({ ephemeral: true });

  const isBg = action === 'comprar_cosmetico_bg';
  const selectedValue = i.values[0]; 
  const [, itemId] = selectedValue.split(':');

  const { COSMETIC_TITLES, COSMETIC_BACKGROUNDS } = await import('../rpg/constants/cosmetics');
  const { getCharacter } = await import('../rpg/services/character');
  const { prisma } = await import('../database/client');

  const char = await getCharacter(i.user.id);
  if (!char) {
    return i.editReply({ content: '❌ Você ainda não tem um personagem. Use `/rpg start`.' });
  }

  const item = isBg ? COSMETIC_BACKGROUNDS[itemId] : COSMETIC_TITLES[itemId];
  if (!item) return i.editReply({ content: '❌ Item não encontrado na loja.' });

  // Forçamos o tipo (any) para o TypeScript aceitar .name ou .label sem chorar
  const itemName = isBg ? (item as any).name : (item as any).label;
  
  const ownedList = isBg 
    ? (char.unlockedBackgrounds ? char.unlockedBackgrounds.split(',') : [])
    : (char.unlockedTitles ? char.unlockedTitles.split(',') : []);

  const isEquipped = isBg ? char.activeBackground === itemId : char.activeTitle === itemId;
  const isOwned = ownedList.includes(itemId);

  // Ação 1: Desequipar
  if (isEquipped) {
    await prisma.rpgCharacter.update({
      where: { discordId: i.user.id },
      data: isBg ? { activeBackground: null } : { activeTitle: null }
    });
    return i.editReply({ content: `✅ Você desequipou o ${isBg ? 'fundo' : 'título'} **${itemName}**.` });
  }

  // Ação 2: Equipar (se já possui)
  if (isOwned) {
    await prisma.rpgCharacter.update({
      where: { discordId: i.user.id },
      data: isBg ? { activeBackground: itemId } : { activeTitle: itemId }
    });
    return i.editReply({ content: `✨ Você equipou o ${isBg ? 'fundo' : 'título'} **${itemName}**! Veja seu \`/rpg perfil\`.` });
  }

  // Ação 3: Comprar
  if (char.gold < item.price) {
    return i.editReply({ content: `❌ Você não tem Ouro suficiente! Custa **${item.price.toLocaleString('pt-BR')}**, mas você só tem **${char.gold.toLocaleString('pt-BR')}**.` });
  }

  ownedList.push(itemId);
  const newOwnedString = ownedList.join(',');

  await prisma.rpgCharacter.update({
    where: { discordId: i.user.id },
    data: {
      gold: { decrement: item.price },
      ...(isBg 
        ? { unlockedBackgrounds: newOwnedString, activeBackground: itemId } 
        : { unlockedTitles: newOwnedString, activeTitle: itemId })
    }
  });

  return i.editReply({ content: `🛍️ Compra realizada com sucesso! Você comprou e equipou **${itemName}** por ${item.price.toLocaleString('pt-BR')} Ouro!` });
}
