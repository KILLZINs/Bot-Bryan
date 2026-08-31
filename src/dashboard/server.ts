import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma } from '../database/client';

// ─── Importações Oficiais do RPG da Aliança Skyline ─────────────────────────
import { getOrCreateCharacter, computeStats, distributeStatPoints, FullCharacter } from '../rpg/services/character';
import { doExplore } from '../rpg/panels/exploracao';
import { doTrain } from '../rpg/panels/treinar';
import { startMeditation, collectMeditation } from '../rpg/panels/meditar';
import { castFishingLine, reelFishingLine } from '../rpg/panels/pescaria';
import { buyTavernaItem, rollTavernaDice } from '../rpg/panels/taverna';
import { attackWorldBoss, getActiveBoss } from '../rpg/services/worldBoss';
import { travelTo } from '../rpg/panels/travel';
import { equipItem, unequipItem, useConsumable, sellItem, buyItem, getInventory } from '../rpg/services/inventory';
import { getItem, ITEMS, ITEM_LIST, CRAFT_RECIPES } from '../rpg/constants/items';
import { getLocation, LOCATION_LIST } from '../rpg/constants/locations';
import { getClass, rpgXpForLevel } from '../rpg/constants/classes';
import { DIVINE_SKILLS, PASSIVE_TALENTS } from '../rpg/constants/skills';
import { getEnemiesForLocation } from '../rpg/constants/enemies';
import { startInteractiveCombat, takeCombatAction } from '../rpg/services/combat';
import { craftItem } from '../rpg/panels/forja';

const BOT_OWNER_ID = '1195254699943796791';

// ==========================================
// 🧩 1. MÓDULOS DO SERVIDOR (SWITCHES)
// ==========================================
const SERVER_CATEGORIES = [
  {
    category: "⚔️ RPG, Dungeons & Economia",
    desc: "Sistemas de progressão, combate e mercado",
    features: [
      { id: 'featRpg', name: 'Ecossistema RPG Completo', desc: 'Dungeons, talentos, World Bosses, inventário e Web RPG.', icon: '⚔️' },
      { id: 'featEconomy', name: 'Economia, Loja & VIP', desc: 'Moedas, transferências, loja de itens e cargos VIP.', icon: '🪙' },
      { id: 'featMissions', name: 'Missões Diárias & Semanais', desc: 'Desafios automáticos com recompensas em XP e gold.', icon: '📜' }
    ]
  },
  {
    category: "🛡️ Segurança, Moderação & Logs",
    desc: "Proteção 24/7 contra ataques, spam e invasões",
    features: [
      { id: 'featMod', name: 'Comandos de Moderação', desc: 'Controle de punições, ban, kick, warns e auditoria.', icon: '🔨' },
      { id: 'antiSpam', name: 'Defesa Ativa Anti-Spam', desc: 'Detecta e bloqueia envio massivo de mensagens.', icon: '⚡' },
      { id: 'antiLinks', name: 'Filtro Anti-Links & Invites', desc: 'Remove automaticamente convites e links externos.', icon: '🔗' }
    ]
  },
  {
    category: "📸 Social, Roleplay & Instagram",
    desc: "Rede social interna, casamento e interações",
    features: [
      { id: 'featSocial', name: 'Feed Social / Instagram', desc: 'Postagens de fotos, curtidas, comentários e avisos no PV.', icon: '📸' },
      { id: 'featLeveling', name: 'Sistema de XP & Leveling', desc: 'Progressão por mensagens e ranking em texto/fórum.', icon: '⭐' },
      { id: 'featGiveaways', name: 'Sorteios com Cron Scheduler', desc: 'Sorteios automáticos com botão e agendamento.', icon: '🎁' },
      { id: 'featPolls', name: 'Enquetes Interativas', desc: 'Votações com contagem de votos e estatísticas.', icon: '📊' }
    ]
  },
  {
    category: "🎫 Atendimento, Voz & Áudio",
    desc: "Suporte aos membros e streaming nos canais",
    features: [
      { id: 'featTickets', name: 'Tickets de Atendimento', desc: 'Salas privadas com transcrição de histórico.', icon: '🎫' },
      { id: 'featSelfRole', name: 'Registro de Auto-Cargos', desc: 'Menus de seleção para os membros escolherem cargos.', icon: '🎭' },
      { id: 'featMusic', name: 'Player de Música FFmpeg', desc: 'Streaming de áudio de alta fidelidade em canais de voz.', icon: '🎵' },
      { id: 'featAnnouncements', name: 'Anúncios & Eventos', desc: 'Transmissão de comunicados oficiais e eventos.', icon: '📢' }
    ]
  }
];

const GLOBAL_CATEGORIES = [
  {
    category: "⚙️ Sistemas Centrais Globais",
    features: [
      { id: 'featAfk', name: 'Sistema AFK Global', desc: 'Comando /afk e monitoramento de menções em toda a rede.' },
      { id: 'featWelcomeDm', name: 'DM de Boas-vindas Global', desc: 'Mensagem privada automática aos novos membros.' }
    ]
  },
  {
    category: "🌍 Master Kill Switches (Desliga em TODOS os Servidores)",
    features: [
      { id: 'featRpg', name: 'Trava Mestre RPG', desc: 'Desliga todo o RPG do bot globalmente.' },
      { id: 'featEconomy', name: 'Trava Economia', desc: 'Congela todas as lojas e transferências de moedas.' },
      { id: 'featTickets', name: 'Trava Tickets', desc: 'Bloqueia criação de novos atendimentos.' },
      { id: 'featMusic', name: 'Trava Motor de Música', desc: 'Desliga o player de áudio por segurança.' }
    ]
  }
];

// ==========================================
// ⚙️ 2. CONFIGURAÇÕES DETALHADAS (INPUTS)
// ==========================================
const SERVER_SETTINGS = [
  {
    category: "📸 Feed Social / Instagram",
    desc: "Personalize a aparência dos posts e canais de fotos",
    items: [
      { id: 'feedChannelId', name: 'Canal do Feed (ID)', type: 'text', placeholder: 'ID do canal onde as fotos serão postadas' },
      { id: 'feedEmbedColor', name: 'Cor do Card do Feed', type: 'color', placeholder: '#E1306C' },
      { id: 'feedLikeEmoji', name: 'Emoji de Curtir', type: 'text', placeholder: 'Padrão: 💜' },
      { id: 'feedFollowEmoji', name: 'Emoji de Seguir', type: 'text', placeholder: 'Padrão: 🔔' },
      { id: 'feedCommentEmoji', name: 'Emoji de Comentar', type: 'text', placeholder: 'Padrão: 💬' },
      { id: 'feedFooterText', name: 'Rodapé das Postagens', type: 'text', placeholder: 'Ex: 📸 Instagram Skyline' }
    ]
  },
  {
    category: "📁 Canais de Notificação & Logs (IDs)",
    desc: "Direcione onde cada sistema do bot enviará avisos",
    items: [
      { id: 'welcomeChannelId', name: 'Canal de Boas-Vindas', type: 'text', placeholder: 'ID do canal de recepção' },
      { id: 'announcementChannelId', name: 'Canal de Anúncios', type: 'text', placeholder: 'ID do canal de comunicados' },
      { id: 'logChannelId', name: 'Canal de Logs Gerais / Auditoria', type: 'text', placeholder: 'ID do canal de registros' },
      { id: 'levelUpChannelId', name: 'Canal ou Fórum de Level Up', type: 'text', placeholder: 'ID do canal/fórum de avisos de nível' },
      { id: 'suggestionChannelId', name: 'Canal de Sugestões', type: 'text', placeholder: 'ID do canal para o /sugestao' },
      { id: 'feedbackChannelId', name: 'Canal de Feedback', type: 'text', placeholder: 'ID do canal para o /feedback' }
    ]
  },
  {
    category: "🎫 Sistema de Tickets (IDs)",
    desc: "Configuração de atendimento e histórico",
    items: [
      { id: 'ticketCategoryId', name: 'Categoria dos Tickets (ID)', type: 'text', placeholder: 'ID da categoria onde os tickets serão criados' },
      { id: 'ticketLogChannelId', name: 'Canal de Transcrições (ID)', type: 'text', placeholder: 'ID do canal onde os logs de tickets são salvos' }
    ]
  },
  {
    category: "🛡️ Cargos de Permissão & Moderação (IDs)",
    desc: "Definição de hierarquia e cargos automáticos",
    items: [
      { id: 'adminRoleId', name: 'Cargo de Administrador', type: 'text', placeholder: 'ID do cargo com acesso total ao bot' },
      { id: 'modRoleId', name: 'Cargo de Moderador', type: 'text', placeholder: 'ID do cargo para punições e moderação' },
      { id: 'autoRoleId', name: 'Cargo Automático (Auto-Role)', type: 'text', placeholder: 'ID do cargo entregue ao entrar' },
      { id: 'memberRoleId', name: 'Cargo de Membro Registrado', type: 'text', placeholder: 'ID do cargo de membro padrão' },
      { id: 'mutedRoleId', name: 'Cargo de Silenciado (Muted)', type: 'text', placeholder: 'ID do cargo aplicado em mutes' }
    ]
  },
  {
    category: "💬 Mensagem de Recepção Personalizada",
    desc: "Configure a mensagem enviada aos novos membros",
    items: [
      { id: 'welcomeMessage', name: 'Texto de Boas-Vindas', type: 'textarea', placeholder: 'Olá {user}, seja muito bem-vindo(a) ao servidor {guild}!' }
    ]
  }
];

