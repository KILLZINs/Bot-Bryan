import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter, computeStats, hpBar, addRpgXp } from '../services/character';
import { LOCATIONS, getLocation } from '../constants/locations';
import { getEnemiesForLocation, getBossesForLocation, getEnemy } from '../constants/enemies';
import { getDungeonType } from '../constants/dungeon-types';
import { getItem } from '../constants/items';
import {
  isDungeonOnCooldown, CombatBlockedError, type CombatMode,
  type CombatAction, type CombatTurn, startInteractiveCombat, takeCombatAction,
} from '../services/combat';
import { applyTemplate } from '../../utils/embedTemplates';
import { prisma } from '../../database/client';

// ==========================================
// ESTADO DAS EXPEDIÇÕES (Crawler em Memória)
// ==========================================
export interface DungeonRun {
  discordId: string;
  locationId: string;
  currentFloor: number;
  maxFloors: number;
  dungeonTypeId?: string;
  logs: string[];
}

export const activeExpeditions = new Map<string, DungeonRun>();

export async function startExpedition(char: FullCharacter, locationId: string, dungeonTypeId?: string) {
  if (char.currentHp <= 0) return { success: false, error: 'Você precisa curar seu HP antes de uma expedição!' };
  
  if (char.currentEnergy < 20) return { success: false, error: 'Uma expedição exige pelo menos **20⚡** de Energia para iniciar.' };

  const run: DungeonRun = {
    discordId: char.discordId,
    locationId,
    dungeonTypeId,
    currentFloor: 1,
    maxFloors: 5,
    logs: ['🗺️ **Expedição Iniciada!** Os pesados portões se fecham atrás de você...']
  };

  activeExpeditions.set(char.discordId, run);
  
  // ⚡ CORREÇÃO DO DESYNC VISUAL: Atualiza o objeto da memória instantaneamente
  char.currentEnergy -= 20;

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: { 
        currentEnergy: { decrement: 20 },
        lastDungeon: new Date()
    }
  });

  return { success: true, run };
}

// ==========================================
// 1. TELA DA ENTRADA DA DUNGEON
// ==========================================
export function buildDungeonEmbed(char: FullCharacter): EmbedBuilder {
  const loc = getLocation(char.currentLocation);
  const stats = computeStats(char);

  if (loc.isSafeZone) {
    return new EmbedBuilder().setColor(0xE74C3C).setTitle('⚔️ Expedições').setDescription(`Você está em uma **zona segura** (${loc.name}).\nViaje para uma região hostil primeiro!`).setFooter({ text: '⚔️ Use 🗺️ Viajar para escolher uma região com expedição.' });
  }

  if (!loc.hasDungeon) {
    return new EmbedBuilder().setColor(0xE74C3C).setTitle('⚔️ Expedições').setDescription(`${loc.name} não possui labirintos. Tente outra região!`);
  }

  const enemies = getEnemiesForLocation(loc.id, char.level);
  const bosses  = getBossesForLocation(loc.id).filter(b => char.level >= b.minLevel);
  const cd = isDungeonOnCooldown(char, 5);

  const enemyList = enemies.slice(0, 5).map(e => `${e.emoji} **${e.name}**`).join('\n') || '*Nenhum inimigo conhecido no seu nível.*';
  const bossList  = bosses.length > 0 ? bosses.map(b => `${b.emoji} **${b.name}** [BOSS]`).join('\n') : '*Nenhum boss disponível*';
  
  // Impede o HP de estourar visualmente
  const displayHp = Math.min(char.currentHp, stats.maxHp);
  const hpPct = stats.maxHp > 0 ? displayHp / stats.maxHp : 1;

  const embed = new EmbedBuilder()
    .setColor(hpPct < 0.3 ? 0xFF6B35 : 0x8E44AD)
    .setTitle(`⚔️ Expedições — ${loc.emoji} ${loc.name}`);

  if (hpPct < 0.3) embed.addFields({ name: '⚠️ HP CRÍTICO — Cuidado!', value: 'Vá à **🏰 Cidade → 🏥 Curar HP** antes de adentrar.', inline: false });

  embed.addFields(
    { name: '📖 Como funciona?', value: 'Dungeons agora são Expedições contínuas! Você passará por salas de combates ou eventos aleatórios até a câmara do Boss. *Se fugir ou morrer no caminho, perderá o progresso.*', inline: false },
    { name: '👹 Ameaças', value: enemyList, inline: true },
    { name: '💀 Guardiões', value: bossList, inline: true },
    { name: '🔮 Tipos Especiais', value: '> Use o **menu abaixo** para escolher um tipo de dungeon (Fogo, Gelo, Sombra, etc) para receber multiplicadores absurdos de Ouro/XP no final!', inline: false },
    { name: '❤️ HP', value: `${hpBar(displayHp, stats.maxHp)} **${displayHp}/${stats.maxHp}**`, inline: true },
    { name: '⚡ Energia', value: `**${char.currentEnergy}/${stats.maxEnergy}** (Custo da Expedição: 20⚡)`, inline: true },
    { name: '⏱️ Cooldown', value: cd.onCooldown ? `🔴 ${cd.remaining}` : '🟢 Pronto!', inline: true },
  );

  return embed.setFooter({ text: '⚔️ Adentre a Expedição para iniciar a exploração!' });
}

