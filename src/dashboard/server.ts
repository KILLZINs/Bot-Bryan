# Let's test the entire complete server.ts code in Python to guarantee 0 syntax errors or unclosed brackets.
loritta_dashboard_code = r'''import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma } from '../database/client';

const BOT_OWNER_ID = '1195254699943796791';

async function validateGuildAccess(userId: string, guildId: string): Promise<boolean> {
  if (userId === BOT_OWNER_ID) return true;
  const access = await prisma.allianceServerMember.findFirst({
    where: { userId, guildId }
  });
  return !!access;
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
  <title>Bryan Bot — Ecossistema Discord & IA de Voz</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
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
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1;
      background:
        radial-gradient(circle at 12% 18%, rgba(139, 92, 246, 0.25) 0%, transparent 40%),
        radial-gradient(circle at 88% 82%, rgba(225, 48, 108, 0.2) 0%, transparent 45%),
        linear-gradient(180deg, #090710 0%, #050408 100%);
    }
    nav {
      display: flex; justify-content: space-between; align-items: center;
      padding: 18px 8%; background: rgba(9, 7, 16, 0.85);
      backdrop-filter: blur(20px); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
    }
    .brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: white; }
    .brand img {
      width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--primary);
      box-shadow: 0 0 20px var(--primary-glow); object-fit: cover;
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
      transition: all 0.3s ease; cursor: pointer; letter-spacing: 0.5px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      color: white; box-shadow: 0 0 25px rgba(124, 58, 237, 0.5);
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(168, 85, 247, 0.8); }
    .btn-invite {
      background: linear-gradient(135deg, #5865f2 0%, #4752c4 100%);
      color: white;
    }
    .btn-invite:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(88, 101, 242, 0.7); }
    .hero {
      text-align: center; padding: 85px 8% 50px 8%; max-width: 1200px; margin: 0 auto;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 10px; padding: 8px 24px;
      background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(192, 132, 252, 0.4);
      border-radius: 50px; font-size: 13px; font-weight: 800; color: #e0c3fc;
      margin-bottom: 25px; box-shadow: 0 0 25px rgba(139, 92, 246, 0.3);
      text-transform: uppercase; letter-spacing: 1px;
    }
    .hero h1 { font-size: clamp(2.4rem, 5vw, 4.3rem); font-weight: 900; line-height: 1.15; margin-bottom: 25px; }
    .gradient-text {
      background: linear-gradient(135deg, #ffffff 20%, #c77dff 60%, #e1306c 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero p { font-size: 1.15rem; color: #b3a7c6; max-width: 800px; margin: 0 auto 40px auto; }
    .hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    footer {
      border-top: 1px solid var(--border); padding: 40px 8%;
      text-align: center; color: #786b8c; font-size: 14px; background: #050408;
    }
    footer a { color: #c084fc; text-decoration: none; font-weight: 600; }
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
      <a href="${botInviteUrl}" target="_blank" class="btn btn-invite"><span>➕ Adicionar Bot</span></a>
      <a href="/login" class="btn btn-primary"><span>⚡ Painel Web</span></a>
    </div>
  </nav>

  <section class="hero">
    <div class="hero-badge">🎙️ Síntese de Voz com IA & Feed Social Integrado</div>
    <h1>Potencialize seu servidor com <span class="gradient-text">Recursos de Elite</span></h1>
    <p>O Bryan Bot reúne conversação inteligente por voz nos canais, feed social estilo Instagram, ecossistema RPG completo no Discord, tickets e moderação blindada.</p>
    <div class="hero-actions">
      <a href="${botInviteUrl}" target="_blank" class="btn btn-invite" style="padding: 16px 36px; font-size: 16px;"><span>➕ Adicionar ao Discord</span></a>
      <a href="/login" class="btn btn-primary" style="padding: 16px 36px; font-size: 16px;"><span>⚙️ Acessar Dashboard</span></a>
    </div>
  </section>

  <footer>
    <p>© 2026 <strong>Bryan Bot</strong> • Desenvolvido para a <strong>Aliança Skyline</strong>.</p>
  </footer>
</body>
</html>`);
  });

  // ─── AUTENTICAÇÃO OAUTH2 ──────────────────────────────────────────────────
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

      if (!isBotOwner && userRoles.length === 0) {
        return res.status(403).send('<body style="background: #0b0a0f; color: #ed4245; text-align: center; padding-top: 150px; font-family: sans-serif;"><h1>🛑 Acesso Negado</h1><p style="color:white;">Sem credenciais ativas na Aliança.</p><br><a href="/" style="color: #b388eb; font-weight: bold;">Voltar</a></body>');
      }

      res.cookie('skyline_auth', 'permitido', { maxAge: 86400000 }); 
      res.cookie('skyline_userid', userId, { maxAge: 86400000 }); 
      res.cookie('skyline_username', username, { maxAge: 86400000 }); 
      res.redirect('/painel');
    } catch (error) { res.status(500).send('Erro na autenticação.'); }
  });

  // ─── APIS DE CONFIGURAÇÃO COM SEGURANÇA ──────────────────────────────────
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

  // ─── PAINEL DE CONTROLE (ORGANIZAÇÃO MODULAR ESTILO LORITTA) ───────────────
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
      --card-bg: rgba(22, 17, 34, 0.75);
      --card-hover: rgba(30, 23, 46, 0.95);
      --border: rgba(168, 85, 247, 0.2);
      --border-glow: rgba(192, 132, 252, 0.5);
      --primary: #8b5cf6;
      --primary-gradient: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      --accent: #e1306c;
      --green: #2ecc71;
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

    /* SIDEBAR MODULAR ESTILO LORITTA */
    .sidebar {
      width: 320px; background-color: var(--sidebar);
      display: flex; flex-direction: column;
      border-right: 1px solid var(--border);
      z-index: 20; position: relative; flex-shrink: 0;
    }
    .sidebar-header {
      padding: 30px 24px 20px 24px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(20, 14, 32, 0.9) 0%, var(--sidebar) 100%);
    }
    .sidebar-header h2 {
      font-size: 18px; font-weight: 900; letter-spacing: 0.5px;
      background: linear-gradient(135deg, #fff 0%, #c084fc 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 2px;
    }
    .sidebar-header p { font-size: 10.5px; font-weight: 700; color: #7c6f8f; text-transform: uppercase; letter-spacing: 1.5px; }

    .user-card {
      margin: 15px 18px 8px 18px; padding: 12px 14px;
      background: rgba(28, 21, 44, 0.6);
      border: 1px solid var(--border);
      border-radius: 12px; display: flex; align-items: center; gap: 12px;
    }
    .user-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      border: 2px solid var(--primary);
      box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
      background: url('/skylineicon.jpg') center/cover;
    }
    .user-meta .name { font-weight: 800; font-size: 13.5px; color: white; }
    .user-meta .badge {
      font-size: 10.5px; font-weight: 700; color: #c084fc;
      background: rgba(139, 92, 246, 0.2); padding: 2px 6px; border-radius: 4px; display: inline-block;
    }

    .server-box { padding: 12px 18px; }
    .server-box label { font-size: 10.5px; font-weight: 800; color: #8a7c9f; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; display: block; }
    .server-box select {
      width: 100%; padding: 12px;
      background: #191426; color: #ffffff;
      border: 1px solid var(--border); border-radius: 8px;
      font-weight: 700; font-size: 13px; outline: none; cursor: pointer; transition: 0.3s;
    }

    /* MENU DE NAVEGAÇÃO VERTICAL POR MÓDULOS (LORITTA STYLE) */
    .sidebar-nav {
      flex: 1; overflow-y: auto; padding: 10px 14px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .nav-cat-header {
      font-size: 10.5px; font-weight: 800; color: #6f6283;
      text-transform: uppercase; letter-spacing: 1px;
      padding: 12px 10px 4px 10px; margin-top: 6px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 14px; border-radius: 10px;
      color: var(--text-muted); font-size: 13.5px; font-weight: 700;
      cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent;
      user-select: none;
    }
    .nav-item:hover {
      color: white; background: rgba(139, 92, 246, 0.12);
    }
    .nav-item.active {
      color: white; background: rgba(139, 92, 246, 0.25);
      border-color: rgba(192, 132, 252, 0.4);
      box-shadow: 0 0 18px rgba(139, 92, 246, 0.25);
    }
    .nav-item-icon { font-size: 18px; width: 22px; text-align: center; }

    /* CONTENT AREA */
    .content-area {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
      background: radial-gradient(circle at 90% 10%, rgba(139, 92, 246, 0.1) 0%, transparent 60%);
    }
    .topbar {
      padding: 20px 40px; display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--border); background: rgba(12, 9, 20, 0.7); backdrop-filter: blur(15px);
    }
    .topbar-info h1 { font-size: 1.35rem; font-weight: 900; color: white; display: flex; align-items: center; gap: 10px; }
    .topbar-info p { font-size: 12.5px; color: var(--text-muted); margin-top: 2px; }

    .search-input {
      padding: 10px 18px; background: #161222; border: 1px solid var(--border);
      border-radius: 10px; color: white; outline: none; font-size: 13px; width: 240px; transition: 0.3s;
    }
    .search-input:focus { border-color: var(--primary); box-shadow: 0 0 15px rgba(139,92,246,0.3); width: 280px; }

    .main-scroll { flex: 1; overflow-y: auto; padding: 35px 40px 80px 40px; }

    .module-section { display: none; }
    .module-section.active { display: block; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* MASTER TOGGLE CARD (NO TOPO DO MÓDULO) */
    .master-toggle-card {
      background: linear-gradient(135deg, rgba(28, 21, 44, 0.9) 0%, rgba(18, 14, 28, 0.9) 100%);
      border: 1px solid var(--border); border-radius: 16px;
      padding: 24px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .master-toggle-info h3 { font-size: 16px; font-weight: 800; color: white; margin-bottom: 4px; }
    .master-toggle-info p { font-size: 13px; color: var(--text-muted); }

    /* GRID & SETTING CARDS */
    .grid-settings { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; }
    .set-card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 14px; padding: 22px; display: flex; flex-direction: column; gap: 12px;
      backdrop-filter: blur(10px); transition: 0.2s;
    }
    .set-card:hover { border-color: var(--border-glow); }
    .set-card label { font-size: 13px; font-weight: 800; color: white; display: flex; justify-content: space-between; }
    
    .input-row { display: flex; gap: 10px; align-items: center; }
    .input-row input[type="text"], .input-row input[type="number"] {
      flex: 1; background: #161222; border: 1px solid var(--border);
      color: white; padding: 12px 14px; border-radius: 8px; outline: none; font-size: 13.5px;
      font-family: 'JetBrains Mono', monospace; transition: 0.25s;
    }
    .input-row textarea {
      flex: 1; background: #161222; border: 1px solid var(--border);
      color: white; padding: 14px; border-radius: 8px; outline: none; font-size: 13.5px;
      min-height: 100px; font-family: inherit; resize: vertical; transition: 0.25s;
    }
    .color-box {
      width: 44px; height: 42px; border-radius: 8px; border: 1px solid var(--border);
      cursor: pointer; padding: 0; background: #161222; overflow: hidden; flex-shrink: 0;
    }
    .color-box input[type="color"] {
      width: 200%; height: 200%; transform: translate(-25%, -25%);
      cursor: pointer; border: none; outline: none;
    }

    .tag-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .chip {
      background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(192, 132, 252, 0.3);
      color: #c084fc; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;
      cursor: pointer; transition: 0.2s; font-family: 'JetBrains Mono', monospace;
    }
    .chip:hover { background: var(--primary); color: white; }

    .btn-save {
      background: var(--primary-gradient);
      border: none; color: white; padding: 11px 18px; border-radius: 8px;
      cursor: pointer; font-weight: 800; font-size: 12px; letter-spacing: 0.5px;
      transition: 0.2s; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .btn-save:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(139, 92, 246, 0.5); }

    /* SWITCH TOGGLE */
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
    input:checked + .slider { background-color: var(--green); border-color: #57f287; box-shadow: 0 0 15px rgba(46, 204, 113, 0.5); }
    input:checked + .slider:before { transform: translateX(22px); background-color: white; }

    /* LIVE PREVIEWS (LORITTA STYLE) */
    .preview-container {
      background: rgba(18, 14, 28, 0.5); border: 1px dashed var(--border);
      border-radius: 12px; padding: 20px; margin-top: 15px;
    }
    .discord-msg-preview {
      background: #313338; border-radius: 8px; padding: 16px; display: flex; gap: 14px;
    }
    .preview-avatar { width: 40px; height: 40px; border-radius: 50%; background: #5865F2 url('/skylineicon.jpg') center/cover; flex-shrink: 0; }
    .preview-bot-tag { background: #5865F2; color: white; font-size: 10px; font-weight: 700; padding: 1px 4px; border-radius: 3px; margin-left: 6px; }

    #toast {
      visibility: hidden; min-width: 260px; background: rgba(18, 14, 28, 0.95);
      color: #ffffff; border: 1px solid var(--primary);
      text-align: center; border-radius: 10px; padding: 14px 20px;
      position: fixed; right: 30px; bottom: 30px; font-weight: 800; font-size: 13.5px;
      opacity: 0; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    }
    #toast.show { visibility: visible; opacity: 1; transform: translateY(-8px); }
  </style>
</head>
<body>
  <!-- SIDEBAR MODULAR -->
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>Bryan Dashboard</h2>
      <p>Gerenciamento • Skyline</p>
    </div>

    <div class="user-card">
      <div class="user-avatar"></div>
      <div class="user-meta">
        <div class="name">${userName}</div>
        <div class="badge">${userId === BOT_OWNER_ID ? '👑 Dono do Bot' : '🛡️ Administrador'}</div>
      </div>
    </div>

    <div class="server-box">
      <label>Servidor Ativo</label>
      <select id="serverSelect" onchange="loadConfig()">${serverOptionsHTML}</select>
    </div>

    <div class="sidebar-nav">
      <div class="nav-cat-header">Módulos do Servidor</div>
      <div class="nav-item active" onclick="switchModule('mod_overview', this)"><span class="nav-item-icon">🏠</span> Visão Geral</div>
      <div class="nav-item" onclick="switchModule('mod_welcome', this)"><span class="nav-item-icon">👋</span> Boas-Vindas</div>
      <div class="nav-item" onclick="switchModule('mod_instagram', this)"><span class="nav-item-icon">📸</span> Feed / Instagram</div>
      <div class="nav-item" onclick="switchModule('mod_security', this)"><span class="nav-item-icon">🛡️</span> Segurança & Auto-Mod</div>
      <div class="nav-item" onclick="switchModule('mod_tickets', this)"><span class="nav-item-icon">🎫</span> Atendimento / Tickets</div>
      <div class="nav-item" onclick="switchModule('mod_rpg', this)"><span class="nav-item-icon">⚔️</span> RPG, Níveis & Economia</div>
      <div class="nav-item" onclick="switchModule('mod_roles', this)"><span class="nav-item-icon">🎭</span> Cargos & Permissões</div>
      <div class="nav-item" onclick="switchModule('mod_community', this)"><span class="nav-item-icon">📢</span> Sorteios & Comunidade</div>
      <div class="nav-item" onclick="switchModule('mod_music', this)"><span class="nav-item-icon">🎵</span> Música & Voz</div>

      ${userId === BOT_OWNER_ID ? `
        <div class="nav-cat-header" style="color: #c084fc;">👑 Administração Global</div>
        <div class="nav-item" onclick="switchModule('mod_global_switches', this)"><span class="nav-item-icon">🌍</span> Kill Switches Globais</div>
        <div class="nav-item" onclick="switchModule('mod_global_identity', this)"><span class="nav-item-icon">🎨</span> Identidade Visual Bot</div>
      ` : ''}
    </div>
  </div>

  <!-- CONTEÚDO PRINCIPAL (TELAS MODULARES) -->
  <div class="content-area">
    <div class="topbar">
      <div class="topbar-info">
        <h1 id="moduleHeaderTitle">🏠 Visão Geral</h1>
        <p id="moduleHeaderDesc">Resumo e atalhos rápidos das configurações do seu servidor.</p>
      </div>
      <input type="text" class="search-input" id="filterInput" placeholder="🔍 Filtrar configurações..." oninput="filterConfigs()">
    </div>

    <div class="main-scroll">
      <!-- 1. VISÃO GERAL -->
      <div id="mod_overview" class="module-section active">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>⚡ Status do Bryan Bot</h3>
            <p>Conectado ao PostgreSQL com motor de alta velocidade ativo no Railway.</p>
          </div>
          <span style="color: #57f287; font-weight: 800; font-size: 13px;">🟢 OPERACIONAL</span>
        </div>
        <div class="grid-settings" id="overviewSwitchesArea"></div>
      </div>

      <!-- 2. BOAS-VINDAS -->
      <div id="mod_welcome" class="module-section">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>👋 Mensagens de Boas-Vindas</h3>
            <p>Recepcione novos membros automaticamente com mensagem e card no canal de entrada.</p>
          </div>
        </div>
        <div class="grid-settings">
          <div class="set-card config-card" data-title="canal de boas vindas">
            <label>Canal de Boas-Vindas (ID)</label>
            <div class="input-row">
              <input type="text" id="cfg_welcomeChannelId" placeholder="ID do canal de texto">
              <button class="btn-save" onclick="saveField('welcomeChannelId', 'cfg_welcomeChannelId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" style="grid-column: 1 / -1;" data-title="mensagem de boas vindas">
            <label>Mensagem de Boas-Vindas</label>
            <div class="input-row" style="flex-direction: column;">
              <textarea id="cfg_welcomeMessage" placeholder="Olá {user}, seja bem-vindo(a) ao {guild}!" oninput="updateWelcomePreview()"></textarea>
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 6px;">
                <div class="tag-chips">
                  <span class="chip" onclick="insertTag('cfg_welcomeMessage', '{user}')">+{user}</span>
                  <span class="chip" onclick="insertTag('cfg_welcomeMessage', '{guild}')">+{guild}</span>
                  <span class="chip" onclick="insertTag('cfg_welcomeMessage', '{members}')">+{members}</span>
                </div>
                <button class="btn-save" onclick="saveField('welcomeMessage', 'cfg_welcomeMessage', 'text')">Salvar Mensagem</button>
              </div>
            </div>
          </div>
        </div>
        <div class="preview-container">
          <label style="font-size: 11px; font-weight: 800; color: #8a7c9f; text-transform: uppercase; margin-bottom: 8px; display: block;">👁️ Pré-visualização do Discord em Tempo Real</label>
          <div class="discord-msg-preview">
            <div class="preview-avatar"></div>
            <div>
              <div style="font-size: 13px; font-weight: 800; color: white;">Bryan Bot <span class="preview-bot-tag">APP</span></div>
              <div id="welcomePreviewText" style="font-size: 14px; color: #dbdee1; margin-top: 4px;">Olá @Aventureiro, seja bem-vindo(a) à Aliança Skyline!</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. FEED / INSTAGRAM -->
      <div id="mod_instagram" class="module-section">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>📸 Feed Social / Instagram</h3>
            <p>Transforme fotos postadas em cards estéticos com curtidas, comentários e avisos no PV.</p>
          </div>
        </div>
        <div class="grid-settings">
          <div class="set-card config-card" data-title="canal feed instagram">
            <label>Canal do Feed (ID)</label>
            <div class="input-row">
              <input type="text" id="cfg_feedChannelId" placeholder="ID do canal de fotos">
              <button class="btn-save" onclick="saveField('feedChannelId', 'cfg_feedChannelId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="cor embed feed">
            <label>Cor do Card do Feed</label>
            <div class="input-row">
              <div class="color-box"><input type="color" id="cfg_feedEmbedColor_picker" oninput="document.getElementById('cfg_feedEmbedColor').value = this.value"></div>
              <input type="text" id="cfg_feedEmbedColor" value="#E1306C" oninput="document.getElementById('cfg_feedEmbedColor_picker').value = this.value">
              <button class="btn-save" onclick="saveField('feedEmbedColor', 'cfg_feedEmbedColor', 'color')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="emoji curtir">
            <label>Emoji de Curtir</label>
            <div class="input-row">
              <input type="text" id="cfg_feedLikeEmoji" placeholder="Padrão: 💜">
              <button class="btn-save" onclick="saveField('feedLikeEmoji', 'cfg_feedLikeEmoji', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="emoji seguir">
            <label>Emoji de Seguir</label>
            <div class="input-row">
              <input type="text" id="cfg_feedFollowEmoji" placeholder="Padrão: 🔔">
              <button class="btn-save" onclick="saveField('feedFollowEmoji', 'cfg_feedFollowEmoji', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="emoji comentar">
            <label>Emoji de Comentar</label>
            <div class="input-row">
              <input type="text" id="cfg_feedCommentEmoji" placeholder="Padrão: 💬">
              <button class="btn-save" onclick="saveField('feedCommentEmoji', 'cfg_feedCommentEmoji', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="rodape feed">
            <label>Texto de Rodapé do Post</label>
            <div class="input-row">
              <input type="text" id="cfg_feedFooterText" placeholder="Ex: 📸 Instagram Skyline">
              <button class="btn-save" onclick="saveField('feedFooterText', 'cfg_feedFooterText', 'text')">Salvar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. SEGURANÇA & AUTO-MOD -->
      <div id="mod_security" class="module-section">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>🛡️ Proteção Ativa & Auto-Moderação</h3>
            <p>Filtros inteligentes contra invasões, envio repetitivo e links suspeitos.</p>
          </div>
        </div>
        <div class="grid-settings">
          <div class="set-card config-card" data-title="anti spam">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h4 style="color:white; font-size:14px;">⚡ Defesa Anti-Spam</h4>
                <p style="color:var(--text-muted); font-size:12px; margin-top:2px;">Bloqueia mensagens idênticas e rápidas.</p>
              </div>
              <label class="switch"><input type="checkbox" id="chk_antiSpam" onchange="toggleFeature('server', 'antiSpam', this.checked)"><span class="slider"></span></label>
            </div>
          </div>
          <div class="set-card config-card" data-title="anti link invites">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h4 style="color:white; font-size:14px;">🔗 Filtro Anti-Links & Invites</h4>
                <p style="color:var(--text-muted); font-size:12px; margin-top:2px;">Apaga convites de outros servidores.</p>
              </div>
              <label class="switch"><input type="checkbox" id="chk_antiLinks" onchange="toggleFeature('server', 'antiLinks', this.checked)"><span class="slider"></span></label>
            </div>
          </div>
          <div class="set-card config-card" data-title="canal de logs auditoria">
            <label>Canal de Logs de Moderação (ID)</label>
            <div class="input-row">
              <input type="text" id="cfg_logChannelId" placeholder="ID do canal de auditoria">
              <button class="btn-save" onclick="saveField('logChannelId', 'cfg_logChannelId', 'text')">Salvar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. TICKETS -->
      <div id="mod_tickets" class="module-section">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>🎫 Atendimento por Tickets</h3>
            <p>Crie categorias de salas privadas com transcrições automáticas.</p>
          </div>
          <label class="switch"><input type="checkbox" id="chk_featTickets" onchange="toggleFeature('server', 'featTickets', this.checked)"><span class="slider"></span></label>
        </div>
        <div class="grid-settings">
          <div class="set-card config-card" data-title="categoria tickets">
            <label>Categoria dos Tickets (ID)</label>
            <div class="input-row">
              <input type="text" id="cfg_ticketCategoryId" placeholder="ID da categoria no Discord">
              <button class="btn-save" onclick="saveField('ticketCategoryId', 'cfg_ticketCategoryId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="canal logs transcripts tickets">
            <label>Canal de Transcrições/Logs (ID)</label>
            <div class="input-row">
              <input type="text" id="cfg_ticketLogChannelId" placeholder="ID do canal onde os transcripts vão cair">
              <button class="btn-save" onclick="saveField('ticketLogChannelId', 'cfg_ticketLogChannelId', 'text')">Salvar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. RPG, NÍVEIS & ECONOMIA -->
      <div id="mod_rpg" class="module-section">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>⚔️ Ecossistema RPG & Leveling</h3>
            <p>Ative ou desative o RPG, progressão de XP, missões e economia no servidor.</p>
          </div>
        </div>
        <div class="grid-settings">
          <div class="set-card config-card" data-title="modulo rpg">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div><h4 style="color:white; font-size:14px;">⚔️ Módulo RPG</h4><p style="color:var(--text-muted); font-size:12px;">Comandos /rpg e combates.</p></div>
              <label class="switch"><input type="checkbox" id="chk_featRpg" onchange="toggleFeature('server', 'featRpg', this.checked)"><span class="slider"></span></label>
            </div>
          </div>
          <div class="set-card config-card" data-title="modulo leveling xp">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div><h4 style="color:white; font-size:14px;">🎯 Leveling & XP</h4><p style="color:var(--text-muted); font-size:12px;">XP ganho por mensagens no chat.</p></div>
              <label class="switch"><input type="checkbox" id="chk_featLeveling" onchange="toggleFeature('server', 'featLeveling', this.checked)"><span class="slider"></span></label>
            </div>
          </div>
          <div class="set-card config-card" data-title="canal forum levelup">
            <label>Canal ou Fórum de Level Up (ID)</label>
            <div class="input-row">
              <input type="text" id="cfg_levelUpChannelId" placeholder="ID do canal ou fórum">
              <button class="btn-save" onclick="saveField('levelUpChannelId', 'cfg_levelUpChannelId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="modulo economia">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div><h4 style="color:white; font-size:14px;">🪙 Economia & Loja</h4><p style="color:var(--text-muted); font-size:12px;">Moedas e compras.</p></div>
              <label class="switch"><input type="checkbox" id="chk_featEconomy" onchange="toggleFeature('server', 'featEconomy', this.checked)"><span class="slider"></span></label>
            </div>
          </div>
        </div>
      </div>

      <!-- 7. CARGOS & PERMISSÕES -->
      <div id="mod_roles" class="module-section">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>🎭 Cargos do Sistema & Permissões</h3>
            <p>Defina a hierarquia de controle do bot e o cargo automático de entrada.</p>
          </div>
        </div>
        <div class="grid-settings">
          <div class="set-card config-card" data-title="cargo autorole">
            <label>Cargo Automático ao Entrar (Auto-Role)</label>
            <div class="input-row">
              <input type="text" id="cfg_autoRoleId" placeholder="ID do cargo">
              <button class="btn-save" onclick="saveField('autoRoleId', 'cfg_autoRoleId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="cargo administrador">
            <label>Cargo de Administrador</label>
            <div class="input-row">
              <input type="text" id="cfg_adminRoleId" placeholder="ID do cargo">
              <button class="btn-save" onclick="saveField('adminRoleId', 'cfg_adminRoleId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="cargo moderador">
            <label>Cargo de Moderador</label>
            <div class="input-row">
              <input type="text" id="cfg_modRoleId" placeholder="ID do cargo">
              <button class="btn-save" onclick="saveField('modRoleId', 'cfg_modRoleId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="cargo silenciado muted">
            <label>Cargo de Silenciado (Muted)</label>
            <div class="input-row">
              <input type="text" id="cfg_mutedRoleId" placeholder="ID do cargo">
              <button class="btn-save" onclick="saveField('mutedRoleId', 'cfg_mutedRoleId', 'text')">Salvar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 8. COMUNIDADE & SORTEIOS -->
      <div id="mod_community" class="module-section">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>📢 Comunidade, Eventos & Sorteios</h3>
            <p>Canais oficiais de anúncios, enquetes, sugestões e feedbacks.</p>
          </div>
        </div>
        <div class="grid-settings">
          <div class="set-card config-card" data-title="canal anuncios">
            <label>Canal de Anúncios (ID)</label>
            <div class="input-row">
              <input type="text" id="cfg_announcementChannelId" placeholder="ID do canal">
              <button class="btn-save" onclick="saveField('announcementChannelId', 'cfg_announcementChannelId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="canal sugestoes">
            <label>Canal de Sugestões (/sugestao)</label>
            <div class="input-row">
              <input type="text" id="cfg_suggestionChannelId" placeholder="ID do canal">
              <button class="btn-save" onclick="saveField('suggestionChannelId', 'cfg_suggestionChannelId', 'text')">Salvar</button>
            </div>
          </div>
          <div class="set-card config-card" data-title="canal feedback">
            <label>Canal de Feedback (/feedback)</label>
            <div class="input-row">
              <input type="text" id="cfg_feedbackChannelId" placeholder="ID do canal">
              <button class="btn-save" onclick="saveField('feedbackChannelId', 'cfg_feedbackChannelId', 'text')">Salvar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 9. MÚSICA & VOZ -->
      <div id="mod_music" class="module-section">
        <div class="master-toggle-card">
          <div class="master-toggle-info">
            <h3>🎵 Player de Música FFmpeg</h3>
            <p>Ative a reprodução de áudio de alta performance nos canais de voz.</p>
          </div>
          <label class="switch"><input type="checkbox" id="chk_featMusic" onchange="toggleFeature('server', 'featMusic', this.checked)"><span class="slider"></span></label>
        </div>
      </div>

      <!-- 10. GLOBAL SWITCHES (APENAS DONO) -->
      ${userId === BOT_OWNER_ID ? `
        <div id="mod_global_switches" class="module-section">
          <div class="master-toggle-card" style="border-color: #c084fc;">
            <div class="master-toggle-info">
              <h3 style="color:#c084fc;">👑 Master Kill Switches Globais</h3>
              <p>Desative módulos instantaneamente em TODOS os servidores da rede.</p>
            </div>
          </div>
          <div class="grid-settings" id="globalSwitchesGrid"></div>
        </div>

        <div id="mod_global_identity" class="module-section">
          <div class="master-toggle-card" style="border-color: #c084fc;">
            <div class="master-toggle-info">
              <h3 style="color:#c084fc;">🎨 Identidade Visual Global</h3>
              <p>Altere a cor padrão e os rodapés de embeds em todos os servidores.</p>
            </div>
          </div>
          <div class="grid-settings">
            <div class="set-card config-card">
              <label>Cor Primária dos Embeds</label>
              <div class="input-row">
                <div class="color-box"><input type="color" id="g_primaryColor_picker" oninput="document.getElementById('g_primaryColor').value = this.value"></div>
                <input type="text" id="g_primaryColor" value="#7B2CBF" oninput="document.getElementById('g_primaryColor_picker').value = this.value">
                <button class="btn-save" onclick="saveGlobalField('primaryColor', 'g_primaryColor', 'color')">Salvar</button>
              </div>
            </div>
            <div class="set-card config-card">
              <label>Rodapé Padrão das Embeds</label>
              <div class="input-row">
                <input type="text" id="g_footerText" placeholder="Texto de rodapé">
                <button class="btn-save" onclick="saveGlobalField('footerText', 'g_footerText', 'text')">Salvar</button>
              </div>
            </div>
            <div class="set-card config-card">
              <label>Rodapé dos Comandos de Roleplay (/rp)</label>
              <div class="input-row">
                <input type="text" id="g_rpFooterText" placeholder="Rodapé do /rp">
                <button class="btn-save" onclick="saveGlobalField('rpFooterText', 'g_rpFooterText', 'text')">Salvar</button>
              </div>
            </div>
            <div class="set-card config-card">
              <label>URL do Ícone do Bot</label>
              <div class="input-row">
                <input type="text" id="g_botIconUrl" placeholder="https://i.imgur.com/...">
                <button class="btn-save" onclick="saveGlobalField('botIconUrl', 'g_botIconUrl', 'text')">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  </div>

  <div id="toast">Configuração salva com sucesso!</div>

  <script>
    let serverConfigData = {};
    let globalConfigData = {};

    const GLOBAL_SWITCH_LIST = [
      { id: 'featRpg', name: 'Trava Mestre RPG', desc: 'Desliga todo o RPG do bot globalmente.' },
      { id: 'featEconomy', name: 'Trava Economia', desc: 'Congela lojas e transferências de ouro.' },
      { id: 'featTickets', name: 'Trava Tickets', desc: 'Impede criação de novos tickets.' },
      { id: 'featMusic', name: 'Trava Motor de Música', desc: 'Desliga o player de áudio globalmente.' },
      { id: 'featLeveling', name: 'Trava Leveling', desc: 'Congela ganho de XP em todas as guildas.' },
      { id: 'featGiveaways', name: 'Trava Sorteios', desc: 'Trava todos os sorteios.' },
      { id: 'featPolls', name: 'Trava Enquetes', desc: 'Desativa enquetes em toda a rede.' },
      { id: 'featSocial', name: 'Trava Social & Feed', desc: 'Desliga feed e comandos de RP.' },
      { id: 'featMod', name: 'Trava Auto-Mod', desc: 'Desliga punições e filtros.' },
      { id: 'featAfk', name: 'Sistema AFK', desc: 'Desativa comandos e menções de AFK.' },
      { id: 'featWelcomeDm', name: 'DM de Boas-Vindas', desc: 'Desliga envio de DMs automáticas.' }
    ];

    const OVERVIEW_MODULES = [
      { id: 'featRpg', name: '⚔️ Sistema RPG' },
      { id: 'featEconomy', name: '🪙 Economia & Loja' },
      { id: 'featTickets', name: '🎫 Sistema de Tickets' },
      { id: 'featSocial', name: '📸 Feed / Instagram' },
      { id: 'antiSpam', name: '⚡ Defesa Anti-Spam' },
      { id: 'antiLinks', name: '🔗 Filtro Anti-Links' },
      { id: 'featLeveling', name: '🎯 XP & Leveling' },
      { id: 'featMusic', name: '🎵 Player de Música' },
      { id: 'featGiveaways', name: '🎁 Sorteios Automáticos' },
      { id: 'featPolls', name: '📊 Enquetes Interativas' }
    ];

    function intToHex(num, fallback = '#8B5CF6') {
      if (num === null || num === undefined || isNaN(num)) return fallback;
      return '#' + num.toString(16).padStart(6, '0');
    }

    function switchModule(sectionId, navEl) {
      document.querySelectorAll('.module-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      
      const target = document.getElementById(sectionId);
      if (target) target.classList.add('active');
      navEl.classList.add('active');

      const titleMap = {
        'mod_overview': ['🏠 Visão Geral', 'Resumo e atalhos rápidos das configurações do servidor.'],
        'mod_welcome': ['👋 Mensagens de Boas-Vindas', 'Personalize o canal e a mensagem com visualizador em tempo real.'],
        'mod_instagram': ['📸 Feed Social / Instagram', 'Defina o canal de postagens, cor do embed e emojis.'],
        'mod_security': ['🛡️ Segurança & Auto-Mod', 'Filtros anti-spam, anti-links e canais de auditoria.'],
        'mod_tickets': ['🎫 Atendimento / Tickets', 'Configuração de categoria e histórico de suporte.'],
        'mod_rpg': ['⚔️ RPG, Níveis & Economia', 'Ativação de progressão, masmorras e canal de level up.'],
        'mod_roles': ['🎭 Cargos & Permissões', 'Hierarquia do bot e cargo automático de entrada.'],
        'mod_community': ['📢 Sorteios & Comunidade', 'Canais de avisos, sugestões e enquetes.'],
        'mod_music': ['🎵 Música & Voz', 'Motor de áudio FFmpeg para canais de voz.'],
        'mod_global_switches': ['🌍 Master Kill Switches', 'Painel de desligamento de emergência em todos os servidores.'],
        'mod_global_identity': ['🎨 Identidade Visual Global', 'Cores e rodapés oficiais do Bryan Bot.']
      };

      if (titleMap[sectionId]) {
        document.getElementById('moduleHeaderTitle').innerText = titleMap[sectionId][0];
        document.getElementById('moduleHeaderDesc').innerText = titleMap[sectionId][1];
      }
    }

    function insertTag(inputId, tag) {
      const el = document.getElementById(inputId);
      if (!el) return;
      el.value += tag;
      updateWelcomePreview();
      el.focus();
    }

    function updateWelcomePreview() {
      const txt = document.getElementById('cfg_welcomeMessage').value || 'Olá {user}, seja bem-vindo(a) ao {guild}!';
      const preview = txt.replace(/{user}/g, '@Aventureiro').replace(/{guild}/g, 'Aliança Skyline').replace(/{members}/g, '1.450');
      document.getElementById('welcomePreviewText').innerText = preview;
    }

    async function loadConfig() {
      const guildId = document.getElementById('serverSelect').value;
      if (!guildId) return;

      const res = await fetch('/api/config?guildId=' + guildId);
      const data = await res.json();
      serverConfigData = data.serverConfig || {};
      globalConfigData = data.globalConfig || {};

      // 1. Popula Inputs do Servidor
      const fields = [
        'welcomeChannelId', 'welcomeMessage', 'feedChannelId', 'feedLikeEmoji',
        'feedFollowEmoji', 'feedCommentEmoji', 'feedFooterText', 'logChannelId',
        'ticketCategoryId', 'ticketLogChannelId', 'levelUpChannelId', 'autoRoleId',
        'adminRoleId', 'modRoleId', 'mutedRoleId', 'announcementChannelId',
        'suggestionChannelId', 'feedbackChannelId'
      ];

      fields.forEach(f => {
        const el = document.getElementById('cfg_' + f);
        if (el) el.value = serverConfigData[f] !== null && serverConfigData[f] !== undefined ? serverConfigData[f] : '';
      });

      // Cores
      const feedColorHex = intToHex(serverConfigData.feedEmbedColor, '#E1306C');
      const feedColorInput = document.getElementById('cfg_feedEmbedColor');
      const feedColorPicker = document.getElementById('cfg_feedEmbedColor_picker');
      if (feedColorInput) feedColorInput.value = feedColorHex;
      if (feedColorPicker) feedColorPicker.value = feedColorHex;

      // Checkboxes de Módulos do Servidor
      const bools = ['antiSpam', 'antiLinks', 'featTickets', 'featRpg', 'featLeveling', 'featEconomy', 'featMusic'];
      bools.forEach(b => {
        const chk = document.getElementById('chk_' + b);
        if (chk) chk.checked = !!serverConfigData[b];
      });

      // 2. Visão Geral (Overview Switches)
      const overviewArea = document.getElementById('overviewSwitchesArea');
      if (overviewArea) {
        overviewArea.innerHTML = OVERVIEW_MODULES.map(m => {
          const checked = serverConfigData[m.id] ? 'checked' : '';
          return \`
            <div class="set-card config-card">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="color:white; font-size:14px;">\${m.name}</h4>
                <label class="switch"><input type="checkbox" \${checked} onchange="toggleFeature('server', '\${m.id}', this.checked)"><span class="slider"></span></label>
              </div>
            </div>
          \`;
        }).join('');
      }

      // 3. Globais (Apenas Dono)
      if (data.isOwner) {
        const globalGrid = document.getElementById('globalSwitchesGrid');
        if (globalGrid) {
          globalGrid.innerHTML = GLOBAL_SWITCH_LIST.map(g => {
            const checked = globalConfigData[g.id] ? 'checked' : '';
            return \`
              <div class="set-card config-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <h4 style="color:white; font-size:14px;">\${g.name}</h4>
                    <p style="color:var(--text-muted); font-size:12px; margin-top:2px;">\${g.desc}</p>
                  </div>
                  <label class="switch"><input type="checkbox" \${checked} onchange="toggleFeature('global', '\${g.id}', this.checked)"><span class="slider"></span></label>
                </div>
              </div>
            \`;
          }).join('');
        }

        const globalColorHex = intToHex(globalConfigData.primaryColor, '#7B2CBF');
        if (document.getElementById('g_primaryColor')) document.getElementById('g_primaryColor').value = globalColorHex;
        if (document.getElementById('g_primaryColor_picker')) document.getElementById('g_primaryColor_picker').value = globalColorHex;
        if (document.getElementById('g_footerText')) document.getElementById('g_footerText').value = globalConfigData.footerText || '';
        if (document.getElementById('g_rpFooterText')) document.getElementById('g_rpFooterText').value = globalConfigData.rpFooterText || '';
        if (document.getElementById('g_botIconUrl')) document.getElementById('g_botIconUrl').value = globalConfigData.botIconUrl || '';
      }

      updateWelcomePreview();
    }

    async function toggleFeature(type, feature, state) {
      const guildId = document.getElementById('serverSelect').value;
      const res = await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, guildId, feature, state })
      });
      res.ok ? showToast('✅ Módulo atualizado!') : showToast('❌ Erro ao salvar módulo.', true);
    }

    async function saveField(feature, inputId, valueType) {
      const guildId = document.getElementById('serverSelect').value;
      const value = document.getElementById(inputId).value;
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'server', guildId, feature, value, valueType })
      });
      res.ok ? showToast('💾 Configuração salva!') : showToast('❌ Erro ao salvar.', true);
    }

    async function saveGlobalField(feature, inputId, valueType) {
      const value = document.getElementById(inputId).value;
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'global', feature, value, valueType })
      });
      res.ok ? showToast('👑 Configuração global salva!') : showToast('❌ Erro ao salvar.', true);
    }

    function filterConfigs() {
      const q = document.getElementById('filterInput').value.toLowerCase();
      document.querySelectorAll('.config-card').forEach(card => {
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
'''

def check_brackets_detailed(code):
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    lines = code.split('\n')
    for line_no, line in enumerate(lines, 1):
        for col_no, char in enumerate(line, 1):
            if char in '({[':
                stack.append((char, line_no, col_no))
            elif char in ')}]':
                if not stack:
                    return f"Unexpected closing '{char}' at line {line_no}:{col_no}"
                top, l, c = stack.pop()
                if pairs[char] != top:
                    return f"Mismatched '{top}' (line {l}:{c}) with '{char}' at line {line_no}:{col_no}"
    if stack:
        top, l, c = stack[-1]
        return f"Unclosed '{top}' from line {l}:{c}"
    return "OK"

print("Loritta Dashboard Syntax Check:", check_brackets_detailed(loritta_dashboard_code))
