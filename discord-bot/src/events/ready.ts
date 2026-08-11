import { Client, ActivityType } from 'discord.js';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    console.log(`✅ Bot online como ${client.user?.tag}`);

    const activities = [
      { name: 'Aliança Skyline ⚔️', type: ActivityType.Watching },
      { name: 'com os membros da aliança', type: ActivityType.Playing },
      { name: '/ajuda para comandos', type: ActivityType.Listening },
    ];

    let i = 0;
    client.user?.setPresence({
      activities: [activities[0]],
      status: 'online',
    });

    setInterval(() => {
      i = (i + 1) % activities.length;
      client.user?.setPresence({ activities: [activities[i]], status: 'online' });
    }, 30_000);

    console.log(`📋 ${client.guilds.cache.size} servidor(es) conectado(s)`);
    console.log(`👥 ${client.users.cache.size} usuário(s) em cache`);
  },
};
