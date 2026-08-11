// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// HANDLER: /embeds — customização total de embeds
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

import {
  ButtonInteraction, ModalSubmitInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import {
  EMBED_CATALOG, EMBED_CATEGORIES,
  getTemplate, fetchTemplate, setTemplateField, clearTemplate,
  hexToInt, intToHex,
} from '../utils/embedTemplates';
import { COLORS, baseEmbed, successEmbed, errorEmbed } from '../utils/embeds';
import { buildBaseEmbed } from '../utils/embedPreviews';
import { isBotManager } from '../utils/allowlist';

// ──── Tipos dos campos configuráveis ────────────────────────────────────────────────────────────────────────────────────────
const FIELD_META: Record<string, { label: string; emoji: string; placeholder: string; style: TextInputStyle; max: number }> = {
  title:       { label: 'Título',          emoji: '📌', placeholder: 'Título do embed (máx 256 chars)',         style: TextInputStyle.Short,     max: 256  },
  description: { label: 'Descrição',       emoji: '📄', placeholder: 'Descrição / conteúdo principal...',       style: TextInputStyle.Paragraph, max: 4000 },
  color:       { label: 'Cor (hex)',        emoji: '🎨', placeholder: '#9B59B6 (hex 6 dígitos)',                 style: TextInputStyle.Short,     max: 7    },
  thumbnailUrl:{ label: 'Thumbnail',        emoji: '🖼️', placeholder: 'https://i.imgur.com/exemplo.png',         style: TextInputStyle.Short,     max: 512  },
  imageUrl:    { label: 'Imagem',           emoji: '📸', placeholder: 'https://i.imgur.com/banner.png',          style: TextInputStyle.Short,     max: 512  },
  footerText:  { label: 'Texto do Rodapé', emoji: '📝', placeholder: '⚔️ Aliança Skyline',                      style: TextInputStyle.Short,     max: 2048 },
  footerIcon:  { label: 'Ícone do Rodapé', emoji: '🔗', placeholder: 'https://... (URL do ícone do rodapé)',    style: TextInputStyle.Short,     max: 512  },
};
const ALL_FIELDS = Object.keys(FIELD_META) as Array<keyof typeof FIELD_META>;

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUILD PANELS
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function buildEmbedsHome(): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = baseEmbed(COLORS.PRIMARY)
    .setTitle('⚙️ Customização de Embeds')
    .setDescription(
      'Personalize **título, descrição, cor, imagens e rodapé** de cada embed do bot.\n\n' +
      '🖼️ **Imagens e Thumbnail:** cole o URL direto (ex: `https://i.imgur.com/...`)\n\n' +
      'Selecione uma categoria para começar:'
    )
    .addFields(
      { name: '🎯 Geral',        value: 'Boas-vindas, Level Up, Roleplay, Painel',          inline: true },
      { name: '⚔️ RPG',          value: 'Vitória, Derrota, Empate, Level Up, Reencarnação', inline: true },
      { name: '🐉 Boss Mundial',  value: 'Spawn, Derrota e Expiração do Boss Mundial',       inline: true },
      { name: '💍 Casamento',     value: 'Proposta, Casamento e Divórcio',                   inline: true },
      { name: '📋 Missões',       value: 'Missão diária e semanal concluída',                inline: true },
      { name: '🌐 Aliança',       value: 'Embed oficial da aliança',                         inline: true },
      { name: '🎫 Tickets',       value: 'Ticket criado, fechado e assumido',                inline: true },
      { name: '🎁 Sorteios',      value: 'Sorteio iniciado e anúncio de vencedor',           inline: true },
      { name: '🔨 Moderação',     value: 'Aviso, ban e kick aplicados',                      inline: true },
      { name: '🎭 Cargos',        value: 'Cargo adicionado e removido (self-role)',           inline: true },
    );

  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('embeds:cat|geral').setLabel('🎯 Geral').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('embeds:cat|rpg').setLabel('⚔️ RPG').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('embeds:cat|bossmundial').setLabel('🐉 Boss').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('embeds:cat|casamento').setLabel('💍 Casamento').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('embeds:cat|missoes').setLabel('📋 Missões').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('embeds:cat|alianca').setLabel('🌐 Aliança').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embeds:cat|tickets').setLabel('🎫 Tickets').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('embeds:cat|sorteios').setLabel('🎁 Sorteios').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('embeds:cat|moderacao').setLabel('🔨 Moderação').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('embeds:cat|selfrole').setLabel('🎭 Cargos').setStyle(ButtonStyle.Secondary),
    ),
  ];

  return { embed, rows };
}

