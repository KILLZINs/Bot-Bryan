import { prisma } from '../../database/client';
import { ITEMS } from '../constants/items';

// ==========================================
// COMPRAR ITEM DA LOJA
// ==========================================
export async function buyItem(discordId: string, itemId: string, quantity: number = 1): Promise<{ success: boolean; message: string }> {
  const item = ITEMS[itemId];
  
  if (!item) return { success: false, message: 'Item não existe no armazém.' };
  if (!item.buyPrice) return { success: false, message: 'Este item é exclusivo e não está à venda.' };

  const totalCost = item.buyPrice * quantity;

  const char = await prisma.rpgCharacter.findUnique({
    where: { discordId },
  });

  if (!char) return { success: false, message: 'Personagem não encontrado.' };
  if (char.gold < totalCost) return { success: false, message: `Ouro insuficiente. Você precisa de ${totalCost}G e possui apenas ${char.gold}G.` };

  // Transação atômica: Desconta o dinheiro E cria/soma o item no inventário
  await prisma.$transaction([
    prisma.rpgCharacter.update({
      where: { discordId },
      data: { gold: { decrement: totalCost } },
    }),
    prisma.rpgInventoryItem.upsert({
      where: {
        characterId_itemId: { characterId: discordId, itemId }
      },
      update: { quantity: { increment: quantity } },
      create: { characterId: discordId, itemId, quantity },
    })
  ]);

  return { success: true, message: `Você comprou **${quantity}x ${item.emoji} ${item.name}** por ${totalCost}G!` };
}

// ==========================================
// VENDER ITEM DO INVENTÁRIO (Loot de Caça)
// ==========================================
export async function sellItem(discordId: string, itemId: string, quantity: number = 1): Promise<{ success: boolean; message: string }> {
  const item = ITEMS[itemId];
  if (!item) return { success: false, message: 'Item desconhecido.' };
  if (item.sellPrice <= 0) return { success: false, message: 'Este item não tem valor comercial.' };

  const invItem = await prisma.rpgInventoryItem.findUnique({
    where: { characterId_itemId: { characterId: discordId, itemId } }
  });

  if (!invItem || invItem.quantity < quantity) {
    return { success: false, message: `Você não tem ${quantity}x desse item na bolsa.` };
  }

  const totalProfit = item.sellPrice * quantity;

  await prisma.$transaction([
    prisma.rpgCharacter.update({
      where: { discordId },
      data: { gold: { increment: totalProfit } },
    }),
    invItem.quantity === quantity 
      ? prisma.rpgInventoryItem.delete({ where: { id: invItem.id } })
      : prisma.rpgInventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { decrement: quantity } }
        })
  ]);

  return { success: true, message: `Você lucrou 💰 **${totalProfit}G** vendendo ${quantity}x ${item.name}.` };
}
