// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE BOSS MUNDIAL — toda a guilda enfrenta juntos
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '../../database/client';
import { getCharacter, computeStats } from './character';

// ─── Templates de bosses mundiais ─────────────────────────────────────

export interface WorldBossTemplate {
  name: string;
  emoji: string;
  description: string;
  baseHp: number;       // HP base (×level para escalar)
  xpReward: number;     // XP base por % de dano
  goldReward: number;   // Ouro base por % de dano
  abilities: string[];
}

export const WORLD_BOSS_TEMPLATES: WorldBossTemplate[] = [
  {
    name: 'O Dragão Primordial',
    emoji: '🐉',
    description: 'Um dragão ancião que desperta das profundezas da terra. Sua chama consome reinos inteiros.',
    baseHp: 500_000,
    xpReward: 5000,
    goldReward: 3000,
    abilities: ['🔥 Sopro de Chama Eterna', '⚡ Trovão Dracônico', '🌋 Erupção Devastadora'],
  },
  {
    name: 'O Lich Rei',
    emoji: '💀',
    description: 'Um necromante imortal que comanda legiões de mortos-vivos. Sua magia corrói a própria alma.',
    baseHp: 400_000,
    xpReward: 4500,
    goldReward: 2800,
    abilities: ['☠️ Nova da Morte', '🌑 Maldição Sombria', '💀 Exército dos Mortos'],
  },
  {
    name: 'O Titã das Sombras',
    emoji: '👹',
    description: 'Uma criatura colossal forjada nas trevas do abismo. Sua presença apaga a luz.',
    baseHp: 600_000,
    xpReward: 6000,
    goldReward: 3500,
    abilities: ['🌑 Noite Eterna', '💥 Golpe Colossal', '🌀 Vórtice Dimensional'],
  },
  {
    name: 'O Deus do Caos',
    emoji: '🌀',
    description: 'Uma entidade além da compreensão mortal. Seu toque dissolve a realidade.',
    baseHp: 800_000,
    xpReward: 8000,
    goldReward: 5000,
    abilities: ['✨ Distorção Reality', '⚡ Raio do Apocalipse', '🌪️ Tempestade do Caos'],
  },
];

// ─── HP bar helper ────────────────────────────────────────────────────

export function bossHpBar(current: number, max: number, size = 20): string {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * size);
  const bar = '█'.repeat(filled) + '░'.repeat(size - filled);
  const pctStr = (pct * 100).toFixed(1);
  return `\`${bar}\` **${pctStr}%**`;
}

// ─── Obter boss ativo ─────────────────────────────────────────────────

export async function getActiveBoss(guildId: string) {
  return prisma.worldBoss.findFirst({
    where: { guildId, status: 'active' },
    include: {
      participants: {
        orderBy: { damageDealt: 'desc' },
        take: 10,
      },
    },
  });
}

// ─── Invocar boss ─────────────────────────────────────────────────────

export async function spawnWorldBoss(
  guildId: string,
  templateIndex: number,
  level: number, // 1-10
): Promise<{ success: boolean; message: string }> {
  const existing = await getActiveBoss(guildId);
  if (existing) return { success: false, message: 'Já existe um Boss Mundial ativo neste servidor!' };

  const template = WORLD_BOSS_TEMPLATES[templateIndex] ?? WORLD_BOSS_TEMPLATES[0];
  const maxHp = Math.floor(template.baseHp * (1 + (level - 1) * 0.5));
  const xpReward = Math.floor(template.xpReward * (1 + (level - 1) * 0.3));
  const goldReward = Math.floor(template.goldReward * (1 + (level - 1) * 0.3));

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

  await prisma.worldBoss.create({
    data: {
      guildId,
      name: template.name,
      emoji: template.emoji,
      description: template.description,
      maxHp,
      currentHp: maxHp,
      level,
      status: 'active',
      xpReward,
      goldReward,
      expiresAt,
    },
  });

  return { success: true, message: `${template.emoji} **${template.name}** (Nv.${level}) invocado! HP: **${maxHp.toLocaleString('pt-BR')}**` };
}

// ─── Atacar boss ──────────────────────────────────────────────────────

const ATTACK_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

