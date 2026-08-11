import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { baseEmbed, successEmbed, errorEmbed } from '../../utils/embeds';
import { checkServerOwnerOrRepresentative } from '../../utils/permissions';

export default {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Cria uma enquete interativa (dono/representante)')
    .addSubcommand(sub =>
      sub.setName('criar').setDescription('Cria uma nova poll')
        .addStringOption(opt => opt.setName('pergunta').setDescription('Pergunta da poll').setRequired(true).setMaxLength(200))
        .addStringOption(opt => opt.setName('opcao1').setDescription('Opção 1').setRequired(true).setMaxLength(80))
        .addStringOption(opt => opt.setName('opcao2').setDescription('Opção 2').setRequired(true).setMaxLength(80))
        .addStringOption(opt => opt.setName('opcao3').setDescription('Opção 3 (opcional)').setRequired(false).setMaxLength(80))
        .addStringOption(opt => opt.setName('opcao4').setDescription('Opção 4 (opcional)').setRequired(false).setMaxLength(80))
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkServerOwnerOrRepresentative(interaction))) return;
    const { isFeatureEnabled, featureDisabledMsg } = await import('../../utils/features');
    if (interaction.guildId && !(await isFeatureEnabled(interaction.guildId, 'featPolls'))) {
      return interaction.reply({ content: featureDisabledMsg('featPolls'), ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();
    if (sub !== 'criar') return;

    const pergunta = interaction.options.getString('pergunta', true);
    const opcoes = [
      interaction.options.getString('opcao1', true),
      interaction.options.getString('opcao2', true),
      interaction.options.getString('opcao3') ?? null,
      interaction.options.getString('opcao4') ?? null,
    ].filter((o): o is string => !!o);

    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel as TextChannel;
    const guild = interaction.guild!;

    const poll = await prisma.poll.create({
      data: { guildId: guild.id, channelId: channel.id, question: pergunta, createdBy: interaction.user.id, options: { create: opcoes.map(label => ({ label, votes: 0 })) } },
      include: { options: true },
    });

    const emojis = ['🅰️', '🅱️', '🆑', '🆔'];
    const desc = poll.options.map((o, idx) => `${emojis[idx]} **${o.label}**\n\`░░░░░░░░░░\` 0%`).join('\n\n');
    const embed = baseEmbed().setTitle(`📊 ${pergunta}`).setDescription(desc).setFooter({ text: '0 votos • ⚔️ Aliança Skyline' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      poll.options.map((o, idx) =>
        new ButtonBuilder().setCustomId(`poll:vote:${poll.id}:${idx}`).setLabel(o.label).setEmoji(emojis[idx]).setStyle(ButtonStyle.Primary)
      )
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    await prisma.poll.update({ where: { id: poll.id }, data: { messageId: msg.id } });
    await interaction.editReply({ embeds: [successEmbed('Poll Criada!', `Poll publicada em ${channel}`)] });
  },
} satisfies Command;
