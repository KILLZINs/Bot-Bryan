import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { Command } from '../types';
import { errorEmbed, baseEmbed } from '../utils/embeds';
import { prisma } from '../database/client';
import { getServerClass, getNextClass, getAlliancePanelEmoji, isAllianceServerRepresentative } from '../utils/alliance';

const SKYLINE_PURPLE = 0x470F78;

function panelClassEmoji(name: string): string {
  return getAlliancePanelEmoji(name);
}

export default {
  category: 'alianca',
  data: new SlashCommandBuilder()
    .setName('servidor')
    .setDescription('Painel do servidor na Aliança Skyline (donos e representantes)'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({ embeds: [errorEmbed('Erro', 'Use em um servidor.')], ephemeral: true });
    }

    const guildId = interaction.guild.id;
    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const [allianceServer, isRepresentative] = await Promise.all([
      prisma.allianceServer.findUnique({ where: { guildId } }),
      isAllianceServerRepresentative(guildId, interaction.user.id),
    ]);

    if (!isOwner && !isRepresentative) {
      return interaction.reply({
        embeds: [errorEmbed('Sem Permissão', 'Apenas o dono do servidor ou representantes definidos em `/alianca` podem usar este painel.')],
        ephemeral: true,
      });
    }

    if (!allianceServer) {
      return interaction.reply({
        embeds: [errorEmbed('Servidor não cadastrado', 'Este servidor não está cadastrado na Aliança Skyline.\nPeça a um admin da aliança para adicioná-lo com `/alianca`.')],
        ephemeral: true,
      });
    }

    const memberCount = allianceServer.memberCount ?? interaction.guild.memberCount;
    const cls  = getServerClass(memberCount);
    const next = getNextClass(memberCount);
    const clsEmoji  = panelClassEmoji(cls.name);
    const nextEmoji = next ? panelClassEmoji(next.cls.name) : null;

    const embed = new EmbedBuilder()
      .setColor(SKYLINE_PURPLE)
      .setTitle(`💀 ${interaction.guild.name} — Painel do Servidor`)
      .setThumbnail(interaction.guild.iconURL() ?? null)
      .addFields(
        { name: '🕸️ Classe Atual',    value: `${clsEmoji} **${cls.name}**`,                                                            inline: true },
        { name: '🦴 Membros',         value: `**${memberCount.toLocaleString('pt-BR')}**`,                                              inline: true },
        { name: '⚓ Canal Aliança',   value: allianceServer.channelId ? `<#${allianceServer.channelId}>` : '*Não configurado*',         inline: true },
        { name: '🔗 Link de Convite', value: allianceServer.inviteLink ? `[Clique aqui](${allianceServer.inviteLink})` : '*Não configurado*', inline: true },
        {
          name:  next ? `🌪️ Próxima Classe: ${nextEmoji} ${next.cls.name}` : '🎱 Classe Máxima',
          value: next ? `Faltam **${next.needed.toLocaleString('pt-BR')}** membros` : 'Você está no topo da aliança!',
          inline: false,
        },
      )
      .setFooter({ text: '🖤 Aliança Skyline' })
      .setTimestamp();

    // Linha 1 — canal e convite
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('servidor:set_channel').setLabel('Canal Aliança').setEmoji('⚓').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('servidor:set_invite') .setLabel('Link Convite') .setEmoji('🔗').setStyle(ButtonStyle.Secondary),
    );

    // Linha 2 — estatísticas
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('servidor:stats_server').setLabel('Estatísticas') .setEmoji('🎚️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servidor:rede')        .setLabel('Rede Aliança') .setEmoji('☁️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servidor:performance') .setLabel('Desempenho')   .setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
    );

    // Linha 3 — comunicação e eventos
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('servidor:anuncio')         .setLabel('Anúncio')         .setEmoji('📢').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('servidor:poll')            .setLabel('Poll')             .setEmoji('📊').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('servidor:sorteio')         .setLabel('Sorteio')          .setEmoji('🎁').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('servidor:encerrar_sorteio').setLabel('Encerrar Sorteio') .setEmoji('🏆').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('servidor:evento')          .setLabel('Evento')           .setEmoji('📌').setStyle(ButtonStyle.Primary),
    );

    // Linha 4 — recompensas e economia
    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('servidor:conquista')   .setLabel('Conquistas')    .setEmoji('🏅').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servidor:nivel_reward').setLabel('Recomp. Nível') .setEmoji('🎯').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servidor:economia')    .setLabel('Economia')      .setEmoji('🪙').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servidor:loja')        .setLabel('Loja')          .setEmoji('🛍️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servidor:rank')        .setLabel('Definir Rank')  .setEmoji('👑').setStyle(ButtonStyle.Secondary),
    );

    // Linha 5 — gestão
    const row5 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('servidor:cargo_menu').setLabel('Registro de Cargos').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servidor:modulos')   .setLabel('Módulos')           .setEmoji('🔧').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('servidor:mod')       .setLabel('Moderação')          .setEmoji('🔨').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4, row5], ephemeral: true });
  },
} satisfies Command;
