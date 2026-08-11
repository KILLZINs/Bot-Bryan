import { GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { getOrCreateMember } from '../utils/helpers';
import { COLORS, EMOJIS } from '../utils/embeds';

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member: GuildMember) {
    // Register in DB
    await getOrCreateMember(member.id, member.user.username).catch(console.error);

    // Auto-assign member role
    const memberRoleId = process.env.MEMBER_ROLE_ID;
    if (memberRoleId) {
      const role = member.guild.roles.cache.get(memberRoleId);
      if (role) await member.roles.add(role).catch(console.error);
    }

    // Welcome message
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
    if (!welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel | undefined;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.SPARKLES} Bem-vindo(a) à Aliança Skyline!`)
      .setDescription(
        `Olá, ${member}! Estamos felizes em ter você conosco.\n\n` +
        `${EMOJIS.SHIELD} **Aliança Skyline** — Unidos somos mais fortes.\n\n` +
        `Use \`/ajuda\` para ver todos os comandos disponíveis.\n` +
        `Explore os canais e apresente-se para a comunidade!`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: `${EMOJIS.CROWN} Rank Inicial`, value: '🔰 Recruta', inline: true },
        { name: `${EMOJIS.XP} XP`, value: '0 XP', inline: true },
        { name: `${EMOJIS.COINS} Moedas`, value: '0 💜', inline: true }
      )
      .setFooter({ text: `Membro #${member.guild.memberCount} • ⚔️ Aliança Skyline` })
      .setTimestamp();

    await channel.send({ content: `${member}`, embeds: [embed] }).catch(console.error);

    // Log
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;
    const logChannel = member.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('👋 Novo Membro')
      .setDescription(`${member} entrou no servidor`)
      .addFields({ name: 'ID', value: member.id })
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
  },
};
