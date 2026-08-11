// ═══════════════════════════════════════════════════════════════════════
// EVENTOS DE MUNDO — Painel e Serviço
// ═══════════════════════════════════════════════════════════════════════

import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { prisma } from '../../database/client';

// ─── Templates de eventos ─────────────────────────────────────────────────────

interface WorldEventTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  type: string;
  durationMs: number;
  color: number;
  effect: string;        // texto do efeito
  xpMult?: number;
  goldMult?: number;
  enemyMult?: number;
  bossMaxHp?: number;
}

const EVENT_TEMPLATES: WorldEventTemplate[] = [
  {
    id: 'double_xp', name: 'Hora do XP Duplo', emoji: '⭐', type: 'double_xp',
    description: 'Uma energia estranha paira sobre o reino — os aventureiros aprendem o dobro!',
    durationMs: 2 * 60 * 60 * 1000, color: 0xFFD700,
    effect: '✨ **+100% XP** em batalha por 2 horas',
    xpMult: 2.0,
  },
  {
    id: 'gold_rush', name: 'Corrida do Ouro', emoji: '💰', type: 'gold_rush',
    description: 'Minas foram descobertas! Tesouros abundam nas masmorras.',
    durationMs: 1.5 * 60 * 60 * 1000, color: 0xF39C12,
    effect: '💰 **+50% Ouro** em batalha por 1h30',
    goldMult: 1.5,
  },
  {
    id: 'invasion', name: 'Invasão das Trevas', emoji: '🌑', type: 'invasion',
    description: 'Hordas sombrias invadem o reino! Inimigos mais fortes... mas mais recompensadores.',
    durationMs: 1 * 60 * 60 * 1000, color: 0x4B0082,
    effect: '🌑 Inimigos **+30% mais fortes** mas **+50% XP e Ouro**',
    xpMult: 1.5, goldMult: 1.5, enemyMult: 1.3,
  },
  {
    id: 'blessing', name: 'Bênção dos Antigos', emoji: '✨', type: 'blessing',
    description: 'Os espíritos ancestrais abençoam os aventureiros com energia ilimitada.',
    durationMs: 1 * 60 * 60 * 1000, color: 0x9B59B6,
    effect: '✨ Energia **não é consumida** em batalha por 1 hora',
  },
  {
    id: 'world_boss', name: 'Boss Apocalíptico', emoji: '🐉', type: 'world_boss',
    description: 'Uma criatura ancestral desperta das profundezas! Aventureiros, uni-vos!',
    durationMs: 3 * 60 * 60 * 1000, color: 0xFF0000,
    effect: '🐉 Boss coletivo com **5000 HP**. Cada ataque conta!',
    bossMaxHp: 5000,
  },
  {
    id: 'meteor', name: 'Chuva de Meteoros', emoji: '☄️', type: 'meteor',
    description: 'Meteoros carregam fragmentos de poder! Drops de itens raros aumentados.',
    durationMs: 2 * 60 * 60 * 1000, color: 0xFF6B35,
    effect: '☄️ **+30% chance** de item raro nos drops por 2 horas',
  },
];

// ─── Serviço de eventos ───────────────────────────────────────────────────────

export async function getActiveWorldEvent(guildId: string) {
  return prisma.rpgWorldEvent.findFirst({
    where: { guildId, active: true, endsAt: { gt: new Date() } },
    orderBy: { startsAt: 'desc' },
  });
}

export async function startWorldEvent(guildId: string, templateId: string): Promise<{ success: boolean; message: string }> {
  const tpl = EVENT_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return { success: false, message: 'Evento não encontrado.' };

  const existing = await getActiveWorldEvent(guildId);
  if (existing) return { success: false, message: `Já há um evento ativo: **${existing.name}**!` };

  const now = new Date();
  await prisma.rpgWorldEvent.create({
    data: {
      guildId, eventType: tpl.type, name: tpl.name, description: tpl.description,
      emoji: tpl.emoji, startsAt: now, endsAt: new Date(now.getTime() + tpl.durationMs),
      bossCurrentHp: tpl.bossMaxHp ?? null, bossMaxHp: tpl.bossMaxHp ?? null,
      active: true,
    },
  });

  return { success: true, message: `${tpl.emoji} **${tpl.name}** iniciado!` };
}

/** Retorna multiplicadores ativos de XP e Ouro do evento */
export async function getEventMultipliers(guildId: string): Promise<{ xp: number; gold: number; enemyMult: number; noEnergy: boolean; dropBonus: number }> {
  const event = await getActiveWorldEvent(guildId);
  if (!event) return { xp: 1, gold: 1, enemyMult: 1, noEnergy: false, dropBonus: 0 };

  const tpl = EVENT_TEMPLATES.find(t => t.id === event.eventType) ?? EVENT_TEMPLATES.find(t => t.type === event.eventType);
  return {
    xp: tpl?.xpMult ?? 1,
    gold: tpl?.goldMult ?? 1,
    enemyMult: tpl?.enemyMult ?? 1,
    noEnergy: event.eventType === 'blessing',
    dropBonus: event.eventType === 'meteor' ? 0.3 : 0,
  };
}

