import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { getOrCreateMember, checkModerator, checkAdmin } from '../../utils/helpers';
import { COLORS, EMOJIS, successEmbed, errorEmbed } from '../../utils/embeds';

export default {
  category: 'rewards',
  data: new SlashCommandBuilder()
    .setName('conquista')
    .setDescription('Sistema de conquistas da aliança')
    .addSubcommand((sub) =>
      sub
        .setName('conceder')
        .setDescription('[MOD] Concede uma conquista a um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addStringOption((opt) => opt.setName('nome').setDescription('Nome da conquista').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista as conquistas de um membro')
        .addUserOption((opt) => opt.setName('usuario').setDescription('Membro (opcional)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('[ADMIN] Cria uma nova conquista')
        .addStringOption((opt) => opt.setName('nome').setDescription('Nome').setRequired(true))
        .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição').setRequired(true))
        .addStringOption((opt) => opt.setName('icone').setDescription('Emoji do ícone').setRequired(false))
        .addIntegerOption((opt) => opt.setName('recompensa').setDescription('Moedas de recompensa').setMinValue(0))
    )
    .addSubcommand((sub) =>
      sub.setName('todas').setDescription('Lista todas as conquistas disponíveis')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'criar') {
      if (!(await checkAdmin(interaction))) return;
      const nome = interaction.options.getString('nome', true);
      const desc = interaction.options.getString('descricao', true);
      const icone = interaction.options.getString('icone') ?? '🏆';
      const recompensa = interaction.options.getInteger('recompensa') ?? 0;

      const existing = await prisma.achievement.findUnique({ where: { name: nome } });
      if (existing) {
        await interaction.reply({ embeds: [errorEmbed('Já Existe', `A conquista **${nome}** já existe.`)], ephemeral: true });
        return;
      }

      await prisma.achievement.create({ data: { name: nome, description: desc, icon: icone, reward: recompensa } });
      await interaction.reply({ embeds: [successEmbed('Conquista Criada', `${icone} **${nome}** foi criada com sucesso!`)] });

    } else if (sub === 'conceder') {
      if (!(await checkModerator(interaction))) return;
      const target = interaction.options.getUser('usuario', true);
      const nome = interaction.options.getString('nome', true);

      const achievement = await prisma.achievement.findUnique({ where: { name: nome } });
      if (!achievement) {
        await interaction.reply({ embeds: [errorEmbed('Não Encontrada', `A conquista **${nome}** não existe. Use \`/conquista todas\` para ver as disponíveis.`)], ephemeral: true });
        return;
      }

      const member = await getOrCreateMember(target.id, target.username);
      const already = await prisma.memberAchievement.findUnique({ where: { memberId_achievementId: { memberId: member.id, achievementId: achievement.id } } });
      if (already) {
        await interaction.reply({ embeds: [errorEmbed('Já Tem', `${target} já possui a conquista **${nome}**.`)], ephemeral: true });
        return;
      }

      await prisma.$transaction([
        prisma.memberAchievement.create({ data: { memberId: member.id, achievementId: achievement.id, grantedBy: interaction.user.username } }),
        ...(achievement.reward > 0 ? [prisma.member.update({ where: { id: member.id }, data: { coins: { increment: achievement.reward } } })] : []),
      ]);

      const embed = new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle(`${achievement.icon} Conquista Desbloqueada!`)
        .setDescription(`${target} desbloqueou **${achievement.name}**!\n\n${achievement.description}${achievement.reward > 0 ? `\n\n${EMOJIS.COINS} +${achievement.reward} moedas de recompensa!` : ''}`)
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'listar') {
      const target = interaction.options.getUser('usuario') ?? interaction.user;
      const member = await getOrCreateMember(target.id, target.username);
      const items = await prisma.memberAchievement.findMany({ where: { memberId: member.id }, include: { achievement: true } });

      if (!items.length) {
        await interaction.reply({ embeds: [errorEmbed('Sem Conquistas', `${target} ainda não possui conquistas.`)], ephemeral: true });
        return;
      }

      const list = items.map((i) => `${i.achievement.icon} **${i.achievement.name}** — ${i.achievement.description}`).join('\n');
      const embed = new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle(`${EMOJIS.TROPHY} Conquistas de ${target.username}`)
        .setDescription(list)
        .setFooter({ text: `${items.length} conquista(s) • ⚔️ Aliança Skyline` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'todas') {
      const achievements = await prisma.achievement.findMany({ orderBy: { reward: 'desc' } });
      if (!achievements.length) {
        await interaction.reply({ embeds: [errorEmbed('Sem Conquistas', 'Nenhuma conquista criada ainda.')], ephemeral: true });
        return;
      }

      const list = achievements.map((a) => `${a.icon} **${a.name}** — ${a.description}${a.reward > 0 ? ` *(+${a.reward} 💜)*` : ''}`).join('\n');
      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${EMOJIS.TROPHY} Conquistas da Aliança Skyline`)
        .setDescription(list)
        .setFooter({ text: `${achievements.length} conquista(s) disponíveis • ⚔️ Aliança Skyline` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },
} satisfies Command;
