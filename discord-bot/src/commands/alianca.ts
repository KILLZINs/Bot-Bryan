import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { Command } from '../types';
import { COLORS, EMOJIS, errorEmbed } from '../utils/embeds';
import { isBotManager } from '../utils/allowlist';

export default {
  category: 'alianca',
  data: new SlashCommandBuilder()
    .setName('alianca')
    .setDescription('Painel de administração da Aliança Skyline (apenas adm aliança)'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isBotManager(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Sem Permissão', 'Apenas administradores da Aliança Skyline podem usar este painel.')],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🌌 Aliança Skyline — Painel ADM')
      .setDescription(
        'Gerencie a Aliança Skyline através dos painéis abaixo.\n\n' +
        '**Servidores:** Adicionar, remover e atualizar classes\n' +
        '**Pessoas:** Definir representantes e donos por servidor\n' +
        '**Embed Oficial:** Enviar ou atualizar o embed público da aliança\n' +
        '**Blacklist:** Banir usuário de todos os servidores da aliança\n' +
        '**Allowlist:** Gerenciar servidores e managers autorizados'
      )
      .addFields(
        { name: '🏛️ Servidores',      value: 'Gerenciar servidores membros',           inline: true },
        { name: '👥 Representantes',   value: 'Definir donos e representantes',         inline: true },
        { name: '📊 Análise',          value: 'Ver detalhes de todos os servidores',    inline: true },
        { name: '📢 Embed Oficial',    value: 'Enviar/atualizar embed da aliança',      inline: true },
        { name: '🚫 Blacklist',        value: 'Banir usuário de todos os servidores',   inline: true },
        { name: '👁️ Ver Membros',      value: 'Listar donos e representantes',          inline: true },
        { name: '🌐 Acesso (Allowlist)', value: 'Servidores e managers autorizados',   inline: true },
      )
      .setFooter({ text: '⚔️ Aliança Skyline — Admin' })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('alianca:add_server')      .setLabel('Adicionar Servidor').setEmoji('➕').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('alianca:remove_server')   .setLabel('Remover Servidor')  .setEmoji('➖').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('alianca:update_classes')  .setLabel('Atualizar Classes') .setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('alianca:set_member')      .setLabel('Setar Rep/Dono')    .setEmoji('👤').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('alianca:remove_member')   .setLabel('Remover Rep/Dono')  .setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('alianca:view_members')    .setLabel('Ver Reps/Donos')    .setEmoji('👥').setStyle(ButtonStyle.Secondary),
    );
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('alianca:analysis')        .setLabel('Análise')           .setEmoji('📊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('alianca:send_embed')      .setLabel('Enviar Embed')      .setEmoji('📢').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('alianca:update_embed')    .setLabel('Atualizar Embed')   .setEmoji('🔁').setStyle(ButtonStyle.Secondary),
    );
    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('alianca:blacklist_add')   .setLabel('Blacklist Add')     .setEmoji('🚫').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('alianca:blacklist_remove').setLabel('Blacklist Remover') .setEmoji('✅').setStyle(ButtonStyle.Secondary),
    );
    // Linha 5 — Painel Admin mesclado (apenas allowlist)
    const row5 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('alianca:allowlist').setLabel('Acesso (Allowlist)').setEmoji('🌐').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4, row5], ephemeral: true });
  },
} satisfies Command;
