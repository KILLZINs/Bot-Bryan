// ═══════════════════════════════════════════════════════════════════════
// PAINEL DA TAVERNA
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { prisma } from '../../database/client';
import { FullCharacter, computeStats } from '../services/character';
import { addTempBuff, getActiveBuffs, formatBuffList } from '../services/temp-buffs';
import { incrementMissionProgress } from '../services/class-missions';

interface TavernaItem {
  id: string;
  name: string;
  emoji: string;
  type: 'comida' | 'bebida' | 'especial';
  price: number;
  description: string;
  buffType?: string;
  buffValue?: number;
  durationMs?: number;
  buffLabel?: string;
  hpRestore?: number;
  energyRestore?: number;
}

const TAVERNA_MENU: TavernaItem[] = [
  // Bebidas
  { id: 'cerveja',      name: 'Cerveja da Casa',     emoji: '🍺', type: 'bebida',   price: 20,  description: '+10% Ouro por 30min',           buffType: 'gold_pct', buffValue: 0.10, durationMs: 30*60*1000, buffLabel: 'Ouro (Cerveja)' },
  { id: 'vinho',        name: 'Vinho Élfico',        emoji: '🍷', type: 'bebida',   price: 40,  description: '+15% XP por 45min',             buffType: 'xp_pct',  buffValue: 0.15, durationMs: 45*60*1000, buffLabel: 'XP (Vinho)' },
  { id: 'hidromel',     name: 'Hidromel dos Anões',  emoji: '🍯', type: 'bebida',   price: 60,  description: '+20% ATK por 30min',            buffType: 'atk_pct', buffValue: 0.20, durationMs: 30*60*1000, buffLabel: 'Ataque (Hidromel)' },
  { id: 'pocao_elixir', name: 'Elixir Mágico',       emoji: '🧪', type: 'especial', price: 100, description: '+25% XP e +10% Ouro por 1h',    buffType: 'xp_pct',  buffValue: 0.25, durationMs: 60*60*1000, buffLabel: 'XP (Elixir)' },
  // Comidas
  { id: 'ensopado',     name: 'Ensopado de Carne',   emoji: '🍲', type: 'comida',   price: 25,  description: 'Restaura 40 HP',                 hpRestore: 40 },
  { id: 'pao_mana',     name: 'Pão de Mana',         emoji: '🍞', type: 'comida',   price: 30,  description: 'Restaura 30 Energia',            energyRestore: 30 },
  { id: 'banquete',     name: 'Banquete do Herói',   emoji: '🍖', type: 'comida',   price: 80,  description: 'Restaura 80 HP + 40 Energia',    hpRestore: 80, energyRestore: 40 },
  { id: 'sopa_nobre',   name: 'Sopa Nobre',          emoji: '🥣', type: 'especial', price: 120, description: '+15% DEF e restaura 60 HP',      buffType: 'def_pct', buffValue: 0.15, durationMs: 45*60*1000, buffLabel: 'Defesa (Sopa)', hpRestore: 60 },
];

// ─── Embed principal ──────────────────────────────────────────────────────────

export async function buildTavernaEmbed(char: FullCharacter): Promise<EmbedBuilder> {
  const buffs = await getActiveBuffs(char.discordId);
  const buffText = formatBuffList(buffs);

  return new EmbedBuilder()
    .setColor(0xD4A017)
    .setTitle('🍺 Taverna do Aventureiro')
    .setDescription(
      '*"Bem-vindo, viajante! Sente-se e relaxe. Temos o melhor da região!"*\n\n' +
      'Consuma bebidas e comidas para ganhar **buffs temporários** ou restaurar HP/Energia.',
    )
    .addFields(
      { name: '💰 Seu Ouro',       value: `**${char.gold}** 🪙`, inline: true },
      { name: '❤️ HP',             value: `**${char.currentHp}/${computeStats(char).maxHp}**`, inline: true },
      { name: '⚡ Energia',         value: `**${char.currentEnergy}/${computeStats(char).maxEnergy}**`, inline: true },
      { name: '✨ Buffs Ativos',    value: buffText, inline: false },
      {
        name: '🍺 Bebidas',
        value: TAVERNA_MENU.filter(i => i.type === 'bebida').map(i => `${i.emoji} **${i.name}** — ${i.description} *(${i.price}🪙)*`).join('\n'),
        inline: false,
      },
      {
        name: '🍖 Comidas',
        value: TAVERNA_MENU.filter(i => i.type === 'comida').map(i => `${i.emoji} **${i.name}** — ${i.description} *(${i.price}🪙)*`).join('\n'),
        inline: false,
      },
      {
        name: '✨ Especiais',
        value: TAVERNA_MENU.filter(i => i.type === 'especial').map(i => `${i.emoji} **${i.name}** — ${i.description} *(${i.price}🪙)*`).join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: '🎲 Use os botões abaixo para pedir ou jogar dados!' });
}

