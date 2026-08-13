// ═══════════════════════════════════════════════════════════════════════
// PAINEL VISUAL DE INVENTÁRIO
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { getInventory } from '../services/inventory';
import { getItem, RARITY_EMOJI, SLOT_NAME, SLOT_EMOJI } from '../constants/items';

export async function buildInventarioEmbed(char: FullCharacter): Promise<{
  embed: EmbedBuilder;
  select: ActionRowBuilder<StringSelectMenuBuilder> | null;
}> {
  const inv = await getInventory(char.discordId);

  if (inv.length === 0) {
    return {
      embed: new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('🎒 Inventário')
        .setDescription('*Seu inventário está vazio! Vá explorar dungeons para conseguir itens.*')
        .setFooter({ text: `💰 Ouro: ${char.gold.toLocaleString('pt-BR')}` }),
      select: null,
    };
  }

  // Visual limpo e direto usando os emojis da categoria (ex: 👕 Peitoral, 🐾 Pet)
  const lines = inv.slice(0, 20).map(invItem => {
    const item = getItem(invItem.itemId);
    if (!item) return `❓ ${invItem.itemId} x${invItem.quantity}`;
    const slotEmoji = SLOT_EMOJI[item.slot] ?? '📦';
    return `${RARITY_EMOJI[item.rarity] || '⬜'} ${slotEmoji} **${item.name}** ×${invItem.quantity}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🎒 Inventário')
    .setDescription(lines)
    .addFields(
      { name: '💰 Ouro', value: `**${char.gold.toLocaleString('pt-BR')}**`, inline: true },
      { name: '📦 Itens', value: `**${inv.length}**`, inline: true },
    )
    .setFooter({ text: 'Use o menu para equipar, usar ou vender itens.' });

  const selectableItems = inv.filter(invItem => {
    const item = getItem(invItem.itemId);
    return item && (item.maxStack === 1 || item.slot === 'consumable');
  }).slice(0, 25);

  const select = selectableItems.length > 0
    ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rpg_select:inventario_acao')
          .setPlaceholder('Selecione um item...')
          .addOptions(
            selectableItems.map(invItem => {
              const item = getItem(invItem.itemId)!;
              return new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name} ×${invItem.quantity}`)
                .setValue(invItem.itemId)
                .setEmoji(item.emoji.trim())
                .setDescription(`${item.rarity.toUpperCase()} | ${SLOT_NAME[item.slot]}`)
            })
          )
      )
    : null;

  return { embed, select };
}

export function buildInventarioButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:inventario').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:loja').setLabel('🛒 Loja').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('⚔️ Dungeon').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
  );
}

export function buildItemActionSelect(itemId: string): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const item = getItem(itemId);
  if (!item) return null;

  const options: StringSelectMenuOptionBuilder[] = [];
  if (item.maxStack === 1) {
    options.push(new StringSelectMenuOptionBuilder().setLabel('⚔️ Equipar').setValue(`equip:${itemId}`).setDescription('Equipar este item no seu corpo'));
  }
  if (item.slot === 'consumable') {
    options.push(new StringSelectMenuOptionBuilder().setLabel('🧪 Usar').setValue(`usar:${itemId}`).setDescription('Beber/Usar este consumível'));
  }
  options.push(new StringSelectMenuOptionBuilder().setLabel('💰 Vender (1x)').setValue(`vender:${itemId}`).setDescription(`Vender no mercador por ${item.sellPrice} ouro`));

  if (options.length === 0) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:item_acao')
      .setPlaceholder(`O que fazer com ${item.name}?`)
      .addOptions(options)
  );
}
