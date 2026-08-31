import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma } from '../database/client';

const BOT_OWNER_ID = '1195254699943796791';

const SERVER_CATEGORIES = [
  {
    category: "🤖 Inteligência Artificial",
    desc: "Sistemas de voz e conversação avançada",
    features: [
      { id: 'featVoiceAi', name: 'Callia (IA de Voz)', desc: 'Permite que os membros chamem o Bryan ou a IA Local.', icon: '🎙️' }
    ]
  },
  {
    category: "📸 Social & Comunidade",
    desc: "Engajamento, interações e rede social interna",
    features: [
      { id: 'featSocial', name: 'Feed Social / Insta', desc: 'Postagens de fotos com curtidas e comentários.', icon: '📸' },
      { id: 'featLeveling', name: 'Sistema de XP', desc: 'Progressão por mensagens e avisos.', icon: '⭐' },
      { id: 'featGiveaways', name: 'Sorteios', desc: 'Sorteios automatizados.', icon: '🎁' },
      { id: 'featPolls', name: 'Enquetes', desc: 'Votações com contagem de votos.', icon: '📊' },
      { id: 'featReviveChat', name: 'Reviver Chat (IA)', desc: 'Acorda o chat com perguntas geradas por IA após inatividade.', icon: '🧟' }
    ]
  },
  {
    category: "⚔️ RPG & Economia",
    desc: "Sistemas de progressão, missões e mercado",
    features: [
      { id: 'featRpg', name: 'Sistema RPG', desc: 'Ativa todo o ecossistema RPG.', icon: '⚔️' },
      { id: 'featEconomy', name: 'Economia & Loja', desc: 'Sistema de moedas e loja de itens.', icon: '🪙' },
      { id: 'featMissions', name: 'Missões Diárias', desc: 'Desafios automáticos com recompensas.', icon: '📜' }
    ]
  },
  {
    category: "🛡️ Segurança & Moderação",
    desc: "Proteção em tempo real contra ataques e spam",
    features: [
      { id: 'featMod', name: 'Módulo de Moderação', desc: 'Comandos administrativos, ban, kick e warns.', icon: '🔨' },
      { id: 'antiSpam', name: 'Defesa Anti-Spam', desc: 'Bloqueia envio rápido de mensagens.', icon: '⚡' },
      { id: 'antiLinks', name: 'Filtro Anti-Links', desc: 'Remove convites e links suspeitos.', icon: '🔗' }
    ]
  },
  {
    category: "🎫 Atendimento & Utilidades",
    desc: "Suporte aos membros e streaming",
    features: [
      { id: 'featTickets', name: 'Tickets de Suporte', desc: 'Salas privadas de atendimento.', icon: '🎫' },
      { id: 'featSelfRole', name: 'Registro de Auto-Cargos', desc: 'Menus de seleção para cargos.', icon: '🎭' },
      { id: 'featMusic', name: 'Player de Música', desc: 'Streaming de áudio em canais de voz.', icon: '🎵' },
      { id: 'featAnnouncements', name: 'Anúncios & Eventos', desc: 'Transmissão de comunicados.', icon: '📢' }
    ]
  }
];

const GLOBAL_CATEGORIES = [
  {
    category: "⚙️ Sistemas Centrais Globais",
    features: [
      { id: 'featAfk', name: 'Sistema AFK Global', desc: 'Comando /afk na rede.' },
      { id: 'featWelcomeDm', name: 'DM de Boas-vindas', desc: 'Mensagem privada a novos membros.' }
    ]
  },
  {
    category: "🌍 Master Switches (Trava Absoluta)",
    features: [
      { id: 'featSocial', name: 'Feed Social (Insta)', desc: 'Desativa o Feed globalmente.' },
      { id: 'featVoiceAi', name: 'IA de Voz (Callia)', desc: 'Proíbe a Callia em todos os servers.' },
      { id: 'featRpg', name: 'Sistema RPG', desc: 'Desliga o RPG globalmente.' },
      { id: 'featEconomy', name: 'Economia & Lojas', desc: 'Congela todas as lojas.' },
      { id: 'featTickets', name: 'Sistema de Tickets', desc: 'Bloqueia novos atendimentos.' },
      { id: 'featMusic', name: 'Player de Música', desc: 'Desliga o bot de música.' },
      { id: 'antiSpam', name: 'Defesa Anti-Spam', desc: 'Desativa o bloqueador em massa.' },
      { id: 'featGiveaways', name: 'Sorteios', desc: 'Trava todos os sorteios.' },
      { id: 'featLeveling', name: 'Sistema de XP', desc: 'Congela ganho de XP global.' },
      { id: 'featReviveChat', name: 'Reviver Chat (IA)', desc: 'Desliga o monitor de inatividade.' }
    ]
  }
];