/** Dano ao boss mundial do evento */
export async function damageWorldBoss(guildId: string, discordId: string, damage: number): Promise<{ success: boolean; message: string; killed: boolean }> {
  const event = await prisma.rpgWorldEvent.findFirst({
    where: { guildId, active: true, eventType: 'world_boss', endsAt: { gt: new Date() } },
  });
  if (!event || event.bossCurrentHp === null) return { success: false, message: 'Nenhum boss ativo.', killed: false };

  const newHp = Math.max(0, event.bossCurrentHp - damage);
  const killed = newHp <= 0;

  const participants: string[] = (Array.isArray(event.participants) ? event.participants : []) as string[];
  if (!participants.includes(discordId)) participants.push(discordId);

  await prisma.rpgWorldEvent.update({
    where: { id: event.id },
    data: {
      bossCurrentHp: newHp,
      participants,
      active: !killed,
    },
  });

  if (killed) {
    // Recompensar participantes com XP e ouro direto no banco
    for (const pid of participants) {
      await prisma.rpgCharacter.update({
        where: { discordId: pid },
        data: { xp: { increment: 500 }, gold: { increment: 200 } },
      }).catch(() => null);
    }
  }

  return {
    success: true,
    message: killed ? `💀 O boss foi derrotado! **${participants.length}** aventureiros recebem +500XP e +200🪙!` : `⚔️ Você causou **${damage}** de dano! Boss HP: **${newHp}/${event.bossMaxHp}**`,
    killed,
  };
}

// ─── Evento aleatório (para o scheduler) ─────────────────────────────────────

export async function startRandomWorldEvent(guildId: string): Promise<{ success: boolean; name?: string }> {
  const existing = await getActiveWorldEvent(guildId);
  if (existing) return { success: false };
  const tpl = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const result = await startWorldEvent(guildId, tpl.id);
  return { success: result.success, name: tpl.name };
}

// ─── Painel ───────────────────────────────────────────────────────────────────

export async function buildWorldEventsEmbed(guildId: string): Promise<EmbedBuilder> {
  const active = await getActiveWorldEvent(guildId);

  if (active) {
    const tpl = EVENT_TEMPLATES.find(t => t.type === active.eventType);
    const remMs = active.endsAt.getTime() - Date.now();
    const remMin = Math.ceil(remMs / 60000);
    const remStr = remMin > 60
      ? `${Math.floor(remMin / 60)}h ${remMin % 60}min`
      : `${remMin} min`;

    const bossBar = active.eventType === 'world_boss' && active.bossMaxHp
      ? `\n\n🐉 **Boss HP:** ${active.bossCurrentHp}/${active.bossMaxHp}\n${'█'.repeat(Math.round((active.bossCurrentHp! / active.bossMaxHp) * 15))}${'░'.repeat(15 - Math.round((active.bossCurrentHp! / active.bossMaxHp) * 15))}`
      : '';

    const participants: string[] = Array.isArray(active.participants) ? active.participants as string[] : [];

    return new EmbedBuilder()
      .setColor(tpl?.color ?? 0xFFD700)
      .setTitle(`${active.emoji} EVENTO ATIVO: ${active.name}`)
      .setDescription(
        `${active.description}\n\n**Efeito:** ${tpl?.effect ?? '-'}${bossBar}`,
      )
      .addFields(
        { name: '⏳ Tempo Restante', value: `**${remStr}**`, inline: true },
        { name: '👥 Participantes',  value: `**${participants.length}**`, inline: true },
      )
      .setFooter({ text: '🌎 Evento de Mundo da Aliança Skyline' });
  }

  return new EmbedBuilder()
    .setColor(0x2C3E50)
    .setTitle('🌎 Eventos de Mundo')
    .setDescription(
      'Nenhum evento ativo no momento.\n\nEventos mundiais afetam **todos os membros** da guilda e trazem bônus épicos!\n\n' +
      EVENT_TEMPLATES.map(t => `${t.emoji} **${t.name}** — ${t.effect}`).join('\n'),
    )
    .setFooter({ text: '🌎 Donos do bot podem iniciar eventos com o botão abaixo' });
}

export function buildWorldEventsButtons(guildId: string, isOwner: boolean, hasActiveEvent: boolean, activeEventType?: string | null): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const isWorldBoss = activeEventType === 'world_boss';

  if (hasActiveEvent) {
    const btns: ButtonBuilder[] = [];
    if (isWorldBoss) {
      btns.push(new ButtonBuilder().setCustomId('rpg:evento_atacar_boss').setLabel('⚔️ Atacar Boss!').setStyle(ButtonStyle.Danger));
    }
    btns.push(new ButtonBuilder().setCustomId('rpg:eventos').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary));
    btns.push(new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary));
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...btns));
  } else {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rpg:eventos').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rpg:perfil').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
      ...(isOwner ? [new ButtonBuilder().setCustomId('rpg:evento_iniciar').setLabel('⚡ Iniciar Evento').setStyle(ButtonStyle.Primary)] : []),
    ));
  }

  return rows;
}

export function buildEventStartSelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rpg_select:evento_tipo')
      .setPlaceholder('Escolha o tipo de evento...')
      .addOptions(
        EVENT_TEMPLATES.map(t =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${t.name}`)
            .setValue(t.id)
            .setDescription(t.effect)
            .setEmoji(t.emoji),
        ),
      ),
  );
}
