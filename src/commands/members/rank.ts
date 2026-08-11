import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS, baseEmbed, successEmbed, errorEmbed, rankEmoji } from '../../utils/embeds';
import { checkServerOwnerOrRepresentative } from '../../utils/permissions';
import { RANKS } from '../../types';

export default {
  category: 'members',
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Gerencia os ranks dos membros')
    .addSubcommand(sub =>
      sub.setName('definir').setDescription('Define o rank de um membro (dono/representante)')
        .addUserOption(opt => opt.setName('usuario').setDescription('Membro').setRequired(true))
        .addStringOption(opt => opt.setName('rank').setDescription('Rank').setRequired(true)
          .addChoices(...RANKS.map(r => ({ name: r, value: r }))))
    )
    .addSubcommand(sub =>
      sub.setName('lista').setDescription('Vê os ranks disponíveis e seus benefícios')
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'definir') {
      if (!(await checkServerOwnerOrRepresentative(interaction))) return;
      const target = interaction.options.getMember('usuario') as GuildMember | null;
      const newRank = interaction.options.getString('rank', true);
      if (!target) return interaction.reply({ embeds: [errorEmbed('Não encontrado', 'Membro não encontrado.')], ephemeral: true });
      await prisma.member.upsert({
        where: { discordId: target.id },
        update: { rank: newRank },
        create: { discordId: target.id, username: target.user.username, rank: newRank },
      });
      await interaction.reply({ embeds: [successEmbed('Rank Atualizado!', `${target} agora é ${rankEmoji(newRank)} **${newRank}**!`)] });
    }

    else if (sub === 'lista') {
      const rankDescriptions: Record<string, string> = {
        Recruta: 'Novo membro da aliança.',
        Membro: 'Membro confirmado. (Nv 5)',
        Veterano: 'Membro experiente. (Nv 15)',
        Elite: 'Soldado de elite. (Nv 30)',
        Capitão: 'Lidera pequenas tropas. (Nv 50)',
        Comandante: 'Comandante de batalhão. (Nv 75)',
        Líder: 'Liderança suprema da aliança.',
      };
      const list = RANKS.map(r => `${rankEmoji(r)} **${r}** — ${rankDescriptions[r] ?? ''}`).join('\n');
      await interaction.reply({ embeds: [baseEmbed(COLORS.PRIMARY).setTitle(`${EMOJIS.CROWN} Ranks — Aliança Skyline`).setDescription(list)] });
    }
  },
} satisfies Command;