function buildCategoryPanel(category: string): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  const catLabel = EMBED_CATEGORIES[category] ?? category;
  const entries  = Object.entries(EMBED_CATALOG).filter(([, v]) => v.category === category);

  const embed = baseEmbed(COLORS.INFO)
    .setTitle(catLabel + ' — Embeds configuráveis')
    .setDescription('Selecione o embed que deseja personalizar:');
  
  embed.addFields(entries.map(([key, e]) => {
    const tpl = getTemplate(key);
    const hasConfig = tpl && Object.values(tpl).some(v => v !== null && v !== key);
    return { name: e.label + (hasConfig ? ' ✅' : ''), value: e.desc, inline: false };
  }));

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < entries.length; i += 4) {
    const chunk = entries.slice(i, i + 4);
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        chunk.map(([key, e]) =>
          new ButtonBuilder()
            .setCustomId('embeds:edit|' + key)
            .setLabel(e.label.replace(/^[^\s]+\s/, ''))
            .setStyle(ButtonStyle.Primary)
        )
      )
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('embeds:home').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
    )
  );

  return { embed, rows };
}

/**
 * Constrói o painel de edição para um embed específico.
 *
 * Estratégia do preview:
 * 1. Usa buildBaseEmbed(key) para montar o embed com a estrutura real do bot
 *    (todos os campos, thumbnail, rodapé, cor original, etc.)
 * 2. Aplica os overrides salvos no template por cima (fetchTemplate com fallback no DB)
 * 3. Se não há base definida, cai no fallback do catálogo (label + desc)
 *
 * Isso garante que o preview reflita exatamente como o embed ficará depois
 * das customizações, inclusive mostrando a estrutura correta ao editar pela
 * primeira vez.
 */
