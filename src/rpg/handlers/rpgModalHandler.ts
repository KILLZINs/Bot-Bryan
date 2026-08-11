// ═══════════════════════════════════════════════════════════════════════
// HANDLER DE MODAIS RPG
// ═══════════════════════════════════════════════════════════════════════

import { ModalSubmitInteraction } from 'discord.js';
import { createGuild } from '../panels/guild';
import { errorEmbed, successEmbed } from '../../utils/embeds';
import { prisma } from '../../database/client';
import { getOrCreateCharacter } from '../services/character';
import { runPvp } from '../services/combat';

export async function handleRpgModal(i: ModalSubmitInteraction, action: string): Promise<void> {
  const discordId = i.user.id;
  const username  = i.user.username;

  try {
    switch (action) {

      // ── Proposta de Casamento ────────────────────────────────────────────
      case 'casamento_propor': {
        await i.deferReply({ ephemeral: true });
        const targetIdRaw = i.fields.getTextInputValue('target_id').trim().replace(/[<@>]/g, '');
        const mensagem    = (() => { try { return i.fields.getTextInputValue('mensagem').trim(); } catch { return ''; } })();

        if (!/^\d{17,20}$/.test(targetIdRaw)) {
          await i.editReply({ embeds: [errorEmbed('ID Inválido', 'Por favor insira um ID Discord válido (17-20 dígitos).')] });
          return;
        }

        const { proposeMarriage } = await import('../services/marriage');
        const result = await proposeMarriage(discordId, targetIdRaw, i.guildId ?? '');

        if (result.success) {
          // Notificar o alvo via DM
          try {
            const targetUser = await i.client.users.fetch(targetIdRaw);
            const { EmbedBuilder } = await import('discord.js');
            const { applyTemplate: applyTplProp } = await import('../../utils/embedTemplates');
            const dmEmbed = new EmbedBuilder()
              .setColor(0xFF69B4)
              .setTitle('💍 Pedido de Casamento!')
              .setDescription(
                `**${i.user.username}** te pediu em casamento! 💕\n\n` +
                (mensagem ? `*"${mensagem}"*\n\n` : '') +
                'Acesse o painel de **💍 Casamento** via `/rpg` para aceitar ou recusar.'
              )
              .setThumbnail(i.user.displayAvatarURL())
              .setFooter({ text: '⚔️ Aliança Skyline RPG — Você tem 24h para responder' });
            applyTplProp(dmEmbed, 'rpg.marriage.proposal');
            await targetUser.send({ embeds: [dmEmbed] });
          } catch { /* DMs fechadas */ }

          await i.editReply({ embeds: [successEmbed('💍 Proposta Enviada!', result.message)] });
        } else {
          await i.editReply({ embeds: [errorEmbed('Erro', result.message)] });
        }
        break;
      }

      // ── Criar Guilda ────────────────────────────────────────────────────
      case 'guild_criar': {
        await i.deferReply({ ephemeral: true });
        const nome     = i.fields.getTextInputValue('nome').trim();
        const tag      = i.fields.getTextInputValue('tag').trim().toUpperCase();
        const descricao = i.fields.getTextInputValue('descricao').trim();
        const emblema  = i.fields.getTextInputValue('emblema').trim() || '⚔️';

        if (nome.length < 3) {
          await i.editReply({ embeds: [errorEmbed('Nome inválido', 'O nome deve ter pelo menos 3 caracteres.')] });
          return;
        }
        if (tag.length < 2 || tag.length > 5) {
          await i.editReply({ embeds: [errorEmbed('Tag inválida', 'A tag deve ter entre 2 e 5 caracteres.')] });
          return;
        }

        const result = await createGuild(discordId, nome, tag, descricao, emblema);
        await i.editReply({
          embeds: [result.success ? successEmbed('Guilda Criada!', result.message) : errorEmbed('Erro', result.message)],
        });
        break;
      }

      // ── Configurar Guilda (líder/vice-líder) ────────────────────────────
      case 'guild_config': {
        await i.deferReply({ ephemeral: true });
        const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
        if (!membership || (membership.role !== 'Líder' && membership.role !== 'Vice-Líder')) {
          await i.editReply({ embeds: [errorEmbed('Sem Permissão', 'Apenas Líder ou Vice-Líder podem configurar a guilda.')] });
          return;
        }
        const nome     = i.fields.getTextInputValue('nome').trim();
        const descricao = i.fields.getTextInputValue('descricao').trim();
        const emblema  = i.fields.getTextInputValue('emblema').trim();

        const data: Record<string, string> = {};
        if (nome.length >= 3)   data.name        = nome;
        if (descricao)          data.description = descricao;
        if (emblema)            data.emblem      = emblema;

        if (Object.keys(data).length === 0) {
          await i.editReply({ embeds: [errorEmbed('Nada Alterado', 'Preencha ao menos um campo.')] });
          return;
        }

        // Verificar conflito de nome/tag se mudou nome
        if (data.name) {
          const conflict = await prisma.rpgGuild.findFirst({
            where: { name: data.name, id: { not: membership.guildId } },
          });
          if (conflict) {
            await i.editReply({ embeds: [errorEmbed('Nome Inválido', 'Já existe uma guilda com esse nome.')] });
            return;
          }
        }

        await prisma.rpgGuild.update({ where: { id: membership.guildId }, data });
        await i.editReply({ embeds: [successEmbed('Guilda Atualizada!', 'As configurações foram salvas com sucesso.')] });
        break;
      }

      // ── Depositar Ouro na Guilda ────────────────────────────────────────
      case 'guild_depositar': {
        await i.deferReply({ ephemeral: true });
        const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
        if (!membership) {
          await i.editReply({ embeds: [errorEmbed('Sem Guilda', 'Você não está em nenhuma guilda.')] });
          return;
        }

        const qtd = parseInt(i.fields.getTextInputValue('quantidade').trim(), 10);
        if (isNaN(qtd) || qtd <= 0) {
          await i.editReply({ embeds: [errorEmbed('Valor Inválido', 'Digite um número positivo.')] });
          return;
        }

        const char = await getOrCreateCharacter(discordId, username);
        if (char.gold < qtd) {
          await i.editReply({ embeds: [errorEmbed('Ouro Insuficiente', `Você tem apenas **${char.gold}** de ouro.`)] });
          return;
        }

        await prisma.$transaction([
          prisma.rpgCharacter.update({ where: { discordId }, data: { gold: { decrement: qtd } } }),
          prisma.rpgGuild.update({ where: { id: membership.guildId }, data: { gold: { increment: qtd } } }),
        ]);

        await i.editReply({ embeds: [successEmbed('Depósito Realizado!', `✅ **${qtd}** de ouro depositado no banco da guilda.\nSeu saldo restante: **${char.gold - qtd}** de ouro.`)] });
        break;
      }

      // ── Definir Aviso da Guilda ─────────────────────────────────────────
      case 'guild_anuncio': {
        await i.deferReply({ ephemeral: true });
        const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
        if (!membership || (membership.role !== 'Líder' && membership.role !== 'Vice-Líder')) {
          await i.editReply({ embeds: [errorEmbed('Sem Permissão', 'Apenas Líder ou Vice-Líder podem definir o aviso.')] });
          return;
        }

        const aviso = i.fields.getTextInputValue('aviso').trim() || null;
        await prisma.rpgGuild.update({ where: { id: membership.guildId }, data: { announcement: aviso } });
        await i.editReply({ embeds: [successEmbed('Aviso Atualizado!', aviso ? `📢 Novo aviso: *${aviso}*` : '📢 Aviso removido.')] });
        break;
      }

      // ── Criar personagem (seleção de classe inicial) ─────────────────────
      case 'criar_personagem': {
        await i.deferReply({ ephemeral: true });
        // handled via select on /rpg start
        await i.editReply({ embeds: [errorEmbed('Erro', 'Use /rpg para começar.')] });
        break;
      }

      default:
        if (!i.replied && !i.deferred) {
          await i.reply({ embeds: [errorEmbed('Ação desconhecida', `Modal RPG \`${action}\` não encontrado.`)], ephemeral: true });
        }
    }
  } catch (err) {
    console.error(`[RPG Modal Error] action=${action}`, err);
    const errMsg = { embeds: [errorEmbed('Erro RPG', 'Ocorreu um erro. Tente novamente.')], ephemeral: true };
    if (i.replied || i.deferred) await i.followUp(errMsg).catch(() => null);
    else await i.reply(errMsg).catch(() => null);
  }
}