export function buildDungeonSelect(char: FullCharacter): ActionRowBuilder<StringSelectMenuBuilder> | null {
  return null;
}

export function buildDungeonButtons(char: FullCharacter): ActionRowBuilder<ButtonBuilder> {
  const loc = getLocation(char.currentLocation);
  const cd = isDungeonOnCooldown(char, 5);
  const hasEnemies = getEnemiesForLocation(loc.id, char.level).length > 0 || getBossesForLocation(loc.id).filter(b => char.level >= b.minLevel).length > 0;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`rpg:crawl:start`).setLabel('🚪 Adentrar Expedição').setStyle(ButtonStyle.Danger).setDisabled(!hasEnemies || cd.onCooldown || char.currentHp <= 0),
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏰 Cidade').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
  );
}

// ==========================================
// 2. TELA DE DENTRO DA DUNGEON (O Crawler)
// ==========================================
export function buildDungeonCrawlerEmbed(char: FullCharacter, run: DungeonRun) {
  const loc = LOCATIONS[run.locationId];
  const stats = computeStats(char);
  const displayHp = Math.min(char.currentHp, stats.maxHp);
  let title = `🗺️ Expedição: ${loc?.name} — Andar ${run.currentFloor}/${run.maxFloors}`;
  
  const embed = new EmbedBuilder().setColor(0x2C3E50);

  if (run.dungeonTypeId) {
    const dType = getDungeonType(run.dungeonTypeId);
    if (dType) {
      title = `🗺️ ${dType.emoji} Expedição ${dType.name}: ${loc?.name} — Andar ${run.currentFloor}/${run.maxFloors}`;
      embed.setFooter({ text: `Efeito Ativo: ${dType.specialEffect}` });
    }
  }

  embed.setTitle(title).setDescription(run.logs.slice(-4).join('\n\n'))
    .addFields(
      { name: '❤️ HP', value: `${displayHp}/${stats.maxHp}`, inline: true },
      { name: '⚡ Energia', value: `${char.currentEnergy}/${stats.maxEnergy}`, inline: true }
    );

  const row = new ActionRowBuilder<ButtonBuilder>();

  if (run.currentFloor >= run.maxFloors) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`rpg:crawl:boss`).setLabel('Enfrentar Boss').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
      new ButtonBuilder().setCustomId('rpg:crawl:flee').setLabel('Fugir Covardemente').setStyle(ButtonStyle.Secondary)
    );
  } else if (run.currentFloor % 2 === 0) {
    row.addComponents(new ButtonBuilder().setCustomId('rpg:crawl:event').setLabel('Avançar (Evento)').setStyle(ButtonStyle.Primary).setEmoji('🔍'));
  } else {
    row.addComponents(
      new ButtonBuilder().setCustomId('rpg:crawl:fight').setLabel('Lutar (Inimigo Comum)').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
      new ButtonBuilder().setCustomId('rpg:crawl:flee').setLabel('Fugir para a Cidade').setStyle(ButtonStyle.Secondary)
    );
  }

  return { embeds: [embed], components: [row] };
}

