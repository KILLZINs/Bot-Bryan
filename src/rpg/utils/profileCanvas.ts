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

// Cores de Raridade
const RARITY_COLORS: Record<string, string> = {
  'Comum': '#95A5A6',
  'Incomum': '#27AE60',
  'Raro': '#3498DB',
  'Épico': '#9B59B6',
  'Lendário': '#F1C40F',
};

// ==========================================
// ÍCONES VETORIAIS E AUXILIARES
// ==========================================
function drawCoinIcon(ctx: any, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#f1c40f';
  ctx.strokeStyle = '#b7950b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7d6608';
  ctx.font = 'bold 10px "InterFont", sans-serif';
  ctx.fillText('G', x - 4, y + 4);
  ctx.restore();
}

// Desenha painéis com cantos arredondados (Glassmorphism)
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

// Lida com quebra de linha inteligente para nomes de itens longos
function drawItemName(ctx: any, text: string, x: number, y: number) {
  ctx.fillStyle = '#ffffff';
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
  ctx.textAlign = 'left'; // Reset
}

export async function generateProfileCard(char: any, stats: any, avatarUrlInput?: string): Promise<Buffer> {
  // Aumentei a altura para 1200px para tudo respirar e o inventário não cortar
  const width = 560;
  const height = 1200;
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
  // CENÁRIO E FUNDO (De volta às raízes bonitas)
  // ==========================================
  
  // Céu Místico
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#100a1c'); // Topo escuro
  skyGrad.addColorStop(0.3, '#3a1c2a'); // Fundo arroxeado
  skyGrad.addColorStop(1, '#080808'); // Base preta
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Cadeia de Montanhas (Silhueta)
  ctx.fillStyle = 'rgba(20, 15, 25, 0.6)';
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, 400);
  ctx.bezierCurveTo(150, 350, 300, 450, 560, 380);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Borda Externa Rústica
  ctx.strokeStyle = '#2b2118';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  // ==========================================
  // TOP BAR (Ouro e Barras de HP/EN/XP)
  // ==========================================
  drawRoundedPanel(ctx, 20, 20, width - 40, 60, 10, 'rgba(10, 10, 15, 0.85)', '#3a2e24');

  // Ouro
  drawCoinIcon(ctx, 45, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "InterFont", sans-serif';
  ctx.fillText(`${gold.toLocaleString('pt-BR')}`, 65, 56);

  // Barras
  function drawMiniBar(x: number, y: number, w: number, h: number, current: number, max: number, color: string, label: string) {
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
    const pct = Math.min(current / (max || 1), 1);
    if (pct > 0) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, w * pct, h, 4); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "InterFont", sans-serif';
    ctx.fillText(label, x - 25, y + 9);
  }
  
  drawMiniBar(380, 30, 130, 10, currentHp, maxHp, '#e74c3c', 'HP');
  drawMiniBar(380, 47, 130, 10, currentEnergy, maxEnergy, '#f39c12', 'EN');
  drawMiniBar(380, 64, 130, 10, currentXp, maxXp, '#95a5a6', 'XP');

  // ==========================================
  // ÁREA CENTRAL (Avatar, Info, Equipamentos)
  // ==========================================
  const equipY = 110;
  
  // Painel de Fundo Translúcido para o Avatar e Info
  drawRoundedPanel(ctx, 120, equipY, 320, 400, 15, 'rgba(15, 12, 20, 0.6)');

  // AVATAR
  const avSize = 160;
  const avX = (width / 2) - (avSize / 2);
  const avY = equipY + 20;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(avX, avY, avSize, avSize, 15); // Avatar arredondado (Moderno)
      ctx.clip();
      ctx.drawImage(avatar, avX, avY, avSize, avSize);
      ctx.restore();
    } catch {}
  }
  // Borda do Avatar
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(avX, avY, avSize, avSize, 15); ctx.stroke();

  // NOME E INFORMAÇÕES
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 28px "InterFont", sans-serif';
  ctx.fillText(name.toUpperCase(), width / 2, avY + avSize + 40);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "InterFont", sans-serif';
  ctx.fillText(`Lv. ${level} — ${className.toUpperCase()}`, width / 2, avY + avSize + 65);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`Local: ${locationName}`, width / 2, avY + avSize + 85);
  ctx.fillText(`Karma: ${karma}  |  Gen: ${gen}`, width / 2, avY + avSize + 105);

  // CAIXA DE PODER E HABILIDADE DIVINA
  drawRoundedPanel(ctx, 140, avY + avSize + 125, 280, 80, 10, 'rgba(0,0,0,0.5)', '#3a2e24');
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.fillText(`⚔️ PODER TOTAL: ${power.toLocaleString('pt-BR')}`, width / 2, avY + avSize + 150);
  
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText(`🌟 Habilidade: ${divineName}`, width / 2, avY + avSize + 172);

  ctx.fillStyle = '#3498db';
  ctx.fillText(`💍 ${marriageText}`, width / 2, avY + avSize + 192);
  ctx.textAlign = 'left'; // Reset

  // DESENHAR OS SLOTS LATERAIS
  function drawSlot(x: number, y: number, itemName: string, label: string) {
    drawRoundedPanel(ctx, x, y, 70, 70, 8, 'rgba(25, 25, 30, 0.85)', itemName ? '#d4af37' : '#3e3e3e');
    
    if (itemName) {
      drawItemName(ctx, itemName, x + 35, y + 33);
    } else {
      ctx.fillStyle = '#555555';
      ctx.font = '11px "InterFont", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + 35, y + 39);
      ctx.textAlign = 'left';
    }
  }

  const leftX = 30;
  const rightX = 460;
  const slotGap = 80; // Espaçamento vertical

  // Esquerda (6 Slots)
  drawSlot(leftX, equipY, slotItems.helmet, 'Elmo');
  drawSlot(leftX, equipY + slotGap, slotItems.amulet, 'Amuleto');
  drawSlot(leftX, equipY + slotGap * 2, slotItems.chest, 'Peitoral');
  drawSlot(leftX, equipY + slotGap * 3, slotItems.gloves, 'Luvas');
  drawSlot(leftX, equipY + slotGap * 4, slotItems.pants, 'Calças');
  drawSlot(leftX, equipY + slotGap * 5, slotItems.boots, 'Botas');

  // Direita (5 Slots)
  drawSlot(rightX, equipY, slotItems.weapon, 'Arma');
  drawSlot(rightX, equipY + slotGap, slotItems.shield, 'Escudo');
  drawSlot(rightX, equipY + slotGap * 2, slotItems.ring, 'Anel');
  drawSlot(rightX, equipY + slotGap * 3, slotItems.backpack, 'Mochila');
  drawSlot(rightX, equipY + slotGap * 4, slotItems.pet, 'Pet');

  // ==========================================
  // ÁREA DE STATUS E COMBATE (Recuperado!)
  // ==========================================
  const statsY = 610;
  drawRoundedPanel(ctx, 20, statsY, width - 40, 140, 10, 'rgba(15, 12, 20, 0.85)', '#3a2e24');

  // Divisória no meio
  ctx.strokeStyle = '#3e3e3e';
  ctx.beginPath(); ctx.moveTo(width / 2, statsY + 15); ctx.lineTo(width / 2, statsY + 125); ctx.stroke();

  // Esquerda: Atributos
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('ATRIBUTOS BASE', 40, statsY + 30);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${stats?.str ?? 10}`, 40, statsY + 60);
  ctx.fillText(`AGI: ${stats?.agi ?? 10}`, 150, statsY + 60);
  ctx.fillText(`INT: ${stats?.int ?? 10}`, 40, statsY + 90);
  ctx.fillText(`VIT: ${stats?.vit ?? 10}`, 150, statsY + 90);
  ctx.fillText(`SOR: ${stats?.lck ?? 10}`, 40, statsY + 120);

  // Direita: Combate
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('STATUS DE COMBATE', width / 2 + 20, statsY + 30);

  ctx.fillStyle = '#ffffff';
  ctx.font = '14px "InterFont", sans-serif';
  ctx.fillText(`Ataque: ${stats?.attack ?? 10}`, width / 2 + 20, statsY + 60);
  ctx.fillText(`Defesa: ${stats?.defense ?? 10}`, width / 2 + 130, statsY + 60);
  ctx.fillText(`Crítico: ${(stats?.critChance ?? 0).toFixed(1)}%`, width / 2 + 20, statsY + 90);
  ctx.fillText(`Esquiva: ${(stats?.dodgeChance ?? 0).toFixed(1)}%`, width / 2 + 130, statsY + 90);
  ctx.fillText(`PvP: ${char.pvpWins ?? 0} V`, width / 2 + 20, statsY + 120);
  ctx.fillText(`PvE/Boss: ${char.totalWins ?? 0}`, width / 2 + 130, statsY + 120);

  // ==========================================
  // ÁREA DE COOLDOWNS (Mais Compacta)
  // ==========================================
  const cdY = 765;
  drawRoundedPanel(ctx, 20, cdY, width - 40, 100, 10, 'rgba(15, 12, 20, 0.85)', '#3a2e24');

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TEMPO DE RECARGA (COOLDOWNS)', width / 2, cdY + 25);
  ctx.textAlign = 'left';

  const cdList = [
    { label: 'Dungeon', val: formatCooldown(char.lastDungeon, 5) },
    { label: 'Treino', val: formatCooldown(char.lastTrain, 20) },
    { label: 'Explorar', val: formatCooldown(char.lastExplore, 3) },
    { label: 'Pesca', val: formatCooldown(char.lastFishing, 10) },
    { label: 'Meditar', val: formatCooldown(char.lastRest, 30) },
    { label: 'Viagem', val: formatCooldown(char.lastTravel, loc.travelCooldownMin) },
  ];

  let cx = 40;
  let cy = cdY + 55;
  ctx.font = '13px "InterFont", sans-serif';
  
  for (let i = 0; i < cdList.length; i++) {
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`${cdList[i].label}:`, cx, cy);
    ctx.fillStyle = cdList[i].val === 'PRONTO' ? '#2ecc71' : '#e74c3c';
    ctx.fillText(cdList[i].val, cx + 65, cy);

    cx += 165;
    if ((i + 1) % 3 === 0) {
      cx = 40;
      cy += 30;
    }
  }

  // ==========================================
  // ÁREA DO INVENTÁRIO (Espaçoso e sem cortar!)
  // ==========================================
  const invY = 880;
  drawRoundedPanel(ctx, 20, invY, width - 40, height - invY - 20, 10, 'rgba(15, 12, 20, 0.85)', '#3a2e24');

  // Título
  ctx.fillStyle = '#2c1e16';
  ctx.beginPath(); ctx.roundRect(20, invY, width - 40, 40, { upperLeft: 10, upperRight: 10 }); ctx.fill();
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎒 SEU INVENTÁRIO', width / 2, invY + 26);
  ctx.textAlign = 'left';

  // Grid do Inventário (6 Colunas x 4 Linhas)
  const cols = 6;
  const rows = 4;
  const boxSize = 65;
  const gap = 15;
  
  const totalGridWidth = (cols * boxSize) + ((cols - 1) * gap);
  const startX = (width - totalGridWidth) / 2;
  const startY = invY + 60;

  for (let i = 0; i < cols * rows; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = startX + col * (boxSize + gap);
    const y = startY + row * (boxSize + gap);

    if (inventory[i]) {
      const itemData = getItem(inventory[i].itemId);
      if (itemData) {
        // Fundo e Borda com base na Raridade
        const rarityColor = RARITY_COLORS[itemData.rarity] || '#ffffff';
        
        // Fundo levemente tingido com a cor da raridade
        ctx.fillStyle = 'rgba(30, 30, 35, 0.9)'; 
        ctx.beginPath(); ctx.roundRect(x, y, boxSize, boxSize, 6); ctx.fill();
        
        ctx.strokeStyle = rarityColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Nome Abreviado
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "InterFont", sans-serif';
        ctx.textAlign = 'center';
        const shortName = stripEmojis(itemData.name).split(' ')[0].substring(0, 9);
        ctx.fillText(shortName, x + boxSize / 2, y + boxSize / 2 + 4);

        // Quantidade
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 11px "InterFont", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${inventory[i].quantity}`, x + boxSize - 5, y + boxSize - 5);
        ctx.textAlign = 'left';
      }
    } else {
      // Slot Vazio
      drawRoundedPanel(ctx, x, y, boxSize, boxSize, 6, 'rgba(25, 25, 30, 0.5)', '#3e3e3e');
    }
  }

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
