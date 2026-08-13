import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { FullCharacter } from '../services/character';
import { ITEM_LIST, ItemSlot, SLOT_NAME, SLOT_EMOJI } from '../constants/items';

export function buildShopEmbed(char: FullCharacter, category?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🛒 Loja da Aliança')
    .setFooter({ text: `💰 Seu ouro: ${char.gold.toLocaleString('pt-BR')} G` });

  if (!category) {
    embed.setDescription('Bem-vindo ao mercado da cidade! Temos armas, poções e muito mais.\n\nSelecione uma categoria no menu abaixo para ver os itens disponíveis.');
    return embed;
  }

  // 🔧 CORREÇÃO DO BUG: Filtra para NÃO mostrar itens de preço 0 (Lendários, Boss drops, etc)
  const items = ITEM_LIST.filter(i => (i.slot === category || i.type === category) && i.price > 0)
    .sort((a, b) => a.price - b.price);

  embed.setTitle(`🛒 Loja — ${SLOT_EMOJI[category] ?? ''} ${SLOT_NAME[category] ?? category}`);

  if (items.length === 0) {
    embed.setDescription('*O mercador não tem itens dessa categoria no estoque hoje.*');
    return embed;
  }

  const itemsText = items.map(i => {
    return `${i.emoji} **${i.name}** — 💰 **${i.price} G**\n*${i.description}*`;
  }).join('\n\n');

  embed.setDescription(itemsText.length > 4000 ? itemsText.slice(0, 4000) + '...' : itemsText);
  return embed;
}

export function buildShopCategorySelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('loja_categoria')
      .setPlaceholder('Navegar nas prateleiras...')
      .addOptions([
        { label: 'Armas', value: 'weapon', emoji: '⚔️' },
        { label: 'Elmos', value: 'helmet', emoji: '⛑️' },
        { label: 'Calças', value: 'pants', emoji: '👖' },
        { label: 'Botas', value: 'boots', emoji: '👟' },
        { label: 'Luvas', value: 'gloves', emoji: '🧤' },
        { label: 'Escudos', value: 'shield', emoji: '🛡️' },
        { label: 'Anéis', value: 'ring', emoji: '💍' },
        { label: 'Amuletos', value: 'amulet', emoji: '🔮' },
        { label: 'Mochilas', value: 'backpack', emoji: '🎒' },
        { label: 'Pets', value: 'pet', emoji: '🐾' },
        { label: 'Consumíveis', value: 'consumable', emoji: '🧪' },
        { label: 'Materiais', value: 'material', emoji: '🪨' },
      ])
  );
}

export function buildShopItemSelect(char: FullCharacter, category: string): ActionRowBuilder<StringSelectMenuBuilder> | null {
  // 🔧 CORREÇÃO DO BUG: Oculta itens de preço 0 também no dropdown!
  const items = ITEM_LIST.filter(i => (i.slot === category || i.type === category) && i.price > 0)
    .sort((a, b) => a.price - b.price);

  if (items.length === 0) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:loja_comprar')
      .setPlaceholder('Escolher item para comprar...')
      .addOptions(
        items.slice(0, 25).map(i => new StringSelectMenuOptionBuilder()
          .setLabel(i.name)
          .setValue(i.id)
          .setDescription(`Custo: ${i.price} G | Req: Nv.${i.minLevel}`)
          .setEmoji(i.emoji.trim() || '📦')
        )
      )
  );
}

export function buildShopButtons(category?: string): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (category) {
    row.addComponents(new ButtonBuilder().setCustomId('rpg:loja').setLabel('🛒 Voltar às Categorias').setStyle(ButtonStyle.Primary));
  }
  row.addComponents(new ButtonBuilder().setCustomId('rpg:cidade').setLabel('◀ Sair da Loja').setStyle(ButtonStyle.Secondary));
  return row;
}
