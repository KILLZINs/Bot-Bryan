import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { FullCharacter, ComputedStats, hpBar } from '../services/character';
import { getClass, karmaLabel, rpgXpForLevel } from '../constants/classes';
import { getItem } from '../constants/items';
import { getLocation, ENV_EMOJI } from '../constants/locations';
import { DIVINE_SKILLS } from '../constants/skills';

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

export async function generateProfileCard(char: FullCharacter, stats: ComputedStats, avatarUrl?: string): Promise<Buffer> {
  const width = 940;
  const height = 620;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const cls = getClass(char.class);
  const loc = getLocation(char.currentLocation);
  const eq = char.equipment;

  // --- EXTRAÇÃO E MAPEAMENTO FIEL DOS DADOS ---
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

  // Atributos Calculados
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

  // Mapeamento dos Equipamentos utilizando o auxílio do getItem do seu sistema
  const resolveItem = (itemId?: string | null) => {
    if (!itemId) return '—';
    const item = getItem(itemId);
    return item ? `${item.emoji} ${item.name}` : itemId;
  };

  const slotItems = {
    helmet: resolveItem(eq?.helmet),
    weapon: resolveItem(eq?.weapon),
    shield: resolveItem(eq?.shield),
    pants: resolveItem(eq?.pants),
    boots: resolveItem(eq?.boots),
    gloves: resolveItem(eq?.gloves),
    ring: resolveItem(eq?.ring),
    backpack: resolveItem(eq?.backpack),
    pet: resolveItem(eq?.pet),
  };

  // --- RENDERIZAÇÃO NO CANVAS ---
  ctx.fillStyle = '#120f0d';
  ctx.fillRect(0, 0, width, height);

  // Moldura externa
  ctx.fillStyle = '#1a1411';
  ctx.strokeStyle = '#523f2b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(12, 12, width - 24, height - 24, 10);
  ctx.fill();
  ctx.stroke();

  // 1. PAINEL ESQUERDO: INFOS DO HERÓI & BARRAS
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 20px "InterFont", sans-serif';
  ctx.fillText(`${name.toUpperCase()}`, 30, 42);

  ctx.fillStyle = '#a88967';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`Nível ${level} ${className} • Karma: ${karma} • GEN. ${gen}`, 30, 62);
  ctx.fillText(`📍 ${locationName}`, 30, 80);

  function drawBar(y: number, label: string, current: number, max: number, color: string) {
    const pct = Math.min(Math.round((current / (max || 1)) * 100), 100);
    ctx.fillStyle = '#d9c39e';
    ctx.font = 'bold 11px "InterFont", sans-serif';
    ctx.fillText(`${label}: ${current}/${max} (${pct}%)`, 30, y);

    ctx.fillStyle = '#080605';
    ctx.fillRect(30, y + 5, 210, 8);

    const fillWidth = Math.min(((current || 0) / (max || 1)) * 210, 210);
    ctx.fillStyle = color;
    ctx.fillRect(30, y + 5, fillWidth, 8);
  }

  drawBar(105, 'XP', currentXp, maxXp, '#a3a3a3');
  drawBar(133, 'HP', currentHp, maxHp, '#b82e2e');
  drawBar(161, 'ENERGIA', currentEnergy, maxEnergy, '#d19326');

  // Divisória
  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 185);
  ctx.lineTo(240, 185);
  ctx.stroke();

  // Atributos de Combate Reais
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('📊 ATRIBUTOS DE COMBATE', 30, 205);

  ctx.fillStyle = '#c7b299';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${str}  AGI: ${agi}  INT: ${intVal}`, 30, 225);
  ctx.fillText(`VIT: ${vit}  SOR: ${lck}`, 30, 242);

  ctx.fillStyle = '#e6caa3';
  ctx.fillText(`⚔️ Ataque: ${atk}   🛡️ Defesa: ${def}`, 30, 270);
  ctx.fillText(`💥 Crítico: ${crit.toFixed(1)}%   💨 Esquiva: ${dodge.toFixed(1)}%`, 30, 288);

  // 2. PAINEL CENTRAL: PAPERDOLL E SLOTS
  const centerX = 470;
  const centerY = 280;

  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY - 20, 48, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, centerX - 48, centerY - 68, 96, 96);
      ctx.restore();

      ctx.strokeStyle = '#c49b45';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 20, 48, 0, Math.PI * 2);
      ctx.stroke();
    } catch (err) {
      console.error('Erro ao carregar avatar no Canvas:', err);
    }
  }

  const slotsCoords = [
    { key: 'helmet', label: 'Elmo', x: centerX - 150, y: centerY - 140 },
    { key: 'gloves', label: 'Luva', x: centerX - 150, y: centerY - 75 },
    { key: 'pants', label: 'Calça', x: centerX - 150, y: centerY - 10 },
    { key: 'boots', label: 'Bota', x: centerX - 150, y: centerY + 55 },

    { key: 'weapon', label: 'Arma', x: centerX + 90, y: centerY - 140 },
    { key: 'shield', label: 'Escudo', x: centerX + 90, y: centerY - 75 },
    { key: 'ring', label: 'Anel', x: centerX + 90, y: centerY - 10 },
    { key: 'backpack', label: 'Mochila', x: centerX + 90, y: centerY + 55 },
    { key: 'pet', label: 'Pet', x: centerX + 0, y: centerY + 120 }
  ];

  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1.5;
  for (const s of slotsCoords) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 20);
    ctx.lineTo(s.x + 30, s.y + 22);
    ctx.stroke();
  }

  for (const slot of slotsCoords) {
    const itemName = slotItems[slot.key as keyof typeof slotItems] || '—';

    ctx.fillStyle = '#080605';
    ctx.strokeStyle = '#523f2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 65, 45, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8c6d46';
    ctx.font = 'bold 9px "InterFont", sans-serif';
    ctx.fillText(slot.label.toUpperCase(), slot.x + 5, slot.y + 12);

    ctx.fillStyle = itemName !== '—' ? '#e6caa3' : '#4a3b2c';
    ctx.font = '10px "InterFont", sans-serif';
    const truncatedName = itemName.length > 10 ? itemName.substring(0, 9) + '..' : itemName;
    ctx.fillText(truncatedName, slot.x + 5, slot.y + 30);
  }

  // 3. PAINEL DIREITO: STATUS, HABILIDADES E BATALHAS
  const rightX = 690;

  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`⚔️ Poder: #${power.toLocaleString('pt-BR')}`, rightX, 42);
  ctx.fillText(`🪙 Ouro: ${gold.toLocaleString('pt-BR')} G`, rightX, 65);

  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rightX, 80);
  ctx.lineTo(width - 30, 80);
  ctx.stroke();

  // Habilidade Divina
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('✨ HABILIDADE DIVINA', rightX, 100);

  ctx.fillStyle = '#e6caa3';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText(`💀 ${divineName} [Rank ${divineRank}]`, rightX, 120);

  ctx.fillStyle = '#a88967';
  ctx.font = '10px "InterFont", sans-serif';
  ctx.fillText(divineDesc.substring(0, 32), rightX, 138);
  if (divineDesc.length > 32) {
    ctx.fillText(divineDesc.substring(32, 65) + '...', rightX, 150);
  }

  // Histórico
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('📈 HISTÓRICO DE BATALHAS', rightX, 185);

  ctx.fillStyle = '#c7b299';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`🏆 Vitórias: ${wins}  💀 Mortes: ${deaths}`, rightX, 205);
  ctx.fillText(`⚔️ PvP: ${pvpWins}W/${pvpLosses}L  👹 Bosses: ${bosses}`, rightX, 223);

  // Cooldowns Reais
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('🎲 COOLDOWNS RPG', rightX, 260);

  ctx.fillStyle = '#c7b299';
  ctx.font = '11px "InterFont", sans-serif';
  ctx.fillText(`Dungeon: ${formatCooldown(char.lastDungeon, 5)}`, rightX, 280);
  ctx.fillText(`Viagem: ${formatCooldown(char.lastTravel, loc.travelCooldownMin)}`, rightX, 298);
  ctx.fillText(`Explorar: ${formatCooldown(char.lastExplore, 3)}`, rightX, 316);

  return canvas.toBuffer('image/png');
}

export const generateRpgProfile = generateProfileCard;
