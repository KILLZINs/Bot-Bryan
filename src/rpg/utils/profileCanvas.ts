import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { getClass, karmaLabel, rpgXpForLevel } from '../constants/classes';
import { getItem } from '../constants/items';
import { getLocation } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';
import { getMarriage, getPartner } from '../services/marriage';

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

  // RENDERIZAÇÃO
  ctx.fillStyle = '#0f0c0a';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#17120e';
  ctx.strokeStyle = '#634b35';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(10, 10, width - 20, height - 20, 12);
  ctx.fill();
  ctx.stroke();

  // PAINEL ESQUERDO
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "InterFont", sans-serif';
  ctx.fillText(`${name.toUpperCase()}`, 25, 45);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`Nv.${level} ${className} • Karma: ${karma} • GEN.${gen}`, 25, 68);

  ctx.fillStyle = '#dcdcdc';
  ctx.font = '14px "InterFont", sans-serif';
  ctx.fillText(`Local: ${locationName}`, 25, 88);

  function drawBar(y: number, label: string, current: number, max: number, color: string) {
    const pct = Math.min(Math.round((current / (max || 1)) * 100), 100);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "InterFont", sans-serif';
    ctx.fillText(`${label}: ${current}/${max} (${pct}%)`, 25, y);

    ctx.fillStyle = '#050403';
    ctx.beginPath();
    ctx.roundRect(25, y + 5, 210, 10, 3);
    ctx.fill();

    const fillWidth = Math.min(((current || 0) / (max || 1)) * 210, 210);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(25, y + 5, fillWidth, 10, 3);
    ctx.fill();
  }

  drawBar(118, 'XP', currentXp, maxXp, '#bdc3c7');
  drawBar(150, 'HP', currentHp, maxHp, '#e74c3c');
  drawBar(182, 'ENERGIA', currentEnergy, maxEnergy, '#f39c12');

  ctx.strokeStyle = '#423223';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(25, 212);
  ctx.lineTo(235, 212);
  ctx.stroke();

  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 15px "InterFont", sans-serif';
  ctx.fillText('ATRIBUTOS DE COMBATE', 25, 235);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${str}  AGI: ${agi}  INT: ${intVal}`, 25, 260);
  ctx.fillText(`VIT: ${vit}  SOR: ${lck}`, 25, 280);

  ctx.fillStyle = '#f0e3ce';
  ctx.fillText(`Ataque: ${atk}  Defesa: ${def}`, 25, 310);
  ctx.fillText(`Crit: ${crit.toFixed(1)}%  Esq: ${dodge.toFixed(1)}%`, 25, 332);

  // PAINEL CENTRAL (Slots Expansíveis com Largura Aumentada)
  const centerX = 425;
  const centerY = 240;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 46, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, centerX - 46, centerY - 46, 92, 92);
      ctx.restore();

      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 46, 0, Math.PI * 2);
      ctx.stroke();
    } catch (err) {
      console.error('Erro avatar Canvas:', err);
    }
  }

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

  ctx.strokeStyle = '#423223';
  ctx.lineWidth = 1.5;
  for (const s of slotsCoords) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(s.x + 42, s.y + 24);
    ctx.stroke();
  }

  for (const slot of slotsCoords) {
    const itemName = slotItems[slot.key as keyof typeof slotItems] || '—';

    ctx.fillStyle = '#0d0a08';
    ctx.strokeStyle = '#523f2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 90, 48, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 10px "InterFont", sans-serif';
    ctx.fillText(slot.label.toUpperCase(), slot.x + 6, slot.y + 14);

    ctx.fillStyle = itemName !== '—' ? '#ffffff' : '#523f2b';
    ctx.font = 'bold 11px "InterFont", sans-serif';

    // Suporte para duas linhas no nome do item se for longo
    if (itemName.length > 13) {
      const parts = itemName.split(' ');
      if (parts.length > 1) {
        ctx.fillText(parts[0], slot.x + 6, slot.y + 28);
        ctx.fillText(parts.slice(1).join(' ').substring(0, 12), slot.x + 6, slot.y + 40);
      } else {
        ctx.fillText(itemName.substring(0, 13) + '..', slot.x + 6, slot.y + 32);
      }
    } else {
      ctx.fillText(itemName, slot.x + 6, slot.y + 32);
    }
  }

  // PAINEL DIREITO
  const rightX = 620;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.fillText(`Poder: #${power.toLocaleString('pt-BR')}`, rightX, 45);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 15px "InterFont", sans-serif';
  ctx.fillText(`Ouro: ${gold.toLocaleString('pt-BR')} G`, rightX, 68);

  ctx.fillStyle = '#e6caa3';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(marriageText, rightX, 88);

  ctx.strokeStyle = '#423223';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rightX, 98);
  ctx.lineTo(width - 25, 98);
  ctx.stroke();

  // Habilidade
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('HABILIDADE DIVINA', rightX, 118);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText(`${divineName} [Rank ${divineRank}]`, rightX, 138);

  // Histórico
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('HISTORICO', rightX, 172);

  ctx.fillStyle = '#ffffff';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`Vitorias: ${wins}   Mortes: ${deaths}`, rightX, 192);
  ctx.fillText(`PvP: ${pvpWins}W/${pvpLosses}L   Bosses: ${bosses}`, rightX, 210);

  // Cooldowns
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('COOLDOWNS RPG', rightX, 245);

  ctx.fillStyle = '#ffffff';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`Dungeon: ${formatCooldown(char.lastDungeon, 5)}`, rightX, 268);
  ctx.fillText(`Cacada: Sem cd`, rightX, 288);
  ctx.fillText(`Viagem: ${formatCooldown(char.lastTravel, loc.travelCooldownMin)}`, rightX, 308);
  ctx.fillText(`Explorar: ${formatCooldown(char.lastExplore, 3)}`, rightX, 328);
  ctx.fillText(`Treino: ${formatCooldown(char.lastTrain, 20)}`, rightX, 348);
  ctx.fillText(`Pesca: ${formatCooldown(char.lastFishing, 10)}`, rightX, 368);
  ctx.fillText(`Meditar: ${formatCooldown(char.lastRest, 30)}`, rightX, 388);
  ctx.fillText(`PvP: ${formatCooldown(char.lastPvp, 10)}`, rightX, 408);

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
