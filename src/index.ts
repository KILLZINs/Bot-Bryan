import 'dotenv/config';

import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
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
  console.log(`[MÚSICA ADICIONADA] ${track.title} | Guild: ${queue.guild.id}`);
});

player.events.on('playerStart', (queue, track) => {
  console.log(`[ÁUDIO INICIADO] ${track.title} | Guild: ${queue.guild.id}`);
});

player.events.on('playerFinish', (queue, track) => {
  console.log(`[ÁUDIO FINALIZADO] ${track.title} | Guild: ${queue.guild.id}`);
});

player.events.on('emptyQueue', (queue) => {
  console.log(`[FILA VAZIA] Guild: ${queue.guild.id}`);
});

// ─── CARREGAMENTO DE COMANDOS SLASH ─────────────────────────────────────────
const commandsPath = join(__dirname, 'commands');

for (const entry of readdirSync(commandsPath, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const folderPath = join(commandsPath, entry.name);
    for (const file of readdirSync(folderPath).filter(
      (fileName) => fileName.endsWith('.js') || fileName.endsWith('.ts'),
    )) {
      const command: Command = require(join(folderPath, file)).default;
      if (command?.data && typeof command.execute === 'function') {
        client.commands.set(command.data.name, command);
      }
    }
  } else if (
    entry.isFile() &&
    (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))
  ) {
    const command: Command = require(join(commandsPath, entry.name)).default;
    if (command?.data && typeof command.execute === 'function') {
      client.commands.set(command.data.name, command);
    }
  }
}

// ─── CARREGAMENTO DE COMANDOS DE PREFIXO ────────────────────────────────────
const prefixCommandsPath = join(__dirname, 'prefix-commands');

try {
  for (const file of readdirSync(prefixCommandsPath).filter(
    (fileName) => fileName.endsWith('.js') || fileName.endsWith('.ts'),
  )) {
    const command: PrefixCommand = require(join(prefixCommandsPath, file)).default;
    if (command?.name && typeof command.execute === 'function') {
      client.prefixCommands.set(command.name, command);
    }
  }
} catch {
  // Pasta de comandos de prefixo opcional
}

// ─── CARREGAMENTO DE EVENTOS ────────────────────────────────────────────────
const eventsPath = join(__dirname, 'events');

try {
  for (const file of readdirSync(eventsPath).filter(
    (fileName) => fileName.endsWith('.js') || fileName.endsWith('.ts'),
  )) {
    const event = require(join(eventsPath, file)).default;
    if (event && event.name) {
      if (event.once) {
        client.once(event.name, (...args: any[]) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args: any[]) => event.execute(...args, client));
      }
    }
  }
} catch {
  // Pasta de eventos carregada
}

// ═════════════════════════════════════════════════════════════════════════════
// 📸 SISTEMA DE FEED SOCIAL / INSTAGRAM (COM NOTIFICAÇÃO NO PV)
// ═════════════════════════════════════════════════════════════════════════════

const postCooldowns = new Map<string, number>();
const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
const PHISHING_REGEX = /(grabify|iplogger|leak|nitro-free|steam-gift)/i;

