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
  const rawId     = i.customId;

  try {
    if (rawId.includes('skills_tab:')) {
      await i.deferUpdate();
      const tab = rawId.includes('passivas') ? 'passivas' : 'classe';
      const char = await getOrCreateCharacter(discordId, username);
      const { embed, components } = await buildHabilidadesEmbed(char, tab);
      await i.editReply({ embeds: [embed], files: [], components });
      return;
    }

    const fullAction = i.customId.split(':').slice(1).join(':');
    const parts      = fullAction.split(':');
    const baseAction = parts[0];
    const param1     = parts[1];

    switch (baseAction) {
      // ═══════════════════════════════════════════════════════════════════════
      // DUNGEON CRAWLER (A Mágica da Expedição)
      // ═══════════════════════════════════════════════════════════════════════
      case 'crawl': {
        await i.deferUpdate();
        const crawlAction = param1; 
        let char = await getOrCreateCharacter(discordId, username);

        const { activeExpeditions, buildDungeonCrawlerEmbed, processRandomDungeonEvent, startExpedition, finishExpedition, doBattleRandom, doBattleEnemy, buildDungeonEmbed, buildDungeonButtons } = await import('../panels/dungeon');

        if (crawlAction === 'start') {
          const res = await startExpedition(char, char.currentLocation);
          if (!res.success) {
            await i.editReply({ embeds: [errorEmbed('Expedição Bloqueada', res.error!)], files: [], components: [] });
            return;
          }
          const { embeds, components } = buildDungeonCrawlerEmbed(char, res.run!);
          await i.editReply({ embeds, files: [], components });
          return;
        }

        const run = activeExpeditions.get(discordId);
        if (!run) {
          await i.editReply({ embeds: [errorEmbed('Expedição Perdida', 'Sua expedição acabou ou foi cancelada.')], files: [], components: [buildDungeonButtons(char)] });
          return;
        }

        if (crawlAction === 'flee') {
          activeExpeditions.delete(discordId);
          await i.editReply({ embeds: [buildDungeonEmbed(char)], files: [], components: [buildDungeonButtons(char)] });
          return;
        }

        if (crawlAction === 'continue') {
          const { embeds, components } = buildDungeonCrawlerEmbed(char, run);
          await i.editReply({ embeds, files: [], components });
          return;
        }

        if (crawlAction === 'event') {
          await processRandomDungeonEvent(char, run);
          char = await getOrCreateCharacter(discordId, username); 
          const { embeds, components } = buildDungeonCrawlerEmbed(char, run);
          await i.editReply({ embeds, files: [], components });
          return;
        }

        if (crawlAction === 'fight') {
          const { embed, rows } = await doBattleRandom(char, i.guildId ?? '', 'dungeon');
          await i.editReply({ embeds: [embed], files: [], components: rows });
          return;
        }

        if (crawlAction === 'boss') {
          const { getBossesForLocation } = await import('../constants/enemies');
          const bosses = getBossesForLocation(run.locationId, char.level);
          if (bosses.length === 0) {
            const { embed, rows } = await finishExpedition(char, run);
            activeExpeditions.delete(discordId);
            await i.editReply({ embeds: [embed], components: rows });
            return;
          }
          const boss = bosses[Math.floor(Math.random() * bosses.length)];
          const { embed, rows } = await doBattleEnemy(char, boss.id, i.guildId ?? '', 'dungeon');
          await i.editReply({ embeds: [embed], files: [], components: rows });
          return;
        }

        if (crawlAction === 'finish') {
          const { embed, rows } = await finishExpedition(char, run);
          activeExpeditions.delete(discordId);
          await i.editReply({ embeds: [embed], files: [], components: rows });
          return;
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // DEMAIS BOTÕES
      // ═══════════════════════════════════════════════════════════════════════

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

      case 'caca': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const select = buildHuntSelect(char);
        const hasEnemies = !!select;
        await i.editReply({
          embeds: [buildHuntEmbed(char)],
          files: [],
          components: select ? [select, buildHuntButtons(hasEnemies, char)] : [buildHuntButtons(false, char)],
        });
        break;
      }

      case 'dungeon_tipo': {
        await i.deferUpdate();
        let char = await getOrCreateCharacter(discordId, username);
        char = await applyPassiveEnergyRegen(char);
        const { buildDungeonTypeSelect: buildTypeSelectAlias } = await import('../panels/dungeon-tipo');
        const selectAlias = buildDungeonSelect(char);
        const typeSelectAlias = buildTypeSelectAlias(char);
        const rowsAlias: ActionRowBuilder<any>[] = [];
        if (selectAlias) rowsAlias.push(selectAlias);
        if (typeSelectAlias) rowsAlias.push(typeSelectAlias);
        rowsAlias.push(buildDungeonButtons(char));
        await i.editReply({ embeds: [buildDungeonEmbed(char)], files: [], components: rowsAlias });
        break;
      }

      case 'caca_aleatoria': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { embed: battleEmbed, rows: battleRows } = await doBattleRandom(char, i.guildId ?? '', 'hunt');
        await i.editReply({ embeds: [battleEmbed], files: [], components: battleRows });
        break;
      }

      case 'combate_acao': {
        await i.deferUpdate();
        const combatAction = param1 as 'attack' | 'skill' | 'defend' | 'potion' | 'flee';
        if (!['attack', 'skill', 'defend', 'potion', 'flee'].includes(combatAction)) {
          await i.editReply({
            embeds: [errorEmbed('Ação inválida', 'Essa ação de combate não existe.')],
            files: [],
            components: [],
          });
          return;
        }
        const char = await getOrCreateCharacter(discordId, username);
        try {
          const { embed, rows } = await doCombatAction(discordId, combatAction, char);
          await i.editReply({ embeds: [embed], files: [], components: rows });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Não foi possível executar essa ação.';
          await i.editReply({
            embeds: [errorEmbed('Ação não realizada', message)],
            files: [],
            components: [],
          });
        }
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

      case 'curandeiro': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const stats = computeStats(char);
        const hpMissing = stats.maxHp - char.currentHp;
        const enMissing = stats.maxEnergy - char.currentEnergy;
        const cost = Math.max(5, Math.ceil(hpMissing * 0.12 + enMissing * 0.08));

        if (hpMissing === 0 && enMissing === 0) {
          await i.editReply({ embeds: [infoEmbed('🏥 Curandeiro', '✅ Você já está com HP e Energia no máximo!')], files: [], components: [buildCidadeButtons(), buildCidadeButtons2()] });
          return;
        }
        if (char.gold < cost) {
          await i.editReply({ embeds: [errorEmbed('🏥 Ouro Insuficiente', `Curar custa **${cost} ouro**.\nVocê tem apenas **${char.gold} ouro**.\n\n❤️ HP faltando: **${hpMissing}** | ⚡ Energia faltando: **${enMissing}**`)], files: [], components: [buildCidadeButtons(), buildCidadeButtons2()] });
          return;
        }

        const healed = await prisma.rpgCharacter.updateMany({
          where: { discordId, gold: { gte: cost } },
          data: { currentHp: stats.maxHp, currentEnergy: stats.maxEnergy, gold: { decrement: cost }, lastRest: new Date() },
        });
        if (healed.count === 0) {
          await i.editReply({ embeds: [errorEmbed('🏥 Ouro Insuficiente', `Curar custa **${cost} ouro** e seu saldo mudou. Tente novamente após conferir seu perfil.`)], files: [], components: [buildCidadeButtons(), buildCidadeButtons2()] });
          return;
        }

        await i.editReply({
          embeds: [infoEmbed('🏥 Curado!', `HP e Energia restaurados por **${cost} ouro**.\n❤️ HP: **${stats.maxHp}/${stats.maxHp}** | ⚡ Energia: **${stats.maxEnergy}/${stats.maxEnergy}**`)],
          files: [],
          components: [buildCidadeButtons(), buildCidadeButtons2()],
        });
        break;
      }

      case 'arena': {
        await i.deferUpdate();
        await i.editReply({
          embeds: [infoEmbed('⚔️ Arena PvP', 'Para desafiar alguém, use:\n`/rpg pvp @usuario`\n\nOu aguarde oponentes aleatórios no canal de arena.')],
          files: [],
          components: [buildCidadeButtons(), buildCidadeButtons2()],
        });
        break;
      }

      case 'guild': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
        await i.editReply({ embeds: [buildGuildMenuEmbed(char)], files: [], components: [buildGuildMenuButtons(!!membership)] });
        break;
      }

      case 'guild_info': {
        await i.deferUpdate();
        const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
        if (!membership) { await i.editReply({ embeds: [errorEmbed('Sem Guilda', 'Você não está em nenhuma guilda.')], files: [] }); return; }
        await i.editReply({ embeds: [await buildGuildInfoEmbed(membership.guildId)], files: [], components: buildGuildInfoButtons(membership.role) });
        break;
      }

      case 'guild_config': {
        const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
        if (!membership || (membership.role !== 'Líder' && membership.role !== 'Vice-Líder')) {
          if (i.deferred || i.replied) await i.editReply({ embeds: [errorEmbed('Sem Permissão', 'Apenas Líder ou Vice-Líder podem configurar.')], files: [] });
          else await i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas Líder ou Vice-Líder podem configurar.')], ephemeral: true });
          return;
        }
        await i.showModal(guildConfigModal());
        break;
      }

      case 'guild_depositar': {
        const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
        if (!membership) {
          if (i.deferred || i.replied) await i.editReply({ embeds: [errorEmbed('Sem Guilda', 'Você não está em nenhuma guilda.')], files: [] });
          else await i.reply({ embeds: [errorEmbed('Sem Guilda', 'Você não está em nenhuma guilda.')], ephemeral: true });
          return;
        }
        await i.showModal(guildDepositarModal());
        break;
      }

      case 'guild_anuncio': {
        const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
        if (!membership || (membership.role !== 'Líder' && membership.role !== 'Vice-Líder')) {
          if (i.deferred || i.replied) await i.editReply({ embeds: [errorEmbed('Sem Permissão', 'Apenas Líder ou Vice-Líder podem definir o aviso.')], files: [] });
          else await i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas Líder ou Vice-Líder podem definir o aviso.')], ephemeral: true });
          return;
        }
        await i.showModal(guildAnuncioModal());
        break;
      }

      case 'guild_criar': { await i.showModal(criarGuildaModal()); break; }

      case 'guild_buscar': {
        await i.deferUpdate();
        await i.editReply({ embeds: [await buildGuildListEmbed()], files: [], components: [buildGuildMenuButtons(false)] });
        break;
      }

      case 'guild_sair': {
        await i.deferUpdate();
        const result = await leaveGuild(discordId);
        await i.editReply({ embeds: [result.success ? successEmbed('Guilda', result.message) : errorEmbed('Erro', result.message)], files: [] });
        break;
      }

      case 'forja': {
        await i.deferUpdate();
        const { buildForjaEmbed, buildForjaSelect } = await import('../panels/forja');
        const char = await getOrCreateCharacter(discordId, username);
        const inventory = await prisma.rpgInventoryItem.findMany({ where: { characterId: discordId, quantity: { gt: 0 } } });
        const embed = buildForjaEmbed(char, inventory);
        const select = buildForjaSelect(char);
        await i.editReply({
          embeds: [embed],
          files: [],
          components: select ? [select, buildCidadeButtons(), buildCidadeButtons2()] : [buildCidadeButtons(), buildCidadeButtons2()],
        });
        break;
      }

      case 'worldboss': {
        await i.deferUpdate();
        const { buildWorldBossEmbed, buildWorldBossButtons } = await import('../panels/worldBoss');
        const guildId = i.guildId ?? '';
        const member = i.member;
        const isAdmin = !!(member && 'permissions' in member && (member.permissions as any).has?.(PermissionFlagsBits.ManageGuild));
        const [bossEmbed, bossButtons] = await Promise.all([
          buildWorldBossEmbed(guildId),
          buildWorldBossButtons(guildId, isAdmin),
        ]);
        await i.editReply({ embeds: [bossEmbed], files: [], components: bossButtons });
        break;
      }

      case 'worldboss_atacar': {
        await i.deferUpdate();
        const { attackWorldBoss } = await import('../services/worldBoss');
        const { buildWorldBossEmbed, buildWorldBossButtons } = await import('../panels/worldBoss');
        const guildId = i.guildId ?? '';
        const result = await attackWorldBoss(discordId, username, guildId);

        if (!result.success) {
          await i.editReply({ embeds: [errorEmbed('Boss Mundial', result.message)], files: [] });
          return;
        }

        try {
          const { trackRpgMission } = await import('../../commands/utility/missoes');
          await trackRpgMission(discordId, guildId, 'atacar_boss_mundial', 1);
          await trackRpgMission(discordId, guildId, 'participar_boss_mundial', 1);
        } catch { /* non-critical */ }

        const member = i.member;
        const isAdmin = !!(member && 'permissions' in member && (member.permissions as any).has?.(PermissionFlagsBits.ManageGuild));
        const [updatedBossEmbed, updatedButtons] = await Promise.all([
          buildWorldBossEmbed(guildId),
          buildWorldBossButtons(guildId, isAdmin),
        ]);

        const attackResult = infoEmbed(
          result.bossDefeated ? '🏆 Boss Derrotado!' : '⚔️ Ataque!',
          result.message,
        );

        await i.followUp({ embeds: [attackResult], ephemeral: true });
        await i.editReply({ embeds: [updatedBossEmbed], files: [], components: updatedButtons });
        break;
      }

      case 'worldboss_spawn': {
        const member = i.member;
        const isAdmin = !!(member && 'permissions' in member && (member.permissions as any).has?.(PermissionFlagsBits.ManageGuild));
        if (!isAdmin) {
          await i.reply({ embeds: [errorEmbed('Sem Permissão', 'Apenas administradores podem invocar o Boss Mundial.')], ephemeral: true });
          return;
        }
        await i.deferUpdate();
        const { buildWorldBossSpawnSelect } = await import('../panels/worldBoss');
        const { EmbedBuilder } = await import('discord.js');
        const spawnEmbed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('🐉 Invocar Boss Mundial — Passo 1')
          .setDescription('Escolha qual Boss Mundial deseja invocar para o servidor!');
        await i.editReply({ embeds: [spawnEmbed], files: [], components: [buildWorldBossSpawnSelect()] });
        break;
      }

      case 'casamento': {
        await i.deferUpdate();
        const { buildMarriageEmbed, buildMarriageButtons } = await import('../panels/marriage');
        const [marriageEmbed, marriageButtons] = await Promise.all([
          buildMarriageEmbed(discordId, i.client),
          buildMarriageButtons(discordId),
        ]);
        await i.editReply({ embeds: [marriageEmbed], files: [], components: marriageButtons });
        break;
      }

      case 'casamento_propor': {
        const { buildProposalModal } = await import('../panels/marriage');
        await i.showModal(buildProposalModal());
        break;
      }

      case 'casamento_aceitar': {
        await i.deferUpdate();
        const proposalId = param1;
        if (!proposalId) { await i.editReply({ embeds: [errorEmbed('Erro', 'ID da proposta inválido.')], files: [] }); return; }

        const { acceptProposal } = await import('../services/marriage');
        const result = await acceptProposal(proposalId, discordId);

        if (result.success && result.proposerId) {
          try {
            const proposerUser = await i.client.users.fetch(result.proposerId);
            await proposerUser.send(`💍 **${i.user.username}** aceitou sua proposta de casamento! 💒🎊`);
          } catch { /* DMs fechadas */ }
        }

        const { buildMarriageEmbed, buildMarriageButtons } = await import('../panels/marriage');
        const [marriageEmbed, marriageButtons] = await Promise.all([
          buildMarriageEmbed(discordId, i.client),
          buildMarriageButtons(discordId),
        ]);
        const feedbackEmbed = result.success ? successEmbed('💒 Casamento!', result.message) : errorEmbed('Erro', result.message);
        await i.editReply({ embeds: [feedbackEmbed, marriageEmbed], files: [], components: marriageButtons });
        break;
      }

      case 'casamento_rejeitar': {
        await i.deferUpdate();
        const proposalId = param1;
        if (!proposalId) { await i.editReply({ embeds: [errorEmbed('Erro', 'ID da proposta inválido.')], files: [] }); return; }

        const { rejectProposal } = await import('../services/marriage');
        const result = await rejectProposal(proposalId, discordId);

        const { buildMarriageEmbed, buildMarriageButtons } = await import('../panels/marriage');
        const [marriageEmbed, marriageButtons] = await Promise.all([
          buildMarriageEmbed(discordId, i.client),
          buildMarriageButtons(discordId),
        ]);
        const feedbackEmbed = result.success ? infoEmbed('💔 Proposta Recusada', result.message) : errorEmbed('Erro', result.message);
        await i.editReply({ embeds: [feedbackEmbed, marriageEmbed], files: [], components: marriageButtons });
        break;
      }

      case 'casamento_divorciar_confirmar': {
        await i.deferUpdate();
        const { buildDivorceConfirmEmbed } = await import('../panels/marriage');
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('rpg:casamento_divorciar_executar').setLabel('💔 Confirmar Divórcio').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('rpg:casamento').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
        );
        await i.editReply({ embeds: [buildDivorceConfirmEmbed()], files: [], components: [confirmRow] });
        break;
      }

      case 'casamento_divorciar_executar': {
        await i.deferUpdate();
        const { divorce } = await import('../services/marriage');
        const result = await divorce(discordId);

        const { buildMarriageEmbed, buildMarriageButtons } = await import('../panels/marriage');
        const [marriageEmbed, marriageButtons] = await Promise.all([
          buildMarriageEmbed(discordId, i.client),
          buildMarriageButtons(discordId),
        ]);
        const feedbackEmbed = result.success ? infoEmbed('💔 Divórcio', result.message) : errorEmbed('Erro', result.message);
        await i.editReply({ embeds: [feedbackEmbed, marriageEmbed], files: [], components: marriageButtons });
        break;
      }

      case 'missoes': {
        await i.deferUpdate();
        const guildId = i.guildId ?? '';
        const { ensureDailyMissions, ensureWeeklyMissions } = await import('../../commands/utility/missoes');
        const { buildMissoesEmbed, buildMissoesClaimSelect, buildMissoesButtons } = await import('../panels/missoes');

        await Promise.all([
          ensureDailyMissions(discordId, guildId),
          ensureWeeklyMissions(discordId, guildId),
        ]);

        const [missoesEmbed, claimSelect] = await Promise.all([
          buildMissoesEmbed(discordId, guildId),
          buildMissoesClaimSelect(discordId, guildId),
        ]);

        const missaoRows: any[] = claimSelect ? [claimSelect, buildMissoesButtons()] : [buildMissoesButtons()];
        await i.editReply({ embeds: [missoesEmbed], files: [], components: missaoRows });
        break;
      }

      case 'stats': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const stats = computeStats(char);
        const totalBattles = char.totalWins + char.totalDeaths;
        const winRate = totalBattles > 0 ? Math.round((char.totalWins / totalBattles) * 100) : 0;
        const daysPlaying = Math.floor((Date.now() - char.createdAt.getTime()) / 86400000);
        const pvpTotal = char.pvpWins + char.pvpLosses;
        const pvpRate = pvpTotal > 0 ? Math.round((char.pvpWins / pvpTotal) * 100) : 0;

        const { EmbedBuilder: StatsEB, ActionRowBuilder: StatsAR, ButtonBuilder: StatsBB, ButtonStyle: StatsBS } = await import('discord.js');
        const { getClass: getClsStats } = await import('../constants/classes');
        const clsStats = getClsStats(char.class);

        const statsEmbed = new StatsEB()
          .setColor(clsStats?.color ?? 0x2ECC71)
          .setTitle(`📊 Estatísticas — ${char.username}`)
          .setDescription(`${clsStats?.emoji ?? '⚔️'} **${clsStats?.name ?? char.class}** • Nível **${char.level}** • Geração **${char.generation}**`)
          .addFields(
            {
              name: '⚔️ Batalhas PvE',
              value: [
                `Total: **${totalBattles}** batalhas`,
                `Vitórias: **${char.totalWins}** | Derrotas: **${char.totalDeaths}**`,
                `Taxa de vitória: **${winRate}%**`,
              ].join('\n'),
              inline: true,
            },
            {
              name: '👹 Monstros',
              value: `Mortos: **${char.totalKills}**\nBosses: **${char.bossKills}**`,
              inline: true,
            },
            {
              name: '⚔️ PvP',
              value: `Vitórias: **${char.pvpWins}** / Derrotas: **${char.pvpLosses}**\nTaxa PvP: **${pvpRate}%**`,
              inline: true,
            },
            {
              name: '📈 Poder de Combate',
              value: `**${stats.combatPower.toLocaleString('pt-BR')}** PC`,
              inline: true,
            },
            {
              name: '💰 Ouro em Carteira',
              value: `**${char.gold.toLocaleString('pt-BR')}**`,
              inline: true,
            },
            {
              name: '📅 Na Aliança há',
              value: `**${daysPlaying}** dia(s)`,
              inline: true,
            },
          )
          .setFooter({ text: `⚔️ Aliança Skyline RPG • Desde: ${char.createdAt.toISOString().slice(0, 10)}` });

        await i.editReply({
          embeds: [statsEmbed],
          files: [],
          components: [new StatsAR<any>().addComponents(
            new StatsBB().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(StatsBS.Secondary),
            new StatsBB().setCustomId('rpg:stats').setLabel('🔄 Atualizar').setStyle(StatsBS.Secondary),
          )],
        });
        break;
      }

      case 'meditar': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { buildMeditarEmbed, buildMeditarButtons } = await import('../panels/meditar');
        await i.editReply({ embeds: [buildMeditarEmbed(char)], files: [], components: buildMeditarButtons(char) });
        break;
      }

      case 'meditar_rapida':
      case 'meditar_media':
      case 'meditar_profunda': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { startMeditation, buildMeditarEmbed, buildMeditarButtons } = await import('../panels/meditar');
        const optId = baseAction.replace('meditar_', '');
        const result = await startMeditation(char, optId);
        const updatedChar = await getOrCreateCharacter(discordId, username);
        if (!result.success) {
          await i.editReply({ embeds: [errorEmbed('Meditação', result.message)], files: [], components: buildMeditarButtons(char) });
        } else {
          await i.editReply({ embeds: [buildMeditarEmbed(updatedChar)], files: [], components: buildMeditarButtons(updatedChar) });
        }
        break;
      }

      case 'meditar_coletar': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { collectMeditation, buildMeditarEmbed, buildMeditarButtons } = await import('../panels/meditar');
        const result = await collectMeditation(char);
        if (!result.success) {
          await i.editReply({ embeds: [errorEmbed('Meditação', result.message)], files: [] });
        } else {
          const updatedChar = await getOrCreateCharacter(discordId, username);
          const parts = [`❤️ +${result.hpGained} HP`, `⚡ +${result.energyGained} Energia`];
          if (result.buffGiven) parts.push('✨ +15% XP (1h)');
          const resultEmbed = new (await import('discord.js')).EmbedBuilder()
            .setColor(0x9B59B6).setTitle('🧘 Meditação Concluída!')
            .setDescription(parts.join(' | '));
          await i.editReply({ embeds: [resultEmbed, buildMeditarEmbed(updatedChar)], files: [], components: buildMeditarButtons(updatedChar) });
        }
        break;
      }

      case 'treinar': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { buildTreinarEmbed, buildTreinarSelect, buildTreinarButtons } = await import('../panels/treinar');
        const lastTrain = char.lastTrain;
        const onCd = lastTrain && (Date.now() - lastTrain.getTime()) < 20 * 60 * 1000;
        const embed = await buildTreinarEmbed(char);
        await i.editReply({ embeds: [embed], files: [], components: [buildTreinarSelect(!!onCd), buildTreinarButtons()] });
        break;
      }

      case 'taverna': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { buildTavernaEmbed, buildTavernaMenuSelect, buildTavernaButtons } = await import('../panels/taverna');
        await i.editReply({ embeds: [await buildTavernaEmbed(char)], files: [], components: [buildTavernaMenuSelect(), buildTavernaButtons()] });
        break;
      }

      case 'taverna_dados': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { rollTavernaDice, buildTavernaButtons } = await import('../panels/taverna');
        const { embed } = await rollTavernaDice(char);
        await i.editReply({ embeds: [embed], files: [], components: [buildTavernaButtons()] });
        break;
      }

      case 'pescaria': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { buildPescariaEmbed, buildPescariaButtons } = await import('../panels/pescaria');
        const { prisma: db } = await import('../../database/client');
        const session = await db.rpgFishingSession.findUnique({ where: { discordId } });
        const isReady = !!(session && session.reelableAt <= new Date());
        await i.editReply({
          embeds: [await buildPescariaEmbed(char)],
          files: [],
          components: buildPescariaButtons(char, !!session, isReady),
        });
        break;
      }

      case 'pesca_lancar': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { castFishingLine, buildPescariaEmbed, buildPescariaButtons } = await import('../panels/pescaria');
        const result = await castFishingLine(char);
        if (!result.success) {
          await i.editReply({ embeds: [errorEmbed('Pesca', result.message)], files: [] });
        } else {
          const updatedChar = await getOrCreateCharacter(discordId, username);
          const { prisma: db } = await import('../../database/client');
          const session = await db.rpgFishingSession.findUnique({ where: { discordId } });
          await i.editReply({
            embeds: [await buildPescariaEmbed(updatedChar)],
            files: [],
            components: buildPescariaButtons(updatedChar, !!session, false),
          });
        }
        break;
      }

      case 'pesca_puxar': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { reelFishingLine, buildPescariaEmbed, buildPescariaButtons } = await import('../panels/pescaria');
        const result = await reelFishingLine(char);
        if (!result.success) {
          await i.editReply({ embeds: [errorEmbed('Pesca', result.message!)], files: [] });
        } else {
          const updatedChar = await getOrCreateCharacter(discordId, username);
          await i.editReply({
            embeds: [result.embed!],
            files: [],
            components: buildPescariaButtons(updatedChar, false, false),
          });
        }
        break;
      }

      case 'exploracao': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { buildExploracaoEmbed, buildExploracaoButtons } = await import('../panels/exploracao');
        const lastExplore = char.lastExplore;
        const onCd = !!(lastExplore && (Date.now() - lastExplore.getTime()) < 3 * 60 * 1000);
        await i.editReply({ embeds: [await buildExploracaoEmbed(char)], files: [], components: buildExploracaoButtons(onCd) });
        break;
      }

      case 'explorar': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { doExplore, buildExploracaoEmbed, buildExploracaoButtons } = await import('../panels/exploracao');
        const result = await doExplore(char);
        if (!result.success) {
          await i.editReply({ embeds: [errorEmbed('Exploração', result.message!)], files: [] });
        } else {
          await i.editReply({ embeds: [result.embed!], files: [], components: buildExploracaoButtons(true) });
        }
        break;
      }

      case 'eventos': {
        await i.deferUpdate();
        const guildId = i.guildId ?? '';
        const { buildWorldEventsEmbed, buildWorldEventsButtons, getActiveWorldEvent } = await import('../panels/world-events');
        const { isBotOwner } = await import('../../utils/allowlist');
        const active = await getActiveWorldEvent(guildId);
        const isOwner = isBotOwner(discordId);
        const embed = await buildWorldEventsEmbed(guildId);
        const btns = buildWorldEventsButtons(guildId, isOwner, !!active, active?.eventType);
        await i.editReply({ embeds: [embed], files: [], components: btns });
        break;
      }

      case 'evento_iniciar': {
        await i.deferUpdate();
        const { isBotOwner: isBotOwnerEvt } = await import('../../utils/allowlist');
        if (!isBotOwnerEvt(discordId)) { await i.editReply({ embeds: [errorEmbed('Acesso Negado', 'Apenas donos do bot podem iniciar eventos de mundo.')], files: [] }); break; }
        const { buildEventStartSelect, buildWorldEventsEmbed } = await import('../panels/world-events');
        const guildId = i.guildId ?? '';
        const embed = await buildWorldEventsEmbed(guildId);
        await i.editReply({ embeds: [embed], files: [], components: [buildEventStartSelect()] });
        break;
      }

      case 'evento_atacar_boss': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        if (char.currentHp <= 0) { await i.editReply({ embeds: [errorEmbed('Sem HP', 'Cure-se antes de atacar o boss!')], files: [] }); break; }
        if (char.currentEnergy < 10) { await i.editReply({ embeds: [errorEmbed('Sem Energia', 'Precisa de 10⚡ para atacar!')], files: [] }); break; }
        const { damageWorldBoss, buildWorldEventsEmbed, buildWorldEventsButtons, getActiveWorldEvent } = await import('../panels/world-events');
        const { isBotOwner: isBotOwnerBoss } = await import('../../utils/allowlist');
        const guildId = i.guildId ?? '';
        const activeCheck = await getActiveWorldEvent(guildId);
        if (!activeCheck || activeCheck.eventType !== 'world_boss') {
          await i.editReply({ embeds: [errorEmbed('Sem Boss', 'Não há um Boss Apocalíptico ativo no momento!')], files: [] });
          break;
        }
        const stats = computeStats(char);
        const dmg = Math.max(10, Math.floor(stats.attack * (0.5 + Math.random() * 0.5)));
        await prisma.rpgCharacter.update({ where: { discordId }, data: { currentEnergy: Math.max(0, char.currentEnergy - 15) } });
        const result = await damageWorldBoss(guildId, discordId, dmg);
        const active = await getActiveWorldEvent(guildId);
        const embed = await buildWorldEventsEmbed(guildId);
        const btns = buildWorldEventsButtons(guildId, isBotOwnerBoss(discordId), !!active, active?.eventType);
        const fb = result.killed
          ? (await import('../../utils/embeds')).successEmbed('💀 Boss Derrotado!', result.message)
          : (await import('../../utils/embeds')).infoEmbed('⚔️ Ataque', result.message);
        await i.editReply({ embeds: [fb, embed], files: [], components: btns });
        break;
      }

      case 'missoes_classe': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { buildClassMissionsEmbed, buildClassMissionsClaimSelect, buildClassMissionsButtons } = await import('../panels/class-missions');
        const embed = await buildClassMissionsEmbed(char);
        const claimSel = await buildClassMissionsClaimSelect(discordId);
        const rows: any[] = claimSel ? [claimSel, buildClassMissionsButtons()] : [buildClassMissionsButtons()];
        await i.editReply({ embeds: [embed], files: [], components: rows });
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
    console.error(`[RPG Button Error] ID=${rawId}`, err);
    const errMsg = { embeds: [errorEmbed('Erro RPG', 'Ocorreu um erro ao processar o botão.')], files: [] };
    if (i.replied) await i.followUp({ ...errMsg, ephemeral: true }).catch(() => null);
    else if (i.deferred) await i.editReply(errMsg).catch(() => null);
    else await i.reply({ ...errMsg, ephemeral: true }).catch(() => null);
  }
}