export async function attackWorldBoss(
  discordId: string,
  username: string,
  guildId: string,
): Promise<{ success: boolean; damage?: number; message: string; bossDefeated?: boolean }> {
  const boss = await getActiveBoss(guildId);
  if (!boss) return { success: false, message: 'Nenhum Boss Mundial ativo no momento!' };
  if (boss.currentHp <= 0) return { success: false, message: 'O boss já foi derrotado!' };

  // Verificar cooldown
  const participant = await prisma.worldBossParticipant.findUnique({
    where: { bossId_discordId: { bossId: boss.id, discordId } },
  });

  if (participant?.lastHit) {
    const elapsed = Date.now() - participant.lastHit.getTime();
    if (elapsed < ATTACK_COOLDOWN_MS) {
      const rem = Math.ceil((ATTACK_COOLDOWN_MS - elapsed) / 60000);
      return { success: false, message: `⏱️ Aguarde **${rem} minuto(s)** para atacar novamente!` };
    }
  }

  // Calcular dano baseado nos stats do personagem
  const char = await getCharacter(discordId);
  let baseDamage = 500; // dano base para quem não tem personagem RPG

  if (char) {
    const stats = computeStats(char);
    baseDamage = stats.attack * 50; // amplificado para o boss mundial
    // Bonus por nível
    baseDamage += char.level * 100;
  }

  // Variação aleatória ±30%
  const variance = 0.7 + Math.random() * 0.6;
  const isCrit = Math.random() < 0.15;
  const damage = Math.floor(baseDamage * variance * (isCrit ? 2 : 1));

  const newHp = Math.max(0, boss.currentHp - damage);
  const bossDefeated = newHp <= 0;

  // Atualizar participante
  await prisma.worldBossParticipant.upsert({
    where: { bossId_discordId: { bossId: boss.id, discordId } },
    update: {
      damageDealt: { increment: damage },
      hits: { increment: 1 },
      lastHit: new Date(),
      username,
    },
    create: {
      bossId: boss.id,
      discordId,
      username,
      damageDealt: damage,
      hits: 1,
      lastHit: new Date(),
    },
  });

  // Atualizar HP do boss
  await prisma.worldBoss.update({
    where: { id: boss.id },
    data: {
      currentHp: newHp,
      ...(bossDefeated ? { status: 'defeated', defeatedAt: new Date() } : {}),
    },
  });

  if (bossDefeated) {
    await distributeRewards(boss.id, boss.xpReward, boss.goldReward);
  }

  const critText = isCrit ? ' 💥 **CRÍTICO!**' : '';
  const msg = bossDefeated
    ? `☠️ Golpe final!${critText} Você causou **${damage.toLocaleString('pt-BR')}** de dano!\n🏆 **${boss.name} foi derrotado!** Recompensas distribuídas!`
    : `⚔️${critText} Você causou **${damage.toLocaleString('pt-BR')}** de dano!\n❤️ HP Restante: **${newHp.toLocaleString('pt-BR')}/${boss.maxHp.toLocaleString('pt-BR')}**`;

  return { success: true, damage, message: msg, bossDefeated };
}

// ─── Distribuir recompensas ────────────────────────────────────────────

async function distributeRewards(bossId: string, baseXp: number, baseGold: number) {
  const participants = await prisma.worldBossParticipant.findMany({ where: { bossId } });
  const totalDamage = participants.reduce((sum, p) => sum + p.damageDealt, 0);
  if (totalDamage === 0) return;

  for (const p of participants) {
    const contribution = p.damageDealt / totalDamage;
    const xp = Math.max(100, Math.floor(baseXp * contribution));
    const gold = Math.max(50, Math.floor(baseGold * contribution));

    // Bônus por participação mesmo que pequena (mínimo 10%)
    const minXp = Math.floor(baseXp * 0.1);
    const minGold = Math.floor(baseGold * 0.1);
    const finalXp = Math.max(xp, minXp);
    const finalGold = Math.max(gold, minGold);

    const char = await prisma.rpgCharacter.findUnique({ where: { discordId: p.discordId } });
    if (char) {
      await prisma.rpgCharacter.update({
        where: { discordId: p.discordId },
        data: {
          gold: { increment: finalGold },
          bossKills: { increment: 1 },
        },
      });
      // XP via addRpgXp seria circular — fazer update direto
      const { addRpgXp } = await import('./character');
      const charFull = await prisma.rpgCharacter.findUnique({ where: { discordId: p.discordId }, include: { equipment: true } });
      if (charFull) await addRpgXp(charFull, finalXp);
    }
  }
}

// ─── Expirar bosses velhos ─────────────────────────────────────────────

export async function expireOldBosses() {
  await prisma.worldBoss.updateMany({
    where: { status: 'active', expiresAt: { lte: new Date() } },
    data: { status: 'expired' },
  });
}
