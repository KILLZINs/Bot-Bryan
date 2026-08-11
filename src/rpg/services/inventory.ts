// ═══════════════════════════════════════════════════════════════════════
// SERVIÇO DE INVENTÁRIO
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';
import { getItem, SLOT_NAME } from '../constants/items';
import { getCharacter, computeStats } from './character';
import { addTempBuff } from './temp-buffs';

export async function getInventory(discordId: string) {
  return prisma.rpgInventoryItem.findMany({
    where: { characterId: discordId },
    orderBy: { itemId: 'asc' },
  });
}

export async function equipItem(discordId: string, itemId: string): Promise<{ success: boolean; message: string }> {
  const item = getItem(itemId);
  if (!item) return { success: false, message: 'Item não encontrado.' };
  if (item.maxStack !== 1) return { success: false, message: 'Esse item não pode ser equipado.' };

  const char = await getCharacter(discordId);
  if (!char) return { success: false, message: 'Personagem não encontrado.' };
  if (char.level < item.minLevel) return { success: false, message: `Precisa ser nível **${item.minLevel}** para equipar esse item.` };

  // verificar restrição de classe
  if (item.classRestriction && !item.classRestriction.includes(char.class)) {
    return { success: false, message: `Apenas ${item.classRestriction.join(', ')} podem usar este item.` };
  }

  const slot = item.slot as keyof typeof char.equipment;
  const eq = char.equipment;
  if (!eq) return { success: false, message: 'Equipamento não inicializado.' };

  const equipped = await prisma.$transaction(async (tx) => {
    const hasItem = await tx.rpgInventoryItem.updateMany({
      where: { characterId: discordId, itemId, quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    if (hasItem.count === 0) return false;

    const equipment = await tx.rpgEquipment.findUnique({ where: { characterId: discordId } });
    const currentEquipped = equipment?.[slot as keyof typeof equipment] as string | null | undefined;
    if (currentEquipped) {
      await tx.rpgInventoryItem.upsert({
        where: { characterId_itemId: { characterId: discordId, itemId: currentEquipped } },
        update: { quantity: { increment: 1 } },
        create: { characterId: discordId, itemId: currentEquipped, quantity: 1 },
      });
    }

    await tx.rpgEquipment.update({
      where: { characterId: discordId },
      data: { [slot]: itemId },
    });

    await tx.rpgInventoryItem.deleteMany({
      where: { characterId: discordId, itemId, quantity: { lte: 0 } },
    });
    return true;
  });
  if (!equipped) return { success: false, message: 'Você não tem esse item no inventário.' };

  return { success: true, message: `✅ **${item.name}** ${item.emoji} equipado no slot **${SLOT_NAME[item.slot]}**!` };
}

export async function unequipItem(discordId: string, slot: string): Promise<{ success: boolean; message: string }> {
  const allowedSlots = ['weapon', 'helmet', 'pants', 'boots', 'gloves', 'shield', 'ring', 'amulet', 'backpack', 'pet'];
  if (!allowedSlots.includes(slot)) return { success: false, message: 'Slot de equipamento inválido.' };
  const char = await getCharacter(discordId);
  if (!char?.equipment) return { success: false, message: 'Personagem não encontrado.' };

  const eq = char.equipment as any;
  const itemId = eq[slot] as string | null;
  if (!itemId) return { success: false, message: `Nenhum item equipado no slot **${SLOT_NAME[slot] ?? slot}**.` };

  const item = getItem(itemId);

  const removed = await prisma.$transaction(async tx => {
    const equipment = await tx.rpgEquipment.findUnique({ where: { characterId: discordId } });
    const currentItemId = equipment?.[slot as keyof typeof equipment] as string | null | undefined;
    if (!currentItemId) return false;
    await tx.rpgEquipment.update({ where: { characterId: discordId }, data: { [slot]: null } });
    await tx.rpgInventoryItem.upsert({
      where: { characterId_itemId: { characterId: discordId, itemId: currentItemId } },
      update: { quantity: { increment: 1 } },
      create: { characterId: discordId, itemId: currentItemId, quantity: 1 },
    });
    return true;
  });
  if (!removed) return { success: false, message: 'O equipamento já foi alterado. Atualize seu inventário.' };

  return { success: true, message: `✅ **${item?.name ?? itemId}** removido do slot **${SLOT_NAME[slot] ?? slot}**.` };
}

export async function useConsumable(discordId: string, itemId: string): Promise<{ success: boolean; message: string }> {
  const item = getItem(itemId);
  if (!item || item.slot !== 'consumable') return { success: false, message: 'Item não é consumível.' };

  const char = await getCharacter(discordId);
  if (!char) return { success: false, message: 'Personagem não encontrado.' };
  const stats = computeStats(char);

  let resultMsg = '';
  const updates: any = {};

  if (item.stats.hp) {
    const heal = item.id === 'pocao_de_vida_g' ? stats.maxHp - char.currentHp : Math.min(item.stats.hp, stats.maxHp - char.currentHp);
    updates.currentHp = { increment: heal };
    resultMsg = `❤️ Restaurou **${heal} HP**!`;
  } else if (item.stats.energy) {
    const en = Math.min(item.stats.energy, stats.maxEnergy - char.currentEnergy);
    updates.currentEnergy = { increment: en };
    resultMsg = `⚡ Restaurou **${en} Energia**!`;
  } else if (item.id === 'elixir_de_xp') {
    await addTempBuff(discordId, 'xp_pct', 1, 60 * 60_000, 'elixir_de_xp', 'XP dobrado por 1 hora');
    resultMsg = '💜 Elixir ativado! Você receberá **2x XP por 1 hora**.';
  } else if (item.id === 'pergaminho_de_tele') {
    updates.currentLocation = 'cidade_inicial';
    updates.lastTravel = null;
    resultMsg = `📜 Teletransportado para a **Cidade da Aliança**!`;
  } else {
    resultMsg = `Usou **${item.name}**. ${item.effect ?? ''}`;
  }

  const consumed = await prisma.$transaction(async tx => {
    const invItem = await tx.rpgInventoryItem.findUnique({
      where: { characterId_itemId: { characterId: discordId, itemId } },
    });
    if (!invItem || invItem.quantity < 1) return false;
    if (Object.keys(updates).length > 0) {
      await tx.rpgCharacter.update({ where: { discordId }, data: updates });
    }
    if (invItem.quantity <= 1) {
      await tx.rpgInventoryItem.delete({ where: { characterId_itemId: { characterId: discordId, itemId } } });
    } else {
      await tx.rpgInventoryItem.update({
        where: { characterId_itemId: { characterId: discordId, itemId } },
        data: { quantity: { decrement: 1 } },
      });
    }
    return true;
  });
  if (!consumed) return { success: false, message: 'Você não tem esse item disponível.' };

  return { success: true, message: `${item.emoji} ${resultMsg}` };
}

export async function sellItem(discordId: string, itemId: string, qty: number = 1): Promise<{ success: boolean; message: string }> {
  const item = getItem(itemId);
  if (!item) return { success: false, message: 'Item não encontrado.' };
  if (!Number.isInteger(qty) || qty <= 0) return { success: false, message: 'A quantidade deve ser um número inteiro positivo.' };

  const totalGold = item.sellPrice * qty;
  const sold = await prisma.$transaction(async tx => {
    const changed = await tx.rpgInventoryItem.updateMany({
      where: { characterId: discordId, itemId, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
    if (changed.count === 0) return false;
    await tx.rpgCharacter.update({ where: { discordId }, data: { gold: { increment: totalGold } } });
    await tx.rpgInventoryItem.deleteMany({ where: { characterId: discordId, itemId, quantity: { lte: 0 } } });
    return true;
  });
  if (!sold) return { success: false, message: `Você não tem **${qty}x ${item.name}** suficientes.` };

  return { success: true, message: `💰 Vendeu **${qty}x ${item.name}** por **${totalGold} ouro**!` };
}

export async function buyItem(discordId: string, itemId: string, qty: number = 1): Promise<{ success: boolean; message: string }> {
  const item = getItem(itemId);
  if (!item || item.price === 0) return { success: false, message: 'Este item não está disponível na loja.' };
  if (!Number.isInteger(qty) || qty <= 0) return { success: false, message: 'A quantidade deve ser um número inteiro positivo.' };
  if (item.maxStack === 1 && qty > 1) return { success: false, message: 'Esse item só pode ser comprado um por vez.' };

  const char = await getCharacter(discordId);
  if (!char) return { success: false, message: 'Personagem não encontrado.' };

  const totalCost = item.price * qty;

  if (char.level < item.minLevel) return { success: false, message: `Precisa ser nível **${item.minLevel}** para comprar este item.` };

  const bought = await prisma.$transaction(async tx => {
    const charged = await tx.rpgCharacter.updateMany({
      where: { discordId, gold: { gte: totalCost } },
      data: { gold: { decrement: totalCost } },
    });
    if (charged.count === 0) return false;
    await tx.rpgInventoryItem.upsert({
      where: { characterId_itemId: { characterId: discordId, itemId } },
      update: { quantity: { increment: qty } },
      create: { characterId: discordId, itemId, quantity: qty },
    });
    return true;
  });
  if (!bought) return { success: false, message: `Ouro insuficiente! Precisa de **${totalCost}**.` };

  return { success: true, message: `${item.emoji} Comprou **${qty}x ${item.name}** por **${totalCost} ouro**!` };
}
