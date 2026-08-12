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
  const rawId = i.customId;

  try {
    // ── Equipar Múltiplas Habilidades de Classe ──────────────────────────
    if (rawId.includes('equipar_multiplas_skills')) {
      await i.deferUpdate();
      await prisma.rpgCharacter.update({
        where: { discordId },
        data: { equippedSkills: i.values }
      });
      const char = await getOrCreateCharacter(discordId, username);
      const { embed, components } = await buildHabilidadesEmbed(char, 'classe');
      await i.editReply({ embeds: [embed], components });
      await i.followUp({ embeds: [successEmbed('Habilidades Atualizadas', 'Suas habilidades foram equipadas para combate com sucesso!')], ephemeral: true });
      return;
    }

    // ── Evoluir Talentos Passivos ──────────────────────────────────────────
    if (rawId.includes('evoluir_talento')) {
      await i.deferUpdate();
      const talentId = i.values[0].replace('talent:', '');
      const talent = PASSIVE_TALENTS[talentId];
      if (!talent) return;

      let char = await getOrCreateCharacter(discordId, username);
      
      let currentTalents: Record<string, number> = {};
      if (char.talentLevels) {
        try {
          currentTalents = typeof char.talentLevels === 'string' ? JSON.parse(char.talentLevels) : char.talentLevels;
        } catch { currentTalents = {}; }
      }
      const currentLvl = currentTalents[talentId] ?? 0;

      if (currentLvl >= talent.maxLevel) {
        await i.followUp({ embeds: [errorEmbed('Nível Máximo', 'Este talento já está no nível máximo!')], ephemeral: true });
        return;
      }
      if (char.skillPoints < talent.costPerLevel) {
        await i.followUp({ embeds: [errorEmbed('Pontos Insuficientes', `Você precisa de **${talent.costPerLevel} pts** para evoluir este talento!`)], ephemeral: true });
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
      
      await i.editReply({ embeds: [embed], components });
      await i.followUp({ embeds: [successEmbed('Talento Evoluído!', `**${talent.name}** subiu para o Nível **${currentLvl + 1}**!`)], ephemeral: true });
      return;
    }

    // Extrai o nome da ação base ignorando prefixos adicionais
    const baseAction = rawId.replace(/^rpg_select:/, '').replace(/^rpg:/, '').split(':')[0];

    if (baseAction === 'worldboss_level') {
      await i.deferUpdate();
      const templateIndex = parseInt(rawId.split(':').pop() ?? '0', 10);
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

    switch (baseAction) {
      case 'menu_perfil': {
        await i.deferUpdate();
        const option = i.values[0];
        let char = await getOrCreateCharacter(discordId, username);
        const stats = computeStats(char);

        if (option === 'dungeon') {
          char = await applyPassiveEnergyRegen(char);
          const { buildDungeonTypeSelect } = await import('../panels/dungeon-tipo');
          const select = buildDungeonSelect(char);
          const typeSelect = buildDungeonTypeSelect(char);
          const dungeonRows: ActionRowBuilder<any>[] = [];
          if (select) dungeonRows.push(select);
          if (typeSelect) dungeonRows.push(typeSelect);
          dungeonRows.push(buildDungeonButtons(char));
          await i.editReply({ embeds: [buildDungeonEmbed(char)], files: [], components: dungeonRows });
          return;
        }

        if (option === 'atividades') {
          const embedAtividades = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🎯 Central de Atividades do Aventureiro')
            .setDescription('Escolha qual atividade deseja realizar agora no reino:')
            .addFields(
              { name: '🎯 Caçada', value: 'Batalhe contra monstros selvagens da sua localização.', inline: true },
              { name: '🧭 Explorar Região', value: 'Explore áreas do mapa em busca de eventos e recursos.', inline: true },
              { name: '🥊 Treinar', value: 'Fortaleça seus atributos físicos e mágicos.', inline: true },
              { name: '🎣 Pescaria', value: 'Pesque peixes valiosos e itens raros no lago.', inline: true },
              { name: '🧘 Meditar', value: 'Descanse para restaurar HP e Energia.', inline: true },
              { name: '🍺 Taverna', value: 'Consuma comidas e bebidas de suporte.', inline: true },
            )
            .setFooter({ text: '⚔️ Aliança Skyline RPG — Atividades' });

          const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar ao Perfil').setStyle(ButtonStyle.Secondary)
          );

          await i.editReply({ embeds: [embedAtividades], files: [], components: [buildAtividadesSelectMenu(), backButton] });
          return;
        }

        if (option === 'viajar') {
          const select = buildTravelSelect(char);
          await i.editReply({ embeds: [buildTravelEmbed(char)], files: [], components: select ? [select, buildTravelBackButton()] : [buildTravelBackButton()] });
          return;
        }

        if (option === 'pvp') {
          const embedPvp = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('⚔️ Arena de Batalha PvP')
            .setDescription('Para desafiar outro jogador em tempo real no servidor, utilize o comando:\n\n`/rpg pvp alvo:@jogador`')
            .setFooter({ text: '⚔️ Aliança Skyline RPG — PvP' });

          const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar ao Perfil').setStyle(ButtonStyle.Secondary)
          );

          await i.editReply({ embeds: [embedPvp], files: [], components: [backButton] });
          return;
        }

        if (option === 'inventario') {
          const { embed: invEmbed, select: invSelect } = await buildInventarioEmbed(char);
          await i.editReply({ embeds: [invEmbed], files: [], components: invSelect ? [invSelect, buildInventarioButtons()] : [buildInventarioButtons()] });
          return;
        }

        if (option === 'cidade') {
          const { buildCidadeEmbed, buildCidadeButtons, buildCidadeButtons2 } = await import('../panels/profile');
          await i.editReply({ embeds: [buildCidadeEmbed()], files: [], components: [buildCidadeButtons(), buildCidadeButtons2()] });
          return;
        }

        if (option === 'missoes') {
          const { ensureDailyMissions, ensureWeeklyMissions } = await import('../../commands/utility/missoes');
          const { buildMissoesEmbed, buildMissoesClaimSelect, buildMissoesButtons } = await import('../panels/missoes');
          const guildId = i.guildId ?? '';
          await Promise.all([ensureDailyMissions(discordId, guildId), ensureWeeklyMissions(discordId, guildId)]);
          const [missoesEmbed, claimSelect] = await Promise.all([
            buildMissoesEmbed(discordId, guildId),
            buildMissoesClaimSelect(discordId, guildId),
          ]);
          await i.editReply({ embeds: [missoesEmbed], files: [], components: claimSelect ? [claimSelect, buildMissoesButtons()] : [buildMissoesButtons()] });
          return;
        }

        if (option === 'missoes_classe') {
          const { buildClassMissionsEmbed, buildClassMissionsClaimSelect, buildClassMissionsButtons } = await import('../panels/class-missions');
          const classEmbed = await buildClassMissionsEmbed(char);
          const claimSelect = await buildClassMissionsClaimSelect(discordId);
          await i.editReply({ embeds: [classEmbed], files: [], components: claimSelect ? [claimSelect, buildClassMissionsButtons()] : [buildClassMissionsButtons()] });
          return;
        }

        if (option === 'habilidades') {
          const { embed: habEmbed, components: habComponents } = await buildHabilidadesEmbed(char, 'classe');
          await i.editReply({ embeds: [habEmbed], files: [], components: habComponents });
          return;
        }

        if (option === 'stats') {
          const { buildPontosEmbed, buildPontosSelect } = await import('../panels/profile');
          await i.editReply({ embeds: [buildPontosEmbed(char, stats)], files: [], components: [buildPontosSelect(char.statPoints)] });
          return;
        }

        // Default: Re-renderiza o Perfil em Canvas
        let attachment: AttachmentBuilder | null = null;
        try {
          const avatarUrl = i.user.displayAvatarURL({ extension: 'png', size: 256 });
          const imageBuffer = await generateProfileCard(char, stats, avatarUrl);
          attachment = new AttachmentBuilder(imageBuffer, { name: 'perfil.png' });
        } catch (e) { console.error('Erro Canvas menu_perfil:', e); }

        const components = [buildProfileSelectMenu()];

        await i.editReply({ embeds: attachment ? [] : [buildProfileEmbed(char, stats)], files: attachment ? [attachment] : [], components });
        break;
      }

      case 'menu_atividades': {
        await i.deferUpdate();
        const option = i.values[0];
        let char = await getOrCreateCharacter(discordId, username);

        if (option === 'cacar') {
          if (char.currentHp <= 0 || char.currentEnergy < 10) {
            await i.editReply({ embeds: [errorEmbed('Caçada indisponível', 'Você precisa estar vivo e ter pelo menos **10⚡** para caçar.')] });
            return;
          }
          
          const { getEnemiesForLocation } = await import('../constants/enemies');
          const localEnemies = getEnemiesForLocation(char.currentLocation, char.level);
          
          if (!localEnemies || localEnemies.length === 0) {
            await i.editReply({ embeds: [errorEmbed('Nenhum inimigo encontrado', 'Não há monstros selvagens para caçar neste local no momento.')] });
            return;
          }

          const randomEnemy = localEnemies[Math.floor(Math.random() * localEnemies.length)];
          const { embed, rows } = await doBattleEnemy(char, randomEnemy.id, i.guildId ?? '', 'hunt');
          await i.editReply({ embeds: [embed], files: [], components: rows });
          return;
        }

        if (option === 'explorar') {
          const expModule: any = await import('../panels/exploracao');
          const embed = expModule.buildExploracaoEmbed ? await expModule.buildExploracaoEmbed(char) : buildDungeonEmbed(char);
          const btns = expModule.buildExploracaoButtons ? expModule.buildExploracaoButtons(char) : [buildDungeonButtons(char)];
          const components = Array.isArray(btns) ? btns : [btns];
          await i.editReply({ embeds: [embed], files: [], components: components.filter(Boolean) });
          return;
        }

        if (option === 'treinar') {
          const { buildTreinarEmbed, buildTreinarSelect, buildTreinarButtons } = await import('../panels/treinar');
          const lastTrain = char.lastTrain;
          const onCd = !!(lastTrain && (Date.now() - lastTrain.getTime()) < 20 * 60 * 1000);
          await i.editReply({ embeds: [await buildTreinarEmbed(char)], files: [], components: [buildTreinarSelect(onCd), buildTreinarButtons()] });
          return;
        }

        if (option === 'pescar') {
          const pescaModule: any = await import('../panels/pescaria');
          const embed = pescaModule.buildPescaEmbed ? await pescaModule.buildPescaEmbed(char) : buildProfileEmbed(char, computeStats(char));
          const btns = pescaModule.buildPescaButtons ? pescaModule.buildPescaButtons(char) : [];
          const components = Array.isArray(btns) ? btns : [btns];
          await i.editReply({ embeds: [embed], files: [], components: components.filter(Boolean) });
          return;
        }

        if (option === 'meditar') {
          const meditarModule: any = await import('../panels/meditar');
          const embed = meditarModule.buildMeditarEmbed ? await meditarModule.buildMeditarEmbed(char) : buildProfileEmbed(char, computeStats(char));
          const rawBtns = meditarModule.buildMeditarButtons ? meditarModule.buildMeditarButtons(char) : [];
          const btnComponents = Array.isArray(rawBtns) ? rawBtns : [rawBtns];
          await i.editReply({ embeds: [embed], files: [], components: btnComponents.filter(Boolean) });
          return;
        }

        if (option === 'taverna') {
          const { buildTavernaEmbed, buildTavernaMenuSelect, buildTavernaButtons } = await import('../panels/taverna');
          await i.editReply({ embeds: [await buildTavernaEmbed(char)], files: [], components: [buildTavernaMenuSelect(), buildTavernaButtons()] });
          return;
        }
        break;
      }

      case 'distribuir_stat': {
        await i.deferUpdate();
        const stat = i.values[0] as any;
        const result = await distributeStatPoints(discordId, stat, 1);
        const char   = await getOrCreateCharacter(discordId, username);
        const stats  = computeStats(char);
        const { buildPontosEmbed, buildPontosSelect } = await import('../panels/profile');
        if (result.success) {
          await i.editReply({ embeds: [buildPontosEmbed(char, stats)], components: [buildPontosSelect(char.statPoints)] });
        } else {
          await i.editReply({ embeds: [errorEmbed('Erro', result.message)] });
        }
        break;
      }

      case 'viajar_destino': {
        await i.deferUpdate();
        let char = await getOrCreateCharacter(discordId, username);
        const result = await travelTo(char, i.values[0]);
        if (!result.success) {
          await i.editReply({ embeds: [errorEmbed('Viagem falhou', result.message)] });
          return;
        }
        char = await getOrCreateCharacter(discordId, username);
        const select = buildTravelSelect(char);
        await i.editReply({ embeds: [buildTravelEmbed(char)], components: select ? [select, buildTravelBackButton()] : [buildTravelBackButton()] });
        break;
      }

      case 'dungeon_inimigo': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        if (char.currentHp <= 0) { await i.editReply({ embeds: [errorEmbed('Sem HP', 'Você está sem HP! Vá à cidade e se cure primeiro.')], components: [] }); return; }
        if (char.currentEnergy < 10) { await i.editReply({ embeds: [errorEmbed('Sem Energia ⚡', `Você tem apenas **${char.currentEnergy}** de energia — mínimo para batalhar é **10**.\nVá à 🏰 Cidade → 🏥 Curar para restaurar energia.`)], components: [] }); return; }
        const { embed, rows } = await doBattleEnemy(char, i.values[0], i.guildId ?? '');
        await i.editReply({ embeds: [embed], components: rows });
        break;
      }

      case 'caca_inimigo': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        if (char.currentHp <= 0 || char.currentEnergy < 10) { await i.editReply({ embeds: [errorEmbed('Caçada indisponível', 'Você precisa estar vivo e ter pelo menos **10⚡** para caçar.')], components: [] }); return; }
        const { embed, rows } = await doBattleEnemy(char, i.values[0], i.guildId ?? '', 'hunt');
        await i.editReply({ embeds: [embed], components: rows });
        break;
      }

      case 'loja_categoria': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const category = i.values[0];
        const itemSelect = buildShopItemSelect(char, category);
        await i.editReply({ embeds: [buildShopEmbed(char, category)], components: itemSelect ? [itemSelect, buildShopButtons(category)] : [buildShopButtons(category)] });
        break;
      }

      case 'loja_comprar': {
        await i.deferUpdate();
        const itemId = i.values[0];
        const result = await buyItem(discordId, itemId);
        if (result.success) { await i.editReply({ embeds: [successEmbed('Compra realizada!', result.message)] }); } 
        else { await i.editReply({ embeds: [errorEmbed('Erro na compra', result.message)] }); }
        break;
      }

      case 'inventario_acao': {
        await i.deferUpdate();
        const itemId = i.values[0];
        const select = buildItemActionSelect(itemId);
        if (!select) { await i.editReply({ embeds: [errorEmbed('Erro', 'Nenhuma ação disponível para este item.')] }); return; }
        const { getItem } = await import('../constants/items');
        const item = getItem(itemId);
        await i.editReply({
          embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle(`${item?.emoji ?? '❓'} ${item?.name ?? itemId}`).setDescription(item?.description ?? '').addFields(
            { name: '📊 Raridade', value: item?.rarity ?? '-', inline: true }, { name: '💰 Venda', value: `${item?.sellPrice ?? 0} ouro`, inline: true }, { name: '📌 Slot', value: item?.slot ?? '-', inline: true }
          )], components: [select]
        });
        break;
      }

      case 'item_acao': {
        await i.deferUpdate();
        const [actionType, itemId] = i.values[0].split(':');
        let result: { success: boolean; message: string };

        if (actionType === 'equip') { result = await equipItem(discordId, itemId); } 
        else if (actionType === 'usar') { result = await useConsumable(discordId, itemId); } 
        else if (actionType === 'vender') { result = await sellItem(discordId, itemId, 1); } 
        else { result = { success: false, message: 'Ação desconhecida.' }; }

        const char = await getOrCreateCharacter(discordId, username);
        const { embed: invEmbed, select: invSelect } = await buildInventarioEmbed(char);

        if (result.success) {
          const { infoEmbed } = await import('../../utils/embeds');
          await i.editReply({ embeds: [infoEmbed('✅ Concluído', result.message), invEmbed], components: invSelect ? [invSelect, buildInventarioButtons()] : [buildInventarioButtons()] });
        } else { await i.editReply({ embeds: [errorEmbed('Erro', result.message)] }); }
        break;
      }

      case 'guild_entrar': {
        await i.deferUpdate();
        const guildId = i.values[0];
        const result = await joinGuild(discordId, guildId);
        await i.editReply({ embeds: [result.success ? successEmbed('Guilda', result.message) : errorEmbed('Erro', result.message)] });
        break;
      }

      case 'forja_receita': {
        await i.deferUpdate();
        const result = await craftItem(discordId, i.values[0]);
        await i.editReply({ embeds: [result.success ? successEmbed('Forja', result.message) : errorEmbed('Erro na Forja', result.message)] });
        break;
      }

      case 'escolher_classe': {
        await i.deferUpdate();
        const classId = i.values[0].replace('start_class:', '');
        const { setClass } = await import('../services/character');
        const result = await setClass(discordId, classId);
        if (!result.success) { await i.editReply({ embeds: [errorEmbed('Erro', result.message)] }); return; }
        const updated = await getOrCreateCharacter(discordId, username);
        const stats   = computeStats(updated);
        const { getClass } = await import('../constants/classes');
        const cls = getClass(classId);
        await i.editReply({ content: `${cls?.emoji ?? '⚔️'} **Personagem criado!** Bem-vindo à aventura, **${username}**!`, embeds: [buildProfileEmbed(updated, stats)], components: [buildProfileSelectMenu()] });
        break;
      }

      case 'worldboss_template': {
        await i.deferUpdate();
        const templateIndex = parseInt(i.values[0], 10);
        const { buildWorldBossLevelSelect } = await import('../panels/worldBoss');
        const { WORLD_BOSS_TEMPLATES } = await import('../services/worldBoss');
        const template = WORLD_BOSS_TEMPLATES[templateIndex];
        const step2Embed = new EmbedBuilder().setColor(0xE74C3C).setTitle(`🐉 Invocar Boss Mundial — Passo 2`).setDescription(`**${template?.emoji} ${template?.name}** selecionado!\n\nEscolha a dificuldade (nível):`).addFields({ name: '📋 Habilidades', value: template?.abilities.join('\n') ?? '-' });
        await i.editReply({ embeds: [step2Embed], components: [buildWorldBossLevelSelect(templateIndex)] });
        break;
      }

      case 'missao_coletar': {
        await i.deferUpdate();
        const [missionType, missionId] = i.values[0].split(':');
        const guildId = i.guildId ?? '';
        let result: { success: boolean; message: string; xp?: number; coins?: number };

        if (missionType === 'daily') {
          const { claimDailyReward } = await import('../../commands/utility/missoes');
          result = await claimDailyReward(missionId, discordId, guildId);
        } else {
          const { claimWeeklyReward } = await import('../../commands/utility/missoes');
          result = await claimWeeklyReward(missionId, discordId, guildId);
        }

        const { ensureDailyMissions, ensureWeeklyMissions } = await import('../../commands/utility/missoes');
        const { buildMissoesEmbed, buildMissoesClaimSelect, buildMissoesButtons } = await import('../panels/missoes');
        await Promise.all([ensureDailyMissions(discordId, guildId), ensureWeeklyMissions(discordId, guildId)]);
        const [missoesEmbed, claimSelect] = await Promise.all([
          buildMissoesEmbed(discordId, guildId),
          buildMissoesClaimSelect(discordId, guildId),
        ]);

        const feedbackEmbed = result.success ? successEmbed('🎁 Recompensa Coletada!', `${result.message}\n+**${result.xp}** XP | +**${result.coins}** 🪙`) : errorEmbed('Erro', result.message);
        await i.editReply({ embeds: [feedbackEmbed, missoesEmbed], components: claimSelect ? [claimSelect, buildMissoesButtons()] : [buildMissoesButtons()] });
        break;
      }

      case 'treinar_stat': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { doTrain, buildTreinarEmbed, buildTreinarSelect, buildTreinarButtons } = await import('../panels/treinar');
        const result = await doTrain(char, i.values[0]);
        const updatedChar = await getOrCreateCharacter(discordId, username);
        const lastTrain = updatedChar.lastTrain;
        const onCd = !!(lastTrain && (Date.now() - lastTrain.getTime()) < 20 * 60 * 1000);
        const embed = await buildTreinarEmbed(updatedChar);
        const fb = result.success ? successEmbed('🥊 Treino!', result.message) : errorEmbed('Treino', result.message);
        await i.editReply({ embeds: [fb, embed], components: [buildTreinarSelect(onCd), buildTreinarButtons()] });
        break;
      }

      case 'taverna_pedir': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { buyTavernaItem, buildTavernaEmbed, buildTavernaMenuSelect, buildTavernaButtons } = await import('../panels/taverna');
        const result = await buyTavernaItem(char, i.values[0]);
        const updatedChar = await getOrCreateCharacter(discordId, username);
        const fb = result.success ? successEmbed('🍺 Taverna!', result.message) : errorEmbed('Taverna', result.message);
        await i.editReply({ embeds: [fb, await buildTavernaEmbed(updatedChar)], components: [buildTavernaMenuSelect(), buildTavernaButtons()] });
        break;
      }

      case 'dungeon_tipo_escolher': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        if (char.currentHp <= 0) { await i.editReply({ embeds: [errorEmbed('Sem HP', 'Cure-se antes de entrar na dungeon.')] }); break; }
        if (char.currentEnergy < 12) { await i.editReply({ embeds: [errorEmbed('Sem Energia ⚡', `Precisa de **12⚡** para entrar nesta dungeon. Você tem **${char.currentEnergy}⚡**.`)] }); break; }
        const { doBattleWithType } = await import('../panels/dungeon-tipo');
        const { embed, rows } = await doBattleWithType(char, i.values[0], true, undefined, i.guildId ?? '');
        await i.editReply({ embeds: [embed], components: rows });
        break;
      }

      case 'class_mission_claim': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { claimClassMission } = await import('../services/class-missions');
        const { buildClassMissionsEmbed, buildClassMissionsClaimSelect, buildClassMissionsButtons } = await import('../panels/class-missions');
        const result = await claimClassMission(discordId, i.values[0]);
        const embed = await buildClassMissionsEmbed(char);
        const claimSel = await buildClassMissionsClaimSelect(discordId);
        const fb = result.success ? successEmbed('🎁 Missão!', `${result.message}\n+**${result.xp}** XP | +**${result.gold}** 🪙 | +**${result.energy}** ⚡`) : errorEmbed('Missão', result.message);
        await i.editReply({ embeds: [fb, embed], components: claimSel ? [claimSel, buildClassMissionsButtons()] : [buildClassMissionsButtons()] });
        break;
      }

      case 'evento_tipo': {
        await i.deferUpdate();
        const { isBotOwner } = await import('../../utils/allowlist');
        if (!isBotOwner(i.user.id)) { await i.editReply({ embeds: [errorEmbed('Acesso Negado', 'Apenas donos do bot podem iniciar eventos de mundo.')] }); break; }
        const guildId = i.guildId ?? '';
        const { startWorldEvent, buildWorldEventsEmbed, buildWorldEventsButtons, getActiveWorldEvent } = await import('../panels/world-events');
        const result = await startWorldEvent(guildId, i.values[0]);
        const active = await getActiveWorldEvent(guildId);
        const embed = await buildWorldEventsEmbed(guildId);
        const btns = buildWorldEventsButtons(guildId, true, !!active, active?.eventType);
        const fb = result.success ? successEmbed('🌎 Evento!', result.message) : errorEmbed('Evento', result.message);
        await i.editReply({ embeds: [fb, embed], components: btns });
        break;
      }

      default:
        await i.editReply({ embeds: [errorEmbed('Ação desconhecida', `Select RPG \`${baseAction}\` não encontrado.`)] });
    }
  } catch (err) {
    console.error(`[RPG Select Error] ID=${rawId}`, err);
    const errMsg = { embeds: [errorEmbed('Erro RPG', 'Ocorreu um erro ao processar a seleção.')] };
    if (i.replied) await i.followUp({ ...errMsg, ephemeral: true }).catch(() => null);
    else if (i.deferred) await i.editReply(errMsg).catch(() => null);
    else await i.reply({ ...errMsg, ephemeral: true }).catch(() => null);
  }
}
