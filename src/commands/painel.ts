import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../types';
import { COLORS } from '../utils/embeds';
import { applyTemplate } from '../utils/embedTemplates';

const SKYLINE_PURPLE = 0x470F78;

const MEMBER_PANEL_EMOJIS = {
  title: '👾',
  profile: '🕶️',
  level: '🎚️',
  ranking: '♟️',
  achievements: '💿',
  economy: '🍙',
  shop: '🗄️',
  missions: '🌪️',
  support: '✉️',
  giveaways: '🎱',
  events: '📹',
  footer: '💜',
  rpg: '🎧',
} as const;

export default {
  category: 'geral',
  data: new SlashCommandBuilder().setName('painel').setDescription('Painel pessoal para membros do servidor'),
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(SKYLINE_PURPLE)
      .setTitle(`${MEMBER_PANEL_EMOJIS.title} Aliança Skyline — Painel do Membro`)
      .setDescription('Consulte seu perfil, progresso, economia e atividades do servidor.')
      .setThumbnail(interaction.guild?.iconURL() ?? null)
      .addFields(
        { name: `${MEMBER_PANEL_EMOJIS.profile} Perfil`, value: 'Seu perfil, XP e moedas', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.level} Nível`, value: 'Seu progresso e recompensas', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.ranking} Ranking`, value: 'Ranking de XP e moedas', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.achievements} Conquistas`, value: 'Suas conquistas desbloqueadas', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.economy} Economia`, value: 'Saldo e transferências', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.shop} Loja`, value: 'Itens disponíveis neste servidor', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.missions} Missões`, value: 'Missões diárias e resgates', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.support} Suporte`, value: 'Ticket, sugestão e feedback', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.giveaways} Sorteios`, value: 'Sorteios ativos', inline: true },
        { name: `${MEMBER_PANEL_EMOJIS.events} Eventos`, value: 'Eventos ativos', inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `${MEMBER_PANEL_EMOJIS.footer} Aliança Skyline • painel pessoal` });
    applyTemplate(embed, 'painel');

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('painel:perfil').setLabel('Perfil').setEmoji(MEMBER_PANEL_EMOJIS.profile).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('painel:nivel').setLabel('Nível').setEmoji(MEMBER_PANEL_EMOJIS.level).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('painel:ranking').setLabel('Ranking').setEmoji(MEMBER_PANEL_EMOJIS.ranking).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('painel:conquistas').setLabel('Conquistas').setEmoji(MEMBER_PANEL_EMOJIS.achievements).setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('painel:economia').setLabel('Economia').setEmoji(MEMBER_PANEL_EMOJIS.economy).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('painel:loja').setLabel('Loja').setEmoji(MEMBER_PANEL_EMOJIS.shop).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('painel:missoes').setLabel('Missões').setEmoji(MEMBER_PANEL_EMOJIS.missions).setStyle(ButtonStyle.Primary),
    );
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('painel:ticket').setLabel('Suporte').setEmoji(MEMBER_PANEL_EMOJIS.support).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('painel:sorteios').setLabel('Sorteios').setEmoji(MEMBER_PANEL_EMOJIS.giveaways).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('painel:eventos').setLabel('Eventos').setEmoji(MEMBER_PANEL_EMOJIS.events).setStyle(ButtonStyle.Success),
    );
    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rpg:perfil').setLabel('RPG').setEmoji(MEMBER_PANEL_EMOJIS.rpg).setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4] });
  },
} satisfies Command;
