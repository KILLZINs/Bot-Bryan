import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../types';
import { COLORS, EMOJIS, baseEmbed } from '../../utils/embeds';
import { checkAdmin } from '../../utils/permissions';
import { applyTemplate } from '../../utils/embedTemplates';

export default {
  category: 'tickets',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gerencia o sistema de tickets')
    .addSubcommand(sub =>
      sub.setName('painel').setDescription('Envia o painel de criação de tickets neste canal')
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal para enviar o painel (padrão: atual)').setRequired(false))
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkAdmin(interaction))) return;
    const { isFeatureEnabled, featureDisabledMsg } = await import('../../utils/features');
    if (interaction.guildId && !(await isFeatureEnabled(interaction.guildId, 'featTickets'))) {
      return interaction.reply({ content: featureDisabledMsg('featTickets'), ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'painel') {
      const target = (interaction.options.getChannel('canal') ?? interaction.channel) as TextChannel;
      const embed = baseEmbed(COLORS.PRIMARY)
        .setTitle(`${EMOJIS.TICKET} Sistema de Tickets — Aliança Skyline`)
        .setDescription(
          '**Precisa de ajuda ou quer falar com a equipe?**\n\n' +
          'Clique no botão abaixo para abrir um ticket. Um membro da equipe irá atendê-lo em breve.\n\n' +
          '📋 Tenha em mãos as informações necessárias para agilizar o atendimento.'
        )
        .addFields(
          { name: '🛠️ Suporte Geral', value: 'Dúvidas e problemas gerais', inline: true },
          { name: '🤝 Parceria', value: 'Pedidos de parceria', inline: true },
          { name: '🚨 Reporte', value: 'Reportar usuários ou bugs', inline: true },
          { name: '📋 Candidatura', value: 'Candidatura para staff', inline: true },
          { name: '❓ Outro', value: 'Outros assuntos', inline: true },
        )
        .setFooter({ text: '⚔️ Aliança Skyline • Abra apenas um ticket por vez' });
      applyTemplate(embed, 'ticket.create');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('painel:ticket').setLabel('Abrir Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
      );

      await target.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Painel de tickets enviado em ${target}!`, ephemeral: true });
    }
  },
} satisfies Command;
