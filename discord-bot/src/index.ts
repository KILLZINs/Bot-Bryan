import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command, ExtendedClient } from './types';
import { prisma } from './database/client';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
}) as ExtendedClient;

client.commands = new Collection<string, Command>();
client.cooldowns = new Collection<string, Collection<string, number>>();

// Load commands
const commandsPath = join(__dirname, 'commands');
const commandFolders = readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = join(commandsPath, folder);
  const commandFiles = readdirSync(folderPath).filter((f) => f.endsWith('.js') || f.endsWith('.ts'));
  for (const file of commandFiles) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command: Command = require(join(folderPath, file)).default;
    if (command && typeof command.execute === 'function') {
      client.commands.set(command.data.name, command);
    }
  }
}

// Load events
const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter((f) => f.endsWith('.js') || f.endsWith('.ts'));

for (const file of eventFiles) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const event = require(join(eventsPath, file)).default;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
