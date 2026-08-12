import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { CRAFT_RECIPES, getItem } from '../constants/items';
import { prisma } from '../../database/client'; // Importação do Prisma adicionada!

export function buildForjaEmbed(char: FullCharacter, userInventory: { itemId: string; quantity: number }[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('⚒️ Forja da Aliança')
    .setDescription('Bem-vindo à forja! Aqui você pode usar materiais de monstros e minérios para criar equipamentos poderosos.')
    .setFooter({ text: `💰 Seu Ouro: ${char.gold.toLocaleString('pt-BR')} G | Nível atual: ${char.level}` });

  if (CRAFT_RECIPES.length === 0) {
    embed.addFields({ name: 'Vazio', value: 'O ferreiro não possui nenhuma receita no momento.' });
    return embed;
  }

  // Mapeia o inventário para facilitar a busca rápida
  const invMap = new Map<string, number>();
  for (const inv of userInventory) {
    invMap.set(inv.itemId, inv.quantity);
  }

  for (const recipe of CRAFT_RECIPES) {
    const outputItem = getItem(recipe.outputItem);
    if (!outputItem) continue;

    const hasLevel = char.level >= recipe.minLevel;
    const levelIcon = hasLevel ? '✅' : '❌';

    const hasGold = char.gold >= recipe.costGold;
    const goldIcon = hasGold ? '✅' : '❌';

    let ingredientsText = '';
    let canCraft = hasLevel && hasGold;

    for (const ing of recipe.ingredients) {
      const ingData = getItem(ing.itemId);
      const ingName = ingData ? `${ingData.emoji} ${ingData.name}` : ing.itemId;
      const playerHas = invMap.get(ing.itemId) || 0;
      
      const hasIng = playerHas >= ing.qty;
      if (!hasIng) canCraft = false;

      ingredientsText += `> ${hasIng ? '✅' : '❌'} ${ingName}: **${playerHas}/${ing.qty}**\n`;
    }

    const title = `${outputItem.emoji} **${outputItem.name}** ${canCraft ? '*(Pronto para forjar)*' : ''}`;
    const desc = `Requisito: Nv. ${recipe.minLevel} ${levelIcon} | Custo: 💰 ${recipe.costGold} G ${goldIcon}\n**Ingredientes:**\n${ingredientsText}`;

    embed.addFields({ name: title, value: desc, inline: false });
  }

  return embed;
}

export function buildForjaSelect(char: FullCharacter): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const availableRecipes = CRAFT_RECIPES.filter(r => char.level >= r.minLevel);
  
  if (availableRecipes.length === 0) return null;

  const select = new StringSelectMenuBuilder()
    .setCustomId('rpg_select:forja_craftar')
    .setPlaceholder('Escolha um equipamento para forjar...')
    .addOptions(
      availableRecipes.map(recipe => {
        const item = getItem(recipe.outputItem);
        return new StringSelectMenuOptionBuilder()
          .setLabel(`Forjar: ${item?.name || recipe.outputItem}`)
          .setValue(recipe.id)
          .setDescription(`Custo: ${recipe.costGold} Ouro | Tempo: ${recipe.craftTimeMin} min`)
          .setEmoji(item?.emoji || '⚒️');
      })
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export function buildForjaButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('◀ Voltar à Cidade').setStyle(ButtonStyle.Secondary)
  );
}

// ==========================================
// FUNÇÃO DE CRAFT ADICIONADA (O que faltava pro Handler!)
// ==========================================
export async function craftItem(discordId: string, recipeId: string): Promise<{ success: boolean; message: string }> {
  const char = await prisma.rpgCharacter.findUnique({ where: { discordId } });
  if (!char) return { success: false, message: 'Personagem não encontrado.' };

  const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return { success: false, message: 'Receita não encontrada na forja.' };

  // Verificações Básicas (Ouro e Nível)
  if (char.level < recipe.minLevel) return { success: false, message: `Você precisa ser nível ${recipe.minLevel} para forjar isso.` };
  if (char.gold < recipe.costGold) return { success: false, message: `Você não tem ouro suficiente. A forja custa ${recipe.costGold} G.` };

  // Pega o inventário do jogador
  const inventory = await prisma.rpgInventoryItem.findMany({ 
    where: { characterId: discordId, quantity: { gt: 0 } } 
  });
  
  const invMap = new Map<string, number>();
  for (const item of inventory) invMap.set(item.itemId, item.quantity);

  // Verifica se o jogador tem TODOS os ingredientes necessários
  for (const ing of recipe.ingredients) {
    const playerHas = invMap.get(ing.itemId) || 0;
    if (playerHas < ing.qty) {
      const itemData = getItem(ing.itemId);
      return { success: false, message: `Faltam materiais! Você precisa de mais ${itemData?.name || ing.itemId}.` };
    }
  }

  // TRANSAÇÃO: Se chegou aqui, tem tudo! Vamos descontar os itens, o ouro e entregar o item pronto.
  const txs: any[] = [];
  
  // 1. Tira o ouro
  txs.push(prisma.rpgCharacter.update({
    where: { discordId },
    data: { gold: { decrement: recipe.costGold } }
  }));

  // 2. Tira os ingredientes
  for (const ing of recipe.ingredients) {
    txs.push(prisma.rpgInventoryItem.update({
      where: { characterId_itemId: { characterId: discordId, itemId: ing.itemId } },
      data: { quantity: { decrement: ing.qty } }
    }));
  }

  // 3. Entrega a Arma / Equipamento forjado
  txs.push(prisma.rpgInventoryItem.upsert({
    where: { characterId_itemId: { characterId: discordId, itemId: recipe.outputItem } },
    update: { quantity: { increment: recipe.outputQty } },
    create: { characterId: discordId, itemId: recipe.outputItem, quantity: recipe.outputQty }
  }));

  // Executa todas as ações de uma vez no banco de dados
  await prisma.$transaction(txs);

  // Limpa possíveis itens que ficaram com quantidade zero ou negativa após o craft
  await prisma.rpgInventoryItem.deleteMany({
    where: { characterId: discordId, quantity: { lte: 0 } }
  });

  const craftedInfo = getItem(recipe.outputItem);
  return { success: true, message: `Você bateu o martelo na bigorna com sucesso! Forjou **1x ${craftedInfo?.name || recipe.outputItem}**!` };
}
