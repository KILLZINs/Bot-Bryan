import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter, computeStats, hpBar } from '../services/character';
import { LOCATIONS, getLocation } from '../constants/locations';
import { getEnemiesForLocation, getBossesForLocation, getEnemy } from '../constants/enemies';
import { getItem } from '../constants/items';
import {
  isDungeonOnCooldown,
  CombatBlockedError,
  type CombatMode,
  type CombatAction,
  type CombatTurn,
  startInteractiveCombat,
  takeCombatAction,
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
  logs: string[];
}

export const activeExpeditions = new Map<string, DungeonRun>();

export async function startExpedition(char: FullCharacter, locationId: string) {
  if (char.currentHp <= 0) return { success: false, error: 'Você precisa curar seu HP antes de uma expedição!' };
  if (char.currentEnergy < 10) return { success: false, error: 'Uma expedição exige pelo menos 10⚡ de Energia para iniciar.' };

  const run: DungeonRun = {
    discordId: char.discordId,
    locationId,
    currentFloor: 1,
    maxFloors: 5, // 4 Salas de Trânsito + 1 Boss Final
    logs: ['🗺️ **Expedição Iniciada!** Os pesados portões se fecham atrás de você...']
  };

  activeExpeditions.set(char.discordId, run);
  return { success: true, run };
}

// ==========================================
// 1. TELA DA ENTRADA DA DUNGEON
// ==========================================
export function buildDungeonEmbed(char: FullCharacter): EmbedBuilder {
  const loc = getLocation(char.currentLocation);
  const stats = computeStats(char);

  if (loc.isSafeZone) {
    return new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('⚔️ Expedições')
      .setDescription(`Você está em uma **zona segura** (${loc.name}).\nViaje para uma região hostil primeiro!`)
      .setFooter({ text: '⚔️ Use 🗺️ Viajar para escolher uma região com expedição.' });
  }

  if (!loc.hasDungeon) {
    return new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('⚔️ Expedições')
      .setDescription(`${loc.name} não possui labirintos. Tente outra região!`);
  }

  const enemies = getEnemiesForLocation(loc.id, char.level);
  const bosses  = getBossesForLocation(loc.id).filter(b => char.level >= b.minLevel);
  const cd = isDungeonOnCooldown(char, 5); // 5 min cooldown

  const enemyList = enemies.slice(0, 5).map(e => `${e.emoji} **${e.name}**`).join('\n') || '*Nenhum inimigo conhecido no seu nível.*';
  const bossList  = bosses.length > 0
    ? bosses.map(b => `${b.emoji} **${b.name}** [BOSS]`).join('\n')
    : '*Nenhum boss disponível (Nível insuficiente)*';

  const hpPct = stats.maxHp > 0 ? char.currentHp / stats.maxHp : 1;
  const hpDisplay = `${hpBar(char.currentHp, stats.maxHp)} **${char.currentHp}/${stats.maxHp}**${hpPct < 0.3 ? ' ⚠️' : ''}`;

  const embed = new EmbedBuilder()
    .setColor(hpPct < 0.3 ? 0xFF6B35 : 0x8E44AD)
    .setTitle(`⚔️ Expedições — ${loc.emoji} ${loc.name}`);

  if (hpPct < 0.3) {
    embed.addFields({ name: '⚠️ HP CRÍTICO — Cuidado!', value: 'Seu HP está muito baixo. Considere ir à **🏰 Cidade → 🏥 Curar HP** antes de adentrar.', inline: false });
  }

  embed.addFields(
    { name: '📖 Como funciona?', value: 'Dungeons agora são Expedições contínuas! Você passará por salas de combates ou eventos aleatórios até a câmara do Boss.\n*Se fugir ou morrer no caminho, perderá o progresso e sairá da dungeon.*', inline: false },
    { name: '👹 Ameaças da Região', value: enemyList, inline: true },
    { name: '💀 Guardiões', value: bossList, inline: true },
    { name: '🔮 Tipos Especiais', value: '> Use o **menu abaixo** para escolher um tipo especial com bônus de XP/Ouro (Fogo, Gelo, Sombra, Trovão, Abissal) antes de entrar!', inline: false },
    { name: '❤️ HP', value: hpDisplay, inline: true },
    { name: '⚡ Energia', value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true },
    { name: '⏱️ Cooldown', value: cd.onCooldown ? `🔴 ${cd.remaining}` : '🟢 Pronto!', inline: true },
  );

  return embed.setFooter({ text: '⚔️ Adentre a Expedição para iniciar a exploração!' });
}

