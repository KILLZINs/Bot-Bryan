import {
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

declare global {
  var prismaInstance: PrismaClient | undefined;
}
const prisma = globalThis.prismaInstance ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prismaInstance = prisma;

// Cache anti-spam de postagens (cooldown de 60 segundos por usuário)
const postCooldowns = new Map<string, number>();

// Regex de segurança anti-invite e anti-links maliciosos
const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
const PHISHING_REGEX = /(grabify|iplogger|leak|nitro-free|steam-gift)/i;

export async function handleSocialFeedMessage(message: Message): Promise<void> {
  // Ignora mensagens de bots ou fora de servidor
  if (message.author.bot || !message.guild || !message.guildId) return;

  try {
    // 1. Busca se o canal atual é o Feed configurado
    const cfg = await prisma.guildConfig.findUnique({
      where: { guildId: message.guildId },
    });

    if (!cfg || !cfg.feedChannelId || message.channel.id !== cfg.feedChannelId) {
      return;
    }

    // 2. Validação: Apenas mensagens COM imagem/vídeo anexado são aceitas
    const attachment = message.attachments.first();
    if (!attachment) {
      // Deleta mensagens de texto soltas no canal do feed para manter limpo
      await message.delete().catch(() => null);
      const warn = await message.channel.send({
        content: `⚠️ ${message.author}, o canal de **Feed/Instagram** aceita apenas publicações com **fotos ou vídeos** anexados!`,
      });
      setTimeout(() => warn.delete().catch(() => null), 6000);
      return;
    }

    // Verifica se é imagem ou vídeo
    const isMedia = attachment.contentType?.startsWith('image/') || attachment.contentType?.startsWith('video/');
    if (!isMedia) {
      await message.delete().catch(() => null);
      return;
    }

    // 3. SEGURANÇA: Anti-Spam / Cooldown
    const now = Date.now();
    const userCooldown = postCooldowns.get(message.author.id) ?? 0;
    if (now - userCooldown < 60000) {
      const restSeconds = Math.ceil((60000 - (now - userCooldown)) / 1000);
      await message.delete().catch(() => null);
      const warn = await message.channel.send({
        content: `⏳ ${message.author}, aguarde **${restSeconds}s** para publicar novamente no Feed.`,
      });
      setTimeout(() => warn.delete().catch(() => null), 5000);
      return;
    }

    // 4. SEGURANÇA: Filtro de Links/Invites na legenda
    const caption = message.content.trim();
    if (INVITE_REGEX.test(caption) || PHISHING_REGEX.test(caption)) {
      await message.delete().catch(() => null);
      const warn = await message.channel.send({
        content: `❌ ${message.author}, links suspeitos ou convites de outros servidores não são permitidos nas publicações.`,
      });
      setTimeout(() => warn.delete().catch(() => null), 6000);
      return;
    }

    postCooldowns.set(message.author.id, now);

    // 5. Apaga a mensagem original para renderizar o Card Elegante
    await message.delete().catch(() => null);

    // Conta seguidores atuais do autor no servidor
    const followersCount = await prisma.socialFollow.count({
      where: {
        guildId: message.guildId,
        targetUserId: message.author.id,
      },
    });

    // 6. Cria o Embed Estilo Instagram Dark
    const postEmbed = new EmbedBuilder()
      .setColor(0xE1306C) // Cor degradê Instagram
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

    // 7. Botões de Ação
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`insta:like:new`) // ID provisório atualizado após salvar no banco
        .setLabel('0')
        .setEmoji('💜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`insta:comment:new`)
        .setLabel('Comentar')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`insta:view:new`)
        .setLabel('Comentários (0)')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`insta:follow:${message.author.id}`)
        .setLabel('Seguir')
        .setEmoji('🔔')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`insta:delete:new`)
        .setLabel('Apagar')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    );

    const sentMessage = await (message.channel as TextChannel).send({
      embeds: [postEmbed],
      components: [row],
    });

    // 8. Salva o Post no Banco de Dados
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

    // Atualiza os customIds dos botões com o ID real do banco
    const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`insta:like:${savedPost.id}`)
        .setLabel('0')
        .setEmoji('💜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`insta:comment:${savedPost.id}`)
        .setLabel('Comentar')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`insta:view:${savedPost.id}`)
        .setLabel('Comentários (0)')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`insta:follow:${message.author.id}`)
        .setLabel('Seguir')
        .setEmoji('🔔')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`insta:delete:${savedPost.id}`)
        .setLabel('Apagar')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    );

    await sentMessage.edit({ components: [updatedRow] }).catch(() => null);

    // 9. SISTEMA DE NOTIFICAÇÃO NO PV PARA SEGUIDORES
    const followers = await prisma.socialFollow.findMany({
      where: {
        guildId: message.guildId,
        targetUserId: message.author.id,
      },
    });

    if (followers.length > 0) {
      const notifyEmbed = new EmbedBuilder()
        .setColor(0xE1306C)
        .setTitle('📸 Nova publicação de quem você segue!')
        .setDescription(
          `**${message.author.displayName}** acabou de postar uma nova foto no servidor **${message.guild.name}**!\n\n` +
          (caption.length > 0 ? `> *"${caption.slice(0, 150)}..."*\n\n` : '') +
          `[👉 Clique aqui para ver e curtir a publicação](${sentMessage.url})`
        )
        .setThumbnail(message.author.displayAvatarURL({ forceStatic: false }))
        .setImage(attachment.url)
        .setTimestamp();

      for (const f of followers) {
        // Não notifica o próprio autor se ele seguiu a si mesmo
        if (f.followerUserId === message.author.id) continue;

        const userToNotify = await message.client.users.fetch(f.followerUserId).catch(() => null);
        if (userToNotify) {
          await userToNotify.send({ embeds: [notifyEmbed] }).catch(() => null);
        }
      }
    }
  } catch (error) {
    console.error('[ERRO SOCIAL FEED]:', error);
  }
}
