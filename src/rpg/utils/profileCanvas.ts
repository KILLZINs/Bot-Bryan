import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

// Registra a fonte local Inter-Bold
try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte Inter-Bold:', e);
}

// Interface flexível que aceita o objeto do Prisma e o formato customizado
export interface ProfileData {
  username?: string;
  name?: string;
  level?: number;
  avatarUrl?: string;
  gold?: number;
  guildName?: string;
  
  // Propriedades do formato direto do Prisma
  currentHp?: number;
  maxHp?: number;
  currentMana?: number;
  maxMana?: number;
  str?: number;
  agi?: number;
  int?: number;
  equipment?: any;

  // Propriedades do formato agrupado
  hp?: { current: number; max: number };
  mana?: { current: number; max: number };
  attributes?: { str: number; agi: number; int: number };
  equipments?: {
    head?: string;
    armor?: string;
    weapon?: string;
    shield?: string;
    legs?: string;
    boots?: string;
  };
}

export async function generateRpgProfile(data: any, _extraParam?: any): Promise<Buffer> {
  const width = 850;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Normalização dos dados para aceitar qualquer formato enviado pelo rpg.ts
  const name = data.username || data.name || 'HERÓI';
  const level = data.level ?? 1;
  const hpCurrent = data.hp?.current ?? data.currentHp ?? 100;
  const hpMax = data.hp?.max ?? data.maxHp ?? 100;
  const manaCurrent = data.mana?.current ?? data.currentMana ?? 50;
  const manaMax = data.mana?.max ?? data.maxMana ?? 50;
  
  const str = data.attributes?.str ?? data.str ?? 10;
  const agi = data.attributes?.agi ?? data.agi ?? 10;
  const intVal = data.attributes?.int ?? data.int ?? 10;
  
  const gold = data.gold ?? 0;
  const guildName = data.guildName ?? 'Sem Guilda';
  const avatarUrl = data.avatarUrl ?? '';
  const eq = data.equipments || data.equipment || {};

  // 1. FUNDO E MOLDURA TEMÁTICA
  ctx.fillStyle = '#120f0d';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1c1613';
  ctx.strokeStyle = '#6e5334';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(15, 15, width - 30, height - 30, 10);
  ctx.fill();
  ctx.stroke();

  // 2. PAINEL ESQUERDO (Status & Atributos)
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 22px "InterFont", sans-serif';
  ctx.fillText(name.toUpperCase(), 40, 55);

  ctx.fillStyle = '#a88967';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`Nível ${level} • Aventureiro`, 40, 78);

  function drawBar(y: number, label: string, current: number, max: number, color: string) {
    ctx.fillStyle = '#d9c39e';
    ctx.font = 'bold 12px "InterFont", sans-serif';
    ctx.fillText(`${label}: ${current}/${max}`, 40, y);

    ctx.fillStyle = '#080605';
    ctx.fillRect(40, y + 6, 190, 10);

    const fillWidth = Math.min(((current || 0) / (max || 1)) * 190, 190);
    ctx.fillStyle = color;
    ctx.fillRect(40, y + 6, fillWidth, 10);
  }

  drawBar(105, 'HP', hpCurrent, hpMax, '#a82a2a');
  drawBar(145, 'MANA', manaCurrent, manaMax, '#2b62a3');

  // Divisória
  ctx.strokeStyle = '#3d2e1d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 180);
  ctx.lineTo(230, 180);
  ctx.stroke();

  // Atributos
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('ATRIBUTOS', 40, 205);

  ctx.fillStyle = '#c7b299';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`FOR (Força): ${str}`, 40, 230);
  ctx.fillText(`AGI (Agilidade): ${agi}`, 40, 255);
  ctx.fillText(`INT (Inteligência): ${intVal}`, 40, 280);

  // 3. CENTRO (Paperdoll & Avatar)
  const centerX = 425;
  const centerY = 240;

  const slotsCoords = [
    { key: 'head', label: 'Elmo', x: centerX - 25, y: centerY - 145 },
    { key: 'armor', label: 'Peito', x: centerX - 25, y: centerY + 55 },
    { key: 'weapon', label: 'Arma', x: centerX - 115, y: centerY - 35 },
    { key: 'shield', label: 'Escudo', x: centerX + 65, y: centerY - 35 },
    { key: 'legs', label: 'Calça', x: centerX - 25, y: centerY + 115 },
    { key: 'boots', label: 'Bota', x: centerX - 25, y: centerY + 175 }
  ];

  // Linhas de conexão
  ctx.strokeStyle = '#4a3825';
  ctx.lineWidth = 2;
  for (const s of slotsCoords) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(s.x + 25, s.y + 25);
    ctx.stroke();
  }

  // Renderizar Avatar
  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY - 10, 55, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, centerX - 55, centerY - 65, 110, 110);
      ctx.restore();

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 10, 55, 0, Math.PI * 2);
      ctx.stroke();
    } catch (err) {
      console.error('Erro ao renderizar avatar:', err);
    }
  }

  // Renderizar Slots de Equipamento
  for (const slot of slotsCoords) {
    ctx.fillStyle = '#0a0807';
    ctx.strokeStyle = '#6e5334';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 50, 50, 6);
    ctx.fill();
    ctx.stroke();

    const itemUrl = eq[slot.key];

    if (itemUrl && typeof itemUrl === 'string') {
      try {
        const itemImg = await loadImage(itemUrl);
        ctx.drawImage(itemImg, slot.x + 3, slot.y + 3, 44, 44);
      } catch {
        ctx.fillStyle = '#7a6855';
        ctx.font = '10px "InterFont", sans-serif';
        ctx.fillText(slot.label, slot.x + 10, slot.y + 30);
      }
    } else {
      ctx.fillStyle = '#4a3b2c';
      ctx.font = '10px "InterFont", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(slot.label, slot.x + 25, slot.y + 28);
      ctx.textAlign = 'start';
    }
  }

  // 4. PAINEL DIREITO
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 15px "InterFont", sans-serif';
  ctx.fillText('GUILDA / ALIANÇA', 620, 55);

  ctx.fillStyle = '#c7b299';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(guildName, 620, 80);
  ctx.fillText(`Ouro: ${gold.toLocaleString('pt-BR')} G`, 620, 110);

  return canvas.toBuffer('image/png');
}

export const generateProfileCard = generateRpgProfile;