export function buildDungeonSelect(char: FullCharacter): ActionRowBuilder<StringSelectMenuBuilder> | null {
  return null; // O Crawler não precisa de seleção de inimigo na entrada
}

export function buildDungeonButtons(char: FullCharacter): ActionRowBuilder<ButtonBuilder> {
  const loc = getLocation(char.currentLocation);
  const cd = isDungeonOnCooldown(char, 5);
  const enemies = getEnemiesForLocation(loc.id, char.level);
  const bosses  = getBossesForLocation(loc.id).filter(b => char.level >= b.minLevel);
  const hasEnemies = enemies.length > 0 || bosses.length > 0;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`rpg_crawl:start_${loc.id}`).setLabel('🚪 Adentrar Expedição').setStyle(ButtonStyle.Danger).setDisabled(!hasEnemies || cd.onCooldown || char.currentHp <= 0),
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
  
  const embed = new EmbedBuilder()
    .setColor(0x2C3E50)
    .setTitle(`🗺️ Expedição: ${loc?.name} — Andar ${run.currentFloor}/${run.maxFloors}`)
    .setDescription(run.logs.slice(-4).join('\n\n'))
    .addFields(
      { name: '❤️ HP', value: `${char.currentHp}/${stats.maxHp}`, inline: true },
      { name: '⚡ Energia', value: `${char.currentEnergy}/${stats.maxEnergy}`, inline: true }
    );

  const row = new ActionRowBuilder<ButtonBuilder>();

  // SALA FINAL: BOSS
  if (run.currentFloor >= run.maxFloors) {
    const bosses = getBossesForLocation(run.locationId, char.level);
    const boss = bosses.length > 0 ? bosses[Math.floor(Math.random() * bosses.length)] : null;
    
    embed.addFields({ name: '⚠️ AMEAÇA DETECTADA', value: `O chão treme. A câmara final abriga o terrível **${boss?.name || 'Guardião Sombrio'}**!` });
    
    row.addComponents(
      new ButtonBuilder().setCustomId(`rpg_crawl:boss`).setLabel('Enfrentar Boss').setStyle(ButtonStyle.Danger).setEmoji('⚔️').setDisabled(!boss),
      new ButtonBuilder().setCustomId('rpg_crawl:flee').setLabel('Fugir Covardemente').setStyle(ButtonStyle.Secondary)
    );
  } 
  // SALAS PARES: EVENTOS (Sala 2 e 4)
  else if (run.currentFloor % 2 === 0) {
    row.addComponents(
      new ButtonBuilder().setCustomId('rpg_crawl:event').setLabel('Avançar (Evento)').setStyle(ButtonStyle.Primary).setEmoji('🔍')
    );
  } 
  // SALAS ÍMPARES: COMBATE (Sala 1 e 3)
  else {
    row.addComponents(
      new ButtonBuilder().setCustomId('rpg_crawl:fight').setLabel('Lutar (Inimigo Comum)').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
      new ButtonBuilder().setCustomId('rpg_crawl:flee').setLabel('Fugir para a Cidade').setStyle(ButtonStyle.Secondary)
    );
  }

  return { embeds: [embed], components: [row] };
}

