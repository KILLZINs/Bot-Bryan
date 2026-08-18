import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { Player } from 'discord-player';
import { YoutubeiExtractor } from 'discord-player-youtubei'; // 👈 NOVO IMPORT DO EXTRATOR BLINDADO
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command, PrefixCommand, ExtendedClient } from './types';
import { prisma } from './database/client';
import { startDashboard } from './dashboard/server';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
}) as ExtendedClient;

client.commands       = new Collection<string, Command>();
client.prefixCommands = new Collection<string, PrefixCommand>();
client.cooldowns      = new Collection<string, Collection<string, number>>();

const player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25
  }
});

player.events.on('error', (queue, error) => {
  console.log(`[ERRO NA FILA] ${error.message}`);
});
player.events.on('playerError', (queue, error) => {
  console.log(`[ERRO DE ÁUDIO/STREAM] ${error.message}`);
  if (queue.metadata) {
    const interaction = queue.metadata as any;
    interaction.channel?.send(`❌ **O áudio falhou:** \`${error.message}\``).catch(() => {});
  }
});

// ─── Load slash commands ──────────────────────────────────────────────────────
const commandsPath = join(__dirname, 'commands');
for (const entry of readdirSync(commandsPath, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const folderPath = join(commandsPath, entry.name);
    for (const file of readdirSync(folderPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'))) {
      const command: Command = require(join(folderPath, file)).default;
      if (command?.data && typeof command.execute === 'function') {
        client.commands.set(command.data.name, command);
      }
    }
  } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
    const command: Command = require(join(commandsPath, entry.name)).default;
    if (command?.data && typeof command.execute === 'function') {
      client.commands.set(command.data.name, command);
    }
  }
}

// ─── Load prefix commands ─────────────────────────────────────────────────────
const prefixCommandsPath = join(__dirname, 'prefix-commands');
try {
  for (const file of readdirSync(prefixCommandsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'))) {
    const cmd: PrefixCommand = require(join(prefixCommandsPath, file)).default;
    if (cmd?.name && typeof cmd.execute === 'function') {
      client.prefixCommands.set(cmd.name, cmd);
    }
  }
} catch {}

// ─── Load events ──────────────────────────────────────────────────────────────
const eventsPath = join(__dirname, 'events');
for (const file of readdirSync(eventsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'))) {
  const event = require(join(eventsPath, file)).default;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

async function shutdown() {
  console.log('Shutting down...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException',  (err) => console.error('Uncaught exception:',  err));

startDashboard();

client.login(process.env.DISCORD_TOKEN).then(async () => {
  console.log('🤖 Bot conectado ao Discord! Iniciando motores de áudio...');
  
  // 🚀 A MÁGICA ACONTECE AQUI:
  // Carrega os extratores de Spotify e Soundcloud, mas BLOQUEIA o do YouTube quebrado
  await player.extractors.loadDefault((ext) => ext !== 'YouTubeExtractor');
  
  // Instala o nosso novo Extrator Blindado (Youtubei) por cima
  await player.extractors.register(YoutubeiExtractor, {});
  
  console.log('🎵 Sistema de Música 100% Operacional (Com Anti-Block)!');
}).catch(console.error);
