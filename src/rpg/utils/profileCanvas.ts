import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { getClass, karmaLabel, rpgXpForLevel } from '../constants/classes';
import { getItem } from '../constants/items';
import { getLocation, ENV_EMOJI } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';
import { getMarriage, getPartner } from '../services/marriage';

try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte Inter-Bold:', e);
}

function formatCooldown(date: Date | null | undefined, minutes: number): string {
  if (!date) return '🟢 Pronto';
  const remaining = minutes * 60_000 - (Date.now() - date.getTime());
  if (remaining <= 0) return '🟢 Pronto';
  const totalSeconds = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `🔴 ${mins > 0 ? `${mins}m ` : ''}${secs}s`;
}

export async function generateProfileCard(char: any, stats: any, avatarUrlInput?: string): Promise<Buffer> {
  // Aumentamos a tela para 1000x650 para dar mais espaço e legibilidade aos textos
  const width = 1000;
  const height = 650;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const cls = getClass(char.class);
  const loc = getLocation(char.currentLocation);
  const envLabel = ENV_EMOJI[char.environment] ?? char.environment;
  const eq = char.equipment;

  // --- DADOS DO PERSONAGEM ---
  const name = char.username || 'Aventureiro';
  const className = cls?.name ?? char.class;
  const level = char.level ?? 1;
  const karma = karmaLabel(char.karma);
  const gen = char.generation ?? 1;
  const locationName = `${loc.emoji} ${loc.name}`;

  const currentXp = char.xp ?? 0;
  const maxXp = rpgXpForLevel(level);
  const currentHp = char.currentHp ?? 100;
  const maxHp = stats?.maxHp ?? 100;
  const currentEnergy = char.currentEnergy ?? 100;
  const maxEnergy = stats?.maxEnergy ?? 100;

  // Atributos de Combate
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

  // Casamento
  let marriageText = '💔 Solteiro(a)';
  try {
    const marriage = await getMarriage(char.discordId);
    if (marriage) {
      const partnerId = getPartner(marriage, char.discordId);
      const daysTogether = Math.floor((Date.now() - marriage.marriedAt.getTime()) / 86400000);
      marriageText = `💍 C/ <@${partnerId}> (${daysTogether}d)`;
    }
  } catch { /* Ignora se falhar */ }

  // Histórico
  const wins = char.totalWins ?? 0;
  const deaths = char.totalDeaths ?? 0;
  const pvpWins = char.pvpWins ?? 0;
  const pvpLosses = char.pvpLosses ?? 0;
  const bosses = char.bossKills ?? 0;

  // Habilidade Divina
  let divineName = 'Nenhuma';
  let divineRank = 'F';
  let divineDesc = 'Sem habilidade equipada.';
  if (char.divineSkillId && DIVINE_SKILLS[char.divineSkillId]) {
    const ds = DIVINE_SKILLS[char.divineSkillId];
    divineName = ds.name;
    divineRank = String(char.divineSkillRank ?? 'F');
    divineDesc = ds.description;
  }

  // Resolução de Equipamentos
  const resolveItem = (itemId?: string | null) => {
    if (!itemId) return '—';
    const item = getItem(itemId);
    return item ? `${item.emoji} ${item.name}` : itemId;
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

  // --- RENDERIZAÇÃO NO CANVAS ---
  ctx.fillStyle = '#120f0d';
  ctx.fillRect(0, 0, width, height);

  // Moldura principal
  ctx.fillStyle = '#1a1411';
  ctx.strokeStyle = '#523f2b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(15, 15, width - 30, height - 30, 12);
  ctx.fill();
  ctx.stroke();

  // 1. PAINEL ESQUERDO: INFOS E BARRAS DE STATUS
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "InterFont", sans-serif';
  ctx.fillText(`${name.toUpperCase()}`, 35, 52);

  ctx.fillStyle = '#d4af37';
  ctx.font = '14px "InterFont", sans-serif';
  ctx.fillText(`Nv.${level} ${className} • Karma: ${karma} • GEN. ${gen}`, 35, 75);
  ctx.fillText(`📍 ${locationName} (${envLabel})`, 35, 96);

  function drawBar(y: number, label: string, current: number, max: number, color: string) {
    const pct = Math.min(Math.round((current / (max || 1)) * 100), 100);
    ctx.fillStyle = '#f0e3ce';
    ctx.font = 'bold 13px "InterFont", sans-serif';
    ctx.fillText(`${label}: ${current}/${max} (${pct}%)`, 35, y);

    ctx.fillStyle = '#080605';
    ctx.beginPath();
    ctx.roundRect(35, y + 6, 240, 12, 4);
    ctx.fill();

    const fillWidth = Math.min(((current || 0) / (max || 1)) * 240, 240);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(35, y + 6, fillWidth, 12, 4);
    ctx.fill();
  }

  drawBar(128, 'XP', currentXp, maxXp, '#a3a3a3');
  drawBar(165, 'HP', currentHp, maxHp, '#e74c3c');
  drawBar(202, 'ENERGIA', currentEnergy, maxEnergy, '#f39c12');

  // Divisória
  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(35, 235);
  ctx.lineTo(275, 235);
  ctx.stroke();

  // Atributos de Combate Reais (Com texto maior)
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 15px "InterFont", sans-serif';
  ctx.fillText('📊 ATRIBUTOS DE COMBATE', 35, 260);

  ctx.fillStyle = '#f0e3ce';
  ctx.font = '14px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${str}   AGI: ${agi}   INT: ${intVal}`, 35, 288);
  ctx.fillText(`VIT: ${vit}   SOR: ${lck}`, 35, 312);

  ctx.fillStyle = '#e6caa3';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`⚔️ Ataque: ${atk}    🛡️ Defesa: ${def}`, 35, 345);
  ctx.fillText(`💥 Crítico: ${crit.toFixed(1)}%    💨 Esquiva: ${dodge.toFixed(1)}%`, 35, 372);

  // 2. PAINEL CENTRAL: PAPERDOLL COMPLETO (SLOTS EXPANDIDOS)
  const centerX = 500;
  const centerY = 290;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY - 20, 52, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, centerX - 52, centerY - 72, 104, 104);
      ctx.restore();

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 20, 52, 0, Math.PI * 2);
      ctx.stroke();
    } catch (err) {
      console.error('Erro ao carregar avatar no Canvas:', err);
    }
  }

  // Slots de Equipamento com caixas de 75x50 (maiores e mais legíveis)
  const slotsCoords = [
    { key: 'helmet', label: 'Elmo', x: centerX - 165, y: centerY - 145 },
    { key: 'chest', label: 'Peito', x: centerX - 165, y: centerY - 80 },
    { key: 'gloves', label: 'Luva', x: centerX - 165, y: centerY - 15 },
    { key: 'pants', label: 'Calça', x: centerX - 165, y: centerY + 50 },
    { key: 'boots', label: 'Bota', x: centerX - 165, y: centerY + 115 },

    { key: 'weapon', label: 'Arma', x: centerX + 90, y: centerY - 145 },
    { key: 'shield', label: 'Escudo', x: centerX + 90, y: centerY - 80 },
    { key: 'ring', label: 'Anel', x: centerX + 90, y: centerY - 15 },
    { key: 'backpack', label: 'Mochila', x: centerX + 90, y: centerY + 50 },
    { key: 'pet', label: 'Pet', x: centerX + 90, y: centerY + 115 }
  ];

  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1.5;
  for (const s of slotsCoords) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 20);
    ctx.lineTo(s.x + 37, s.y + 25);
    ctx.stroke();
  }

  for (const slot of slotsCoords) {
    const itemName = slotItems[slot.key as keyof typeof slotItems] || '—';

    ctx.fillStyle = '#0a0806';
    ctx.strokeStyle = '#523f2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 75, 50, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#a88967';
    ctx.font = 'bold 10px "InterFont", sans-serif';
    ctx.fillText(slot.label.toUpperCase(), slot.x + 6, slot.y + 14);

    ctx.fillStyle = itemName !== '—' ? '#ffffff' : '#4a3b2c';
    ctx.font = '11px "InterFont", sans-serif';
    const truncatedName = itemName.length > 11 ? itemName.substring(0, 10) + '..' : itemName;
    ctx.fillText(truncatedName, slot.x + 6, slot.y + 34);
  }

  // 3. PAINEL DIREITO: PODER, HABILIDADE, HISTÓRICO E COOLDOWNS
  const rightX = 730;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "InterFont", sans-serif';
  ctx.fillText(`⚔️ Poder: #${power.toLocaleString('pt-BR')}`, rightX, 52);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 15px "InterFont", sans-serif';
  ctx.fillText(`🪙 Ouro: ${gold.toLocaleString('pt-BR')} G`, rightX, 75);

  ctx.fillStyle = '#d4af37';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(marriageText.substring(0, 30), rightX, 96);

  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rightX, 106);
  ctx.lineTo(width - 35, 106);
  ctx.stroke();

  // Habilidade Divina
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('✨ HABILIDADE DIVINA', rightX, 130);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText(`💀 ${divineName} [Rank ${divineRank}]`, rightX, 150);

  ctx.fillStyle = '#a88967';
  ctx.font = '11px "InterFont", sans-serif';
  ctx.fillText(divineDesc.substring(0, 32), rightX, 168);

  // Histórico
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('📈 HISTÓRICO DE BATALHAS', rightX, 205);

  ctx.fillStyle = '#f0e3ce';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`🏆 Vitórias: ${wins}   💀 Mortes: ${deaths}`, rightX, 228);
  ctx.fillText(`⚔️ PvP: ${pvpWins}W/${pvpLosses}L   👹 Bosses: ${bosses}`, rightX, 248);

  // Cooldowns Reais com Fonte Ampliada
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText('🎲 COOLDOWNS RPG', rightX, 285);

  ctx.fillStyle = '#f0e3ce';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`Dungeon: ${formatCooldown(char.lastDungeon, 5)}`, rightX, 308);
  ctx.fillText(`Caçada: 🟢 Sem cd`, rightX, 328);
  ctx.fillText(`Viagem: ${formatCooldown(char.lastTravel, loc.travelCooldownMin)}`, rightX, 348);
  ctx.fillText(`Explorar: ${formatCooldown(char.lastExplore, 3)}`, rightX, 368);
  ctx.fillText(`Treino: ${formatCooldown(char.lastTrain, 20)}`, rightX, 388);
  ctx.fillText(`Pesca: ${formatCooldown(char.lastFishing, 10)}`, rightX, 408);
  ctx.fillText(`Meditar: ${formatCooldown(char.lastRest, 30)}`, rightX, 428);
  ctx.fillText(`PvP: ${formatCooldown(char.lastPvp, 10)}`, rightX, 448);

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
