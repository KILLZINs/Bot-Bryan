import {
  Message,
  TextChannel,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  Webhook,
} from 'discord.js';

import { addXp, getConfig } from '../utils/helpers';
import { applyChatEnergyRegen } from '../rpg/services/character';
import { COLORS, EMOJIS, levelBar, colorFromLevel } from '../utils/embeds';
import { xpForNextLevel, ExtendedClient } from '../types';
import { getBotConfig } from '../utils/botConfig';
import { prisma } from '../database/client';

import { askBryan } from '../ai/bryan';
import { askSuki, isSukiAllowed } from '../ai/suki';

// ============================================================
// CONFIGURAÇÃO DA SUKI
// ============================================================

const SUKI_ALLOWED_GUILDS = new Set(
  (
    process.env.SUKI_ALLOWED_GUILDS ??
    '1474800828366852176,1527458696056148050'
  )
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
);

// ============================================================
// APARÊNCIA DA SUKI
// ============================================================

const SUKI_WEBHOOK_NAME =
  process.env.SUKI_WEBHOOK_NAME ?? 'Suki';

const SUKI_WEBHOOK_AVATAR =
  process.env.SUKI_WEBHOOK_AVATAR_URL ?? 'https://cdn.discordapp.com/attachments/1525330506521247824/1532014533298622674/203_Sem_Titulo8_20260729014742.png?ex=6a7b2138&is=6a79cfb8&hm=3f8d4043da4bba165549ef6137635466e34467feb462aadf93d7f46966d307f0&';

const SUKI_BANNER_URL =
  process.env.SUKI_BANNER_URL ?? '';

const SUKI_WEBHOOK_IDENTIFIER =
  'Skyline Suki';

// ============================================================
// COOLDOWNS & REGEX
// ============================================================

const cooldowns = new Map<string, number>();

const spamTrack = new Map<
  string,
  {
    count: number;
    reset: number;
  }
>();

const linkRegex = /https?:\/\/|discord\.gg\//i;

const PREFIX = 'b ';

const BRYAN_REGEX =
  /^bryan[,!.?:\s]/i;

const SUKI_REGEX =
  /\bsuki\b/i;

const bryanCooldowns =
  new Map<string, number>();

const sukiCooldowns =
  new Map<string, number>();

// ============================================================
// PEDIDOS PARA CRIAR A SUKI
// ============================================================

const CREATE_SUKI_WEBHOOK_REGEX =
  /\b(?:cria|criar|configure|configurar|ativa|ativar)\b[\s\S]*\b(?:suki|webhook)\b/i;

// ============================================================
// UTILIDADES & MEMÓRIA (OTIMIZADO PARA ECONOMIA DE TOKENS)
// ============================================================

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function thisWeek() {
  const now = new Date();

  const jan1 =
    new Date(now.getFullYear(), 0, 1);

  const week = Math.ceil(
    (
      (now.getTime() - jan1.getTime()) /
        86400000 +
      jan1.getDay() +
      1
    ) / 7
  );

  return `${now.getFullYear()}-W${week
    .toString()
    .padStart(2, '0')}`;
}

async function fetchChannelMemory(
  message: Message,
  limit = 5 // Reduzido para economizar tokens e acelerar a resposta da API
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  try {
    const fetched = await message.channel.messages.fetch({ limit: 6 });
    const memory: { role: 'user' | 'assistant'; content: string }[] = [];

    const sorted = Array.from(fetched.values())
      .filter((m) => m.id !== message.id && m.content.trim().length > 0)
      .reverse()
      .slice(-limit);

    for (const msg of sorted) {
      const isAI = msg.author.bot || msg.webhookId !== null;
      if (isAI) {
        memory.push({
          role: 'assistant',
          content: msg.cleanContent || msg.content,
        });
      } else {
        const userName = msg.member?.displayName ?? msg.author.username;
        memory.push({
          role: 'user',
          content: `[Mensagem de ${userName}]: ${msg.cleanContent || msg.content}`,
        });
      }
    }

    return memory;
  } catch {
    return [];
  }
}

// ============================================================
// WEBHOOK DA SUKI
// ============================================================

