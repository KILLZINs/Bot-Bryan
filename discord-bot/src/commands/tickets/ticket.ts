import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember, checkModerator } from '../../utils/helpers';
import { COLORS, EMOJIS, successEmbed, errorEmbed } from '../../utils/embeds';

export default {
  category: 'tickets',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistema de suporte via tickets')
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Abre um ticket de suporte')
        .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo do ticket').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('fechar').setDescription('Fecha o ticket atual')
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('[MOD] Lista tickets abertos')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'criar') {
      const motivo = interaction.options.getString('motivo', true);
      const guild = interaction.guild!;

      const member = await getOrCreateMember(interaction.user.id, interaction.user.username);
      const existing = await prisma.ticket.findFirst({ where: { memberId: member.id, status: 'OPEN' } });

      if (existing) {
        const ch = guild.channels.cache.get(existing.channelId);
        await interaction.reply({
          embeds: [errorEmbed('Ticket Já Aberto', `Você já tem um ticket aberto: ${ch ? `<#${existing.channelId}>` : '(canal removido)'}`)],
          ephemeral: true,
        });
        return;
      }

      const categoryId = process.env.TICKET_CATEGORY_ID;
      const ticketName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      const channel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: categoryId ?? undefined,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          ...(process.env.MOD_ROLE_ID ? [{ id: process.env.MOD_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
          ...(process.env.ADMIN_ROLE_ID ? [{ id: process.env.ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
        ],
      });

      await prisma.ticket.create({ data: { memberId: member.id, channelId: channel.id, reason: motivo } });

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${EMOJIS.TICKET} Ticket de Suporte`)
        .setDescription(`Olá, ${interaction.user}! Seu ticket foi criado.\n\n📝 **Motivo:** ${motivo}\n\nUma equipe de moderação irá atendê-lo em breve.\nUse \`/ticket fechar\` para encerrar este ticket.`)
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

      const closeButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      await (channel as TextChannel).send({ content: `${interaction.user}`, embeds: [embed], components: [closeButton] });
      await interaction.reply({ embeds: [successEmbed('Ticket Criado!', `Seu ticket foi aberto em ${channel}`)], ephemeral: true });

    } else if (sub === 'fechar') {
      const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: 'OPEN' } });

      if (!ticket) {
        await interaction.reply({ embeds: [errorEmbed('Erro', 'Este comando só pode ser usado dentro de um ticket aberto.')], ephemeral: true });
        return;
      }

      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED', closedAt: new Date() } });
      await interaction.reply({ embeds: [successEmbed('Ticket Fechado', 'Este ticket será deletado em 5 segundos...')] });

      setTimeout(async () => {
        await interaction.channel?.delete().catch(console.error);
      }, 5000);

    } else if (sub === 'listar') {
      if (!(await checkModerator(interaction))) return;

      const tickets = await prisma.ticket.findMany({
        where: { status: 'OPEN' },
        include: { member: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!tickets.length) {
        await interaction.reply({ embeds: [successEmbed('Sem Tickets', 'Não há tickets abertos no momento.')], ephemeral: true });
        return;
      }

      const list = tickets.map((t) => {
        const ch = interaction.guild?.channels.cache.get(t.channelId);
        return `**${t.member.username}** — ${ch ? `<#${t.channelId}>` : '(canal removido)'}\n└ ${t.reason.slice(0, 60)} | <t:${Math.floor(t.createdAt.getTime() / 1000)}:R>`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle(`${EMOJIS.TICKET} Tickets Abertos (${tickets.length})`)
        .setDescription(list)
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
} satisfies Command;
