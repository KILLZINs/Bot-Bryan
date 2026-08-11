import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { Command, RANKS, xpForNextLevel } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember, checkModerator } from '../../utils/helpers';
import { COLORS, EMOJIS, rankEmoji, levelBar, successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds';

export default {
  category: 'members',
  data: new SlashCommandBuilder()
    .setName('membro')
    .setDescription('Gerencia membros da aliança')
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Ver informações de um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro para consultar').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('adicionar')
        .setDescription('[MOD] Adiciona um membro à aliança')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário a adicionar').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('[MOD] Remove um membro da aliança')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário a remover').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('lista')
        .setDescription('Lista todos os membros da aliança')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'info') {
      const target = interaction.options.getUser('usuario') ?? interaction.user;
      const member = await getOrCreateMember(target.id, target.username);
      const xpNeeded = xpForNextLevel(member.level);
      const bar = levelBar(member.xp, xpNeeded);
      const rank = await prisma.member.count({ where: { xp: { gt: member.xp } } });

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${rankEmoji(member.rank)} ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: `${EMOJIS.CROWN} Rank`, value: member.rank, inline: true },
          { name: `${EMOJIS.LEVEL} Nível`, value: `${member.level}`, inline: true },
          { name: `${EMOJIS.CHART} Posição`, value: `#${rank + 1}`, inline: true },
          { name: `${EMOJIS.XP} XP`, value: `${member.xp} / ${xpNeeded} XP\n\`${bar}\``, inline: false },
          { name: `${EMOJIS.COINS} Moedas`, value: `${member.coins} 💜`, inline: true },
          { name: `${EMOJIS.WARNING} Avisos`, value: `${member.warnings}`, inline: true },
          { name: '📅 Entrou em', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>`, inline: true },
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'adicionar') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const guildMember = interaction.guild?.members.cache.get(target.id) as GuildMember | undefined;

      await getOrCreateMember(target.id, target.username);

      const memberRoleId = process.env.MEMBER_ROLE_ID;
      if (memberRoleId && guildMember) {
        const role = interaction.guild?.roles.cache.get(memberRoleId);
        if (role) await guildMember.roles.add(role).catch(console.error);
      }

      await interaction.reply({
        embeds: [successEmbed('Membro Adicionado', `${target} foi adicionado(a) à Aliança Skyline!`)],
      });

    } else if (sub === 'remover') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);

      const memberRoleId = process.env.MEMBER_ROLE_ID;
      const guildMember = interaction.guild?.members.cache.get(target.id) as GuildMember | undefined;
      if (memberRoleId && guildMember) {
        const role = interaction.guild?.roles.cache.get(memberRoleId);
        if (role) await guildMember.roles.remove(role).catch(console.error);
      }

      await interaction.reply({
        embeds: [successEmbed('Membro Removido', `${target} foi removido(a) da Aliança Skyline.`)],
      });

    } else if (sub === 'lista') {
      const members = await prisma.member.findMany({
        orderBy: [{ level: 'desc' }, { xp: 'desc' }],
        take: 20,
      });

      if (!members.length) {
        await interaction.reply({ embeds: [infoEmbed('Sem Membros', 'Nenhum membro registrado ainda.')], ephemeral: true });
        return;
      }

      const list = members
        .map((m, i) => `**${i + 1}.** ${rankEmoji(m.rank)} **${m.username}** — Nível ${m.level} | ${m.coins} 💜`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${EMOJIS.SCROLL} Membros da Aliança Skyline`)
        .setDescription(list)
        .setFooter({ text: `Total: ${members.length} membros • ⚔️ Aliança Skyline` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },
} satisfies Command;
