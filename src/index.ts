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
  AttachmentBuilder,
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
  // Pasta opcional
}

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
  // Eventos carregados
}

// ═════════════════════════════════════════════════════════════════════════════
// 📸 SISTEMA DE FEED SOCIAL / INSTAGRAM (COM BUFFER REAL E IMAGENS FIXAS)
// ═════════════════════════════════════════════════════════════════════════════

function buildPostActionRow(
  postId: string,
  authorId: string,
  likesCount: number,
  commentsCount: number,
  isLiked: boolean = false,
  customEmojis: { like?: string; follow?: string; comment?: string } = {}
): ActionRowBuilder<ButtonBuilder> {
  const likeEmoji = customEmojis.like || '❤️';
  const followEmoji = customEmojis.follow || '🔔';
  const commentEmoji = customEmojis.comment || '💬';

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`insta:like:${postId}`)
      .setLabel(String(likesCount))
      .setEmoji(likeEmoji)
      .setStyle(isLiked ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`insta:comment:${postId}`)
      .setLabel('Comentar')
      .setEmoji(commentEmoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`insta:view:${postId}`)
      .setLabel(`Comentários (${commentsCount})`)
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`insta:follow:${authorId}`)
      .setLabel('Seguir')
      .setEmoji(followEmoji)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`insta:delete:${postId}`)
      .setLabel('Apagar')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );
}

