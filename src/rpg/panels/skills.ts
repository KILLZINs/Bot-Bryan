// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE HABILIDADES E ÁRVORE DE PASSIVAS
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { DIVINE_SKILLS, PASSIVE_TALENTS, skillEffectValue, nextSkillRank } from '../constants/skills';
import { getClass } from '../constants/classes';

export function buildHabilidadesEmbed(char: FullCharacter): { embed: EmbedBuilder; select: ActionRowBuilder<StringSelectMenuBuilder> | null } {
  const cls = getClass(char.class);
  const availableSkills = cls?.divineSkills.map(id => DIVINE_SKILLS[id]).filter(Boolean) ?? [];

  let currentSkillText = '*Nenhuma habilidade divina equipada.*';
  if (char.divineSkillId) {
    const ds = DIVINE_SKILLS[char.divineSkillId];
    if (ds) {
      const next = nextSkillRank(char.divineSkillRank as any);
      currentSkillText = [
        `${ds.emoji} **${ds.name}** [Rank **${char.divineSkillRank}**]`,
        `> ${ds.description}`,
        `> Tipo: \`${ds.type}\` | Custo: \`${ds.energyCost} Energia\``,
        next ? (() => {
          const SKILL_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
          const RANK_MULT   = [1, 2, 4, 8, 16, 32, 64, 128];
          const rankIdx     = SKILL_RANKS.indexOf(char.divineSkillRank as string);
          const requiredXp  = ds.rankUpExpRequired * (RANK_MULT[rankIdx] ?? 1);
          return `> XP para Rank ${next}: **${char.divineSkillExp}/${requiredXp}**`;
        })() : '> **RANK MÁXIMO SSS** 🌟',
      ].join('\n');
    }
  }

  // Listar Árvore de Talentos Passivos Comprados
  const talentLevels = (char.talentLevels as Record<string, number> | null) ?? {};
  const talentsText = Object.values(PASSIVE_TALENTS).map(t => {
    const lvl = talentLevels[t.id] ?? 0;
    return `${t.emoji} **${t.name}** [Nv.${lvl}/${t.maxLevel}] (Custo: ${t.costPerLevel} pts)\n> ${t.description}`;
  }).join('\n\n');

  let dmgHint = '';
  if (char.divineSkillId) {
    const ds = DIVINE_SKILLS[char.divineSkillId];
    if (ds && ds.type === 'ataque') {
      const eff = skillEffectValue(ds, char.divineSkillRank as any);
      dmgHint = `\n> 📐 Multiplicador de dano atual: **×${eff.toFixed(2)}**`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('✨ Habilidades & Árvore de Passivas')
    .setDescription(
      `Gerencie sua habilidade divina e gaste seus **Pontos de Skill** para upar talentos passivos permanentes!\n` +
      `Sua classe: **${cls?.name ?? char.class}** ${cls?.emoji ?? ''}`
    )
    .addFields(
      { name: '⚡ Habilidade Equipada', value: currentSkillText + dmgHint, inline: false },
      { name: '🧬 Árvore de Talentos Passivos', value: talentsText, inline: false },
      { name: '🔑 Pontos de Skill Disponíveis', value: `**${char.skillPoints}** pts`, inline: true },
      { name: '📊 Nível Atual', value: `**${char.level}**`, inline: true },
    )
    .setFooter({ text: 'Selecione abaixo para equipar habilidade ou evoluir um talento passivo.' });

  // Criar seletor unificado: Equipe de Habilidade ou Upgrade de Passiva
  const unlockedSkills = availableSkills.filter(s => char.level >= s.unlockLevel);
  
  const skillOptions = unlockedSkills.map(s =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`[Habilidade] ${s.name}`)
      .setValue(`skill:${s.id}`)
      .setEmoji(s.emoji.trim())
      .setDescription(`Equipar • Custo: ${s.energyCost} energia`)
      .setDefault(char.divineSkillId === s.id)
  );

  const talentOptions = Object.values(PASSIVE_TALENTS).map(t => {
    const lvl = talentLevels[t.id] ?? 0;
    const canBuy = lvl < t.maxLevel && char.skillPoints >= t.costPerLevel;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`[Talento] ${t.name} (Nv.${lvl}/${t.maxLevel})`)
      .setValue(`talent:${t.id}`)
      .setEmoji(t.emoji.trim())
      .setDescription(canBuy ? `Evoluir • Custo: ${t.costPerLevel} pts` : `[Máximo ou Sem Pontos]`);
  });

  const allOptions = [...skillOptions, ...talentOptions].slice(0, 25);

  const select = allOptions.length > 0
    ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rpg_select:equipar_skill')
          .setPlaceholder('🎯 Escolha uma habilidade ou evoluir talento passivo...')
          .addOptions(allOptions)
      )
    : null;

  return { embed, select };
}

export function buildHabilidadesButtons(char: FullCharacter): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:habilidades').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏰 Cidade').setStyle(ButtonStyle.Primary),
  );
}