// 1. Mensagens no canal do Feed
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.guildId) return;

  try {
    const cfg = await prisma.guildConfig.findUnique({
      where: { guildId: message.guildId },
    });

    if (!cfg || !cfg.feedChannelId || message.channel.id !== cfg.feedChannelId) {
      return;
    }

    const attachment = message.attachments.first();
    if (!attachment) {
      await message.delete().catch(() => null);
      const warn = await message.channel.send({
        content: `⚠️ ${message.author}, o canal do **Feed/Instagram** aceita apenas publicações com fotos ou vídeos anexados!`,
      });
      setTimeout(() => warn.delete().catch(() => null), 5000);
      return;
    }

    const isMedia = attachment.contentType?.startsWith('image/') || attachment.contentType?.startsWith('video/');
    if (!isMedia) {
      await message.delete().catch(() => null);
      return;
    }

    // Cooldown de 60s
    const now = Date.now();
    const userCd = postCooldowns.get(message.author.id) ?? 0;
    if (now - userCd < 60000) {
      const rest = Math.ceil((60000 - (now - userCd)) / 1000);
      await message.delete().catch(() => null);
      const warn = await message.channel.send({
        content: `⏳ ${message.author}, aguarde **${rest}s** para postar novamente no Feed.`,
      });
      setTimeout(() => warn.delete().catch(() => null), 5000);
      return;
    }

    // Filtro anti-invite/links maliciosos
    const caption = message.content.trim();
    if (INVITE_REGEX.test(caption) || PHISHING_REGEX.test(caption)) {
      await message.delete().catch(() => null);
      const warn = await message.channel.send({
        content: `❌ ${message.author}, convites e links suspeitos não são permitidos no Feed.`,
      });
      setTimeout(() => warn.delete().catch(() => null), 5000);
      return;
    }

    postCooldowns.set(message.author.id, now);
    await message.delete().catch(() => null);

    const followersCount = await prisma.socialFollow.count({
      where: { guildId: message.guildId, targetUserId: message.author.id },
    });

    const postEmbed = new EmbedBuilder()
      .setColor(0xE1306C)
      .setAuthor({
        name: `${message.author.displayName} (@${message.author.username})`,
        iconURL: message.author.displayAvatarURL({ forceStatic: false }),
      })
      .setImage(attachment.url)
      .setDescription(caption.length > 0 ? caption : null)
      .addFields({
        name: '👥 Seguidores',
        value: `\`${followersCount}\` seguidores`,
        inline: true,
      })
      .setFooter({ text: '📸 Instagram Skyline • Clique nos botões para interagir' })
      .setTimestamp();

    const placeholderRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('insta:like:new').setLabel('0').setEmoji('💜').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('insta:comment:new').setLabel('Comentar').setEmoji('💬').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('insta:view:new').setLabel('Comentários (0)').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`insta:follow:${message.author.id}`).setLabel('Seguir').setEmoji('🔔').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('insta:delete:new').setLabel('Apagar').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );

    const sentMessage = await (message.channel as TextChannel).send({
      embeds: [postEmbed],
      components: [placeholderRow],
    });

    const savedPost = await prisma.socialPost.create({
      data: {
        guildId: message.guildId,
        channelId: message.channel.id,
        messageId: sentMessage.id,
        authorId: message.author.id,
        authorName: message.author.displayName || message.author.username,
        authorAvatar: message.author.displayAvatarURL({ forceStatic: false }),
        caption: caption.length > 0 ? caption : null,
        mediaUrl: attachment.url,
      },
    });

    const realRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`insta:like:${savedPost.id}`).setLabel('0').setEmoji('💜').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`insta:comment:${savedPost.id}`).setLabel('Comentar').setEmoji('💬').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`insta:view:${savedPost.id}`).setLabel('Comentários (0)').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`insta:follow:${message.author.id}`).setLabel('Seguir').setEmoji('🔔').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`insta:delete:${savedPost.id}`).setLabel('Apagar').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );

    await sentMessage.edit({ components: [realRow] }).catch(() => null);

    // NOTIFICAÇÃO NO PV DE QUEM SEGUE O AUTOR
    const followers = await prisma.socialFollow.findMany({
      where: { guildId: message.guildId, targetUserId: message.author.id },
    });

    if (followers.length > 0) {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xE1306C)
        .setTitle('📸 Nova foto de quem você segue!')
        .setDescription(
          `**${message.author.displayName}** acabou de postar uma foto no servidor **${message.guild.name}**!\n\n` +
          (caption.length > 0 ? `> *"${caption.slice(0, 150)}..."*\n\n` : '') +
          `[👉 Clique aqui para ver e curtir a foto](${sentMessage.url})`
        )
        .setThumbnail(message.author.displayAvatarURL({ forceStatic: false }))
