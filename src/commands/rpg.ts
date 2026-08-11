// ═══════════════════════════════════════════════════════════════════════
// COMANDO /rpg — Ponto de entrada do sistema RPG
// ═══════════════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder,
} from 'discord.js';
import { Command } from '../types';
import { getOrCreateCharacter, getCharacter, computeStats } from '../rpg/services/character';
import { buildProfileEmbed } from '../rpg/panels/profile';
import { TIER1_CLASSES } from '../rpg/constants/classes';
import { runPvp } from '../rpg/services/combat';
import { errorEmbed, successEmbed } from '../utils/embeds';
import { prisma } from '../database/client';
import { generateProfileCard } from '../rpg/utils/profileCanvas';

export function buildProfileSelectMenu(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:menu_perfil')
      .setPlaceholder('📍 Navegar pelo Hub do Aventureiro...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('⚔️ Entrar na Dungeon').setValue('dungeon').setDescription('Explorar dungeons e batalhar contra monstros'),
        new StringSelectMenuOptionBuilder().setLabel('🎒 Inventário').setValue('inventario').setDescription('Ver seus itens e equipamentos'),
        new StringSelectMenuOptionBuilder().setLabel('🏰 Ir para a Cidade').setValue('cidade').setDescription('Acessar lojas, forja e guilda'),
        new StringSelectMenuOptionBuilder().setLabel('📋 Painel de Missões').setValue('missoes').setDescription('Ver suas missões diárias e semanais'),
        new StringSelectMenuOptionBuilder().setLabel('📜 Missões de Classe').setValue('missoes_classe').setDescription('Ver suas missões exclusivas de classe'),
        new StringSelectMenuOptionBuilder().setLabel('✨ Habilidades').setValue('habilidades').setDescription('Gerenciar suas habilidades divinas'),
        new StringSelectMenuOptionBuilder().setLabel('📊 Distribuir Pontos').setValue('stats').setDescription('Atribuir pontos de atributo acumulados'),
      )
  );
}