export async function processRandomDungeonEvent(char: FullCharacter, run: DungeonRun) {
  const events = [
    { type: 'heal', text: '✨ Você encontrou uma **Fonte de Cristal**! Bebendo da água, você recupera parte das forças.' },
    { type: 'trap', text: '💥 **Armadilha!** Dardos disparam da parede e machucam você.' },
    { type: 'treasure', text: '💰 Um aventureiro caído segurava uma bolsa... Você saqueou **Ouro**.' },
    { type: 'nothing', text: '🦇 O corredor está silencioso e lúgubre. Você avança cautelosamente.' }
  ];

  const roll = events[Math.floor(Math.random() * events.length)];
  run.logs.push(`**Sala ${run.currentFloor}:** ${roll.text}`);
  run.currentFloor++;

  const stats = computeStats(char);
  if (roll.type === 'heal') {
    await prisma.rpgCharacter.update({ where: { discordId: char.discordId }, data: { currentHp: Math.min(stats.maxHp, char.currentHp + Math.floor(stats.maxHp * 0.25)) } });
  } else if (roll.type === 'trap') {
    await prisma.rpgCharacter.update({ where: { discordId: char.discordId }, data: { currentHp: Math.max(1, char.currentHp - Math.floor(stats.maxHp * 0.15)) } });
  } else if (roll.type === 'treasure') {
    await prisma.rpgCharacter.update({ where: { discordId: char.discordId }, data: { gold: { increment: 150 } } });
  }
  return run;
}

// ==========================================
// 3. RECOMPENSA FINAL DA EXPEDIÇÃO!
// ==========================================
export async function finishExpedition(char: FullCharacter, run: DungeonRun) {
  let xpBonus = Math.floor(char.level * 45);
  let goldBonus = Math.floor(char.level * 25);
  let title = '🏆 Expedição Concluída!';
  let desc = 'Você limpou a masmorra, derrotou o Guardião e retornou à cidade em segurança com seus saques!\n\n**Bônus de Conclusão:**';
  
  if (run.dungeonTypeId) {
    const dType = getDungeonType(run.dungeonTypeId);
    if (dType) {
      title = `🏆 Expedição ${dType.name} Concluída!`;
      xpBonus = Math.floor(char.level * 100 * dType.xpMult);
      goldBonus = Math.floor(char.level * 60 * dType.goldMult);
      desc = `Você sobreviveu à fúria da ${dType.name}!\n\n${dType.specialEffect}\n\n**Bônus de Conclusão Ampliado:**`;
    }
  }

  await prisma.rpgCharacter.update({ where: { discordId: char.discordId }, data: { gold: { increment: goldBonus } } });
  await addRpgXp(char, xpBonus, { currentHp: char.currentHp, currentEnergy: char.currentEnergy });

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F).setTitle(title).setDescription(desc)
    .addFields({ name: '⭐ XP Bônus', value: `+${xpBonus}`, inline: true }, { name: '💰 Ouro Bônus', value: `+${goldBonus}`, inline: true });

  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('Explorar Outra').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rpg:cidade').setLabel('Voltar à Cidade').setStyle(ButtonStyle.Secondary)
    )
  ];
  return { embed, rows };
}

// ==========================================
// MÓDULOS DE CAÇA MANTIDOS AQUI
// ==========================================
export function buildHuntEmbed(char: FullCharacter): EmbedBuilder {
  const loc = getLocation(char.currentLocation);
  const stats = computeStats(char);
  const displayHp = Math.min(char.currentHp, stats.maxHp);
  const enemies = getEnemiesForLocation(loc.id, char.level);
  const enemyList = enemies.slice(0, 8).map(e => `${e.emoji} **${e.name}** — ${e.xpReward} XP | ${e.goldReward.min}~${e.goldReward.max} 💰`).join('\n') || '*Nenhum monstro encontrado.*';

  return new EmbedBuilder().setColor(0x2ECC71).setTitle(`🌲 Caçada Livre — ${loc.emoji} ${loc.name}`).setDescription('Explore a região e enfrente monstros livremente.')
    .addFields(
      { name: '👹 Monstros encontrados', value: enemyList, inline: false },
      { name: '❤️ HP', value: `${hpBar(displayHp, stats.maxHp)} **${displayHp}/${stats.maxHp}**`, inline: true },
      { name: '⚡ Energia', value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true }
    );
}

