import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

// Registrar a fonte localInter-Bold.ttf
const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');

try {
  // O segundo parâmetro é o 'alias' que usamos no ctx.font
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte do caminho:', fontPath, e);
}

export interface ProfileData {
  username: string;
  level: number;
  hp: { current: number; max: number };
  mana: { current: number; max: number };
  attributes: { str: number; agi: number; int: number };
  gold: number;
  guildName: string;
  avatarUrl: string;
  equipments: {
    head?: string;
    armor?: string;
    weapon?: string;
    shield?: string;
    legs?: string;
    boots?: string;
  };
}

export async function generateRpgProfile(data: ProfileData): Promise<Buffer> {
  const width = 850;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

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
  ctx.fillText(data.username.toUpperCase(), 40, 55);

  ctx.fillStyle = '#a88967';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`Nível ${data.level} • Aventureiro`, 40, 78);

  function drawBar(y: number, label: string, current: number, max: number, color: string) {
    ctx.fillStyle = '#d9c39e';
    ctx.font = 'bold 12px "InterFont", sans-serif';
    ctx.fillText(`${label}: ${current}/${max}`, 40, y);

    ctx.fillStyle = '#080605';
    ctx.fillRect(40, y + 6, 190, 10);

    const fillWidth = Math.min((current / max) * 190, 190);
    ctx.fillStyle = color;
    ctx.fillRect(40, y + 6, fillWidth, 10);
  }

  drawBar(105, 'HP', data.hp.current, data.hp.max, '#a82a2a');
  drawBar(145, 'MANA', data.mana.current, data.mana.max, '#2b62a3');

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
  ctx.fillText(`FOR (Força): ${data.attributes.str}`, 40, 230);
  ctx.fillText(`AGI (Agilidade): ${data.attributes.agi}`, 40, 255);
  ctx.fillText(`INT (Inteligência): ${data.attributes.int}`, 40, 280);

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
  try {
    const avatar = await loadImage(data.avatarUrl);
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

  // Slots
  for (const slot of slotsCoords) {
    ctx.fillStyle = '#0a0807';
    ctx.strokeStyle = '#6e5334';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 50, 50, 6);
    ctx.fill();
    ctx.stroke();

    const itemUrl = data.equipments[slot.key as keyof typeof data.equipments];

    if (itemUrl) {
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
  ctx.fillText('GUILDA', 620, 55);

  ctx.fillStyle = '#c7b299';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(data.guildName, 620, 80);
  ctx.fillText(`Ouro: ${data.gold.toLocaleString('pt-BR')} G`, 620, 110);

  return canvas.toBuffer('image/png');
}
