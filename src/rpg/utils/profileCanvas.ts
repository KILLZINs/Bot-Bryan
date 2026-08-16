import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { getClass, karmaLabel, rpgXpForLevel } from '../constants/classes';
import { getItem } from '../constants/items';
import { getLocation } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';
import { getMarriage } from '../services/marriage';
import { prisma } from '../../database/client'; // Necessário para puxar o inventário real!

try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte Inter-Bold:', e);
}

function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

// Cores de Raridade para o Inventário
const RARITY_COLORS: Record<string, string> = {
  'Comum': '#95A5A6',
  'Incomum': '#27AE60',
  'Raro': '#3498DB',
  'Épico': '#9B59B6',
  'Lendário': '#F1C40F',
};

// ==========================================
// ÍCONES VETORIAIS
// ==========================================
function drawCoinIcon(ctx: any, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#f1c40f';
  ctx.strokeStyle = '#b7950b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7d6608';
  ctx.font = 'bold 9px "InterFont", sans-serif';
  ctx.fillText('G', x - 3, y + 3.5);
  ctx.restore();
}

export async function generateProfileCard(char: any, stats: any, avatarUrlInput?: string): Promise<Buffer> {
  // Layout Vertical Estilo Mobile RPG
  const width = 540;
  const height = 860;
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

  // Os 11 Slots Mapeados
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

  // Busca o Inventário Real do Banco de Dados
  const inventory = await prisma.rpgInventoryItem.findMany({
    where: { characterId: char.discordId },
    orderBy: { quantity: 'desc' }
  });

  const avatarUrl = avatarUrlInput || char.avatarUrl || '';

  // ==========================================
  // FUNDO GERAL (Dark UI)
  // ==========================================
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);

  // Borda Externa Rústica
  ctx.strokeStyle = '#3e3e3e';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);

  // ==========================================
  // TOP BAR (Ouro e Barras de Vida/Energia)
  // ==========================================
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(10, 10, width - 20, 45);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 55); ctx.lineTo(width - 10, 55);
  ctx.stroke();

  // Ouro (Esquerda)
  drawCoinIcon(ctx, 30, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "InterFont", sans-serif';
  ctx.fillText(`${gold.toLocaleString('pt-BR')}`, 45, 38);

  // Barras HP / EN (Direita)
  function drawMiniBar(x: number, y: number, w: number, h: number, current: number, max: number, color: string, label: string) {
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    const pct = Math.min(current / (max || 1), 1);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * pct, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "InterFont", sans-serif';
    ctx.fillText(label, x - 25, y + 10);
  }
  drawMiniBar(380, 20, 130, 12, currentHp, maxHp, '#e74c3c', 'HP');
  drawMiniBar(380, 36, 130, 12, currentEnergy, maxEnergy, '#f39c12', 'EN');

  // ==========================================
  // HEADER (HERO -> Nome do Personagem)
  // ==========================================
  ctx.fillStyle = '#2c1e16'; // Fundo avermelhado/marrom escuro
  ctx.fillRect(10, 56, width - 20, 60);
  
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 30px "InterFont", sans-serif';
  ctx.fillText(name.toUpperCase(), width / 2, 92);
  
  ctx.fillStyle = '#dcdcdc';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText(`Karma: ${karma}  |  Local: ${locationName}`, width / 2, 110);
  ctx.textAlign = 'left';

  // ==========================================
  // ÁREA DO AVATAR E EQUIPAMENTOS (11 Slots)
  // ==========================================
  const equipAreaY = 116;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(10, equipAreaY, width - 20, 420);

  // CAIXA DO AVATAR CENTRAL
  const avSize = 180;
  const avX = (width / 2) - (avSize / 2);
  const avY = equipAreaY + 30;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.drawImage(avatar, avX, avY, avSize, avSize);
    } catch {}
  }
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 4;
  ctx.strokeRect(avX, avY, avSize, avSize);

  // Placa de Classe/Level
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(avX - 10, avY - 15, avSize + 20, 25);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.fillText(className.toUpperCase(), width / 2, avY + 3);

  ctx.fillStyle = '#111';
  ctx.fillRect(avX, avY + avSize - 25, avSize, 25);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.fillText(`Lv: ${level}`, width / 2, avY + avSize - 7);
  ctx.textAlign = 'left';

  // DESENHAR OS SLOTS (Caixinhas 60x60)
  function drawSlot(x: number, y: number, itemName: string, label: string) {
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, 60, 60);
    ctx.strokeStyle = itemName ? '#d4af37' : '#3e3e3e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 60, 60);
    
    if (itemName) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "InterFont", sans-serif';
      ctx.textAlign = 'center';
      const words = itemName.split(' ');
      if (words.length > 1) {
        ctx.fillText(words[0].substring(0, 9), x + 30, y + 28);
        ctx.fillText(words[1].substring(0, 9), x + 30, y + 40);
      } else {
        ctx.fillText(itemName.substring(0, 9), x + 30, y + 34);
      }
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '10px "InterFont", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + 30, y + 34);
      ctx.textAlign = 'left';
    }
  }

  // Colunas Laterais
  const leftX = 30;
  const rightX = 450;
  let currentY = equipAreaY + 20;

  // Lado Esquerdo (6 Slots)
  drawSlot(leftX, currentY, slotItems.helmet, 'Elmo');
  drawSlot(leftX, currentY + 65, slotItems.amulet, 'Amul.');
  drawSlot(leftX, currentY + 130, slotItems.chest, 'Peito');
  drawSlot(leftX, currentY + 195, slotItems.gloves, 'Luva');
  drawSlot(leftX, currentY + 260, slotItems.pants, 'Calça');
  drawSlot(leftX, currentY + 325, slotItems.boots, 'Bota');

  // Lado Direito (5 Slots)
  drawSlot(rightX, currentY, slotItems.weapon, 'Arma');
  drawSlot(rightX, currentY + 65, slotItems.shield, 'Escudo');
  drawSlot(rightX, currentY + 130, slotItems.ring, 'Anel');
  drawSlot(rightX, currentY + 195, slotItems.backpack, 'Mochila');
  drawSlot(rightX, currentY + 260, slotItems.pet, 'Pet');

  // DEBAIXO DO AVATAR (Poder, Habilidade, Casamento)
  const underAvY = avY + avSize + 15;
  ctx.fillStyle = '#222';
  ctx.strokeStyle = '#5c4033';
  ctx.fillRect(avX - 10, underAvY, avSize + 20, 100);
  ctx.strokeRect(avX - 10, underAvY, avSize + 20, 100);
  
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`⚔️ PODER: ${power.toLocaleString('pt-BR')}`, width / 2, underAvY + 25);
  
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText(`🌟 HABILIDADE: ${divineName.substring(0, 18)}`, width / 2, underAvY + 50);

  ctx.fillStyle = '#3498db';
  ctx.fillText(`💍 ${marriageText}`, width / 2, underAvY + 75);
  ctx.textAlign = 'left';


  // ==========================================
  // ÁREA DO INVENTÁRIO (Grid Inferior)
  // ==========================================
  const gridStartY = 540;
  ctx.fillStyle = '#111';
  ctx.fillRect(10, gridStartY, width - 20, height - gridStartY - 10);
  
  // Título da Aba de Inventário
  ctx.fillStyle = '#2c1e16';
  ctx.fillRect(10, gridStartY, width - 20, 35);
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎒 INVENTÁRIO', width / 2, gridStartY + 23);
  ctx.textAlign = 'left';

  // Desenhando o Grid de Slots de Inventário (6 Colunas x 4 Linhas = 24 Slots)
  const cols = 6;
  const rows = 4;
  const boxSize = 65;
  const gap = 15;
  
  // Calcular margem esquerda para centralizar o grid
  const totalGridWidth = (cols * boxSize) + ((cols - 1) * gap);
  const startX = (width - totalGridWidth) / 2;
  const startY = gridStartY + 50;

  for (let i = 0; i < cols * rows; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = startX + col * (boxSize + gap);
    const y = startY + row * (boxSize + gap);

    // Fundo do Slot Vazio
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(x, y, boxSize, boxSize);
    ctx.strokeStyle = '#3e3e3e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxSize, boxSize);

    // Se tiver item no inventário, desenha dentro
    if (inventory[i]) {
      const itemData = getItem(inventory[i].itemId);
      if (itemData) {
        // Borda com a cor da raridade
        ctx.strokeStyle = RARITY_COLORS[itemData.rarity] || '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, boxSize, boxSize);

        // Nome Abreviado do Item
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "InterFont", sans-serif';
        ctx.textAlign = 'center';
        
        // Pega a primeira palavra forte do item pra caber no quadradinho
        const shortName = stripEmojis(itemData.name).split(' ')[0].substring(0, 9);
        ctx.fillText(shortName, x + boxSize / 2, y + boxSize / 2 + 4);

        // Quantidade no canto inferior direito
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 11px "InterFont", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${inventory[i].quantity}`, x + boxSize - 4, y + boxSize - 4);
        ctx.textAlign = 'left';
      }
    }
  }

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