export async function processRandomDungeonEvent(char: FullCharacter, run: DungeonRun) {
  const events = [
    { type: 'heal', text: '✨ Você encontrou uma **Fonte de Cristal**! Bebendo da água, você recupera parte das forças.' },
    { type: 'trap', text: '💥 **Armadilha!** Dardos disparam da parede e machucam você gravemente.' },
    { type: 'treasure', text: '💰 Um aventureiro caído segurava uma bolsa rasgada... Você saqueou **Ouro**.' },
    { type: 'nothing', text: '🦇 O corredor está silencioso e lúgubre. Você avança cautelosamente.' }
  ];

  const roll = events[Math.floor(Math.random() * events.length)];
  run.logs.push(`**Sala ${run.currentFloor}:** ${roll.text}`);
  run.currentFloor++;

  const stats = computeStats(char);

  if (roll.type === 'heal') {
    const healAmt = Math.floor(stats.maxHp * 0.25);
    await prisma.rpgCharacter.update({
      where: { discordId: char.discordId },
      data: { currentHp: Math.min(stats.maxHp, char.currentHp + healAmt) }
    });
  } else if (roll.type === 'trap') {
    const dmgAmt = Math.floor(stats.maxHp * 0.15);
    await prisma.rpgCharacter.update({
      where: { discordId: char.discordId },
      data: { currentHp: Math.max(1, char.currentHp - dmgAmt) }
    });
  } else if (roll.type === 'treasure') {
    await prisma.rpgCharacter.update({
      where: { discordId: char.discordId },
      data: { gold: { increment: 150 } }
    });
  }
  return run;
}

// ==========================================
// MÓDULOS DE CAÇA (MANTIDOS INTACTOS)
// ==========================================
export function buildHuntEmbed(char: FullCharacter): EmbedBuilder {
  const loc = getLocation(char.currentLocation);
  const stats = computeStats(char);
  const enemies = getEnemiesForLocation(loc.id, char.level);
  const enemyList = enemies.slice(0, 8)
    .map(e => `${e.emoji} **${e.name}** — ${e.xpReward} XP | ${e.goldMin}~${e.goldMax} 💰`)
    .join('\n') || '*Nenhum monstro encontrado nesta região para o seu nível.*';

  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(`🌲 Caçada Livre — ${loc.emoji} ${loc.name}`)
    .setDescription('Explore a região e enfrente monstros sem consumir o cooldown da dungeon. Cada caça ainda consome energia e pode render XP, ouro e drops.')
    .addFields(
      { name: '👹 Monstros encontrados', value: enemyList, inline: false },
      { name: '❤️ HP', value: `${hpBar(char.currentHp, stats.maxHp)} **${char.currentHp}/${stats.maxHp}**`, inline: true },
      { name: '⚡ Energia', value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true },
      { name: '⏱️ Cooldown de caça', value: '🟢 **Sem cooldown**', inline: true },
    )
    .setFooter({ text: '🌲 A dungeon tem cooldown próprio; a caça fica disponível enquanto você tiver energia.' });
}

export function buildHuntSelect(char: FullCharacter): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const loc = getLocation(char.currentLocation);
  const enemies = getEnemiesForLocation(loc.id, char.level);
  if (!enemies.length) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:caca_inimigo')
      .setPlaceholder('Escolha um monstro para caçar...')
      .addOptions(enemies.slice(0, 25).map(e =>
        new StringSelectMenuOptionBuilder()
          .setLabel(e.name)
          .setValue(e.id)
          .setEmoji(e.emoji.trim())
          .setDescription(`HP: ${e.baseHp} | ATK: ${e.baseAttack} | ${e.xpReward} XP | ${e.goldMin}~${e.goldMax}💰`),
      )),
  );
}

export function buildHuntButtons(hasEnemies: boolean, char: FullCharacter): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:caca_aleatoria').setLabel('🌲 Caçar Aleatório').setStyle(ButtonStyle.Success).setDisabled(!hasEnemies || char.currentHp <= 0 || char.currentEnergy < 10),
    new ButtonBuilder().setCustomId('rpg:caca').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('⚔️ Dungeon').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
  );
}

// ==========================================
// MÓDULOS DE COMBATE UNIVERSAIS
// ==========================================
export async function doBattleRandom(char: FullCharacter, guildId?: string, mode: CombatMode = 'dungeon'): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const loc = getLocation(char.currentLocation);
  const enemies = getEnemiesForLocation(loc.id, char.level);
  if (enemies.length === 0) {
    return {
      embed: new EmbedBuilder().setColor(0xE74C3C).setTitle('Sem Inimigos').setDescription('Nenhum inimigo encontrado aqui no seu nível.'),
      rows: [mode === 'hunt' ? buildHuntButtons(false, char) : buildDungeonButtons(char)],
    };
  }

  const enemy = enemies[Math.floor(Math.random() * enemies.length)];
  let turn;
  try {
    turn = await startInteractiveCombat(char, enemy, guildId, mode);
  } catch (error) {
    if (error instanceof CombatBlockedError) {
      return { embed: new EmbedBuilder().setColor(0xF39C12).setTitle('⏳ Batalha indisponível').setDescription(error.message), rows: [mode === 'hunt' ? buildHuntButtons(true, char) : buildDungeonButtons(char)] };
    }
    throw error;
  }
  return buildCombatTurnEmbed(turn, char);
}

