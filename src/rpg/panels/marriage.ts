// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE CASAMENTO — propor, aceitar, rejeitar, divorciar
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { getMarriage, getPendingProposals, getPartner } from '../services/marriage';
import { applyTemplate } from '../../utils/embedTemplates';

// ─── Embed de casamento ────────────────────────────────────────────────

export async function buildMarriageEmbed(userId: string, client: any): Promise<EmbedBuilder> {
  const marriage = await getMarriage(userId);
  const proposals = await getPendingProposals(userId);

  const embed = new EmbedBuilder()
    .setColor(0xFF69B4)
    .setTitle('💍 Sistema de Casamento');

  if (marriage) {
    const partnerId = getPartner(marriage, userId);
    let partnerName = `<@${partnerId}>`;

    try {
      const user = await client.users.fetch(partnerId);
      partnerName = user.username;
    } catch { /* user may not be cached */ }

    const daysTogether = Math.floor((Date.now() - marriage.marriedAt.getTime()) / 86400000);
    const anniversary = marriage.marriedAt.toLocaleDateString('pt-BR');

    embed.setDescription(
      `💑 **Você está casado(a)!**\n\n` +
      `💕 **Parceiro(a):** <@${partnerId}> (${partnerName})\n` +
      `📅 **Casados desde:** ${anniversary}\n` +
      `💫 **Dias juntos:** **${daysTogether}** dia(s)\n\n` +
      `*"O amor é a força mais poderosa do mundo."* 🌹`,
    );

  } else {
    embed.setDescription(
      '💔 **Você está solteiro(a).**\n\n' +
      'O casamento traz bônus especiais:\n' +
      '💞 Ações de RP exclusivas para casais\n' +
      '⭐ Bônus de XP e Ouro em batalhas juntos\n' +
      '🌹 Exibição no perfil RPG\n\n' +
      'Use o botão abaixo para propor casamento a alguém!',
    );
  }

  if (proposals.length > 0) {
    const proposalLines = proposals.slice(0, 3).map(p =>
      `💌 <@${p.proposerId}> — expira em ${Math.max(0, Math.floor((p.expiresAt.getTime() - Date.now()) / 3600000))}h`,
    ).join('\n');
    embed.addFields({ name: `💌 Pedidos de Casamento (${proposals.length})`, value: proposalLines });
  }

  embed.setFooter({ text: '⚔️ Aliança Skyline RPG — Sistema de Casamento' });
  applyTemplate(embed, 'marriage.married');
  return embed;
}

// ─── Botões de casamento ───────────────────────────────────────────────

export async function buildMarriageButtons(userId: string): Promise<ActionRowBuilder<ButtonBuilder>[]> {
  const marriage = await getMarriage(userId);
  const proposals = await getPendingProposals(userId);

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (marriage) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('rpg:casamento_divorciar_confirmar')
          .setLabel('💔 Divorciar')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('rpg:cidade')
          .setLabel('◀ Voltar')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  } else {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('rpg:casamento_propor')
          .setLabel('💍 Propor Casamento')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('rpg:casamento')
          .setLabel('🔄 Atualizar')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rpg:cidade')
          .setLabel('◀ Voltar')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  // Botões para aceitar/rejeitar propostas (até 3)
  for (const proposal of proposals.slice(0, 2)) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`rpg:casamento_aceitar:${proposal.id}`)
          .setLabel(`✅ Aceitar de <@${proposal.proposerId}>`.slice(0, 80))
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`rpg:casamento_rejeitar:${proposal.id}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger),
      ),
    );
  }

  return rows;
}

// ─── Modal de proposta ─────────────────────────────────────────────────

export function buildProposalModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('rpg_modal:casamento_propor')
    .setTitle('💍 Propor Casamento')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('target_id')
          .setLabel('ID do usuário (copie o ID do Discord)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ex: 123456789012345678')
          .setMinLength(17)
          .setMaxLength(20),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('mensagem')
          .setLabel('Mensagem Romântica (opcional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Escreva algo especial... 💕')
          .setMaxLength(300),
      ),
    );
}

// ─── Confirmação de divórcio ───────────────────────────────────────────

export function buildDivorceConfirmEmbed(): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('💔 Confirmar Divórcio')
    .setDescription(
      '⚠️ Tem certeza que deseja se divorciar?\n\n' +
      'Esta ação **não pode ser desfeita**.\n' +
      'Você perderá todos os benefícios do casamento.',
    );
  applyTemplate(embed, 'marriage.divorced');
  return embed;
}
