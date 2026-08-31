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
      { id: 'featSocial', name: 'Trava Mestre Feed Social', desc: 'Derruba o Feed do Instagram globalmente.' },
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
      { id: 'feedLikeEmoji', name: 'Emoji de Curtir', type: 'text', placeholder: 'Padrão: ❤️' },
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
      { id: 'primaryColor', name: 'Cor Primária dos Embeds', type: 'color', placeholder: '#5865F2' }
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

  // ─── TELA INICIAL (PROBOT/LORITTA STYLE) ──────────────────────
  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bryan Bot - O bot definitivo para o Discord</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0B0E14;
      --card: #161922;
      --border: #232731;
      --blurple: #5865F2;
      --blurple-hover: #4752C4;
      --text-main: #FFFFFF;
      --text-muted: #8E929D;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: var(--bg); color: var(--text-main); overflow-x: hidden; }
    
    /* Navbar */
    nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 8%; background: rgba(11, 14, 20, 0.85); backdrop-filter: blur(15px); position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid var(--border); }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: white; font-weight: 800; font-size: 1.2rem; }
    .brand img { width: 40px; height: 40px; border-radius: 50%; }
    .nav-links { display: flex; gap: 20px; }
    .nav-links a { color: var(--text-main); text-decoration: none; font-weight: 500; font-size: 0.95rem; transition: 0.2s; }
    .nav-links a:hover { color: var(--blurple); }
    
    /* Hero Section */
    .hero { text-align: center; padding: 120px 20px 80px 20px; background: radial-gradient(circle at 50% -20%, rgba(88, 101, 242, 0.15) 0%, transparent 60%); }
    .hero h1 { font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 800; letter-spacing: -1px; margin-bottom: 20px; }
    .hero p { font-size: 1.15rem; color: var(--text-muted); max-width: 600px; margin: 0 auto 40px auto; line-height: 1.6; }
    .btn { display: inline-flex; align-items: center; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 1rem; text-decoration: none; transition: 0.2s; cursor: pointer; }
    .btn-primary { background: var(--blurple); color: white; border: none; }
    .btn-primary:hover { background: var(--blurple-hover); transform: translateY(-2px); }
    .btn-secondary { background: var(--card); color: white; border: 1px solid var(--border); margin-left: 15px; }
    .btn-secondary:hover { background: #1C202B; transform: translateY(-2px); }

    /* Features Grid */
    .features-section { padding: 80px 8%; max-width: 1300px; margin: 0 auto; }
    .section-title { text-align: center; font-size: 2.2rem; font-weight: 800; margin-bottom: 50px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 25px; }
    .card { background: var(--card); border: 1px solid var(--border); padding: 35px; border-radius: 16px; transition: 0.3s; }
    .card:hover { border-color: var(--blurple); transform: translateY(-5px); box-shadow: 0 10px 30px rgba(88, 101, 242, 0.1); }
    .icon-wrapper { width: 50px; height: 50px; background: rgba(88, 101, 242, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 20px; color: var(--blurple); }
    .card h3 { font-size: 1.3rem; font-weight: 700; margin-bottom: 12px; }
    .card p { color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; }

    /* Footer */
    footer { text-align: center; padding: 40px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.9rem; background: var(--card); }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="brand"><img src="/skylineicon.jpg" alt="Logo"> Bryan Bot</a>
    <div class="nav-links">
      <a href="${botInviteUrl}">Adicionar ao Discord</a>
      <a href="/login" class="btn btn-primary" style="padding: 8px 18px; margin-left: 15px;">Acessar Painel</a>
    </div>
  </nav>

  <div class="hero">
    <h1>Suba o nível do seu servidor.</h1>
    <p>A ferramenta definitiva para a sua comunidade. Inteligência Artificial por voz, Feed do Instagram, RPG completo e ferramentas de moderação blindadas em um só lugar.</p>
    <div>
      <a href="${botInviteUrl}" class="btn btn-primary">Adicionar ao Discord</a>
      <a href="/login" class="btn btn-secondary">Configurar Bot</a>
    </div>
  </div>

  <div class="features-section">
    <h2 class="section-title">Por que escolher o Bryan?</h2>
    <div class="grid">
      <div class="card">
        <div class="icon-wrapper">🎙️</div>
        <h3>Inteligência Artificial (Voz)</h3>
        <p>Acesse chamadas de voz com o Bryan ou a Suki. O bot escuta, entende e conversa em tempo real com a sua comunidade usando IA avançada e TTS de alta qualidade.</p>
      </div>
      <div class="card">
        <div class="icon-wrapper">📸</div>
        <h3>Feed Social (Instagram)</h3>
        <p>Crie uma rede social dentro do servidor. Membros podem postar fotos, seguir amigos, ganhar curtidas, comentar e receber notificações automáticas na DM.</p>
      </div>
      <div class="card">
        <div class="icon-wrapper">⚔️</div>
        <h3>RPG & Economia</h3>
        <p>Mergulhe em um ecossistema com Dungeons, World Bosses, missões diárias e geração de imagens de perfil customizadas para o seu personagem.</p>
      </div>
      <div class="card">
        <div class="icon-wrapper">🔨</div>
        <h3>Moderação Automática</h3>
        <p>Durma tranquilo com o sistema Anti-Spam e Anti-Links. O bot monitora ativamente e pune infratores antes mesmo da Staff precisar intervir.</p>
      </div>
      <div class="card">
        <div class="icon-wrapper">🎫</div>
        <h3>Sistema de Tickets</h3>
        <p>Organize o atendimento da sua loja ou comunidade com categorias privativas, salvamento de histórico (transcrições) em canais de log dedicados.</p>
      </div>
      <div class="card">
        <div class="icon-wrapper">🎵</div>
        <h3>Música FFmpeg </h3>
        <p>Qualidade de áudio de estúdio para você escutar com os amigos. Suporte a playlists extensas, filtros de equalização e total controle pela dashboard.</p>
      </div>
    </div>
  </div>

  <footer>
    <p>© 2026 Bryan Bot. Feito com ❤️ para a Aliança Skyline.</p>
  </footer>
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

      if (!isBotOwner && userRoles.length === 0) return res.status(403).send('<body style="background: #0B0E14; color: #ed4245; text-align: center; padding-top: 150px; font-family: sans-serif;"><h1>🛑 Acesso Negado</h1><p style="color:white;">Sem credenciais ativas na Aliança.</p><br><a href="/" style="color: #5865F2; font-weight: bold;">Voltar</a></body>');

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
    if (!hasAccess) return res.status(403).json({ error: 'Permissão negada.' });

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

  // ─── DASHBOARD INTERNO (PROBOT STYLE) ────────────────────
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
  <title>Dashboard - Bryan</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0B0E14;
      --sidebar: #121620;
      --card: #1C212B;
      --border: #2B313E;
      --blurple: #5865F2;
      --green: #2ECC71;
      --red: #ED4245;
      --text: #FFFFFF;
      --text-muted: #8E929D;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
    
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #3c4354; }

    /* Sidebar */
    .sidebar { width: 280px; background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
    .brand { padding: 25px; font-size: 1.3rem; font-weight: 700; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
    .brand img { width: 32px; border-radius: 50%; }
    
    .nav-items { flex: 1; padding: 20px 15px; display: flex; flex-direction: column; gap: 8px; }
    .nav-btn { background: transparent; color: var(--text-muted); border: none; padding: 12px 16px; border-radius: 8px; text-align: left; font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 10px; }
    .nav-btn:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }
    .nav-btn.active { background: rgba(88, 101, 242, 0.15); color: var(--blurple); }

    .user-profile { padding: 20px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
    .user-profile .avatar { width: 40px; height: 40px; border-radius: 50%; background: #2B313E url('/skylineicon.jpg') center/cover; }
    .user-profile .info h4 { font-size: 0.9rem; margin-bottom: 2px; }
    .user-profile .info span { font-size: 0.75rem; color: var(--blurple); background: rgba(88, 101, 242, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 600;}

    /* Main Area */
    .main { flex: 1; display: flex; flex-direction: column; }
    .header { padding: 20px 40px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--bg); }
    .server-selector { display: flex; align-items: center; gap: 15px; }
    .server-selector label { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); }
    .server-selector select { background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 10px 15px; border-radius: 8px; outline: none; font-size: 0.95rem; min-width: 200px; cursor: pointer; }
    .server-selector select:focus { border-color: var(--blurple); }

    .content { padding: 40px; overflow-y: auto; flex: 1; }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; animation: fadeIn 0.3s; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .section-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
    .section-desc { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 25px; margin-top: -5px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; margin-bottom: 50px; }
    
    /* Toggle Card */
    .card-toggle { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
    .card-toggle:hover { border-color: var(--blurple); }
    .card-info { display: flex; align-items: center; gap: 15px; }
    .card-icon { width: 45px; height: 45px; background: rgba(255,255,255,0.05); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .card-text h3 { font-size: 1rem; margin-bottom: 4px; }
    .card-text p { font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; max-width: 220px; }

    /* Discord/iOS Switch */
    .switch { position: relative; width: 44px; height: 24px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--text-muted); transition: .3s; border-radius: 34px; }
    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
    input:checked + .slider { background-color: var(--green); }
    input:checked + .slider:before { transform: translateX(20px); }

    /* Input Card */
    .card-input { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .card-input label { font-size: 0.95rem; font-weight: 600; }
    .input-group { display: flex; gap: 10px; }
    .input-group input[type="text"], .input-group input[type="number"], .input-group textarea { flex: 1; background: #121620; border: 1px solid var(--border); color: white; padding: 12px; border-radius: 8px; outline: none; font-size: 0.9rem; transition: 0.2s; }
    .input-group input:focus, .input-group textarea:focus { border-color: var(--blurple); }
    .input-group textarea { resize: vertical; min-height: 80px; }
    
    .color-picker-wrapper { width: 42px; height: 42px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); cursor: pointer; }
    .color-picker-wrapper input { width: 200%; height: 200%; transform: translate(-25%, -25%); cursor: pointer; }

    .btn-save { background: var(--blurple); color: white; border: none; padding: 0 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    .btn-save:hover { background: var(--blurple-hover); }

    .tag-container { display: flex; gap: 8px; margin-top: 5px; }
    .tag { background: rgba(255,255,255,0.1); color: var(--text-muted); font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .tag:hover { background: var(--blurple); color: white; }

    /* Toast */
    #toast { visibility: hidden; min-width: 250px; background: var(--green); color: white; text-align: center; border-radius: 8px; padding: 15px; position: fixed; right: 30px; bottom: 30px; font-weight: 600; opacity: 0; transition: 0.3s; z-index: 1000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    #toast.error { background: var(--red); }
    #toast.show { visibility: visible; opacity: 1; transform: translateY(-10px); }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="brand"><img src="/skylineicon.jpg" alt="Logo"> Bryan Bot</div>
    <div class="nav-items">
      <button class="nav-btn active" onclick="switchTab('modulos', this)">🧩 Módulos do Servidor</button>
      <button class="nav-btn" onclick="switchTab('configs', this)">⚙️ Configurações Gerais</button>
      ${userId === BOT_OWNER_ID ? `<button class="nav-btn" onclick="switchTab('global', this)">🌍 Travas Globais (Dono)</button>` : ''}
    </div>
    <div class="user-profile">
      <div class="avatar"></div>
      <div class="info">
        <h4>${userName}</h4>
        <span>${userId === BOT_OWNER_ID ? 'Dono do Bot' : 'Admin'}</span>
      </div>
    </div>
  </div>

  <div class="main">
    <div class="header">
      <h2 style="font-size: 1.2rem; font-weight: 600;">Painel de Controle</h2>
      <div class="server-selector">
        <label>Servidor Atual:</label>
        <select id="serverSelect" onchange="loadConfig()">${serverOptionsHTML}</select>
      </div>
    </div>

    <div class="content">
      <div id="modulos" class="tab-pane active">
        <!-- Renderizado dinamicamente -->
      </div>
      <div id="configs" class="tab-pane">
        <!-- Renderizado dinamicamente -->
      </div>
      ${userId === BOT_OWNER_ID ? `<div id="global" class="tab-pane"></div>` : ''}
    </div>
  </div>

  <div id="toast">Ação concluída!</div>

  <script>
    const SERVER_CATEGORIES = ${JSON.stringify(SERVER_CATEGORIES)};
    const GLOBAL_CATEGORIES = ${JSON.stringify(GLOBAL_CATEGORIES)};
    const SERVER_SETTINGS = ${JSON.stringify(SERVER_SETTINGS)};
    const GLOBAL_SETTINGS = ${JSON.stringify(GLOBAL_SETTINGS)};

    function intToHex(num, fallback = '#5865F2') {
      if (num === null || num === undefined || isNaN(num)) return fallback;
      return '#' + num.toString(16).padStart(6, '0');
    }

    function switchTab(tabId, btn) {
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      btn.classList.add('active');
    }

    function insertTag(inputId, tag) {
      const el = document.getElementById(inputId);
      if (!el) return;
      el.value += tag + ' ';
      el.focus();
    }

    async function loadConfig() {
      const guildId = document.getElementById('serverSelect').value;
      if (!guildId) return;

      const res = await fetch('/api/config?guildId=' + guildId);
      const data = await res.json();

      renderModules('modulos', SERVER_CATEGORIES, data.serverConfig, 'server');
      renderSettings('configs', SERVER_SETTINGS, data.serverConfig, 'server');

      if (data.isOwner && document.getElementById('global')) {
        let globalHtml = '';
        globalHtml += generateModulesHtml(GLOBAL_CATEGORIES, data.globalConfig, 'global');
        globalHtml += generateSettingsHtml(GLOBAL_SETTINGS, data.globalConfig, 'global');
        document.getElementById('global').innerHTML = globalHtml;
      }
    }

    function generateModulesHtml(categories, dbData, type) {
      let html = '';
      categories.forEach(cat => {
        html += '<h2 class="section-title">' + cat.category + '</h2>';
        if (cat.desc) html += '<p class="section-desc">' + cat.desc + '</p>';
        html += '<div class="grid">';
        cat.features.forEach(feat => {
          const checked = dbData && dbData[feat.id] ? 'checked' : '';
          const icon = feat.icon || '✨';
          html += '<div class="card-toggle">' +
                    '<div class="card-info">' +
                      '<div class="card-icon">' + icon + '</div>' +
                      '<div class="card-text"><h3>' + feat.name + '</h3><p>' + feat.desc + '</p></div>' +
                    '</div>' +
                    '<label class="switch"><input type="checkbox" ' + checked + ' onchange="toggleFeature(\\'' + type + '\\', \\'' + feat.id + '\\', this.checked)"><span class="slider"></span></label>' +
                  '</div>';
        });
        html += '</div>';
      });
      return html;
    }

    function generateSettingsHtml(categories, dbData, type) {
      let html = '';
      categories.forEach(cat => {
        html += '<h2 class="section-title">' + cat.category + '</h2>';
        if (cat.desc) html += '<p class="section-desc">' + cat.desc + '</p>';
        html += '<div class="grid">';
        cat.items.forEach(item => {
          const inputId = 'input_' + type + '_' + item.id;
          const rawVal = dbData ? dbData[item.id] : null;

          if (item.type === 'color') {
            const hexColor = intToHex(rawVal, '#5865F2');
            html += '<div class="card-input">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<div class="color-picker-wrapper"><input type="color" value="' + hexColor + '" oninput="document.getElementById(\\'' + inputId + '\\').value = this.value"></div>' +
                        '<input type="text" id="' + inputId + '" value="' + hexColor + '">' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'color\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          } else if (item.type === 'textarea') {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="card-input" style="grid-column: 1 / -1;">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<textarea id="' + inputId + '" placeholder="' + item.placeholder + '">' + val + '</textarea>' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'text\\')">Salvar</button>' +
                      '</div>' +
                      '<div class="tag-container">' +
                        '<span class="tag" onclick="insertTag(\\'' + inputId + '\\', \\'{user}\\')">+{user}</span>' +
                        '<span class="tag" onclick="insertTag(\\'' + inputId + '\\', \\'{guild}\\')">+{guild}</span>' +
                      '</div>' +
                    '</div>';
          } else {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="card-input">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<input type="' + item.type + '" id="' + inputId + '" placeholder="' + item.placeholder + '" value="' + val + '">' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'' + item.type + '\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          }
        });
        html += '</div>';
      });
      return html;
    }

    function renderModules(containerId, categories, dbData, type) {
      document.getElementById(containerId).innerHTML = generateModulesHtml(categories, dbData, type);
    }
    function renderSettings(containerId, categories, dbData, type) {
      document.getElementById(containerId).innerHTML = generateSettingsHtml(categories, dbData, type);
    }

    async function toggleFeature(type, feature, state) {
      const guildId = document.getElementById('serverSelect').value;
      const res = await fetch('/api/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature, state }) });
      res.ok ? showToast('Módulo atualizado!') : showToast('Falha ao salvar.', true);
    }

    async function saveSetting(type, feature, inputId, valueType) {
      const guildId = document.getElementById('serverSelect').value;
      const value = document.getElementById(inputId).value;
      const res = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature, value, valueType }) });
      res.ok ? showToast('Configuração salva com sucesso!') : showToast('Erro ao salvar.', true);
    }

    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.className = isError ? 'show error' : 'show';
      setTimeout(() => { toast.className = ''; }, 3000);
    }

    window.onload = loadConfig;
  </script>
</body>
</html>`);
  });

  app.listen(port, '0.0.0.0', () => console.log(`🌐 Dashboard Web rodando na porta ${port}`));
}
