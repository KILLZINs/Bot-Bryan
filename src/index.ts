import 'dotenv/config';

// 🛠️ FIX 1: OBRIGATÓRIO PARA O ÁUDIO FUNCIONAR NO RAILWAY
const ffmpegPath = require('ffmpeg-static');
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

// 🌐 FIX 2: BLINDAGEM DE REDE
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor'; // 👈 IMPORT NOVO AQUI
import { readdirSync } from 'fs';
import { join } from 'path';
import {
  Command,
  PrefixCommand,
  ExtendedClient,
} from './types';
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
    GatewayIntentBits.GuildVoiceStates, // Essencial para áudio
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
}) as ExtendedClient;

client.commands = new Collection<string, Command>();
client.prefixCommands = new Collection<string, PrefixCommand>();
client.cooldowns = new Collection<
  string,
  Collection<string, number>
>();

// Inicializa o Player v7
const player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
  },
});

player.events.on('error', (queue, error) => {
  console.log(`[ERRO NA FILA] ${error.message}`);
});

player.events.on('playerError', (queue, error) => {
  console.log(`[ERRO DE ÁUDIO/STREAM] ${error.message}`);
  if (queue.metadata) {
    const interaction = queue.metadata as any;
    interaction.channel
      ?.send(`❌ **O áudio falhou:** \`${error.message}\``)
      .catch(() => {});
  }
});

player.events.on('debug', (queue, message) => {
  console.log(`[RAIO-X PLAYER] ${message}`);
});

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

const prefixCommandsPath = join(__dirname, 'prefix-commands');
try {
  for (const file of readdirSync(prefixCommandsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'))) {
    const command: PrefixCommand = require(join(prefixCommandsPath, file)).default;
    if (command?.name && typeof command.execute === 'function') {
      client.prefixCommands.set(command.name, command);
    }
  }
} catch {}

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
  console.log('Desligando o bot...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error));
process.on('uncaughtException', (error) => console.error('Uncaught exception:', error));

async function start() {
  // 🚀 ATUALIZAÇÃO v7: Nova API de Extração de Áudio
  try {
    await player.extractors.loadMulti(DefaultExtractors);
    console.log('🎧 Extratores de Áudio v7 (DAVE Support) carregados!');
  } catch (error) {
    console.error('❌ Falha ao carregar os extratores de áudio:', error);
  }

  startDashboard();
  await client.login(process.env.DISCORD_TOKEN);
  console.log('🤖 Bot conectado ao Discord!');
  console.log('🎵 Sistema de música pronto para operar com a criptografia E2EE.');
}

start().catch((error) => {
  console.error('[INICIALIZAÇÃO] Não foi possível iniciar o bot:', error);
  process.exitCode = 1;
});
