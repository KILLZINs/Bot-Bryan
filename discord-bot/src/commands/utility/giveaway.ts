import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { checkModerator, parseDuration, formatDuration } from '../../utils/helpers';
import { COLORS, EMOJIS, successEmbed, errorEmbed } from '../../utils/embeds';

export default {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription('Sistema de sorteios da aliança')
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('[MOD] Cria um sorteio')
        .addStringOption((opt) => opt.setName('premio').setDescription('Prêmio do sorteio').setRequired(true))
        .addStringOption((opt) => opt.setName('duracao').setDescription('Duração (ex: 1h, 2d)').setRequired(true))
        .addIntegerOption((opt) => opt.setName('vencedores').setDescription('Número de vencedores').setMinValue(1).setMaxValue(10))
    )
    .addSubcommand((sub) =>
      sub
        .setName('finalizar')
        .setDescription('[MOD] Finaliza um sorteio antecipadamente')
        .addStringOption((opt) => opt.setName('id').setDescription('ID do sorteio').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('entrar')
        .setDescription('Participa de um sorteio')
        .addStringOption((opt) => opt.setName('id').setDescription('ID do sorteio').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'criar') {
      if (!(await checkModerator(interaction))) return;
      const premio = interaction.options.getString('premio', true);
      const duracaoStr = interaction.options.getString('duracao', true);
      const vencedores = interaction.options.getInteger('vencedores') ?? 1;
      const ms = parseDuration(duracaoStr);

      if (!ms) {
        await interaction.reply({ embeds: [errorEmbed('Duração Inválida', 'Use formatos como `1h`, `2d`, `30m`.')], ephemeral: true });
        return;
      }

      const endsAt = new Date(Date.now() + ms);
      const giveaway = await prisma.giveaway.create({
        data: { prize: premio, winners: vencedores, channelId: interaction.channelId, hostId: interaction.user.id, endsAt },
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle(`${EMOJIS.GIFT} SORTEIO!`)
        .setDescription(
          `**Prêmio:** ${premio}\n\n` +
          `🏆 **Vencedores:** ${vencedores}\n` +
          `⏰ **Termina:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n` +
          `🎫 **Criado por:** ${interaction.user}\n\n` +
          `Use \`/sorteio entrar ${giveaway.id.slice(0, 8)}\` para participar!\n\n` +
          `🆔 ID: \`${giveaway.id.slice(0, 8)}\``
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp(endsAt);

      await interaction.reply({ embeds: [embed] });

      // Auto-end after duration
      setTimeout(async () => {
        await endGiveaway(giveaway.id, interaction.channel as TextChannel);
      }, ms);

    } else if (sub === 'entrar') {
      const id = interaction.options.getString('id', true);
      const giveaway = await prisma.giveaway.findFirst({ where: { id: { startsWith: id }, ended: false } });

      if (!giveaway) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrado', 'Sorteio inválido ou já encerrado.')], ephemeral: true });
        return;
      }

      if (new Date() > giveaway.endsAt) {
        await interaction.reply({ embeds: [errorEmbed('Encerrado', 'Este sorteio já encerrou.')], ephemeral: true });
        return;
      }

      const member = await prisma.member.upsert({
        where: { discordId: interaction.user.id },
        update: { username: interaction.user.username },
        create: { discordId: interaction.user.id, username: interaction.user.username },
      });

      const existing = await prisma.giveawayEntry.findUnique({
        where: { giveawayId_memberId: { giveawayId: giveaway.id, memberId: member.id } },
      });

      if (existing) {
        await interaction.reply({ embeds: [errorEmbed('Já Inscrito', 'Você já está participando deste sorteio!')], ephemeral: true });
        return;
      }

      await prisma.giveawayEntry.create({ data: { giveawayId: giveaway.id, memberId: member.id } });
      const count = await prisma.giveawayEntry.count({ where: { giveawayId: giveaway.id } });

      await interaction.reply({
        embeds: [successEmbed('Inscrito no Sorteio!', `Você está participando do sorteio de **${giveaway.prize}**!\n👥 Total de participantes: **${count}**`)],
        ephemeral: true,
      });

    } else if (sub === 'finalizar') {
      if (!(await checkModerator(interaction))) return;
      const id = interaction.options.getString('id', true);
      const giveaway = await prisma.giveaway.findFirst({ where: { id: { startsWith: id }, ended: false } });

      if (!giveaway) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrado', 'Sorteio inválido ou já encerrado.')], ephemeral: true });
        return;
      }

      await interaction.reply({ embeds: [successEmbed('Finalizando...', 'Sorteando os vencedores...')] });
      await endGiveaway(giveaway.id, interaction.channel as TextChannel);
    }
  },
} satisfies Command;

async function endGiveaway(giveawayId: string, channel: TextChannel) {
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: { include: { member: true } } },
  });

  if (!giveaway || giveaway.ended) return;

  await prisma.giveaway.update({ where: { id: giveawayId }, data: { ended: true } });

  if (!giveaway.entries.length) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`${EMOJIS.GIFT} Sorteio Encerrado`)
      .setDescription(`**${giveaway.prize}**\n\nNenhum participante. Sorteio cancelado.`)
      .setTimestamp();
    await channel.send({ embeds: [embed] }).catch(console.error);
    return;
  }

  const shuffled = [...giveaway.entries].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, Math.min(giveaway.winners, shuffled.length));
  const winnerMentions = winners.map((w) => `<@${w.member.discordId}>`).join(', ');

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${EMOJIS.TROPHY} Sorteio Encerrado!`)
    .setDescription(
      `**Prêmio:** ${giveaway.prize}\n\n` +
      `🏆 **Vencedor(es):** ${winnerMentions}\n` +
      `👥 **Participantes:** ${giveaway.entries.length}`
    )
    .setFooter({ text: '⚔️ Aliança Skyline' })
    .setTimestamp();

  await channel.send({ content: `🎉 Parabéns ${winnerMentions}!`, embeds: [embed] }).catch(console.error);
}
