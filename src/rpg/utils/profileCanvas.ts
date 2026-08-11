import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte:', e);
}

export async function generateRpgProfile(userProfile: any, extraData?: any): Promise<Buffer> {
  const p = userProfile || {};

  const width = 920;
  const height = 620;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // --- EXTRAÇÃO E MAPEAMENTO DE DADOS DO PRISMA ---
  const name = p.username || p.name || 'Aventureiro';
  const rClass = p.class || p.className || 'Assassino';
  const level = p.level ?? 1;
  const karma = p.karma || 'Neutro';
  const gen = p.generation ?? 1;
  const location = p.locationName || p.location || 'Cavernas Sombrias (NOITE)';

  // Recursos
  const currentXp = p.xp ?? 0;
  const maxXp = p.maxXp ?? p.xpNextLevel ?? (level * 1000);
  const currentHp = p.currentHp ?? p.hp ?? 237;
  const maxHp = p.maxHp ?? 422;
  const currentEnergy = p.currentEnergy ?? p.energy ?? 115;
  const maxEnergy = p.maxEnergy ?? 160;

  // Atributos de Combate Reais
  const str = p.str ?? p.attributes?.str ?? 10;
  const agi = p.agi ?? p.attributes?.agi ?? 10;
  const intVal = p.int ?? p.attributes?.int ?? 10;
  const vit = p.vit ?? p.attributes?.vit ?? 10;
  const sor = p.sor ?? p.attributes?.sor ?? 10;

  // Status Calculados
  const atk = p.attack ?? p.atk ?? (str * 2 + agi);
  const def = p.defense ?? p.def ?? (vit * 2);
  const crit = p.critChance ?? p.crit ?? 15.0;
  const dodge = p.dodgeChance ?? p.dodge ?? 5.0;
  const power = p.combatPower ?? p.power ?? (atk + def * 1.5);
  const gold = p.gold ?? 0;

  // Histórico
  const wins = p.wins ?? p.battlesWon ?? 0;
  const deaths = p.deaths ?? p.battlesLost ?? 0;
  const pvp = p.pvpRecord || `${p.pvpWins || 0}W/${p.pvpLoses || 0}L`;
  const bosses = p.bossesKilled ?? p.bossKills ?? 0;

  // Habilidade Divina
  const skillName = p.divineSkillName || p.divineSkill?.name || 'Golpe Fatal';
  const skillRank = p.divineSkillRank || p.divineSkill?.rank || 'F';
  const skillDesc = p.divineSkillDesc || p.divineSkill?.desc || 'Ataque poderoso baseado em atributos do personagem.';

  // Equipamentos (Mapeamento flexível de Nomes/URLs)
  const eqData = p.equipment || p.equipments || {};
  const getEquipmentName = (slot: string) => {
    const item = eqData[slot] || p[`equipped${slot.charAt(0).toUpperCase() + slot.slice(1)}`] || p[slot];
    if (!item) return '—';
    if (typeof item === 'string') return item;
    return item.name || item.title || '—';
  };

  const equipments = {
    head: getEquipmentName('head') !== '—' ? getEquipmentName('head') : getEquipmentName('elmo'),
    weapon: getEquipmentName('weapon') !== '—' ? getEquipmentName('weapon') : getEquipmentName('arma'),
    shield: getEquipmentName('shield') !== '—' ? getEquipmentName('shield') : getEquipmentName('escudo'),
    legs: getEquipmentName('legs') !== '—' ? getEquipmentName('legs') : getEquipmentName('calca'),
    boots: getEquipmentName('boots') !== '—' ? getEquipmentName('boots') : getEquipmentName('bota'),
    gloves: getEquipmentName('gloves') !== '—' ? getEquipmentName('gloves') : getEquipmentName('luva'),
    ring: getEquipmentName('ring') || '—',
    backpack: getEquipmentName('backpack') || '—',
    pet: getEquipmentName('pet') || '—'
  };

  const avatarUrl = p.avatarUrl || p.user?.displayAvatarURL?.() || '';

  // --- RENDERIZAÇÃO DO CANVAS ---
  ctx.fillStyle = '#120f0d';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1a1411';
  ctx.strokeStyle = '#523f2b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(12, 12, width - 24, height - 24, 10);
  ctx.fill();
  ctx.stroke();

  // 1. PAINEL ESQUERDO
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

  // 2. CENTRO: PAPERDOLL E EQUIPAMENTOS
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

  // 3. PAINEL DIREITO: HABILIDADES, BATALHAS E COOLDOWNS
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

  // Cooldowns RPG
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
