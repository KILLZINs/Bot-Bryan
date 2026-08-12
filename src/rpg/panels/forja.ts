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

    // Verifica se o jogador tem nível
    const hasLevel = char.level >= recipe.minLevel;
    const levelIcon = hasLevel ? '✅' : '❌';

    // Verifica se o jogador tem ouro
    const hasGold = char.gold >= recipe.costGold;
    const goldIcon = hasGold ? '✅' : '❌';

    // Monta a lista de ingredientes
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
  // Filtra as receitas para mostrar apenas as que o jogador tem o NÍVEL mínimo para ver/tentar fazer
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
