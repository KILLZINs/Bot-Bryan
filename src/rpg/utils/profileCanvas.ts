import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { getClass, karmaLabel, rpgXpForLevel } from '../constants/classes';
import { getItem } from '../constants/items';
import { getLocation } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';
import { getMarriage } from '../services/marriage';
import { prisma } from '../../database/client';
import { COSMETIC_TITLES, COSMETIC_BACKGROUNDS } from '../constants/cosmetics'; // ✅ Import da Loja

// ==========================================
// REGISTRO DE FONTES (Com suporte a Emojis!)
// ==========================================
try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
  
  const emojiPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'NotoColorEmoji.ttf');
  GlobalFonts.registerFromPath(emojiPath, 'EmojiFallback');
} catch (e) {
  console.error('Erro ao carregar fontes no Canvas:', e);
}

const GLOBAL_FONT = '"InterFont", "EmojiFallback", "Segoe UI Emoji", "Apple Color Emoji", sans-serif';

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

const RARITY_COLORS: Record<string, string> = {
  'Comum': '#839192',
  'Incomum': '#2ecc71',
  'Raro': '#3498db',
  'Épico': '#9b59b6',
  'Lendário': '#f1c40f',
};

// ==========================================
// FUNÇÕES VETORIAIS
// ==========================================
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

  let marriageText = '💔 Solteiro(a)';
  try {
    const marriage = await getMarriage(char.discordId);
    if (marriage) {
      const daysTogether = Math.floor((Date.now() - marriage.marriedAt.getTime()) / 86400000);
      marriageText = `💍 Casado(a) [${daysTogether}d]`;
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
  // FUNDO (COSMÉTICO OU DARK FANTASY ORIGINAL)
  // ==========================================
  let hasCosmeticBg = false;

  if (char.activeBackground && COSMETIC_BACKGROUNDS[char.activeBackground]) {
    const bg = COSMETIC_BACKGROUNDS[char.activeBackground];
    if (bg.url.startsWith('color:')) {
      ctx.fillStyle = bg.url.replace('color:', '');
      ctx.fillRect(0, 0, width, height);
      hasCosmeticBg = true;
    } else {
      try {
        const bgImg = await loadImage(bg.url);
        ctx.drawImage(bgImg, 0, 0, width, height);
        hasCosmeticBg = true;
      } catch (e) { console.error('Erro imagem fundo:', e); }
    }
  }

  if (!hasCosmeticBg) {
    // Céu Noturno / Masmorra
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0514'); 
    bgGrad.addColorStop(0.5, '#1a0b26'); 
    bgGrad.addColorStop(1, '#05030a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Lua Mística
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath(); ctx.arc(150, 100, 45, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath(); ctx.arc(150, 100, 70, 0, Math.PI*2); ctx.fill();

    // Silhueta de Montanhas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, height); ctx.lineTo(0, 450); ctx.lineTo(200, 320);
    ctx.lineTo(400, 450); ctx.lineTo(700, 250); ctx.lineTo(950, 400);
    ctx.lineTo(1200, 200); ctx.lineTo(1200, height); ctx.fill();

    // Silhueta de Dragão Voando
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.moveTo(900, 150); ctx.quadraticCurveTo(920, 130, 950, 160);
    ctx.quadraticCurveTo(940, 180, 910, 170); ctx.fill();
    ctx.beginPath(); ctx.moveTo(925, 155); ctx.lineTo(980, 110); ctx.lineTo(950, 165); ctx.fill(); // Asa dir
    ctx.beginPath(); ctx.moveTo(925, 155); ctx.lineTo(870, 120); ctx.lineTo(900, 165); ctx.fill(); // Asa esq
  }

  // Overlay Escuro para não brigar com os textos
  ctx.fillStyle = 'rgba(15, 15, 20, 0.65)';
  ctx.fillRect(0, 0, width, height);

  // Borda
  ctx.strokeStyle = '#2b2d31'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, width - 10, height - 10);
  const panelBg = 'rgba(30, 31, 34, 0.85)'; 
  const panelStroke = '#383a40';

  // ==========================================
  // CABEÇALHO PANORÂMICO
  // ==========================================
  const headerY = 25;
  drawRoundedPanel(ctx, 25, headerY, width - 50, 140, 12, panelBg, panelStroke);

  const avSize = 100;
  const avX = 50;
  const avY = headerY + 20;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save(); ctx.beginPath(); ctx.arc(avX + avSize/2, avY + avSize/2, avSize/2, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(avatar, avX, avY, avSize, avSize); ctx.restore();
    } catch {}
  }
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(avX + avSize/2, avY + avSize/2, avSize/2, 0, Math.PI * 2); ctx.stroke();

  // NOME DO JOGADOR
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 36px ${GLOBAL_FONT}`;
  ctx.fillText(`👑 ${name.toUpperCase()}`, 175, headerY + 45); // Subiu um pouco

  let nextTextY = headerY + 70;

  // TÍTULO COSMÉTICO
  if (char.activeTitle && COSMETIC_TITLES[char.activeTitle]) {
    const title = COSMETIC_TITLES[char.activeTitle];
    ctx.fillStyle = '#d4af37';
    ctx.font = `italic 18px ${GLOBAL_FONT}`;
    ctx.fillText(`« ${title.label} »`, 175, nextTextY);
    nextTextY += 24;
  }

  // LEVEL E CLASSE
  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold 18px ${GLOBAL_FONT}`;
  ctx.fillText(`NÍVEL ${level} — 🗡️ ${className.toUpperCase()}`, 175, nextTextY);

  // LOCALIZAÇÃO E OURO
  ctx.fillStyle = '#b5bac1';
  ctx.font = `14px ${GLOBAL_FONT}`;
  ctx.fillText(`🗺️ Localização: ${locationName}   |   💰 Ouro: ${gold.toLocaleString('pt-BR')} G`, 175, nextTextY + 28);

  function drawLedBar(x: number, y: number, w: number, current: number, max: number, color: string, label: string) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 12, 6); ctx.fill();
    const pct = Math.min(current / (max || 1), 1);
    if (pct > 0) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, w * pct, 12, 6); ctx.fill();
    }
    ctx.fillStyle = '#dbdee1'; ctx.font = `bold 12px ${GLOBAL_FONT}`; ctx.textAlign = 'right';
    ctx.fillText(label, x - 10, y + 10); ctx.textAlign = 'left';
    ctx.fillStyle = '#80848e'; ctx.font = `10px ${GLOBAL_FONT}`;
    ctx.fillText(`${current}/${max}`, x + w + 10, y + 10);
  }

  const barX = 720;
  drawLedBar(barX, headerY + 35, 200, currentHp, maxHp, '#ed4245', '❤️ HP');
  drawLedBar(barX, headerY + 65, 200, currentEnergy, maxEnergy, '#fee75c', '⚡ ENERGIA');
  drawLedBar(barX, headerY + 95, 200, currentXp, maxXp, '#5865f2', '✨ XP');

  ctx.textAlign = 'right';
  ctx.fillStyle = '#b5bac1'; ctx.font = `bold 14px ${GLOBAL_FONT}`;
  ctx.fillText('⚔️ PODER DE COMBATE', width - 50, headerY + 65);
  ctx.fillStyle = '#f1c40f'; ctx.font = `bold 42px ${GLOBAL_FONT}`;
  ctx.fillText(power.toLocaleString('pt-BR'), width - 50, headerY + 110);
  ctx.textAlign = 'left';


  const panelY = 185;
  const panelH = 540;

  // ==========================================
  // PAINEL 1: ATRIBUTOS ANALÍTICOS (BASE + BUFF)
  // ==========================================
  drawRoundedPanel(ctx, 25, panelY, 360, panelH, 12, panelBg, panelStroke);

  ctx.fillStyle = '#f1c40f'; ctx.font = `bold 16px ${GLOBAL_FONT}`; ctx.textAlign = 'center';
  ctx.fillText('📊 ATRIBUTOS DE COMBATE', 205, panelY + 35); ctx.textAlign = 'left';

  function drawStat(x: number, y: number, base: number, total: number, label: string) {
    const buff = total - base;
    ctx.fillStyle = '#b5bac1'; ctx.font = `bold 14px ${GLOBAL_FONT}`;
    ctx.fillText(label, x, y);
    
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 24px ${GLOBAL_FONT}`;
    ctx.fillText(`${total}`, x + 60, y + 2);
    
    if (buff !== 0) {
      ctx.fillStyle = buff > 0 ? '#2ecc71' : '#ed4245';
      ctx.font = `bold 12px ${GLOBAL_FONT}`;
      ctx.fillText(`(${buff > 0 ? '+' : ''}${buff})`, x + 105, y);
    }
  }


  const sy = panelY + 80;
  const sStr = char.str ?? 10; const sAgi = char.agi ?? 10; const sInt = char.int ?? 10;
  const sVit = char.vit ?? 10; const sLck = char.lck ?? 10;


  drawStat(45, sy, sStr, stats?.str ?? 10, '💪 FOR');
  drawStat(210, sy, sAgi, stats?.agi ?? 10, '🏃 AGI');
  drawStat(45, sy + 50, sInt, stats?.int ?? 10, '🧠 INT');
  drawStat(210, sy + 50, sVit, stats?.vit ?? 10, '❤️ VIT');
  drawStat(45, sy + 100, sLck, stats?.lck ?? 10, '🍀 SOR');

  ctx.fillStyle = '#b5bac1'; ctx.font = `bold 14px ${GLOBAL_FONT}`;
  ctx.fillText(`🧬 GEN:`, 210, sy + 100);
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 18px ${GLOBAL_FONT}`;
  ctx.fillText(`${gen}`, 270, sy + 102);

  ctx.strokeStyle = panelStroke; ctx.beginPath(); ctx.moveTo(45, panelY + 230); ctx.lineTo(365, panelY + 230); ctx.stroke();

  function drawSecStat(x: number, y: number, label: string, value: string) {
    drawRoundedPanel(ctx, x, y, 150, 55, 8, 'rgba(0,0,0,0.3)', panelStroke);
    ctx.fillStyle = '#b5bac1'; ctx.font = `bold 11px ${GLOBAL_FONT}`; ctx.textAlign = 'center';
    ctx.fillText(label, x + 75, y + 20);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 16px ${GLOBAL_FONT}`;
    ctx.fillText(value, x + 75, y + 42); ctx.textAlign = 'left';
  }

  drawSecStat(45, panelY + 250, '⚔️ ATAQUE', String(stats?.attack ?? 10));
  drawSecStat(215, panelY + 250, '🛡️ DEFESA', String(stats?.defense ?? 10));
  drawSecStat(45, panelY + 315, '💥 CRÍTICO', `${(stats?.critChance ?? 0).toFixed(1)}%`);
  drawSecStat(215, panelY + 315, '💨 ESQUIVA', `${(stats?.dodgeChance ?? 0).toFixed(1)}%`);

  drawRoundedPanel(ctx, 45, panelY + 390, 320, 120, 8, 'rgba(0,0,0,0.4)', '#d4af37'); 
  ctx.fillStyle = '#f1c40f'; ctx.font = `bold 12px ${GLOBAL_FONT}`;
  ctx.fillText('🌟 HABILIDADE DIVINA:', 60, panelY + 415);
  ctx.fillStyle = '#9b59b6'; ctx.font = `bold 20px ${GLOBAL_FONT}`;
  ctx.fillText(`${divineName.toUpperCase()} [Rank ${divineRank}]`, 60, panelY + 445);
  ctx.fillStyle = '#b5bac1'; ctx.font = `12px ${GLOBAL_FONT}`;
  ctx.fillText(`⚖️ Karma: ${karma}`, 60, panelY + 475);
  ctx.fillText(marriageText, 60, panelY + 495);


  // ==========================================
  // PAINEL 2: EQUIPAMENTO (LAYOUT TARKOV/ANATÔMICO)
  // ==========================================
  drawRoundedPanel(ctx, 400, panelY, 400, panelH, 12, panelBg, panelStroke);

  ctx.fillStyle = '#f1c40f'; ctx.font = `bold 16px ${GLOBAL_FONT}`; ctx.textAlign = 'center';
  ctx.fillText('🛡️ EQUIPAMENTO ATUAL', 600, panelY + 35);

  // Silhueta do Personagem (Fundo)
  const cx = 600; const cy = panelY + 290;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath(); ctx.arc(cx, cy - 140, 30, 0, Math.PI*2); ctx.fill(); // Cabeça
  ctx.beginPath(); ctx.roundRect(cx - 40, cy - 100, 80, 130, 10); ctx.fill(); // Tronco
  ctx.beginPath(); ctx.roundRect(cx - 90, cy - 90, 35, 120, 10); ctx.fill(); // Braço Esq
  ctx.beginPath(); ctx.roundRect(cx + 55, cy - 90, 35, 120, 10); ctx.fill(); // Braço Dir
  ctx.beginPath(); ctx.roundRect(cx - 35, cy + 40, 30, 120, 10); ctx.fill(); // Perna Esq
  ctx.beginPath(); ctx.roundRect(cx + 5, cy + 40, 30, 120, 10); ctx.fill(); // Perna Dir

  function drawEquipSlot(x: number, y: number, itemData: any, ghostLabel: string, ghostEmoji: string) {
    const isEquipped = !!itemData;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 8;
    drawRoundedPanel(ctx, x - 28, y - 28, 56, 56, 6, 'rgba(10,10,10,0.8)', isEquipped ? '#f1c40f' : panelStroke);
    ctx.shadowBlur = 0; 
    
    ctx.textAlign = 'center';
    if (isEquipped) {
      const glow = ctx.createRadialGradient(x, y, 5, x, y, 25);
      glow.addColorStop(0, RARITY_COLORS[itemData.rarity] || '#ffffff');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0;

      ctx.fillStyle = '#ffffff'; ctx.font = `24px ${GLOBAL_FONT}`;
      ctx.fillText(itemData.emoji, x, y + 6);

      ctx.fillStyle = '#dbdee1'; ctx.font = `bold 9px ${GLOBAL_FONT}`;
      const shortName = stripEmojis(itemData.name).split(' ')[0].substring(0, 10);
      ctx.fillText(shortName, x, y + 23);
    } else {
      ctx.fillStyle = '#4e5058'; ctx.font = `24px ${GLOBAL_FONT}`;
      ctx.fillText(ghostEmoji, x, y + 6);
      ctx.fillStyle = '#80848e'; ctx.font = `bold 8px ${GLOBAL_FONT}`;
      ctx.fillText(ghostLabel, x, y + 23);
    }
  }

  // Mapeamento sobre a silhueta
  drawEquipSlot(cx, cy - 140, slotItems.helmet, 'Elmo', '⛑️');
  drawEquipSlot(cx, cy - 70, slotItems.amulet, 'Amuleto', '🔮');
  drawEquipSlot(cx, cy, slotItems.chest, 'Peitoral', '👕');
  drawEquipSlot(cx, cy + 80, slotItems.pants, 'Calças', '👖');
  drawEquipSlot(cx, cy + 160, slotItems.boots, 'Botas', '👟');

  drawEquipSlot(cx - 95, cy - 20, slotItems.weapon, 'Arma', '⚔️');
  drawEquipSlot(cx - 95, cy + 60, slotItems.gloves, 'Luvas', '🧤');

  drawEquipSlot(cx + 95, cy - 90, slotItems.backpack, 'Mochila', '🎒');
  drawEquipSlot(cx + 95, cy - 20, slotItems.shield, 'Escudo', '🛡️');
  drawEquipSlot(cx + 95, cy + 60, slotItems.ring, 'Anel', '💍');

  drawEquipSlot(cx + 100, cy + 160, slotItems.pet, 'Pet', '🐾'); // No chão
  ctx.textAlign = 'left';


  // ==========================================
  // PAINEL 3: TÁTICO & INVENTÁRIO PERFEITO
  // ==========================================
  drawRoundedPanel(ctx, 815, panelY, 360, panelH, 12, panelBg, panelStroke);

  ctx.fillStyle = '#f1c40f'; ctx.font = `bold 16px ${GLOBAL_FONT}`; ctx.textAlign = 'center';
  ctx.fillText('⏳ AÇÕES & COOLDOWNS', 995, panelY + 35); ctx.textAlign = 'left';

  const cdList = [
    { label: 'Dungeon', val: formatCooldown(char.lastDungeon, 5) },
    { label: 'Treino', val: formatCooldown(char.lastTrain, 20) },
    { label: 'Explorar', val: formatCooldown(char.lastExplore, 3) },
    { label: 'Pescar', val: formatCooldown(char.lastFishing, 10) },
    { label: 'Meditar', val: formatCooldown(char.lastRest, 30) },
    { label: 'Viagem', val: formatCooldown(char.lastTravel, loc.travelCooldownMin) },
  ];

  let cdX = 835; let cdY = panelY + 65;
  for (let i = 0; i < cdList.length; i++) {
    const isReady = cdList[i].val === 'PRONTO';
    drawRoundedPanel(ctx, cdX, cdY, 150, 30, 6, 'rgba(0,0,0,0.3)', isReady ? '#2ecc71' : '#ed4245');
    ctx.fillStyle = '#dbdee1'; ctx.font = `bold 11px ${GLOBAL_FONT}`;
    ctx.fillText(cdList[i].label, cdX + 10, cdY + 19);
    ctx.fillStyle = isReady ? '#2ecc71' : '#ed4245'; ctx.textAlign = 'right';
    ctx.fillText(cdList[i].val, cdX + 140, cdY + 19); ctx.textAlign = 'left';

    cdX += 165;
    if ((i + 1) % 2 === 0) { cdX = 835; cdY += 40; }
  }

  ctx.strokeStyle = panelStroke; ctx.beginPath(); ctx.moveTo(835, panelY + 200); ctx.lineTo(1155, panelY + 200); ctx.stroke();

  // INVENTÁRIO (O NOME EXATO E GRID DE 24 SEM BURACOS)
  ctx.fillStyle = '#f1c40f'; ctx.font = `bold 16px ${GLOBAL_FONT}`; ctx.textAlign = 'center';
  ctx.fillText('🎒 INVENTÁRIO', 995, panelY + 235); ctx.textAlign = 'left';

  const invCols = 6;
  const invRows = 4;
  const invBoxSize = 50; 
  const invGap = 6;
  const totalGridWidth = (invCols * invBoxSize) + ((invCols - 1) * invGap);
  const invStartX = 815 + (360 - totalGridWidth) / 2;
  const invStartY = panelY + 260;

  for (let i = 0; i < invCols * invRows; i++) {
    const row = Math.floor(i / invCols);
    const col = i % invCols;
    const x = invStartX + col * (invBoxSize + invGap);
    const y = invStartY + row * (invBoxSize + invGap);

    if (inventory[i]) {
      const itemData = getItem(inventory[i].itemId);
      if (itemData) {
        const rarityColor = RARITY_COLORS[itemData.rarity] || '#ffffff';
        drawRoundedPanel(ctx, x, y, invBoxSize, invBoxSize, 6, 'rgba(10,10,10,0.8)', rarityColor);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff'; ctx.font = `20px ${GLOBAL_FONT}`;
        ctx.fillText(itemData.emoji, x + invBoxSize / 2, y + 28);

        const qtyText = `x${inventory[i].quantity}`;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath(); ctx.roundRect(x + invBoxSize - 22, y + invBoxSize - 14, 20, 12, 3); ctx.fill();
        ctx.fillStyle = '#f1c40f'; ctx.font = `bold 9px ${GLOBAL_FONT}`;
        ctx.fillText(qtyText, x + invBoxSize - 12, y + invBoxSize - 5);
      }
    } else {
      drawRoundedPanel(ctx, x, y, invBoxSize, invBoxSize, 6, 'rgba(0,0,0,0.2)', panelStroke);
    }
  }

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
