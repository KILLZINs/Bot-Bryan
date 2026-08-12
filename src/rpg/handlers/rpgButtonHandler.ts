// ═══════════════════════════════════════════════════════════════════════
// HANDLER DE BOTÕES RPG
// ═══════════════════════════════════════════════════════════════════════

import { ButtonInteraction, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { prisma } from '../../database/client';
import { getOrCreateCharacter, computeStats, applyPassiveEnergyRegen } from '../services/character';
import { buildProfileEmbed, buildCidadeEmbed, buildCidadeButtons, buildCidadeButtons2, buildPontosEmbed, buildPontosSelect } from '../panels/profile';
import { buildTravelEmbed, buildTravelSelect, buildTravelBackButton } from '../panels/travel';
import {
  buildDungeonEmbed, buildDungeonSelect, buildDungeonButtons, doBattleRandom,
  buildHuntEmbed, buildHuntSelect, buildHuntButtons, doCombatAction,
} from '../panels/dungeon';
import { buildShopEmbed, buildShopCategorySelect, buildShopButtons } from '../panels/shop';
import { buildGuildMenuEmbed, buildGuildMenuButtons, buildGuildInfoEmbed, buildGuildInfoButtons, buildGuildListEmbed, criarGuildaModal, guildConfigModal, guildDepositarModal, guildAnuncioModal, leaveGuild } from '../panels/guild';
import { buildHabilidadesEmbed, buildHabilidadesButtons } from '../panels/skills';
import { buildInventarioEmbed, buildInventarioButtons } from '../panels/inventario';
import { errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds';
import { generateProfileCard } from '../utils/profileCanvas';
import { buildProfileSelectMenu } from '../../commands/rpg';

export async function handleRpgButton(i: ButtonInteraction, action: string): Promise<void> {
  const discordId = i.user.id;
  const username  = i.user.username;
  let currentAction = action;

  try {
    // ── Tratamento infalível para as abas de Habilidades (Classe / Passivas) ──
    const rawId = i.customId;
    if (action.startsWith('rpg_skills_tab:') || rawId.includes('rpg_skills_tab:') || rawId.includes('skills_tab:')) {
      await i.deferUpdate();
      const targetAction = action.startsWith('rpg_skills_tab:') ? action : rawId;
      const tab = targetAction.includes('passivas') ? 'passivas' : 'classe';
      const char = await getOrCreateCharacter(discordId, username);
      const { embed, components } = await buildHabilidadesEmbed(char, tab);
      await i.editReply({ embeds: [embed], files: [], components });
      return;
    }

    const fullAction = i.customId.split(':').slice(1).join(':');
    const parts      = fullAction.split(':');
    const baseAction = parts[0];
    const param1     = parts[1];
    currentAction    = baseAction;

    switch (baseAction) {
      case 'perfil': {
        await i.deferUpdate();
        let char = await getOrCreateCharacter(discordId, username);
        char = await applyPassiveEnergyRegen(char);
        const stats = computeStats(char);

        let attachment: AttachmentBuilder | null = null;
        try {
          const avatarUrl = i.user.displayAvatarURL({ extension: 'png', size: 256 });
          const imageBuffer = await generateProfileCard(char, stats, avatarUrl);
          attachment = new AttachmentBuilder(imageBuffer, { name: 'perfil.png' });
        } catch (err) {
          console.error('Erro ao gerar perfil Canvas no botão:', err);
        }

        const components = [buildProfileSelectMenu()];

        if (!attachment) {
          await i.editReply({ embeds: [buildProfileEmbed(char, stats)], files: [], components });
          return;
        }

        await i.editReply({ embeds: [], files: [attachment], components });
        break;
      }

      case 'viajar': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const select = buildTravelSelect(char);
        await i.editReply({
          embeds: [buildTravelEmbed(char)],
          files: [],
          components: select ? [select, buildTravelBackButton()] : [buildTravelBackButton()],
        });
        break;
      }

      case 'inventario': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { embed, select } = await buildInventarioEmbed(char);
        const rows = select ? [select, buildInventarioButtons()] : [buildInventarioButtons()];
        await i.editReply({ embeds: [embed], files: [], components: rows });
        break;
      }

      case 'pontos': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const stats = computeStats(char);
        await i.editReply({
          embeds: [buildPontosEmbed(char, stats)],
          files: [],
          components: [buildPontosSelect(char.statPoints)],
        });
        break;
      }

      case 'cidade': {
        await i.deferUpdate();
        await i.editReply({
          embeds: [buildCidadeEmbed()],
          files: [],
          components: [buildCidadeButtons(), buildCidadeButtons2()],
        });
        break;
      }

      case 'dungeon': {
        await i.deferUpdate();
        let char = await getOrCreateCharacter(discordId, username);
        char = await applyPassiveEnergyRegen(char);
        const { buildDungeonTypeSelect } = await import('../panels/dungeon-tipo');
        const select = buildDungeonSelect(char);
        const typeSelect = buildDungeonTypeSelect(char);
        const dungeonRows: ActionRowBuilder<any>[] = [];
        if (select) dungeonRows.push(select);
        if (typeSelect) dungeonRows.push(typeSelect);
        dungeonRows.push(buildDungeonButtons(char));
        await i.editReply({ embeds: [buildDungeonEmbed(char)], files: [], components: dungeonRows });
        break;
      }

      case 'habilidades': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { embed, components } = await buildHabilidadesEmbed(char, 'classe');
        await i.editReply({ embeds: [embed], files: [], components });
        break;
      }

      case 'loja': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        await i.editReply({
          embeds: [buildShopEmbed(char)],
          files: [],
          components: [buildShopCategorySelect(), buildShopButtons()],
        });
        break;
      }

      default:
        if (i.deferred || i.replied) {
          await i.editReply({ embeds: [errorEmbed('Acesso', `Ação \`${baseAction}\` não encontrada.`)], files: [] });
        } else {
          await i.reply({ embeds: [errorEmbed('Acesso', `Ação \`${baseAction}\` não encontrada.`)], ephemeral: true });
        }
    }
  } catch (err) {
    console.error(`[RPG Button Error] action=${currentAction}`, err);
    const errMsg = { embeds: [errorEmbed('Erro RPG', 'Ocorreu um erro ao processar o botão.')], files: [] };
    if (i.replied) await i.followUp({ ...errMsg, ephemeral: true }).catch(() => null);
    else if (i.deferred) await i.editReply(errMsg).catch(() => null);
    else await i.reply({ ...errMsg, ephemeral: true }).catch(() => null);
  }
}
