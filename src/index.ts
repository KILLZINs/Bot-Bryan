import 'dotenv/config';
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import { startReviveChatMonitor, lastMessageTime } from './systems/reviveChat';

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
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
}) as ExtendedClient;

client.commands = new Collection<string, Command>();
client.prefixCommands = new Collection<string, PrefixCommand>();
client.cooldowns = new Collection<string, Collection<string, number>>();

const player = new Player(client, {
  ffmpegPath: ffmpegPath ?? undefined,
  skipFFmpeg: false,
  connectionTimeout: 120000,
});

player.events.on('error', (queue, error) => {
  console.error('[ERRO NA FILA]', error);
  const metadata = queue.metadata as any;
  if (metadata?.channel?.send) {
    metadata.channel.send(`❌ **Erro na fila de música:** \`${error.message}\``).catch(() => {});
  }
});

player.events.on('playerError', (queue, error) => {
  console.error('[ERRO DE ÁUDIO/STREAM]', error);
  const metadata = queue.metadata as any;
  if (metadata?.channel?.send) {
    metadata.channel.send(`❌ **O áudio falhou:** \`${error.message}\``).catch(() => {});
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
    for (const file of readdirSync(folderPath).filter((f) => f.endsWith('.js') || f.endsWith('.ts'))) {
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
  for (const file of readdirSync(prefixCommandsPath).filter((f) => f.endsWith('.js') || f.endsWith('.ts'))) {
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
  for (const file of readdirSync(eventsPath).filter((f) => f.endsWith('.js') || f.endsWith('.ts'))) {
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
// 📸 SISTEMA DE FEED SOCIAL / INSTAGRAM (COM TRAVA MASTER APLICADA)
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
  if (message.author.bot || !message.guild || !message.guild.id) return;

  // Salva a hora da última mensagem para o sistema de Reviver Chat
  lastMessageTime.set(message.guild.id, Date.now());

  try {
    const cfg: any = await prisma.guildConfig.findUnique({
      where: { guildId: message.guild.id },
    });

    if (!cfg || !cfg.feedChannelId || message.channel.id !== cfg.feedChannelId) {
      return;
    }

    const channel = message.channel as TextChannel;
    
    // 🛡️ TRAVA MASTER: Verifica se o sistema foi desligado no painel
    const globalCfg = await prisma.botConfig.findUnique({ where: { id: 'global' } });
    if ((globalCfg && globalCfg.featSocial === false) || cfg.featSocial === false) {
      await message.delete().catch(() => null);
      const warn = await channel.send({ content: `❌ ${message.author}, o sistema de Feed Social está **desativado** no momento.` });
      setTimeout(() => warn.delete().catch(() => null), 5000);
      return;
    }

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

    await message.delete().catch(() => null);

    const followersCount = await prisma.socialFollow.count({
      where: { guildId: message.guild.id, targetUserId: message.author.id },
    });

    const embedColor = cfg.feedEmbedColor || 0xE1306C;
    const footerText = cfg.feedFooterText || '📸 Instagram Skyline • Clique nos botões para interagir';

    const postEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: `${message.author.displayName} (@${message.author.username})`,
        iconURL: message.author.displayAvatarURL({ forceStatic: false }) || undefined,
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

    const sentMessage = await channel.send({
      embeds: [postEmbed],
      files: [fileAttachment],
      components: [placeholderRow],
    });

    const savedMediaUrl = sentMessage.attachments.first()?.url || attachment.url;

    const savedPost = await prisma.socialPost.create({
      data: {
        guildId: message.guild.id,
        channelId: channel.id,
        messageId: sentMessage.id,
        authorId: message.author.id,
        authorName: message.author.displayName || message.author.username,
        authorAvatar: message.author.displayAvatarURL({ forceStatic: false }) || '',
        caption: caption.length > 0 ? caption : '',
        mediaUrl: savedMediaUrl,
      },
    });

    const realRow = buildPostActionRow(savedPost.id, message.author.id, 0, 0, false, {
      like: cfg.feedLikeEmoji,
      follow: cfg.feedFollowEmoji,
      comment: cfg.feedCommentEmoji,
    });

    await sentMessage.edit({ components: [realRow] }).catch(() => null);

    const followers = await prisma.socialFollow.findMany({
      where: { guildId: message.guild.id, targetUserId: message.author.id },
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

    // 🛡️ TRAVA MASTER: Verifica se é botão/modal antes de ler o customId
    if ((interaction.isMessageComponent() || interaction.isModalSubmit()) && interaction.customId.startsWith('insta')) {
      const globalCfg = await prisma.botConfig.findUnique({ where: { id: 'global' } });
      if (globalCfg?.featSocial === false) {
        await interaction.reply({ content: '❌ O sistema do Feed Social está **desativado globalmente** no momento.', ephemeral: true });
        return;
      }
      const checkCfg: any = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId } });
      if (checkCfg?.featSocial === false) {
        await interaction.reply({ content: '❌ O sistema do Feed Social está **desativado** neste servidor.', ephemeral: true });
        return;
      }
    }

    const cfg: any = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guildId },
    });

    const customEmojis = {
      like: cfg?.feedLikeEmoji || '❤️',
      follow: cfg?.feedFollowEmoji || '🔔',
      comment: cfg?.feedCommentEmoji || '💬',
    };

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

        if (post.authorId !== interaction.user.id) {
          const authorUser = await client.users.fetch(post.authorId).catch(() => null);
          if (authorUser && interaction.message) {
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

    if (interaction.isModalSubmit() && interaction.customId.startsWith('insta_modal_comment:')) {
      const postId = interaction.customId.replace('insta_modal_comment:', '');
      const comment = interaction.fields.getTextInputValue('comment_text').trim();
      const post = await prisma.socialPost.findUnique({ where: { id: postId } });
      if (!post) {
        await interaction.reply({ content: '❌ Publicação não encontrada.', ephemeral: true });
        return;
      }

      await prisma.socialComment.create({
        data: {
          postId,
          userId: interaction.user.id,
          userName: interaction.user.displayName || interaction.user.username,
          content: comment,
        },
      });

      const newCommentsCount = post.commentsCount + 1;
      await prisma.socialPost.update({ where: { id: postId }, data: { commentsCount: newCommentsCount } });

      if (interaction.message) {
        const hasLiked = await prisma.socialLike.findUnique({
          where: { postId_userId: { postId, userId: interaction.user.id } }
        });
        const updatedRow = buildPostActionRow(postId, post.authorId, post.likesCount, newCommentsCount, !!hasLiked, customEmojis);
        await interaction.message.edit({ components: [updatedRow] }).catch(() => null);
      }

      await interaction.reply({ content: `✅ Comentário enviado com sucesso: *"${comment}"*`, ephemeral: true });

      if (post.authorId !== interaction.user.id) {
        const author = await client.users.fetch(post.authorId).catch(() => null);
        if (author) {
          const commEmbed = new EmbedBuilder()
            .setColor(cfg?.feedEmbedColor || 0xE1306C)
            .setTitle(`${customEmojis.comment} Novo comentário na sua foto!`)
            .setDescription(
              `**${interaction.user.displayName}** comentou na sua foto:\n> *"${comment}"*\n\n` +
              `[👉 Clique aqui para responder na publicação](${interaction.message?.url || ''})`
            )
            .setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
            .setTimestamp();
          await author.send({ embeds: [commEmbed] }).catch(() => null);
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('insta:view:')) {
      const postId = interaction.customId.replace('insta:view:', '');
      const comments = await prisma.socialComment.findMany({
        where: { postId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (comments.length === 0) {
        await interaction.reply({ content: '💭 Esta foto ainda não tem comentários.', ephemeral: true });
        return;
      }

      const list = comments
        .map((c, idx) => `**${idx + 1}. ${c.userName}** (<t:${Math.floor(c.createdAt.getTime() / 1000)}:R>):\n> ${c.content}`)
        .join('\n\n');

      const commEmbed = new EmbedBuilder()
        .setColor(cfg?.feedEmbedColor || 0xE1306C)
        .setTitle('💬 Comentários da Publicação')
        .setDescription(list)
        .setFooter({ text: 'Exibindo comentários mais recentes' })
        .setTimestamp();

      await interaction.reply({ embeds: [commEmbed], ephemeral: true });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('insta:follow:')) {
      const targetUserId = interaction.customId.replace('insta:follow:', '');
      const followerUserId = interaction.user.id;
      const guildId = interaction.guildId!;

      if (targetUserId === followerUserId) {
        await interaction.reply({ content: '❌ Você não pode seguir a si mesmo!', ephemeral: true });
        return;
      }

      const existingFollow = await prisma.socialFollow.findUnique({
        where: { guildId_targetUserId_followerUserId: { guildId, targetUserId, followerUserId } },
      });

      const targetUser = await client.users.fetch(targetUserId).catch(() => null);
      const targetName = targetUser?.displayName || 'este criador';

      if (existingFollow) {
        await prisma.socialFollow.delete({ where: { id: existingFollow.id } });
        await interaction.reply({ content: `🔕 Você deixou de seguir **${targetName}**.`, ephemeral: true });
      } else {
        await prisma.socialFollow.create({ data: { guildId, targetUserId, followerUserId } });
        await interaction.reply({ content: `🔔 Você agora está seguindo **${targetName}**! Será avisado no PV sempre que houver novas fotos.`, ephemeral: true });

        if (targetUser) {
          const followNotify = new EmbedBuilder()
            .setColor(cfg?.feedEmbedColor || 0xE1306C)
            .setTitle(`${customEmojis.follow} Você ganhou um novo seguidor!`)
            .setDescription(
              `**${interaction.user.displayName}** começou a seguir você no servidor **${interaction.guild?.name}**!\n` +
              `Ele(a) será avisado(a) no PV sempre que você postar uma foto nova no Feed.`
            )
            .setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
            .setTimestamp();
          await targetUser.send({ embeds: [followNotify] }).catch(() => null);
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('insta:delete:')) {
      const postId = interaction.customId.replace('insta:delete:', '');
      const member = interaction.member as GuildMember;
      const post = await prisma.socialPost.findUnique({ where: { id: postId } });

      if (!post) {
        await interaction.reply({ content: '❌ Publicação não encontrada.', ephemeral: true });
        return;
      }

      const isAuthor = post.authorId === interaction.user.id;
      const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) || member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isAuthor && !isStaff) {
        await interaction.reply({ content: '❌ Segurança: Apenas o autor ou Moderadores podem apagar esta foto.', ephemeral: true });
        return;
      }

      await prisma.socialPost.delete({ where: { id: postId } });
      if (interaction.message) {
        await interaction.message.delete().catch(() => null);
      }
      await interaction.reply({ content: '🗑️ Foto apagada com sucesso!', ephemeral: true });
      return;
    }
  } catch (err) {
    console.error('[ERRO INTERACTION FEED]:', err);
  }
});

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

// 🔄 MOTOR DE STATUS E PERFIL DO BOT
// 🔄 MOTOR DE STATUS ROTATIVO (Liberado pela API)
async function updateBotPresence(client: Client) {
  try {
    const globalCfg = await prisma.botConfig.findUnique({ where: { id: 'global' }});
    if (!globalCfg || !globalCfg.botStatusRotation || !client.user) return;

    // Separa os status criados no painel e sorteia um
    const statuses = globalCfg.botStatusRotation.split('\n').map(s => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      client.user.setActivity({
        name: randomStatus,
        type: 0 // 0 = Jogando, 2 = Ouvindo, 3 = Assistindo
      });
    }
  } catch (error) {
    console.error('[STATUS] Erro ao rotacionar:', error);
  }
}

// Roda a cada 5 minutos
setInterval(() => updateBotPresence(client), 5 * 60 * 1000);

async function start() {
  try {
    await player.extractors.loadMulti(DefaultExtractors);
    console.log('🎧 Extratores de áudio carregados com sucesso!');
    console.log(`🎛️ FFmpeg configurado em: ${ffmpegPath ?? 'não encontrado'}`);
  } catch (error) {
    console.error('❌ Falha ao carregar os extratores de áudio:', error);
  }

  startDashboard();

  await client.login(process.env.DISCORD_TOKEN);
  console.log('🤖 Bot conectado ao Discord!');
  console.log('🎵 Sistema de música pronto para operar!');
  
  // LIGA O MONITOR DE CHAT AQUI 👇
  startReviveChatMonitor(client);
  console.log('🧟 Monitor de Reviver Chat ativado!');

  // LIGA O MOTOR DE STATUS E PERFIL AQUI 👇
  setInterval(() => updateBotPresence(client), 5 * 60 * 1000);
  console.log('🤖 Motor de Perfil e Status ativado!');
}

start().catch((error) => {
  console.error('[INICIALIZAÇÃO] Não foi possível iniciar o bot:', error);
  process.exitCode = 1;
});
