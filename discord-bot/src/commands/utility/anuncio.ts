import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { Command } from '../../types';
import { checkModerator } from '../../utils/helpers';
import { COLORS, EMOJIS, errorEmbed } from '../../utils/embeds';

export default {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('anuncio')
    .setDescription('[MOD] Envia um anúncio oficial da aliança')
    .addStringOption((opt) => opt.setName('titulo').setDescription('Título do anúncio').setRequired(true))
    .addStringOption((opt) => opt.setName('conteudo').setDescription('Conteúdo do anúncio').setRequired(true).setMaxLength(2000))
    .addChannelOption((opt) => opt.setName('canal').setDescription('Canal de destino (padrão: canal de anúncios)').setRequired(false))
    .addStringOption((opt) => opt.setName('mencao').setDescription('Menção (@everyone, @here ou ID do cargo)').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkModerator(interaction))) return;

    const titulo = interaction.options.getString('titulo', true);
    const conteudo = interaction.options.getString('conteudo', true);
    const mencao = interaction.options.getString('mencao') ?? '';

    const targetChannel = (interaction.options.getChannel('canal') as TextChannel | null) ??
      (interaction.guild?.channels.cache.get(process.env.ANNOUNCEMENT_CHANNEL_ID ?? '') as TextChannel | undefined);

    if (!targetChannel) {
      await interaction.reply({
        embeds: [errorEmbed('Canal Não Encontrado', 'Especifique um canal ou configure `ANNOUNCEMENT_CHANNEL_ID` no `.env`.')],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.MEGAPHONE} ${titulo}`)
      .setDescription(conteudo)
      .setAuthor({ name: 'Aliança Skyline', iconURL: interaction.guild?.iconURL() ?? undefined })
      .setFooter({ text: `Anúncio por ${interaction.user.username} • ⚔️ Aliança Skyline` })
      .setTimestamp();

    await targetChannel.send({ content: mencao || undefined, embeds: [embed] });
    await interaction.reply({ content: `✅ Anúncio enviado para ${targetChannel}!`, ephemeral: true });
  },
} satisfies Command;