async function buildEditPanel(key: string): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const info = EMBED_CATALOG[key];
  const tpl  = await fetchTemplate(key);

  // ── 1. Ponto de partida: embed base real do bot (ou fallback do catálogo) ─────
  const base = buildBaseEmbed(key);
  const embed = base ?? new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(info?.label ?? key)
    .setDescription(info?.desc ?? null);

  // ── 2. Aplica overrides do template por cima da base ─────────────────────────
  if (tpl) {
    if (tpl.color !== null && tpl.color !== undefined) embed.setColor(tpl.color);
    if (tpl.title)        embed.setTitle(tpl.title);
    if (tpl.description)  embed.setDescription(tpl.description);
    if (tpl.thumbnailUrl) embed.setThumbnail(tpl.thumbnailUrl);
    if (tpl.imageUrl)     embed.setImage(tpl.imageUrl);

    if (tpl.footerText && tpl.footerIcon)  embed.setFooter({ text: tpl.footerText, iconURL: tpl.footerIcon });
    else if (tpl.footerText)               embed.setFooter({ text: tpl.footerText });
    else if (tpl.footerIcon) {
      const existing = embed.data.footer;
      if (existing?.text) embed.setFooter({ text: existing.text, iconURL: tpl.footerIcon });
    }
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [
    // Linha 1: title, description, color
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ALL_FIELDS.slice(0, 3).map(field =>
        new ButtonBuilder()
          .setCustomId('embeds:field|' + key + '|' + field)
          .setLabel(FIELD_META[field].emoji + ' ' + FIELD_META[field].label)
          .setStyle(ButtonStyle.Secondary)
      )
    ),
    // Linha 2: thumbnailUrl, imageUrl, footerText, footerIcon (todos via modal de URL/texto)
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      [
        ...ALL_FIELDS.slice(3).map(field =>
          new ButtonBuilder()
            .setCustomId('embeds:field|' + key + '|' + field)
            .setLabel(FIELD_META[field].emoji + ' ' + FIELD_META[field].label)
            .setStyle(field === 'thumbnailUrl' || field === 'imageUrl' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        ),
        new ButtonBuilder()
          .setCustomId('embeds:reset|' + key)
          .setLabel('🗑️ Resetar Tudo')
          .setStyle(ButtonStyle.Danger),
      ]
    ),
    // Linha 3: voltar
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('embeds:cat|' + (info?.category ?? 'geral'))
        .setLabel('◀ Voltar')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];

  return { embed, rows };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export async function handleEmbedsButtonRaw(i: ButtonInteraction): Promise<void> {
  if (!await isBotManager(i.user.id)) {
    await i.reply({ embeds: [errorEmbed('Sem permissão', 'Apenas gerenciadores do bot podem usar.')], ephemeral: true });
    return;
  }

  const raw    = i.customId.replace(/^embeds:/, '');
  const [op, ...rest] = raw.split('|');

  try {
    switch (op) {

      case 'home': {
        await i.deferUpdate();
        const { embed, rows } = buildEmbedsHome();
        await i.editReply({ embeds: [embed], components: rows });
        break;
      }

      case 'cat': {
        await i.deferUpdate();
        const category = rest[0];
        const { embed, rows } = buildCategoryPanel(category);
        await i.editReply({ embeds: [embed], components: rows });
        break;
      }

      case 'edit': {
        await i.deferUpdate();
        const key = rest[0];
        if (!EMBED_CATALOG[key]) {
          await i.editReply({ embeds: [errorEmbed('Embed não encontrado', 'Chave `' + key + '` inválida.')] });
          return;
        }
        const { embed, rows } = await buildEditPanel(key);
        await i.editReply({ embeds: [embed], components: rows });
        break;
      }

      case 'field': {
        const [key, field] = rest;
        if (!EMBED_CATALOG[key] || !FIELD_META[field]) {
          await i.reply({ embeds: [errorEmbed('Inválido', 'Campo ou embed inválido.')], ephemeral: true });
          return;
        }
        const meta = FIELD_META[field];
        // Usa fetchTemplate (com fallback no DB) para pré-preencher o modal com o
        // valor real salvo, mesmo que o cache ainda não tenha sido populado.
        const tpl  = await fetchTemplate(key);
        const current = field === 'color' && tpl?.color
          ? intToHex(tpl.color)
          : ((tpl?.[field as keyof typeof tpl] ?? '') as string);

        const modal = new ModalBuilder()
          .setCustomId('embeds_modal:field|' + key + '|' + field)
          .setTitle(meta.emoji + ' Editar ' + meta.label)
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('value')
                .setLabel(meta.label)
                .setStyle(meta.style)
                .setRequired(false)
                .setPlaceholder(meta.placeholder)
                .setMaxLength(meta.max)
                .setValue(current.toString().slice(0, meta.max))
            )
          );

        await i.showModal(modal);
        break;
      }

      case 'reset': {
        await i.deferUpdate();
        const key = rest[0];
        await clearTemplate(key);
        const { embed, rows } = await buildEditPanel(key);
        await i.editReply({ embeds: [successEmbed('✅ Resetado', 'Template `' + key + '` restaurado para o padrão.'), embed], components: rows });
        break;
      }

      default:
        await i.reply({ embeds: [errorEmbed('Ação desconhecida', 'Operação `' + op + '` não reconhecida.')], ephemeral: true });
    }
  } catch (err) {
    console.error('[EmbedsCfg Error]', err);
    const errEmbed = errorEmbed('Erro', 'Ocorreu um erro ao processar.');
    if (i.replied || i.deferred) await i.editReply({ embeds: [errEmbed] }).catch(() => null);
    else await i.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MODAL HANDLER
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export async function handleEmbedCfgModal(i: ModalSubmitInteraction, raw: string): Promise<void> {
  if (!await isBotManager(i.user.id)) {
    await i.reply({ embeds: [errorEmbed('Sem permissão', 'Apenas gerenciadores do bot podem usar.')], ephemeral: true });
    return;
  }

  const [op, ...rest] = raw.split('|');

  if (op === 'field') {
    await i.deferUpdate();
    const [key, field] = rest;
    let rawValue = i.fields.getTextInputValue('value').trim();

    if (!rawValue) {
      await setTemplateField(key, field as any, null);
    } else if (field === 'color') {
      const colorInt = hexToInt(rawValue);
      if (colorInt === null) {
        await i.editReply({ embeds: [errorEmbed('Cor inválida', 'Use formato hex como `#9B59B6`.')] });
        return;
      }
      await setTemplateField(key, 'color', colorInt);
    } else if (field === 'imageUrl' || field === 'thumbnailUrl') {
      // Valida se parece uma URL
      if (!rawValue.startsWith('http://') && !rawValue.startsWith('https://')) {
        await i.editReply({ embeds: [errorEmbed('URL inválida', 'O link deve começar com `https://`.')] });
        return;
      }
      await setTemplateField(key, field as any, rawValue);
    } else {
      await setTemplateField(key, field as any, rawValue);
    }

    const { embed, rows } = await buildEditPanel(key);
    await i.editReply({ embeds: [successEmbed('✅ Salvo', 'Campo **' + (FIELD_META[field]?.label ?? field) + '** atualizado!'), embed], components: rows });
  }
}
