import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { CRAFT_RECIPES, getItem } from '../constants/items';
import { getInventory } from '../services/inventory';
import { prisma } from '../../database/client';

export function buildForjaEmbed(char: FullCharacter): { embed: EmbedBuilder; select: ActionRowBuilder<StringSelectMenuBuilder> | null } {
  const available = CRAFT_RECIPES.filter(r => char.level >= r.minLevel);

  const lines = available.map(r => {
    const out = getItem(r.outputItem);
    const ingr = r.ingredients.map(i => `${i.qty}x ${getItem(i.itemId)?.name ?? i.itemId}`).join(', ');
    return `${out?.emoji ?? '❓'} **${out?.name ?? r.outputItem}** ×${r.outputQty}\n> 📦 ${ingr} | ⏱️ ${r.craftTimeMin}min`;
  }).join('\n\n') || '*Nenhuma receita disponível no seu nível.*';

  const embed = new EmbedBuilder()
    .setColor(0x795548)
    .setTitle('⚒️ Forja')
    .setDescription('Combine materiais para criar equipamentos e consumíveis poderosos!')
    .addFields({ name: '📋 Receitas Disponíveis', value: lines })
    .setFooter({ text: `Nível ${char.level} | ⚒️ Aliança Skyline RPG` });

  const select = available.length > 0
    ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rpg_select:forja_receita')
          .setPlaceholder('Selecione a receita para fabricar...')
          .addOptions(
            available.slice(0, 25).map(r => {
              const out = getItem(r.outputItem);
              return new StringSelectMenuOptionBuilder()
                .setLabel(`${out?.name ?? r.outputItem} ×${r.outputQty}`)
                .setValue(r.id)
                .setEmoji((out?.emoji ?? '⚒️').trim())
                .setDescription(`${r.craftTimeMin}min | Nv.${r.minLevel}+`)
            })
          )
      )
    : null;

  return { embed, select };
}

export async function craftItem(discordId: string, recipeId: string): Promise<{ success: boolean; message: string }> {
  const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return { success: false, message: 'Receita inválida.' };

  const char = await prisma.rpgCharacter.findUnique({ where: { discordId } });
  if (!char) return { success: false, message: 'Personagem não encontrado.' };
  if (char.level < recipe.minLevel) return { success: false, message: `Precisa ser nível **${recipe.minLevel}** para esta receita.` };

  // Verificar ingredientes
  const inv = await prisma.rpgInventoryItem.findMany({ where: { characterId: discordId } });
  const invMap = new Map(inv.map(i => [i.itemId, i.quantity]));

  for (const ingr of recipe.ingredients) {
    const qty = invMap.get(ingr.itemId) ?? 0;
    if (qty < ingr.qty) {
      const item = getItem(ingr.itemId);
      return { success: false, message: `Ingrediente insuficiente: **${ingr.qty}x ${item?.name ?? ingr.itemId}** (você tem ${qty}).` };
    }
  }

  // Consumir ingredientes
  for (const ingr of recipe.ingredients) {
    const current = invMap.get(ingr.itemId) ?? 0;
    if (current <= ingr.qty) {
      await prisma.rpgInventoryItem.delete({ where: { characterId_itemId: { characterId: discordId, itemId: ingr.itemId } } });
    } else {
      await prisma.rpgInventoryItem.update({
        where: { characterId_itemId: { characterId: discordId, itemId: ingr.itemId } },
        data: { quantity: { decrement: ingr.qty } },
      });
    }
  }

  // Dar o item craftado
  await prisma.rpgInventoryItem.upsert({
    where: { characterId_itemId: { characterId: discordId, itemId: recipe.outputItem } },
    update: { quantity: { increment: recipe.outputQty } },
    create: { characterId: discordId, itemId: recipe.outputItem, quantity: recipe.outputQty },
  });

  const out = getItem(recipe.outputItem);
  return { success: true, message: `⚒️ Fabricou **${recipe.outputQty}x ${out?.emoji ?? ''} ${out?.name ?? recipe.outputItem}** com sucesso!` };
}
