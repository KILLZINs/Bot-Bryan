// ═══════════════════════════════════════════════════════════════════════
// GERADOR DE CARTÃO DE PERFIL RPG — Tarkov / MMORPG Inventory UI Style
// ═══════════════════════════════════════════════════════════════════════

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { getItem } from '../constants/items';
import { getLocation } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';
import { rpgXpForLevel } from '../constants/classes';

// Registrar a fonte local Inter
try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterRPG');
} catch (err) {
  console.error('Aviso: Não foi possível carregar a fonte local Inter-Bold.ttf:', err);
}

export async function generateProfileCard(char: any, stats: any): Promise<Buffer> {
  const width = 1100;
  const height = 780;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Fundo Principal — Dark Metallic Theme
  ctx.fillStyle = '#090A0F';
  ctx.fillRect(0, 0, width, height);

  // Moldura com Borda Dupla Metalizada
  drawCardFrame(ctx, 15, 15, width - 30, height - 30, '#12141D', '#2A2E3D');

  // 2. Header: Avatar + Informações do Jogador
  try {
    const avatarUrl = char.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png';
    const avatar = await loadImage(avatarUrl);

    ctx.save();
    ctx.beginPath();
    ctx.arc(85, 85, 45, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 40, 40, 90, 90);
    ctx.restore();

    // Borda Neon no Avatar
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(85, 85, 46, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch {
    // Fallback caso imagem quebre
  }

  const className = String(char.class || 'Aventureiro').toUpperCase();
  const loc = getLocation(char.currentLocation);

  drawText(ctx, `${char.username}`, 150, 55, '#FFFFFF', 26);
  drawText(ctx, `LVL.${char.level}  •  ${className}`, 150, 82, '#A78BFA', 15);
  drawText(ctx, `KARMA: ${char.karma ?? 0}  |  GEN: ${char.generation ?? 1}  |  MAPA: ${loc.name.toUpperCase()}`, 150, 105, '#6B7280', 12);
  drawText(ctx, `⚡ PODER: #${Number(stats.combatPower || 0).toLocaleString('pt-BR')}     🪙 OURO: ${Number(char.gold || 0).toLocaleString('pt-BR')}`, 150, 130, '#F59E0B', 14);

  // 3. Header Direito: Barras de Status
  const xpNeeded = rpgXpForLevel(char.level);
  const xpCurrent = char.xp || 0;
  drawGlowBar(ctx, 720, 38, 220, 14, xpCurrent / xpNeeded, '#8B5CF6', `XP`, `${xpCurrent}/${xpNeeded}`);

  const hpMax = stats.maxHp || 100;
  const hpCurrent = char.currentHp ?? hpMax;
  drawGlowBar(ctx, 720, 68, 220, 14, hpCurrent / hpMax, '#EF4444', `HP`, `${hpCurrent}/${hpMax}`);

  const energyMax = stats.maxEnergy || 100;
  const energyCurrent = char.currentEnergy ?? energyMax;
  drawGlowBar(ctx, 720, 98, 220, 14, energyCurrent / energyMax, '#3B82F6', `ENERGIA`, `${energyCurrent}/${energyMax}`);

  // 4. COLUNA ESQUERDA: Atributos de Combate & Stats Secundários
  drawCardFrame(ctx, 35, 160, 420, 390, '#161822', '#222634');
  drawText(ctx, '📊 ATRIBUTOS DE COMBATE', 55, 192, '#F59E0B', 15);

  // Grid de Badges Atributos (FOR, AGI, INT, VIT, SOR)
  const statBadges = [
    { label: 'FOR', val: stats.str },
    { label: 'AGI', val: stats.agi },
    { label: 'INT', val: stats.int },
    { label: 'VIT', val: stats.vit },
    { label: 'SOR', val: stats.lck },
  ];

  statBadges.forEach((st, idx) => {
    const bx = 55 + idx * 72;
    const by = 210;
    ctx.fillStyle = '#1D202F';
    ctx.beginPath();
    ctx.roundRect(bx, by, 64, 48, 8);
    ctx.fill();
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawText(ctx, st.label, bx + 18, by + 18, '#9CA3AF', 11);
    drawText(ctx, `${st.val}`, bx + 18, by + 38, '#FFFFFF', 15);
  });

  // Estatísticas Derivadas
  const subStats = [
    { name: '⚔️ Ataque Base', val: `${stats.attack}` },
    { name: '🛡️ Defesa Armor', val: `${stats.defense}` },
    { name: '💥 Acerto Crítico', val: `${Number(stats.critChance || 0).toFixed(1)}%` },
    { name: '💨 Taxa de Esquiva', val: `${Number(stats.dodgeChance || 0).toFixed(1)}%` },
  ];

  subStats.forEach((ss, idx) => {
    const sy = 290 + idx * 32;
    ctx.fillStyle = '#11131C';
    ctx.beginPath();
    ctx.roundRect(55, sy, 380, 26, 6);
    ctx.fill();

    drawText(ctx, ss.name, 68, sy + 18, '#D1D5DB', 12);
    drawText(ctx, ss.val, 370, sy + 18, '#A78BFA', 13);
  });

  // HISTÓRICO DE BATALHAS DENTRO DA COLUNA
  drawText(ctx, '⚔️ HISTÓRICO DE BATALHAS', 55, 445, '#EC4899', 14);
  const battleLogs = [
    `🏆 Vitórias: ${char.totalWins || 0}   |   💀 Mortes: ${char.totalDeaths || 0}`,
    `⚔️ PvP: ${char.pvpWins || 0}W / ${char.pvpLosses || 0}L   |   👹 Bosses: ${char.bossKills || 0}`,
  ];
  battleLogs.forEach((bl, idx) => {
    drawText(ctx, bl, 55, 475 + idx * 24, '#9CA3AF', 12);
  });

  // 5. COLUNA DIREITA: TARKOV / DIABLO STYLE EQUIPMENT INVENTORY
  drawCardFrame(ctx, 475, 160, 590, 390, '#161822', '#222634');
  drawText(ctx, '🎽 INVENTÁRIO EQUIPADO (SLOTS)', 495, 192, '#3B82F6', 15);

  const eq = char.equipment || {};

  // Mapeamento dos Slots Estilo Tarkov
  const slotsConfig = [
    { slotName: 'ELMO', item: eq.helmet, x: 730, y: 215, w: 80, h: 65 },
    { slotName: 'ARMA', item: eq.weapon, x: 520, y: 290, w: 90, h: 100 },
    { slotName: 'ESCUDO', item: eq.shield, x: 940, y: 290, w: 90, h: 100 },
    { slotName: 'ARMADURA', item: eq.pants, x: 730, y: 290, w: 80, h: 70 },
    { slotName: 'LUVAS', item: eq.gloves, x: 630, y: 290, w: 80, h: 70 },
    { slotName: 'BOTAS', item: eq.boots, x: 730, y: 370, w: 80, h: 65 },
    { slotName: 'ANEL', item: eq.ring, x: 830, y: 290, w: 80, h: 70 },
    { slotName: 'MOCHILA', item: eq.backpack, x: 630, y: 370, w: 80, h: 65 },
    { slotName: 'PET', item: eq.pet, x: 830, y: 370, w: 80, h: 65 },
  ];

  slotsConfig.forEach(s => {
    drawTarkovSlot(ctx, s.x, s.y, s.w, s.h, s.slotName, s.item);
  });

  // 6. BLOCO INFERIOR ESQUERDO: HABILIDADE DIVINA
  drawCardFrame(ctx, 35, 565, 520, 180, '#161822', '#222634');
  drawText(ctx, '✨ HABILIDADE DIVINA', 55, 595, '#F43F5E', 15);

  if (char.divineSkillId && DIVINE_SKILLS[char.divineSkillId]) {
    const ds = DIVINE_SKILLS[char.divineSkillId];
    drawText(ctx, `${ds.name.toUpperCase()} [RANK ${char.divineSkillRank || 'F'}]`, 55, 625, '#FFFFFF', 14);
    drawText(ctx, ds.description.slice(0, 65), 55, 650, '#9CA3AF', 12);
  } else {
    drawText(ctx, 'Nenhuma habilidade divina despertada.', 55, 630, '#6B7280', 13);
  }

  // 7. BLOCO INFERIOR DIREITO: COOLDOWNS RPG
  drawCardFrame(ctx, 575, 565, 490, 180, '#161822', '#222634');
  drawText(ctx, '⏱️ COOLDOWNS DE ATIVIDADES', 595, 595, '#10B981', 15);

  const cds = [
    `Dungeon: ${formatCd(char.lastDungeon, 5)}`,
    `Caçada: Livre`,
    `Viagem: ${formatCd(char.lastTravel, 10)}`,
    `Exploração: ${formatCd(char.lastExplore, 3)}`,
    `Treino: ${formatCd(char.lastTrain, 20)}`,
    `Pesca: ${formatCd(char.lastFishing, 10)}`,
  ];

  cds.forEach((cd, idx) => {
    const cx = 595 + (idx % 2) * 230;
    const cy = 630 + Math.floor(idx / 2) * 30;
    drawText(ctx, `• ${cd}`, cx, cy, '#D1D5DB', 12);
  });

  return canvas.toBuffer('image/png');
}

// ─── HELPERS VISUAIS AVANÇADOS ────────────────────────────────────────────────

function drawCardFrame(ctx: any, x: number, y: number, w: number, h: number, bgColor: string, borderColor: string) {
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawText(ctx: any, text: string, x: number, y: number, color: string, size: number) {
  ctx.fillStyle = color;
  ctx.font = `${size}px InterRPG, DejaVu Sans, Liberation Sans, Arial, sans-serif`;
  ctx.fillText(text, x, y);
}

function drawGlowBar(ctx: any, x: number, y: number, w: number, h: number, pct: number, color: string, title: string, label: string) {
  const cleanPct = Math.max(0, Math.min(1, pct || 0));

  drawText(ctx, title, x - 70, y + 11, '#9CA3AF', 11);

  ctx.fillStyle = '#1F2231';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  if (cleanPct > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w * cleanPct, h, 6);
    ctx.fill();
  }

  drawText(ctx, label, x + w + 12, y + 12, '#FFFFFF', 11);
}

function drawTarkovSlot(ctx: any, x: number, y: number, w: number, h: number, slotName: string, itemId: string | null) {
  const itemObj = itemId ? getItem(itemId) : null;
  const isEquipped = Boolean(itemObj || itemId);

  // Fundo do Slot Tarkov
  ctx.fillStyle = isEquipped ? '#1E2338' : '#11131A';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();

  // Borda do Slot (Verde/Azul se equipado, Escuro se vazio)
  ctx.strokeStyle = isEquipped ? '#3B82F6' : '#2A2E3D';
  ctx.lineWidth = isEquipped ? 2 : 1;
  ctx.stroke();

  // Nome do Slot (Categoria no Topo do Quadrado)
  drawText(ctx, slotName, x + 8, y + 16, isEquipped ? '#60A5FA' : '#4B5563', 10);

  // Nome/Item Equipado
  if (isEquipped) {
    const itemName = itemObj?.name || itemId || 'Item';
    const shortName = itemName.length > 11 ? itemName.slice(0, 9) + '..' : itemName;

    // Badge Indicadora de Item
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.roundRect(x + 6, y + h - 24, w - 12, 18, 4);
    ctx.fill();

    drawText(ctx, shortName, x + 10, y + h - 11, '#FFFFFF', 10);
  } else {
    drawText(ctx, 'VAZIO', x + (w / 2) - 16, y + (h / 2) + 4, '#374151', 10);
  }
}

function formatCd(date: Date | null | undefined, minutes: number): string {
  if (!date) return '🟢 OK';
  const remaining = minutes * 60_000 - (Date.now() - new Date(date).getTime());
  if (remaining <= 0) return '🟢 OK';
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.ceil((remaining % 60_000) / 1000);
  return `🔴 ${mins}m ${secs}s`;
}
