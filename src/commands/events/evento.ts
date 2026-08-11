import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS, baseEmbed, successEmbed, errorEmbed } from '../../utils/embeds';
import { checkServerOwnerOrRepresentative } from '../../utils/permissions';
import { parseDuration } from '../../utils/helpers';

export default {
  category: 'events',
  data: new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Gerencia eventos do servidor')
    .addSubcommand(sub =>
      sub.setName('criar').setDescription('Cria um novo evento (dono/representante)')
        .addStringOption(opt => opt.setName('titulo').setDescription('Título do evento').setRequired(true).setMaxLength(100))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descrição do evento').setRequired(true).setMaxLength(1000))
        .addStringOption(opt => opt.setName('quando').setDescription('Quando acontece: 1h, 2d, 30m').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('encerrar').setDescription('Encerra um evento (dono/representante)')
        .addStringOption(opt => opt.setName('id').setDescription('ID do evento').setRequired(true))
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkServerOwnerOrRepresentative(interaction))) return;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    if (sub === 'criar') {
      const titulo = interaction.options.getString('titulo', true);
      const descricao = interaction.options.getString('descricao', true);
      const quandoStr = interaction.options.getString('quando', true);
      const ms = parseDuration(quandoStr);
      if (!ms) return interaction.reply({ embeds: [errorEmbed('Duração inválida', 'Use: `1h`, `2d`, `30m`')], ephemeral: true });
      const startsAt = new Date(Date.now() + ms);

      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.channel as TextChannel;
      const event = await prisma.event.create({ data: { guildId: guild.id, channelId: channel.id, title: titulo, description: descricao, hostId: interaction.user.id, startsAt } });

      const embed = baseEmbed(COLORS.SECONDARY)
        .setTitle(`${EMOJIS.BELL} ${titulo}`)
        .setDescription(descricao)
        .addFields(
          { name: '📅 Quando', value: `<t:${Math.floor(startsAt.getTime() / 1000)}:F>\n(<t:${Math.floor(startsAt.getTime() / 1000)}:R>)`, inline: true },
          { name: '👑 Organizador', value: `${interaction.user}`, inline: true },
          { name: '👥 Inscritos', value: '**0**', inline: true },
        )
        .setFooter({ text: `ID: ${event.id} • ⚔️ Aliança Skyline` });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`event:join:${event.id}`).setLabel('Participar').setEmoji('✅').setStyle(ButtonStyle.Success),
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });
      await prisma.event.update({ where: { id: event.id }, data: { messageId: msg.id } });
      await interaction.editReply({ embeds: [successEmbed('Evento Criado!', `Evento publicado em ${channel}`)] });
    }

    else if (sub === 'encerrar') {
      const id = interaction.options.getString('id', true);
      await interaction.deferReply({ ephemeral: true });
      const event = await prisma.event.findUnique({ where: { id }, include: { _count: { select: { participants: true } } } });
      if (!event || event.guildId !== guild.id) return interaction.editReply({ embeds: [errorEmbed('Não encontrado', 'Evento não encontrado.')] });
      if (event.ended) return interaction.editReply({ embeds: [errorEmbed('Já encerrado', 'Este evento já foi encerrado.')] });
      await prisma.event.update({ where: { id }, data: { ended: true } });
      await interaction.editReply({ embeds: [successEmbed('Evento Encerrado!', `Evento **${event.title}** encerrado com **${event._count.participants}** participante(s).`)] });
    }
  },
} satisfies Command;
