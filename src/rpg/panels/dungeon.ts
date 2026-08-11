import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter, computeStats, hpBar } from '../services/character';
import { getLocation } from '../constants/locations';
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

export function buildDungeonEmbed(char: FullCharacter): EmbedBuilder {
  const loc = getLocation(char.currentLocation);
  const stats = computeStats(char);

  if (loc.isSafeZone) {
    return new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('⚔️ Dungeons')
      .setDescription(`Você está em uma **zona segura** (${loc.name}).\nViaje para uma região com dungeon primeiro!`)
      .setFooter({ text: '⚔️ Use 🗺️ Viajar para escolher uma região com dungeon.' });
  }

  if (!loc.hasDungeon) {
    return new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('⚔️ Dungeons')
      .setDescription(`${loc.name} não tem dungeon. Tente outra região!`);
  }

  const enemies = getEnemiesForLocation(loc.id, char.level);
  const bosses  = getBossesForLocation(loc.id).filter(b => char.level >= b.minLevel);
  const cd = isDungeonOnCooldown(char, 5); // 5 min cooldown padrão

  const enemyList = enemies.slice(0, 5).map(e => `${e.emoji} **${e.name}** — ${e.xpReward} XP | ${e.goldMin}~${e.goldMax} 💰`).join('\n') || '*Nenhum inimigo no seu nível aqui.*';
  const bossList  = bosses.length > 0
    ? bosses.map(b => `${b.emoji} **${b.name}** [BOSS] — ${b.xpReward} XP | ${b.goldMin}~${b.goldMax} 💰`).join('\n')
    : '*Nenhum boss disponível (Nível insuficiente)*';

  const hpPct = stats.maxHp > 0 ? char.currentHp / stats.maxHp : 1;
  const hpDisplay = `${hpBar(char.currentHp, stats.maxHp)} **${char.currentHp}/${stats.maxHp}**${hpPct < 0.3 ? ' ⚠️' : ''}`;

  const embed = new EmbedBuilder()
    .setColor(hpPct < 0.3 ? 0xFF6B35 : 0xE74C3C)
    .setTitle(`⚔️ Dungeons — ${loc.emoji} ${loc.name}`);

  if (hpPct < 0.3) {
    embed.addFields({ name: '⚠️ HP CRÍTICO — Cuidado!', value: 'Seu HP está muito baixo. Considere ir à **🏰 Cidade → 🏥 Curar HP** antes de batalhar.', inline: false });
  }

  embed.addFields(
    { name: '👹 Inimigos da Região', value: enemyList, inline: false },
    { name: '💀 Bosses', value: bossList, inline: false },
    { name: '🔮 Tipos de Dungeon', value: '> Use o **2º menu** abaixo para escolher um tipo especial com bônus de XP/Ouro (Fogo, Gelo, Sombra, Trovão, Abissal)', inline: false },
    { name: '❤️ HP', value: hpDisplay, inline: true },
    { name: '⚡ Energia', value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true },
    { name: '⏱️ Cooldown', value: cd.onCooldown ? `🔴 ${cd.remaining}` : '🟢 Pronto!', inline: true },
  );

  return embed.setFooter({ text: '⚔️ Selecione um inimigo normal OU escolha um Tipo de Dungeon para bônus especiais de XP/Ouro!' });
}

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

export function buildDungeonSelect(char: FullCharacter): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const loc = getLocation(char.currentLocation);
  if (loc.isSafeZone || !loc.hasDungeon) return null;

  const enemies = getEnemiesForLocation(loc.id, char.level);
  const bosses  = getBossesForLocation(loc.id).filter(b => char.level >= b.minLevel);
  const all = [...enemies.slice(0, 20), ...bosses];
  if (all.length === 0) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:dungeon_inimigo')
      .setPlaceholder('Escolha o inimigo para batalhar...')
      .addOptions(
        all.map(e =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${e.name}${e.type === 'boss' ? ' [BOSS]' : e.type === 'elite' ? ' [Elite]' : ''}`)
            .setValue(e.id)
            .setEmoji(e.emoji.trim())
            .setDescription(`HP: ${e.baseHp} | ATK: ${e.baseAttack} | ${e.xpReward} XP | ${e.goldMin}~${e.goldMax}💰`)
        )
      )
  );
}

export function buildDungeonButtons(char: FullCharacter): ActionRowBuilder<ButtonBuilder> {
  const loc = getLocation(char.currentLocation);
  const enemies = getEnemiesForLocation(loc.id, char.level);
  const bosses  = getBossesForLocation(loc.id).filter(b => char.level >= b.minLevel);
  const hasEnemies = enemies.length > 0 || bosses.length > 0;
  const cd = isDungeonOnCooldown(char, 5);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:dungeon_aleatorio').setLabel('⚡ Batalha Rápida').setStyle(ButtonStyle.Danger).setDisabled(!hasEnemies || cd.onCooldown || char.currentHp <= 0),
    new ButtonBuilder().setCustomId('rpg:dungeon_boss').setLabel('💀 Boss').setStyle(ButtonStyle.Danger).setDisabled(bosses.length === 0 || cd.onCooldown || char.currentHp <= 0),
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏰 Cidade').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
  );
}

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
        .setTitle(`${turn.mode === 'hunt' ? '🌲 Caçada' : '⚔️ Dungeon'} — Rodada ${turn.round || 1}`)
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

  // trunca o log para caber no embed (max 4096 chars)
  const fullLog = result.log.join('\n');
  const logSlice = fullLog.length > 1800 ? '...\n' + fullLog.slice(-1600) : fullLog;

  // Barra de HP após o combate
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
      { name: '⭐ XP Ganho',  value: `+**${result.xpGained}**`,   inline: true },
      { name: '💰 Ouro Ganho', value: `+**${result.goldGained}**`, inline: true },
      {
        name: `❤️ HP Restante${hpStatus}`,
        value: `${hpBarStr} **${result.playerHpLeft}/${stats.maxHp}**`,
        inline: false,
      },
      { name: '⚡ Energia Restante', value: `**${result.playerEnergyLeft}/${stats.maxEnergy}**`, inline: true },
    );

  if (result.itemsDropped.length > 0) {
    const dropText = result.itemsDropped.map(id => {
      const item = getItem(id);
      return item ? `${item.emoji} **${item.name}**` : id;
    }).join('  •  ');
    embed.addFields({ name: `🎁 ${result.itemsDropped.length} Item(ns) Obtido(s)!`, value: dropText });
  }

  // Aplicar template customizável (se existir)
  const tplKey = result.result === 'vitoria' ? 'combat.victory' : result.result === 'derrota' ? 'combat.defeat' : 'combat.draw';
  applyTemplate(embed, tplKey);

  const combatBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(mode === 'hunt' ? 'rpg:caca_aleatoria' : 'rpg:dungeon_aleatorio')
      .setLabel(mode === 'hunt' ? '🌲 Caçar Novamente' : '⚡ Batalhar Novamente')
      .setStyle(mode === 'hunt' ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(result.playerHpLeft <= 0),
    ...(hpCritical
      ? [new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏥 Ir se Curar!').setStyle(ButtonStyle.Success)]
      : [new ButtonBuilder().setCustomId(mode === 'hunt' ? 'rpg:caca' : 'rpg:dungeon').setLabel(mode === 'hunt' ? '🌲 Escolher Monstro' : '⚔️ Escolher Inimigo').setStyle(ButtonStyle.Secondary)]
    ),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('👤 Perfil').setStyle(ButtonStyle.Secondary),
  );

  const rows = [combatBtns];
  return { embed, rows };
}
