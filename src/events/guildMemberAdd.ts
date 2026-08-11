import { GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { getOrCreateMember, getConfig } from '../utils/helpers';
import { COLORS, EMOJIS } from '../utils/embeds';
import { getBotConfig } from '../utils/botConfig';
import { prisma } from '../database/client';
import { isAllianceServer, buildOfficialAllianceEmbed } from '../utils/alliance';
import { applyTemplate } from '../utils/embedTemplates';
import { sendLog, logMemberJoin, LOG } from '../utils/logger';

function today() { return new Date().toISOString().slice(0, 10); }

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member: GuildMember) {
    const guildId = member.guild.id;

    // ─── Track join stat ──────────────────────────────────────────────────────
    await prisma.serverStat.upsert({
      where:  { guildId_date: { guildId, date: today() } },
      update: { joins: { increment: 1 } },
      create: { guildId, date: today(), joins: 1 },
    }).catch(console.error);

    await getOrCreateMember(member.id, member.user.username).catch(console.error);

    // ─── Blacklist check — banir automaticamente se estiver na blacklist ───────
    const blacklisted = await prisma.allianceBlacklist.findUnique({ where: { userId: member.id } }).catch(() => null);
    if (blacklisted) {
      await member.ban({ reason: `[Blacklist Aliança] ${blacklisted.reason ?? 'Sem motivo'}` }).catch(console.error);
      return;
    }

    const config = await getConfig(guildId);

    // ─── Log de entrada ───────────────────────────────────────────────────────
    sendLog(member.guild, LOG.MEMBERS, logMemberJoin(member)).catch(() => null);

    // ─── Auto-role ─────────────────────────────────────────────────────────────
    const roleToAssign = config.autoRoleId ?? config.memberRoleId ?? process.env.MEMBER_ROLE_ID;
    if (roleToAssign) {
      const role = member.guild.roles.cache.get(roleToAssign);
      if (role) await member.roles.add(role).catch(console.error);
    }

    // ─── Welcome message no canal ─────────────────────────────────────────────
    const welcomeChannelId = config.welcomeChannelId ?? process.env.WELCOME_CHANNEL_ID;
    if (welcomeChannelId) {
      const channel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel | undefined;
      if (channel) {
        const customMsg = config.welcomeMessage
          ?.replace(/{user}/g, `${member}`)
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{count}/g, `${member.guild.memberCount}`);

        const embed = new EmbedBuilder()
          .setColor(COLORS.PRIMARY)
          .setTitle(`${EMOJIS.SPARKLES} Bem-vindo(a) à ${member.guild.name}!`)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setDescription(
            customMsg ??
            `Olá, ${member}! Estamos felizes em ter você conosco. 💜\n\n` +
            `${EMOJIS.SHIELD} **${member.guild.name}** — Unidos somos mais fortes.\n\n` +
            `Use \`/painel\` para ver tudo que o bot oferece!`
          )
          .addFields(
            { name: '👥 Membro nº', value: `**#${member.guild.memberCount}**`, inline: true },
            { name: '📅 Conta criada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: true },
          )
          .setFooter({ text: `⚔️ ${member.guild.name}` })
          .setTimestamp();

        applyTemplate(embed, 'welcome.channel');
        await channel.send({ content: `👋 Boas-vindas, ${member}!`, embeds: [embed] }).catch(console.error);
      }
    }

    // ─── DM com embed oficial da aliança ──────────────────────────────────────
    // Controlado pelo painel de features do bot (/botpanel → DM Boas-vindas)
    if (!getBotConfig().featWelcomeDm) return;

    const inAlliance = await isAllianceServer(guildId).catch(() => false);
    if (!inAlliance) return;

    try {
      const allianceEmbed = await buildOfficialAllianceEmbed(member.client);
      const dmEmbed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🌌 Bem-vindo(a) à Aliança Skyline!`)
        .setDescription(
          `Olá, **${member.user.username}**! Você acaba de entrar em **${member.guild.name}**,\n` +
          `um servidor membro oficial da **Aliança Skyline**! 💜\n\n` +
          `Aqui estão todos os servidores da nossa aliança — sinta-se à vontade para conhecer cada um deles:`
        )
        .setThumbnail(member.client.user?.displayAvatarURL() ?? null)
        .setFooter({ text: '⚔️ Aliança Skyline — Unidos somos mais fortes' })
        .setTimestamp();

      applyTemplate(dmEmbed, 'welcome.dm');
      await member.user.send({ embeds: [dmEmbed, allianceEmbed] }).catch(() => null);
    } catch { /* silently ignore DM errors */ }
  },
};