const postCooldowns = new Map<string, number>();
const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
const PHISHING_REGEX = /(grabify|iplogger|leak|nitro-free|steam-gift)/i;

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.guildId) return;

  try {
    const cfg: any = await prisma.guildConfig.findUnique({
      where: { guildId: message.guildId },
    });

    if (!cfg || !cfg.feedChannelId || message.channel.id !== cfg.feedChannelId) {
      return;
    }

    const channel = message.channel as TextChannel;
    const attachment = message.attachments.first();

    if (!attachment) {
      await message.delete().catch(() => null);
      const warn = await channel.send({
        content: `⚠️ ${message.author}, o canal do **Feed/Instagram** aceita apenas publicações com fotos ou vídeos anexados!`,
      });
      setTimeout(() => warn.delete().catch(() => null), 5000);
      return;
    }

    const isImage = attachment.contentType?.startsWith('image/');
    const isVideo = attachment.contentType?.startsWith('video/');
    if (!isImage && !isVideo) {
      await message.delete().catch(() => null);
      return;
    }

    const now = Date.now();
    const userCd = postCooldowns.get(message.author.id) ?? 0;
    if (now - userCd < 60000) {
      const rest = Math.ceil((60000 - (now - userCd)) / 1000);
      await message.delete().catch(() => null);
      const warn = await channel.send({
        content: `⏳ ${message.author}, aguarde **${rest}s** para postar novamente no Feed.`,
      });
      setTimeout(() => warn.delete().catch(() => null), 5000);
      return;
    }

    const caption = message.content.trim();
    if (INVITE_REGEX.test(caption) || PHISHING_REGEX.test(caption)) {
      await message.delete().catch(() => null);
      const warn = await channel.send({
        content: `❌ ${message.author}, convites e links suspeitos não são permitidos no Feed.`,
      });
      setTimeout(() => warn.delete().catch(() => null), 5000);
      return;
    }

    postCooldowns.set(message.author.id, now);

    // 1. BAIXA A IMAGEM NA MEMÓRIA ANTES QUE O DISCORD A DELETE
    const response = await fetch(attachment.url);
    if (!response.ok) {
      console.error('[ERRO AO BAIXAR MÍDIA DO FEED]');
      return;
    }
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const extension = attachment.name?.split('.').pop() || 'png';
    const filename = `insta_media_${Date.now()}.${extension}`;
    const fileAttachment = new AttachmentBuilder(fileBuffer, { name: filename });

    // 2. APAGA A MENSAGEM DO USUÁRIO
    await message.delete().catch(() => null);

    const followersCount = await prisma.socialFollow.count({
      where: { guildId: message.guildId, targetUserId: message.author.id },
    });

    const embedColor = cfg.feedEmbedColor || 0xE1306C;
    const footerText = cfg.feedFooterText || '📸 Instagram Skyline • Clique nos botões para interagir';

    const postEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: `${message.author.displayName} (@${message.author.username})`,
        iconURL: message.author.displayAvatarURL({ forceStatic: false }),
      })
      .setDescription(caption.length > 0 ? caption : null)
      .addFields({
        name: '👥 Seguidores',
        value: `\`${followersCount}\` seguidores`,
        inline: true,
      })
      .setFooter({ text: footerText })
      .setTimestamp();

    if (isImage) {
      postEmbed.setImage(`attachment://${filename}`);
    }

    const placeholderRow = buildPostActionRow('new', message.author.id, 0, 0, false, {
      like: cfg.feedLikeEmoji,
      follow: cfg.feedFollowEmoji,
      comment: cfg.feedCommentEmoji,
    });

    // 3. ENVIA COM O ARQUIVO RE-HOSPEDADO NO DISCORD
    const sentMessage = await channel.send({
      embeds: [postEmbed],
      files: [fileAttachment],
      components: [placeholderRow],
    });

    const savedMediaUrl = sentMessage.attachments.first()?.url || attachment.url;

    const savedPost = await prisma.socialPost.create({
      data: {
        guildId: message.guildId,
        channelId: channel.id,
        messageId: sentMessage.id,
        authorId: message.author.id,
        authorName: message.author.displayName || message.author.username,
        authorAvatar: message.author.displayAvatarURL({ forceStatic: false }),
        caption: caption.length > 0 ? caption : null,
        mediaUrl: savedMediaUrl,
      },
    });

    const realRow = buildPostActionRow(savedPost.id, message.author.id, 0, 0, false, {
      like: cfg.feedLikeEmoji,
      follow: cfg.feedFollowEmoji,
      comment: cfg.feedCommentEmoji,
    });

    await sentMessage.edit({ components: [realRow] }).catch(() => null);

    // NOTIFICAÇÃO NO PV DE QUEM SEGUE O AUTOR
    const followers = await prisma.socialFollow.findMany({
      where: { guildId: message.guildId, targetUserId: message.author.id },
    });

    if (followers.length > 0) {
      const dmEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('📸 Nova foto de quem você segue!')
        .setDescription(
          `**${message.author.displayName}** acabou de postar uma foto no servidor **${message.guild.name}**!\n\n` +
          (caption.length > 0 ? `> *"${caption.slice(0, 150)}..."*\n\n` : '') +
          `[👉 Clique aqui para ver e curtir a foto](${sentMessage.url})`
        )
        .setThumbnail(message.author.displayAvatarURL({ forceStatic: false }))
        .setImage(savedMediaUrl)
        .setTimestamp();

      for (const f of followers) {
        if (f.followerUserId === message.author.id) continue;
        const followerUser = await client.users.fetch(f.followerUserId).catch(() => null);
        if (followerUser) {
          await followerUser.send({ embeds: [dmEmbed] }).catch(() => null);
        }
      }
    }
  } catch (err) {
    console.error('[ERRO FEED MESSAGE]:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guildId) return;

    const cfg: any = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId },
    });

    const customEmojis = {
      like: cfg?.feedLikeEmoji || '❤️',
      follow: cfg?.feedFollowEmoji || '🔔',
      comment: cfg?.feedCommentEmoji || '💬',
    };

    // CURTIR / DESCURTIR + NOTIFICAÇÃO AO CRIADOR
    if (interaction.isButton() && interaction.customId.startsWith('insta:like:')) {
      const postId = interaction.customId.replace('insta:like:', '');
      const post = await prisma.socialPost.findUnique({ where: { id: postId } });
      if (!post) {
        await interaction.reply({ content: '❌ Publicação não encontrada.', ephemeral: true });
        return;
      }

      const existingLike = await prisma.socialLike.findUnique({
        where: { postId_userId: { postId, userId: interaction.user.id } },
      });

      let count = post.likesCount;
      let isLiked = false;

      if (existingLike) {
        await prisma.socialLike.delete({ where: { id: existingLike.id } });
        count = Math.max(0, count - 1);
        isLiked = false;
        await prisma.socialPost.update({ where: { id: postId }, data: { likesCount: count } });
      } else {
        await prisma.socialLike.create({ data: { postId, userId: interaction.user.id } });
        count += 1;
        isLiked = true;
        await prisma.socialPost.update({ where: { id: postId }, data: { likesCount: count } });

        // NOTIFICA O AUTOR NO PV SE OUTRA PESSOA CURTIU
        if (post.authorId !== interaction.user.id) {
          const authorUser = await client.users.fetch(post.authorId).catch(() => null);
          if (authorUser) {
            const likeNotify = new EmbedBuilder()
              .setColor(cfg?.feedEmbedColor || 0xE1306C)
              .setTitle(`${customEmojis.like} Nova curtida na sua foto!`)
              .setDescription(
                `**${interaction.user.displayName}** curtiu a sua publicação!\n\n` +
                `[👉 Clique aqui para ver sua publicação](${interaction.message.url})`
              )
              .setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
              .setTimestamp();
            await authorUser.send({ embeds: [likeNotify] }).catch(() => null);
          }
        }
      }

      const updatedRow = buildPostActionRow(postId, post.authorId, count, post.commentsCount, isLiked, customEmojis);
      await interaction.update({ components: [updatedRow] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('insta:comment:')) {
      const postId = interaction.customId.replace('insta:comment:', '');
      const modal = new ModalBuilder()
        .setCustomId(`insta_modal_comment:${postId}`)
        .setTitle('💬 Comentar na Foto');

      const text = new TextInputBuilder()
        .setCustomId('comment_text')
        .setLabel('Escreva seu comentário:')
        .setMaxLength(300)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(text));
      await interaction.showModal(modal);
      return;
    }

    // COMENTÁRIO + NOTIFICAÇÃO AO CRIADOR
    if (interaction.isModalSubmit() && interaction.customId.startsWith('insta_modal_comment:')) {
      const postId = interaction.customId.replace('insta_modal_comment:', '');
      const comment = interaction.fields.getTextInputValue
