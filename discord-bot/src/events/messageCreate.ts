import { Message, TextChannel, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/client';
import { addXp } from '../utils/helpers';
import { COLORS, EMOJIS } from '../utils/embeds';
import { XP_PER_MESSAGE, XP_COOLDOWN_MS, xpForNextLevel } from '../types';

const xpCooldowns = new Map<string, number>();

export default {
  name: 'messageCreate',
  once: false,
  async execute(message: Message) {
    if (message.author.bot || !message.guild) return;

    const now = Date.now();
    const lastXp = xpCooldowns.get(message.author.id) ?? 0;
    if (now - lastXp < XP_COOLDOWN_MS) return;

    xpCooldowns.set(message.author.id, now);

    const before = await prisma.member.findUnique({ where: { discordId: message.author.id } });
    const after = await addXp(message.author.id, message.author.username, XP_PER_MESSAGE);

    // Level up notification
    if (before && after.level > before.level) {
      const xpNeeded = xpForNextLevel(after.level);
      const embed = new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle(`${EMOJIS.LEVEL} Subiu de Nível!`)
        .setDescription(
          `Parabéns, ${message.author}! Você alcançou o **Nível ${after.level}**!\n\n` +
          `Próximo nível: **${xpNeeded} XP**`
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: '⚔️ Aliança Skyline' });

      if ('send' in message.channel) {
        await (message.channel as TextChannel).send({ embeds: [embed] }).catch(console.error);
      }
    }
  },
};
