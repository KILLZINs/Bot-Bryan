import {
  SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, GuildMember, EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS, baseEmbed, successEmbed, errorEmbed } from '../../utils/embeds';
import { getConfig, parseDuration } from '../../utils/helpers';
import { checkModerator } from '../../utils/permissions';
import { applyTemplate } from '../../utils/embedTemplates';

async function logAction(guild: any, channelId: string | null | undefined, embed: EmbedBuilder) {
  if (!channelId) return;
  const ch = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (ch) await ch.send({ embeds: [embed] }).catch(() => null);
}

export default {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('moderacao')
    .setDescription('Ações de moderação do servidor')
    .addSubcommand(sub =>
      sub.setName('ban').setDescription('Bane um membro do servidor')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro a banir').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo do banimento').setRequired(true))
        .addIntegerOption(opt => opt.setName('dias').setDescription('Dias de mensagens a deletar (0-7)').setMinValue(0).setMaxValue(7))
    )
    .addSubcommand(sub =>
      sub.setName('kick').setDescription('Expulsa um membro do servidor')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro a expulsar').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo da expulsão').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('mute').setDescription('Muta um membro (Discord Timeout)')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro a mutar').setRequired(true))
        .addStringOption(opt => opt.setName('duracao').setDescription('Duração: 1h, 30m, 1d, 7d').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('unmute').setDescription('Remove o mute de um membro')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro a desmutar').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('warn').setDescription('Adverte um membro')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro a advertir').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo da advertência').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('warns').setDescription('Vê os avisos de um membro')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('limpar').setDescription('Apaga mensagens do canal')
        .addIntegerOption(opt => opt.setName('quantidade').setDescription('Quantidade de mensagens (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await checkModerator(interaction))) return;

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const config = await getConfig(guild.id);

    // ── BAN ────────────────────────────────────────────────────────
    if (sub === 'ban') {
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      const motivo = interaction.options.getString('motivo', true);
      const dias = interaction.options.getInteger('dias') ?? 0;
      await interaction.deferReply({ ephemeral: true });
      if (!target) return interaction.editReply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')] });
      if (!target.bannable) return interaction.editReply({ embeds: [errorEmbed('Sem permissão', 'Não consigo banir este membro.')] });
      try {
        await target.ban({ reason: `${interaction.user.tag}: ${motivo}`, deleteMessageSeconds: dias * 86400 });
        { const banEmbed = baseEmbed(COLORS.ERROR).setTitle(`${EMOJIS.HAMMER} Membro Banido`).addFields({ name: 'Usuário', value: `${target.user.tag} (${target.id})`, inline: true }, { name: 'Moderador', value: interaction.user.tag, inline: true }, { name: 'Motivo', value: motivo }); applyTemplate(banEmbed, 'mod.ban'); await logAction(guild, config.logChannelId, banEmbed); }
        await interaction.editReply({ embeds: [successEmbed('Banido!', `**${target.user.tag}** foi banido.\nMotivo: ${motivo}`)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed('Erro', `${e}`)] }); }
    }

    // ── KICK ───────────────────────────────────────────────────────
    else if (sub === 'kick') {
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      const motivo = interaction.options.getString('motivo', true);
      await interaction.deferReply({ ephemeral: true });
      if (!target) return interaction.editReply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')] });
      if (!target.kickable) return interaction.editReply({ embeds: [errorEmbed('Sem permissão', 'Não consigo expulsar este membro.')] });
      try {
        await target.kick(`${interaction.user.tag}: ${motivo}`);
        { const kickEmbed = baseEmbed(COLORS.WARNING).setTitle('🥾 Membro Expulso').addFields({ name: 'Usuário', value: `${target.user.tag}`, inline: true }, { name: 'Moderador', value: interaction.user.tag, inline: true }, { name: 'Motivo', value: motivo }); applyTemplate(kickEmbed, 'mod.kick'); await logAction(guild, config.logChannelId, kickEmbed); }
        await interaction.editReply({ embeds: [successEmbed('Expulso!', `**${target.user.tag}** foi expulso.\nMotivo: ${motivo}`)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed('Erro', `${e}`)] }); }
    }

    // ── MUTE ───────────────────────────────────────────────────────
    else if (sub === 'mute') {
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      const duracaoStr = interaction.options.getString('duracao', true);
      const motivo = interaction.options.getString('motivo', true);
      const ms = parseDuration(duracaoStr);
      await interaction.deferReply({ ephemeral: true });
      if (!target) return interaction.editReply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')] });
      if (!ms) return interaction.editReply({ embeds: [errorEmbed('Duração inválida', 'Use: `1h`, `30m`, `1d`')] });
      if (ms > 28 * 24 * 60 * 60 * 1000) return interaction.editReply({ embeds: [errorEmbed('Duração inválida', 'Máximo de 28 dias.')] });
      try {
        await target.timeout(ms, `${interaction.user.tag}: ${motivo}`);
        await logAction(guild, config.logChannelId, baseEmbed(COLORS.INFO).setTitle('🔇 Membro Mutado').addFields({ name: 'Usuário', value: target.user.tag, inline: true }, { name: 'Duração', value: duracaoStr, inline: true }, { name: 'Moderador', value: interaction.user.tag, inline: true }, { name: 'Motivo', value: motivo }));
        await interaction.editReply({ embeds: [successEmbed('Mutado!', `**${target.user.tag}** foi mutado por **${duracaoStr}**.\nMotivo: ${motivo}`)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed('Erro', `${e}`)] }); }
    }

    // ── UNMUTE ─────────────────────────────────────────────────────
    else if (sub === 'unmute') {
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      await interaction.deferReply({ ephemeral: true });
      if (!target) return interaction.editReply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')] });
      try {
        await target.timeout(null);
        await interaction.editReply({ embeds: [successEmbed('Desmutado!', `**${target.user.tag}** foi desmutado.`)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed('Erro', `${e}`)] }); }
    }

    // ── WARN ───────────────────────────────────────────────────────
    else if (sub === 'warn') {
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      const motivo = interaction.options.getString('motivo', true);
      await interaction.deferReply({ ephemeral: true });
      if (!target) return interaction.editReply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')] });
      await prisma.warn.create({ data: { memberId: target.id, guildId: guild.id, moderator: interaction.user.id, reason: motivo } });
      await prisma.member.upsert({ where: { discordId: target.id }, update: { warnings: { increment: 1 } }, create: { discordId: target.id, username: target.user.username, warnings: 1 } });
      const total = await prisma.warn.count({ where: { memberId: target.id, guildId: guild.id } });
      { const warnEmbed = baseEmbed(COLORS.WARNING).setTitle('⚠️ Membro Advertido').addFields({ name: 'Usuário', value: `${target.user.tag} (${target.id})`, inline: true }, { name: 'Moderador', value: interaction.user.tag, inline: true }, { name: 'Total de avisos', value: `${total}`, inline: true }, { name: 'Motivo', value: motivo }); applyTemplate(warnEmbed, 'mod.warn'); await logAction(guild, config.logChannelId, warnEmbed); }
      await interaction.editReply({ embeds: [successEmbed('Advertido!', `**${target.user.tag}** advertido. Total: ${total} aviso${total !== 1 ? 's' : ''}.\nMotivo: ${motivo}`)] });
    }

    // ── WARNS ──────────────────────────────────────────────────────
    else if (sub === 'warns') {
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      await interaction.deferReply({ ephemeral: true });
      if (!target) return interaction.editReply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')] });
      const warns = await prisma.warn.findMany({ where: { memberId: target.id, guildId: guild.id }, orderBy: { createdAt: 'desc' }, take: 10 });
      if (!warns.length) return interaction.editReply({ embeds: [baseEmbed().setTitle('📋 Avisos').setDescription(`**${target.user.tag}** não tem avisos.`)] });
      const list = warns.map((w, i) => `**${i + 1}.** ${w.reason} — <@${w.moderator}> — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join('\n');
      await interaction.editReply({ embeds: [baseEmbed(COLORS.WARNING).setTitle(`⚠️ Avisos de ${target.user.tag}`).setDescription(list).setFooter({ text: `${warns.length} aviso(s) recentes` })] });
    }

    // ── LIMPAR ─────────────────────────────────────────────────────
    else if (sub === 'limpar') {
      const qtd = interaction.options.getInteger('quantidade', true);
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.channel as TextChannel;
      const deleted = await channel.bulkDelete(qtd, true);
      await interaction.editReply({ embeds: [successEmbed('Mensagens Apagadas', `**${deleted.size}** mensagem${deleted.size !== 1 ? 's' : ''} apagada${deleted.size !== 1 ? 's' : ''}.`)] });
    }
  },
} satisfies Command;
