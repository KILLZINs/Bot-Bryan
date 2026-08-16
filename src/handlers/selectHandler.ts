import { StringSelectMenuInteraction } from 'discord.js';

export async function handleSelect(interaction: StringSelectMenuInteraction) {
  const { customId } = interaction;

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: SELEÇÃO DE CLASSE INICIAL (/rpg start)
  // ═══════════════════════════════════════════════════════════════════════
  if (customId === 'rpg_select:escolher_classe') {
    await interaction.deferReply({ ephemeral: true });

    const selectedValue = interaction.values[0];
    const [, classId] = selectedValue.split(':');

    const { getCharacter, createCharacter } = await import('../rpg/services/character');
    const existing = await getCharacter(interaction.user.id);

    if (existing) {
      return interaction.editReply({ content: '❌ Você já possui um personagem ativo!' });
    }

    try {
      await createCharacter(interaction.user.id, interaction.user.username, classId);
      return interaction.editReply({ content: `✅ Personagem criado com sucesso! Você agora é um aventureiro da classe **${classId.toUpperCase()}**. Use \`/rpg perfil\` para ver seus status.` });
    } catch (err) {
      console.error('Erro ao criar personagem via select:', err);
      return interaction.editReply({ content: '❌ Ocorreu um erro ao criar seu personagem. Tente novamente mais tarde.' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: NAVEGAÇÃO DO PERFIL (/rpg perfil)
  // ═══════════════════════════════════════════════════════════════════════
  if (customId === 'rpg_select:menu_perfil' || customId === 'rpg_select:menu_atividades') {
    await interaction.deferReply({ ephemeral: true });
    const action = interaction.values[0];

    return interaction.editReply({ content: `🛠️ Módulo \`${action}\` em desenvolvimento. Aguarde as próximas atualizações da Aliança Skyline!` });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLER: LOJA DE COSMÉTICOS (Títulos e Fundos)
  // ═══════════════════════════════════════════════════════════════════════
  if (customId === 'rpg_select:comprar_cosmetico' || customId === 'rpg_select:comprar_cosmetico_bg') {
    await interaction.deferReply({ ephemeral: true });

    const isBg = customId === 'rpg_select:comprar_cosmetico_bg';
    const selectedValue = interaction.values[0]; 
    const [, itemId] = selectedValue.split(':');

    const { COSMETIC_TITLES, COSMETIC_BACKGROUNDS } = await import('../rpg/constants/cosmetics');
    const { getCharacter } = await import('../rpg/services/character');
    const { prisma } = await import('../database/client');

    const char = await getCharacter(interaction.user.id);
    if (!char) {
      return interaction.editReply({ content: '❌ Você ainda não tem um personagem. Use `/rpg start`.' });
    }

    const item = isBg ? COSMETIC_BACKGROUNDS[itemId] : COSMETIC_TITLES[itemId];
    if (!item) return interaction.editReply({ content: '❌ Item não encontrado na loja.' });

    const ownedList = isBg 
      ? (char.unlockedBackgrounds ? char.unlockedBackgrounds.split(',') : [])
      : (char.unlockedTitles ? char.unlockedTitles.split(',') : []);

    const isEquipped = isBg ? char.activeBackground === itemId : char.activeTitle === itemId;
    const isOwned = ownedList.includes(itemId);

    // Ação 1: Desequipar
    if (isEquipped) {
      await prisma.rpgCharacter.update({
        where: { discordId: interaction.user.id },
        data: isBg ? { activeBackground: null } : { activeTitle: null }
      });
      return interaction.editReply({ content: `✅ Você desequipou o ${isBg ? 'fundo' : 'título'} **${item.name || (item as any).label}**.` });
    }

    // Ação 2: Equipar (se já possui)
    if (isOwned) {
      await prisma.rpgCharacter.update({
        where: { discordId: interaction.user.id },
        data: isBg ? { activeBackground: itemId } : { activeTitle: itemId }
      });
      return interaction.editReply({ content: `✨ Você equipou o ${isBg ? 'fundo' : 'título'} **${item.name || (item as any).label}**! Veja seu \`/rpg perfil\`.` });
    }

    // Ação 3: Comprar
    if (char.gold < item.price) {
      return interaction.editReply({ content: `❌ Você não tem Ouro suficiente! Custa **${item.price.toLocaleString('pt-BR')}**, mas você só tem **${char.gold.toLocaleString('pt-BR')}**.` });
    }

    ownedList.push(itemId);
    const newOwnedString = ownedList.join(',');

    await prisma.rpgCharacter.update({
      where: { discordId: interaction.user.id },
      data: {
        gold: { decrement: item.price },
        ...(isBg 
          ? { unlockedBackgrounds: newOwnedString, activeBackground: itemId } 
          : { unlockedTitles: newOwnedString, activeTitle: itemId })
      }
    });

    return interaction.editReply({ content: `🛍️ Compra realizada com sucesso! Você comprou e equipou **${item.name || (item as any).label}** por ${item.price.toLocaleString('pt-BR')} Ouro!` });
  }

  // Fallback
  if (!interaction.deferred && !interaction.replied) {
    await interaction.reply({ content: 'Ação não reconhecida.', ephemeral: true });
  }
}
