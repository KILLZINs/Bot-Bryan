import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { ITEM_LIST, RpgItem, RARITY_EMOJI } from '../constants/items';

const SHOP_CATEGORIES = [
  { id: 'weapon',     label: '⚔️ Armas',        emoji: '⚔️' },
  { id: 'helmet',     label: '⛑️ Elmos',        emoji: '⛑️' },
  { id: 'chest',      label: '👕 Peitorais',    emoji: '👕' },
  { id: 'pants',      label: '👖 Calças',       emoji: '👖' },
  { id: 'boots',      label: '👟 Botas',        emoji: '👟' },
  { id: 'gloves',     label: '🧤 Luvas',        emoji: '🧤' },
  { id: 'shield',     label: '🛡️ Escudos',      emoji: '🛡️' },
  { id: 'ring',       label: '💍 Anéis',        emoji: '💍' },
  { id: 'backpack',   label: '🎒 Mochilas',     emoji: '🎒' },
  { id: 'consumable', label: '🧪 Consumíveis',  emoji: '🧪' },
  { id: 'pet',        label: '🐾 Pets',         emoji: '🐾' },
];

export function buildShopEmbed(char: FullCharacter, category?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('🛒 Loja da Aliança')
    .setFooter({ text: `💰 Seu ouro: ${char.gold.toLocaleString('pt-BR')}` });

  if (!category) {
    embed.setDescription('Selecione uma categoria para ver os itens disponíveis.')
      .addFields(SHOP_CATEGORIES.map(c => ({ name: c.label, value: '`Selecione abaixo`', inline: true })));
    return embed;
  }

  const items = ITEM_LIST.filter(i => i.slot === category && i.price > 0 && i.minLevel <= char.level);
  if (items.length === 0) {
    embed.setDescription(`Nenhum item disponível em **${category}** para seu nível.`);
    return embed;
  }

  const cat = SHOP_CATEGORIES.find(c => c.id === category);
  embed.setTitle(`🛒 Loja — ${cat?.label ?? category}`);

  const lines = items.slice(0, 15).map(i =>
    `${RARITY_EMOJI[i.rarity]} ${i.emoji} **${i.name}** — 💰 **${i.price}** ouro\n` +
    `> Nv.${i.minLevel}+ | ${i.description}`
  ).join('\n\n');

  embed.setDescription(lines || '*Sem itens disponíveis.*');
  return embed;
}

export function buildShopCategorySelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:loja_categoria')
      .setPlaceholder('Selecione a categoria...')
      .addOptions(
        SHOP_CATEGORIES.map(c =>
          new StringSelectMenuOptionBuilder().setLabel(c.label).setValue(c.id).setEmoji(c.emoji.trim())
        )
      )
  );
}

export function buildShopItemSelect(char: FullCharacter, category: string): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const items = ITEM_LIST.filter(i => i.slot === category && i.price > 0 && i.minLevel <= char.level + 5);
  if (items.length === 0) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:loja_comprar')
      .setPlaceholder('Selecione o item para comprar...')
      .addOptions(
        items.slice(0, 25).map(i =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${i.name} — ${i.price} 💰`)
            .setValue(i.id)
            .setEmoji(i.emoji.trim())
            .setDescription(`${RARITY_EMOJI[i.rarity]} ${i.rarity} | Nv.${i.minLevel}+`)
        )
      )
  );
}

export function buildShopButtons(category?: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:loja').setLabel('🛒 Categorias').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('◀ Cidade').setStyle(ButtonStyle.Secondary),
  );
}
