import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember, checkModerator } from '../../utils/helpers';
import { COLORS, EMOJIS, successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds';

export default {
  category: 'events',
  data: new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Sistema de eventos da aliança')
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('[MOD] Cria um novo evento')
        .addStringOption((opt) => opt.setName('nome').setDescription('Nome do evento').setRequired(true))
        .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição do evento').setRequired(true))
        .addStringOption((opt) => opt.setName('data').setDescription('Data e hora (ex: 25/12/2025 20:00)').setRequired(true))
        .addIntegerOption((opt) => opt.setName('vagas').setDescription('Máximo de participantes (opcional)').setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista os próximos eventos')
    )
    .addSubcommand((sub) =>
      sub
        .setName('entrar')
        .setDescription('Participa de um evento')
        .addStringOption((opt) => opt.setName('id').setDescription('ID do evento').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('presenca')
        .setDescription('[MOD] Vê a lista de presença de um evento')
        .addStringOption((opt) => opt.setName('id').setDescription('ID do evento').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancelar')
        .setDescription('[MOD] Cancela um evento')
        .addStringOption((opt) => opt.setName('id').setDescription('ID do evento').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('finalizar')
        .setDescription('[MOD] Finaliza um evento e recompensa participantes')
        .addStringOption((opt) => opt.setName('id').setDescription('ID do evento').setRequired(true))
        .addIntegerOption((opt) => opt.setName('moedas').setDescription('Moedas de recompensa por participante').setMinValue(0))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'criar') {
      if (!(await checkModerator(interaction))) return;
      const nome = interaction.options.getString('nome', true);
      const desc = interaction.options.getString('descricao', true);
      const dataStr = interaction.options.getString('data', true);
      const vagas = interaction.options.getInteger('vagas') ?? undefined;

      const [datePart, timePart] = dataStr.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const [hour, min] = (timePart ?? '00:00').split(':').map(Number);
      const scheduledAt = new Date(year, month - 1, day, hour, min);

      if (isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
        await interaction.reply({ embeds: [errorEmbed('Data Inválida', 'Use o formato `DD/MM/AAAA HH:MM` e certifique-se de ser uma data futura.')], ephemeral: true });
        return;
      }

      const event = await prisma.event.create({
        data: { name: nome, description: desc, scheduledAt, maxSlots: vagas ?? null, createdBy: interaction.user.id },
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${EMOJIS.SPARKLES} Novo Evento Criado!`)
        .addFields(
          { name: '📋 Nome', value: nome, inline: true },
          { name: '🆔 ID', value: `\`${event.id.slice(0, 8)}\``, inline: true },
          { name: '📅 Data', value: `<t:${Math.floor(scheduledAt.getTime() / 1000)}:F>`, inline: false },
          { name: '📝 Descrição', value: desc, inline: false },
          { name: '👥 Vagas', value: vagas ? `${vagas}` : 'Ilimitado', inline: true },
        )
        .setFooter({ text: `Use /evento entrar ${event.id.slice(0, 8)} para participar • ⚔️ Aliança Skyline` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'listar') {
      const events = await prisma.event.findMany({
        where: { status: 'UPCOMING', scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
        include: { _count: { select: { attendance: true } } },
      });

      if (!events.length) {
        await interaction.reply({ embeds: [infoEmbed('Nenhum Evento', 'Não há eventos agendados no momento.')], ephemeral: true });
        return;
      }

      const list = events.map((e) => {
        const slots = e.maxSlots ? `${e._count.attendance}/${e.maxSlots}` : `${e._count.attendance}`;
        return `**${e.name}** — <t:${Math.floor(e.scheduledAt.getTime() / 1000)}:R>\n└ 👥 ${slots} participante(s) | ID: \`${e.id.slice(0, 8)}\``;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${EMOJIS.SCROLL} Próximos Eventos`)
        .setDescription(list)
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'entrar') {
      const id = interaction.options.getString('id', true);
      const event = await prisma.event.findFirst({ where: { id: { startsWith: id }, status: 'UPCOMING' }, include: { _count: { select: { attendance: true } } } });

      if (!event) {
        await interaction.reply({ embeds: [errorEmbed('Evento Não Encontrado', 'ID inválido ou evento já encerrado.')], ephemeral: true });
        return;
      }

      if (event.maxSlots && event._count.attendance >= event.maxSlots) {
        await interaction.reply({ embeds: [errorEmbed('Evento Lotado', 'Não há mais vagas disponíveis.')], ephemeral: true });
        return;
      }

      const member = await getOrCreateMember(interaction.user.id, interaction.user.username);
      const existing = await prisma.eventAttendance.findUnique({ where: { eventId_memberId: { eventId: event.id, memberId: member.id } } });

      if (existing) {
        await interaction.reply({ embeds: [errorEmbed('Já Inscrito', 'Você já está inscrito neste evento.')], ephemeral: true });
        return;
      }

      await prisma.eventAttendance.create({ data: { eventId: event.id, memberId: member.id } });
      await interaction.reply({ embeds: [successEmbed('Inscrito!', `Você foi inscrito no evento **${event.name}**!\n📅 <t:${Math.floor(event.scheduledAt.getTime() / 1000)}:F>`)] });

    } else if (sub === 'presenca') {
      if (!(await checkModerator(interaction))) return;
      const id = interaction.options.getString('id', true);
      const event = await prisma.event.findFirst({ where: { id: { startsWith: id } }, include: { attendance: { include: { member: true } } } });

      if (!event) {
        await interaction.reply({ embeds: [errorEmbed('Evento Não Encontrado', 'ID inválido.')], ephemeral: true });
        return;
      }

      const list = event.attendance.map((a, i) => `**${i + 1}.** ${a.member.username}`).join('\n') || 'Nenhum participante ainda.';

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`👥 Presença — ${event.name}`)
        .setDescription(list)
        .addFields({ name: '📊 Total', value: `${event.attendance.length}${event.maxSlots ? `/${event.maxSlots}` : ''} participantes`, inline: true })
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'cancelar') {
      if (!(await checkModerator(interaction))) return;
      const id = interaction.options.getString('id', true);
      const event = await prisma.event.findFirst({ where: { id: { startsWith: id }, status: 'UPCOMING' } });

      if (!event) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrado', 'Evento não encontrado ou já encerrado.')], ephemeral: true });
        return;
      }

      await prisma.event.update({ where: { id: event.id }, data: { status: 'CANCELLED' } });
      await interaction.reply({ embeds: [successEmbed('Evento Cancelado', `O evento **${event.name}** foi cancelado.`)] });

    } else if (sub === 'finalizar') {
      if (!(await checkModerator(interaction))) return;
      const id = interaction.options.getString('id', true);
      const moedas = interaction.options.getInteger('moedas') ?? 0;
      const event = await prisma.event.findFirst({ where: { id: { startsWith: id }, status: 'UPCOMING' }, include: { attendance: true } });

      if (!event) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrado', 'Evento não encontrado.')], ephemeral: true });
        return;
      }

      await prisma.event.update({ where: { id: event.id }, data: { status: 'FINISHED' } });

      if (moedas > 0 && event.attendance.length > 0) {
        await prisma.$transaction(
          event.attendance.map((a) => prisma.member.update({ where: { id: a.memberId }, data: { coins: { increment: moedas } } }))
        );
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            'Evento Finalizado',
            `**${event.name}** foi encerrado!\n👥 ${event.attendance.length} participante(s)${moedas > 0 ? `\n💜 +${moedas} moedas para cada participante!` : ''}`
          ),
        ],
      });
    }
  },
} satisfies Command;
