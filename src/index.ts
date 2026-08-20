import 'dotenv/config';

import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from 'discord.js';

import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import ffmpegPath from 'ffmpeg-static';

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
    GatewayIntentBits.GuildVoiceStates,
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

/*
 * O ffmpeg-static já está instalado no package.json,
 * mas ele precisa ser informado explicitamente ao Discord Player.
 *
 * Também deixamos skipFFmpeg como false para garantir que o áudio
 * seja convertido para o formato aceito pelo Discord.
 */
const player = new Player(client, {
  ffmpegPath: ffmpegPath ?? undefined,
  skipFFmpeg: false,
  connectionTimeout: 120000,
});

player.events.on('error', (queue, error) => {
  console.error('[ERRO NA FILA]', error);

  const metadata = queue.metadata as any;

  if (metadata?.channel?.send) {
    metadata.channel
      .send(`❌ **Erro na fila de música:** \`${error.message}\``)
      .catch(() => {});
  }
});

player.events.on('playerError', (queue, error) => {
  console.error('[ERRO DE ÁUDIO/STREAM]', error);

  const metadata = queue.metadata as any;

  if (metadata?.channel?.send) {
    metadata.channel
      .send(`❌ **O áudio falhou:** \`${error.message}\``)
      .catch(() => {});
  }
});

player.events.on('debug', (queue, message) => {
  console.log(`[RAIO-X PLAYER] ${message}`);
});

player.events.on('audioTrackAdd', (queue, track) => {
  console.log(
    `[MÚSICA ADICIONADA] ${track.title} | Guild: ${queue.guild.id}`,
  );
});

player.events.on('playerStart', (queue, track) => {
  console.log(
    `[ÁUDIO INICIADO] ${track.title} | Guild: ${queue.guild.id}`,
  );
});

player.events.on('playerFinish', (queue, track) => {
  console.log(
    `[ÁUDIO FINALIZADO] ${track.title} | Guild: ${queue.guild.id}`,
  );
});

player.events.on('emptyQueue', (queue) => {
  console.log(`[FILA VAZIA] Guild: ${queue.guild.id}`);
});

const commandsPath = join(__dirname, 'commands');

for (const entry of readdirSync(commandsPath, {
  withFileTypes: true,
})) {
  if (entry.isDirectory()) {
    const folderPath = join(commandsPath, entry.name);

    for (const file of readdirSync(folderPath).filter(
      (fileName) =>
        fileName.endsWith('.js') ||
        fileName.endsWith('.ts'),
    )) {
      const command: Command = require(
        join(folderPath, file),
      ).default;

      if (
        command?.data &&
        typeof command.execute === 'function'
      ) {
        client.commands.set(command.data.name, command);
      }
    }
  } else if (
    entry.isFile() &&
    (entry.name.endsWith('.js') ||
      entry.name.endsWith('.ts'))
  ) {
    const command: Command = require(
      join(commandsPath, entry.name),
    ).default;

    if (
      command?.data &&
      typeof command.execute === 'function'
    ) {
      client.commands.set(command.data.name, command);
    }
  }
}

const prefixCommandsPath = join(
  __dirname,
  'prefix-commands',
);

try {
  for (const file of readdirSync(prefixCommandsPath).filter(
    (fileName) =>
      fileName.endsWith('.js') ||
      fileName.endsWith('.ts'),
  )) {
    const command: PrefixCommand = require(
      join(prefixCommandsPath, file),
    ).default;

    if (
      command?.name &&
      typeof command.execute === 'function'
    ) {
      client.prefixCommands.set(command.name, command);
    }
  }
} catch {
  // A pasta de comandos de prefixo pode não existir no build.
}

const eventsPath = join(__dirname, 'events');

for (const file of readdirSync(eventsPath).filter(
  (fileName) =>
    fileName.endsWith('.js') ||
    fileName.endsWith('.ts'),
)) {
  const event = require(join(eventsPath, file)).default;

  if (event.once) {
    client.once(event.name, (...args: any[]) =>
      event.execute(...args, client),
    );
  } else {
    client.on(event.name, (...args: any[]) =>
      event.execute(...args, client),
    );
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

process.on('unhandledRejection', (error) => {
  console.error('[PROMISE NÃO TRATADA]', error);
});

process.on('uncaughtException', (error) => {
  console.error('[EXCEÇÃO NÃO TRATADA]', error);
});

async function start() {
  try {
    await player.extractors.loadMulti(DefaultExtractors);

    console.log(
      '🎧 Extratores de áudio carregados com sucesso!',
    );

    console.log(
      `🎛️ FFmpeg configurado em: ${
        ffmpegPath ?? 'não encontrado'
      }`,
    );
  } catch (error) {
    console.error(
      '❌ Falha ao carregar os extratores de áudio:',
      error,
    );
  }

  startDashboard();

  await client.login(process.env.DISCORD_TOKEN);

  console.log('🤖 Bot conectado ao Discord!');
  console.log('🎵 Sistema de música pronto para operar!');
}

start().catch((error) => {
  console.error(
    '[INICIALIZAÇÃO] Não foi possível iniciar o bot:',
    error,
  );

  process.exitCode = 1;
});
