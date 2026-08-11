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

    // ── Tratamento dos Seletores do RPG (Compatibilidade Total) ─────────────
    if (prefix === 'rpg_select' || prefix === 'rpg' || prefix === 'loja_categoria') {
      const selectedValue = (interaction as StringSelectMenuInteraction).values[0];
      
      // Mantém exatamente a estrutura original sem alterar nomes de variáveis
      let targetAction = action === 'menu_perfil' ? selectedValue : action;

      // Se for o dropdown da loja, repassa o valor selecionado diretamente
      if (prefix === 'loja_categoria') {
        targetAction = selectedValue;
      }

      // Chama o handler de botões do RPG diretamente
      const { handleButton } = await import('./buttonHandler');
      return await handleButton(Object.assign(interaction, { customId: `rpg:${targetAction}` }) as any);
    }

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

  if (action === 'deletar_call') {
    await i.deferReply({ ephemeral: true });
    if (!ticket.voiceChannelId) return i.editReply({ embeds: [errorEmbed('Sem Call', 'Não há canal de voz associado a este ticket.')] });
    const voiceCh = guild.channels.cache.get(ticket.voiceChannelId);
    if (voiceCh) await voiceCh.delete().catch(() => null);
    await prisma.ticket.update({ where: { id: ticketId }, data: { voiceChannelId: null } });
    return i.editReply({ embeds: [successEmbed('Call Deletada', 'Canal de voz removido.')] });
  }

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

  if (action === 'fechar_ticket') {
    await i.deferReply({ ephemeral: true });
    if (ticket.status === 'closed') return i.editReply({ embeds: [errorEmbed('Já Fechado', 'Este ticket já está fechado.')] });
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'closed', closedAt: new Date() } });

    if (config.ticketLogChannelId) {
      const logCh = guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
      if (logCh) await logCh.send({ embeds: [baseEmbed(COLORS.ERROR).setTitle('🎫 Ticket Fechado').addFields({ name: 'Fechado por', value: i.user.tag, inline: true }, { name: 'Canal', value: ticket.channelId, inline: true })] });
    }

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

async function selfRoleAdminSelect(i: AnySelectMenuInteraction, action: string, parts: string[]) {
  const { checkAdmin } = await import('../utils/permissions');
  if (!(await checkAdmin(i as any))) return;
  await i.deferUpdate();

  const guildId = i.guildId!;
  const { prisma } = await import('../database/client');
  const { errorEmbed, successEmbed, baseEmbed } = await import('../utils/embeds');
  const COLORS = { DARK: 0x2C3E50 as number };

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
      await i.editReply({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle('Passo 2 — Defina o Título').setDescription(`Canal selecionado: <#${chanId}>\n\nComo não é possível abrir um modal após selecionar o canal, clique em **🆕 Criar Menu** novamente e desta vez use o canal <#${chanId}>. Vamos melhorar isso em breve!`)], components: [] });
    });
  }

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
