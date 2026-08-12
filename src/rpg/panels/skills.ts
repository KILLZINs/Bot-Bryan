// ═══════════════════════════════════════════════════════════════════════
// PAINEL DE HABILIDADES & ÁRVORE DE PASSIVAS
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { DIVINE_SKILLS, PASSIVE_TALENTS } from '../constants/skills';
import { getClass } from '../constants/classes';
import { prisma } from '../../database/client';

export async function buildHabilidadesEmbed(char: FullCharacter, viewMode: 'ativas' | 'passivas' = 'ativas'): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<any>[] }> {
  const cls = getClass(char.class);
  const availableSkills = cls?.divineSkills.map(id => DIVINE_SKILLS[id]).filter(Boolean) ?? [];

  const learnedSkillsList = await prisma.rpgLearnedSkill.findMany({
    where: { characterId: char.discordId }
  });
  const learnedMap = new Map(learnedSkillsList.map(s => [s.skillId, s]));

  const equippedIds: string[] = Array.isArray(char.equippedSkills) 
    ? (char.equippedSkills as string[]) 
    : (char.divineSkillId ? [char.divineSkillId] : []);

  if (viewMode === 'ativas') {
    let equippedText = '*Nenhuma habilidade equipada.*';
    if (equippedIds.length > 0) {
      equippedText = equippedIds.map(id => {
        const ds = DIVINE_SKILLS[id];
        if (!ds) return null;
        const learned = learnedMap.get(id);
        const rank = learned?.rank ?? char.divineSkillRank ?? 'F';
        const exp = learned?.exp ?? char.divineSkillExp ?? 0;
        const nextExp = 100 * Math.pow(1.5, ['F', 'E', 'D', 'C', 'B', 'A', 'S'].indexOf(rank) + 1);

        return `${ds.emoji} **${ds.name}** [Rank **${rank}**]\n> 📈 XP: \`${exp} / ${Math.round(nextExp)}\` | Custo: \`${ds.energyCost} Energia\`\n> ${ds.description}`;
      }).filter(Boolean).join('\n\n');
    }

    const skillListText = availableSkills.length > 0
      ? availableSkills.map(s => {
          const isEquipped = equippedIds.includes(s.id);
          const learned = learnedMap.get(s.id);
          const rank = learned?.rank ?? 'F';
          const exp = learned?.exp ?? 0;
          const nextExp = 100 * Math.pow(1.5, ['F', 'E', 'D', 'C', 'B', 'A', 'S'].indexOf(rank) + 1);

          return `${isEquipped ? '✅' : '○'} ${s.emoji} **${s.name}** — Lv.${s.unlockLevel}+\n> Rank: \`${rank}\` | XP: \`${exp}/${Math.round(nextExp)}\`\n> ${s.description}`;
        }).join('\n\n')
      : '*Nenhuma habilidade disponível para sua classe.*';

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('✨ Gerenciador de Habilidades Divinas')
      .setDescription(
        `Gerencie suas habilidades ativas. Você pode equipar **múltiplas habilidades** para usar em combate!\n` +
        `Sua classe: **${cls?.name ?? char.class}** ${cls?.emoji ?? ''}`
      )
      .addFields(
        { name: '⚡ Habilidades Equipadas Atualmente', value: equippedText, inline: false },
        { name: `📚 Habilidades da Classe — ${cls?.name ?? 'sua classe'}`, value: skillListText, inline: false },
        { name: '🔑 Pontos de Skill', value: `**${char.skillPoints}** pts`, inline: true },
        { name: '📊 Nível Atual', value: `**${char.level}**`, inline: true },
      )
      .setFooter({ text: 'Selecione abaixo para equipar/desequipar habilidades.' });

    const unlocked = availableSkills.filter(s => char.level >= s.unlockLevel);
    const select = unlocked.length > 0
      ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('rpg_select:equipar_multiplas_skills')
            .setPlaceholder('Selecione para alternar (Equipar/Desequipar)...')
            .setMinValues(1)
            .setMaxValues(Math.min(unlocked.length, 3))
            .addOptions(
              unlocked.map(s =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(`${s.name} [${s.type}]`)
                  .setValue(s.id)
                  .setEmoji(s.emoji.trim())
                  .setDescription(`Custo: ${s.energyCost} energia | Lv.${s.unlockLevel}+`)
                  .setDefault(equippedIds.includes(s.id))
              )
            )
        )
      : null;

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rpg_skills_tab:ativas').setLabel('⚔️ Habilidades Ativas').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rpg_skills_tab:passivas').setLabel('🧬 Talentos Passivos').setStyle(ButtonStyle.Secondary),
    );

    const btnRow = buildHabilidadesButtons();
    const components = select ? [select, navRow, btnRow] : [navRow, btnRow];

    return { embed, components };
  } else {
    const talentLevels = (char.talentLevels as Record<string, number> | null) ?? {};
    const talentsText = Object.values(PASSIVE_TALENTS).map(t => {
      const lvl = talentLevels[t.id] ?? 0;
      return `${t.emoji} **${t.name}** [Nv.${lvl}/${t.maxLevel}] (Custo: ${t.costPerLevel} pts)\n> ${t.description}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('🧬 Árvore de Talentos Passivos')
      .setDescription(
        `Gaste seus **Pontos de Skill** para evoluir bônus passivos permanentes!\n` +
        `Pontos disponíveis: **${char.skillPoints} pts**`
      )
      .addFields(
        { name: '🌳 Talentos Disponíveis', value: talentsText, inline: false },
      )
      .setFooter({ text: 'Selecione um talento abaixo para evoluir o nível.' });

    const talentOptions = Object.values(PASSIVE_TALENTS).map(t => {
      const lvl = talentLevels[t.id] ?? 0;
      const canBuy = lvl < t.maxLevel && char.skillPoints >= t.costPerLevel;
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${t.name} (Nv.${lvl}/${t.maxLevel})`)
        .setValue(`talent:${t.id}`)
        .setEmoji(t.emoji.trim())
        .setDescription(canBuy ? `Evoluir • Custo: ${t.costPerLevel} pts` : `[Nível Máximo Atingido ou Sem Pontos]`);
    });

    const select = talentOptions.length > 0
      ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('rpg_select:evoluir_talento')
            .setPlaceholder('🧬 Escolha um talento passivo para evoluir...')
            .addOptions(talentOptions)
        )
      : null;

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rpg_skills_tab:ativas').setLabel('⚔️ Habilidades Ativas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rpg_skills_tab:passivas').setLabel('🧬 Talentos Passivos').setStyle(ButtonStyle.Primary),
    );

    const btnRow = buildHabilidadesButtons();
    const components = select ? [select, navRow, btnRow] : [navRow, btnRow];

    return { embed, components };
  }
}

export function buildHabilidadesButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rpg:habilidades').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Perfil').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('🏰 Cidade').setStyle(ButtonStyle.Primary),
  );
}