async function getOrCreateSukiWebhook(
  channel: TextChannel
): Promise<Webhook | null> {

  try {
    const webhooks = await channel.fetchWebhooks();

    let webhook =
      webhooks.find(
        hook =>
          hook.name === SUKI_WEBHOOK_IDENTIFIER
      ) ?? null;

    if (!webhook) {
      webhook =
        webhooks.find(
          hook =>
            hook.name === SUKI_WEBHOOK_NAME
        ) ?? null;
    }

    if (webhook) {
      try {
        await webhook.edit({
          name: SUKI_WEBHOOK_NAME,
          ...(SUKI_WEBHOOK_AVATAR
            ? {
                avatar: SUKI_WEBHOOK_AVATAR,
              }
            : {}),
        });
      } catch (err) {
        console.error(
          '[Suki Webhook] Erro ao atualizar webhook:',
          err
        );
      }

      return webhook;
    }

    const created =
      await channel.createWebhook({
        name: SUKI_WEBHOOK_NAME,
        ...(SUKI_WEBHOOK_AVATAR
          ? {
              avatar: SUKI_WEBHOOK_AVATAR,
            }
          : {}),
        reason:
          'Webhook oficial da Suki - Skying',
      });

    console.log(
      `[Suki Webhook] Criado em ${channel.guild.name} #${channel.name}`
    );

    return created;

  } catch (err) {
    console.error(
      '[Suki Webhook] Erro ao criar/buscar webhook:',
      err
    );

    return null;
  }
}

// ============================================================
// CRIAÇÃO MANUAL DA SUKI
// ============================================================

async function setupSukiWebhook(
  message: Message
): Promise<boolean> {

  if (!message.guild) {
    return false;
  }

  const guildId = message.guild.id;

  if (!isSukiAllowed(guildId)) {
    await message.reply(
      'A Suki não está liberada neste servidor.'
    ).catch(() => null);

    return false;
  }

  const member = message.member as GuildMember | null;

  if (
    !member ||
    !member.permissions.has(
      PermissionFlagsBits.ManageWebhooks
    )
  ) {
    await message.reply(
      'Você precisa da permissão **Gerenciar Webhooks** para configurar a Suki.'
    ).catch(() => null);

    return false;
  }

  const channel = message.channel as TextChannel;

  if (
    typeof (channel as any).createWebhook !== 'function'
  ) {
    await message.reply(
      'Não consigo criar o webhook neste tipo de canal. Usa um canal de texto normal.'
    ).catch(() => null);

    return false;
  }

  const botMember = message.guild.members.me;

  if (
    !botMember ||
    !botMember.permissionsIn(channel).has(
      PermissionFlagsBits.ManageWebhooks
    )
  ) {
    await message.reply(
      'Eu não tenho a permissão **Gerenciar Webhooks** neste canal.'
    ).catch(() => null);

    return false;
  }

  const webhook = await getOrCreateSukiWebhook(channel);

  if (!webhook) {
    await message.reply(
      'Não consegui criar a Suki aqui. Verifica minhas permissões de webhook.'
    ).catch(() => null);

    return false;
  }

  const embed =
    new EmbedBuilder()
      .setColor('#8B5CF6')
      .setTitle('Suki configurada')
      .setDescription(
        `A Suki foi configurada neste canal.\n\n` +
        `**Nome:** ${SUKI_WEBHOOK_NAME}\n` +
        `**Canal:** ${channel}\n\n` +
        `Agora você pode chamar a Suki normalmente.`
      )
      .setThumbnail(
        SUKI_WEBHOOK_AVATAR || message.client.user.displayAvatarURL()
      )
      .setFooter({
        text: 'Skying • Suki',
      })
      .setTimestamp();

  if (SUKI_BANNER_URL) {
    embed.setImage(SUKI_BANNER_URL);
  }

  await message.reply({
    embeds: [embed],
  }).catch(() => null);

  return true;
}

// ============================================================
// EXECUÇÃO
// ============================================================

