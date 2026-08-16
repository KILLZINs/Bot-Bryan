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
  if (!text) return '';
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

// Paleta de Cores de Raridade Minimalista
const RARITY_COLORS: Record<string, string> = {
  'Comum': '#839192',
  'Incomum': '#2ecc71',
  'Raro': '#3498db',
  'Épico': '#9b59b6',
  'Lendário': '#f1c40f',
};

// Fonte Segura para Emojis
const EMOJI_FONT = '"InterFont", "Segoe UI Emoji", "Apple Color Emoji", sans-serif';

// ==========================================
// FUNÇÕES DE DESENHO VETORIAL
// ==========================================
function drawCoinIcon(ctx: any, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#f1c40f';
  ctx.strokeStyle = '#b7950b';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a3212';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText('G', x - 5, y + 4.5);
  ctx.restore();
}

function drawRoundedPanel(ctx: any, x: number, y: number, w: number, h: number, radius: number, bgColor: string, strokeColor?: string) {
  ctx.fillStyle = bgColor;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export async function generateProfileCard(char: any, stats: any, avatarUrlInput?: string): Promise<Buffer> {
  // Tela Larga: Layout Estilo Dashboard de Jogo Moderno
  const width = 1200;
  const height = 750;
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
  } catch {}

  let divineName = 'Nenhuma';
  let divineRank = 'F';
  if (char.divineSkillId && DIVINE_SKILLS[char.divineSkillId]) {
    divineName = stripEmojis(DIVINE_SKILLS[char.divineSkillId].name);
    divineRank = String(char.divineSkillRank ?? 'F');
  }

  const resolveItemData = (itemId?: string | null) => itemId ? getItem(itemId) || null : null;

  const slotItems = {
    helmet: resolveItemData(eq?.helmet),
    amulet: resolveItemData(eq?.amulet),
    chest: resolveItemData(eq?.chest || eq?.armor),
    gloves: resolveItemData(eq?.gloves),
    pants: resolveItemData(eq?.pants),
    boots: resolveItemData(eq?.boots),
    weapon: resolveItemData(eq?.weapon),
    shield: resolveItemData(eq?.shield),
    ring: resolveItemData(eq?.ring),
    backpack: resolveItemData(eq?.backpack),
    pet: resolveItemData(eq?.pet),
  };

  const inventory = await prisma.rpgInventoryItem.findMany({
    where: { characterId: char.discordId },
    orderBy: { quantity: 'desc' }
  });

  const avatarUrl = avatarUrlInput || char.avatarUrl || '';

  // ==========================================
  // FUNDO DO DASHBOARD (Discord Dark Theme feeling)
  // ==========================================
  ctx.fillStyle = '#1e1f22'; // Cor exata de fundo de embeds do Discord moderno
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#2b2d31';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);

  const panelBg = '#2b2d31'; // Cor dos painéis internos
  const panelStroke = '#383a40';

  // ==========================================
  // CABEÇALHO PANORÂMICO (Header)
  // ==========================================
  const headerY = 25;
  drawRoundedPanel(ctx, 25, headerY, width - 50, 140, 12, panelBg, panelStroke);

  // Avatar Redondo
  const avSize = 100;
  const avX = 50;
  const avY = headerY + 20;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath(); ctx.arc(avX + avSize/2, avY + avSize/2, avSize/2, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(avatar, avX, avY, avSize, avSize);
      ctx.restore();
    } catch {}
  }
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(avX + avSize/2, avY + avSize/2, avSize/2, 0, Math.PI * 2); ctx.stroke();

  // Info Principal (Nome, Classe, Level)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "InterFont", sans-serif';
  ctx.fillText(name.toUpperCase(), 175, headerY + 55);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 18px "InterFont", sans-serif';
  ctx.fillText(`NÍVEL ${level} — ${className.toUpperCase()}`, 175, headerY + 85);

  // Tags Secundárias
  ctx.fillStyle = '#b5bac1';
  ctx.font = '14px "InterFont", sans-serif';
  ctx.fillText(`Localização Atual: ${locationName}`, 175, headerY + 115);
  
  // Ouro
  drawCoinIcon(ctx, 420, headerY + 110);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.fillText(gold.toLocaleString('pt-BR'), 435, headerY + 115);

  // Status Bars (LED Style)
  function drawLedBar(x: number, y: number, w: number, current: number, max: number, color: string, label: string) {
    ctx.fillStyle = '#1e1f22';
    ctx.beginPath(); ctx.roundRect(x, y, w, 12, 6); ctx.fill();
    const pct = Math.min(current / (max || 1), 1);
    if (pct > 0) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, w * pct, 12, 6); ctx.fill();
    }
    ctx.fillStyle = '#dbdee1';
    ctx.font = 'bold 12px "InterFont", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, x - 10, y + 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#80848e';
    ctx.font = '10px "InterFont", sans-serif';
    ctx.fillText(`${current}/${max}`, x + w + 10, y + 10);
  }

  const barX = 720;
  drawLedBar(barX, headerY + 35, 200, currentHp, maxHp, '#ed4245', 'HP');
  drawLedBar(barX, headerY + 65, 200, currentEnergy, maxEnergy, '#fee75c', 'ENERGIA');
  drawLedBar(barX, headerY + 95, 200, currentXp, maxXp, '#5865f2', 'XP');

  // Poder de Combate Gigante na Direita
  ctx.textAlign = 'right';
  ctx.fillStyle = '#b5bac1';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.fillText('PODER DE COMBATE', width - 50, headerY + 65);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 42px "InterFont", sans-serif';
  ctx.fillText(power.toLocaleString('pt-BR'), width - 50, headerY + 110);
  ctx.textAlign = 'left';

  // Configurações Globais dos Painéis Inferiores
  const panelY = 185;
  const panelH = 540;

  // ==========================================
  // PAINEL 1: PERFIL DIMENSIONAL (Status Coloridos)
  // ==========================================
  drawRoundedPanel(ctx, 25, panelY, 360, panelH, 12, panelBg, panelStroke);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATRIBUTOS DE COMBATE', 205, panelY + 35);
  ctx.textAlign = 'left';

  // Grade de Atributos Coloridos
  const statBoxY = panelY + 65;
  function drawColorStat(x: number, y: number, value: number, label: string, color: string) {
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 32px "InterFont", sans-serif';
    ctx.fillText(String(value), x, y + 30);
    ctx.fillStyle = '#b5bac1';
    ctx.font = 'bold 12px "InterFont", sans-serif';
    ctx.fillText(label, x, y + 50);
    ctx.textAlign = 'left';
  }

  drawColorStat(75, statBoxY, stats?.str ?? 10, 'FOR', '#ed4245'); // Vermelho
  drawColorStat(165, statBoxY, stats?.agi ?? 10, 'AGI', '#57f287'); // Verde
  drawColorStat(255, statBoxY, stats?.int ?? 10, 'INT', '#3498db'); // Azul
  drawColorStat(120, statBoxY + 70, stats?.vit ?? 10, 'VIT', '#e67e22'); // Laranja
  drawColorStat(210, statBoxY + 70, stats?.lck ?? 10, 'SOR', '#9b59b6'); // Roxo

  // Divisória
  ctx.strokeStyle = panelStroke;
  ctx.beginPath(); ctx.moveTo(45, panelY + 215); ctx.lineTo(365, panelY + 215); ctx.stroke();

  // Status Secundários
  function drawSecStat(x: number, y: number, label: string, value: string, icon: string) {
    drawRoundedPanel(ctx, x, y, 150, 60, 8, '#1e1f22', panelStroke);
    ctx.fillStyle = '#b5bac1';
    ctx.font = 'bold 11px "InterFont", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 75, y + 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "InterFont", sans-serif';
    ctx.fillText(`${icon} ${value}`, x + 75, y + 45);
    ctx.textAlign = 'left';
  }

  drawSecStat(45, panelY + 235, 'ATAQUE', String(stats?.attack ?? 10), '⚔️');
  drawSecStat(215, panelY + 235, 'DEFESA', String(stats?.defense ?? 10), '🛡️');
  drawSecStat(45, panelY + 310, 'CRÍTICO', `${(stats?.critChance ?? 0).toFixed(1)}%`, '💥');
  drawSecStat(215, panelY + 310, 'ESQUIVA', `${(stats?.dodgeChance ?? 0).toFixed(1)}%`, '💨');

  // Habilidade Divina Box
  drawRoundedPanel(ctx, 45, panelY + 390, 320, 120, 8, '#1e1f22', '#d4af37'); // Borda Dourada Específica
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText('HABILIDADE DIVINA:', 60, panelY + 415);
  ctx.fillStyle = '#9b59b6';
  ctx.font = 'bold 20px "InterFont", sans-serif';
  ctx.fillText(`${divineName.toUpperCase()} [Rank ${divineRank}]`, 60, panelY + 445);
  ctx.fillStyle = '#b5bac1';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`Aura Kármica: ${karma}`, 60, panelY + 475);
  ctx.fillText(`💍 Status: ${marriageText}`, 60, panelY + 495);


  // ==========================================
  // PAINEL 2: EQUIPAMENTO TÁTICO (Wireframe)
  // ==========================================
  drawRoundedPanel(ctx, 410, panelY, 390, panelH, 12, panelBg, panelStroke);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EQUIPAMENTO ATUAL', 605, panelY + 35);

  // DESENHAR LINHAS DE ENERGIA (Wireframe Tático)
  ctx.strokeStyle = 'rgba(241, 196, 15, 0.15)'; // Linhas holográficas douradas
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Espinha dorsal (Elmo -> Amuleto -> Peito -> Calça -> Botas)
  ctx.moveTo(605, panelY + 110); ctx.lineTo(605, panelY + 430);
  // Braços (Arma -> Peito <- Escudo)
  ctx.moveTo(495, panelY + 230); ctx.lineTo(715, panelY + 230);
  // Ombros (Peito -> Mochila)
  ctx.moveTo(605, panelY + 160); ctx.lineTo(715, panelY + 160);
  // Mãos e Acessórios (Luvas -> Calças <- Anel)
  ctx.moveTo(495, panelY + 330); ctx.lineTo(715, panelY + 330);
  ctx.stroke();

  // Função para desenhar Slot de Equipamento
  function drawEquipSlot(x: number, y: number, itemData: any, ghostLabel: string, ghostEmoji: string) {
    const isEquipped = !!itemData;
    // Box com sombra para destacar do fundo tático
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    drawRoundedPanel(ctx, x - 32, y - 32, 64, 64, 8, '#1e1f22', isEquipped ? '#f1c40f' : panelStroke);
    ctx.shadowBlur = 0; // Reset
    
    ctx.textAlign = 'center';
    if (isEquipped) {
      // Background Glow
      const glow = ctx.createRadialGradient(x, y, 5, x, y, 30);
      glow.addColorStop(0, RARITY_COLORS[itemData.rarity] || '#ffffff');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.2;
      ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1.0;

      // Emoji
      ctx.fillStyle = '#ffffff';
      ctx.font = `26px ${EMOJI_FONT}`;
      ctx.fillText(itemData.emoji, x, y + 4);

      // Label do Item
      ctx.fillStyle = '#dbdee1';
      ctx.font = 'bold 9px "InterFont", sans-serif';
      const shortName = stripEmojis(itemData.name).split(' ')[0].substring(0, 10);
      ctx.fillText(shortName, x, y + 25);
    } else {
      ctx.fillStyle = '#4e5058';
      ctx.font = `26px ${EMOJI_FONT}`;
      ctx.fillText(ghostEmoji, x, y + 4);

      ctx.fillStyle = '#80848e';
      ctx.font = 'bold 9px "InterFont", sans-serif';
      ctx.fillText(ghostLabel, x, y + 25);
    }
  }

  // Mapeamento Anatômico Perfeito (Centro X = 605)
  const cX = 605;
  const lX = 495; // Braço Esquerdo
  const rX = 715; // Braço Direito

  drawEquipSlot(cX, panelY + 90, slotItems.helmet, 'Elmo', '⛑️');
  drawEquipSlot(cX, panelY + 170, slotItems.amulet, 'Amuleto', '🔮');
  drawEquipSlot(cX, panelY + 250, slotItems.chest, 'Peitoral', '👕');
  drawEquipSlot(cX, panelY + 330, slotItems.pants, 'Calças', '👖');
  drawEquipSlot(cX, panelY + 410, slotItems.boots, 'Botas', '👟');

  drawEquipSlot(lX, panelY + 210, slotItems.weapon, 'Arma', '⚔️');
  drawEquipSlot(lX, panelY + 300, slotItems.gloves, 'Luvas', '🧤');
  
  drawEquipSlot(rX, panelY + 150, slotItems.backpack, 'Mochila', '🎒');
  drawEquipSlot(rX, panelY + 240, slotItems.shield, 'Escudo', '🛡️');
  drawEquipSlot(rX, panelY + 330, slotItems.ring, 'Anel', '💍');
  
  // Pet (Flutuando no canto inferior)
  drawEquipSlot(rX, panelY + 450, slotItems.pet, 'Pet', '🐾');
  ctx.textAlign = 'left'; // Reset


  // ==========================================
  // PAINEL 3: TÁTICO & INVENTÁRIO (Direita)
  // ==========================================
  drawRoundedPanel(ctx, 825, panelY, 350, panelH, 12, panelBg, panelStroke);

  // COOLDOWNS (Estilo Tags Nativas Discord)
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AÇÕES & COOLDOWNS', 1000, panelY + 35);
  ctx.textAlign = 'left';

  const cdList = [
    { label: 'Dungeon', val: formatCooldown(char.lastDungeon, 5) },
    { label: 'Treino', val: formatCooldown(char.lastTrain, 20) },
    { label: 'Explorar', val: formatCooldown(char.lastExplore, 3) },
    { label: 'Pescar', val: formatCooldown(char.lastFishing, 10) },
    { label: 'Meditar', val: formatCooldown(char.lastRest, 30) },
    { label: 'Viagem', val: formatCooldown(char.lastTravel, loc.travelCooldownMin) },
  ];

  let cdX = 845;
  let cdY = panelY + 70;
  for (let i = 0; i < cdList.length; i++) {
    const isReady = cdList[i].val === 'PRONTO';
    drawRoundedPanel(ctx, cdX, cdY, 145, 30, 6, '#1e1f22', isReady ? '#2ecc71' : '#ed4245');
    
    ctx.fillStyle = '#dbdee1';
    ctx.font = 'bold 11px "InterFont", sans-serif';
    ctx.fillText(cdList[i].label, cdX + 10, cdY + 19);
    
    ctx.fillStyle = isReady ? '#2ecc71' : '#ed4245';
    ctx.textAlign = 'right';
    ctx.fillText(cdList[i].val, cdX + 135, cdY + 19);
    ctx.textAlign = 'left';

    cdX += 160;
    if ((i + 1) % 2 === 0) {
      cdX = 845;
      cdY += 40;
    }
  }

  // Divisória
  ctx.strokeStyle = panelStroke;
  ctx.beginPath(); ctx.moveTo(845, panelY + 210); ctx.lineTo(1155, panelY + 210); ctx.stroke();

  // INVENTÁRIO (Grid de 24)
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('INVENTÁRIO DIMENSIONAL', 1000, panelY + 245);
  ctx.textAlign = 'left';

  const invCols = 6;
  const invRows = 4;
  const invBoxSize = 48; // Levemente menor pra caber no painel de 350px
  const invGap = 6;
  const totalGridWidth = (invCols * invBoxSize) + ((invCols - 1) * invGap);
  const invStartX = 825 + (350 - totalGridWidth) / 2;
  const invStartY = panelY + 270;

  for (let i = 0; i < invCols * invRows; i++) {
    const row = Math.floor(i / invCols);
    const col = i % invCols;
    const x = invStartX + col * (invBoxSize + invGap);
    const y = invStartY + row * (invBoxSize + invGap);

    if (inventory[i]) {
      const itemData = getItem(inventory[i].itemId);
      if (itemData) {
        const rarityColor = RARITY_COLORS[itemData.rarity] || '#ffffff';
        drawRoundedPanel(ctx, x, y, invBoxSize, invBoxSize, 6, '#1e1f22', rarityColor);

        ctx.textAlign = 'center';
        // Emoji
        ctx.fillStyle = '#ffffff';
        ctx.font = `20px ${EMOJI_FONT}`;
        ctx.fillText(itemData.emoji, x + invBoxSize / 2, y + 28);

        // Texto da Quantidade (Caixinha flutuante)
        const qtyText = `x${inventory[i].quantity}`;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath(); ctx.roundRect(x + invBoxSize - 22, y + invBoxSize - 14, 20, 12, 3); ctx.fill();
        
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 9px "InterFont", sans-serif';
        ctx.fillText(qtyText, x + invBoxSize - 12, y + invBoxSize - 5);
      }
    } else {
      drawRoundedPanel(ctx, x, y, invBoxSize, invBoxSize, 6, '#1e1f22', panelStroke);
    }
  }

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
