import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { FullCharacter, computeStats, hpBar } from '../services/character';
import { DUNGEON_TYPE_LIST } from '../constants/dungeon-types';
import { getLocation } from '../constants/locations';
import { getDayPhase, PHASE_INFO } from '../services/day-night';

export function buildDungeonTypeEmbed(char: FullCharacter): EmbedBuilder {
  const loc = getLocation(char.currentLocation);
  const stats = computeStats(char);
  const phase = getDayPhase();
  const phaseInfo = PHASE_INFO[phase];

  if (loc.isSafeZone || !loc.hasDungeon) {
    return new EmbedBuilder().setColor(0xE74C3C).setTitle('⚔️ Tipos de Dungeon').setDescription('Você está em uma zona segura. Viaje para uma região com dungeon!');
  }

  const availableTypes = DUNGEON_TYPE_LIST.filter(t => char.level >= t.minLevel);

  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(`⚔️ Expedição Elemental — ${loc.emoji} ${loc.name}`)
    .setDescription(`Escolha o **tipo de dungeon** no menu abaixo.\nTipos alteram completamente as recompensas da Expedição!\n\n${phaseInfo.emoji} **${phaseInfo.name}**: ${phaseInfo.xpBonus > 0 ? `+${Math.round(phaseInfo.xpBonus * 100)}% XP adicional` : phaseInfo.desc}`)
    .addFields(
      {
        name: '🎯 Tipos Disponíveis',
        value: availableTypes.map(t => `${t.emoji} **${t.name}** (Nv.${t.minLevel}+)\n> Bônus Final: XP ×${t.xpMult} | Ouro ×${t.goldMult}`).join('\n\n'),
        inline: false,
      },
      { name: '❤️ HP',     value: `${hpBar(char.currentHp, stats.maxHp)} **${char.currentHp}/${stats.maxHp}**`, inline: true },
      { name: '⚡ Energia', value: `**${char.currentEnergy}/${stats.maxEnergy}**`, inline: true },
    )
    .setFooter({ text: 'Selecione abaixo para iniciar imediatamente!' });
}

export function buildDungeonTypeSelect(char: FullCharacter): ActionRowBuilder<StringSelectMenuBuilder> {
  const availableTypes = DUNGEON_TYPE_LIST.filter(t => char.level >= t.minLevel);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:dungeon_tipo_escolher')
      .setPlaceholder('Escolha o tipo de dungeon...')
      .addOptions(
        availableTypes.map(t =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${t.emoji} ${t.name}`)
            .setValue(t.id)
            .setDescription(`XP Final ×${t.xpMult} | Ouro Final ×${t.goldMult}`),
        ),
      ),
  );
}

export function buildDungeonTypeButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:dungeon').setLabel('⚔️ Expedição Padrão').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
  );
}
