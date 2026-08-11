import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte:', e);
}

export async function generateRpgProfile(data: any): Promise<Buffer> {
  const width = 920;
  const height = 620;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // --- TRATAMENTO DOS DADOS ---
  const name = data.username || data.name || 'Aventureiro';
  const rClass = data.class || data.className || 'Assassino';
  const level = data.level ?? 1;
  const karma = data.karma || 'Neutro';
  const gen = data.generation ?? 1;
  const location = data.locationName || data.location || 'Cavernas Sombrias (NOITE)';

  // Recursos
  const currentXp = data.xp ?? 0;
  const maxXp = data.maxXp ?? data.xpNextLevel ?? (level * 1000);
  const currentHp = data.currentHp ?? data.hp ?? 237;
  const maxHp = data.maxHp ?? 422;
  const currentEnergy = data.currentEnergy ?? data.energy ?? 115;
  const maxEnergy = data.maxEnergy ?? 160;

  // Atributos Reais (Lendo de data.str ou de data.stats.str)
  const str = data.str ?? data.stats?.str ?? 10;
  const agi = data.agi ?? data.stats?.agi ?? 10;
  const intVal = data.int ?? data.stats?.int ?? 10;
  const vit = data.vit ?? data.stats?.vit ?? 10;
  const sor = data.sor ?? data.lck ?? data.stats?.lck ?? 10;

  // Status Calculados de Combate
  const atk = data.attack ?? data.atk ?? (str * 2 + agi);
  const def = data.defense ?? data.def ?? (vit * 2);
  const crit = data.critChance ?? data.crit ?? 15.0;
  const dodge = data.dodgeChance ?? data.dodge ?? 5.0;
  const power = data.combatPower ?? data.power ?? (atk + def * 1.5);
  const gold = data.gold ?? 0;

  // Histórico
  const wins = data.wins ?? data.battlesWon ?? 0;
  const deaths = data.deaths ?? data.battlesLost ?? 0;
  const pvp = data.pvpRecord || `${data.pvpWins || 0}W/${data.pvpLoses || 0}L`;
  const bosses = data.bossesKilled ?? data.bossKills ?? 0;

  // Habilidade Divina
  const skillName = data.divineSkillName || data.divineSkill?.name || 'Golpe Fatal';
  const skillRank = data.divineSkillRank || data.divineSkill?.rank || 'F';
  const skillDesc = data.divineSkillDesc || data.divineSkill?.desc || 'Ataque poderoso baseado em atributos.';

  // Mapeamento dos Equipamentos
  const eqData = data.equipment || data.equipments || {};
  const getItemName = (slot: string) => {
    const item = eqData[slot] || data[`equipped${slot.charAt(0).toUpperCase() + slot.slice(1)}`];
    if (!item) return '—';
    if (typeof item === 'string') return item;
    return item.name || item.title || '—';
  };

  const equipments = {
    head: getItemName('head') !== '—' ? getItemName('head') : getItemName('elmo'),
    weapon: getItemName('weapon') !== '—' ? getItemName('weapon') : getItemName('arma'),
    shield: getItemName('shield') !== '—' ? getItemName('shield') : getItemName('escudo'),
    legs: getItemName('legs') !== '—' ? getItemName('legs') : getItemName('calca'),
    boots: getItemName('boots') !== '—' ? getItemName('boots') : getItemName('bota'),
    gloves: getItemName('gloves') !== '—' ? getItemName('gloves') : getItemName('luva'),
    ring: getItemName('ring') || '—',
    backpack: getItemName('backpack') || '—',
    pet: getItemName('pet') || '—'
  };

  const avatarUrl = data.avatarUrl || '';

  // --- RENDERIZAÇÃO NO CANVAS ---
  ctx.fillStyle = '#120f0d';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1a1411';
  ctx.strokeStyle = '#523f2b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(12, 12, width - 24, height - 24, 10);
  ctx.fill();
  ctx.stroke();

  // 1. Painel Esquerdo
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 20px "InterFont", sans-serif';
  ctx.fillText(`🗡️ ${name.toUpperCase()}`, 30, 42);

  ctx.fillStyle = '#a88967';
  ctx.font = '13px "InterFont", sans-serif';
  ctx.fillText(`Nível ${level} ${rClass} • Karma: ${karma} • GEN. ${gen}`, 30, 62);
  ctx.fillText(`📍 ${location}`, 30, 80);

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

  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 185);
  ctx.lineTo(240, 185);
  ctx.stroke();

  // Atributos de Combate
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('📊 ATRIBUTOS DE COMBATE', 30, 205);

  ctx.fillStyle = '#c7b299';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${str}  AGI: ${agi}  INT: ${intVal}`, 30, 225);
  ctx.fillText(`VIT: ${vit}  SOR: ${sor}`, 30, 242);

  ctx.fillStyle = '#e6caa3';
  ctx.fillText(`⚔️ Ataque: ${atk}   🛡️ Defesa: ${def}`, 30, 270);
  ctx.fillText(`💥 Crítico: ${crit}%   💨 Esquiva: ${dodge}%`, 30, 288);

  // 2. Centro (Paperdoll)
  const centerX = 460;
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
      console.error('Erro ao carregar avatar:', err);
    }
  }

  const slotsCoords = [
    { key: 'head', label: 'Elmo', x: centerX - 150, y: centerY - 140 },
    { key: 'chest', label: 'Peito', x: centerX - 150, y: centerY - 75 },
    { key: 'gloves', label: 'Luva', x: centerX - 150, y: centerY - 10 },
    { key: 'legs', label: 'Calça', x: centerX - 150, y: centerY + 55 },
    { key: 'boots', label: 'Bota', x: centerX - 150, y: centerY + 120 },

    { key: 'weapon', label: 'Arma', x: centerX + 90, y: centerY - 140 },
    { key: 'shield', label: 'Escudo', x: centerX + 90, y: centerY - 75 },
    { key: 'ring', label: 'Anel', x: centerX + 90, y: centerY - 10 },
    { key: 'backpack', label: 'Mochila', x: centerX + 90, y: centerY + 55 },
    { key: 'pet', label: 'Pet', x: centerX + 90, y: centerY + 120 }
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
    const itemName = equipments[slot.key as keyof typeof equipments];

    ctx.fillStyle = '#080605';
    ctx.strokeStyle = '#523f2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 60, 45, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8c6d46';
    ctx.font = 'bold 9px "InterFont", sans-serif';
    ctx.fillText(slot.label.toUpperCase(), slot.x + 5, slot.y + 12);

    ctx.fillStyle = itemName !== '—' ? '#e6caa3' : '#4a3b2c';
    ctx.font = '10px "InterFont", sans-serif';
    const truncatedName = itemName.length > 9 ? itemName.substring(0, 8) + '..' : itemName;
    ctx.fillText(truncatedName, slot.x + 5, slot.y + 30);
  }

  // 3. Painel Direito
  const rightX = 680;

  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`⚔️ Poder: #${power}`, rightX, 42);
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
  ctx.fillText(`💀 ${skillName} [Rank ${skillRank}]`, rightX, 120);

  ctx.fillStyle = '#a88967';
  ctx.font = '10px "InterFont", sans-serif';
  ctx.fillText(skillDesc.substring(0, 32), rightX, 138);
  if (skillDesc.length > 32) {
    ctx.fillText(skillDesc.substring(32, 65) + '...', rightX, 150);
  }

  // Histórico
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('📈 HISTÓRICO DE BATALHAS', rightX, 185);

  ctx.fillStyle = '#c7b299';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`🏆 Vitórias: ${wins}  💀 Mortes: ${deaths}`, rightX, 205);
  ctx.fillText(`⚔️ PvP: ${pvp}  👹 Bosses: ${bosses}`, rightX, 223);

  // Cooldowns
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('🎲 COOLDOWNS RPG', rightX, 260);

  ctx.fillStyle = '#2ecc71';
  ctx.font = '11px "InterFont", sans-serif';
  ctx.fillText('🟢 Dungeon: Pronto', rightX, 280);
  ctx.fillText('🟢 Caçada: Pronto', rightX, 298);
  ctx.fillText('🟢 Explorar: Pronto', rightX, 316);

  return canvas.toBuffer('image/png');
}

export const generateProfileCard = generateRpgProfile;
