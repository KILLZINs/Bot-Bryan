import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../types';
import { COLORS, EMOJIS } from '../utils/embeds';
import { checkModerator } from '../utils/permissions';

export default {
  category: 'mod',
  data: new SlashCommandBuilder().setName('mod').setDescription('Painel de moderação da Aliança Skyline'),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkModerator(interaction))) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`${EMOJIS.HAMMER} Painel de Moderação`)
      .setDescription('Selecione uma ação de moderação abaixo.\nTodas as ações são registradas no canal de logs.')
      .addFields(
        { name: '🔨 Ban', value: 'Banir um membro permanentemente', inline: true },
        { name: '👟 Kick', value: 'Expulsar um membro do servidor', inline: true },
        { name: '🔇 Mute', value: 'Silenciar membro por um tempo', inline: true },
        { name: '🔊 Unmute', value: 'Remover silêncio de um membro', inline: true },
        { name: '⚠️ Warn', value: 'Advertir um membro', inline: true },
        { name: '📋 Warns', value: 'Ver histórico de avisos', inline: true },
        { name: '🗑️ Limpar', value: 'Deletar mensagens em massa', inline: true },
        { name: '🚫 Unban', value: 'Desbanir um usuário pelo ID', inline: true },
        { name: '🔄 Remover Warn', value: 'Remover último aviso de um membro', inline: true },
      )
      .setTimestamp()
      .setFooter({ text: '⚔️ Aliança Skyline — Moderação' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('mod:ban').setLabel('Ban').setEmoji('🔨').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mod:kick').setLabel('Kick').setEmoji('👟').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mod:mute').setLabel('Mute').setEmoji('🔇').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mod:unmute').setLabel('Unmute').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('mod:warn').setLabel('Warn').setEmoji('⚠️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mod:warns').setLabel('Warns').setEmoji('📋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mod:limpar').setLabel('Limpar').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mod:unban').setLabel('Unban').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
    );
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('mod:remover_warn').setLabel('Remover Warn').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mod:slowmode').setLabel('Slowmode').setEmoji('🐢').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mod:lock').setLabel('Trancar Canal').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mod:unlock').setLabel('Destrancar').setEmoji('🔓').setStyle(ButtonStyle.Success),
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3], ephemeral: true });
  },
} satisfies Command;
