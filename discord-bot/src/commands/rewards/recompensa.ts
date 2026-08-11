import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember, checkModerator } from '../../utils/helpers';
import { COLORS, EMOJIS, successEmbed, errorEmbed } from '../../utils/embeds';

export default {
  category: 'rewards',
  data: new SlashCommandBuilder()
    .setName('recompensa')
    .setDescription('Sistema de moedas da aliança')
    .addSubcommand((sub) =>
      sub
        .setName('dar')
        .setDescription('[MOD] Dá moedas a um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addIntegerOption((opt) => opt.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1))
        .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('[MOD] Remove moedas de um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addIntegerOption((opt) => opt.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('saldo')
        .setDescription('Consulta o saldo de moedas')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro (opcional)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('transferir')
        .setDescription('Transfere moedas para outro membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Destinatário').setRequired(true))
        .addIntegerOption((opt) => opt.setName('quantidade').setDescription('Quantidade').setRequired(true).setMinValue(1))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'dar') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const amount = interaction.options.getInteger('quantidade', true);
      const reason = interaction.options.getString('motivo') ?? 'Sem motivo especificado';

      await getOrCreateMember(target.id, target.username);
      await prisma.member.update({
        where: { discordId: target.id },
        data: { coins: { increment: amount } },
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            'Moedas Adicionadas',
            `**+${amount} 💜** foram adicionadas para ${target}\n📝 Motivo: ${reason}`
          ),
        ],
      });

    } else if (sub === 'remover') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const amount = interaction.options.getInteger('quantidade', true);

      const member = await getOrCreateMember(target.id, target.username);
      if (member.coins < amount) {
        await interaction.reply({ embeds: [errorEmbed('Saldo Insuficiente', `${target} tem apenas **${member.coins} 💜**.`)], ephemeral: true });
        return;
      }

      await prisma.member.update({
        where: { discordId: target.id },
        data: { coins: { decrement: amount } },
      });

      await interaction.reply({
        embeds: [successEmbed('Moedas Removidas', `**-${amount} 💜** removidas de ${target}`)],
      });

    } else if (sub === 'saldo') {
      const target = interaction.options.getUser('usuario') ?? interaction.user;
      const member = await getOrCreateMember(target.id, target.username);

      const embed = new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle(`${EMOJIS.COINS} Saldo de ${target.username}`)
        .setDescription(`**${member.coins} 💜** moedas da aliança`)
        .setThumbnail(target.displayAvatarURL())
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'transferir') {
      const target = interaction.options.getUser('usuario', true);
      const amount = interaction.options.getInteger('quantidade', true);

      if (target.id === interaction.user.id) {
        await interaction.reply({ embeds: [errorEmbed('Erro', 'Você não pode transferir para si mesmo.')], ephemeral: true });
        return;
      }

      const sender = await getOrCreateMember(interaction.user.id, interaction.user.username);
      if (sender.coins < amount) {
        await interaction.reply({ embeds: [errorEmbed('Saldo Insuficiente', `Você tem apenas **${sender.coins} 💜**.`)], ephemeral: true });
        return;
      }

      await getOrCreateMember(target.id, target.username);
      await prisma.$transaction([
        prisma.member.update({ where: { discordId: interaction.user.id }, data: { coins: { decrement: amount } } }),
        prisma.member.update({ where: { discordId: target.id }, data: { coins: { increment: amount } } }),
      ]);

      await interaction.reply({
        embeds: [successEmbed('Transferência Realizada', `Você enviou **${amount} 💜** para ${target}!`)],
      });
    }
  },
} satisfies Command;
