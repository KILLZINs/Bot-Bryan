import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { getClass, karmaLabel, rpgXpForLevel } from '../constants/classes';
import { getItem } from '../constants/items';
import { getLocation } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';
import { getMarriage } from '../services/marriage';

try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte Inter-Bold:', e);
}

// Remove emojis de strings para evitar glifos/quadrados pretos no Canvas Linux
function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

function formatCooldown(date: Date | null | undefined, minutes: number): string {
  if (!date) return 'Pronto';
  const remaining = minutes * 60_000 - (Date.now() - date.getTime());
  if (remaining <= 0) return 'Pronto';
  const totalSeconds = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
}

export async function generateProfileCard(char: any, stats: any, avatarUrlInput?: string): Promise<Buffer> {
  const width = 850;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const cls = getClass(char.class);
  const loc = getLocation(char.currentLocation);
  const eq = char.equipment;

  // DADOS LIMPOS
  const name = stripEmojis(char.username || 'Aventureiro');
  const className = stripEmojis(cls?.name ?? char.class);
  const level = char.level ?? 1;
  const karma = stripEmojis(karmaLabel(char.karma));
  const gen = char.generation ?? 1;
  const locationName = stripEmojis(loc.name);

  const currentXp = char.xp ?? 0;
  const maxXp = rpgXpForLevel(level);
  const currentHp = char.currentHp ?? 100;
  const maxHp = stats?.maxHp ?? 100;
  const currentEnergy = char.currentEnergy ?? 100;
  const maxEnergy = stats?.maxEnergy ?? 100;

  const str = stats?.str ?? 10;
  const agi = stats?.agi ?? 10;
  const intVal = stats?.int ?? 10;
  const vit = stats?.vit ?? 10;
  const lck = stats?.lck ?? 10;

  const atk = stats?.attack ?? 10;
  const def = stats?.defense ?? 10;
  const crit = stats?.critChance ?? 0;
  const dodge = stats?.dodgeChance ?? 0;
  const power = stats?.combatPower ?? 0;
  const gold = char.gold ?? 0;

  let marriageText = 'Solteiro(a)';
  try {
    const marriage = await getMarriage(char.discordId);
    if (marriage) {
      const daysTogether = Math.floor((Date.now() - marriage.marriedAt.getTime()) / 86400000);
      marriageText = `Casado(a) (${daysTogether}d)`;
    }
  } catch { /* Ignora erro */ }

  const wins = char.totalWins ?? 0;
  const deaths = char.totalDeaths ?? 0;
  const pvpWins = char.pvpWins ?? 0;
  const pvpLosses = char.pvpLosses ?? 0;
  const bosses = char.bossKills ?? 0;

  let divineName = 'Nenhuma';
  let divineRank = 'F';
  if (char.divineSkillId && DIVINE_SKILLS[char.divineSkillId]) {
    const ds = DIVINE_SKILLS[char.divineSkillId];
    divineName = stripEmojis(ds.name);
    divineRank = String(char.divineSkillRank ?? 'F');
  }

  const resolveItem = (itemId?: string | null) => {
    if (!itemId) return '—';
    const item = getItem(itemId);
    return item ? stripEmojis(item.name) : stripEmojis(itemId);
  };

  const slotItems = {
    helmet: resolveItem(eq?.helmet),
    chest: resolveItem(eq?.chest || eq?.armor),
    weapon: resolveItem(eq?.weapon),
    shield: resolveItem(eq?.shield),
    pants: resolveItem(eq?.pants),
    boots: resolveItem(eq?.boots),
    gloves: resolveItem(eq?.gloves),
    ring: resolveItem(eq?.ring),
    backpack: resolveItem(eq?.backpack),
    pet: resolveItem(eq?.pet),
  };

  const avatarUrl = avatarUrlInput || char.avatarUrl || '';

  // ==========================================
  // RENDERIZAÇÃO & DESIGN PREMIUM
  // ==========================================

  // Fundo Principal com leve gradiente de profundidade
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0807');
  bgGrad.addColorStop(1, '#140f0c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Painel de Fundo Geral com Borda Estilizada
  ctx.fillStyle = '#14100c';
  ctx.strokeStyle = '#523f2b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(12, 12, width - 24, height - 24, 14);
  ctx.fill();
  ctx.stroke();

  // ------------------------------------------
  // PAINEL ESQUERDO (Status & Atributos)
  // ------------------------------------------
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "InterFont", sans-serif';
  ctx.fillText(`${name.toUpperCase()}`, 28, 48);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText(`Nv.${level} ${className}  •  Karma: ${karma}  •  GEN.${gen}`, 28, 70);

  ctx.fillStyle = '#c8b6a6';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`Local: ${locationName}`, 28, 90);

  function drawBar(y: number, label: string, current: number, max: number, color: string) {
    const pct = Math.min(Math.round((current / (max || 1)) * 100), 100);
    ctx.fillStyle = '#e6caa3';
    ctx.font = 'bold 12px "InterFont", sans-serif';
    ctx.fillText(`${label}: ${current} / ${max} (${pct}%)`, 28, y);

    // Fundo da barra
    ctx.fillStyle = '#080605';
    ctx.beginPath();
    ctx.roundRect(28, y + 5, 210, 9, 4);
    ctx.fill();

    // Preenchimento da barra
    const fillWidth = Math.min(((current || 0) / (max || 1)) * 210, 210);
    if (fillWidth > 0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(28, y + 5, fillWidth, 9, 4);
      ctx.fill();
    }
  }

  drawBar(116, 'XP', currentXp, maxXp, '#95a5a6');
  drawBar(148, 'HP', currentHp, maxHp, '#e74c3c');
  drawBar(180, 'ENERGIA', currentEnergy, maxEnergy, '#f39c12');

  // Linha divisória esquerda
  ctx.strokeStyle = '#382a1d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(28, 208);
  ctx.lineTo(238, 208);
  ctx.stroke();

  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('ATRIBUTOS DE COMBATE', 28, 230);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${str}    AGI: ${agi}    INT: ${intVal}`, 28, 254);
  ctx.fillText(`VIT: ${vit}    SOR: ${lck}`, 28, 274);

  ctx.fillStyle = '#dfd3c3';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`Ataque: ${atk}   Defesa: ${def}`, 28, 304);
  ctx.fillText(`Crit: ${crit.toFixed(1)}%   Esq: ${dodge.toFixed(1)}%`, 28, 324);

  // ------------------------------------------
  // PAINEL CENTRAL (Avatar & Conexões dos Slots)
  // ------------------------------------------
  const centerX = 425;
  const centerY = 240;
  const avatarRadius = 46;

  const slotsCoords = [
    { key: 'helmet', label: 'Elmo', x: centerX - 160, y: centerY - 135 },
    { key: 'chest', label: 'Peito', x: centerX - 160, y: centerY - 75 },
    { key: 'gloves', label: 'Luva', x: centerX - 160, y: centerY - 15 },
    { key: 'pants', label: 'Calça', x: centerX - 160, y: centerY + 45 },
    { key: 'boots', label: 'Bota', x: centerX - 160, y: centerY + 105 },

    { key: 'weapon', label: 'Arma', x: centerX + 75, y: centerY - 135 },
    { key: 'shield', label: 'Escudo', x: centerX + 75, y: centerY - 75 },
    { key: 'ring', label: 'Anel', x: centerX + 75, y: centerY - 15 },
    { key: 'backpack', label: 'Mochila', x: centerX + 75, y: centerY + 45 },
    { key: 'pet', label: 'Pet', x: centerX + 75, y: centerY + 105 }
  ];

  // Desenhar as linhas de conexão saindo da BORDAS DO AVATAR (evita cortar o rosto!)
  ctx.strokeStyle = '#423223';
  ctx.lineWidth = 1.5;
  for (const s of slotsCoords) {
    const slotCenterX = s.x + 45;
    const slotCenterY = s.y + 24;

    // Calcular angulo para a linha parar perfeitamente na borda do circulo do avatar
    const angle = Math.atan2(slotCenterY - centerY, slotCenterX - centerX);
    const startX = centerX + Math.cos(angle) * (avatarRadius + 4);
    const startY = centerY + Math.sin(angle) * (avatarRadius + 4);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(slotCenterX, slotCenterY);
    ctx.stroke();
  }

  // Desenhar Avatar do Jogador com Borda Elegante
  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, centerX - avatarRadius, centerY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.restore();

      // Anel dourado ao redor do avatar
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2);
      ctx.stroke();
    } catch (err) {
      console.error('Erro avatar Canvas:', err);
    }
  }

  // Renderizar Caixas de Itens (Slots)
  for (const slot of slotsCoords) {
    const itemName = slotItems[slot.key as keyof typeof slotItems] || '—';

    ctx.fillStyle = '#0a0806';
    ctx.strokeStyle = '#4a3826';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 90, 48, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 10px "InterFont", sans-serif';
    ctx.fillText(slot.label.toUpperCase(), slot.x + 8, slot.y + 14);

    ctx.fillStyle = itemName !== '—' ? '#ffffff' : '#4a3826';
    ctx.font = 'bold 11px "InterFont", sans-serif';

    if (itemName.length > 13) {
      const parts = itemName.split(' ');
      if (parts.length > 1) {
        ctx.fillText(parts[0], slot.x + 8, slot.y + 28);
        ctx.fillText(parts.slice(1).join(' ').substring(0, 12), slot.x + 8, slot.y + 40);
      } else {
        ctx.fillText(itemName.substring(0, 13) + '..', slot.x + 8, slot.y + 32);
      }
    } else {
      ctx.fillText(itemName, slot.x + 8, slot.y + 32);
    }
  }

  // ------------------------------------------
  // PAINEL DIREITO (Economia, Divindade & Stats)
  // ------------------------------------------
  const rightX = 615;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "InterFont", sans-serif';
  ctx.fillText(`Poder: #${power.toLocaleString('pt-BR')}`, rightX, 48);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`Ouro: ${gold.toLocaleString('pt-BR')} G`, rightX, 70);

  ctx.fillStyle = '#dcdcdc';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(marriageText, rightX, 90);

  ctx.strokeStyle = '#382a1d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rightX, 102);
  ctx.lineTo(width - 28, 102);
  ctx.stroke();

  // Habilidade Divina
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('HABILIDADE DIVINA', rightX, 124);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText(`${divineName} [Rank ${divineRank}]`, rightX, 142);

  // Histórico de Batalhas
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('HISTÓRICO', rightX, 175);

  ctx.fillStyle = '#ffffff';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`Vitórias: ${wins}    Mortes: ${deaths}`, rightX, 194);
  ctx.fillText(`PvP: ${pvpWins}W / ${pvpLosses}L    Bosses: ${bosses}`, rightX, 212);

  // Cooldowns
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('COOLDOWNS RPG', rightX, 245);

  const cdList = [
    { label: 'Dungeon', val: formatCooldown(char.lastDungeon, 5) },
    { label: 'Caçada', val: 'Pronto' },
    { label: 'Viagem', val: formatCooldown(char.lastTravel, loc.travelCooldownMin) },
    { label: 'Explorar', val: formatCooldown(char.lastExplore, 3) },
    { label: 'Treino', val: formatCooldown(char.lastTrain, 20) },
    { label: 'Pesca', val: formatCooldown(char.lastFishing, 10) },
    { label: 'Meditar', val: formatCooldown(char.lastRest, 30) },
    { label: 'PvP', val: formatCooldown(char.lastPvp, 10) }
  ];

  ctx.font = '11px "InterFont", sans-serif';
  let cdY = 265;
  for (const cd of cdList) {
    ctx.fillStyle = '#c8b6a6';
    ctx.fillText(`${cd.label}:`, rightX, cdY);

    ctx.fillStyle = cd.val === 'Pronto' ? '#2ecc71' : '#e74c3c';
    ctx.fillText(cd.val, rightX + 65, cdY);

    cdY += 18;
  }

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
