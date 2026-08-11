import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS, baseEmbed, successEmbed, errorEmbed } from '../../utils/embeds';
import { checkServerOwnerOrRepresentative } from '../../utils/permissions';
import { getOrCreateMember } from '../../utils/helpers';

export default {
  category: 'rewards',
  data: new SlashCommandBuilder()
    .setName('conquista')
    .setDescription('Sistema de conquistas')
    .addSubcommand(sub =>
      sub.setName('criar').setDescription('Cria uma nova conquista (dono/representante)')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome da conquista').setRequired(true).setMaxLength(60))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descrição').setRequired(true).setMaxLength(200))
        .addIntegerOption(opt => opt.setName('xp').setDescription('XP de recompensa').setRequired(true).setMinValue(0))
        .addIntegerOption(opt => opt.setName('moedas').setDescription('Moedas de recompensa').setRequired(false).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('dar').setDescription('Concede uma conquista a um membro (dono/representante)')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addStringOption(opt => opt.setName('nome').setDescription('Nome da conquista').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ver').setDescription('Vê as conquistas de um membro')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro (padrão: você)').setRequired(false))
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'criar') {
      if (!(await checkServerOwnerOrRepresentative(interaction))) return;
      const nome = interaction.options.getString('nome', true);
      const descricao = interaction.options.getString('descricao', true);
      const xp = interaction.options.getInteger('xp', true);
      const moedas = interaction.options.getInteger('moedas') ?? 0;
      await interaction.deferReply({ ephemeral: true });
      const exists = await prisma.achievementTemplate.findFirst({ where: { name: nome, guildId: interaction.guild!.id } });
      if (exists) return interaction.editReply({ embeds: [errorEmbed('Já existe', `Conquista **${nome}** já existe.`)] });
      await prisma.achievementTemplate.create({ data: { guildId: interaction.guild!.id, name: nome, description: descricao, xpReward: xp, coinsReward: moedas } });
      await interaction.editReply({ embeds: [successEmbed('Conquista Criada!', `**${nome}** foi criada com ${xp} XP e ${moedas} moedas de recompensa.`)] });
    }

    else if (sub === 'dar') {
      if (!(await checkServerOwnerOrRepresentative(interaction))) return;
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      const nome = interaction.options.getString('nome', true);
      if (!target) return interaction.reply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')], ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const template = await prisma.achievementTemplate.findFirst({ where: { name: nome, guildId: interaction.guild!.id } });
      if (!template) return interaction.editReply({ embeds: [errorEmbed('Não encontrada', `Conquista **${nome}** não existe. Crie primeiro com \`/conquista criar\`.`)] });
      const m = await getOrCreateMember(target.id, target.user.username);
      const alreadyHas = await prisma.achievement.findFirst({ where: { memberId: m.discordId, name: nome } });
      if (alreadyHas) return interaction.editReply({ embeds: [errorEmbed('Já possui', `${target} já tem a conquista **${nome}**.`)] });
      await prisma.achievement.create({ data: { memberId: m.discordId, name: nome, description: template.description } });
      await prisma.member.update({ where: { discordId: m.discordId }, data: { xp: { increment: template.xpReward }, coins: { increment: template.coinsReward } } });
      await interaction.editReply({ embeds: [successEmbed('Conquista Concedida!', `${target} recebeu a conquista 🏆 **${nome}** (+${template.xpReward} XP, +${template.coinsReward} moedas)`)] });
    }

    else if (sub === 'ver') {
      const target = (interaction.options.getMember('usuario') as GuildMember | null) ?? interaction.member as GuildMember;
      const user = target.user;
      await interaction.deferReply();
      const achievements = await prisma.achievement.findMany({ where: { memberId: user.id }, orderBy: { earnedAt: 'desc' } });
      if (!achievements.length) return interaction.editReply({ embeds: [baseEmbed().setTitle(`${EMOJIS.TROPHY} Conquistas de ${user.username}`).setDescription('Nenhuma conquista ainda.')] });
      const list = achievements.map(a => `🏆 **${a.name}** — ${a.description ?? ''}\n<t:${Math.floor(a.earnedAt.getTime() / 1000)}:D>`).join('\n\n');
      await interaction.editReply({ embeds: [baseEmbed(COLORS.GOLD).setTitle(`${EMOJIS.TROPHY} Conquistas de ${user.username}`).setDescription(list).setThumbnail(user.displayAvatarURL()).setFooter({ text: `${achievements.length} conquista(s) • ⚔️ Aliança Skyline` })] });
    }
  },
} satisfies Command;
