// ═══════════════════════════════════════════════════════════════════════
// COMANDO /rpg loja_cosmeticos — Estúdio de Cosméticos
// ═══════════════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { Command } from '../../types';
import { getOrCreateCharacter } from '../../rpg/services/character';
import { TITLE_LIST, BACKGROUND_LIST } from '../../rpg/constants/cosmetics';

export default {
  category: 'rpg',
  data: new SlashCommandBuilder()
    .setName('rpg_loja_cosmeticos')
    .setDescription('🛍️ Estúdio de Cosméticos: Compre Títulos e Fundos Épicos!'),

  async execute(interaction: ChatInputCommandInteraction) {
    // 1. Setup inicial e Defer (Efémero para não poluir o chat geral)
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // 2. Busca o personagem e seus dados cosméticos
    const char = await getOrCreateCharacter(discordId, username);
    const ownedTitles = char.unlockedTitles ? char.unlockedTitles.split(',') : [];
    const ownedBgs = char.unlockedBackgrounds ? char.unlockedBackgrounds.split(',') : [];

    // 3. Monta o Embed do Catálogo
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31) // Cor Dark de Embed (Discord nativo)
      .setTitle('🛍️ Estúdio de Cosméticos - Aliança Skyline')
      .setDescription(
        'Personalize seu perfil! Gaste seu Ouro para brilhar na Aliança.\n\n' +
        'Use os menus abaixo para navegar entre **🏷️ Títulos Estéticos** e **🎨 Fundos de Perfil**.'
      )
      .addFields(
        { name: '💰 Saldo Atual', value: `${char.gold.toLocaleString('pt-BR')} Ouro`, inline: true },
        { name: '🏷️ Títulos Salvos', value: `${ownedTitles.length}`, inline: true },
        { name: '🎨 Fundos Salvos', value: `${ownedBgs.length}`, inline: true },
      )
      .setFooter({ text: 'Aliança Skyline • Vaidade é poder' });

    // ═══════════════════════════════════════════════════════════════════════
    // MENU 1: TÍTULOS ESTÉTICOS
    // ═══════════════════════════════════════════════════════════════════════
    const titleSelect = new StringSelectMenuBuilder()
      .setCustomId('rpg_select:comprar_cosmetico') // Handler genérico de compra
      .setPlaceholder('Selecione um Título para comprar/equipar...');

    TITLE_LIST.forEach(title => {
      const isOwned = ownedTitles.includes(title.id);
      const isEquipped = char.activeTitle === title.id;
      
      let label = title.label;
      if (isEquipped) label += ' [EQUIPADO]';
      else if (isOwned) label += ' [COMPRADO]';
      else label += ` (💰 ${title.price.toLocaleString('pt-BR')})`;

      titleSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(`title:${title.id}`) // Prefixo para diferenciar no handler
          .setEmoji('🏷️')
          .setDefault(isEquipped) // Deixa o equipado como padrão
      );
    });

    // ═══════════════════════════════════════════════════════════════════════
    // MENU 2: FUNDOS DE PERFIL
    // ═══════════════════════════════════════════════════════════════════════
    const bgSelect = new StringSelectMenuBuilder()
      .setCustomId('rpg_select:comprar_cosmetico_bg') // Handler separado para BG
      .setPlaceholder('Selecione um Fundo de Perfil...');

    BACKGROUND_LIST.forEach(bg => {
      const isOwned = ownedBgs.includes(bg.id);
      const isEquipped = char.activeBackground === bg.id;

      let label = bg.name;
      if (isEquipped) label += ' [EQUIPADO]';
      else if (isOwned) label += ' [COMPRADO]';
      else label += ` (💰 ${bg.price.toLocaleString('pt-BR')})`;

      // Vibe minimalista: se for só cor, a gente avisa
      const desc = bg.url.startsWith('color:') ? 'Paleta de Cor Minimalista' : 'Cenário Tático Ilustrado';

      bgSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(`bg:${bg.id}`)
          .setEmoji('🎨')
          .setDescription(desc.substring(0, 100))
          .setDefault(isEquipped)
      );
    });

    // 4. Combina os componentes e envia
    const rowTitles = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(titleSelect);
    const rowBgs = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(bgSelect);

    await interaction.editReply({ embeds: [embed], components: [rowTitles, rowBgs] });
  },
} satisfies Command;