const SERVER_SETTINGS = [
  {
    category: "💬 Recepção Personalizada (Boas-Vindas)",
    desc: "Crie um embed rico para receber os novos membros no servidor.",
    items: [
      { id: 'welcomeMessage', name: 'Construtor de Embed', type: 'embed_builder', placeholder: '' }
    ]
  },
  {
    category: "🤖 Fábrica de IA (Bot Customizado)",
    desc: "Configure a personalidade da IA caso este servidor não possua a Suki.",
    items: [
      { id: 'aiCustomName', name: 'Nome da IA Local', type: 'text', placeholder: 'Ex: Jarvis, Cortana...' },
      { id: 'aiCustomVoice', name: 'Voz da IA (M/F)', type: 'text', placeholder: 'Masculina ou Feminina' },
      { id: 'aiCustomAvatar', name: 'Avatar da IA (URL)', type: 'text', placeholder: 'Link de uma imagem png/jpg' },
      { id: 'aiSystemPrompt', name: 'Prompt de Comportamento Base', type: 'textarea', placeholder: 'Descreva a personalidade da IA para este servidor...' }
    ]
  },
  {
    category: "💎 Sistema VIP & Gradientes",
    desc: "Configuração do ecossistema de apoiadores e benefícios",
    items: [
      { id: 'vipRoleId', name: 'Cargo VIP Base (ID)', type: 'text', placeholder: 'ID do cargo' },
      { id: 'vipTicketCategoryId', name: 'Cat. de Gradiente (ID)', type: 'text', placeholder: 'Categoria de tickets' }
    ]
  },
  {
    category: "📸 Feed Social / Instagram",
    desc: "Personalize a aparência dos posts e canais de fotos",
    items: [
      { id: 'feedChannelId', name: 'Canal do Feed (ID)', type: 'text', placeholder: 'ID do canal' },
      { id: 'feedEmbedColor', name: 'Cor do Card (HEX)', type: 'color', placeholder: '#E1306C' },
      { id: 'feedLikeEmoji', name: 'Emoji de Curtir', type: 'text', placeholder: '❤️' },
      { id: 'feedFollowEmoji', name: 'Emoji de Seguir', type: 'text', placeholder: '🔔' },
      { id: 'feedCommentEmoji', name: 'Emoji de Comentar', type: 'text', placeholder: '💬' },
      { id: 'feedFooterText', name: 'Rodapé das Postagens', type: 'text', placeholder: '📸 Instagram Skyline' }
    ]
  },
  {
    category: "🧟 Sistema de Reviver Chat",
    desc: "O bot enviará uma pergunta gerada por IA para reanimar o chat se ninguém falar nada.",
    items: [
      { id: 'reviveChannelId', name: 'Canal Alvo (ID)', type: 'text', placeholder: 'ID do canal principal de bate-papo' },
      { id: 'reviveRoleId', name: 'Cargo para Mencionar (ID)', type: 'text', placeholder: 'Ex: ID do cargo @Chat ou @Membros' },
      { id: 'reviveTimeout', name: 'Tempo de Inatividade', type: 'number', placeholder: 'Tempo em minutos (Ex: 120 para 2 horas)' },
      { id: 'revivePrompt', name: 'Prompt da IA', type: 'textarea', placeholder: 'Ex: Faça uma pergunta polêmica e divertida sobre animes ou jogos.' }
    ]
  },
  {
    category: "🌌 Rede Aliança Skyline",
    desc: "Integração oficial do servidor na rede global",
    items: [
      { id: 'allianceChannelId', name: 'Canal da Aliança (ID)', type: 'text', placeholder: 'ID do canal' }
    ]
  },
  {
    category: "📁 Canais de Notificação & Logs",
    desc: "Direcione onde cada sistema do bot enviará avisos",
    items: [
      { id: 'welcomeChannelId', name: 'Canal de Boas-Vindas', type: 'text', placeholder: 'ID do canal' },
      { id: 'announcementChannelId', name: 'Canal de Anúncios', type: 'text', placeholder: 'ID do canal' },
      { id: 'logChannelId', name: 'Canal de Logs Gerais', type: 'text', placeholder: 'ID do canal' },
      { id: 'levelUpChannelId', name: 'Canal de Level Up', type: 'text', placeholder: 'ID do canal' },
      { id: 'suggestionChannelId', name: 'Canal de Sugestões', type: 'text', placeholder: 'ID do canal' },
      { id: 'feedbackChannelId', name: 'Canal de Feedback', type: 'text', placeholder: 'ID do canal' }
    ]
  },
  {
    category: "🎫 Sistema de Tickets",
    desc: "Configuração de atendimento e histórico",
    items: [
      { id: 'ticketCategoryId', name: 'Categoria dos Tickets', type: 'text', placeholder: 'ID da categoria' },
      { id: 'ticketLogChannelId', name: 'Canal de Transcrições', type: 'text', placeholder: 'ID do canal' }
    ]
  },
  {
    category: "🛡️ Cargos de Permissão & Moderação",
    desc: "Definição de hierarquia e cargos automáticos",
    items: [
      { id: 'adminRoleId', name: 'Cargo de Administrador', type: 'text', placeholder: 'ID do cargo' },
      { id: 'modRoleId', name: 'Cargo de Moderador', type: 'text', placeholder: 'ID do cargo' },
      { id: 'autoRoleId', name: 'Cargo Automático', type: 'text', placeholder: 'ID do cargo' },
      { id: 'memberRoleId', name: 'Membro Registrado', type: 'text', placeholder: 'ID do cargo' },
      { id: 'mutedRoleId', name: 'Silenciado (Muted)', type: 'text', placeholder: 'ID do cargo' }
    ]
  }
];

