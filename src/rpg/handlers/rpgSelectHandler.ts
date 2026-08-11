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
        ? (await import('../../utils/embeds')).successEmbed('🐉 Boss Invocado!', result.message)
        : (await import('../../utils/embeds')).errorEmbed('Erro', result.message);
      await i.editReply({ embeds: [feedbackEmbed, bossEmbed], components: bossButtons });
      return;
    }

    switch (action) {

      // ── Seletor do Perfil RPG (Hub Principal) ───────────────────────────
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
          await i.editReply({
            embeds: [buildDungeonEmbed(char)],
            files: [],
            components: dungeonRows,
          });
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

          await i.editReply({
            embeds: [embedAtividades],
            files: [],
            components: [buildAtividadesSelectMenu(), backButton],
          });
          return;
        }

        if (option === 'viajar') {
          const select = buildTravelSelect(char);
          await i.editReply({
            embeds: [buildTravelEmbed(char)],
            files: [],
            components: select ? [select, buildTravelBackButton()] : [buildTravelBackButton()],
          });
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

          await i.editReply({
            embeds: [embedPvp],
            files: [],
            components: [backButton],
          });
          return;
        }

        if (option === 'inventario') {
          const { embed: invEmbed, select: invSelect } = await buildInventarioEmbed(char);
          await i.editReply({
            embeds: [invEmbed],
            files: [],
            components: invSelect ? [invSelect, buildInventarioButtons()] : [buildInventarioButtons()],
          });
          return;
        }

        if (option === 'cidade') {
          const { buildCidadeEmbed, buildCidadeButtons, buildCidadeButtons2 } = await import('../panels/profile');
          await i.editReply({
            embeds: [buildCidadeEmbed()],
            files: [],
            components: [buildCidadeButtons(), buildCidadeButtons2()],
          });
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
          await i.editReply({
            embeds: [missoesEmbed],
            files: [],
            components: claimSelect ? [claimSelect, buildMissoesButtons()] : [buildMissoesButtons()],
          });
          return;
        }

        if (option === 'missoes_classe') {
          const { buildClassMissionsEmbed, buildClassMissionsClaimSelect, buildClassMissionsButtons } = await import('../panels/class-missions');
          const classEmbed = await buildClassMissionsEmbed(char);
          const claimSelect = await buildClassMissionsClaimSelect(discordId);
          await i.editReply({
            embeds: [classEmbed],
            files: [],
            components: claimSelect ? [claimSelect, buildClassMissionsButtons()] : [buildClassMissionsButtons()],
          });
          return;
        }

        if (option === 'habilidades') {
          const { buildHabilidadesEmbed, buildHabilidadesButtons } = await import('../panels/skills');
          const { embed: habEmbed, select: habSelect } = buildHabilidadesEmbed(char);
          await i.editReply({
            embeds: [habEmbed],
            files: [],
            components: habSelect ? [habSelect, buildHabilidadesButtons(char)] : [buildHabilidadesButtons(char)],
          });
          return;
        }

        if (option === 'stats') {
          const { buildPontosEmbed, buildPontosSelect } = await import('../panels/profile');
          await i.editReply({
            embeds: [buildPontosEmbed(char, stats)],
            files: [],
            components: [buildPontosSelect(char.statPoints)],
          });
          return;
        }

        // Default: Re-renderiza o Perfil em Canvas
        let attachment: AttachmentBuilder | null = null;
        try {
          const avatarUrl = i.user.displayAvatarURL({ extension: 'png', size: 256 });
          const imageBuffer = await generateProfileCard(char, stats, avatarUrl);
          attachment = new AttachmentBuilder(imageBuffer, { name: 'perfil.png' });
        } catch (e) {
          console.error('Erro Canvas menu_perfil:', e);
        }

        const components = [buildProfileSelectMenu()];

        await i.editReply({
          embeds: attachment ? [] : [buildProfileEmbed(char, stats)],
          files: attachment ? [attachment] : [],
          components,
        });
        break;
      }

      // ── Submenu de Atividades ─────────────────────────────────────────────
      case 'menu_atividades': {
        await i.deferUpdate();
        const option = i.values[0];
        let char = await getOrCreateCharacter(discordId, username);

        // 🎯 Caçada de Monstros
        if (option === 'cacar') {
          const select = buildDungeonSelect(char);
          await i.editReply({
            embeds: [buildDungeonEmbed(char)],
            files: [],
            components: select ? [select, buildDungeonButtons(char)] : [buildDungeonButtons(char)],
          });
          return;
        }

        // 🧭 Explorar Região
        if (option === 'explorar') {
          const expModule: any = await import('../panels/exploracao');
          const embed = expModule.buildExploracaoEmbed ? await expModule.buildExploracaoEmbed(char) : buildDungeonEmbed(char);
          const btns = expModule.buildExploracaoButtons ? expModule.buildExploracaoButtons(char) : [buildDungeonButtons(char)];
          const components = Array.isArray(btns) ? btns : [btns];
          await i.editReply({
            embeds: [embed],
            files: [],
            components: components.filter(Boolean),
          });
          return;
        }

        // 🥊 Treinar Atributos
        if (option === 'treinar') {
          const { buildTreinarEmbed, buildTreinarSelect, buildTreinarButtons } = await import('../panels/treinar');
          const lastTrain = char.lastTrain;
          const onCd = !!(lastTrain && (Date.now() - lastTrain.getTime()) < 20 * 60 * 1000);
          await i.editReply({
            embeds: [await buildTreinarEmbed(char)],
            files: [],
            components: [buildTreinarSelect(onCd), buildTreinarButtons()],
          });
          return;
        }

        // 🎣 Pescaria
        if (option === 'pescar') {
          const pescaModule: any = await import('../panels/pescaria');
          const embed = pescaModule.buildPescaEmbed ? await pescaModule.buildPescaEmbed(char) : buildProfileEmbed(char, computeStats(char));
          const btns = pescaModule.buildPescaButtons ? pescaModule.buildPescaButtons(char) : [];
          const components = Array.isArray(btns) ? btns : [btns];
          await i.editReply({
            embeds: [embed],
            files: [],
            components: components.filter(Boolean),
          });
          return;
        }

        // 🧘 Meditar
        if (option === 'meditar') {
          const meditarModule: any = await import('../panels/meditar');
          const embed = meditarModule.buildMeditarEmbed ? await meditarModule.buildMeditarEmbed(char) : buildProfileEmbed(char, computeStats(char));
          const rawBtns = meditarModule.buildMeditarButtons ? meditarModule.buildMeditarButtons(char) : [];
          const btnComponents = Array.isArray(rawBtns) ? rawBtns : [rawBtns];
          await i.editReply({
            embeds: [embed],
            files: [],
            components: btnComponents.filter(Boolean),
          });
          return;
        }

        // 🍺 Taverna
        if (option === 'taverna') {
          const { buildTavernaEmbed, buildTavernaMenuSelect, buildTavernaButtons } = await import('../panels/taverna');
          await i.editReply({
            embeds: [await buildTavernaEmbed(char)],
            files: [],
            components: [buildTavernaMenuSelect(), buildTavernaButtons()],
          });
          return;
        }
        break;
      }

      // ── Distribuir ponto de stat ─────────────────────────────────────────
      case 'distribuir_stat': {
        await i.deferUpdate();
        const stat = i.values[0] as any;
        const result = await distributeStatPoints(discordId, stat, 1);
        const char   = await getOrCreateCharacter(discordId, username);
        const stats  = computeStats(char);
        const { buildPontosEmbed, buildPontosSelect } = await import('../panels/profile');
        if (result.success) {
          await i.editReply({
            embeds: [buildPontosEmbed(char, stats)],
            components: [buildPontosSelect(char.statPoints)],
          });
        } else {
          await i.editReply({ embeds: [errorEmbed('Erro', result.message)] });
        }
        break;
      }

      // ── Viajar para destino ──────────────────────────────────────────────
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
        await i.editReply({
          embeds: [buildTravelEmbed(char)],
          components: select ? [select, buildTravelBackButton()] : [buildTravelBackButton()],
        });
        break;
      }

      // ── Batalha dungeon com inimigo específico ───────────────────────────
      case 'dungeon_inimigo': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        if (char.currentHp <= 0) {
          await i.editReply({ embeds: [errorEmbed('Sem HP', 'Você está sem HP! Vá à cidade e se cure primeiro.')], components: [] });
          return;
        }
        if (char.currentEnergy < 10) {
          await i.editReply({ embeds: [errorEmbed('Sem Energia ⚡', `Você tem apenas **${char.currentEnergy}** de energia — mínimo para batalhar é **10**.\nVá à 🏰 Cidade → 🏥 Curar para restaurar energia.`)], components: [] });
          return;
        }
        const { embed, rows } = await doBattleEnemy(char, i.values[0], i.guildId ?? '');
        await i.editReply({ embeds: [embed], components: rows });
        break;
      }

      case 'caca_inimigo': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        if (char.currentHp <= 0 || char.currentEnergy < 10) {
          await i.editReply({ embeds: [errorEmbed('Caçada indisponível', 'Você precisa estar vivo e ter pelo menos **10⚡** para caçar.')], components: [] });
          return;
        }
        const { embed, rows } = await doBattleEnemy(char, i.values[0], i.guildId ?? '', 'hunt');
        await i.editReply({ embeds: [embed], components: rows });
        break;
      }

      // ── Categoria da loja ────────────────────────────────────────────────
      case 'loja_categoria': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const category = i.values[0];
        const itemSelect = buildShopItemSelect(char, category);
        await i.editReply({
          embeds: [buildShopEmbed(char, category)],
          components: itemSelect ? [itemSelect, buildShopButtons(category)] : [buildShopButtons(category)],
        });
        break;
      }

      // ── Comprar item na loja ─────────────────────────────────────────────
      case 'loja_comprar': {
        await i.deferUpdate();
        const itemId = i.values[0];
        const result = await buyItem(discordId, itemId);
        if (result.success) {
          await i.editReply({ embeds: [successEmbed('Compra realizada!', result.message)] });
        } else {
          await i.editReply({ embeds: [errorEmbed('Erro na compra', result.message)] });
        }
        break;
      }

      // ── Ação com item do inventário ──────────────────────────────────────
      case 'inventario_acao': {
        await i.deferUpdate();
        const itemId = i.values[0];
        const select = buildItemActionSelect(itemId);
        if (!select) {
          await i.editReply({ embeds: [errorEmbed('Erro', 'Nenhuma ação disponível para este item.')] });
          return;
        }
        const { getItem } = await import('../constants/items');
        const item = getItem(itemId);
        await i.editReply({
          embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle(`${item?.emoji ?? '❓'} ${item?.name ?? itemId}`).setDescription(item?.description ?? '').addFields(
            { name: '📊 Raridade', value: item?.rarity ?? '-', inline: true },
            { name: '💰 Venda', value: `${item?.sellPrice ?? 0} ouro`, inline: true },
            { name: '📌 Slot', value: item?.slot ?? '-', inline: true },
          )],
          components: [select],
        });
        break;
      }

      // ── Executar ação com item (equip/usar/vender) ───────────────────────
      case 'item_acao': {
        await i.deferUpdate();
        const [actionType, itemId] = i.values[0].split(':');
        let result: { success: boolean; message: string };

        if (actionType === 'equip') {
          result = await equipItem(discordId, itemId);
        } else if (actionType === 'usar') {
          result = await useConsumable(discordId, itemId);
        } else if (actionType === 'vender') {
          result = await sellItem(discordId, itemId, 1);
        } else {
          result = { success: false, message: 'Ação desconhecida.' };
        }

        const char = await getOrCreateCharacter(discordId, username);
        const { embed: invEmbed, select: invSelect } = await buildInventarioEmbed(char);

        if (result.success) {
          const { infoEmbed } = await import('../../utils/embeds');
          await i.editReply({
            embeds: [infoEmbed('✅ Concluído', result.message), invEmbed],
            components: invSelect ? [invSelect, buildInventarioButtons()] : [buildInventarioButtons()],
          });
        } else {
          await i.editReply({ embeds: [errorEmbed('Erro', result.message)] });
        }
        break;
      }

      // ── Equipar habilidade divina ─────────────────────────────────────────
      case 'equipar_skill': {
        await i.deferUpdate();
        const skillId = i.values[0];
        const { DIVINE_SKILLS } = await import('../constants/skills');
        const skill = DIVINE_SKILLS[skillId];
        if (!skill) {
          await i.editReply({ embeds: [errorEmbed('Erro', 'Habilidade inválida.')] });
          return;
        }
        const char = await getOrCreateCharacter(discordId, username);
        if (char.level < skill.unlockLevel) {
          await i.editReply({ embeds: [errorEmbed('Nível insuficiente', `Precisa ser nível ${skill.unlockLevel} para esta habilidade.`)] });
          return;
        }
        await prisma.rpgCharacter.update({
          where: { discordId },
          data: { divineSkillId: skillId, divineSkillRank: 'F', divineSkillExp: 0 },
        });
        await i.editReply({ embeds: [successEmbed('Habilidade Equipada!', `${skill.emoji} **${skill.name}** equipada com sucesso!`)] });
        break;
      }

      // ── Guilda: entrar ────────────────────────────────────────────────────
      case 'guild_entrar': {
        await i.deferUpdate();
        const guildId = i.values[0];
        const result = await joinGuild(discordId, guildId);
        await i.editReply({
          embeds: [result.success ? successEmbed('Guilda', result.message) : errorEmbed('Erro', result.message)],
        });
        break;
      }

      // ── Forja: fabricar item ──────────────────────────────────────────────
      case 'forja_receita': {
        await i.deferUpdate();
        const result = await craftItem(discordId, i.values[0]);
        await i.editReply({
          embeds: [result.success ? successEmbed('Forja', result.message) : errorEmbed('Erro na Forja', result.message)],
        });
        break;
      }

      // ── Escolher classe inicial (/rpg start) ──────────────────────────────
      case 'escolher_classe': {
        await i.deferUpdate();

        const classId = i.values[0].replace('start_class:', '');
        const { setClass } = await import('../services/character');

        const char = await getOrCreateCharacter(discordId, username);
        const result = await setClass(discordId, classId);

        if (!result.success) {
          await i.editReply({ embeds: [errorEmbed('Erro', result.message)] });
          return;
        }

        const updated = await getOrCreateCharacter(discordId, username);
        const stats   = computeStats(updated);
        const { getClass } = await import('../constants/classes');
        const cls = getClass(classId);

        await i.editReply({
          content: `${cls?.emoji ?? '⚔️'} **Personagem criado!** Bem-vindo à aventura, **${username}**!`,
          embeds: [buildProfileEmbed(updated, stats)],
          components: [buildProfileSelectMenu()],
        });
        break;
      }

      // ── Boss Mundial: escolher template ─────────────────────────────────
      case 'worldboss_template': {
        await i.deferUpdate();
        const templateIndex = parseInt(i.values[0], 10);
        const { buildWorldBossLevelSelect } = await import('../panels/worldBoss');
        const { WORLD_BOSS_TEMPLATES } = await import('../services/worldBoss');
        const template = WORLD_BOSS_TEMPLATES[templateIndex];
        const step2Embed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle(`🐉 Invocar Boss Mundial — Passo 2`)
          .setDescription(`**${template?.emoji} ${template?.name}** selecionado!\n\nEscolha a dificuldade (nível):`)
          .addFields({ name: '📋 Habilidades', value: template?.abilities.join('\n') ?? '-' });
        await i.editReply({ embeds: [step2Embed], components: [buildWorldBossLevelSelect(templateIndex)] });
        break;
      }

      // ── Missões: coletar recompensa ───────────────────────────────────────
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

        const feedbackEmbed = result.success
          ? (await import('../../utils/embeds')).successEmbed('🎁 Recompensa Coletada!', `${result.message}\n+**${result.xp}** XP | +**${result.coins}** 🪙`)
          : (await import('../../utils/embeds')).errorEmbed('Erro', result.message);

        const missaoRows: any[] = claimSelect ? [claimSelect, buildMissoesButtons()] : [buildMissoesButtons()];
        await i.editReply({ embeds: [feedbackEmbed, missoesEmbed], components: missaoRows });
        break;
      }

      // ── 🥊 Treinar: escolher stat ─────────────────────────────────────────
      case 'treinar_stat': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { doTrain, buildTreinarEmbed, buildTreinarSelect, buildTreinarButtons } = await import('../panels/treinar');
        const result = await doTrain(char, i.values[0]);
        const updatedChar = await getOrCreateCharacter(discordId, username);
        const lastTrain = updatedChar.lastTrain;
        const onCd = !!(lastTrain && (Date.now() - lastTrain.getTime()) < 20 * 60 * 1000);
        const embed = await buildTreinarEmbed(updatedChar);
        const fb = result.success
          ? (await import('../../utils/embeds')).successEmbed('🥊 Treino!', result.message)
          : (await import('../../utils/embeds')).errorEmbed('Treino', result.message);
        await i.editReply({ embeds: [fb, embed], components: [buildTreinarSelect(onCd), buildTreinarButtons()] });
        break;
      }

      // ── 🍺 Taverna: pedir item ────────────────────────────────────────────
      case 'taverna_pedir': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { buyTavernaItem, buildTavernaEmbed, buildTavernaMenuSelect, buildTavernaButtons } = await import('../panels/taverna');
        const result = await buyTavernaItem(char, i.values[0]);
        const updatedChar = await getOrCreateCharacter(discordId, username);
        const fb = result.success
          ? (await import('../../utils/embeds')).successEmbed('🍺 Taverna!', result.message)
          : (await import('../../utils/embeds')).errorEmbed('Taverna', result.message);
        await i.editReply({ embeds: [fb, await buildTavernaEmbed(updatedChar)], components: [buildTavernaMenuSelect(), buildTavernaButtons()] });
        break;
      }

      // ── ⚔️ Dungeon tipo: escolher ─────────────────────────────────────────
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

      // ── 📜 Missões de classe: coletar ─────────────────────────────────────
      case 'class_mission_claim': {
        await i.deferUpdate();
        const char = await getOrCreateCharacter(discordId, username);
        const { claimClassMission } = await import('../services/class-missions');
        const { buildClassMissionsEmbed, buildClassMissionsClaimSelect, buildClassMissionsButtons } = await import('../panels/class-missions');
        const result = await claimClassMission(discordId, i.values[0]);
        const embed = await buildClassMissionsEmbed(char);
        const claimSel = await buildClassMissionsClaimSelect(discordId);
        const rows: any[] = claimSel ? [claimSel, buildClassMissionsButtons()] : [buildClassMissionsButtons()];
        const fb = result.success
          ? (await import('../../utils/embeds')).successEmbed('🎁 Missão!', `${result.message}\n+**${result.xp}** XP | +**${result.gold}** 🪙 | +**${result.energy}** ⚡`)
          : (await import('../../utils/embeds')).errorEmbed('Missão', result.message);
        await i.editReply({ embeds: [fb, embed], components: rows });
        break;
      }

      // ── 🌎 Evento mundial: iniciar ────────────────────────────────────────
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
        const fb = result.success
          ? (await import('../../utils/embeds')).successEmbed('🌎 Evento!', result.message)
          : (await import('../../utils/embeds')).errorEmbed('Evento', result.message);
        await i.editReply({ embeds: [fb, embed], components: btns });
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
