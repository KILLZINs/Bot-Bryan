import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { FullCharacter } from '../services/character';
import { DIVINE_SKILLS, SKILL_RANKS, skillEffectValue, nextSkillRank } from '../constants/skills';
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

  const skillListText = availableSkills.length > 0
    ? availableSkills.map(s => {
        const isActive = char.divineSkillId === s.id;
        const learned  = char.divineSkillId === s.id;
        return `${isActive ? '✅' : '○'} ${s.emoji} **${s.name}** — Lv.${s.unlockLevel}+\n> ${s.description}`;
      }).join('\n\n')
    : '*Nenhuma habilidade disponível para sua classe.*';

  // Dica de dano estimado da habilidade equipada
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
    .setTitle('✨ Habilidades Divinas')
    .setDescription(
      `Habilidades divinas são poderes únicos da sua classe que evoluem com o uso em combate.\n` +
      `Sua classe: **${cls?.name ?? char.class}** ${cls?.emoji ?? ''}`
    )
    .addFields(
      { name: '⚡ Habilidade Equipada', value: currentSkillText + dmgHint, inline: false },
      { name: `📚 Habilidades Disponíveis — ${cls?.name ?? 'sua classe'}`, value: skillListText, inline: false },
      { name: '🔑 Pontos de Skill', value: `**${char.skillPoints}**`, inline: true },
      { name: '📊 Nível Atual', value: `**${char.level}**`, inline: true },
      { name: '📖 Como funciona', value: 'Ranks: F → E → D → C → B → A → S → SS → **SSS**\nO rank sobe com o uso em combate.', inline: false },
    )
    .setFooter({ text: 'Selecione uma habilidade abaixo para equipá-la.' });

  // select para equipar habilidade
  const unlocked = availableSkills.filter(s => char.level >= s.unlockLevel);
  const select = unlocked.length > 0
    ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rpg_select:equipar_skill')
          .setPlaceholder('Selecione uma habilidade para equipar...')
          .addOptions(
            unlocked.map(s =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`${s.name} [${s.type}]`)
                .setValue(s.id)
                .setEmoji(s.emoji.trim())
                .setDescription(`Lv.${s.unlockLevel}+ | Custo: ${s.energyCost} energia`)
                .setDefault(char.divineSkillId === s.id)
            )
          )
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
