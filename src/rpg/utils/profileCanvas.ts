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

// Remove emojis para evitar quadrados pretos no Canvas Linux
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
      marriageText = `Casado(a) [${daysTogether}d]`;
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
  // RENDERIZAÇÃO DE UI RPG PREMIUM
  // ==========================================

  // 1. Fundo com Gradiente Sutil de Profundidade
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0c0a09');
  bgGrad.addColorStop(0.5, '#120f0d');
  bgGrad.addColorStop(1, '#080706');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Moldura Externa de Metal/Bronze
  ctx.strokeStyle = '#3d2f23';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  ctx.strokeStyle = '#d4af37'; // Fio de ouro interno
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  // Função auxiliar para criar painéis de UI (caixas estilo RPG)
  function drawUIPanel(x: number, y: number, w: number, h: number) {
    ctx.fillStyle = '#100d0b';
    ctx.strokeStyle = '#3a2d21';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
  }

  // Desenhar os 3 Painéis Principais (Esquerdo, Central, Direito)
  drawUIPanel(22, 22, 240, 456); // Esquerdo
  drawUIPanel(274, 22, 302, 456); // Central
  drawUIPanel(588, 22, 240, 456); // Direito

  // ------------------------------------------
  // PAINEL ESQUERDO: STATUS & ATRIBUTOS
  // ------------------------------------------
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 18px "InterFont", sans-serif';
  ctx.fillText(name.toUpperCase(), 38, 52);

  ctx.fillStyle = '#e6caa3';
  ctx.font = 'bold 11px "InterFont", sans-serif';
  ctx.fillText(`NV.${level} | ${className.toUpperCase()}`, 38, 70);
  ctx.fillStyle = '#9c8b7c';
  ctx.fillText(`KARMA: ${karma}  •  GEN: ${gen}`, 38, 86);
  ctx.fillText(`LOCAL: ${locationName}`, 38, 102);

  // Barras Estilizadas (XP, HP, ENERGIA)
  function drawRpgBar(y: number, label: string, current: number, max: number, barColor: string) {
    const pct = Math.min(Math.round((current / (max || 1)) * 100), 100);
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 10px "InterFont", sans-serif';
    ctx.fillText(`${label}: ${current} / ${max} (${pct}%)`, 38, y);

    // Fundo da barra
    ctx.fillStyle = '#050403';
    ctx.strokeStyle = '#261c14';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(38, y + 4, 210, 8, 3);
    ctx.fill();
    ctx.stroke();

    // Preenchimento
    const fillWidth = Math.min(((current || 0) / (max || 1)) * 210, 210);
    if (fillWidth > 0) {
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(38, y + 4, fillWidth, 8, 3);
      ctx.fill();
    }
  }

  drawRpgBar(122, 'XP', currentXp, maxXp, '#bdc3c7');
  drawRpgBar(156, 'HP', currentHp, maxHp, '#c0392b');
  drawRpgBar(190, 'ENERGIA', currentEnergy, maxEnergy, '#d35400');

  // Separador interno
  ctx.strokeStyle = '#261c14';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(38, 215);
  ctx.lineTo(248, 215);
  ctx.stroke();

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 11px "InterFont", sans-serif';
  ctx.fillText('ATRIBUTOS DE COMBATE', 38, 238);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${str}    AGI: ${agi}    INT: ${intVal}`, 38, 262);
  ctx.fillText(`VIT: ${vit}    SOR: ${lck}`, 38, 282);

  ctx.fillStyle = '#c8b6a6';
  ctx.font = '11px "InterFont", sans-serif';
  ctx.fillText(`Ataque: ${atk}   Defesa: ${def}`, 38, 312);
  ctx.fillText(`Critico: ${crit.toFixed(1)}%   Esquiva: ${dodge.toFixed(1)}%`, 38, 332);

  // ------------------------------------------
  // PAINEL CENTRAL: AVATAR & EQUIPAMENTOS
  // ------------------------------------------
  const centerX = 425;
  const centerY = 240;
  const avatarRadius = 45;

  const slotsCoords = [
    { key: 'helmet', label: 'Elmo', x: centerX - 135, y: centerY - 130 },
    { key: 'chest', label: 'Peito', x: centerX - 135, y: centerY - 72 },
    { key: 'gloves', label: 'Luva', x: centerX - 135, y: centerY - 14 },
    { key: 'pants', label: 'Calça', x: centerX - 135, y: centerY + 44 },
    { key: 'boots', label: 'Bota', x: centerX - 135, y: centerY + 102 },

    { key: 'weapon', label: 'Arma', x: centerX + 45, y: centerY - 130 },
    { key: 'shield', label: 'Escudo', x: centerX + 45, y: centerY - 72 },
    { key: 'ring', label: 'Anel', x: centerX + 45, y: centerY - 14 },
    { key: 'backpack', label: 'Mochila', x: centerX + 45, y: centerY + 44 },
    { key: 'pet', label: 'Pet', x: centerX + 45, y: centerY + 102 }
  ];

  // Linhas de conexão refinadas (parando perfeitamente na borda do avatar)
  ctx.strokeStyle = '#3a2d21';
  ctx.lineWidth = 1.5;
  for (const s of slotsCoords) {
    const slotCenterX = s.x + 45;
    const slotCenterY = s.y + 24;

    const angle = Math.atan2(slotCenterY - centerY, slotCenterX - centerX);
    const startX = centerX + Math.cos(angle) * (avatarRadius + 3);
    const startY = centerY + Math.sin(angle) * (avatarRadius + 3);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(slotCenterX, slotCenterY);
    ctx.stroke();
  }

  // Avatar com Anel Mágico / Dourado Duplo
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

      // Borda Externa Dourada
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2);
      ctx.stroke();
    } catch (err) {
      console.error('Erro avatar Canvas:', err);
    }
  }

  // Renderizar Slots de Equipamentos (Estilo RPG HUD)
  for (const slot of slotsCoords) {
    const itemName = slotItems[slot.key as keyof typeof slotItems] || '—';

    ctx.fillStyle = '#080605';
    ctx.strokeStyle = '#3a2d21';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 90, 48, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 9px "InterFont", sans-serif';
    ctx.fillText(`[ ${slot.label.toUpperCase()} ]`, slot.x + 6, slot.y + 13);

    ctx.fillStyle = itemName !== '—' ? '#ffffff' : '#524334';
    ctx.font = 'bold 11px "InterFont", sans-serif';

    if (itemName.length > 13) {
      const parts = itemName.split(' ');
      if (parts.length > 1) {
        ctx.fillText(parts[0], slot.x + 6, slot.y + 27);
        ctx.fillText(parts.slice(1).join(' ').substring(0, 12), slot.x + 6, slot.y + 39);
      } else {
        ctx.fillText(itemName.substring(0, 13) + '..', slot.x + 6, slot.y + 32);
      }
    } else {
      ctx.fillText(itemName, slot.x + 6, slot.y + 31);
    }
  }

  // ------------------------------------------
  // PAINEL DIREITO: ECONOMIA, DIVINDADE & CD
  // ------------------------------------------
  const rightX = 604;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`PODER: #${power.toLocaleString('pt-BR')}`, rightX, 52);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText(`OURO: ${gold.toLocaleString('pt-BR')} G`, rightX, 72);

  ctx.fillStyle = '#bfa58a';
  ctx.font = '11px "InterFont", sans-serif';
  ctx.fillText(marriageText, rightX, 90);

  ctx.strokeStyle = '#261c14';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rightX, 102);
  ctx.lineTo(rightX + 208, 102);
  ctx.stroke();

  // Habilidade Divina
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 11px "InterFont", sans-serif';
  ctx.fillText('HABILIDADE DIVINA', rightX, 122);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText(`${divineName} [Rank ${divineRank}]`, rightX, 140);

  // Histórico
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 11px "InterFont", sans-serif';
  ctx.fillText('HISTÓRICO DE BATALHA', rightX, 172);

  ctx.fillStyle = '#ffffff';
  ctx.font = '11px "InterFont", sans-serif';
  ctx.fillText(`Vitórias: ${wins}   Mortes: ${deaths}`, rightX, 192);
  ctx.fillText(`PvP: ${pvpWins}W / ${pvpLosses}L   Boss: ${bosses}`, rightX, 210);

  // Cooldowns
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 11px "InterFont", sans-serif';
  ctx.fillText('COOLDOWNS DE ATIVIDADES', rightX, 242);

  const cdList = [
    { label: 'Dungeon', val: formatCooldown(char.lastDungeon, 5) },
    { label: 'Caçada', val: 'PRONTO' },
    { label: 'Viagem', val: formatCooldown(char.lastTravel, loc.travelCooldownMin) },
    { label: 'Explorar', val: formatCooldown(char.lastExplore, 3) },
    { label: 'Treino', val: formatCooldown(char.lastTrain, 20) },
    { label: 'Pesca', val: formatCooldown(char.lastFishing, 10) },
    { label: 'Meditar', val: formatCooldown(char.lastRest, 30) },
    { label: 'PvP', val: formatCooldown(char.lastPvp, 10) }
  ];

  ctx.font = '10px "InterFont", sans-serif';
  let cdY = 262;
  for (const cd of cdList) {
    ctx.fillStyle = '#9c8b7c';
    ctx.fillText(`${cd.label}:`, rightX, cdY);

    ctx.fillStyle = cd.val === 'PRONTO' ? '#2ecc71' : '#e74c3c';
    ctx.fillText(cd.val, rightX + 68, cdY);

    cdY += 17;
  }

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
