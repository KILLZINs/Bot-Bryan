// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE PERFIL RPG — replica a imagem fornecida
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter, computeStats, hpBar, xpBar, ComputedStats } from '../services/character';
import { getClass, karmaLabel, rpgXpForLevel } from '../constants/classes';
import { getItem, SLOT_NAME, SLOT_EMOJI } from '../constants/items';
import { getLocation, ENV_EMOJI } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';
import { getMarriage, getPartner } from '../services/marriage';
import { isDungeonOnCooldown, isTravelOnCooldown } from '../services/combat';

// ─── Embed de perfil principal ─────────────────────────────────────────────

export async function buildProfileEmbedAsync(char: FullCharacter, stats: ComputedStats): Promise<EmbedBuilder> {
  const cls = getClass(char.class);
  const loc = getLocation(char.currentLocation);
  const envLabel = ENV_EMOJI[char.environment] ?? char.environment;
  const eq = char.equipment;
  const cooldowns = buildCooldownText(char);

  // Habilidade divina
  let divineText = '*Nenhuma habilidade divina ainda*';
  if (char.divineSkillId) {
    const ds = DIVINE_SKILLS[char.divineSkillId];
    if (ds) {
      divineText = `${ds.emoji} **${ds.name}** [Rank ${char.divineSkillRank}]\n*${ds.description}*`;
    }
  }

  // Casamento
  const marriage = await getMarriage(char.discordId);
  let marriageText = '💔 *Solteiro(a)*';
  if (marriage) {
    const partnerId = getPartner(marriage, char.discordId);
    const daysTogether = Math.floor((Date.now() - marriage.marriedAt.getTime()) / 86400000);
    marriageText = `💍 <@${partnerId}> — ${daysTogether} dia(s) juntos`;
  }

  // Slots de equipamento (visual)
  const slotDisplay = (itemId: string | null | undefined, slotName: string) => {
    if (!itemId) return `\`${slotName.padEnd(7)}\` ──`;
    const item = getItem(itemId);
    return `\`${slotName.padEnd(7)}\` ${item?.emoji ?? '❓'} ${item?.name ?? itemId}`;
  };

  const embed = new EmbedBuilder()
    .setColor(cls?.color ?? 0x5865F2)
    .setTitle(`${cls?.emoji ?? '⚔️'} ${char.username} — Nível ${char.level} ${cls?.name ?? char.class}`)
    .setDescription(
      [
        `> "*${cls?.name ?? char.class}*" • Karma: **${karmaLabel(char.karma)}** • GEN. ${char.generation}`,
        '',
        `${xpBarDisplay(char)} **${char.xp}/${rpgXpForLevel(char.level)} XP** (${Math.round(char.xp/rpgXpForLevel(char.level)*100)}%)`,
        `❤️ HP:     ${hpBar(char.currentHp, stats.maxHp)}  **${char.currentHp}/${stats.maxHp}**`,
        `⚡ Energia: ${hpBar(char.currentEnergy, stats.maxEnergy)}  **${char.currentEnergy}/${stats.maxEnergy}**`,
      ].join('\n')
    )
    .addFields(
      {
        name: '📍 Localização',
        value: `${loc.emoji} **${loc.name}**\n${envLabel}`,
        inline: true,
      },
      {
        name: '⚔️ Poder de Combate',
        value: `# ${stats.combatPower.toLocaleString('pt-BR')}`,
        inline: true,
      },
      {
        name: '💰 Ouro',
        value: `**${char.gold.toLocaleString('pt-BR')}**`,
        inline: true,
      },
      {
        name: '📊 Atributos de Combate',
        value: [
          `\`FOR\` **${stats.str}**   \`AGI\` **${stats.agi}**   \`INT\` **${stats.int}**   \`VIT\` **${stats.vit}**   \`SOR\` **${stats.lck}**`,
          '',
          `⚔️ Ataque:  **${stats.attack}**     🛡️ Defesa: **${stats.defense}**`,
          `💥 Crítico: **${stats.critChance.toFixed(1)}%**   💨 Esquiva: **${stats.dodgeChance.toFixed(1)}%**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '🎽 Equipamento Atual',
        value: eq ? [
          slotDisplay(eq.helmet,  '⛑️ Elmo'),
          slotDisplay(eq.weapon,  '⚔️ Arma'),
          slotDisplay(eq.shield,  '🛡️ Escudo'),
          slotDisplay(eq.pants,   '👖 Calças'),
          slotDisplay(eq.boots,   '👟 Botas'),
          slotDisplay(eq.gloves,  '🧤 Luvas'),
          slotDisplay(eq.ring,    '💍 Anel'),
          slotDisplay(eq.backpack,'🎒 Mochila'),
          slotDisplay(eq.pet,     '🐾 Pet'),
        ].join('\n') : '*Sem equipamento*',
        inline: true,
      },
      {
        name: '✨ Habilidade Divina',
        value: divineText,
        inline: false,
      },
      {
        name: '💍 Relacionamento',
        value: marriageText,
        inline: true,
      },
      {
        name: '📈 Histórico de Batalhas',
        value: [
          `🏆 Vitórias: **${char.totalWins}**   💀 Mortes: **${char.totalDeaths}**`,
          `⚔️ PvP: **${char.pvpWins}W/${char.pvpLosses}L**   👹 Bosses: **${char.bossKills}**`,
        ].join('\n'),
        inline: true,
      },
      { name: '⏱️ Cooldowns RPG', value: cooldowns, inline: false },
    )
    .setFooter({ text: `⚔️ Aliança Skyline RPG • Desde: ${char.createdAt.toISOString().slice(0,10)}` })
    .setTimestamp();

  return embed;
}

// Versão síncrona mantida para compatibilidade (sem casamento)
export function buildProfileEmbed(char: FullCharacter, stats: ComputedStats): EmbedBuilder {
  const cls = getClass(char.class);
  const loc = getLocation(char.currentLocation);
  const envLabel = ENV_EMOJI[char.environment] ?? char.environment;
  const eq = char.equipment;
  const cooldowns = buildCooldownText(char);

  let divineText = '*Nenhuma habilidade divina ainda*';
  if (char.divineSkillId) {
    const ds = DIVINE_SKILLS[char.divineSkillId];
    if (ds) divineText = `${ds.emoji} **${ds.name}** [Rank ${char.divineSkillRank}]\n*${ds.description}*`;
  }

  const slotDisplay = (itemId: string | null | undefined, slotName: string) => {
    if (!itemId) return `\`${slotName.padEnd(7)}\` ──`;
    const item = getItem(itemId);
    return `\`${slotName.padEnd(7)}\` ${item?.emoji ?? '❓'} ${item?.name ?? itemId}`;
  };

  return new EmbedBuilder()
    .setColor(cls?.color ?? 0x5865F2)
    .setTitle(`${cls?.emoji ?? '⚔️'} ${char.username} — Nível ${char.level} ${cls?.name ?? char.class}`)
    .setDescription(
      [
        `> "*${cls?.name ?? char.class}*" • Karma: **${karmaLabel(char.karma)}** • GEN. ${char.generation}`,
        '',
        `${xpBarDisplay(char)} **${char.xp}/${rpgXpForLevel(char.level)} XP** (${Math.round(char.xp/rpgXpForLevel(char.level)*100)}%)`,
        `❤️ HP:     ${hpBar(char.currentHp, stats.maxHp)}  **${char.currentHp}/${stats.maxHp}**`,
        `⚡ Energia: ${hpBar(char.currentEnergy, stats.maxEnergy)}  **${char.currentEnergy}/${stats.maxEnergy}**`,
      ].join('\n')
    )
    .addFields(
      { name: '📍 Localização', value: `${loc.emoji} **${loc.name}**\n${envLabel}`, inline: true },
      { name: '⚔️ Poder de Combate', value: `# ${stats.combatPower.toLocaleString('pt-BR')}`, inline: true },
      { name: '💰 Ouro', value: `**${char.gold.toLocaleString('pt-BR')}**`, inline: true },
      {
        name: '📊 Atributos de Combate',
        value: [
          `\`FOR\` **${stats.str}**   \`AGI\` **${stats.agi}**   \`INT\` **${stats.int}**   \`VIT\` **${stats.vit}**   \`SOR\` **${stats.lck}**`,
          `⚔️ Ataque:  **${stats.attack}**     🛡️ Defesa: **${stats.defense}**`,
          `💥 Crítico: **${stats.critChance.toFixed(1)}%**   💨 Esquiva: **${stats.dodgeChance.toFixed(1)}%**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '🎽 Equipamento Atual',
        value: eq ? [
          slotDisplay(eq.helmet,'⛑️ Elmo'), slotDisplay(eq.weapon,'⚔️ Arma'),
          slotDisplay(eq.shield,'🛡️ Escudo'), slotDisplay(eq.pants,'👖 Calças'),
          slotDisplay(eq.boots,'👟 Botas'), slotDisplay(eq.gloves,'🧤 Luvas'),
          slotDisplay(eq.ring,'💍 Anel'), slotDisplay(eq.backpack,'🎒 Mochila'),
          slotDisplay(eq.pet,'🐾 Pet'),
        ].join('\n') : '*Sem equipamento*',
        inline: true,
      },
      { name: '✨ Habilidade Divina', value: divineText, inline: false },
      {
        name: '📈 Histórico de Batalhas',
        value: [
          `🏆 Vitórias: **${char.totalWins}**   💀 Mortes: **${char.totalDeaths}**`,
          `⚔️ PvP: **${char.pvpWins}W/${char.pvpLosses}L**   👹 Bosses: **${char.bossKills}**`,
        ].join('\n'),
        inline: false,
      },
      { name: '⏱️ Cooldowns RPG', value: cooldowns, inline: false },
    )
    .setFooter({ text: `⚔️ Aliança Skyline RPG • Desde: ${char.createdAt.toISOString().slice(0,10)}` })
    .setTimestamp();
}

// ─── Botões do perfil ──────────────────────────────────────────────────────────

export function buildProfileButtons(char: FullCharacter): ActionRowBuilder<ButtonBuilder>[] {
  // ── Linha 1: Aventura — ações principais de combate e mundo ──────────────────
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('⚔️ Dungeon').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rpg:caca').setLabel('🌲 Caçar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rpg:viajar').setLabel('🗺️ Viajar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rpg:exploracao').setLabel('🌍 Explorar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
  );

  // ── Linha 2: Personagem — gerenciamento do personagem ────────────────────────
  const pontosLabel = char.statPoints > 0 ? `⭐ Pontos (${char.statPoints}) ←` : '⭐ Pontos';
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏰 Cidade').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:inventario').setLabel('🎒 Inventário').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:habilidades').setLabel('✨ Habilidades').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('rpg:pontos')
      .setLabel(pontosLabel)
      .setStyle(char.statPoints > 0 ? ButtonStyle.Danger : ButtonStyle.Secondary)
      .setDisabled(char.statPoints === 0),
    new ButtonBuilder().setCustomId('rpg:stats').setLabel('📊 Estatísticas').setStyle(ButtonStyle.Secondary),
  );

  // ── Linha 3: Missões — quests e progressão de classe ─────────────────────────
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:missoes').setLabel('📋 Missões').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:missoes_classe').setLabel('📜 Missões de Classe').setStyle(ButtonStyle.Primary),
  );

  // ── Linha 4: Atividades — treinamento e lazer ─────────────────────────────────
  const isMeditating = !!(char as any).meditatingUntil && new Date((char as any).meditatingUntil) > new Date();
  const meditaReady  = !!(char as any).meditatingUntil && new Date((char as any).meditatingUntil) <= new Date();
  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rpg:meditar')
      .setLabel(meditaReady ? '🪷 Coletar Meditação' : isMeditating ? '🧘 Meditando...' : '🧘 Meditar')
      .setStyle(meditaReady ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:treinar').setLabel('🥊 Treinar').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:taverna').setLabel('🍺 Taverna').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:pescaria').setLabel('🎣 Pescar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:eventos').setLabel('🌎 Eventos').setStyle(ButtonStyle.Primary),
  );

  return [row1, row2, row3, row4];
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
      { name: '⚔️ Arena PvP',    value: 'Desafie outros jogadores',            inline: true },
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

// ─── Helper barra de XP ───────────────────────────────────────────────────────

function xpBarDisplay(char: FullCharacter): string {
  const needed = rpgXpForLevel(char.level);
  const pct = Math.min(1, char.xp / needed);
  const filled = Math.round(pct * 10);
  return '`' + '█'.repeat(filled) + '░'.repeat(10 - filled) + '`';
}

function formatCooldown(date: Date | null | undefined, minutes: number): string {
  if (!date) return '🟢 Pronto';
  const remaining = minutes * 60_000 - (Date.now() - date.getTime());
  if (remaining <= 0) return '🟢 Pronto';
  const totalSeconds = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `🔴 ${mins > 0 ? `${mins}m ` : ''}${secs}s`;
}

function buildCooldownText(char: FullCharacter): string {
  const travel = getLocation(char.currentLocation).travelCooldownMin;
  const meditation = formatCooldown(char.lastRest, 30);
  return [
    `⚔️ Dungeon: **${formatCooldown(char.lastDungeon, 5)}**`,
    `🌲 Caçada: **🟢 Sem cooldown**`,
    `🗺️ Viagem: **${formatCooldown(char.lastTravel, travel)}**`,
    `🌍 Exploração: **${formatCooldown(char.lastExplore, 3)}**`,
    `🥊 Treino: **${formatCooldown(char.lastTrain, 20)}**`,
    `🎣 Pesca: **${formatCooldown(char.lastFishing, 10)}**`,
    `🧘 Meditação: **${meditation}**`,
    `⚔️ PvP: **${formatCooldown(char.lastPvp, 10)}**`,
  ].join('  •  ');
}