export function buildTavernaMenuSelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:taverna_pedir')
      .setPlaceholder('Escolha o que pedir...')
      .addOptions(
        TAVERNA_MENU.map(i =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${i.name} — ${i.price}🪙`)
            .setValue(i.id)
            .setDescription(i.description)
            .setEmoji(i.emoji),
        ),
      ),
  );
}

export function buildTavernaButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:taverna_dados').setLabel('🎲 Jogar Dados').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rpg:taverna').setLabel('🔄 Cardápio').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
  );
}

// ─── Comprar item da taverna ───────────────────────────────────────────────────

export async function buyTavernaItem(char: FullCharacter, itemId: string): Promise<{ success: boolean; message: string }> {
  const item = TAVERNA_MENU.find(i => i.id === itemId);
  if (!item) return { success: false, message: 'Item não encontrado.' };
  if (char.gold < item.price) return { success: false, message: `Ouro insuficiente! Precisa de **${item.price}🪙**, você tem **${char.gold}🪙**.` };

  const stats = computeStats(char);
  let newHp = char.currentHp;
  let newEnergy = char.currentEnergy;
  if (item.hpRestore)     newHp     = Math.min(stats.maxHp,     char.currentHp     + item.hpRestore);
  if (item.energyRestore) newEnergy = Math.min(stats.maxEnergy, char.currentEnergy + item.energyRestore);

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: { gold: char.gold - item.price, currentHp: newHp, currentEnergy: newEnergy, lastTavern: new Date() },
  });

  if (item.buffType && item.buffValue && item.durationMs && item.buffLabel) {
    await addTempBuff(char.discordId, item.buffType as any, item.buffValue, item.durationMs, 'taverna', item.buffLabel);
  }

  await incrementMissionProgress(char.discordId, 'tavern_visit', 1).catch(() => null);

  const parts: string[] = [`${item.emoji} **${item.name}** consumido! −${item.price}🪙`];
  if (item.hpRestore)  parts.push(`+${newHp - char.currentHp} ❤️ HP`);
  if (item.energyRestore) parts.push(`+${newEnergy - char.currentEnergy} ⚡ Energia`);
  if (item.buffType)   parts.push(`✨ Buff ativado: ${item.buffLabel}`);

  return { success: true, message: parts.join('\n') };
}

// ─── Jogo de dados ────────────────────────────────────────────────────────────

export async function rollTavernaDice(char: FullCharacter): Promise<{ embed: EmbedBuilder }> {
  // Aposta fixa de 20 ouro, 50% chance de dobrar
  const bet = 20;
  if (char.gold < bet) {
    return {
      embed: new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🎲 Dados da Taverna')
        .setDescription(`Você não tem ouro suficiente para apostar! Mínimo: **${bet}🪙**`),
    };
  }

  const playerRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  const houseRoll  = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  const won = playerRoll > houseRoll;
  const draw = playerRoll === houseRoll;

  let goldDelta = 0;
  let resultText: string;
  let color: number;

  if (draw) {
    goldDelta = 0;
    resultText = '🤝 **Empate!** Você não perde nem ganha.';
    color = 0xAAAAAA;
  } else if (won) {
    goldDelta = bet * (playerRoll >= 10 ? 2 : 1); // jackpot se >= 10
    resultText = playerRoll >= 10
      ? `🎉 **JACKPOT!** Você rolou ${playerRoll} vs ${houseRoll} — ganhou **${goldDelta}🪙**!`
      : `✅ **Vitória!** Você rolou ${playerRoll} vs ${houseRoll} — ganhou **+${goldDelta}🪙**!`;
    color = 0x2ECC71;
  } else {
    goldDelta = -bet;
    resultText = `❌ **Derrota.** Você rolou ${playerRoll} vs ${houseRoll} — perdeu **${bet}🪙**.`;
    color = 0xE74C3C;
  }

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: { gold: char.gold + goldDelta },
  });

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎲 Dados da Taverna')
    .setDescription(resultText)
    .addFields(
      { name: '🎲 Seu Dado', value: `**${playerRoll}** (2d6)`, inline: true },
      { name: '🏠 Casa',     value: `**${houseRoll}** (2d6)`,  inline: true },
      { name: '💰 Saldo',    value: `**${char.gold + goldDelta}🪙**`, inline: true },
    )
    .setFooter({ text: 'Aposta de 20🪙 por rodada. Boa sorte!' });

  return { embed };
}