const GLOBAL_SETTINGS = [
  {
    category: "🤖 Perfil Oficial do Bryan (Configurador)",
    desc: "Altere a aparência, bio e status dinâmicos do Bryan diretamente no Discord.",
    items: [
      { id: 'botAvatarUrl', name: 'Foto de Perfil (URL)', type: 'text', placeholder: 'Link da imagem (terminada em .png ou .jpg)' },
      { id: 'botBannerUrl', name: 'Banner do Perfil (URL)', type: 'text', placeholder: 'Link do banner' },
      { id: 'botPronouns', name: 'Pronomes', type: 'text', placeholder: 'Ex: Ele/Dele' },
      { id: 'botBio', name: 'Biografia do Perfil', type: 'textarea', placeholder: 'Escreva a bio que aparecerá no perfil do bot' },
      { id: 'botStatusRotation', name: 'Status Rotativo (1 por linha)', type: 'textarea', placeholder: 'Ex:\nJogando Roblox\nAssistindo Netflix\nOuvindo Spotify' }
    ]
  },
  {
    category: "🎨 Identidade Visual Global dos Embeds",
    desc: "Personalização de rodapés e cores em todos os servidores",
    items: [
      { id: 'footerText', name: 'Texto de Rodapé Padrão', type: 'text', placeholder: 'Aparece nos embeds gerais' },
      { id: 'rpFooterText', name: 'Rodapé Roleplay', type: 'text', placeholder: 'Aparece nos comandos de /rp' },
      { id: 'botIconUrl', name: 'URL do Ícone do Bot', type: 'text', placeholder: 'Link direto da imagem do ícone para Embeds' },
      { id: 'primaryColor', name: 'Cor Primária dos Embeds', type: 'color', placeholder: '#5865F2' }
    ]
  }
];

