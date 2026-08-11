// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE PERFIL RPG — Limpo com Imagem em Canvas & Funções Auxiliares
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter, ComputedStats } from '../services/character';
import { getClass } from '../constants/classes';

// ─── Embed limpo (sem repetição de campos por texto) ──────────────────────────

export function buildProfileEmbed(char: FullCharacter, stats: ComputedStats): EmbedBuilder {
  const cls = getClass(char.class);

  return new EmbedBuilder()
    .setColor(cls?.color ?? 0x5865F2)
    .setTitle(`⚔️ Perfil de Aventureiro — ${char.username}`)
    .setFooter({ text: '⚔️ Aliança Skyline RPG • Use os botões abaixo para interagir' })
    .setTimestamp();
}

export async function buildProfileEmbedAsync(char: FullCharacter, stats: ComputedStats): Promise<EmbedBuilder> {
  return buildProfileEmbed(char, stats);
}

// ─── Botões e Menus do perfil ──────────────────────────────────────────────────

export function buildProfileButtons(char: FullCharacter): ActionRowBuilder<any>[] {
  const pontosOptionLabel = char.statPoints > 0 ? `⭐ Distribuir Pontos (${char.statPoints})` : '⭐ Distribuir Pontos';

  const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:menu_perfil')
      .setPlaceholder('📍 Navegar pelo Hub do Aventureiro...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🏰 Cidade Central').setValue('cidade').setEmoji('🏰').setDescription('Acesse lojas, curandeiro, arena e guilda'),
        new StringSelectMenuOptionBuilder().setLabel('🎒 Inventário').setValue('inventario').setEmoji('🎒').setDescription('Gerencie seus itens e equipamentos'),
        new StringSelectMenuOptionBuilder().setLabel('✨ Habilidades').setValue('habilidades').setEmoji('✨').setDescription('Veja e melhore suas habilidades'),
        new StringSelectMenuOptionBuilder().setLabel(pontosOptionLabel).setValue('pontos').setEmoji('⭐').setDescription('Atribua seus pontos de atributo acumulados'),
        new StringSelectMenuOptionBuilder().setLabel('📋 Missões Diárias').setValue('missoes').setEmoji('📋').setDescription('Verifique seu progresso de missões'),
        new StringSelectMenuOptionBuilder().setLabel('📜 Missões de Classe').setValue('missoes_classe').setEmoji('📜').setDescription('Evolua na sua classe atual'),
        new StringSelectMenuOptionBuilder().setLabel('🥊 Atividades & Treino').setValue('treinar').setEmoji('🥊').setDescription('Treine, pesque, medite ou vá à taverna'),
        new StringSelectMenuOptionBuilder().setLabel('📊 Estatísticas').setValue('stats').setEmoji('📊').setDescription('Detalhes avançados de combate')
      )
  );

  const rowAventura = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('⚔️ Dungeon').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rpg:caca').setLabel('🌲 Caçar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rpg:viajar').setLabel('🗺️ Viajar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rpg:exploracao').setLabel('🌍 Explorar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('🔄').setStyle(ButtonStyle.Secondary)
  );

  return [selectMenu, rowAventura];
}

// ─── Embed da cidade (hub central) ────────────────────────────────────────────

export function buildCidadeEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🏰 Cidade da Aliança — Hub Central')
    .setDescription(
      'O coração da Aliança Skyline. Prepare-se e embarque em novas aventuras.\n' +
      '> **Linha 1** dos botões: Loja · Curar · Forja · Missões · Boss\n' +
      '> **Linha 2** dos botões: Arena · Casar · Guilda · ◀ Voltar ao Perfil'
    )
    .addFields(
      { name: '🛒 Loja',         value: 'Equipamentos e consumíveis',         inline: true },
      { name: '🏥 Curar HP',     value: 'Restaura HP e Energia (custa ouro)', inline: true },
      { name: '⚒️ Forja',        value: 'Crie itens com materiais raros',     inline: true },
      { name: '📋 Missões',      value: 'Diárias e semanais com recompensa',  inline: true },
      { name: '🐉 Boss Mundial', value: 'Boss épico cooperativo da guilda',   inline: true },
      { name: '⚔️ Arena PvP',    value: 'Desafie outros jogadores',           inline: true },
      { name: '💍 Casamento',    value: 'Propor, aceitar ou divorciar',       inline: true },
      { name: '🏛️ Guilda',       value: 'Crie ou gerencie sua guilda',        inline: true },
    )
    .setFooter({ text: '⚔️ Aliança Skyline RPG • Use os botões abaixo para navegar' });
}

export function buildCidadeButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:loja').setLabel('🛒 Loja').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:curandeiro').setLabel('🏥 Curar HP').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rpg:forja').setLabel('⚒️ Forja').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:missoes').setLabel('📋 Missões').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:worldboss').setLabel('🐉 Boss').setStyle(ButtonStyle.Danger),
  );
}

export function buildCidadeButtons2(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:arena').setLabel('⚔️ Arena PvP').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rpg:casamento').setLabel('💍 Casar').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:guild').setLabel('🏛️ Guilda').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
  );
}

// ─── Distribuir pontos de atributo ────────────────────────────────────────────

export function buildPontosEmbed(char: FullCharacter, stats: ComputedStats): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('⭐ Distribuir Pontos de Atributo')
    .setDescription(`Você tem **${char.statPoints}** ponto(s) disponível(is) para distribuir.`)
    .addFields(
      { name: '💪 FOR (Força)',        value: `${stats.str} → aumenta Ataque`,            inline: true },
      { name: '🏃 AGI (Agilidade)',    value: `${stats.agi} → aumenta Esquiva e Crítico`, inline: true },
      { name: '🧠 INT (Inteligência)', value: `${stats.int} → aumenta Magia`,             inline: true },
      { name: '❤️ VIT (Vitalidade)',   value: `${stats.vit} → aumenta HP`,                inline: true },
      { name: '🍀 SOR (Sorte)',        value: `${stats.lck} → aumenta Sorte/Ouro`,        inline: true },
    )
    .setFooter({ text: 'Selecione o atributo e a quantidade' });
}

export function buildPontosSelect(statPoints: number): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:distribuir_stat')
      .setPlaceholder('Escolha o atributo para adicionar 1 ponto')
      .setDisabled(statPoints === 0)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('💪 Força (FOR)').setValue('strength').setDescription('Aumenta ataque físico'),
        new StringSelectMenuOptionBuilder().setLabel('🏃 Agilidade (AGI)').setValue('agility').setDescription('Aumenta esquiva e crítico'),
        new StringSelectMenuOptionBuilder().setLabel('🧠 Inteligência (INT)').setValue('intelligence').setDescription('Aumenta poder mágico'),
        new StringSelectMenuOptionBuilder().setLabel('❤️ Vitalidade (VIT)').setValue('vitality').setDescription('Aumenta HP máximo'),
        new StringSelectMenuOptionBuilder().setLabel('🍀 Sorte (SOR)').setValue('luck').setDescription('Aumenta sorte e ouro'),
      )
  );
}
