import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS, baseEmbed, successEmbed, errorEmbed } from '../../utils/embeds';
import { checkServerOwnerOrRepresentative } from '../../utils/permissions';
import { getOrCreateMember } from '../../utils/helpers';

export default {
  category: 'rewards',
  data: new SlashCommandBuilder()
    .setName('recompensa')
    .setDescription('Sistema de moedas e recompensas')
    .addSubcommand(sub =>
      sub.setName('dar').setDescription('Dá moedas para um membro (dono/representante)')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addIntegerOption(opt => opt.setName('quantidade').setDescription('Quantidade de moedas').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('remover').setDescription('Remove moedas de um membro (dono/representante)')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addIntegerOption(opt => opt.setName('quantidade').setDescription('Quantidade de moedas').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('ver').setDescription('Vê o saldo de moedas de um membro')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro (padrão: você)').setRequired(false))
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'dar') {
      if (!(await checkServerOwnerOrRepresentative(interaction))) return;
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      const qtd = interaction.options.getInteger('quantidade', true);
      if (!target) return interaction.reply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')], ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const m = await getOrCreateMember(target.id, target.user.username);
      await prisma.member.update({ where: { discordId: target.id }, data: { coins: { increment: qtd } } });
      await interaction.editReply({ embeds: [successEmbed('Moedas Adicionadas!', `${target} recebeu 🪙 **${qtd}** moedas. Saldo atual: **${m.coins + qtd}**`)] });
    }

    else if (sub === 'remover') {
      if (!(await checkServerOwnerOrRepresentative(interaction))) return;
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      const qtd = interaction.options.getInteger('quantidade', true);
      if (!target) return interaction.reply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')], ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const m = await getOrCreateMember(target.id, target.user.username);
      const newCoins = Math.max(0, m.coins - qtd);
      await prisma.member.update({ where: { discordId: target.id }, data: { coins: newCoins } });
      await interaction.editReply({ embeds: [successEmbed('Moedas Removidas!', `${target} perdeu 🪙 **${qtd - (m.coins - newCoins)}** moedas. Saldo atual: **${newCoins}**`)] });
    }

    else if (sub === 'ver') {
      const target = (interaction.options.getMember('usuario') as GuildMember | null) ?? interaction.member as GuildMember;
      const user = target.user;
      await interaction.deferReply();
      const m = await getOrCreateMember(user.id, user.username);
      const embed = baseEmbed(COLORS.GOLD)
        .setTitle(`🪙 Moedas de ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(`💰 Saldo atual: **${m.coins} moedas**`)
        .setFooter({ text: '⚔️ Aliança Skyline' });
      await interaction.editReply({ embeds: [embed] });
    }
  },
} satisfies Command;