async function validateGuildAccess(userId: string, guildId: string): Promise<boolean> {
  if (userId === BOT_OWNER_ID) return true;
  const access = await prisma.allianceServerMember.findFirst({ where: { userId, guildId } });
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

  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bryan Bot — Moderação, IA e RPG</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #111214; --card: #1E1F22; --card-hover: #2B2D31; --border: #313338; --blurple: #5865F2; --blurple-hover: #4752C4; --text: #F2F3F5; --text-muted: #B5BAC1; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background: var(--bg); color: var(--text); overflow-x: hidden; line-height: 1.6; }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem 5%; background: rgba(17, 18, 20, 0.9); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid var(--border); }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 1.25rem; color: white; text-decoration: none; }
    .brand img { width: 36px; height: 36px; border-radius: 50%; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.95rem; margin-left: 20px; transition: 0.2s; }
    .nav-links a:hover { color: white; }
    .nav-links .btn-login { background: var(--blurple); color: white; padding: 8px 18px; border-radius: 4px; margin-left: 20px; }
    .nav-links .btn-login:hover { background: var(--blurple-hover); }
    .hero { text-align: center; padding: 120px 20px 80px 20px; position: relative; }
    .hero::before { content: ''; position: absolute; top: -50%; left: 50%; transform: translateX(-50%); width: 800px; height: 800px; background: radial-gradient(circle, rgba(88,101,242,0.15) 0%, transparent 60%); z-index: -1; }
    .hero h1 { font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 800; letter-spacing: -1.5px; margin-bottom: 20px; line-height: 1.1; }
    .hero p { font-size: 1.1rem; color: var(--text-muted); max-width: 650px; margin: 0 auto 40px auto; }
    .btn-group { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }
    .btn { padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 1rem; text-decoration: none; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary { background: var(--blurple); color: white; }
    .btn-primary:hover { background: var(--blurple-hover); transform: translateY(-2px); }
    .btn-secondary { background: var(--card); color: white; border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--card-hover); transform: translateY(-2px); }
    .features { padding: 80px 5%; max-width: 1200px; margin: 0 auto; }
    .features-title { text-align: center; font-size: 2rem; font-weight: 800; margin-bottom: 50px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
    .card { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 12px; transition: 0.3s; }
    .card:hover { border-color: var(--blurple); transform: translateY(-5px); }
    .card-icon { width: 50px; height: 50px; background: rgba(88,101,242,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 20px; }
    .card h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 12px; }
    .card p { color: var(--text-muted); font-size: 0.95rem; }
    footer { text-align: center; padding: 40px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.9rem; margin-top: 50px; }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="brand"><img src="/skylineicon.jpg" alt="Logo"> Bryan Bot</a>
    <div class="nav-links">
      <a href="${botInviteUrl}">Adicionar ao Discord</a>
      <a href="/login" class="btn-login">Acessar Painel</a>
    </div>
  </nav>
  <header class="hero">
    <h1>Suba o nível do seu servidor.</h1>
    <p>A ferramenta definitiva para a sua comunidade. Inteligência Artificial por voz, Feed do Instagram, RPG completo e ferramentas de moderação blindadas em um só lugar.</p>
    <div class="btn-group">
      <a href="${botInviteUrl}" class="btn btn-primary">Adicionar ao Discord</a>
      <a href="/login" class="btn btn-secondary">Configurar Bot</a>
    </div>
  </header>
  <section class="features">
    <h2 class="features-title">Por que escolher o Bryan?</h2>
    <div class="grid">
      <div class="card"><div class="card-icon">🎙️</div><h3>Inteligência Artificial</h3><p>Acesse chamadas de voz com o Bryan ou crie a sua IA exclusiva.</p></div>
      <div class="card"><div class="card-icon">📸</div><h3>Feed Social (Instagram)</h3><p>Crie uma rede social dentro do servidor com notificações.</p></div>
      <div class="card"><div class="card-icon">⚔️</div><h3>RPG & Economia</h3><p>Ecossistema com Dungeons, World Bosses e missões diárias.</p></div>
      <div class="card"><div class="card-icon">💎</div><h3>Sistema VIP</h3><p>Recompense os apoiadores com cargos e gradientes exclusivos.</p></div>
      <div class="card"><div class="card-icon">🎫</div><h3>Sistema de Tickets</h3><p>Organize o atendimento com salvamento de histórico.</p></div>
      <div class="card"><div class="card-icon">🎵</div><h3>Música FFmpeg</h3><p>Qualidade de áudio de estúdio para escutar com os amigos.</p></div>
    </div>
  </section>
  <footer><p>© 2026 Bryan Bot. Feito para a Aliança Skyline.</p></footer>
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

      if (!isBotOwner && userRoles.length === 0) return res.status(403).send('<body style="background: #111214; color: #ED4245; text-align: center; padding-top: 150px; font-family: sans-serif;"><h1>🛑 Acesso Negado</h1><p style="color:white;">Sem credenciais ativas na Aliança.</p><br><a href="/" style="color: #5865F2; font-weight: bold;">Voltar</a></body>');

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

  app.post('/api/toggle', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { type, guildId, feature, state } = req.body;

    if (type === 'global' && userId !== BOT_OWNER_ID) return res.status(403).json({ error: 'Apenas o Dono pode alterar.' });
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

  app.post('/api/update', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { type, guildId, feature, value, valueType } = req.body;

    if (type === 'global' && userId !== BOT_OWNER_ID) return res.status(403).json({ error: 'Apenas o Dono pode alterar.' });
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
  <title>Dashboard - Bryan Bot</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #313338; --sidebar: #2B2D31; --header: #313338; --card: #2B2D31; --card-hover: #1E1F22; --border: #1E1F22; --blurple: #5865F2; --blurple-hover: #4752C4; --green: #23A559; --red: #DA373C; --text: #F2F3F5; --text-muted: #B5BAC1; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: #1E1F22; border-radius: 4px; }
    .sidebar { width: 260px; background: var(--sidebar); display: flex; flex-direction: column; border-right: 1px solid var(--border); }
    .brand { padding: 20px; font-size: 1.1rem; font-weight: 700; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; color: white; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
    .brand img { width: 28px; border-radius: 50%; }
    .nav-items { flex: 1; padding: 15px; display: flex; flex-direction: column; gap: 5px; }
    .nav-btn { background: transparent; color: var(--text-muted); border: none; padding: 10px 14px; border-radius: 4px; text-align: left; font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 10px; }
    .nav-btn:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }
    .nav-btn.active { background: var(--blurple); color: white; }
    .user-profile { padding: 15px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 12px; background: #232428; }
    .user-profile .avatar { width: 36px; height: 36px; border-radius: 50%; background: #1E1F22 url('/skylineicon.jpg') center/cover; }
    .user-profile .info h4 { font-size: 0.85rem; margin-bottom: 2px; color: white; }
    .user-profile .info span { font-size: 0.7rem; color: #B5BAC1; }
    .main { flex: 1; display: flex; flex-direction: column; background: var(--bg); }
    .header { padding: 15px 30px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--sidebar); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .header h2 { font-size: 1.1rem; font-weight: 600; color: white; }
    .server-selector select { background: var(--card-hover); border: 1px solid var(--border); color: white; padding: 8px 12px; border-radius: 4px; outline: none; font-size: 0.9rem; min-width: 220px; cursor: pointer; }
    .server-selector select:focus { border-color: var(--blurple); }
    .content { padding: 30px 40px; overflow-y: auto; flex: 1; }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; animation: fadeIn 0.3s; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    .section-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 5px; color: white; }
    .section-desc { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 15px; margin-bottom: 40px; }
    .card-toggle { background: var(--card); border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; border: 1px solid transparent; }
    .card-toggle:hover { background: var(--card-hover); border-color: #3f4147; }
    .card-info { display: flex; align-items: center; gap: 12px; }
    .card-icon { width: 40px; height: 40px; background: #1E1F22; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .card-text h3 { font-size: 0.95rem; margin-bottom: 2px; color: white; }
    .card-text p { font-size: 0.8rem; color: var(--text-muted); max-width: 200px; line-height: 1.3; }
    .switch { position: relative; width: 40px; height: 24px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #80848E; transition: .3s; border-radius: 34px; }
    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    input:checked + .slider { background-color: var(--green); }
    input:checked + .slider:before { transform: translateX(16px); }
    .card-input { background: var(--card); border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 10px; border: 1px solid transparent; transition: 0.2s; }
    .card-input:hover { background: var(--card-hover); border-color: #3f4147; }
    .card-input label { font-size: 0.9rem; font-weight: 600; color: white; }
    .input-group { display: flex; gap: 10px; }
    .input-group input[type="text"], .input-group input[type="number"], .input-group textarea { flex: 1; background: #1E1F22; border: 1px solid transparent; color: white; padding: 10px; border-radius: 4px; outline: none; font-size: 0.9rem; transition: 0.2s; }
    .input-group input:focus, .input-group textarea:focus { border-color: var(--blurple); }
    .input-group textarea { resize: vertical; min-height: 80px; }
    .color-picker-wrapper { width: 38px; height: 38px; border-radius: 4px; overflow: hidden; border: 1px solid #1E1F22; cursor: pointer; }
    .color-picker-wrapper input { width: 200%; height: 200%; transform: translate(-25%, -25%); cursor: pointer; }
    .btn-save { background: var(--blurple); color: white; border: none; padding: 0 15px; border-radius: 4px; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: 0.2s; white-space: nowrap; }
    .btn-save:hover { background: var(--blurple-hover); }
    .tag-container { display: flex; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
    .tag { background: #1E1F22; color: var(--text-muted); font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
    .tag:hover { background: var(--blurple); color: white; }
    
    /* Discord Live Preview Styles */
    .discord-preview { background: #313338; border-radius: 6px; padding: 15px; margin-top: 10px; border: 1px solid #1E1F22; }
    .discord-msg-header { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
    .discord-msg-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--blurple); }
    .discord-msg-name { color: #F2F3F5; font-weight: 500; font-size: 1rem; }
    .discord-msg-time { color: #80848E; font-size: 0.75rem; margin-left: 5px; }
    .discord-embed { border-left: 4px solid var(--blurple); background: #2B2D31; border-radius: 4px; padding: 12px 16px; margin-top: 5px; max-width: 430px; display: flex; flex-direction: column; gap: 8px; }
    .discord-embed-title { color: #FFFFFF; font-weight: 600; font-size: 1rem; }
    .discord-embed-desc { color: #DBDEE1; font-size: 0.875rem; white-space: pre-wrap; line-height: 1.3; }
    .discord-embed-thumb { float: right; max-width: 80px; max-height: 80px; border-radius: 4px; margin-left: 15px; }
    .discord-embed-image { max-width: 100%; border-radius: 4px; margin-top: 8px; }
    .discord-embed-body { display: flex; justify-content: space-between; }
    .discord-mention { color: #C9CDD2; background: rgba(88, 101, 242, 0.3); padding: 0 3px; border-radius: 3px; font-weight: 500; }

    #toast { visibility: hidden; min-width: 250px; background: var(--green); color: white; text-align: center; border-radius: 4px; padding: 12px 20px; position: fixed; right: 30px; bottom: 30px; font-weight: 500; font-size: 0.95rem; opacity: 0; transition: 0.3s; z-index: 1000; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
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
      ${userId === BOT_OWNER_ID ? `<button class="nav-btn" onclick="switchTab('global', this)">🌍 Travas Globais</button>` : ''}
    </div>
    <div class="user-profile">
      <div class="avatar"></div>
      <div class="info">
        <h4>${userName}</h4>
        <span>${userId === BOT_OWNER_ID ? 'Dono do Bot' : 'Admin do Servidor'}</span>
      </div>
    </div>
  </div>
  <div class="main">
    <div class="header">
      <h2>Painel de Controle</h2>
      <div class="server-selector">
        <select id="serverSelect" onchange="loadConfig()">${serverOptionsHTML}</select>
      </div>
    </div>
    <div class="content">
      <div id="modulos" class="tab-pane active"></div>
      <div id="configs" class="tab-pane"></div>
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
      return '#' + num.toString(16).padStart(6, '0').toUpperCase();
    }

    function switchTab(tabId, btn) {
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      btn.classList.add('active');
    }

    function insertTag(inputId, tag) {
      const el = document.getElementById(inputId);
      if (!el) return; el.value += tag + ' '; el.focus();
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
      
      setTimeout(() => {
        document.querySelectorAll('.embed-builder-desc').forEach(el => {
           const id = el.id.replace('_desc', '');
           updatePreview(id);
        });
      }, 200);
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
        html += '<div class="grid" ' + (cat.items.some(i => i.type === 'embed_builder') ? 'style="display: flex; flex-direction: column;"' : '') + '>';
        cat.items.forEach(item => {
          const inputId = 'input_' + type + '_' + item.id;
          const rawVal = dbData ? dbData[item.id] : null;

          if (item.type === 'embed_builder') {
            let parsed = { title: '', description: '', color: '#5865F2', thumbnail: '', image: '' };
            if (rawVal) {
              try { parsed = rawVal.startsWith('{') ? JSON.parse(rawVal) : { title: '', description: rawVal, color: '#5865F2', thumbnail: '', image: '' }; } catch(e) {}
            }
            html += '<div class="card-input" style="width: 100%;">' +
                      '<label>🛠️ Construtor de Embed</label>' +
                      '<div style="display: flex; gap: 30px; flex-wrap: wrap; margin-top: 5px;">' +
                        '<div style="flex: 1; min-width: 300px; display: flex; flex-direction: column; gap: 12px;">' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_title" placeholder="Título (Opcional)" value="' + (parsed.title || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="input-group"><textarea id="' + inputId + '_desc" class="embed-builder-desc" placeholder="Descrição (Use {user}, {guild}, {memberCount})" oninput="updatePreview(\\'' + inputId + '\\')" style="min-height: 120px;">' + (parsed.description || '') + '</textarea></div>' +
                          '<div class="input-group">' +
                             '<div class="color-picker-wrapper"><input type="color" id="' + inputId + '_color" value="' + (parsed.color || '#5865F2') + '" oninput="document.getElementById(\\'' + inputId + '_color_text\\').value = this.value.toUpperCase(); updatePreview(\\'' + inputId + '\\')"></div>' +
                             '<input type="text" id="' + inputId + '_color_text" value="' + (parsed.color || '#5865F2') + '" oninput="document.getElementById(\\'' + inputId + '_color\\').value = this.value; updatePreview(\\'' + inputId + '\\')">' +
                          '</div>' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_thumb" placeholder="URL da Thumbnail (Opcional)" value="' + (parsed.thumbnail || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_img" placeholder="URL da Imagem Maior (Opcional)" value="' + (parsed.image || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="tag-container" style="margin-top:0;">' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{user}\\'); updatePreview(\\'' + inputId + '\\')">+{user}</span>' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{guild}\\'); updatePreview(\\'' + inputId + '\\')">+{guild}</span>' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{memberCount}\\'); updatePreview(\\'' + inputId + '\\')">+{memberCount}</span>' +
                          '</div>' +
                          '<button class="btn-save" style="margin-top: 10px; padding: 12px;" onclick="saveEmbedBuilder(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\')">💾 Salvar Embed</button>' +
                        '</div>' +
                        '<div style="flex: 1; min-width: 320px;">' +
                          '<label style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 5px; display: block;">Preview em Tempo Real</label>' +
                          '<div class="discord-preview">' +
                            '<div class="discord-msg-header"><div class="discord-msg-avatar"></div><div><span class="discord-msg-name">Bryan Bot</span><span class="discord-msg-time">Hoje às 12:00</span></div></div>' +
                            '<div class="discord-embed" id="' + inputId + '_preview_card" style="border-left-color: ' + (parsed.color || '#5865F2') + ';">' +
                              '<div class="discord-embed-body">' +
                                '<div style="flex: 1;">' +
                                  '<div class="discord-embed-title" id="' + inputId + '_preview_title"></div>' +
                                  '<div class="discord-embed-desc" id="' + inputId + '_preview_desc"></div>' +
                                '</div>' +
                                '<img id="' + inputId + '_preview_thumb" class="discord-embed-thumb" style="display: none;">' +
                              '</div>' +
                              '<img id="' + inputId + '_preview_img" class="discord-embed-image" style="display: none;">' +
                            '</div>' +
                          '</div>' +
                        '</div>' +
                      '</div>' +
                    '</div>';
          } else if (item.type === 'color') {
            const hexColor = intToHex(rawVal, '#E1306C');
            html += '<div class="card-input">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<div class="color-picker-wrapper"><input type="color" value="' + hexColor + '" oninput="document.getElementById(\\'' + inputId + '\\').value = this.value.toUpperCase()"></div>' +
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

    function updatePreview(inputId) {
      const title = document.getElementById(inputId + '_title').value;
      const desc = document.getElementById(inputId + '_desc').value;
      const color = document.getElementById(inputId + '_color').value;
      const thumb = document.getElementById(inputId + '_thumb').value;
      const img = document.getElementById(inputId + '_img').value;

      document.getElementById(inputId + '_preview_card').style.borderLeftColor = color;
      
      const titleEl = document.getElementById(inputId + '_preview_title');
      titleEl.innerText = title;
      titleEl.style.display = title ? 'block' : 'none';

      let parsedDesc = desc
        .replace(/\{user\}/g, '<span class="discord-mention">@NovoMembro</span>')
        .replace(/\{guild\}/g, '<b>Aliança Skyline</b>')
        .replace(/\{memberCount\}/g, '<b>1.500</b>')
        .replace(/\\n/g, '<br>');
      document.getElementById(inputId + '_preview_desc').innerHTML = parsedDesc;

      const thumbEl = document.getElementById(inputId + '_preview_thumb');
      if (thumb) { thumbEl.src = thumb; thumbEl.style.display = 'block'; } else { thumbEl.style.display = 'none'; }

      const imgEl = document.getElementById(inputId + '_preview_img');
      if (img) { imgEl.src = img; imgEl.style.display = 'block'; } else { imgEl.style.display = 'none'; }
    }

    async function saveEmbedBuilder(type, feature, inputId) {
      const guildId = document.getElementById('serverSelect').value;
      const payload = {
        title: document.getElementById(inputId + '_title').value.trim(),
        description: document.getElementById(inputId + '_desc').value.trim(),
        color: document.getElementById(inputId + '_color').value,
        thumbnail: document.getElementById(inputId + '_thumb').value.trim(),
        image: document.getElementById(inputId + '_img').value.trim()
      };
      
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, guildId, feature, value: JSON.stringify(payload), valueType: 'text' })
      });
      res.ok ? showToast('✅ Embed salvo com sucesso!') : showToast('❌ Erro ao salvar.', true);
    }

    function renderModules(containerId, categories, dbData, type) { document.getElementById(containerId).innerHTML = generateModulesHtml(categories, dbData, type); }
    function renderSettings(containerId, categories, dbData, type) { document.getElementById(containerId).innerHTML = generateSettingsHtml(categories, dbData, type); }

    async function toggleFeature(type, feature, state) {
      const guildId = document.getElementById('serverSelect').value;
      const res = await fetch('/api/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature, state }) });
      res.ok ? showToast('Módulo atualizado com sucesso!') : showToast('Falha ao salvar módulo.', true);
    }

    async function saveSetting(type, feature, inputId, valueType) {
      const guildId = document.getElementById('serverSelect').value;
      const value = document.getElementById(inputId).value;
      const res = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature, value, valueType }) });
      res.ok ? showToast('Configuração salva com sucesso!') : showToast('Erro ao atualizar configuração.', true);
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
