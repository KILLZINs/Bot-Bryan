import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

declare global {
  var prismaInstance: PrismaClient | undefined;
}
const prisma = globalThis.prismaInstance ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prismaInstance = prisma;

export async function handleSocialInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction
): Promise<void> {
  try {
    // ========================================================
    // 1. CURTIR / DESCURTIR POSTAGEM (Like)
    // ========================================================
    if (interaction.isButton() && interaction.customId.startsWith('insta:like:')) {
      const postId = interaction.customId.replace('insta:like:', '');
      const userId = interaction.user.id;

      const post = await prisma.socialPost.findUnique({ where: { id: postId } });
      if (!post) {
        return interaction.reply({ content: '❌ Esta publicação não existe mais.', ephemeral: true });
      }

      const existingLike = await prisma.socialLike.findUnique({
        where: { postId_userId: { postId, userId } },
      });

      let newLikesCount = post.likesCount;

      if (existingLike) {
        // Remove like
        await prisma.socialLike.delete({ where: { id: existingLike.id } });
        newLikesCount = Math.max(0, newLikesCount - 1);
        await prisma.socialPost.update({ where: { id: postId }, data: { likesCount: newLikesCount } });
      } else {
        // Adiciona like
        await prisma.socialLike.create({ data: { postId, userId } });
        newLikesCount += 1;
        await prisma.socialPost.update({ where: { id: postId }, data: { likesCount: newLikesCount } });
      }

      // Atualiza os botões da mensagem
      const oldRow = interaction.message.components[0];
      const updatedButtons = oldRow.components.map((comp) => {
        const btn = ButtonBuilder.from(comp as any);
        if (comp.customId?.startsWith('insta:like:')) {
          btn.setLabel(String(newLikesCount));
          btn.setStyle(existingLike ? ButtonStyle.Secondary : ButtonStyle.Primary);
        }
        return btn;
      });

      const newActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(updatedButtons);
      await interaction.update({ components: [newActionRow] });
      return;
    }

    // ========================================================
    // 2. ABRIR MODAL DE COMENTÁRIO
    // ========================================================
    if (interaction.isButton() && interaction.customId.startsWith('insta:comment:')) {
      const postId = interaction.customId.replace('insta:comment:', '');

      const modal = new ModalBuilder()
        .setCustomId(`insta_modal_comment:${postId}`)
        .setTitle('💬 Adicionar Comentário');

      const commentInput = new TextInputBuilder()
        .setCustomId('comment_text')
        .setLabel('O que você achou dessa foto?')
        .setPlaceholder('Escreva seu comentário aqui...')
        .setMaxLength(300)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput));
      await interaction.showModal(modal);
      return;
    }

    // ========================================================
    // 3. PROCESSAR ENVIO DO COMENTÁRIO (Modal Submit)
    // ========================================================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('insta_modal_comment:')) {
      const postId = interaction.customId.replace('insta_modal_comment:', '');
      const commentText = interaction.fields.getTextInputValue('comment_text').trim();

      const post = await prisma.socialPost.findUnique({ where: { id: postId } });
      if (!post) {
        return interaction.reply({ content: '❌ Publicação não encontrada.', ephemeral: true });
      }

      // Salva comentário no banco
      await prisma.socialComment.create({
        data: {
          postId,
          userId: interaction.user.id,
          userName: interaction.user.displayName || interaction.user.username,
          content: commentText,
        },
      });

      const newCommentsCount = post.commentsCount + 1;
      await prisma.socialPost.update({
        where: { id: postId },
        data: { commentsCount: newCommentsCount },
      });

      // Atualiza o botão da mensagem original
      if (interaction.message) {
        const oldRow = interaction.message.components[0];
        const updatedButtons = oldRow.components.map((comp) => {
          const btn = ButtonBuilder.from(comp as any);
          if (comp.customId?.startsWith('insta:view:')) {
            btn.setLabel(`Comentários (${newCommentsCount})`);
          }
          return btn;
        });

        const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(updatedButtons);
        await interaction.message.edit({ components: [newRow] }).catch(() => null);
      }

      await interaction.reply({
        content: `✅ Comentário publicado com sucesso: *"${commentText}"*`,
        ephemeral: true,
      });

      // Notifica o autor do post no PV se outra pessoa comentou
      if (post.authorId !== interaction.user.id) {
        const authorUser = await interaction.client.users.fetch(post.authorId).catch(() => null);
        if (authorUser) {
          const notifyAuthor = new EmbedBuilder()
            .setColor(0xE1306C)
            .setTitle('💬 Novo comentário na sua foto!')
            .setDescription(`**${interaction.user.displayName}** comentou no seu post:\n> *"${commentText}"*`)
            .setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
            .setTimestamp();

          await authorUser.send({ embeds: [notifyAuthor] }).catch(() => null);
        }
      }
      return;
    }

    // ========================================================
    // 4. VISUALIZAR COMENTÁRIOS DO POST
    // ========================================================
    if (interaction.isButton() && interaction.customId.startsWith('insta:view:')) {
      const postId = interaction.customId.replace('insta:view:', '');

      const comments = await prisma.socialComment.findMany({
        where: { postId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (comments.length === 0) {
        return interaction.reply({
          content: '💭 Esta publicação ainda não tem comentários. Seja o primeiro a comentar!',
          ephemeral: true,
        });
      }

      const commentsList = comments
        .map((c, i) => `**${i + 1}. ${c.userName}** (<t:${Math.floor(c.createdAt.getTime() / 1000)}:R>):\n> ${c.content}`)
        .join('\n\n');

      const viewEmbed = new EmbedBuilder()
        .setColor(0xE1306C)
        .setTitle('💬 Comentários da Publicação')
        .setDescription(commentsList)
        .setFooter({ text: 'Exibindo os comentários mais recentes' })
        .setTimestamp();

      return interaction.reply({ embeds: [viewEmbed], ephemeral: true });
    }

    // ========================================================
    // 5. SEGUIR / DEIXAR DE SEGUIR CRIADOR
    // ========================================================
    if (interaction.isButton() && interaction.customId.startsWith('insta:follow:')) {
      const targetUserId = interaction.customId.replace('insta:follow:', '');
      const followerUserId = interaction.user.id;
      const guildId = interaction.guildId!;

      if (targetUserId === followerUserId) {
        return interaction.reply({
          content: '❌ Você não pode seguir a si mesmo!',
          ephemeral: true,
        });
      }

      const existingFollow = await prisma.socialFollow.findUnique({
        where: {
          guildId_targetUserId_followerUserId: {
            guildId,
            targetUserId,
            followerUserId,
          },
        },
      });

      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
      const targetName = targetUser?.displayName || 'este criador';

      if (existingFollow) {
        await prisma.socialFollow.delete({ where: { id: existingFollow.id } });
        return interaction.reply({
          content: `🔕 Você deixou de seguir **${targetName}**. Não receberá mais notificações no PV.`,
          ephemeral: true,
        });
      } else {
        await prisma.socialFollow.create({
          data: { guildId, targetUserId, followerUserId },
        });
        return interaction.reply({
          content: `🔔 Agora você está seguindo **${targetName}**! Você será avisado no PV sempre que houver novas fotos.`,
          ephemeral: true,
        });
      }
    }

    // ========================================================
    // 6. APAGAR POSTAGEM (Segurança: Apenas Autor ou Mods)
    // ========================================================
    if (interaction.isButton() && interaction.customId.startsWith('insta:delete:')) {
      const postId = interaction.customId.replace('insta:delete:', '');
      const member = interaction.member as GuildMember;

      const post = await prisma.socialPost.findUnique({ where: { id: postId } });
      if (!post) {
        return interaction.reply({ content: '❌ Esta publicação já foi apagada.', ephemeral: true });
      }

      const isAuthor = post.authorId === interaction.user.id;
      const isStaff =
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isAuthor && !isStaff) {
        return interaction.reply({
          content: '❌ Segurança: Apenas o autor da publicação ou Moderadores podem apagar este post.',
          ephemeral: true,
        });
      }

      // Remove do banco de dados e deleta a mensagem
      await prisma.socialPost.delete({ where: { id: postId } });
      await interaction.message.delete().catch(() => null);

      return interaction.reply({
        content: '🗑️ A publicação foi apagada com sucesso!',
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error('[ERRO HANDLER SOCIAL]:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Ocorreu um erro ao processar a ação.', ephemeral: true });
    }
  }
}
