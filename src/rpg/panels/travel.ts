import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { LOCATION_LIST, getLocation, ENV_EMOJI } from '../constants/locations';
import { isTravelOnCooldown } from '../services/combat';
import { prisma } from '../../database/client';

export function buildTravelEmbed(char: FullCharacter): EmbedBuilder {
  const current = getLocation(char.currentLocation);
  const envLabel = ENV_EMOJI[char.environment] ?? char.environment;

  const available = LOCATION_LIST.filter(l => l.id !== char.currentLocation && char.level >= l.minLevel);
  const locked    = LOCATION_LIST.filter(l => l.id !== char.currentLocation && char.level < l.minLevel);

  const availableLines = available.map(l =>
    `${l.emoji} **${l.name}** — Nv.${l.minLevel}+ | ⚡ ${l.travelCostEnergy} energia`
  ).join('\n') || '*Nenhum destino disponível no seu nível.*';

  const lockedLines = locked.slice(0, 4).map(l =>
    `🔒 ~~${l.name}~~ (Nv.${l.minLevel}+)`
  ).join('\n');

  return new EmbedBuilder()
    .setColor(0x27AE60)
    .setTitle('🗺️ Sistema de Viagem')
    .addFields(
      { name: '📍 Localização Atual', value: `${current.emoji} **${current.name}** — ${envLabel}`, inline: false },
      { name: `✅ Destinos Disponíveis (${available.length})`, value: availableLines, inline: false },
      ...(lockedLines ? [{ name: '🔒 Regiões Bloqueadas', value: lockedLines, inline: false }] : []),
      { name: '⚡ Sua Energia', value: `**${char.currentEnergy}/${char.maxEnergy}**`, inline: true },
      { name: '📊 Nível', value: `**${char.level}**`, inline: true },
    )
    .setFooter({ text: 'Viajar consome energia e tem cooldown. Cada região tem inimigos e drops diferentes.' });
}

export function buildTravelSelect(char: FullCharacter): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const destinations = LOCATION_LIST.filter(l => l.id !== char.currentLocation && char.level >= l.minLevel);
  if (destinations.length === 0) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:viajar_destino')
      .setPlaceholder('Selecione o destino...')
      .addOptions(
        destinations.slice(0, 25).map(l =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${l.name}`)
            .setValue(l.id)
            .setEmoji(l.emoji.trim())
            .setDescription(`Nv.${l.minLevel}+ | ⚡${l.travelCostEnergy} energia | ${l.hasDungeon ? 'Dungeon ✓' : 'Sem dungeon'}`)
        )
      )
  );
}

export function buildTravelBackButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
  );
}

export async function travelTo(char: FullCharacter, destinationId: string): Promise<{ success: boolean; message: string }> {
  const dest = getLocation(destinationId);
  if (!dest) return { success: false, message: 'Destino inválido.' };
  if (char.level < dest.minLevel) return { success: false, message: `Precisa ser nível **${dest.minLevel}** para ir a ${dest.name}.` };
  if (char.currentEnergy < dest.travelCostEnergy) return { success: false, message: `Energia insuficiente! Precisa de **${dest.travelCostEnergy}** de energia.` };

  const cd = isTravelOnCooldown(char, dest.travelCooldownMin);
  if (cd.onCooldown) return { success: false, message: `Aguarde **${cd.remaining}** para viajar novamente.` };

  // ambiente aleatório baseado na localização
  const envs = dest.environments;
  const hour = new Date().getHours();
  let env = envs[0];
  if (hour >= 6 && hour < 20 && envs.includes('DIA')) env = 'DIA';
  else if (envs.includes('NOITE')) env = 'NOITE';
  if (Math.random() < 0.2 && envs.length > 1) env = envs[Math.floor(Math.random() * envs.length)];

  await prisma.rpgCharacter.update({
    where: { discordId: char.discordId },
    data: {
      currentLocation: destinationId,
      environment: env,
      currentEnergy: { decrement: dest.travelCostEnergy },
      lastTravel: new Date(),
    },
  });

  const envLabel = ENV_EMOJI[env] ?? env;
  return { success: true, message: `✅ Você chegou em **${dest.emoji} ${dest.name}**! Ambiente: ${envLabel}` };
}
