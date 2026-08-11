import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

try {
  const fontPath = path.join(process.cwd(), 'src', 'rpg', 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(fontPath, 'InterFont');
} catch (e) {
  console.error('Erro ao carregar fonte:', e);
}

export async function generateRpgProfile(data: any, _extraParam?: any): Promise<Buffer> {
  const width = 900;
  const height = 580;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // --- TRATAMENTO DOS DADOS (Compatibilidade com Prisma/Embed antigos) ---
  const name = data.username || data.name || 'Aventureiro';
  const rClass = data.class || 'Aventureiro';
  const level = data.level ?? 1;
  const karma = data.karma || 'Neutro';
  const gen = data.generation ?? 1;
  const location = data.locationName || data.location || 'Cavernas Sombrias (Noite)';
  
  // Status
  const currentHp = data.currentHp ?? data.hp?.current ?? 100;
  const maxHp = data.maxHp ?? data.hp?.max ?? 100;
  const currentEnergy = data.currentEnergy ?? data.energy?.current ?? 100;
  const maxEnergy = data.maxEnergy ?? data.energy?.max ?? 100;
  const currentXp = data.xp ?? 0;
  const maxXp = data.maxXp ?? 1000;

  // Atributos
  const str = data.str ?? data.attributes?.str ?? 10;
  const agi = data.agi ?? data.attributes?.agi ?? 10;
  const intVal = data.int ?? data.attributes?.int ?? 10;
  const vit = data.vit ?? data.attributes?.vit ?? 10;
  const sor = data.sor ?? data.attributes?.sor ?? 10;

  // Combate
  const atk = data.attack ?? (str * 2 + agi);
  const def = data.defense ?? (vit * 2);
  const crit = data.critChance ?? 15.0;
  const dodge = data.dodgeChance ?? 5.0;
  const power = data.combatPower ?? (atk + def * 1.5);

  // Histórico & Recursos
  const gold = data.gold ?? 0;
  const wins = data.wins ?? 0;
  const deaths = data.deaths ?? 0;
  const pvp = data.pvpRecord || '0W/0L';
  const bosses = data.bossesKilled ?? 0;

  // Equipamentos e Habilidade
  const eq = data.equipment || data.equipments || {};
  const skill = data.divineSkill || { name: 'Nenhuma', rank: 'F', desc: 'Sem habilidade equipada.' };
  const avatarUrl = data.avatarUrl || '';

  // --- RENDERIZAÇÃO VISUAL ---

  // 1. Fundo
  ctx.fillStyle = '#120f0d';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1a1411';
  ctx.strokeStyle = '#523f2b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(12, 12, width - 24, height - 24, 10);
  ctx.fill();
  ctx.stroke();

  // 2. PAINEL ESQUERDO: INFOS DO HERÓI & BARRAS
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 20px "InterFont", sans-serif';
  ctx.fillText(`${name.toUpperCase()}`, 30, 42);

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

  // Divisória Esquerda
  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 185);
  ctx.lineTo(240, 185);
  ctx.stroke();

  // Atributos de Combate
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('ATRIBUTOS DE COMBATE', 30, 205);

  ctx.fillStyle = '#c7b299';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`FOR: ${str}  AGI: ${agi}  INT: ${intVal}`, 30, 225);
  ctx.fillText(`VIT: ${vit}  SOR: ${sor}`, 30, 242);

  // Status de Ataque/Defesa
  ctx.fillStyle = '#e6caa3';
  ctx.fillText(`⚔️ Ataque: ${atk}   🛡️ Defesa: ${def}`, 30, 270);
  ctx.fillText(`💥 Crítico: ${crit}%   💨 Esquiva: ${dodge}%`, 30, 288);

  // 3. CENTRO: PAPERDOLL COMPLETO COM TODOS OS SLOTS
  const centerX = 450;
  const centerY = 270;

  // Avatar no Centro
  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY - 20, 50, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, centerX - 50, centerY - 70, 100, 100);
      ctx.restore();

      ctx.strokeStyle = '#c49b45';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 20, 50, 0, Math.PI * 2);
      ctx.stroke();
    } catch (err) {
      console.error('Erro ao carregar avatar:', err);
    }
  }

  // Lista Completa de Equipamentos (10 Slots do Paperdoll)
  const slotsCoords = [
    // Lado Esquerdo
    { key: 'head', label: 'Elmo', x: centerX - 140, y: centerY - 140 },
    { key: 'chest', label: 'Peito', x: centerX - 140, y: centerY - 75 },
    { key: 'gloves', label: 'Luva', x: centerX - 140, y: centerY - 10 },
    { key: 'legs', label: 'Calça', x: centerX - 140, y: centerY + 55 },
    { key: 'boots', label: 'Bota', x: centerX - 140, y: centerY + 120 },

    // Lado Direito
    { key: 'weapon', label: 'Arma', x: centerX + 90, y: centerY - 140 },
    { key: 'shield', label: 'Escudo', x: centerX + 90, y: centerY - 75 },
    { key: 'ring', label: 'Anel', x: centerX + 90, y: centerY - 10 },
    { key: 'backpack', label: 'Mochila', x: centerX + 90, y: centerY + 55 },
    { key: 'pet', label: 'Pet', x: centerX + 90, y: centerY + 120 }
  ];

  // Linhas Conectoras do Avatar aos Slots
  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1.5;
  for (const s of slotsCoords) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 20);
    ctx.lineTo(s.x + 22, s.y + 22);
    ctx.stroke();
  }

  // Renderizar Caixas e Itens
  for (const slot of slotsCoords) {
    ctx.fillStyle = '#080605';
    ctx.strokeStyle = '#523f2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, 45, 45, 5);
    ctx.fill();
    ctx.stroke();

    const itemData = eq[slot.key];
    const itemUrl = typeof itemData === 'string' ? itemData : itemData?.iconUrl;

    if (itemUrl) {
      try {
        const itemImg = await loadImage(itemUrl);
        ctx.drawImage(itemImg, slot.x + 2, slot.y + 2, 41, 41);
      } catch {
        ctx.fillStyle = '#7a6855';
        ctx.font = '9px "InterFont", sans-serif';
        ctx.fillText(slot.label, slot.x + 6, slot.y + 26);
      }
    } else {
      ctx.fillStyle = '#4a3b2c';
      ctx.font = '9px "InterFont", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(slot.label, slot.x + 22, slot.y + 26);
      ctx.textAlign = 'start';
    }
  }

  // 4. PAINEL DIREITO: HABILIDADES, BATALHAS E RECURSOS
  const rightX = 660;

  // Poder de Combate & Ouro
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 14px "InterFont", sans-serif';
  ctx.fillText(`⚔️ Poder: #${power}`, rightX, 42);
  ctx.fillText(`🪙 Ouro: ${gold.toLocaleString('pt-BR')} G`, rightX, 65);

  // Divisória Direita
  ctx.strokeStyle = '#382b1d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rightX, 82);
  ctx.lineTo(width - 30, 82);
  ctx.stroke();

  // Habilidade Divina
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('✨ HABILIDADE DIVINA', rightX, 105);

  ctx.fillStyle = '#e6caa3';
  ctx.font = 'bold 12px "InterFont", sans-serif';
  ctx.fillText(`${skill.name || 'Nenhuma'} [Rank ${skill.rank || 'F'}]`, rightX, 125);

  // Quebra de linha da descrição
  ctx.fillStyle = '#a88967';
  ctx.font = '10px "InterFont", sans-serif';
  const desc = skill.desc || 'Sem descrição.';
  ctx.fillText(desc.substring(0, 35), rightX, 143);
  if (desc.length > 35) {
    ctx.fillText(desc.substring(35, 70) + '...', rightX, 156);
  }

  // Histórico de Batalhas
  ctx.fillStyle = '#f0e3ce';
  ctx.font = 'bold 13px "InterFont", sans-serif';
  ctx.fillText('📈 HISTÓRICO DE BATALHAS', rightX, 195);

  ctx.fillStyle = '#c7b299';
  ctx.font = '12px "InterFont", sans-serif';
  ctx.fillText(`🏆 Vitórias: ${wins}`, rightX, 218);
  ctx.fillText(`💀 Mortes: ${deaths}`, rightX, 238);
  ctx.fillText(`⚔️ PvP: ${pvp}`, rightX, 258);
  ctx.fillText(`👹 Bosses: ${bosses}`, rightX, 278);

  return canvas.toBuffer('image/png');
}

export const generateProfileCard = generateRpgProfile;