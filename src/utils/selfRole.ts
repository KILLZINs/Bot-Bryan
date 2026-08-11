// ═══════════════════════════════════════════════════════════════════════
// SELF-ROLE — helpers compartilhados
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';

export type SelfRoleEntry = { roleId: string; label: string; emoji: string | null };
export type SelfRoleMenuData = {
  id: string; title: string; description: string | null;
  channelId: string; messageId: string | null;
  entries: SelfRoleEntry[];
};

function makeEmoji(emoji: string | null) {
  if (!emoji) return { name: '🏷️' };
  if (/^\d{17,20}$/.test(emoji)) return { id: emoji };
  return { name: emoji };
}

export function buildMenuMessage(menu: SelfRoleMenuData) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(menu.title)
    .setDescription(
      (menu.description ?? 'Use os menus abaixo para gerenciar seus cargos.') +
      '\n\n> ➕ **Adicionar** — selecione um cargo para recebê-lo\n> 🗑️ **Remover** — selecione um cargo para removê-lo'
    )
    .setFooter({ text: '⚔️ Aliança Skyline — Registro de Cargos' });

  const components: ActionRowBuilder<StringSelectMenuBuilder>[] = [];
  // Max 25 entries (enforced by admin), so always fits in one ActionRow each
  const entries = menu.entries.slice(0, 25);

  if (entries.length === 0) return { embeds: [embed], components };

  const options = entries.map(e =>
    new StringSelectMenuOptionBuilder()
      .setValue(e.roleId)
      .setLabel(e.label.slice(0, 100))
      .setEmoji(makeEmoji(e.emoji))
  );

  // Row 1 — Adicionar
  components.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('selfrole:add')
        .setPlaceholder('➕ Adicionar cargo...')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options.map(o => o.setDescription('Clique para receber este cargo')))
    )
  );

  // Row 2 — Remover
  const removeOptions = entries.map(e =>
    new StringSelectMenuOptionBuilder()
      .setValue(e.roleId)
      .setLabel(e.label.slice(0, 100))
      .setDescription('Clique para remover este cargo')
      .setEmoji(makeEmoji(e.emoji))
  );
  components.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('selfrole:remove')
        .setPlaceholder('🗑️ Remover cargo...')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(removeOptions)
    )
  );

  return { embeds: [embed], components };
}
