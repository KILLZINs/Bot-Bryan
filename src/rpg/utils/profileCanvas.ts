import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { getClass, karmaLabel, rpgXpForLevel } from '../constants/classes';
import { getItem } from '../constants/items';
import { getLocation } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';
import { getMarriage } from '../services/marriage';
import { prisma } from '../../database/client';

try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte Inter-Bold:', e);
}

function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

function formatCooldown(date: Date | null | undefined, minutes: number): string {
  if (!date) return 'PRONTO';
  const remaining = minutes * 60_000 - (Date.now() - date.getTime());
  if (remaining <= 0) return 'PRONTO';
  const totalSeconds = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
}

// Cores de Raridade Minimalistas
const RARITY_COLORS: Record<string, string> = {
  'Comum': '#95A5A6',
  'Incomum': '#5c9c6f',
  'Raro': '#4c7b9e',
  'Épico': '#8c6b9e',
  'Lendário': '#e3aa59',
};

// ==========================================
// ÍCONES E PAINÉIS VETORIAIS
// ==========================================
function drawCoinIcon(ctx: any, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#e3aa59';
  ctx.strokeStyle = '#b8853b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4a3212';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText('G', x - 5, y + 4.5);
  ctx.restore();
}

function drawRoundedPanel(ctx: any, x: number, y: number, w: number, h: number, radius: number, bgColor: string, strokeColor?: string) {
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawItemName(ctx: any, text: string, x: number, y: number) {
  ctx.fillStyle = '#f4efe6';
  ctx.font = 'bold 10px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  if (!text) return;

  const words = text.split(' ');
  if (words.length === 1) {
    ctx.fillText(text.substring(0, 11), x, y + 4);
  } else if (words.length === 2) {
    ctx.fillText(words[0].substring(0, 11), x, y - 2);
    ctx.fillText(words[1].substring(0, 11), x, y + 10);
  } else {
    ctx.fillText(words[0].substring(0, 11), x, y - 2);
    ctx.fillText(words.slice(1).join(' ').substring(0, 9) + '..', x, y + 10);
  }
  ctx.textAlign = 'left'; 
}

export async function generateProfileCard(char: any, stats: any, avatarUrlInput?: string): Promise<Buffer> {
  // Layout Widescreen/Horizontal para leitura confortável
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const cls = getClass(char.class);
  const loc = getLocation(char.currentLocation);
  const eq = char.equipment;

  const name = stripEmojis(char.username || 'Aventureiro');
  const className = stripEmojis(cls?.name ?? char.class);
  const level = char.level ?? 1;
  const karma = stripEmojis(karmaLabel(char.karma));
  const locationName = stripEmojis(loc.name);
  const gen = char.generation ?? 1;

  const currentXp = char.xp ?? 0;
  const maxXp = rpgXpForLevel(level);
  const currentHp = char.currentHp ?? 100;
  const maxHp = stats?.maxHp ?? 100;
  const currentEnergy = char.currentEnergy ?? 100;
  const maxEnergy = stats?.maxEnergy ?? 100;

  const power = stats?.combatPower ?? 0;
  const gold = char.gold ?? 0;

  let marriageText = 'Solteiro(a)';
  try {
    const marriage = await getMarriage(char.discordId);
    if (marriage) {
      const daysTogether = Math.floor((Date.now() - marriage.marriedAt.getTime()) / 86400000);
      marriageText = `Casado(a) [${daysTogether}d]`;
    }
  } catch { /* Ignora erro */ }

  let divineName = 'Nenhuma';
  if (char.divineSkillId && DIVINE_SKILLS[char.divineSkillId]) {
    divineName = stripEmojis(DIVINE_SKILLS[char.divineSkillId].name);
  }

  const resolveItem = (itemId?: string | null) => {
    if (!itemId) return '';
    const item = getItem(itemId);
    return item ? stripEmojis(item.name) : stripEmojis(itemId);
  };

  const slotItems = {
    helmet: resolveItem(eq?.helmet),
    amulet: resolveItem(eq?.amulet),
    chest: resolveItem(eq?.chest || eq?.armor),
    gloves: resolveItem(eq?.gloves),
    pants: resolveItem(eq?.pants),
    boots: resolveItem(eq?.boots),
    weapon: resolveItem(eq?.weapon),
    shield: resolveItem(eq?.shield),
    ring: resolveItem(eq?.ring),
    backpack: resolveItem(eq?.backpack),
    pet: resolveItem(eq?.pet),
  };

  const inventory = await prisma.rpgInventoryItem.findMany({
    where: { characterId: char.discordId },
    orderBy: { quantity: 'desc' }
  });

  const avatarUrl = avatarUrlInput || char.avatarUrl || '';

  // ==========================================
  // FUNDO: TONS TERROSOS & MINIMALISTA
  // ==========================================
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#1c1815'); // Marrom escuro 
  bgGrad.addColorStop(1, '#120f0d'); // Off-black
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#2e2621';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);
  ctx.strokeStyle = '#42372f';
  ctx.lineWidth = 1;
  ctx.strokeRect(15, 15, width - 30, height - 30);

  // ==========================================
  // TOP BAR
  // ==========================================
  drawRoundedPanel(ctx, 30, 25, width - 60, 50, 8, '#241f1b', '#3b322b');

  // Ouro
  drawCoinIcon(ctx, 60, 50);
  ctx.fillStyle = '#f4efe6';
  ctx.font = 'bold 22px "InterFont", sans-serif';
  ctx.fillText(`${gold.toLocaleString('pt-BR')}`, 80, 57);

  // Barras HP / EN / XP
  function drawBar(x: number, y: number, w: number, h: number, current: number, max: number, color: string, label: string) {
    ctx.fillStyle = '#14110f';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
    const pct = Math.min(current / (max || 1), 1);
    if (pct > 0) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, w * pct, h, 4); ctx.fill();
    }
    ctx.fillStyle = '#d6ccc0';
    ctx.font = 'bold 12px "InterFont", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, x - 10, y + 11);
    ctx.textAlign = 'left';
  }

  // Terracota, Mostarda e Cinza Off-White
  drawBar(650, 42, 130, 14, currentHp, maxHp, '#c45843', 'HP');
  drawBar(835, 42, 130, 14, currentEnergy, maxEnergy, '#d18c47', 'EN');
  drawBar(1015, 42, 110, 14, currentXp, maxXp, '#857e78', 'XP');

  // Constantes de Layout dos Painéis Principais
  const panelY = 90;
  const panelH = 510;

  // ==========================================
  // PAINEL 1: PERFIL & STATUS (Esquerda)
  // ==========================================
  drawRoundedPanel(ctx, 30, panelY, 360, panelH, 10, '#241f1b', '#3b322b');

  const avSize = 130;
  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath(); ctx.roundRect(50, panelY + 20, avSize, avSize, 12); ctx.clip();
      ctx.drawImage(avatar, 50, panelY + 20, avSize, avSize);
      ctx.restore();
    } catch {}
  }
  ctx.strokeStyle = '#594d45';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(50, panelY + 20, avSize, avSize, 12); ctx.stroke();

  // Informações de Perfil
  ctx.fillStyle = '#e3aa59';
  ctx.font = 'bold 26px "InterFont", sans-serif';
  ctx.fillText(name.toUpperCase(), 195, panelY + 45);

  ctx.fillStyle = '#f4efe6';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`Lv. ${level} — ${className.toUpperCase()}`, 195, panelY + 68);

  ctx.fillStyle = '#b0a498';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`Local: ${locationName}`, 195, panelY + 90);
  ctx.fillText(`Karma: ${karma}`, 195, panelY + 110);
  ctx.fillText(`Gen: ${gen}  |  💍 ${marriageText}`, 195, panelY + 130);

  // Poder Divino
  drawRoundedPanel(ctx, 50, panelY + 165, 320, 75, 8, '#1f1a17', '#332b25');
  ctx.fillStyle = '#c45843';
  ctx.font = 'bold 15px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`⚔️ PODER: ${power.toLocaleString('pt-BR')}`, 210, panelY + 195);
  ctx.fillStyle = '#e3aa59';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText(`🌟 Habilidade: ${divineName}`, 210, panelY + 220);
  ctx.textAlign = 'left';

  // Divisória
  ctx.strokeStyle = '#332b25';
  ctx.beginPath(); ctx.moveTo(50, panelY + 265); ctx.lineTo(370, panelY + 265); ctx.stroke();

  // Atributos Base
  ctx.fillStyle = '#e3aa59';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('ATRIBUTOS BASE', 50, panelY + 295);

  ctx.fillStyle = '#f4efe6';
  ctx.font = '14px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${stats?.str ?? 10}`, 50, panelY + 325);
  ctx.fillText(`AGI: ${stats?.agi ?? 10}`, 160, panelY + 325);
  ctx.fillText(`INT: ${stats?.int ?? 10}`, 270, panelY + 325);
  ctx.fillText(`VIT: ${stats?.vit ?? 10}`, 50, panelY + 355);
  ctx.fillText(`SOR: ${stats?.lck ?? 10}`, 160, panelY + 355);

  // Status de Combate
  ctx.fillStyle = '#c45843';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('STATUS DE COMBATE', 50, panelY + 400);

  ctx.fillStyle = '#f4efe6';
  ctx.font = '14px "InterFont", sans-serif';
  ctx.fillText(`Ataque: ${stats?.attack ?? 10}`, 50, panelY + 430);
  ctx.fillText(`Defesa: ${stats?.defense ?? 10}`, 210, panelY + 430);
  ctx.fillText(`Crítico: ${(stats?.critChance ?? 0).toFixed(1)}%`, 50, panelY + 460);
  ctx.fillText(`Esquiva: ${(stats?.dodgeChance ?? 0).toFixed(1)}%`, 210, panelY + 460);
  ctx.fillText(`PvP: ${char.pvpWins ?? 0} V`, 50, panelY + 490);
  ctx.fillText(`PvE: ${char.totalWins ?? 0} V`, 210, panelY + 490);

  // ==========================================
  // PAINEL 2: EQUIPAMENTOS (Centro)
  // ==========================================
  drawRoundedPanel(ctx, 410, panelY, 340, panelH, 10, '#241f1b', '#3b322b');

  ctx.fillStyle = '#e3aa59';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EQUIPAMENTOS', 580, panelY + 35);
  ctx.textAlign = 'left';

  function drawEquipSlot(x: number, y: number, itemName: string, label: string) {
    drawRoundedPanel(ctx, x, y, 70, 70, 8, '#1c1815', itemName ? '#e3aa59' : '#332b25');
    if (itemName) {
      drawItemName(ctx, itemName, x + 35, y + 33);
    } else {
      ctx.fillStyle = '#594d45';
      ctx.font = '11px "InterFont", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + 35, y + 39);
      ctx.textAlign = 'left';
    }
  }

  const col1 = 435;
  const col2 = 545;
  const col3 = 655;
  const rowStart = panelY + 60;
  const rowGap = 100;

  // Lado Esquerdo
  drawEquipSlot(col1, rowStart, slotItems.weapon, 'Arma');
  drawEquipSlot(col1, rowStart + rowGap, slotItems.gloves, 'Luvas');
  drawEquipSlot(col1, rowStart + rowGap * 2, slotItems.ring, 'Anel');
  drawEquipSlot(col1, rowStart + rowGap * 3, slotItems.amulet, 'Amuleto');

  // Centro
  drawEquipSlot(col2, rowStart, slotItems.helmet, 'Elmo');
  drawEquipSlot(col2, rowStart + rowGap, slotItems.chest, 'Peitoral');
  drawEquipSlot(col2, rowStart + rowGap * 2, slotItems.pants, 'Calças');
  drawEquipSlot(col2, rowStart + rowGap * 3, slotItems.boots, 'Botas');

  // Lado Direito
  drawEquipSlot(col3, rowStart, slotItems.shield, 'Escudo');
  drawEquipSlot(col3, rowStart + rowGap, slotItems.backpack, 'Mochila');
  drawEquipSlot(col3, rowStart + rowGap * 2, slotItems.pet, 'Pet');

  // ==========================================
  // PAINEL 3: COOLDOWNS & INVENTÁRIO (Direita)
  // ==========================================
  drawRoundedPanel(ctx, 770, panelY, 400, panelH, 10, '#241f1b', '#3b322b');

  // COOLDOWNS
  ctx.fillStyle = '#e3aa59';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('COOLDOWNS', 970, panelY + 35);
  ctx.textAlign = 'left';

  const cdList = [
    { label: 'Dungeon', val: formatCooldown(char.lastDungeon, 5) },
    { label: 'Treinar', val: formatCooldown(char.lastTrain, 20) },
    { label: 'Explorar', val: formatCooldown(char.lastExplore, 3) },
    { label: 'Pescar', val: formatCooldown(char.lastFishing, 10) },
    { label: 'Meditar', val: formatCooldown(char.lastRest, 30) },
    { label: 'Viagem', val: formatCooldown(char.lastTravel, loc.travelCooldownMin) },
  ];

  let cx = 800;
  let cy = panelY + 70;
  ctx.font = '13px "InterFont", sans-serif';
  for (let i = 0; i < cdList.length; i++) {
    ctx.fillStyle = '#b0a498';
    ctx.fillText(`${cdList[i].label}:`, cx, cy);
    ctx.fillStyle = cdList[i].val === 'PRONTO' ? '#5c9c6f' : '#c45843';
    ctx.fillText(cdList[i].val, cx + 70, cy);

    cx += 170;
    if ((i + 1) % 2 === 0) {
      cx = 800;
      cy += 30;
    }
  }

  // Divisória
  ctx.strokeStyle = '#332b25';
  ctx.beginPath(); ctx.moveTo(800, panelY + 160); ctx.lineTo(1140, panelY + 160); ctx.stroke();

  // INVENTÁRIO (Grid perfeito sem cortar)
  ctx.fillStyle = '#e3aa59';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('INVENTÁRIO', 970, panelY + 195);
  ctx.textAlign = 'left';

  // 6 Colunas x 4 Linhas = 24 Slots
  const invCols = 6;
  const invRows = 4;
  const invBoxSize = 52;
  const invGap = 10;
  const invStartX = 785;
  const invStartY = panelY + 225;

  for (let i = 0; i < invCols * invRows; i++) {
    const row = Math.floor(i / invCols);
    const col = i % invCols;
    const x = invStartX + col * (invBoxSize + invGap);
    const y = invStartY + row * (invBoxSize + invGap);

    if (inventory[i]) {
      const itemData = getItem(inventory[i].itemId);
      if (itemData) {
        const rarityColor = RARITY_COLORS[itemData.rarity] || '#ffffff';
        drawRoundedPanel(ctx, x, y, invBoxSize, invBoxSize, 6, '#1c1815', rarityColor);

        ctx.fillStyle = '#f4efe6';
        ctx.font = 'bold 10px "InterFont", sans-serif';
        ctx.textAlign = 'center';
        const shortName = stripEmojis(itemData.name).split(' ')[0].substring(0, 8);
        ctx.fillText(shortName, x + invBoxSize / 2, y + invBoxSize / 2 + 2);

        ctx.fillStyle = '#e3aa59';
        ctx.font = 'bold 10px "InterFont", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${inventory[i].quantity}`, x + invBoxSize - 4, y + invBoxSize - 4);
        ctx.textAlign = 'left';
      }
    } else {
      drawRoundedPanel(ctx, x, y, invBoxSize, invBoxSize, 6, '#1a1715', '#332b25');
    }
  }

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