export function buildHuntSelect(char: FullCharacter): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const loc = getLocation(char.currentLocation);
  const enemies = getEnemiesForLocation(loc.id, char.level);
  if (!enemies.length) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('rpg_select:caca_inimigo').setPlaceholder('Escolha um monstro...').addOptions(enemies.slice(0, 25).map(e =>
        new StringSelectMenuOptionBuilder().setLabel(e.name).setValue(e.id).setEmoji(e.emoji.trim()).setDescription(`HP: ${e.baseHp} | ATK: ${e.baseAttack}`),
    )),
  );
}

export function buildHuntButtons(hasEnemies: boolean, char: FullCharacter): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:caca_aleatoria').setLabel('🌲 Caçar Aleatório').setStyle(ButtonStyle.Success).setDisabled(!hasEnemies || char.currentHp <= 0 || char.currentEnergy < 10),
    new ButtonBuilder().setCustomId('rpg:caca').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('⚔️ Expedição').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
  );
}

// ==========================================
// COMBATE
// ==========================================
export async function doBattleRandom(char: FullCharacter, guildId?: string, mode: CombatMode = 'dungeon'): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const loc = getLocation(char.currentLocation);
  const enemies = getEnemiesForLocation(loc.id, char.level);
  if (enemies.length === 0) return { embed: new EmbedBuilder().setColor(0xE74C3C).setTitle('Sem Inimigos').setDescription('Nenhum inimigo encontrado.'), rows: [mode === 'hunt' ? buildHuntButtons(false, char) : buildDungeonButtons(char)] };
  const enemy = enemies[Math.floor(Math.random() * enemies.length)];
  
  const isExped = activeExpeditions.has(char.discordId);
  const internalMode = isExped ? 'expedition' : mode;

  let turn;
  try { turn = await startInteractiveCombat(char, enemy, guildId, internalMode); } catch (error) {
    if (error instanceof CombatBlockedError) return { embed: new EmbedBuilder().setColor(0xF39C12).setTitle('⏳ Bloqueado').setDescription(error.message), rows: [mode === 'hunt' ? buildHuntButtons(true, char) : buildDungeonButtons(char)] };
    throw error;
  }
  return buildCombatTurnEmbed(turn, char);
}

export async function doBattleEnemy(char: FullCharacter, enemyId: string, guildId?: string, mode: CombatMode = 'dungeon'): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const enemy = getEnemy(enemyId);
  if (!enemy) return { embed: new EmbedBuilder().setColor(0xE74C3C).setTitle('Erro').setDescription('Inimigo não encontrado.'), rows: [] };
  
  const isExped = activeExpeditions.has(char.discordId);
  const internalMode = isExped ? 'expedition' : mode;

  let turn;
  try { turn = await startInteractiveCombat(char, enemy, guildId, internalMode); } catch (error) {
    if (error instanceof CombatBlockedError) return { embed: new EmbedBuilder().setColor(0xF39C12).setTitle('⏳ Bloqueado').setDescription(error.message), rows: [mode === 'hunt' ? buildHuntButtons(true, char) : buildDungeonButtons(char)] };
    throw error;
  }
  return buildCombatTurnEmbed(turn, char);
}

export async function doCombatAction(discordId: string, action: CombatAction, char: FullCharacter): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const turn = await takeCombatAction(discordId, action);
  return buildCombatTurnEmbed(turn, char);
}

