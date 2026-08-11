import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS } from '../../utils/embeds';

export default {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Estatísticas e informações do servidor'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    await guild.fetch();

    const totalMembers = await prisma.member.count();
    const totalXP = await prisma.member.aggregate({ _sum: { xp: true } });
    const totalCoins = await prisma.member.aggregate({ _sum: { coins: true } });
    const openTickets = await prisma.ticket.count({ where: { status: 'OPEN' } });
    const upcomingEvents = await prisma.event.count({ where: { status: 'UPCOMING' } });

    const onlineCount = guild.members.cache.filter(
      (m) => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd'
    ).size;

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.SHIELD} ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .setDescription(guild.description ?? 'A aliança mais poderosa do servidor!')
      .addFields(
        { name: '👥 Membros Discord', value: `${guild.memberCount}`, inline: true },
        { name: `${EMOJIS.XP} Online`, value: `${onlineCount}`, inline: true },
        { name: '📋 Membros Aliança', value: `${totalMembers}`, inline: true },
        { name: `${EMOJIS.FIRE} XP Total`, value: `${totalXP._sum.xp?.toLocaleString('pt-BR') ?? 0}`, inline: true },
        { name: `${EMOJIS.COINS} Moedas em Circulação`, value: `${totalCoins._sum.coins?.toLocaleString('pt-BR') ?? 0} 💜`, inline: true },
        { name: `${EMOJIS.TICKET} Tickets Abertos`, value: `${openTickets}`, inline: true },
        { name: `${EMOJIS.SPARKLES} Próximos Eventos`, value: `${upcomingEvents}`, inline: true },
        { name: '🗓️ Servidor Criado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '👑 Dono', value: `<@${guild.ownerId}>`, inline: true },
      )
      .setImage(guild.bannerURL({ size: 1024 }) ?? null)
      .setFooter({ text: `ID: ${guild.id} • ⚔️ Aliança Skyline` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
