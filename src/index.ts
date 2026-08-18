import 'dotenv/config';
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import { Player } from 'discord-player';
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

// Inicializa o motor de música.
const player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
  },
});

// Monitores de erro do player.
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

// Carrega os comandos slash.
const commandsPath = join(__dirname, 'commands');

for (const entry of readdirSync(commandsPath, {
  withFileTypes: true,
})) {
  if (entry.isDirectory()) {
    const folderPath = join(commandsPath, entry.name);

    for (
      const file of readdirSync(folderPath).filter(
        (fileName) =>
          fileName.endsWith('.js') ||
          fileName.endsWith('.ts'),
      )
    ) {
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

// Carrega os comandos com prefixo.
const prefixCommandsPath = join(__dirname, 'prefix-commands');

try {
  for (
    const file of readdirSync(prefixCommandsPath).filter(
      (fileName) =>
        fileName.endsWith('.js') ||
        fileName.endsWith('.ts'),
    )
  ) {
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
  // A pasta pode não existir em algumas versões do build.
}

// Carrega os eventos.
const eventsPath = join(__dirname, 'events');

for (
  const file of readdirSync(eventsPath).filter(
    (fileName) =>
      fileName.endsWith('.js') ||
      fileName.endsWith('.ts'),
  )
) {
  const event = require(join(eventsPath, file)).default;

  if (event.once) {
    client.once(event.name, (...args) =>
      event.execute(...args, client),
    );
  } else {
    client.on(event.name, (...args) =>
      event.execute(...args, client),
    );
  }
}

// Desligamento seguro.
async function shutdown() {
  console.log('Desligando o bot...');

  await prisma.$disconnect();
  client.destroy();

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

async function start() {
  /*
   * O extractor padrão do YouTube pode quebrar com mudanças
   * frequentes da plataforma.
   *
   * A busca por YouTube é feita pelo play-dl no play.ts.
   * Depois, o título é localizado no SoundCloud para tocar
   * através de um extractor mais estável.
   *
   * Spotify e SoundCloud continuam usando os extractors
   * padrão do discord-player.
   *
   * O carregamento acontece antes do login para impedir que
   * comandos sejam executados antes do motor de música estar pronto.
   */
  const loaded = await player.extractors.loadDefault(
    (extractor) => extractor !== 'YouTubeExtractor',
  );

  if (!loaded.success) {
    throw loaded.error;
  }

  startDashboard();

  await client.login(process.env.DISCORD_TOKEN);

  console.log('🤖 Bot conectado ao Discord!');
  console.log(
    '🎵 Sistema de música pronto para busca por nome e links.',
  );
}

start().catch((error) => {
  console.error(
    '[INICIALIZAÇÃO] Não foi possível iniciar o bot:',
    error,
  );

  process.exitCode = 1;
});