export default {

  name: 'messageCreate',

  once: false,

  async execute(message: Message) {

    if (
      message.author.bot ||
      !message.guild
    ) {
      return;
    }

    const guildId = message.guild.id;
    const authorId = message.author.id;
    const content = message.content.trim();

    // ========================================================
    // AFK
    // ========================================================

    if (getBotConfig().featAfk) {

      try {
        const authorAfk =
          await prisma.afkStatus.findUnique({
            where: { userId: authorId },
          });

        if (authorAfk) {
          await prisma.afkStatus.delete({
            where: { userId: authorId },
          });

          const notify =
            await (message.channel as TextChannel)
              .send({
                content: `👋 ${message.author}, seu AFK foi removido!`,
              })
              .catch(() => null);

          if (notify) {
            setTimeout(
              () => notify.delete().catch(() => null),
              5000
            );
          }
        }
      } catch {
        // Ignora
      }

      if (message.mentions.users.size > 0) {
        for (const [, mentionedUser] of message.mentions.users) {
          if (
            mentionedUser.bot ||
            mentionedUser.id === authorId
          ) {
            continue;
          }

          try {
            const afk =
              await prisma.afkStatus.findUnique({
                where: { userId: mentionedUser.id },
              });

            if (!afk) continue;

            const since = Math.floor(afk.setAt.getTime() / 1000);

            const warn =
              await (message.channel as TextChannel)
                .send({
                  embeds: [
                    new EmbedBuilder()
                      .setColor(COLORS.WARNING)
                      .setTitle(`💤 ${mentionedUser.username} está em AFK`)
                      .setDescription(
                        `**Motivo:** ${afk.message}\n` +
                        `**Desde:** <t:${since}:R>`
                      )
                      .setFooter({ text: '⚔️ Aliança Skyline' }),
                  ],
                })
                .catch(() => null);

            if (warn) {
              setTimeout(
                () => warn.delete().catch(() => null),
                8000
              );
            }
          } catch {
            // Ignora
          }
        }
      }
    }

    // ========================================================
    // CONFIGURAR SUKI
    // ========================================================

    const normalizedContent = content.toLowerCase();

    const wantsSukiWebhook =
      CREATE_SUKI_WEBHOOK_REGEX.test(content) &&
      (
        normalizedContent.includes('suki') ||
        normalizedContent.includes('webhook')
      );

    const prefixWantsSukiWebhook =
      normalizedContent === 'b sukiwebhook' ||
      normalizedContent === 'b suki webhook';

    const bryanWantsSukiWebhook =
      BRYAN_REGEX.test(content) && wantsSukiWebhook;

    if (prefixWantsSukiWebhook || bryanWantsSukiWebhook) {
      await setupSukiWebhook(message);
      return;
    }

    // ========================================================
    // CHECAGEM DE IDENTIFICAÇÃO NA MENSAGEM & RESPOSTAS (REPLY)
    // ========================================================

    let referencedAuthorName: string | null = null;
    let referencedWebhookName: string | null = null;

    if (message.reference?.messageId) {
      try {
        const refMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (refMessage) {
          referencedAuthorName = refMessage.author.username;
          if (refMessage.webhookId) {
            referencedWebhookName = refMessage.author.username;
          }
        }
      } catch {
        // Ignora
      }
    }

    const startsWithBryan = BRYAN_REGEX.test(content);
    const startsWithSuki = /^suki[,!.?:\s]/i.test(content);

    const repliedToSuki =
      referencedWebhookName?.toLowerCase().includes('suki') ||
      (message.mentions.users.has(message.client.user.id) && content.toLowerCase().includes('suki'));

    const repliedToBryan =
      referencedAuthorName === message.client.user.username && !referencedWebhookName && !startsWithSuki;

    // ========================================================
    // 1. PRIORIDADE SUKI
    // ========================================================

    if ((startsWithSuki || repliedToSuki) && isSukiAllowed(guildId)) {
      const sukiKey = `${guildId}:${authorId}`;
      const now = Date.now();

      if (now - (sukiCooldowns.get(sukiKey) ?? 0) < 8000) {
        const warn = await message.reply('⏳ Segura a emoção! Espera eu respirar (8s) pra responder de novo!').catch(() => null);
        if (warn) setTimeout(() => warn.delete().catch(() => null), 4000);
        return;
      }

      sukiCooldowns.set(sukiKey, now);

      let userMessage = content
        .replace(/^suki[,!.?:\s]*/i, '')
        .replace(/<@!?\d+>/g, '')
        .trim();

      if (!userMessage) {
        userMessage = 'Oi Suki, você tá aí?';
      }

      await (message.channel as TextChannel)
        .sendTyping()
        .catch(() => null);

      const displayName =
        message.member?.displayName ?? message.author.username;

      const memory = await fetchChannelMemory(message);
      const response = await askSuki(userMessage, displayName, memory);

      const channel = message.channel as TextChannel;
      const webhook = await getOrCreateSukiWebhook(channel);

      if (!webhook) {
        await message.reply(
          'Não consegui aparecer como Suki aqui 😭. Preciso de permissão para gerenciar webhooks neste canal.'
        ).catch(() => null);

        return;
      }

      // Envio otimizado e limpo (sem duplicar menção no texto)
      await webhook.send({
        content: response,
        username: SUKI_WEBHOOK_NAME,
        ...(SUKI_WEBHOOK_AVATAR ? { avatarURL: SUKI_WEBHOOK_AVATAR } : {}),
        allowedMentions: { parse: [] },
      }).catch(async err => {
        console.error('[Suki Webhook] Erro ao enviar:', err);
        await message.reply('Deu erro pra eu aparecer como Suki 😭').catch(() => null);
      });

      return;
    }

    // ========================================================
    // 2. PRIORIDADE BRYAN
    // ========================================================

    if (startsWithBryan || repliedToBryan) {
      const bryanKey = `${guildId}:${authorId}`;
      const now = Date.now();

      if (now - (bryanCooldowns.get(bryanKey) ?? 0) < 8000) {
        await message.reply(
          '⏳ Espera um pouquinho antes de me chamar de novo!'
        ).catch(() => null);

        return;
      }

      bryanCooldowns.set(bryanKey, now);

      const userMessage = content
        .replace(/^bryan[,!.?:\s]*/i, '')
        .trim();

      if (!userMessage) {
        await message.reply(
          '👋 Oi! Me faz uma pergunta, pode falar!'
        ).catch(() => null);

        return;
      }

      await (message.channel as TextChannel)
        .sendTyping()
        .catch(() => null);

      const displayName =
        message.member?.displayName ?? message.author.username;

      const memory = await fetchChannelMemory(message);
      const response = await askBryan(userMessage, displayName, memory);

      await message.reply(response).catch(() => null);

      return;
    }

    // ========================================================
    // 3. SUKI MENCIONADA NO MEIO DA FRASE
    // ========================================================

    if (isSukiAllowed(guildId)) {
      const sukiMentioned = message.mentions.users.has(message.client.user.id);
      const sukiCalled = SUKI_REGEX.test(content);

      if (sukiCalled || sukiMentioned) {
        const sukiKey = `${guildId}:${authorId}`;
        const now = Date.now();

        if (now - (sukiCooldowns.get(sukiKey) ?? 0) < 8000) {
          return;
        }

        sukiCooldowns.set(sukiKey, now);

        let userMessage = content
          .replace(/<@!?\d+>/g, '')
          .replace(/\bsuki\b/gi, '')
          .trim();

        if (!userMessage) {
          userMessage = 'Oi Suki, você tá aí?';
        }

        await (message.channel as TextChannel)
          .sendTyping()
          .catch(() => null);

        const displayName =
          message.member?.displayName ?? message.author.username;

        const memory = await fetchChannelMemory(message);
        const response = await askSuki(userMessage, displayName, memory);

        const channel = message.channel as TextChannel;
        const webhook = await getOrCreateSukiWebhook(channel);

        if (!webhook) {
          await message.reply(
            'Não consegui aparecer como Suki aqui 😭. Preciso de permissão para gerenciar webhooks neste canal.'
          ).catch(() => null);

          return;
        }

        await webhook.send({
          content: response,
          username: SUKI_WEBHOOK_NAME,
          ...(SUKI_WEBHOOK_AVATAR ? { avatarURL: SUKI_WEBHOOK_AVATAR } : {}),
          allowedMentions: { parse: [] },
        }).catch(async err => {
          console.error('[Suki Webhook] Erro ao enviar:', err);
          await message.reply('Deu erro pra eu aparecer como Suki 😭').catch(() => null);
        });

        return;
      }
    }

    // ========================================================
    // PREFIX COMMANDS
    // ========================================================

    if (content.toLowerCase().startsWith(PREFIX)) {

      const args =
        content
          .slice(PREFIX.length)
          .trim()
          .split(/\s+/);

      const cmdName = args.shift()?.toLowerCase() ?? '';

      if (!cmdName) return;

      const extClient = message.client as ExtendedClient;

      const prefixCmd = extClient.prefixCommands?.get(cmdName);

      if (prefixCmd) {
        try {
          await prefixCmd.execute(message, args);
        } catch (err) {
          console.error(`[Prefix] Erro em ${cmdName}:`, err);
          await message.reply('❌ Erro ao executar esse comando.').catch(() => null);
        }
        return;
      }

      const slashCmd = extClient.commands?.get(cmdName);

      if (slashCmd) {
        try {
          const { createMessageShim } = require('../utils/messageCommandShim');
          const shim = createMessageShim(message, cmdName, args);
          await slashCmd.execute(shim);
        } catch (err) {
          console.error(`[Prefix→Slash] Erro em ${cmdName}:`, err);
          await message.reply('❌ Erro ao executar esse comando.').catch(() => null);
        }
        return;
      }

      await message.reply(
        `❌ Comando \`${cmdName}\` não encontrado. Use \`b ajuda\` para ver os disponíveis.`
      ).catch(() => null);

      return;
    }

    // ========================================================
    // IGNORAR SLASH COMMANDS
    // ========================================================

    if (message.content.startsWith('/')) {
      return;
    }

    // ========================================================
    // CONFIG DO SERVIDOR
    // ========================================================

    const config = await getConfig(guildId);

    // ========================================================
    // CONTADOR DE MENSAGENS
    // ========================================================

    prisma.serverStat.upsert({
      where: {
        guildId_date: {
          guildId,
          date: today(),
        },
      },
      update: { messages: { increment: 1 } },
      create: {
        guildId,
        date: today(),
        messages: 1,
      },
    }).catch(() => null);

    // ========================================================
    // ANTI-SPAM
    // ========================================================

    if (config.antiSpam) {

      const key = `${guildId}:${authorId}`;
      const now = Date.now();

      const entry =
        spamTrack.get(key) ?? {
          count: 0,
          reset: now + 5000,
        };

      if (now > entry.reset) {
        entry.count = 0;
        entry.reset = now + 5000;
      }

      entry.count++;
      spamTrack.set(key, entry);

      if (entry.count > 5) {
        await message.delete().catch(() => null);

        const warn =
          await (message.channel as TextChannel)
            .send({
              content: `${message.author}, devagar! ⚠️ Anti-spam ativado.`,
            })
            .catch(() => null);

        if (warn) {
          setTimeout(
            () => warn.delete().catch(() => null),
            4000
          );
        }

        return;
      }
    }

    // ========================================================
    // ANTI-LINKS
    // ========================================================

    if (config.antiLinks && linkRegex.test(message.content)) {

      const mem = message.member as GuildMember;

      if (!mem?.permissions.has('ManageMessages')) {
        await message.delete().catch(() => null);

        const warn =
          await (message.channel as TextChannel)
            .send({
              content: `${message.author}, links não são permitidos aqui! 🔗`,
            })
            .catch(() => null);

        if (warn) {
          setTimeout(
            () => warn.delete().catch(() => null),
            4000
          );
        }

        return;
      }
    }

    // ========================================================
    // XP / LEVELING
    // ========================================================

    if (!config.featLeveling) {
      return;
    }

    const now = Date.now();
    const cdKey = `${guildId}:${authorId}`;
    const cooldownMs = (config.xpCooldown ?? 60) * 1000;

    if (now - (cooldowns.get(cdKey) ?? 0) < cooldownMs) {
      return;
    }

    cooldowns.set(cdKey, now);

    const xpMin = config.xpMin ?? 15;
    const xpMax = config.xpMax ?? 25;

    const xpGain =
      Math.floor(
        Math.random() * (xpMax - xpMin + 1)
      ) + xpMin;

    const before =
      await prisma.member.findUnique({
        where: { discordId: authorId },
      });

    const after =
      await addXp(
        authorId,
        message.author.username,
        xpGain
      );

    // ========================================================
    // RPG
    // ========================================================

    applyChatEnergyRegen(authorId).catch(() => null);

    // ========================================================
    // MISSÕES
    // ========================================================

    const dateStr = today();
    const weekStr = thisWeek();

    if (config.featMissions) {
      const {
        ensureDailyMissions,
        ensureWeeklyMissions,
      } = await import('../commands/utility/missoes');

      await Promise.all([
        ensureDailyMissions(authorId, guildId),
        ensureWeeklyMissions(authorId, guildId),
      ]).catch(() => null);
    }

    if (config.featMissions) {
      await Promise.all([

        prisma.dailyMission.updateMany({
          where: {
            memberId: authorId,
            guildId,
            type: 'estar_online',
            dateStr,
            completed: false,
          },
          data: { progress: 1, completed: true },
        }),

        prisma.dailyMission.updateMany({
          where: {
            memberId: authorId,
            guildId,
            type: 'enviar_mensagens',
            dateStr,
            completed: false,
          },
          data: { progress: { increment: 1 } },
        }),

        prisma.dailyMission.updateMany({
          where: {
            memberId: authorId,
            guildId,
            type: 'ganhar_xp',
            dateStr,
            completed: false,
          },
          data: { progress: { increment: xpGain } },
        }),

        prisma.weeklyMission.updateMany({
          where: {
            memberId: authorId,
            guildId,
            type: 'enviar_mensagens_sem',
            weekStr,
            completed: false,
          },
          data: { progress: { increment: 1 } },
        }),

        prisma.weeklyMission.updateMany({
          where: {
            memberId: authorId,
            guildId,
            type: 'ganhar_xp_semanal',
            weekStr,
            completed: false,
          },
          data: { progress: { increment: xpGain } },
        }),

      ]).catch(() => null);
    }

    // ========================================================
    // COMPLETAR MISSÕES
    // ========================================================

    if (config.featMissions) {

      prisma.dailyMission
        .findMany({
          where: {
            memberId: authorId,
            guildId,
            dateStr,
            completed: false,
          },
        })
        .then(pending =>
          Promise.all(
            pending
              .filter(m => m.progress >= m.target)
              .map(m =>
                prisma.dailyMission.update({
                  where: { id: m.id },
                  data: { completed: true },
                })
              )
          )
        )
        .catch(() => null);

      prisma.weeklyMission
        .findMany({
          where: {
            memberId: authorId,
            guildId,
            weekStr,
            completed: false,
          },
        })
        .then(pending =>
          Promise.all(
            pending
              .filter(m => m.progress >= m.target)
              .map(m =>
                prisma.weeklyMission.update({
                  where: { id: m.id },
                  data: { completed: true },
                })
              )
          )
        )
        .catch(() => null);
    }

    // ========================================================
    // LEVEL UP
    // ========================================================

    if (before && after.level > before.level) {

      prisma.levelReward
        .findUnique({
          where: {
            guildId_level: {
              guildId,
              level: after.level,
            },
          },
        })
        .then(async reward => {
          if (!reward) return;

          if (reward.roleId) {
            await (message.member as GuildMember)
              ?.roles.add(reward.roleId)
              .catch(() => null);
          }

          if (reward.coins > 0) {
            await prisma.member.update({
              where: { discordId: authorId },
              data: { coins: { increment: reward.coins } },
            });
          }
        })
        .catch(() => null);

      const channelId = config.levelUpChannelId ?? message.channel.id;
      const channel = message.guild.channels.cache.get(channelId) as TextChannel | undefined;

      if (!channel) return;

      const { applyTemplate: applyLevelUpTemplate } =
        await import('../../utils/embedTemplates');

      const embed =
        new EmbedBuilder()
          .setColor(colorFromLevel(after.level))
          .setTitle(`${EMOJIS.LEVEL} Level Up!`)
          .setThumbnail(message.author.displayAvatarURL())
          .setDescription(
            `Parabéns ${message.author}! Você subiu para o **Nível ${after.level}**!\n\n` +
            `\`${levelBar(after.xp, xpForNextLevel(after.level))}\``
          )
          .setFooter({ text: `⚔️ ${message.guild.name}` })
          .setTimestamp();

      applyLevelUpTemplate(embed, 'levelup');

      await channel
        .send({ embeds: [embed] })
        .catch(console.error);
    }
  },
};
