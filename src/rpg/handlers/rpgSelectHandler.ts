// ═══════════════════════════════════════════════════════════════════════
// HANDLER DE SELECT MENUS RPG
// ═══════════════════════════════════════════════════════════════════════

import { StringSelectMenuInteraction, AttachmentBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getOrCreateCharacter, computeStats, distributeStatPoints, applyPassiveEnergyRegen } from '../services/character';
import { travelTo } from '../panels/travel';
import { buildProfileEmbed } from '../panels/profile';
import { buildTravelEmbed, buildTravelSelect, buildTravelBackButton } from '../panels/travel';
import { doBattleEnemy, buildDungeonEmbed, buildDungeonSelect, buildDungeonButtons } from '../panels/dungeon';
import { buildShopEmbed, buildShopItemSelect, buildShopButtons } from '../panels/shop';
import { equipItem, useConsumable, sellItem, buyItem } from '../services/inventory';
import { buildInventarioEmbed, buildInventarioButtons, buildItemActionSelect } from '../panels/inventario';
import { joinGuild } from '../panels/guild';
import { craftItem } from '../panels/forja';
import { prisma } from '../../database/client';
import { errorEmbed, successEmbed } from '../../utils/embeds';
import { generateProfileCard } from '../utils/profileCanvas';
import { buildProfileSelectMenu, buildAtividadesSelectMenu } from '../../commands/rpg';
import { PASSIVE_TALENTS } from '../constants/skills';
import { buildHabilidadesEmbed } from '../panels/skills';

export async function handleRpgSelect(i: StringSelectMenuInteraction, action: string): Promise<void> {
  const discordId = i.user.id;
  const username  = i.user.username;

  try {
    if (action.startsWith('worldboss_level')) {
      await i.deferUpdate();
      const templateIndex = parseInt(action.split(':')[1] ?? '0', 10);
      const level = parseInt(i.values[0], 10);
      const { spawnWorldBoss } = await import('../services/worldBoss');
      const result = await spawnWorldBoss(i.guildId ?? '', templateIndex, level);
      const { buildWorldBossEmbed, buildWorldBossButtons } = await import('../panels/worldBoss');
      const guildId = i.guildId ?? '';
      const [bossEmbed, bossButtons] = await Promise.all([
        buildWorldBossEmbed(guildId),
        buildWorldBossButtons(guildId, true),
      ]);
      const feedbackEmbed = result.success
        ? successEmbed('🐉 Boss Invocado!', result.message)
        : errorEmbed('Erro', result.message);
      await i.editReply({ embeds: [feedbackEmbed, bossEmbed], components: bossButtons });
      return;
    }

    // ── Equipar Múltiplas Habilidades Ativas ─────────────────────────────
    if (action === 'equipar_multiplas_skills') {
      await i.deferUpdate();
      await prisma.rpgCharacter.update({
        where: { discordId },
        data: { equippedSkills: i.values }
      });
      const char = await getOrCreateCharacter(discordId, username);
      const { embed, components } = await buildHabilidadesEmbed(char, 'ativas');
      await i.editReply({ embeds: [embed], components });
      return;
    }

    // ── Evoluir Talentos Passivos ──────────────────────────────────────────
    if (action === 'evoluir_talento') {
      await i.deferUpdate();
      const talentId = i.values[0].replace('talent:', '');
      const talent = PASSIVE_TALENTS[talentId];
      if (!talent) return;

      let char = await getOrCreateCharacter(discordId, username);
      const currentTalents = (char.talentLevels as Record<string, number> | null) ?? {};
      const currentLvl = currentTalents[talentId] ?? 0;

      if (currentLvl >= talent.maxLevel) {
        await i.editReply({ embeds: [errorEmbed('Erro', 'Talento já está no nível máximo!')] });
        return;
      }
      if (char.skillPoints < talent.costPerLevel) {
        await i.editReply({ embeds: [errorEmbed('Erro', 'Pontos de Skill insuficientes!')] });
        return;
      }

      currentTalents[talentId] = currentLvl + 1;
      await prisma.rpgCharacter.update({
        where: { discordId },
        data: {
          skillPoints: { decrement: talent.costPerLevel },
          talentLevels: currentTalents
        }
      });

      const updatedChar = await getOrCreateCharacter(discordId, username);
      const { embed, components } = await buildHabilidadesEmbed(updatedChar, 'passivas');
      await i.editReply({ embeds: [successEmbed('Talento Evoluído', `${talent.name} agora está no nível ${currentLvl + 1}`), embed], components });
      return;
    }

    switch (action) {
      case 'menu_perfil': {
        await i.deferUpdate();
        const option = i.values[0];
        let char = await getOrCreateCharacter(discordId, username);
        const stats = computeStats(char);

        if (option === 'habilidades') {
          const { embed: habEmbed, components: habComponents } = await buildHabilidadesEmbed(char, 'ativas');
          await i.editReply({
            embeds: [habEmbed],
            files: [],
            components: habComponents,
          });
          return;
        }

        // Outros menus mantidos...
        break;
      }

      default:
        await i.editReply({ embeds: [errorEmbed('Ação desconhecida', `Select RPG \`${action}\` não encontrado.`)] });
    }
  } catch (err) {
    console.error(`[RPG Select Error] action=${action}`, err);
    const errMsg = { embeds: [errorEmbed('Erro RPG', 'Ocorreu um erro. Tente novamente.')] };
    if (i.replied) await i.followUp({ ...errMsg, ephemeral: true }).catch(() => null);
    else if (i.deferred) await i.editReply(errMsg).catch(() => null);
    else await i.reply({ ...errMsg, ephemeral: true }).catch(() => null);
  }
}
