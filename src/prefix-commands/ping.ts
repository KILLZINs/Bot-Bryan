import { Message, EmbedBuilder } from 'discord.js';
    import { COLORS } from '../utils/embeds';

    export default {
    name: 'ping',
    description: 'Mostra a latência do bot',
    async execute(message: Message, _args: string[]) {
      const sent = await message.reply({ content: '🏓 Calculando...' });
      const latency   = sent.createdTimestamp - message.createdTimestamp;
      const wsLatency = message.client.ws.ping;
      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS ?? 0x00b894)
        .setTitle('🏓 Pong!')
        .addFields(
          { name: '📡 Latência',  value: `${latency}ms`,   inline: true },
          { name: '💓 WebSocket', value: `${wsLatency}ms`, inline: true },
        )
        .setFooter({ text: '⚔️ Aliança Skyline' });
      await sent.edit({ content: '', embeds: [embed] });
    },
    };
    