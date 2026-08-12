import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { ITEMS, Item } from '../constants/items';

// Emojis dinâmicos para a raridade (caso não estejam exportados no items.ts)
const RARITY_EMOJI: Record<string, string> = {
  common: '⬜',
  uncommon: '🟩',
  rare: '🟦',
  epic: '🟪',
  legendary: '🟧',
  mythic: '🟥'
};

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
    .setFooter({ text: `💰 Seu ouro: ${char.gold.toLocaleString('pt-BR')} G` });

  if (!category) {
    embed.setDescription('Selecione uma categoria no menu abaixo para ver os itens disponíveis no armazém.')
      .addFields(SHOP_CATEGORIES.map(c => ({ name: c.label, value: '`Selecione abaixo`', inline: true })));
    return embed;
  }

  // Puxa todos os itens da categoria escolhida que possuem um preço de compra (buyPrice)
  const items = Object.values(ITEMS).filter(i => i.type === category && i.buyPrice !== undefined);
  
  if (items.length === 0) {
    embed.setDescription(`Nenhum item disponível em **${category}** no momento.`);
    return embed;
  }

  const cat = SHOP_CATEGORIES.find(c => c.id === category);
  embed.setTitle(`🛒 Loja — ${cat?.label ?? category}`);

  // Monta a vitrine (Limitado a 15 para não estourar o limite do Embed do Discord)
  const lines = items.slice(0, 15).map(i =>
    `${RARITY_EMOJI[i.rarity] || '⬜'} ${i.emoji} **${i.name}** — 💰 **${i.buyPrice?.toLocaleString('pt-BR')} G**\n` +
    `> *${i.description}*`
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
  // Puxa todos os itens da categoria escolhida que possuem um preço de compra (buyPrice)
  const items = Object.values(ITEMS).filter(i => i.type === category && i.buyPrice !== undefined);
  
  if (items.length === 0) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:loja_comprar')
      .setPlaceholder('Selecione o item para comprar...')
      .addOptions(
        // Discord limita Select Menus a 25 opções
        items.slice(0, 25).map(i =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${i.name} — ${i.buyPrice} 💰`)
            .setValue(i.id)
            .setEmoji(i.emoji.trim())
            .setDescription(`${i.rarity.toUpperCase()} | ${i.description.substring(0, 50)}...`)
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