export async function doBattleEnemy(char: FullCharacter, enemyId: string, guildId?: string, mode: CombatMode = 'dungeon'): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const enemy = getEnemy(enemyId);
  if (!enemy) {
    return {
      embed: new EmbedBuilder().setColor(0xE74C3C).setTitle('Erro').setDescription('Inimigo não encontrado.'),
      rows: [],
    };
  }
  const loc = getLocation(char.currentLocation);
  const allowed = [
    ...getEnemiesForLocation(loc.id, char.level),
    ...(mode === 'dungeon' ? getBossesForLocation(loc.id).filter(b => char.level >= b.minLevel) : []),
  ];
  if (!allowed.some(candidate => candidate.id === enemy.id)) {
    return {
      embed: new EmbedBuilder().setColor(0xE74C3C).setTitle('Inimigo inválido').setDescription('Esse inimigo não pode ser enfrentado nesta região ou neste nível.'),
      rows: [mode === 'hunt' ? buildHuntButtons(true, char) : buildDungeonButtons(char)],
    };
  }
  let turn;
  try {
    turn = await startInteractiveCombat(char, enemy, guildId, mode);
  } catch (error) {
    if (error instanceof CombatBlockedError) {
      return { embed: new EmbedBuilder().setColor(0xF39C12).setTitle('⏳ Batalha indisponível').setDescription(error.message), rows: [mode === 'hunt' ? buildHuntButtons(true, char) : buildDungeonButtons(char)] };
    }
    throw error;
  }
  return buildCombatTurnEmbed(turn, char);
}

export async function doCombatAction(
  discordId: string,
  action: CombatAction,
  char: FullCharacter,
): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const turn = await takeCombatAction(discordId, action);
  return buildCombatTurnEmbed(turn, char);
}

function buildCombatTurnEmbed(turn: CombatTurn, char: FullCharacter): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  if (!turn.finished) {
    const stats = computeStats(char);
    const hpPct = stats.maxHp > 0 ? turn.playerHp / stats.maxHp : 0;
    const enemyPct = turn.enemyMaxHp > 0 ? turn.enemyHp / turn.enemyMaxHp : 0;
    const fullLog = turn.log.join('\n');
    const logSlice = fullLog.length > 2200 ? '...\n' + fullLog.slice(-2050) : fullLog;
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rpg:combate_acao:attack').setLabel('⚔️ Atacar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('rpg:combate_acao:skill')
        .setLabel(turn.skillName ? `✨ ${turn.skillName}` : '✨ Habilidade')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!turn.skillReady),
      new ButtonBuilder().setCustomId('rpg:combate_acao:defend').setLabel('🛡️ Defender').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rpg:combate_acao:potion').setLabel('🧪 Poção').setStyle(ButtonStyle.Success).setDisabled(!turn.potionAvailable),
      new ButtonBuilder().setCustomId('rpg:combate_acao:flee').setLabel('🏃 Fugir').setStyle(ButtonStyle.Secondary),
    );
    const status = [
      `❤️ Você: **${turn.playerHp}/${stats.maxHp}**${hpPct < 0.3 ? ' ⚠️' : ''}`,
      `👹 ${turn.enemyName}: **${turn.enemyHp}/${turn.enemyMaxHp}**`,
      `⚡ Energia: **${turn.playerEnergy}/${stats.maxEnergy}**`,
    ].join('  •  ');
    return {
      embed: new EmbedBuilder()
        .setColor(turn.mode === 'hunt' ? 0x2ECC71 : 0xE74C3C)
        .setTitle(`${turn.mode === 'hunt' ? '🌲 Caçada' : '⚔️ Expedição'} — Rodada ${turn.round || 1}`)
        .setDescription(logSlice)
        .addFields(
          { name: '📊 Estado do combate', value: status, inline: false },
          { name: '❤️ Vida do inimigo', value: `${Math.round(enemyPct * 100)}%`, inline: true },
          { name: '🎯 Sua vez', value: 'Escolha uma ação abaixo. O inimigo responderá em seguida.', inline: true },
        ),
      rows: [actionRow],
    };
  }
  return buildCombatResultEmbed(turn.result!, char, turn.mode);
}

