import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Guild,
  PermissionFlagsBits,
  TextChannel,
  User,
} from 'discord.js';
import { prisma } from '../database/client';
import { getConfig } from './helpers';
import { COLORS, EMOJIS, baseEmbed, successEmbed } from './embeds';
import { applyTemplate } from './embedTemplates';

export const TICKET_LABELS: Record<string, string> = {
  suporte: '🛠️ Suporte Geral',
  parceria: '🤝 Parceria',
  reporte: '🚨 Reporte',
  candidatura: '📋 Candidatura',
  outro: '❓ Outro',
  vip_gradiente: '🎨 Personalização de Gradiente',
};

export interface TicketCreationOptions {
  parentId?: string | null;
  title?: string;
  description?: string;
}

export async function findOpenTicket(guild: Guild, userId: string, category?: string) {
  const tickets = await prisma.ticket.findMany({
    where: {
      authorId: userId,
      status: 'open',
      ...(category ? { category } : {}),
      OR: [{ guildId: guild.id }, { guildId: null }],
    },
    orderBy: { createdAt: 'desc' },
  });

  return tickets.find(ticket => guild.channels.cache.has(ticket.channelId)) ?? null;
}

export async function removeStaleTicket(ticketId: string): Promise<void> {
  await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => null);
}

export async function createTicketForUser(
  guild: Guild,
  user: User,
  category: string,
  options: TicketCreationOptions = {},
) {
  const config = await getConfig(guild.id);
  const label = TICKET_LABELS[category] ?? category;
  const channelSlug = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || user.id.slice(-6);
  const categorySlug = category.replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'geral';

  const ticketCh = await guild.channels.create({
    name: `ticket-${channelSlug}-${categorySlug}`,
    type: ChannelType.GuildText,
    parent: options.parentId ?? config.ticketCategoryId ?? undefined,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      ...(config.modRoleId
        ? [{
            id: config.modRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          }]
        : []),
      ...(config.adminRoleId
        ? [{
            id: config.adminRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          }]
        : []),
    ],
  }) as TextChannel;

  const ticket = await prisma.ticket.create({
    data: { channelId: ticketCh.id, guildId: guild.id, authorId: user.id, category },
  });

  const embed = baseEmbed()
    .setTitle(`${EMOJIS.TICKET} ${options.title ?? label}`)
    .setDescription(
      options.description ??
        `⚔ Seu **ticket** foi aberto com sucesso, ${user}! Mande uma mensagem explicando melhor o motivo de você ter aberto o ticket. Após isso, só aguardar alguém da equipe ${config.modRoleId ? `<@&${config.modRoleId}>` : 'te atender'}.`,
    )
    .addFields(
      { name: '📌 Autor', value: `${user} (${user.id})`, inline: true },
      { name: '🏷️ Categoria', value: label, inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket:claim:${ticket.id}`).setLabel('Assumir Ticket').setEmoji('✋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket:info:${ticket.id}`).setLabel('Informações').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket:painel_staff:${ticket.id}`).setLabel('Painel Staff').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
  );

  const ping = config.modRoleId ? `<@&${config.modRoleId}>` : '';
  applyTemplate(embed, 'ticket.create');
  await ticketCh.send({ content: `${user} ${ping}`.trim(), embeds: [embed], components: [row] });

  if (config.ticketLogChannelId) {
    const logCh = guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [
          baseEmbed(COLORS.INFO)
            .setTitle('🎫 Novo Ticket')
            .addFields(
              { name: 'Autor', value: `${user} (${user.id})`, inline: true },
              { name: 'Categoria', value: label, inline: true },
              { name: 'Canal', value: `${ticketCh}`, inline: true },
            ),
        ],
      });
    }
  }

  return { ticket, channel: ticketCh, success: successEmbed('Ticket Criado!', `Seu ticket foi aberto em ${ticketCh}`) };
}