const GLOBAL_SETTINGS = [
  {
    category: "🎨 Identidade Visual Global",
    desc: "Personalização de rodapés e cores em todos os servidores",
    items: [
      { id: 'footerText', name: 'Texto de Rodapé Padrão', type: 'text', placeholder: 'Aparece nos embeds gerais' },
      { id: 'rpFooterText', name: 'Rodapé Roleplay', type: 'text', placeholder: 'Aparece nos comandos de /rp' },
      { id: 'botIconUrl', name: 'URL do Ícone do Bot', type: 'text', placeholder: 'Link direto da imagem do ícone' },
      { id: 'primaryColor', name: 'Cor Primária dos Embeds', type: 'color', placeholder: '#7B2CBF' }
    ]
  }
];

async function validateGuildAccess(userId: string, guildId: string): Promise<boolean> {
  if (userId === BOT_OWNER_ID) return true;
  const access = await prisma.allianceServerMember.findFirst({
    where: { userId, guildId }
  });
  return !access;
}

export function startDashboard() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), 'public')));

  const port = Number(process.env.PORT) || 8080;
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://bryanbot.up.railway.app';
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  const botInviteUrl = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`
    : 'https://discord.com';

  // ─── TELA INICIAL (LANDING PAGE) ──────────────────────────────────────────
  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bryan Bot — Ecossistema Discord & Web RPG</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07060b;
      --card-bg: rgba(18, 14, 28, 0.75);
      --border: rgba(168, 85, 247, 0.22);
      --primary: #8b5cf6;
      --primary-glow: rgba(139, 92, 246, 0.55);
      --accent: #e1306c;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: #f1edfa;
      font-family: 'Plus Jakarta Sans', sans-serif;
      overflow-x: hidden;
      line-height: 1.6;
    }
    .bg-canvas {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: -1;
      background:
        radial-gradient(circle at 12% 18%, rgba(139, 92, 246, 0.25) 0%, transparent 40%),
        radial-gradient(circle at 88% 82%, rgba(225, 48, 108, 0.2) 0%, transparent 45%),
        linear-gradient(180deg, #090710 0%, #050408 100%);
    }
    nav {
      display: flex; justify-content: space-between; align-items: center;
      padding: 18px 8%;
      background: rgba(9, 7, 16, 0.85);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
    }
    .brand {
      display: flex; align-items: center; gap: 14px;
      text-decoration: none; color: white;
    }
    .brand img {
      width: 44px; height: 44px; border-radius: 50%;
      border: 2px solid var(--primary);
      box-shadow: 0 0 20px var(--primary-glow);
      object-fit: cover;
    }
    .brand-name {
      font-weight: 900; font-size: 1.35rem;
      background: linear-gradient(135deg, #ffffff 0%, #e0c3fc 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .nav-btns { display: flex; gap: 12px; align-items: center; }
    .btn {
      padding: 12px 24px; border-radius: 12px; font-weight: 800; font-size: 13.5px;
      text-decoration: none; display: inline-flex; align-items: center; gap: 10px;
      transition: all 0.3s ease; cursor: pointer;
    }
    .btn-rpg {
      background: linear-gradient(135deg, #ff007f 0%, #7928ca 100%);
      color: white; border: 1px solid rgba(255,255,255,0.3);
      box-shadow: 0 0 25px rgba(255, 0, 127, 0.5);
      font-family: 'Press Start 2P', monospace; font-size: 10px; padding: 14px 20px;
    }
    .btn-rpg:hover { transform: translateY(-2px); box-shadow: 0 10px 35px rgba(255, 0, 127, 0.8); }
    .btn-primary {
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      color: white; box-shadow: 0 0 25px rgba(124, 58, 237, 0.5);
    }
    .btn-invite {
      background: linear-gradient(135deg, #5865f2 0%, #4752c4 100%);
      color: white;
    }
    .hero {
      text-align: center;
      padding: 85px 8% 50px 8%;
      max-width: 1240px;
      margin: 0 auto;
    }
    .hero h1 {
      font-size: clamp(2.5rem, 5.5vw, 4.5rem);
      font-weight: 900; line-height: 1.15;
      margin-bottom: 25px;
    }
    .gradient-text {
      background: linear-gradient(135deg, #ffffff 15%, #c084fc 55%, #e1306c 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero p {
      font-size: 1.15rem; color: #b3a7c6; max-width: 820px;
      margin: 0 auto 40px auto;
    }
    .hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    footer {
      border-top: 1px solid var(--border); padding: 40px 8%;
      text-align: center; color: #786b8c; font-size: 14px; background: #050408;
    }
  </style>
</head>
<body>
  <div class="bg-canvas"></div>
  <nav>
    <a href="/" class="brand">
      <img src="/skylineicon.jpg" alt="Bryan Bot Icon">
      <span class="brand-name">Bryan Bot</span>
    </a>
    <div class="nav-btns">
      <a href="/rpg" class="btn btn-rpg"><span>🎮 JOGAR RPG</span></a>
      <a href="${botInviteUrl}" target="_blank" class="btn btn-invite"><span>➕ Adicionar Bot</span></a>
      <a href="/login" class="btn btn-primary"><span>⚡ Painel Web</span></a>
    </div>
  </nav>

  <section class="hero">
    <h1>O Ecossistema Completo para seu <span class="gradient-text">Servidor Discord & Web</span></h1>
    <p>O Bryan Bot reúne o jogo RPG multiplayer jogável diretamente pelo site, IA conversacional de voz, feed social estilo Instagram, tickets e moderação blindada.</p>
    <div class="hero-actions">
      <a href="/rpg" class="btn btn-rpg" style="padding: 16px 28px; font-size: 12px;"><span>🎮 JOGAR RPG WEB</span></a>
      <a href="${botInviteUrl}" target="_blank" class="btn btn-invite" style="padding: 16px 32px; font-size: 15px;"><span>➕ Adicionar ao Discord</span></a>
      <a href="/login" class="btn btn-primary" style="padding: 16px 32px; font-size: 15px;"><span>⚙️ Painel de Controle</span></a>
    </div>
  </section>

  <footer>
    <p>© 2026 <strong>Bryan Bot</strong> • Desenvolvido para a <strong>Aliança Skyline</strong>.</p>
  </footer>
</body>
</html>`);
  });

  // ─── TELA DO WEB RPG (PIXEL ART RETRO COM TODOS OS SISTEMAS) ──────────────
  app.get('/rpg', async (req, res) => {
    if (req.cookies?.skyline_auth !== 'permitido') {
      return res.redirect('/login');
    }
    const userId = req.cookies?.skyline_userid;
    const userName = req.cookies?.skyline_username || 'Aventureiro';

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skyline RPG — Pixel Web Edition</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; image-rendering: pixelated; }
    body {
      background: #0d0814;
      color: #00ffcc;
      font-family: 'Press Start 2P', monospace;
      min-height: 100vh;
      display: flex; flex-direction: column;
      overflow-x: hidden;
      user-select: none;
    }
    .crt-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      pointer-events: none; z-index: 999;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%);
      background-size: 100% 3px;
    }
    .game-navbar {
      background: #190f28; border-bottom: 4px solid #7928ca;
      padding: 15px 30px; display: flex; justify-content: space-between; align-items: center;
    }
    .game-logo { font-size: 13px; color: #ff007f; text-shadow: 2px 2px #000; }
    .nav-link { color: #ffd166; text-decoration: none; font-size: 10px; margin-left: 20px; }
    .nav-link:hover { color: #00ffcc; }

    .game-container {
      flex: 1; max-width: 1280px; width: 100%; margin: 20px auto; padding: 0 20px;
      display: grid; grid-template-columns: 380px 1fr; gap: 20px;
    }

    /* COLUNA DO PERSONAGEM */
    .char-panel {
      background: #150c22; border: 4px solid #ff007f; box-shadow: 6px 6px 0px #000;
      padding: 18px; display: flex; flex-direction: column; gap: 14px;
    }
    .avatar-frame {
      width: 100%; height: 140px; background: #07040a; border: 4px solid #7928ca;
      display: flex; align-items: center; justify-content: center; position: relative;
    }
    .char-sprite { font-size: 54px; filter: drop-shadow(4px 4px 0px #000); animation: floatSprite 1.5s infinite ease-in-out alternate; }
    @keyframes floatSprite { from { transform: translateY(-3px); } to { transform: translateY(3px); } }

    .char-title-tag { font-size: 8px; color: #ffd166; text-align: center; text-transform: uppercase; margin-top: 3px; }
    .char-name { font-size: 13px; color: #fff; text-align: center; text-shadow: 2px 2px #ff007f; }
    .char-class { font-size: 8.5px; color: #00ffcc; text-align: center; }

    .bar-wrap { margin-top: 4px; }
    .bar-label { font-size: 8px; margin-bottom: 3px; display: flex; justify-content: space-between; color: #fff; }
    .pixel-bar { height: 14px; background: #000; border: 2px solid #fff; position: relative; }
    .pixel-fill-hp { height: 100%; width: 100%; background: #ff0055; transition: width 0.3s; }
    .pixel-fill-energy { height: 100%; width: 100%; background: #00e5ff; transition: width 0.3s; }
    .pixel-fill-xp { height: 100%; width: 100%; background: #ffd700; transition: width 0.3s; }

    .stats-box { background: #0c0714; border: 2px solid #7928ca; padding: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 8px; }
    .stat-row { display: flex; justify-content: space-between; align-items: center; }
    .stat-btn { background: #00ffcc; border: none; color: #000; font-family: inherit; font-size: 8px; padding: 2px 6px; cursor: pointer; }
    .stat-btn:hover { background: #ff007f; color: #fff; }

    .cooldowns-box { background: #08040d; border: 2px solid #3d1c73; padding: 10px; font-size: 7.5px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

    /* COLUNA DE AÇÕES */
    .action-panel {
      background: #150c22; border: 4px solid #7928ca; box-shadow: 6px 6px 0px #000;
      padding: 20px; display: flex; flex-direction: column; gap: 16px;
    }
    .action-tabs { display: flex; gap: 8px; border-bottom: 4px solid #0c0714; padding-bottom: 12px; flex-wrap: wrap; }
    .game-tab-btn {
      background: #1f1233; color: #b8a6d9; border: 2px solid #7928ca;
      font-family: inherit; font-size: 8.5px; padding: 10px 12px; cursor: pointer; transition: 0.2s;
    }
    .game-tab-btn:hover, .game-tab-btn.active {
      background: #ff007f; color: #fff; border-color: #fff; box-shadow: 2px 2px 0px #000;
    }

    /* ARENA DINÂMICA */
    .arena-display {
      height: 200px; background: #08040d; border: 4px solid #00ffcc;
      display: flex; flex-direction: column; justify-content: space-between; padding: 15px; position: relative;
    }
    .monster-zone { display: flex; justify-content: space-between; align-items: center; }
    .monster-sprite { font-size: 48px; animation: monsterShake 2s infinite; }
    @keyframes monsterShake { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08) rotate(3deg); } }

    .enemy-bar-wrap { width: 180px; margin-top: 5px; }
    .pixel-fill-enemy { height: 10px; width: 100%; background: #ff0055; transition: width 0.3s; }

    .game-log-box {
      height: 140px; background: #000; border: 2px solid #7928ca;
      padding: 10px; overflow-y: auto; font-family: 'VT323', monospace; font-size: 18px; color: #00ffcc;
      display: flex; flex-direction: column; gap: 3px;
    }

    .controls-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
    .btn-action {
      background: #7928ca; border: 3px solid #fff; color: #fff;
      font-family: inherit; font-size: 8px; padding: 12px 8px; cursor: pointer;
      text-align: center; box-shadow: 3px 3px 0px #000; transition: all 0.15s;
    }
    .btn-action:hover { background: #ff007f; transform: translate(-2px, -2px); box-shadow: 5px 5px 0px #000; }
    .btn-action:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0px #000; }
  </style>
</head>
<body>
  <div class="crt-overlay"></div>

  <div class="game-navbar">
    <div class="game-logo">⚔️ SKYLINE RPG :: PIXEL WEB EDITION</div>
    <div>
      <a href="/painel" class="nav-link">⚙️ PAINEL</a>
      <a href="/" class="nav-link">🏠 INÍCIO</a>
    </div>
  </div>

  <div class="game-container">
    <!-- PERSONAGEM -->
    <div class="char-panel">
      <div class="avatar-frame">
        <div class="char-sprite" id="charSprite">⚔️</div>
      </div>
      <div class="char-title-tag" id="charTitle">« Aventureiro »</div>
      <div class="char-name" id="charName">${userName}</div>
      <div class="char-class" id="charClass">NÍVEL 1 • GUERREIRO</div>

      <div class="bar-wrap">
        <div class="bar-label"><span>HP</span><span id="hpText">100/100</span></div>
        <div class="pixel-bar"><div class="pixel-fill-hp" id="hpBar"></div></div>
      </div>
      <div class="bar-wrap">
        <div class="bar-label"><span>ENERGIA</span><span id="energyText">50/50</span></div>
        <div class="pixel-bar"><div class="pixel-fill-energy" id="energyBar"></div></div>
      </div>
      <div class="bar-wrap">
        <div class="bar-label"><span>XP</span><span id="xpText">0/100</span></div>
        <div class="pixel-bar"><div class="pixel-fill-xp" id="xpBar"></div></div>
      </div>

      <div class="stats-box">
        <div class="stat-row"><span>🪙 GOLD:</span><span id="goldVal" style="color:#ffd700;">100</span></div>
        <div class="stat-row">
          <span>💪 FORÇA: <b id="strVal">10</b></span>
          <button class="stat-btn" id="btnStr" onclick="distributePoint('strength')">+</button>
        </div>
        <div class="stat-row">
          <span>🏃 AGILIDADE: <b id="agiVal">10</b></span>
          <button class="stat-btn" id="btnAgi" onclick="distributePoint('agility')">+</button>
        </div>
        <div class="stat-row">
          <span>🧠 INTELIGÊNCIA: <b id="intVal">10</b></span>
          <button class="stat-btn" id="btnInt" onclick="distributePoint('intelligence')">+</button>
        </div>
        <div class="stat-row">
          <span>❤️ VITALIDADE: <b id="vitVal">10</b></span>
          <button class="stat-btn" id="btnVit" onclick="distributePoint('vitality')">+</button>
        </div>
        <div class="stat-row">
          <span>🍀 SORTE: <b id="luckVal">10</b></span>
          <button class="stat-btn" id="btnLuck" onclick="distributePoint('luck')">+</button>
        </div>
        <div class="stat-row" style="color:#ffd700; margin-top:4px; font-weight:bold;">
          <span>PONTOS DISPONÍVEIS:</span><span id="statPointsVal">0</span>
        </div>
      </div>

      <div class="cooldowns-box" id="cooldownsArea">
        <div>⚔️ Dungeon: <span id="cdDungeon">Pronto</span></div>
        <div>🌍 Explorar: <span id="cdExplore">Pronto</span></div>
        <div>🥊 Treino: <span id="cdTrain">Pronto</span></div>
        <div>🎣 Pesca: <span id="cdFish">Pronto</span></div>
      </div>
    </div>

    <!-- ARENA E AÇÕES -->
    <div class="action-panel">
      <div class="action-tabs">
        <button class="game-tab-btn active" onclick="switchGameTab('dungeon')">⚔️ DUNGEON</button>
        <button class="game-tab-btn" onclick="switchGameTab('city')">🏰 CIDADE & LOJA</button>
        <button class="game-tab-btn" onclick="switchGameTab('inventory')">🎒 INVENTÁRIO</button>
        <button class="game-tab-btn" onclick="switchGameTab('explore')">🌍 EXPLORAR</button>
        <button class="game-tab-btn" onclick="switchGameTab('train')">🥊 TREINAR</button>
        <button class="game-tab-btn" onclick="switchGameTab('fish')">🎣 PESCAR</button>
        <button class="game-tab-btn" onclick="switchGameTab('tavern')">🍺 TAVERNA</button>
        <button class="game-tab-btn" onclick="switchGameTab('boss')">🐉 WORLD BOSS</button>
      </div>

      <div class="arena-display" id="arenaDisplay">
        <div class="monster-zone">
          <div>
            <div style="font-size:10px; color:#ff0055;" id="enemyName">SELECIONE UMA AÇÃO</div>
            <div style="font-size:8px; color:#fff;" id="enemyHpText">HP: --/--</div>
            <div class="enemy-bar-wrap">
              <div class="pixel-bar"><div class="pixel-fill-enemy" id="enemyHpBar"></div></div>
            </div>
          </div>
          <div class="monster-sprite" id="enemySprite">👾</div>
        </div>
        <div style="font-size:8px; color:#ffd166;" id="locationName">📍 LOCAL: CARREGANDO...</div>
      </div>

      <div class="game-log-box" id="gameLog">
        <div>> Conectado ao RPG da Aliança Skyline. Escolha sua ação...</div>
      </div>

      <div class="controls-grid" id="controlsGrid">
        <button class="btn-action" onclick="sendAction('combat_start')">⚔️ ENTRAR EM COMBATE</button>
        <button class="btn-action" style="background:#2b9348;" onclick="sendAction('heal_rest')">🏥 CURAR (10G)</button>
      </div>
    </div>
  </div>

  <script>
    let currentTab = 'dungeon';
    let inBattle = false;

    function addLog(msg, color = '#00ffcc') {
      const log = document.getElementById('gameLog');
      const div = document.createElement('div');
      div.style.color = color;
      div.innerText = '> ' + msg;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    function switchGameTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.game-tab-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      const controls = document.getElementById('controlsGrid');

      if (tab === 'dungeon') {
        if (inBattle) {
          renderCombatControls();
        } else {
          document.getElementById('enemyName').innerText = 'MONSTRO DA REGIÃO';
          document.getElementById('enemySprite').innerText = '👹';
          controls.innerHTML = \`
            <button class="btn-action" onclick="sendAction('combat_start')">⚔️ INICIAR COMBATE</button>
            <button class="btn-action" style="background:#2b9348;" onclick="sendAction('heal_rest')">🏥 CURAR HP/ENERGIA</button>
          \`;
        }
      } else if (tab === 'city') {
        document.getElementById('enemyName').innerText = 'CIDADE DA ALIANÇA';
        document.getElementById('enemySprite').innerText = '🏰';
        document.getElementById('enemyHpText').innerText = 'ZONA SEGURA';
        document.getElementById('enemyHpBar').style.width = '100%';
        controls.innerHTML = \`
          <button class="btn-action" style="background:#2ecc71;" onclick="sendAction('heal_rest')">🏥 CURANDEIRO</button>
          <button class="btn-action" style="background:#f1c40f; color:#000;" onclick="sendAction('tavern_beer')">🍺 BEBER CERVEJA (20G)</button>
          <button class="btn-action" style="background:#e67e22;" onclick="sendAction('forge_iron_sword')">⚒️ FORJAR ESPADA (100G)</button>
          <button class="btn-action" style="background:#9b59b6;" onclick="loadCharacter()">🔄 ATUALIZAR</button>
        \`;
        addLog('Hub da Cidade: Acesse curandeiro, forja e comércios da Aliança.', '#ffd166');
      } else if (tab === 'inventory') {
        document.getElementById('enemyName').innerText = 'MOCHILA & EQUIPAMENTO';
        document.getElementById('enemySprite').innerText = '🎒';
        document.getElementById('enemyHpText').innerText = 'INVENTÁRIO';
        document.getElementById('enemyHpBar').style.width = '100%';
        controls.innerHTML = \`
          <button class="btn-action" style="background:#3498db;" onclick="sendAction('use_potion')">🧪 USAR POÇÃO DE HP</button>
          <button class="btn-action" style="background:#e67e22;" onclick="sendAction('sell_iron')">💰 VENDER MINÉRIO</button>
          <button class="btn-action" style="background:#7928ca;" onclick="loadCharacter()">🔄 ATUALIZAR BOLSA</button>
        \`;
        addLog('Inventário de itens: Use consumíveis ou venda recursos.', '#00e5ff');
      } else if (tab === 'explore') {
        document.getElementById('enemyName').innerText = 'RUÍNAS & CAMINHOS';
        document.getElementById('enemySprite').innerText = '🗺️';
        document.getElementById('enemyHpText').innerText = 'HP: --/--';
        document.getElementById('enemyHpBar').style.width = '100%';
        controls.innerHTML = \`
          <button class="btn-action" style="background:#2ecc71;" onclick="sendAction('explore')">🌍 EXPLORAR (8⚡)</button>
          <button class="btn-action" style="background:#7928ca;" onclick="loadCharacter()">🔄 ATUALIZAR</button>
        \`;
        addLog('Área de exploração aberta. Custo: 8 de Energia.', '#ffd166');
      } else if (tab === 'train') {
        document.getElementById('enemyName').innerText = 'CENTRO DE TREINAMENTO';
        document.getElementById('enemySprite').innerText = '🥊';
        document.getElementById('enemyHpText').innerText = 'BUFFS: 45 MIN';
        document.getElementById('enemyHpBar').style.width = '100%';
        controls.innerHTML = \`
          <button class="btn-action" onclick="sendAction('train_str')">💪 FORÇA (+12%)</button>
          <button class="btn-action" onclick="sendAction('train_agi')">🏃 AGILIDADE (+12%)</button>
          <button class="btn-action" onclick="sendAction('train_int')">🧠 MAGIA (+12%)</button>
          <button class="btn-action" onclick="sendAction('train_vit')">❤️ DEFESA (+12%)</button>
        \`;
        addLog('Treinamento: Cooldown de 20 min. Concede buffs reais.', '#00b4d8');
      } else if (tab === 'fish') {
        document.getElementById('enemyName').innerText = 'LAGO DO REINO';
        document.getElementById('enemySprite').innerText = '🎣';
        document.getElementById('enemyHpText').innerText = 'PESCARIA';
        document.getElementById('enemyHpBar').style.width = '100%';
        controls.innerHTML = \`
          <button class="btn-action" style="background:#00b4d8;" onclick="sendAction('fish_cast')">🎣 LANÇAR ISCA (5⚡)</button>
          <button class="btn-action" style="background:#2ecc71;" onclick="sendAction('fish_reel')">🪝 PUXAR LINHA</button>
        \`;
        addLog('Pesque peixes e tesouros. Lance e aguarde 2 min para puxar.', '#00e5ff');
      } else if (tab === 'tavern') {
        document.getElementById('enemyName').innerText = 'TAVERNA DA CIDADE';
        document.getElementById('enemySprite').innerText = '🍺';
        document.getElementById('enemyHpText').innerText = 'REFEIÇÕES';
        document.getElementById('enemyHpBar').style.width = '100%';
        controls.innerHTML = \`
          <button class="btn-action" onclick="sendAction('tavern_beer')">🍺 CERVEJA (20G)</button>
          <button class="btn-action" onclick="sendAction('tavern_meal')">🍖 BANQUETE (80G)</button>
          <button class="btn-action" style="background:#f1c40f; color:#000;" onclick="sendAction('tavern_dice')">🎲 DADOS (20G)</button>
        \`;
        addLog('Taverna: Comidas, bebidas de suporte e jogo de dados.', '#ffd700');
      } else if (tab === 'boss') {
        document.getElementById('enemyName').innerText = 'DRAGÃO PRIMORDIAL';
        document.getElementById('enemySprite').innerText = '🐉';
        document.getElementById('enemyHpText').innerText = 'BOSS MUNDIAL';
        controls.innerHTML = \`
          <button class="btn-action" style="background:#e74c3c;" onclick="sendAction('boss_attack')">⚔️ ATACAR BOSS (10⚡)</button>
          <button class="btn-action" style="background:#7928ca;" onclick="loadCharacter()">🔄 ATUALIZAR HP</button>
        \`;
        addLog('World Boss da Guilda. Ataque com seus companheiros!', '#ff0055');
      }
    }

    function renderCombatControls() {
      const controls = document.getElementById('controlsGrid');
      controls.innerHTML = \`
        <button class="btn-action" onclick="sendAction('combat_attack')">⚔️ ATACAR</button>
        <button class="btn-action" style="background:#ff007f;" onclick="sendAction('combat_skill')">✨ HABILIDADE</button>
        <button class="btn-action" style="background:#3498db;" onclick="sendAction('combat_defend')">🛡️ DEFENDER</button>
        <button class="btn-action" style="background:#2ecc71;" onclick="sendAction('combat_potion')">🧪 POÇÃO</button>
        <button class="btn-action" style="background:#e74c3c;" onclick="sendAction('combat_flee')">🏃 FUGIR</button>
      \`;
    }

    async function distributePoint(statName) {
      try {
        const res = await fetch('/api/rpg/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stat: statName, points: 1 })
        });
        const data = await res.json();
        if (data.success) {
          addLog('Ponto distribuído em ' + statName + '!', '#2ecc71');
          await loadCharacter();
        } else {
          addLog(data.message || 'Sem pontos suficientes.', '#ff0055');
        }
      } catch (err) {
        addLog('Erro ao distribuir ponto.', '#ff0055');
      }
    }

    async function loadCharacter() {
      try {
        const res = await fetch('/api/rpg/data');
        const data = await res.json();
        if (!data || data.error) return;

        const char = data.char;
        const stats = data.stats;
        const loc = data.location;

        document.getElementById('charName').innerText = char.username;
        document.getElementById('charClass').innerText = 'NV.' + char.level + ' • ' + (char.class || 'GUERREIRO').toUpperCase();
        document.getElementById('goldVal').innerText = char.gold.toLocaleString('pt-BR');
        document.getElementById('strVal').innerText = stats.str;
        document.getElementById('agiVal').innerText = stats.agi;
        document.getElementById('intVal').innerText = stats.int;
        document.getElementById('vitVal').innerText = stats.vit;
        document.getElementById('luckVal').innerText = stats.lck;
        document.getElementById('statPointsVal').innerText = char.statPoints;

        const hasPoints = char.statPoints > 0;
        ['btnStr','btnAgi','btnInt','btnVit','btnLuck'].forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.style.display = hasPoints ? 'inline-block' : 'none';
        });

        // Barras do Personagem
        document.getElementById('hpText').innerText = char.currentHp + '/' + stats.maxHp;
        document.getElementById('hpBar').style.width = Math.max(0, Math.min(100, (char.currentHp / stats.maxHp) * 100)) + '%';

        document.getElementById('energyText').innerText = char.currentEnergy + '/' + stats.maxEnergy;
        document.getElementById('energyBar').style.width = Math.max(0, Math.min(100, (char.currentEnergy / stats.maxEnergy) * 100)) + '%';

        const xpMax = data.xpNeeded || 100;
        document.getElementById('xpText').innerText = char.xp + '/' + xpMax;
        document.getElementById('xpBar').style.width = Math.max(0, Math.min(100, (char.xp / xpMax) * 100)) + '%';

        if (loc) {
          document.getElementById('locationName').innerText = '📍 LOCAL: ' + loc.name.toUpperCase();
        }

        // Atualiza Arena se estiver em combate ativo
        if (data.combat) {
          inBattle = true;
          document.getElementById('enemyName').innerText = data.combat.enemyName.toUpperCase();
          document.getElementById('enemySprite').innerText = data.combat.enemyEmoji || '👹';
          document.getElementById('enemyHpText').innerText = 'HP: ' + data.combat.enemyHp + '/' + data.combat.enemyMaxHp;
          document.getElementById('enemyHpBar').style.width = Math.max(0, Math.min(100, (data.combat.enemyHp / data.combat.enemyMaxHp) * 100)) + '%';
          if (currentTab === 'dungeon') renderCombatControls();
        } else {
          inBattle = false;
        }

        // Atualiza Cooldowns
        if (data.cooldowns) {
          document.getElementById('cdDungeon').innerText = data.cooldowns.dungeon || 'Pronto';
          document.getElementById('cdExplore').innerText = data.cooldowns.explore || 'Pronto';
          document.getElementById('cdTrain').innerText = data.cooldowns.train || 'Pronto';
          document.getElementById('cdFish').innerText = data.cooldowns.fishing || 'Pronto';
        }
      } catch (err) {
        console.error('Erro ao carregar dados do RPG:', err);
      }
    }

    async function sendAction(actionType) {
      try {
        const res = await fetch('/api/rpg/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: actionType })
        });
        const data = await res.json();

        if (data.message) {
          addLog(data.message, data.success ? '#ffd700' : '#ff0055');
        }

        if (data.combatFinished) {
          inBattle = false;
          switchGameTab(currentTab);
        }

        await loadCharacter();
      } catch (err) {
        addLog('Erro ao comunicar com o servidor RPG.', '#ff0055');
      }
    }

    window.onload = () => {
      loadCharacter();
      setInterval(loadCharacter, 15000);
    };
  </script>
</body>
</html>`);
  });

  // ─── APIS REAIS CONECTADAS AO BACKEND DO BOT RPG ──────────────────────────
  app.get('/api/rpg/data', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    const userName = req.cookies?.skyline_username || 'Aventureiro';
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    try {
      const char = await getOrCreateCharacter(userId, userName);
      const stats = computeStats(char);
      const loc = getLocation(char.currentLocation);
      const xpNeeded = rpgXpForLevel(char.level);

      const calcCd = (date: Date | null, mins: number) => {
        if (!date) return 'Pronto';
        const rem = mins * 60000 - (Date.now() - date.getTime());
        if (rem <= 0) return 'Pronto';
        const m = Math.floor(rem / 60000);
        const s = Math.ceil((rem % 60000) / 1000);
        return `${m}m ${s}s`;
      };

      const cooldowns = {
        dungeon: calcCd(char.lastDungeon, 5),
        explore: calcCd(char.lastExplore, 3),
        train: calcCd(char.lastTrain, 20),
        fishing: calcCd(char.lastFishing, 10),
      };

      res.json({ char, stats, location: loc, xpNeeded, cooldowns });
    } catch (err) {
      console.error('[API RPG Data]:', err);
      res.status(500).json({ error: 'Erro ao carregar dados do RPG.' });
    }
  });

  app.post('/api/rpg/distribute', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });
    const { stat, points } = req.body;

    try {
      const result = await distributeStatPoints(userId, stat, points || 1);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro ao distribuir pontos.' });
    }
  });

  app.post('/api/rpg/action', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    const userName = req.cookies?.skyline_username || 'Aventureiro';
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });
    const { action } = req.body;

    try {
      let char = await getOrCreateCharacter(userId, userName);

      // 1. INICIAR COMBATE
      if (action === 'combat_start') {
        const loc = getLocation(char.currentLocation);
        const enemies = getEnemiesForLocation(loc.id, char.level);
        if (enemies.length === 0) return res.json({ success: false, message: 'Nenhum monstro disponível nesta região.' });
        const enemy = enemies[0];

        try {
          const turn = await startInteractiveCombat(char, enemy, '', 'hunt');
          return res.json({
            success: true,
            message: `⚔️ Batalha iniciada contra ${enemy.name}!`,
            combat: {
              enemyName: turn.enemyName,
              enemyEmoji: turn.enemyEmoji,
              enemyHp: turn.enemyHp,
              enemyMaxHp: turn.enemyMaxHp,
            }
          });
        } catch (err: any) {
          return res.json({ success: false, message: err.message || 'Erro ao iniciar combate.' });
        }
      }

      // 2. EXECUTAR TURNOS DE COMBATE
      if (action.startsWith('combat_')) {
        const combatAction = action.replace('combat_', '') as 'attack' | 'skill' | 'defend' | 'potion' | 'flee';
        try {
          const turn = await takeCombatAction(userId, combatAction);
          const lastLog = turn.log.slice(-2).join(' ');

          if (turn.finished) {
            return res.json({
              success: turn.result?.result === 'vitoria',
              message: lastLog,
              combatFinished: true,
            });
          }

          return res.json({
            success: true,
            message: lastLog,
            combat: {
              enemyName: turn.enemyName,
              enemyEmoji: turn.enemyEmoji,
              enemyHp: turn.enemyHp,
              enemyMaxHp: turn.enemyMaxHp,
            }
          });
        } catch (err: any) {
          return res.json({ success: false, message: err.message || 'Erro no turno de combate.' });
        }
      }

      // 3. EXPLORAÇÃO
      if (action === 'explore') {
        const result = await doExplore(char);
        return res.json({ success: result.success, message: result.message || 'Exploração concluída!' });
      }

      // 4. TREINAMENTO
      if (action.startsWith('train_')) {
        const statId = action.replace('train_', '');
        const result = await doTrain(char, statId);
        return res.json(result);
      }

      // 5. PESCARIA
      if (action === 'fish_cast') {
        const result = await castFishingLine(char);
        return res.json(result);
      }

      if (action === 'fish_reel') {
        const result = await reelFishingLine(char);
        return res.json({ success: result.success, message: result.message || 'Você puxou a linha de pesca!' });
      }

      // 6. TAVERNA
      if (action === 'tavern_beer' || action === 'tavern_meal') {
        const itemId = action === 'tavern_beer' ? 'cerveja' : 'banquete';
        const result = await buyTavernaItem(char, itemId);
        return res.json(result);
      }

      if (action === 'tavern_dice') {
        const result = await rollTavernaDice(char);
        return res.json({ success: true, message: result.embed.data.description || 'Jogo de dados finalizado!' });
      }

      // 7. CURANDEIRO
      if (action === 'heal_rest') {
        const stats = computeStats(char);
        const hpMissing = stats.maxHp - char.currentHp;
        const enMissing = stats.maxEnergy - char.currentEnergy;
        const cost = Math.max(5, Math.ceil(hpMissing * 0.12 + enMissing * 0.08));

        if (hpMissing === 0 && enMissing === 0) {
          return res.json({ success: true, message: '🏥 Você já está com HP e Energia 100% cheios!' });
        }
        if (char.gold < cost) {
          return res.json({ success: false, message: `🏥 Ouro insuficiente! Curar custa ${cost}G e você tem ${char.gold}G.` });
        }

        await prisma.rpgCharacter.update({
          where: { discordId: userId },
          data: { currentHp: stats.maxHp, currentEnergy: stats.maxEnergy, gold: { decrement: cost }, lastRest: new Date() }
        });
        return res.json({ success: true, message: `❤️ Você foi curado na cidade por ${cost}G! HP e Energia 100% restaurados.` });
      }

      // 8. FORJA
      if (action === 'forge_iron_sword') {
        const result = await craftItem(userId, 'craft_espada_ferro');
        return res.json(result);
      }

      // 9. ITENS & INVENTÁRIO
      if (action === 'use_potion') {
        const result = await useConsumable(userId, 'pocao_de_vida_p');
        return res.json(result);
      }

      if (action === 'sell_iron') {
        const result = await sellItem(userId, 'minerio_de_ferro', 1);
        return res.json(result);
      }

      res.json({ success: true, message: 'Ação executada.' });
    } catch (err) {
      console.error('[API RPG Action]:', err);
      res.status(500).json({ success: false, message: 'Erro ao executar ação de RPG.' });
    }
  });

  // ─── ROTAS DE AUTENTICAÇÃO E PAINEL RESTANTES ───────────────────────────
  app.get('/login', (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(dashboardUrl + '/auth/callback')}&response_type=code&scope=identify`);
  });

  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.send('Código não fornecido.');

    try {
      const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: clientId!, client_secret: clientSecret!, grant_type: 'authorization_code', code, redirect_uri: `${dashboardUrl}/auth/callback`,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } });
      const { id: userId, username } = userRes.data;
      
      const isBotOwner = userId === BOT_OWNER_ID;
      const userRoles = await prisma.allianceServerMember.findMany({ where: { userId } });

      if (!isBotOwner && userRoles.length === 0) return res.status(403).send('<body style="background: #0b0a0f; color: #ed4245; text-align: center; padding-top: 150px; font-family: sans-serif;"><h1>🛑 Acesso Negado</h1><p style="color:white;">Sem credenciais ativas na Aliança.</p><br><a href="/" style="color: #b388eb; font-weight: bold;">Voltar</a></body>');

      res.cookie('skyline_auth', 'permitido', { maxAge: 86400000 }); 
      res.cookie('skyline_userid', userId, { maxAge: 86400000 }); 
      res.cookie('skyline_username', username, { maxAge: 86400000 }); 
      res.redirect('/painel');
    } catch (error) { res.status(500).send('Erro na autenticação.'); }
  });

  app.get('/api/config', async (req, res) => {
    const { guildId } = req.query;
    const userId = req.cookies?.skyline_userid;
    if (!userId || !guildId) return res.status(401).json({ error: 'Não autorizado' });

    const hasAccess = await validateGuildAccess(userId, String(guildId));
    if (!hasAccess) return res.status(403).json({ error: 'Você não tem permissão para gerenciar este servidor.' });

    try {
      let serverConfig = await prisma.guildConfig.findUnique({ where: { guildId: String(guildId) } });
      if (!serverConfig) serverConfig = await prisma.guildConfig.create({ data: { guildId: String(guildId) } });

      let globalConfig = null;
      if (userId === BOT_OWNER_ID) {
        globalConfig = await prisma.botConfig.findUnique({ where: { id: 'global' } });
        if (!globalConfig) globalConfig = await prisma.botConfig.create({ data: { id: 'global' } });
      }

      res.json({ serverConfig, globalConfig, isOwner: userId === BOT_OWNER_ID });
    } catch (error) { res.status(500).json({ error: 'Erro no BD' }); }
  });

  app.post('/api/toggle', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { type, guildId, feature, state } = req.body;

    if (type === 'global' && userId !== BOT_OWNER_ID) {
      return res.status(403).json({ error: 'Apenas o Dono pode alterar configurações globais.' });
    }

    if (type === 'server') {
      const hasAccess = await validateGuildAccess(userId, guildId);
      if (!hasAccess) return res.status(403).json({ error: 'Acesso negado para este servidor.' });
    }

    try {
      if (type === 'server') await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: state } });
      else if (type === 'global') await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: state } });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar.' }); }
  });

  app.post('/api/update', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { type, guildId, feature, value, valueType } = req.body;

    if (type === 'global' && userId !== BOT_OWNER_ID) {
      return res.status(403).json({ error: 'Apenas o Dono pode alterar configurações globais.' });
    }

    if (type === 'server') {
      const hasAccess = await validateGuildAccess(userId, guildId);
      if (!hasAccess) return res.status(403).json({ error: 'Acesso negado para este servidor.' });
    }

    let finalValue: string | number | null = value;

    if (valueType === 'color') {
      if (typeof value === 'string' && value.startsWith('#')) {
        const hex = value.replace('#', '');
        const parsed = parseInt(hex, 16);
        finalValue = isNaN(parsed) ? 14757996 : parsed;
      } else if (typeof value === 'number') {
        finalValue = value;
      } else {
        finalValue = parseInt(value, 10) || 14757996;
      }
    } else if (valueType === 'number') {
      finalValue = parseInt(value, 10);
      if (isNaN(finalValue)) finalValue = 0;
    } else if (value === "" || value === null || value === undefined) {
      finalValue = null;
    }

    if (feature === 'primaryColor' && (finalValue === null || isNaN(Number(finalValue)))) finalValue = 10180278;
    if (feature === 'feedEmbedColor' && (finalValue === null || isNaN(Number(finalValue)))) finalValue = 14757996;

    try {
      if (type === 'server') await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: finalValue } });
      else if (type === 'global') await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: finalValue } });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar dado.' }); }
  });

  // ─── PAINEL DE CONTROLE ──────────────────────────────────────────────────
  app.get('/painel', async (req, res) => {
    if (req.cookies?.skyline_auth !== 'permitido') return res.redirect('/');
    const userId = req.cookies?.skyline_userid;
    const userName = req.cookies?.skyline_username || 'Administrador';

    let authorizedServers = [];
    if (userId === BOT_OWNER_ID) {
      authorizedServers = await prisma.allianceServer.findMany();
    } else {
      const memberRecords = await prisma.allianceServerMember.findMany({ where: { userId }, include: { server: true } });
      authorizedServers = memberRecords.map(record => record.server).filter(s => s !== null);
    }

    const serverOptionsHTML = authorizedServers.length > 0 
      ? authorizedServers.map(s => `<option value="${s.guildId}">${s.guildName || s.guildId}</option>`).join('')
      : `<option disabled>Nenhum servidor encontrado</option>`;

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bryan Dashboard — Painel de Controle</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090710;
      --sidebar: #0f0c18;
      --card-bg: rgba(22, 17, 34, 0.7);
      --card-hover: rgba(30, 23, 46, 0.9);
      --border: rgba(168, 85, 247, 0.2);
      --border-glow: rgba(192, 132, 252, 0.5);
      --primary: #8b5cf6;
      --accent: #e1306c;
      --text: #f1edfa;
      --text-muted: #9f93b2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex; height: 100vh; overflow: hidden;
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.4); border-radius: 4px; }

    .sidebar {
      width: 320px; background-color: var(--sidebar);
      display: flex; flex-direction: column;
      border-right: 1px solid var(--border);
      z-index: 20; position: relative;
    }
    .sidebar-header {
      padding: 35px 25px 20px 25px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(20, 14, 32, 0.9) 0%, var(--sidebar) 100%);
    }
    .sidebar-header h2 {
      font-size: 20px; font-weight: 900; letter-spacing: 0.5px;
      background: linear-gradient(135deg, #fff 0%, #c084fc 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 4px;
    }
    .sidebar-header p { font-size: 11px; font-weight: 700; color: #7c6f8f; text-transform: uppercase; letter-spacing: 1.5px; }

    .user-card {
      margin: 20px 20px 10px 20px; padding: 14px 16px;
      background: rgba(28, 21, 44, 0.6);
      border: 1px solid var(--border);
      border-radius: 14px; display: flex; align-items: center; gap: 14px;
    }
    .user-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      border: 2px solid var(--primary);
      box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
      background: url('/skylineicon.jpg') center/cover;
    }
    .user-meta .name { font-weight: 800; font-size: 14px; color: white; }
    .user-meta .badge {
      font-size: 11px; font-weight: 700; color: #c084fc;
      background: rgba(139, 92, 246, 0.2); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 2px;
    }

    .server-box { padding: 15px 20px 20px 20px; }
    .server-box label { font-size: 11px; font-weight: 800; color: #8a7c9f; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: block; }
    .server-box select {
      width: 100%; padding: 14px;
      background: #191426; color: #ffffff;
      border: 1px solid var(--border); border-radius: 10px;
      font-weight: 700; font-size: 14px; outline: none; cursor: pointer; transition: 0.3s;
    }

    .content-area {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
      background: radial-gradient(circle at 90% 10%, rgba(139, 92, 246, 0.12) 0%, transparent 60%);
    }
    .topbar {
      padding: 20px 45px; display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--border); background: rgba(12, 9, 20, 0.7); backdrop-filter: blur(15px);
    }
    .nav-tabs { display: flex; gap: 12px; }
    .tab-btn {
      background: transparent; border: 1px solid transparent; color: var(--text-muted);
      padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.25s;
    }
    .tab-btn:hover { color: white; background: rgba(139, 92, 246, 0.1); }
    .tab-btn.active {
      color: white; background: rgba(139, 92, 246, 0.25);
      border-color: rgba(192, 132, 252, 0.4);
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
    }

    .search-input {
      padding: 10px 18px; background: #161222; border: 1px solid var(--border);
      border-radius: 10px; color: white; outline: none; font-size: 13px; width: 240px; transition: 0.3s;
    }
    .search-input:focus { border-color: var(--primary); box-shadow: 0 0 15px rgba(139,92,246,0.3); width: 280px; }

    .main-scroll { flex: 1; overflow-y: auto; padding: 35px 45px 80px 45px; }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; animation: fadeIn 0.35s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    .category-title {
      font-size: 1.15rem; font-weight: 800; color: white;
      margin: 35px 0 18px 0; display: flex; align-items: center; gap: 10px;
    }
    .category-title:first-child { margin-top: 0; }
    .category-desc { font-size: 13px; color: #8e80a3; margin-top: -12px; margin-bottom: 20px; }

    .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
    
    .mod-card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 16px; padding: 22px; display: flex; justify-content: space-between; align-items: center;
      backdrop-filter: blur(10px); transition: all 0.25s;
    }
    .mod-card:hover {
      background: var(--card-hover); border-color: var(--border-glow);
      transform: translateY(-3px); box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }
    .mod-info { display: flex; gap: 15px; align-items: center; max-width: 75%; }
    .mod-icon {
      width: 42px; height: 42px; border-radius: 12px;
      background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(192, 132, 252, 0.3);
      display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
    }
    .mod-text h3 { font-size: 14.5px; font-weight: 800; color: white; margin-bottom: 4px; }
    .mod-text p { font-size: 12px; color: var(--text-muted); line-height: 1.4; }

    .switch { position: relative; width: 48px; height: 26px; flex-shrink: 0; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
      background-color: #1f1a2d; transition: 0.3s; border-radius: 34px; border: 1px solid #4a3b66;
    }
    .slider:before {
      position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
      background-color: #9f91b5; transition: 0.3s; border-radius: 50%;
    }
    input:checked + .slider { background-color: #8b5cf6; border-color: #c084fc; box-shadow: 0 0 15px rgba(139, 92, 246, 0.6); }
    input:checked + .slider:before { transform: translateX(22px); background-color: white; }

    .set-card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 12px;
      backdrop-filter: blur(10px); transition: 0.25s;
    }
    .set-card:hover { border-color: var(--border-glow); transform: translateY(-2px); }
    .set-card label { font-size: 13.5px; font-weight: 800; color: white; display: flex; justify-content: space-between; }
    
    .input-row { display: flex; gap: 10px; align-items: center; }
    .input-row input[type="text"], .input-row input[type="number"] {
      flex: 1; background: #161222; border: 1px solid var(--border);
      color: white; padding: 12px 14px; border-radius: 10px; outline: none; font-size: 13.5px;
      font-family: 'JetBrains Mono', monospace; transition: 0.3s;
    }
    .input-row textarea {
      flex: 1; background: #161222; border: 1px solid var(--border);
      color: white; padding: 14px; border-radius: 10px; outline: none; font-size: 13.5px;
      min-height: 90px; font-family: inherit; resize: vertical; transition: 0.3s;
    }
    .color-preview-box {
      width: 46px; height: 44px; border-radius: 10px; border: 1px solid var(--border);
      cursor: pointer; padding: 0; background: #161222; overflow: hidden; flex-shrink: 0;
    }
    .color-preview-box input[type="color"] {
      width: 200%; height: 200%; transform: translate(-25%, -25%);
      cursor: pointer; border: none; outline: none;
    }
    
    .tag-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .chip {
      background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(192, 132, 252, 0.3);
      color: #c084fc; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;
      cursor: pointer; transition: 0.2s; font-family: 'JetBrains Mono', monospace;
    }
    .chip:hover { background: var(--primary); color: white; }

    .btn-save {
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      border: none; color: white; padding: 12px 20px; border-radius: 10px;
      cursor: pointer; font-weight: 800; font-size: 12.5px; letter-spacing: 0.5px;
      transition: 0.25s; display: flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0;
    }
    .btn-save:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(139, 92, 246, 0.6); }

    #toast {
      visibility: hidden; min-width: 280px; background: rgba(18, 14, 28, 0.95);
      color: #ffffff; border: 1px solid var(--primary);
      text-align: center; border-radius: 12px; padding: 16px 24px;
      position: fixed; right: 35px; bottom: 35px; font-weight: 800; font-size: 14px;
      opacity: 0; transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 9999; box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 25px rgba(139, 92, 246, 0.4);
      backdrop-filter: blur(15px); display: flex; align-items: center; gap: 10px; justify-content: center;
    }
    #toast.show { visibility: visible; opacity: 1; transform: translateY(-10px); }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>Bryan Dashboard</h2>
      <p>Painel de Controle • Skyline</p>
    </div>

    <div class="user-card">
      <div class="user-avatar"></div>
      <div class="user-meta">
        <div class="name">${userName}</div>
        <div class="badge">${userId === BOT_OWNER_ID ? '👑 Dono do Bot' : '🛡️ Administrador'}</div>
      </div>
    </div>

    <div class="server-box">
      <label>Selecionar Servidor</label>
      <select id="serverSelect" onchange="loadConfig()">${serverOptionsHTML}</select>
    </div>
  </div>

  <div class="content-area">
    <div class="topbar">
      <div class="nav-tabs">
        <button class="tab-btn active" onclick="switchTab('tab_modulos', this)">🧩 Módulos (Liga/Desliga)</button>
        <button class="tab-btn" onclick="switchTab('tab_configs', this)">⚙️ Configurações & Canais</button>
      </div>
      <input type="text" class="search-input" id="filterInput" placeholder="🔍 Filtrar configurações..." oninput="filterCards()">
    </div>

    <div class="main-scroll">
      <div id="tab_modulos" class="tab-pane active">
        <div id="serverModulesArea">Carregando módulos...</div>
        ${userId === BOT_OWNER_ID ? `<div id="globalModulesArea" style="margin-top: 40px;"></div>` : ''}
      </div>

      <div id="tab_configs" class="tab-pane">
        <div id="serverSettingsArea">Carregando configurações...</div>
        ${userId === BOT_OWNER_ID ? `<div id="globalSettingsArea" style="margin-top: 40px;"></div>` : ''}
      </div>
    </div>
  </div>

  <div id="toast">Ação concluída com sucesso!</div>

  <script>
    const SERVER_CATEGORIES = ${JSON.stringify(SERVER_CATEGORIES)};
    const GLOBAL_CATEGORIES = ${JSON.stringify(GLOBAL_CATEGORIES)};
    const SERVER_SETTINGS = ${JSON.stringify(SERVER_SETTINGS)};
    const GLOBAL_SETTINGS = ${JSON.stringify(GLOBAL_SETTINGS)};

    function intToHex(num, fallback = '#8B5CF6') {
      if (num === null || num === undefined || isNaN(num)) return fallback;
      return '#' + num.toString(16).padStart(6, '0');
    }

    function switchTab(tabId, btn) {
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      btn.classList.add('active');
    }

    function insertTag(inputId, tag) {
      const el = document.getElementById(inputId);
      if (!el) return;
      el.value += tag;
      el.focus();
    }

    async function loadConfig() {
      const guildId = document.getElementById('serverSelect').value;
      if (!guildId) return;

      const res = await fetch('/api/config?guildId=' + guildId);
      const data = await res.json();

      renderModules('serverModulesArea', SERVER_CATEGORIES, data.serverConfig, 'server');
      renderSettings('serverSettingsArea', SERVER_SETTINGS, data.serverConfig, 'server');

      if (data.isOwner) {
        renderModules('globalModulesArea', GLOBAL_CATEGORIES, data.globalConfig, 'global', '👑 Master Switches Globais (Apenas Bryan)');
        renderSettings('globalSettingsArea', GLOBAL_SETTINGS, data.globalConfig, 'global', '👑 Identidade Visual Global (Apenas Bryan)');
      }
    }

    function renderModules(containerId, categories, dbData, type, customTitle = null) {
      const container = document.getElementById(containerId);
      if (!container) return;

      let html = '';
      if (customTitle) {
        html += '<div class="category-title" style="color: #c084fc; font-size: 1.3rem;">' + customTitle + '</div>';
      }

      categories.forEach(cat => {
        html += '<div class="category-title">' + cat.category + '</div>';
        if (cat.desc) html += '<div class="category-desc">' + cat.desc + '</div>';
        html += '<div class="grid-cards">';

        cat.features.forEach(feat => {
          const checked = dbData && dbData[feat.id] ? 'checked' : '';
          const icon = feat.icon || '✨';
          html += '<div class="mod-card search-card" data-title="' + feat.name.toLowerCase() + '">' +
                    '<div class="mod-info">' +
                      '<div class="mod-icon">' + icon + '</div>' +
                      '<div class="mod-text"><h3>' + feat.name + '</h3><p>' + feat.desc + '</p></div>' +
                    '</div>' +
                    '<label class="switch">' +
                      '<input type="checkbox" ' + checked + ' onchange="toggleFeature(\\'' + type + '\\', \\'' + feat.id + '\\', this.checked)">' +
                      '<span class="slider"></span>' +
                    '</label>' +
                  '</div>';
        });

        html += '</div>';
      });

      container.innerHTML = html;
    }

    function renderSettings(containerId, categories, dbData, type, customTitle = null) {
      const container = document.getElementById(containerId);
      if (!container) return;

      let html = '';
      if (customTitle) {
        html += '<div class="category-title" style="color: #c084fc; font-size: 1.3rem;">' + customTitle + '</div>';
      }

      categories.forEach(cat => {
        html += '<div class="category-title">' + cat.category + '</div>';
        if (cat.desc) html += '<div class="category-desc">' + cat.desc + '</div>';
        html += '<div class="grid-cards">';

        cat.items.forEach(item => {
          const inputId = 'input_' + type + '_' + item.id;
          const rawVal = dbData ? dbData[item.id] : null;

          if (item.type === 'color') {
            const hexColor = intToHex(rawVal, item.id === 'primaryColor' ? '#8B5CF6' : '#E1306C');
            html += '<div class="set-card search-card" data-title="' + item.name.toLowerCase() + '">' +
                      '<label><span>' + item.name + '</span><span style="color:#c084fc; font-family:monospace;">' + hexColor + '</span></label>' +
                      '<div class="input-row">' +
                        '<div class="color-preview-box"><input type="color" value="' + hexColor + '" oninput="document.getElementById(\\'' + inputId + '\\').value = this.value"></div>' +
                        '<input type="text" id="' + inputId + '" value="' + hexColor + '">' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'color\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          } else if (item.type === 'textarea') {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="set-card search-card" style="grid-column: 1 / -1;" data-title="' + item.name.toLowerCase() + '">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-row" style="flex-direction: column;">' +
                        '<textarea id="' + inputId + '" placeholder="' + item.placeholder + '">' + val + '</textarea>' +
                        '<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 6px;">' +
                          '<div class="tag-chips">' +
                            '<span class="chip" onclick="insertTag(\\'' + inputId + '\\', \\'{user}\\')">+{user}</span>' +
                            '<span class="chip" onclick="insertTag(\\'' + inputId + '\\', \\'{guild}\\')">+{guild}</span>' +
                          '</div>' +
                          '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'text\\')">Salvar Mensagem</button>' +
                        '</div>' +
                      '</div>' +
                    '</div>';
          } else {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="set-card search-card" data-title="' + item.name.toLowerCase() + '">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-row">' +
                        '<input type="' + item.type + '" id="' + inputId + '" placeholder="' + item.placeholder + '" value="' + val + '">' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'' + item.type + '\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          }
        });

        html += '</div>';
      });

      container.innerHTML = html;
    }

    async function toggleFeature(type, feature, state) {
      const guildId = document.getElementById('serverSelect').value;
      const res = await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, guildId, feature, state })
      });
      res.ok ? showToast('✅ Módulo atualizado!') : showToast('❌ Falha ao salvar módulo.', true);
    }

    async function saveSetting(type, feature, inputId, valueType) {
      const guildId = document.getElementById('serverSelect').value;
      const value = document.getElementById(inputId).value;
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, guildId, feature, value, valueType })
      });
      res.ok ? showToast('💾 Configuração salva com sucesso!') : showToast('❌ Erro ao salvar.', true);
    }

    function filterCards() {
      const q = document.getElementById('filterInput').value.toLowerCase();
      document.querySelectorAll('.search-card').forEach(card => {
        const title = card.getAttribute('data-title') || '';
        card.style.display = title.includes(q) ? 'flex' : 'none';
      });
    }

    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.style.borderColor = isError ? '#ed4245' : '#8b5cf6';
      toast.className = 'show';
      setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
    }

    window.onload = loadConfig;
  </script>
</body>
</html>`);
  });

  app.listen(port, '0.0.0.0', () => console.log(`🌐 Dashboard Web rodando na porta ${port}`));
}
