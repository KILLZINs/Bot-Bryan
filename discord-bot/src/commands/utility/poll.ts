import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { Command } from '../../types';
import { prisma } from '../../database/client';
import { COLORS, EMOJIS, errorEmbed } from '../../utils/embeds';

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export default {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('enquete')
    .setDescription('Cria uma enquete interativa')
    .addStringOption((opt) => opt.setName('pergunta').setDescription('Pergunta da enquete').setRequired(true).setMaxLength(256))
    .addStringOption((opt) => opt.setName('opcao1').setDescription('Opção 1').setRequired(true))
    .addStringOption((opt) => opt.setName('opcao2').setDescription('Opção 2').setRequired(true))
    .addStringOption((opt) => opt.setName('opcao3').setDescription('Opção 3').setRequired(false))
    .addStringOption((opt) => opt.setName('opcao4').setDescription('Opção 4').setRequired(false))
    .addStringOption((opt) => opt.setName('opcao5').setDescription('Opção 5').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const pergunta = interaction.options.getString('pergunta', true);
    const opcoes: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const val = interaction.options.getString(`opcao${i}`);
      if (val) opcoes.push(val);
    }

    const poll = await prisma.poll.create({
      data: {
        question: pergunta,
        createdBy: interaction.user.id,
        options: { create: opcoes.map((label) => ({ label })) },
      },
      include: { options: true },
    });

    const optionsText = poll.options.map((o, i) => `${NUMBER_EMOJIS[i]} ${o.label}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.MEGAPHONE} ${pergunta}`)
      .setDescription(optionsText)
      .setFooter({ text: `Criado por ${interaction.user.username} • Reaja para votar! • ⚔️ Aliança Skyline` })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < poll.options.length; i++) {
      await msg.react(NUMBER_EMOJIS[i]);
    }

    await prisma.poll.update({ where: { id: poll.id }, data: { messageId: msg.id, channelId: interaction.channelId } });
  },
} satisfies Command;