function buildCombatResultEmbed(result: NonNullable<CombatTurn['result']>, char: FullCharacter, mode: CombatMode): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  const color = result.result === 'vitoria' ? 0x27AE60 : result.result === 'derrota' ? 0xE74C3C : 0xF39C12;
  const title = result.result === 'vitoria' ? '🏆 Vitória!' : result.result === 'derrota' ? '💀 Derrota!' : '💥 Empate!';

  const fullLog = result.log.join('\n');
  const logSlice = fullLog.length > 1800 ? '...\n' + fullLog.slice(-1600) : fullLog;

  const stats = computeStats(char);
  const hpPct = stats.maxHp > 0 ? result.playerHpLeft / stats.maxHp : 0;
  const hpBarStr = hpBar(result.playerHpLeft, stats.maxHp);
  const hpCritical = hpPct < 0.3 && result.playerHpLeft > 0;
  const hpStatus = hpCritical ? ' ⚠️ **HP CRÍTICO!**' : (result.playerHpLeft <= 0 ? ' 💀 Derrotado' : '');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(logSlice)
    .addFields(
      { name: '⭐ XP Ganho',  value: `+**${result.xpGained}**`,  inline: true },
      { name: '💰 Ouro Ganho', value: `+**${result.goldGained}**`, inline: true },
      { name: `❤️ HP Restante${hpStatus}`, value: `${hpBarStr} **${result.playerHpLeft}/${stats.maxHp}**`, inline: false },
      { name: '⚡ Energia Restante', value: `**${result.playerEnergyLeft}/${stats.maxEnergy}**`, inline: true },
    );

  if (result.itemsDropped.length > 0) {
    const dropText = result.itemsDropped.map(id => {
      const item = getItem(id);
      return item ? `${item.emoji} **${item.name}**` : id;
    }).join('  •  ');
    embed.addFields({ name: `🎁 ${result.itemsDropped.length} Item(ns) Obtido(s)!`, value: dropText });
  }

  applyTemplate(embed, result.result === 'vitoria' ? 'combat.victory' : result.result === 'derrota' ? 'combat.defeat' : 'combat.draw');

  // Lógica Especial da Expedição
  const isExpedition = activeExpeditions.has(char.discordId) && mode === 'dungeon';
  let continueBtn: ButtonBuilder;

  if (isExpedition && result.result === 'vitoria') {
      const run = activeExpeditions.get(char.discordId)!;
      run.currentFloor++;
      if (run.currentFloor > run.maxFloors) {
          activeExpeditions.delete(char.discordId);
          continueBtn = new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('🏆 Expedição Concluída!').setStyle(ButtonStyle.Success);
      } else {
          continueBtn = new ButtonBuilder().setCustomId('rpg_crawl:continue').setLabel('🚪 Avançar na Expedição').setStyle(ButtonStyle.Success);
      }
  } else {
      if (isExpedition) activeExpeditions.delete(char.discordId); // Perdeu ou Fugiu: Limpa a expedição
      continueBtn = new ButtonBuilder()
        .setCustomId(mode === 'hunt' ? 'rpg:caca_aleatoria' : 'rpg:dungeon')
        .setLabel(mode === 'hunt' ? '🌲 Caçar Novamente' : 'Voltar à Entrada')
        .setStyle(mode === 'hunt' ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(result.playerHpLeft <= 0);
  }

  const combatBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
    continueBtn,
    ...(hpCritical && !isExpedition
      ? [new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏥 Ir se Curar!').setStyle(ButtonStyle.Success)]
      : []
    ),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('👤 Perfil').setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [combatBtns] };
}