export default {
  category: 'rpg',
  data: new SlashCommandBuilder()
    .setName('rpg')
    .setDescription('Sistema RPG da Aliança Skyline')
    .addSubcommand(sub => sub.setName('perfil').setDescription('Ver seu perfil RPG'))
    .addSubcommand(sub => sub.setName('start').setDescription('Criar seu personagem RPG'))
    .addSubcommand(sub => sub.setName('pvp').setDescription('Desafiar outro jogador').addUserOption(o => o.setName('alvo').setDescription('Jogador a desafiar').setRequired(true)))
    .addSubcommand(sub => sub.setName('rank').setDescription('Ranking de poder de combate'))
    .addSubcommand(sub => sub.setName('reencarnar').setDescription('Reencarnar (nível 50+)'))
    .addSubcommand(sub => sub.setName('info').setDescription('Info sobre uma classe').addStringOption(o => o.setName('classe').setDescription('ID da classe').setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    const { isFeatureEnabled, featureDisabledMsg } = await import('../utils/features');
    if (interaction.guildId && !(await isFeatureEnabled(interaction.guildId, 'featRpg'))) {
      return interaction.reply({ content: featureDisabledMsg('featRpg'), ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const discordId = interaction.user.id;
    const username  = interaction.user.username;

    // ── /rpg perfil ──────────────────────────────────────────────────────────
    if (sub === 'perfil') {
      await interaction.deferReply({ ephemeral: true });
      const char = await getOrCreateCharacter(discordId, username);
      const stats = computeStats(char);

      let attachment: AttachmentBuilder | null = null;

      try {
        const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
        const imageBuffer = await generateProfileCard(char, stats, avatarUrl);
        attachment = new AttachmentBuilder(imageBuffer, { name: 'perfil.png' });
      } catch (err) {
        console.error('Erro ao gerar perfil em Canvas:', err);
      }

      const components = [buildProfileSelectMenu()];

      if (!attachment) {
        await interaction.editReply({
          embeds: [buildProfileEmbed(char, stats)],
          files: [],
          components,
        });
        return;
      }

      await interaction.editReply({
        embeds: [],
        files: [attachment],
        components,
      });
      return;
    }

    // ── /rpg start ───────────────────────────────────────────────────────────
    if (sub === 'start') {
      await interaction.deferReply({ ephemeral: true });

      const existing = await getCharacter(discordId);
      if (existing) {
        const stats = computeStats(existing);
        await interaction.editReply({
          content: '> Você já tem um personagem! Aqui está seu perfil:',
          embeds: [buildProfileEmbed(existing, stats)],
          components: [buildProfileSelectMenu()],
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚔️ Bem-vindo ao RPG da Aliança Skyline!')
        .setDescription(
          'Escolha sua classe inicial para começar sua jornada.\n' +
          'Você poderá evoluir para classes avançadas ao atingir nível 20!\n\n' +
          TIER1_CLASSES.map(c =>
            `${c.emoji} **${c.name}** — ${c.description}\n> FOR:${c.baseStats.str} AGI:${c.baseStats.agi} INT:${c.baseStats.int} VIT:${c.baseStats.vit} SOR:${c.baseStats.lck}`
          ).join('\n\n')
        )
        .setFooter({ text: '⚔️ Aliança Skyline RPG — Escolha com sabedoria!' });

      const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rpg_select:escolher_classe')
          .setPlaceholder('Selecione sua classe inicial...')
          .addOptions(
            TIER1_CLASSES.map(c =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`${c.name}`)
                .setValue(`start_class:${c.id}`)
                .setEmoji(c.emoji.trim())
                .setDescription(c.description.slice(0, 100))
            )
          )
      );

      await interaction.editReply({ embeds: [embed], components: [select] });
      return;
    }

    // ── /rpg pvp ─────────────────────────────────────────────────────────────
    if (sub === 'pvp') {
      await interaction.deferReply({ ephemeral: false });
      const target = interaction.options.getUser('alvo', true);

      if (target.id === discordId) {
        await interaction.editReply({ embeds: [errorEmbed('PvP', 'Você não pode lutar contra si mesmo!')] });
        return;
      }
      if (target.bot) {
        await interaction.editReply({ embeds: [errorEmbed('PvP', 'Bots não participam de PvP!')] });
        return;
      }

      const [attacker, defender] = await Promise.all([
        getCharacter(discordId),
        getCharacter(target.id),
      ]);

      if (!attacker) {
        await interaction.editReply({ embeds: [errorEmbed('PvP', 'Você ainda não criou seu personagem! Use `/rpg start`.')] });
        return;
      }
      if (!defender) {
        await interaction.editReply({ embeds: [errorEmbed('PvP', `**${target.username}** ainda não tem personagem RPG.`)] });
        return;
      }
      if (!attacker.pvpEnabled || !defender.pvpEnabled) {
        await interaction.editReply({ embeds: [errorEmbed('PvP', 'Um dos jogadores está com PvP desativado.')] });
        return;
      }

      const pvpCd = attacker.lastPvp && (Date.now() - attacker.lastPvp.getTime()) < 10 * 60 * 1000;
      if (pvpCd) {
        await interaction.editReply({ embeds: [errorEmbed('Cooldown PvP', 'Aguarde 10 minutos entre batalhas PvP.')] });
        return;
      }

      const pvpResult = await runPvp(attacker, defender);
      const color = pvpResult.winner === discordId ? 0x27AE60 : 0xE74C3C;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('⚔️ Resultado do PvP')
        .setDescription(pvpResult.log.slice(-10).join('\n'))
        .addFields(
          { name: '🏆 Vencedor', value: `<@${pvpResult.winner}>`, inline: true },
          { name: '⭐ XP Ganho', value: `+${pvpResult.xpGained}`, inline: true },
          { name: '💰 Ouro', value: `+${pvpResult.goldStolen}`, inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ── /rpg rank ─────────────────────────────────────────────────────────────
    if (sub === 'rank') {
      await interaction.deferReply({ ephemeral: true });
      const top = await prisma.rpgCharacter.findMany({
        orderBy: { level: 'desc' },
        take: 15,
      });

      const { getClass } = await import('../rpg/constants/classes');

      const lines = top.map((c, i) => {
        const cls = getClass(c.class);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
        return `${medal} **${c.username}** — Nv.${c.level} ${cls?.emoji ?? ''} ${cls?.name ?? c.class}`;
      }).join('\n') || '*Nenhum personagem ainda.*';

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('🏆 Ranking RPG — Top Aventureiros')
          .setDescription(lines)
          .setFooter({ text: '⚔️ Aliança Skyline RPG' })],
      });
      return;
    }

    // ── /rpg reencarnar ──────────────────────────────────────────────────────
    if (sub === 'reencarnar') {
      await interaction.deferReply({ ephemeral: true });
      const { reincarnate } = await import('../rpg/services/character');
      const result = await reincarnate(discordId);
      await interaction.editReply({
        embeds: [result.success ? successEmbed('Reencarnação', result.message) : errorEmbed('Erro', result.message)],
      });
      return;
    }

    // ── /rpg info <classe> ───────────────────────────────────────────────────
    if (sub === 'info') {
      await interaction.deferReply({ ephemeral: true });
      const classId = interaction.options.getString('classe', true).toLowerCase();
      const { getClass } = await import('../rpg/constants/classes');
      const cls = getClass(classId);
      if (!cls) {
        await interaction.editReply({ embeds: [errorEmbed('Classe não encontrada', 'ID de classe inválido.')] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(cls.color)
        .setTitle(`${cls.emoji} ${cls.name} — Tier ${cls.tier}`)
        .setDescription(`*${cls.lore}*`)
        .addFields(
          { name: '📊 Raridade', value: cls.rarity, inline: true },
          { name: '📈 Stat Principal', value: cls.primaryStat.toUpperCase(), inline: true },
          { name: '🗡️ Armas', value: cls.weaponTypes.join(', '), inline: false },
          { name: '📊 Stats Base', value: `FOR:${cls.baseStats.str} AGI:${cls.baseStats.agi} INT:${cls.baseStats.int} VIT:${cls.baseStats.vit} SOR:${cls.baseStats.lck}`, inline: false },
          { name: '📈 Crescimento/nível', value: `FOR:+${cls.statGrowthPerLevel.str} AGI:+${cls.statGrowthPerLevel.agi} INT:+${cls.statGrowthPerLevel.int} VIT:+${cls.statGrowthPerLevel.vit} SOR:+${cls.statGrowthPerLevel.lck}`, inline: false },
          { name: '❤️ HP Base', value: `${cls.baseHp} (+${cls.hpPerVit}/VIT)`, inline: true },
          { name: '⚡ Energia Base', value: `${cls.baseEnergy} (+${cls.energyPerLevel}/nível)`, inline: true },
          ...(cls.evolveFrom ? [{ name: '🔓 Evolui de', value: cls.evolveFrom, inline: true }] : []),
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
} satisfies Command;
