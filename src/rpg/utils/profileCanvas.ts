// ═══════════════════════════════════════════════════════════════════════
// GERADOR DE CARD DE PERFIL (VISUAL)
// ═══════════════════════════════════════════════════════════════════════

import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { getRpgClass } from '../constants/classes';
import { COSMETIC_TITLES, COSMETIC_BACKGROUNDS } from '../constants/cosmetics';
import { RpgCharacter, ClassStats } from '@prisma/client'; 

// 🎨 Paleta de cores do sistema Skyline
const COLOR = {
  bg: '#1e1e1e', 
  primary: '#f1c40f', 
  text: '#ffffff',
  textSub: '#aaaaaa',
  barBg: '#333333',
  barHp: '#e74c3c',
  barXp: '#3498db'
};

const LAYOUT = {
  width: 1200,
  height: 675,
  avatarSize: 180,
  padding: 50
};

export async function generateProfileCard(
  char: RpgCharacter,
  stats: ClassStats,
  avatarUrl: string,
  preloadedAvatar?: Buffer 
): Promise<Buffer> {
  const canvas = createCanvas(LAYOUT.width, LAYOUT.height);
  const ctx = canvas.getContext('2d');

  const avatarImage = preloadedAvatar ? await loadImage(preloadedAvatar) : await loadImage(avatarUrl);

  // ═══════════════════════════════════════════════════════════════════════
  // 1. DESENHAR O FUNDO (COSMÉTICO OU PADRÃO)
  // ═══════════════════════════════════════════════════════════════════════
  if (char.activeBackground && COSMETIC_BACKGROUNDS[char.activeBackground]) {
    const bg = COSMETIC_BACKGROUNDS[char.activeBackground];
    
    if (bg.url.startsWith('color:')) {
      ctx.fillStyle = bg.url.replace('color:', '');
      ctx.fillRect(0, 0, LAYOUT.width, LAYOUT.height);
    } else {
      try {
        const bgImg = await loadImage(bg.url);
        ctx.globalAlpha = 0.4;
        ctx.drawImage(bgImg, 0, 0, LAYOUT.width, LAYOUT.height);
        ctx.globalAlpha = 1.0;
      } catch (e) {
        ctx.fillStyle = COLOR.bg;
        ctx.fillRect(0, 0, LAYOUT.width, LAYOUT.height);
      }
    }
  } else {
    ctx.fillStyle = COLOR.bg; 
    ctx.fillRect(0, 0, LAYOUT.width, LAYOUT.height);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. DESENHAR O AVATAR E INFOS BÁSICAS (NOME/CLASSE)
  // ═══════════════════════════════════════════════════════════════════════
  const avatarX = LAYOUT.padding;
  const avatarY = LAYOUT.padding; 
  const infoX = avatarX + LAYOUT.avatarSize + 40;

  drawCircularAvatar(ctx, avatarImage, avatarX, avatarY, char.class);
  drawPlayerName(ctx, char.username, char.class, infoX, avatarY + 60);

  // ═══════════════════════════════════════════════════════════════════════
  // 3. DESENHAR O TÍTULO ESTÉTICO
  // ═══════════════════════════════════════════════════════════════════════
  if (char.activeTitle && COSMETIC_TITLES[char.activeTitle]) {
    const title = COSMETIC_TITLES[char.activeTitle];
    
    ctx.font = 'italic 26px "Sans Serif"'; 
    ctx.fillStyle = '#dddddd'; 
    ctx.textAlign = 'left';
    ctx.fillText(`"${title.label}"`, infoX, avatarY + 110); 
  } else {
    // Se não tiver título, mostra o level no lugar
    ctx.font = '26px "Sans Serif"'; 
    ctx.fillStyle = '#dddddd';
    ctx.textAlign = 'left';
    ctx.fillText(`Aventureiro Lv. ${char.level}`, infoX, avatarY + 110);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. DESENHAR BARRAS DE STATUS E ATRIBUTOS
  // ═══════════════════════════════════════════════════════════════════════
  const barsY = avatarY + LAYOUT.avatarSize + 40;
  drawStatusBars(ctx, char, stats, barsY);

  const statsY = barsY + 100;
  drawStatsBlock(ctx, stats, statsY);

  return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════

function drawCircularAvatar(ctx: CanvasRenderingContext2D, img: any, x: number, y: number, classId: string): void {
  const r = LAYOUT.avatarSize / 2;
  const cx = x + r;
  const cy = y + r;
  const rpgClass = getRpgClass(classId);

  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.fillStyle = rpgClass ? rpgClass.color : '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(img, x, y, LAYOUT.avatarSize, LAYOUT.avatarSize);
  ctx.restore();
}

function drawPlayerName(ctx: CanvasRenderingContext2D, username: string, classId: string, x: number, y: number): void {
  const rpgClass = getRpgClass(classId);

  ctx.font = 'bold 50px "Sans Serif"';
  ctx.fillStyle = COLOR.text;
  ctx.textAlign = 'left';
  ctx.fillText(username, x, y);

  if (rpgClass) {
    ctx.font = '40px "Sans Serif"';
    ctx.fillStyle = rpgClass.color;
    ctx.fillText(`${rpgClass.emoji} ${rpgClass.name}`, x, y + 50);
  }
}

function drawStatusBars(ctx: CanvasRenderingContext2D, char: RpgCharacter, stats: ClassStats, y: number): void {
  const barWidth = 530;
  const barHeight = 40;
  const hpX = LAYOUT.padding;
  const xpX = hpX + barWidth + 40;

  drawBar(ctx, hpX, y, barWidth, barHeight, char.hp / char.baseHp, COLOR.barHp, `❤️ ${char.hp}/${char.baseHp}`);
  
  const nextLevelXp = Math.floor(150 * Math.pow(1.30, char.level - 1));
  drawBar(ctx, xpX, y, barWidth, barHeight, char.xp / nextLevelXp, COLOR.barXp, `⭐ XP: ${char.xp}/${nextLevelXp}`);
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, color: string, text: string): void {
  ctx.fillStyle = COLOR.barBg;
  ctx.fillRect(x, y, w, h);
  
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
  
  ctx.font = 'bold 24px "Sans Serif"';
  ctx.fillStyle = COLOR.text;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h / 2 + 8);
}

function drawStatsBlock(ctx: CanvasRenderingContext2D, stats: ClassStats, y: number): void {
  const statX = LAYOUT.padding;
  ctx.font = 'bold 36px "Sans Serif"';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.textSub;

  const labels = [
    `⚔️ FOR: ${stats.str}`, `🛡️ VIT: ${stats.vit}`,
    `🔮 INT: ${stats.int}`, `💨 AGI: ${stats.agi}`,
    `🍀 SOR: ${stats.lck}`
  ];

  for (let i = 0; i < labels.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    ctx.fillText(labels[i], statX + col * 250, y + row * 60);
  }
}
