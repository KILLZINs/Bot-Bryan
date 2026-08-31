import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma } from '../database/client';

const BOT_OWNER_ID = '1195254699943796791';

// ==========================================
// 🧩 1. MÓDULOS DO SERVIDOR (SWITCHES)
// ==========================================
const SERVER_CATEGORIES = [
  {
    category: "🤖 Inteligência Artificial",
    desc: "Sistemas de voz e conversação avançada",
    features: [
      { id: 'featVoiceAi', name: 'Callia (IA de Voz)', desc: 'Permite que os membros chamem o Bryan ou a Suki nas calls.', icon: '🎙️' }
    ]
  },
  {
    category: "⚔️ RPG & Economia",
    desc: "Sistemas de progressão, missões e mercado",
    features: [
      { id: 'featRpg', name: 'Sistema RPG (Geral)', desc: 'Botão mestre: Ativa/desativa todo o ecossistema RPG no Discord.', icon: '⚔️' },
      { id: 'featEconomy', name: 'Economia & Loja', desc: 'Sistema de moedas, transferências e loja de itens.', icon: '🪙' },
      { id: 'featMissions', name: 'Missões Diárias & Semanais', desc: 'Desafios automáticos com recompensas em XP e coins.', icon: '📜' }
    ]
  },
  {
    category: "🛡️ Segurança & Moderação",
    desc: "Proteção em tempo real contra ataques e spam",
    features: [
      { id: 'featMod', name: 'Módulo de Moderação', desc: 'Comandos administrativos, ban, kick, warns e auditoria.', icon: '🔨' },
      { id: 'antiSpam', name: 'Defesa Ativa Anti-Spam', desc: 'Detecta e bloqueia envio rápido e repetitivo de mensagens.', icon: '⚡' },
      { id: 'antiLinks', name: 'Filtro Anti-Links & Invites', desc: 'Remove automaticamente convites externos e links suspeitos.', icon: '🔗' }
    ]
  },
  {
    category: "📸 Social & Comunidade",
    desc: "Engajamento, interações e rede social interna",
    features: [
      { id: 'featSocial', name: 'Feed Social / Instagram', desc: 'Postagens automáticas de fotos com curtidas, comentários e avisos no PV.', icon: '📸' },
      { id: 'featLeveling', name: 'Sistema de XP & Leveling', desc: 'Progressão por mensagens e avisos em canais ou fóruns.', icon: '⭐' },
      { id: 'featGiveaways', name: 'Sorteios com Cron', desc: 'Sorteios automatizados com encerramento programado.', icon: '🎁' },
      { id: 'featPolls', name: 'Enquetes Interativas', desc: 'Votações com contagem de votos e estatísticas.', icon: '📊' }
    ]
  },
  {
    category: "🎫 Atendimento & Utilidades",
    desc: "Suporte aos membros e streaming",
    features: [
      { id: 'featTickets', name: 'Tickets de Suporte', desc: 'Salas privadas de atendimento com transcrição de histórico.', icon: '🎫' },
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
    category: "🌍 Master Switches (Trava Absoluta)",
    features: [
      { id: 'featVoiceAi', name: 'Trava Mestre IA (Callia)', desc: 'Derruba e proíbe a inteligência artificial de voz globalmente.' },
      { id: 'featRpg', name: 'Trava Mestre RPG', desc: 'Desliga todo o RPG do bot globalmente.' },
      { id: 'featEconomy', name: 'Trava Economia', desc: 'Congela todas as lojas e transferências de moedas.' },
      { id: 'featTickets', name: 'Trava Tickets', desc: 'Bloqueia criação de novos atendimentos.' },
      { id: 'featMusic', name: 'Trava Motor de Música', desc: 'Desliga o player de áudio por segurança.' },
      { id: 'antiSpam', name: 'Trava Defesa Anti-Spam', desc: 'Desativa o bloqueador de mensagens em massa globalmente.' }
    ]
  }
];

// ==========================================
// ⚙️ 2. CONFIGURAÇÕES DETALHADAS (INPUTS)
// ==========================================
const SERVER_SETTINGS = [
  {
    category: "🤖 Inteligência Artificial (Callia)",
    desc: "Configure o comportamento do Bryan e da Suki no servidor",
    items: [
      { id: 'aiDefaultPersona', name: 'Persona Padrão', type: 'text', placeholder: 'Ex: bryan ou suki' },
      { id: 'aiSystemPrompt', name: 'Prompt de Comportamento Base', type: 'textarea', placeholder: 'Ex: Você é o Bryan, um assistente sarcástico focado em games...' }
    ]
  },
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
      { id: 'logChannelId', name: 'Canal de Logs Gerais', type: 'text', placeholder: 'ID do canal de registros' },
      { id: 'levelUpChannelId', name: 'Canal de Level Up', type: 'text', placeholder: 'ID do canal/fórum de avisos de nível' },
      { id: 'suggestionChannelId', name: 'Canal de Sugestões', type: 'text', placeholder: 'ID do canal para o /sugestao' },
      { id: 'feedbackChannelId', name: 'Canal de Feedback', type: 'text', placeholder: 'ID do canal para o /feedback' }
    ]
  },
  {
    category: "🎫 Sistema de Tickets (IDs)",
    desc: "Configuração de atendimento e histórico",
    items: [
      { id: 'ticketCategoryId', name: 'Categoria dos Tickets', type: 'text', placeholder: 'ID da categoria onde os tickets serão criados' },
      { id: 'ticketLogChannelId', name: 'Canal de Transcrições', type: 'text', placeholder: 'ID do canal onde os logs de tickets são salvos' }
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

  // ─── TELA INICIAL (LANDING PAGE) ──────────────────────
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
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: var(--bg); color: #f1edfa; font-family: 'Plus Jakarta Sans', sans-serif; overflow-x: hidden; line-height: 1.6; }
    .bg-canvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1; background: radial-gradient(circle at 12% 18%, rgba(139, 92, 246, 0.25) 0%, transparent 40%), radial-gradient(circle at 88% 82%, rgba(225, 48, 108, 0.2) 0%, transparent 45%), linear-gradient(180deg, #090710 0%, #050408 100%); }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 8%; background: rgba(9, 7, 16, 0.85); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
    .brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: white; }
    .brand img { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--primary); box-shadow: 0 0 20px var(--primary-glow); }
    .brand-name { font-weight: 900; font-size: 1.35rem; background: linear-gradient(135deg, #ffffff 0%, #e0c3fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .nav-btns { display: flex; gap: 12px; }
    .btn { padding: 12px 24px; border-radius: 12px; font-weight: 800; font-size: 13.5px; text-decoration: none; transition: all 0.3s ease; }
    .btn-primary { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; box-shadow: 0 0 25px rgba(124, 58, 237, 0.5); }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(168, 85, 247, 0.8); }
    .btn-invite { background: linear-gradient(135deg, #5865f2 0%, #4752c4 100%); color: white; }
    .btn-invite:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(88, 101, 242, 0.7); }
    .hero { text-align: center; padding: 85px 8% 50px 8%; max-width: 1200px; margin: 0 auto; }
    .hero-badge { display: inline-flex; align-items: center; gap: 10px; padding: 8px 24px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(192, 132, 252, 0.4); border-radius: 50px; font-size: 13px; font-weight: 800; color: #e0c3fc; margin-bottom: 25px; box-shadow: 0 0 25px rgba(139, 92, 246, 0.3); text-transform: uppercase; }
    .hero h1 { font-size: clamp(2.4rem, 5vw, 4.3rem); font-weight: 900; line-height: 1.15; margin-bottom: 25px; letter-spacing: -1.5px; }
    .gradient-text { background: linear-gradient(135deg, #ffffff 20%, #c77dff 60%, #e1306c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { font-size: 1.15rem; color: #b3a7c6; max-width: 800px; margin: 0 auto 40px auto; }
    .hero-actions { display: flex; gap: 16px; justify-content: center; }
  </style>
</head>
<body>
  <div class="bg-canvas"></div>
  <nav>
    <a href="/" class="brand"><img src="/skylineicon.jpg" alt="Logo"><span class="brand-name">Bryan Bot</span></a>
    <div class="nav-btns">
      <a href="${botInviteUrl}" class="btn btn-invite">➕ Adicionar Bot</a>
      <a href="/login" class="btn btn-primary">⚡ Painel Web</a>
    </div>
  </nav>
  <section class="hero">
    <div class="hero-badge">🎙️ Síntese de Voz com IA & Feed Social Integrado</div>
    <h1>Potencialize seu servidor com <span class="gradient-text">Recursos de Elite</span></h1>
    <p>O Bryan Bot reúne conversação inteligente por voz nos canais, feed social estilo Instagram, ecossistema RPG completo no Discord, tickets e moderação blindada.</p>
    <div class="hero-actions">
      <a href="${botInviteUrl}" class="btn btn-invite" style="padding: 16px 36px; font-size: 16px;">➕ Adicionar ao Discord</a>
      <a href="/login" class="btn btn-primary" style="padding: 16px 36px; font-size: 16px;">⚙️ Acessar Dashboard</a>
    </div>
  </section>
</body>
</html>`);
  });

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

  // 🛡️ API: CONFIG
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

  // 🛡️ API: TOGGLE
  app.post('/api/toggle', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { type, guildId, feature, state } = req.body;

    if (type === 'global' && userId !== BOT_OWNER_ID) return res.status(403).json({ error: 'Apenas o Dono pode alterar configurações globais.' });
    if (type === 'server') {
      const hasAccess = await validateGuildAccess(userId, guildId);
      if (!hasAccess) return res.status(403).json({ error: 'Acesso negado.' });
    }

    try {
      if (type === 'server') await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: state } });
      else if (type === 'global') await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: state } });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar.' }); }
  });

  // 🛡️ API: UPDATE
  app.post('/api/update', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { type, guildId, feature, value, valueType } = req.body;

    if (type === 'global' && userId !== BOT_OWNER_ID) return res.status(403).json({ error: 'Apenas o Dono pode alterar configurações globais.' });
    if (type === 'server') {
      const hasAccess = await validateGuildAccess(userId, guildId);
      if (!hasAccess) return res.status(403).json({ error: 'Acesso negado.' });
    }

    let finalValue: string | number | null = value;
    if (valueType === 'color') {
      if (typeof value === 'string' && value.startsWith('#')) {
        finalValue = parseInt(value.replace('#', ''), 16) || 14757996;
      } else {
        finalValue = parseInt(value, 10) || 14757996;
      }
    } else if (valueType === 'number') {
      finalValue = parseInt(value, 10) || 0;
    } else if (value === "" || value === null) {
      finalValue = null;
    }

    try {
      if (type === 'server') await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: finalValue } });
      else if (type === 'global') await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: finalValue } });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar.' }); }
  });

  // ─── PAINEL DE CONTROLE (O MOLHO) ────────────────────
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
      --card-bg: rgba(22, 17, 34, 0.45);
      --card-hover: rgba(30, 23, 46, 0.7);
      --border: rgba(168, 85, 247, 0.15);
      --border-glow: rgba(192, 132, 252, 0.5);
      --primary: #8b5cf6;
      --accent: #e1306c;
      --text: #f1edfa;
      --text-muted: #9f93b2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg); color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex; height: 100vh; overflow: hidden;
    }
    .bg-animated {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none;
      background: radial-gradient(circle at 80% 10%, rgba(139, 92, 246, 0.1) 0%, transparent 40%),
                  radial-gradient(circle at 20% 90%, rgba(225, 48, 108, 0.05) 0%, transparent 50%);
    }

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.4); border-radius: 4px; }

    .sidebar { width: 320px; background-color: var(--sidebar); display: flex; flex-direction: column; border-right: 1px solid var(--border); z-index: 20; }
    .sidebar-header { padding: 35px 25px 20px 25px; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, rgba(20, 14, 32, 0.9) 0%, var(--sidebar) 100%); }
    .sidebar-header h2 { font-size: 20px; font-weight: 900; background: linear-gradient(135deg, #fff 0%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 4px; }
    .sidebar-header p { font-size: 11px; font-weight: 700; color: #7c6f8f; text-transform: uppercase; letter-spacing: 1.5px; }

    .user-card { margin: 20px; padding: 14px 16px; background: rgba(28, 21, 44, 0.6); border: 1px solid var(--border); border-radius: 14px; display: flex; align-items: center; gap: 14px; }
    .user-avatar { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--primary); box-shadow: 0 0 15px rgba(139, 92, 246, 0.4); background: url('/skylineicon.jpg') center/cover; }
    .user-meta .name { font-weight: 800; font-size: 14px; color: white; }
    .user-meta .badge { font-size: 11px; font-weight: 700; color: #c084fc; background: rgba(139, 92, 246, 0.2); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 2px; }

    .server-box { padding: 15px 20px; }
    .server-box label { font-size: 11px; font-weight: 800; color: #8a7c9f; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px; }
    .server-box select { width: 100%; padding: 14px; background: #191426; color: white; border: 1px solid var(--border); border-radius: 10px; font-weight: 700; outline: none; cursor: pointer; transition: 0.3s; }
    .server-box select:focus { border-color: var(--primary); box-shadow: 0 0 15px rgba(139, 92, 246, 0.2); }

    .content-area { flex: 1; display: flex; flex-direction: column; position: relative; z-index: 10; }
    .topbar { padding: 20px 45px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); background: rgba(12, 9, 20, 0.6); backdrop-filter: blur(20px); }
    .nav-tabs { display: flex; gap: 12px; }
    .tab-btn { background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.25s; }
    .tab-btn:hover { color: white; background: rgba(139, 92, 246, 0.1); }
    .tab-btn.active { color: white; background: rgba(139, 92, 246, 0.25); border-color: rgba(192, 132, 252, 0.4); box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }

    .search-input { padding: 10px 18px; background: rgba(22, 18, 34, 0.8); border: 1px solid var(--border); border-radius: 10px; color: white; outline: none; font-size: 13px; width: 240px; transition: 0.3s; }
    .search-input:focus { border-color: var(--primary); width: 280px; box-shadow: 0 0 15px rgba(139, 92, 246, 0.3); }

    .main-scroll { flex: 1; overflow-y: auto; padding: 35px 45px 80px 45px; }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }
    
    @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    .anim-card { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }

    .category-title { font-size: 1.15rem; font-weight: 800; color: white; margin: 35px 0 8px 0; }
    .category-title:first-child { margin-top: 0; }
    .category-desc { font-size: 13px; color: #8e80a3; margin-bottom: 20px; }

    .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
    
    .mod-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 22px; display: flex; justify-content: space-between; align-items: center; backdrop-filter: blur(12px); transition: all 0.3s; }
    .mod-card:hover { background: var(--card-hover); border-color: var(--border-glow); transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.4), 0 0 20px rgba(139, 92, 246, 0.15); }
    .mod-info { display: flex; gap: 15px; align-items: center; max-width: 75%; }
    .mod-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(192, 132, 252, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .mod-text h3 { font-size: 14.5px; font-weight: 800; color: white; margin-bottom: 4px; }
    .mod-text p { font-size: 12px; color: var(--text-muted); line-height: 1.4; }

    .switch { position: relative; width: 50px; height: 28px; flex-shrink: 0; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #1f1a2d; transition: 0.3s; border-radius: 34px; border: 1px solid #4a3b66; }
    .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: #9f91b5; transition: 0.3s; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
    input:checked + .slider { background-color: #8b5cf6; border-color: #c084fc; box-shadow: 0 0 18px rgba(139, 92, 246, 0.5); }
    input:checked + .slider:before { transform: translateX(22px); background-color: white; }

    .set-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 12px; backdrop-filter: blur(12px); transition: 0.3s; }
    .set-card:hover { border-color: var(--border-glow); transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
    .set-card label { font-size: 13.5px; font-weight: 800; color: white; display: flex; justify-content: space-between; }
    
    .input-row { display: flex; gap: 10px; align-items: center; }
    .input-row input[type="text"], .input-row input[type="number"] { flex: 1; background: rgba(15, 12, 25, 0.8); border: 1px solid var(--border); color: white; padding: 12px 14px; border-radius: 10px; outline: none; font-size: 13.5px; font-family: 'JetBrains Mono', monospace; transition: 0.3s; }
    .input-row input:focus, .input-row textarea:focus { border-color: var(--primary); box-shadow: 0 0 10px rgba(139, 92, 246, 0.2); }
    .input-row textarea { flex: 1; background: rgba(15, 12, 25, 0.8); border: 1px solid var(--border); color: white; padding: 14px; border-radius: 10px; outline: none; font-size: 13.5px; min-height: 90px; font-family: inherit; resize: vertical; transition: 0.3s; }
    
    .color-preview-box { width: 46px; height: 44px; border-radius: 10px; border: 1px solid var(--border); cursor: pointer; padding: 0; background: #161222; overflow: hidden; flex-shrink: 0; }
    .color-preview-box input[type="color"] { width: 200%; height: 200%; transform: translate(-25%, -25%); cursor: pointer; border: none; outline: none; }
    
    .tag-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .chip { background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(192, 132, 252, 0.3); color: #c084fc; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; transition: 0.2s; font-family: 'JetBrains Mono', monospace; }
    .chip:hover { background: var(--primary); color: white; transform: translateY(-1px); }

    .btn-save { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border: none; color: white; padding: 12px 20px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 12.5px; letter-spacing: 0.5px; transition: 0.3s; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .btn-save:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(139, 92, 246, 0.6); }

    #toast { visibility: hidden; min-width: 280px; background: rgba(18, 14, 28, 0.95); color: white; border: 1px solid var(--primary); text-align: center; border-radius: 12px; padding: 16px 24px; position: fixed; right: 35px; bottom: 35px; font-weight: 800; font-size: 14px; opacity: 0; transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); z-index: 9999; box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 25px rgba(139, 92, 246, 0.4); backdrop-filter: blur(15px); }
    #toast.show { visibility: visible; opacity: 1; transform: translateY(-10px); }
  </style>
</head>
<body>
  <div class="bg-animated"></div>
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
        ${userId === BOT_OWNER_ID ? `<div id="globalModulesArea" style="margin-top: 50px;"></div>` : ''}
      </div>
      <div id="tab_configs" class="tab-pane">
        <div id="serverSettingsArea">Carregando configurações...</div>
        ${userId === BOT_OWNER_ID ? `<div id="globalSettingsArea" style="margin-top: 50px;"></div>` : ''}
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
        renderModules('globalModulesArea', GLOBAL_CATEGORIES, data.globalConfig, 'global', '👑 Módulos Globais (Apenas Bryan)');
        renderSettings('globalSettingsArea', GLOBAL_SETTINGS, data.globalConfig, 'global', '👑 Identidade Visual Global');
      }
    }

    function renderModules(containerId, categories, dbData, type, customTitle = null) {
      const container = document.getElementById(containerId);
      if (!container) return;

      let html = '';
      if (customTitle) html += '<div class="category-title" style="color: #c084fc; font-size: 1.3rem;">' + customTitle + '</div>';

      let delayCounter = 0;
      categories.forEach(cat => {
        html += '<div class="category-title">' + cat.category + '</div>';
        if (cat.desc) html += '<div class="category-desc">' + cat.desc + '</div>';
        html += '<div class="grid-cards">';

        cat.features.forEach(feat => {
          const checked = dbData && dbData[feat.id] ? 'checked' : '';
          const icon = feat.icon || '✨';
          const delay = (delayCounter++ * 0.05) + 's';
          html += '<div class="mod-card search-card anim-card" style="animation-delay: ' + delay + ';" data-title="' + feat.name.toLowerCase() + '">' +
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
      if (customTitle) html += '<div class="category-title" style="color: #c084fc; font-size: 1.3rem;">' + customTitle + '</div>';

      let delayCounter = 0;
      categories.forEach(cat => {
        html += '<div class="category-title">' + cat.category + '</div>';
        if (cat.desc) html += '<div class="category-desc">' + cat.desc + '</div>';
        html += '<div class="grid-cards">';

        cat.items.forEach(item => {
          const inputId = 'input_' + type + '_' + item.id;
          const rawVal = dbData ? dbData[item.id] : null;
          const delay = (delayCounter++ * 0.05) + 's';

          if (item.type === 'color') {
            const hexColor = intToHex(rawVal, item.id === 'primaryColor' ? '#8B5CF6' : '#E1306C');
            html += '<div class="set-card search-card anim-card" style="animation-delay: ' + delay + ';" data-title="' + item.name.toLowerCase() + '">' +
                      '<label><span>' + item.name + '</span><span style="color:#c084fc; font-family:monospace;">' + hexColor + '</span></label>' +
                      '<div class="input-row">' +
                        '<div class="color-preview-box"><input type="color" value="' + hexColor + '" oninput="document.getElementById(\\'' + inputId + '\\').value = this.value"></div>' +
                        '<input type="text" id="' + inputId + '" value="' + hexColor + '">' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'color\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          } else if (item.type === 'textarea') {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="set-card search-card anim-card" style="grid-column: 1 / -1; animation-delay: ' + delay + ';" data-title="' + item.name.toLowerCase() + '">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-row" style="flex-direction: column;">' +
                        '<textarea id="' + inputId + '" placeholder="' + item.placeholder + '">' + val + '</textarea>' +
                        '<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 6px;">' +
                          '<div class="tag-chips">' +
                            '<span class="chip" onclick="insertTag(\\'' + inputId + '\\', \\'{user}\\')">+{user}</span>' +
                            '<span class="chip" onclick="insertTag(\\'' + inputId + '\\', \\'{guild}\\')">+{guild}</span>' +
                          '</div>' +
                          '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'text\\')">Salvar Resposta</button>' +
                        '</div>' +
                      '</div>' +
                    '</div>';
          } else {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="set-card search-card anim-card" style="animation-delay: ' + delay + ';" data-title="' + item.name.toLowerCase() + '">' +
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
      const res = await fetch('/api/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature, state }) });
      res.ok ? showToast('✅ Módulo atualizado!') : showToast('❌ Falha ao salvar módulo.', true);
    }

    async function saveSetting(type, feature, inputId, valueType) {
      const guildId = document.getElementById('serverSelect').value;
      const value = document.getElementById(inputId).value;
      const res = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature, value, valueType }) });
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
