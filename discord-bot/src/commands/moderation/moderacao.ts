import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember, checkModerator, checkAdmin, parseDuration, formatDuration } from '../../utils/helpers';
import { COLORS, EMOJIS, successEmbed, errorEmbed } from '../../utils/embeds';

async function sendLog(interaction: ChatInputCommandInteraction, embed: EmbedBuilder) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  if (!logChannelId) return;
  const ch = interaction.guild?.channels.cache.get(logChannelId) as TextChannel | undefined;
  if (ch) await ch.send({ embeds: [embed] }).catch(console.error);
}

export default {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Comandos de moderação')
    .addSubcommand((sub) =>
      sub
        .setName('kick')
        .setDescription('[MOD] Expulsa um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a expulsar').setRequired(true))
        .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('[ADMIN] Bane um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a banir').setRequired(true))
        .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('unban')
        .setDescription('[ADMIN] Remove o ban de um usuário')
        .addStringOption((opt) => opt.setName('userid').setDescription('ID do usuário').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('warn')
        .setDescription('[MOD] Adverte um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a advertir').setRequired(true))
        .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('warns')
        .setDescription('Vê os avisos de um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('clearwarns')
        .setDescription('[MOD] Limpa os avisos de um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('mute')
        .setDescription('[MOD] Silencia um membro temporariamente')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addStringOption((opt) => opt.setName('duracao').setDescription('Duração (ex: 10m, 1h, 2d)').setRequired(true))
        .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('unmute')
        .setDescription('[MOD] Remove o silêncio de um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('purge')
        .setDescription('[MOD] Deleta mensagens em massa')
        .addIntegerOption((opt) => opt.setName('quantidade').setDescription('Quantidade (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    if (sub === 'kick') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const motivo = interaction.options.getString('motivo') ?? 'Sem motivo';
      const gm = guild.members.cache.get(target.id) as GuildMember | undefined;

      if (!gm) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrado', 'Usuário não está no servidor.')], ephemeral: true });
        return;
      }

      await gm.kick(motivo);
      await interaction.reply({ embeds: [successEmbed('Membro Expulso', `${target.username} foi expulso.\n📝 Motivo: ${motivo}`)] });

      const logEmbed = new EmbedBuilder().setColor(COLORS.WARNING).setTitle(`${EMOJIS.WARNING} Kick`)
        .addFields({ name: 'Membro', value: `${target} (${target.id})` }, { name: 'Motivo', value: motivo }, { name: 'Moderador', value: `${interaction.user}` })
        .setTimestamp();
      await sendLog(interaction, logEmbed);

    } else if (sub === 'ban') {
      if (!(await checkAdmin(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const motivo = interaction.options.getString('motivo') ?? 'Sem motivo';

      await guild.members.ban(target.id, { reason: motivo, deleteMessageSeconds: 86400 });
      await interaction.reply({ embeds: [successEmbed('Membro Banido', `${target.username} foi banido.\n📝 Motivo: ${motivo}`)] });

      const logEmbed = new EmbedBuilder().setColor(COLORS.ERROR).setTitle(`🔨 Ban`)
        .addFields({ name: 'Membro', value: `${target} (${target.id})` }, { name: 'Motivo', value: motivo }, { name: 'Admin', value: `${interaction.user}` })
        .setTimestamp();
      await sendLog(interaction, logEmbed);

    } else if (sub === 'unban') {
      if (!(await checkAdmin(interaction))) return;
      const userId = interaction.options.getString('userid', true);
      await guild.members.unban(userId);
      await interaction.reply({ embeds: [successEmbed('Desbanido', `Usuário \`${userId}\` foi desbanido.`)] });

    } else if (sub === 'warn') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const motivo = interaction.options.getString('motivo', true);

      const member = await getOrCreateMember(target.id, target.username);
      await prisma.$transaction([
        prisma.warning.create({ data: { memberId: member.id, reason: motivo, issuedBy: interaction.user.username } }),
        prisma.member.update({ where: { id: member.id }, data: { warnings: { increment: 1 } } }),
      ]);

      const updated = await prisma.member.findUnique({ where: { id: member.id } });
      await interaction.reply({ embeds: [successEmbed('Aviso Aplicado', `${target} recebeu um aviso. Total: **${updated?.warnings ?? 0}**\n📝 Motivo: ${motivo}`)] });

      const logEmbed = new EmbedBuilder().setColor(COLORS.WARNING).setTitle(`${EMOJIS.WARNING} Aviso`)
        .addFields({ name: 'Membro', value: `${target} (${target.id})` }, { name: 'Motivo', value: motivo }, { name: 'Moderador', value: `${interaction.user}` }, { name: 'Total de Avisos', value: `${updated?.warnings ?? 0}` })
        .setTimestamp();
      await sendLog(interaction, logEmbed);

    } else if (sub === 'warns') {
      const target = interaction.options.getUser('usuario', true);
      const member = await getOrCreateMember(target.id, target.username);
      const warns = await prisma.warning.findMany({ where: { memberId: member.id }, orderBy: { createdAt: 'desc' } });

      if (!warns.length) {
        await interaction.reply({ embeds: [successEmbed('Sem Avisos', `${target.username} não possui avisos.`)] });
        return;
      }

      const list = warns.map((w, i) => `**${i + 1}.** ${w.reason}\n└ Por: ${w.issuedBy} | <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join('\n\n');
      const embed = new EmbedBuilder().setColor(COLORS.WARNING).setTitle(`${EMOJIS.WARNING} Avisos de ${target.username}`)
        .setDescription(list).setFooter({ text: `${warns.length} aviso(s) • ⚔️ Aliança Skyline` }).setTimestamp();
      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'clearwarns') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const member = await getOrCreateMember(target.id, target.username);
      await prisma.$transaction([
        prisma.warning.deleteMany({ where: { memberId: member.id } }),
        prisma.member.update({ where: { id: member.id }, data: { warnings: 0 } }),
      ]);
      await interaction.reply({ embeds: [successEmbed('Avisos Limpos', `Todos os avisos de ${target.username} foram removidos.`)] });

    } else if (sub === 'mute') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const duracaoStr = interaction.options.getString('duracao', true);
      const motivo = interaction.options.getString('motivo') ?? 'Sem motivo';
      const ms = parseDuration(duracaoStr);

      if (!ms) {
        await interaction.reply({ embeds: [errorEmbed('Duração Inválida', 'Use formatos como: `10m`, `1h`, `2d`')], ephemeral: true });
        return;
      }

      const gm = guild.members.cache.get(target.id);
      if (!gm) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrado', 'Usuário não está no servidor.')], ephemeral: true });
        return;
      }

      await gm.timeout(ms, motivo);

      const muteExpiry = new Date(Date.now() + ms);
      await getOrCreateMember(target.id, target.username);
      await prisma.member.update({ where: { discordId: target.id }, data: { isMuted: true, muteExpiry } });

      await interaction.reply({ embeds: [successEmbed('Membro Silenciado', `${target.username} foi silenciado por **${formatDuration(ms)}**.\n📝 Motivo: ${motivo}`)] });

    } else if (sub === 'unmute') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const gm = guild.members.cache.get(target.id);
      if (gm) await gm.timeout(null);
      await prisma.member.updateMany({ where: { discordId: target.id }, data: { isMuted: false, muteExpiry: null } });
      await interaction.reply({ embeds: [successEmbed('Silêncio Removido', `${target.username} pode falar novamente.`)] });

    } else if (sub === 'purge') {
      if (!(await checkModerator(interaction))) return;
      const qty = interaction.options.getInteger('quantidade', true);
      const channel = interaction.channel as TextChannel;
      await interaction.deferReply({ ephemeral: true });
      const deleted = await channel.bulkDelete(qty, true);
      await interaction.editReply({ embeds: [successEmbed('Mensagens Deletadas', `${deleted.size} mensagem(ns) removida(s).`)] });
    }
  },
} satisfies Command;