function buildCombatTurnEmbed(turn: CombatTurn, char: FullCharacter): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  const isExped = activeExpeditions.has(char.discordId);

  if (!turn.finished) {
    const stats = computeStats(char);
    const displayHp = Math.min(turn.playerHp, stats.maxHp);
    const hpPct = stats.maxHp > 0 ? displayHp / stats.maxHp : 0;
    const enemyPct = turn.enemyMaxHp > 0 ? turn.enemyHp / turn.enemyMaxHp : 0;
    const fullLog = turn.log.join('\n');
    const logSlice = fullLog.length > 2200 ? '...\n' + fullLog.slice(-2050) : fullLog;
    
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rpg:combate_acao:attack').setLabel('⚔️ Atacar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('rpg:combate_acao:skill').setLabel(turn.skillName ? `✨ ${turn.skillName}` : '✨ Habilidade').setStyle(ButtonStyle.Primary).setDisabled(!turn.skillReady),
      new ButtonBuilder().setCustomId('rpg:combate_acao:defend').setLabel('🛡️ Defender').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rpg:combate_acao:potion').setLabel('🧪 Poção').setStyle(ButtonStyle.Success).setDisabled(!turn.potionAvailable),
      new ButtonBuilder().setCustomId('rpg:combate_acao:flee').setLabel('🏃 Fugir').setStyle(ButtonStyle.Secondary),
    );
    
    const status = [ `❤️ Você: **${displayHp}/${stats.maxHp}**`, `👹 ${turn.enemyName}: **${turn.enemyHp}/${turn.enemyMaxHp}**`].join('  •  ');
    
    const titleText = isExped ? '⚔️ Expedição' : turn.mode === 'hunt' ? '🌲 Caçada' : '⚔️ Dungeon';
    const color = isExped ? 0xE74C3C : turn.mode === 'hunt' ? 0x2ECC71 : 0xE74C3C;

    return {
      embed: new EmbedBuilder().setColor(color).setTitle(`${titleText} — Rodada ${turn.round || 1}`).setDescription(logSlice).addFields({ name: '📊 Combate', value: status }),
      rows: [actionRow],
    };
  }
  return buildCombatResultEmbed(turn.result!, char, turn.mode);
}

function buildCombatResultEmbed(result: NonNullable<CombatTurn['result']>, char: FullCharacter, mode: CombatMode): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  const color = result.result === 'vitoria' ? 0x27AE60 : result.result === 'derrota' ? 0xE74C3C : 0xF39C12;
  const title = result.result === 'vitoria' ? '🏆 Vitória!' : result.result === 'derrota' ? '💀 Derrota!' : '💥 Empate!';
  const logSlice = result.log.join('\n').length > 1800 ? '...\n' + result.log.join('\n').slice(-1600) : result.log.join('\n');
  const stats = computeStats(char);
  const displayHp = Math.min(result.playerHpLeft, stats.maxHp);
  const hpCritical = (stats.maxHp > 0 ? displayHp / stats.maxHp : 0) < 0.3 && displayHp > 0;

  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(logSlice)
    .addFields({ name: '⭐ XP', value: `+${result.xpGained}`, inline: true }, { name: '💰 Ouro', value: `+${result.goldGained}`, inline: true });

  if (result.itemsDropped.length > 0) {
    const dropText = result.itemsDropped.map(id => { const item = getItem(id); return item ? `${item.emoji} **${item.name}**` : id; }).join('  •  ');
    embed.addFields({ name: `🎁 Itens!`, value: dropText });
  }

  const isExpedition = activeExpeditions.has(char.discordId);
  let continueBtn: ButtonBuilder;

  if (isExpedition && result.result === 'vitoria') {
      const run = activeExpeditions.get(char.discordId)!;
      run.currentFloor++;
      if (run.currentFloor > run.maxFloors) {
          continueBtn = new ButtonBuilder().setCustomId('rpg:crawl:finish').setLabel('🏆 Resgatar Recompensas!').setStyle(ButtonStyle.Success);
      } else {
          continueBtn = new ButtonBuilder().setCustomId('rpg:crawl:continue').setLabel('🚪 Avançar na Expedição').setStyle(ButtonStyle.Success);
      }
  } else {
      if (isExpedition) activeExpeditions.delete(char.discordId);
      
      const isHunt = mode === 'hunt' && !isExpedition; 
      
      continueBtn = new ButtonBuilder()
        .setCustomId(isHunt ? 'rpg:caca_aleatoria' : 'rpg:dungeon')
        .setLabel(isHunt ? '🌲 Caçar Novamente' : 'Voltar à Entrada')
        .setStyle(isHunt ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(result.playerHpLeft <= 0);
  }

  const combatBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
    continueBtn,
    ...(hpCritical && !isExpedition ? [new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏥 Ir se Curar!').setStyle(ButtonStyle.Success)] : []),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('👤 Perfil').setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [combatBtns] };
}
