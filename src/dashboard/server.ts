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
    category: "💬 Boas-Vindas",
    desc: "Crie um embed rico para receber os novos membros no servidor.",
    items: [
      { id: 'welcomeMessage', name: 'Construtor de Embed', type: 'embed_builder', placeholder: '' }
    ]
  },
  {
    category: "🤖 IA Customizada",
    desc: "Configure a personalidade da IA caso este servidor não possua a Suki.",
    items: [
      { id: 'aiCustomName', name: 'Nome da IA Local', type: 'text', placeholder: 'Ex: Jarvis, Cortana...' },
      { id: 'aiCustomVoice', name: 'Voz da IA (M/F)', type: 'text', placeholder: 'Masculina ou Feminina' },
      { id: 'aiCustomAvatar', name: 'Avatar da IA (URL)', type: 'text', placeholder: 'Link de uma imagem png/jpg' },
      { id: 'aiSystemPrompt', name: 'Prompt de Comportamento Base', type: 'textarea', placeholder: 'Descreva a personalidade da IA para este servidor...' }
    ]
  },
  {
    category: "🧟 Reviver Chat",
    desc: "O bot enviará uma pergunta gerada por IA para reanimar o chat inativo.",
    items: [
      { id: 'reviveChannelId', name: 'Canal Alvo', type: 'channel', placeholder: 'Selecione o canal' },
      { id: 'reviveRoleId', name: 'Cargo para Mencionar', type: 'role', placeholder: 'Selecione o cargo' },
      { id: 'reviveTimeout', name: 'Tempo de Inatividade', type: 'number', placeholder: 'Tempo em minutos (Ex: 120 para 2 horas)' },
      { id: 'revivePrompt', name: 'Prompt da IA', type: 'textarea', placeholder: 'Ex: Faça uma pergunta polêmica e divertida sobre animes ou jogos.' }
    ]
  },
  {
    category: "💎 Sistema VIP",
    desc: "Configuração do ecossistema de apoiadores e benefícios",
    items: [
      { id: 'vipRoleId', name: 'Cargo VIP Base', type: 'role', placeholder: 'Selecione o cargo' },
      { id: 'vipTicketCategoryId', name: 'Cat. de Gradiente', type: 'channel', placeholder: 'Selecione a categoria' }
    ]
  },
  {
    category: "📸 Feed Social",
    desc: "Personalize a aparência dos posts e canais de fotos",
    items: [
      { id: 'feedChannelId', name: 'Canal do Feed', type: 'channel', placeholder: 'Selecione o canal' },
      { id: 'feedEmbedColor', name: 'Cor do Card (HEX)', type: 'color', placeholder: '#8B5CF6' },
      { id: 'feedLikeEmoji', name: 'Emoji de Curtir', type: 'text', placeholder: '❤️' },
      { id: 'feedFollowEmoji', name: 'Emoji de Seguir', type: 'text', placeholder: '🔔' },
      { id: 'feedCommentEmoji', name: 'Emoji de Comentar', type: 'text', placeholder: '💬' },
      { id: 'feedFooterText', name: 'Rodapé das Postagens', type: 'text', placeholder: '📸 Instagram Skyline' }
    ]
  },
  {
    category: "🌌 Rede Aliança",
    desc: "Integração oficial do servidor na rede global",
    items: [
      { id: 'allianceChannelId', name: 'Canal da Aliança', type: 'channel', placeholder: 'Selecione o canal' }
    ]
  },
  {
    category: "📁 Canais de Logs",
    desc: "Direcione onde cada sistema do bot enviará avisos",
    items: [
      { id: 'welcomeChannelId', name: 'Canal de Boas-Vindas', type: 'channel', placeholder: 'Selecione o canal' },
      { id: 'announcementChannelId', name: 'Canal de Anúncios', type: 'channel', placeholder: 'Selecione o canal' },
      { id: 'logChannelId', name: 'Canal de Logs Gerais', type: 'channel', placeholder: 'Selecione o canal' },
      { id: 'levelUpChannelId', name: 'Canal de Level Up', type: 'channel', placeholder: 'Selecione o canal' },
      { id: 'suggestionChannelId', name: 'Canal de Sugestões', type: 'channel', placeholder: 'Selecione o canal' },
      { id: 'feedbackChannelId', name: 'Canal de Feedback', type: 'channel', placeholder: 'Selecione o canal' }
    ]
  },
  {
    category: "🎫 Tickets",
    desc: "Configuração de atendimento e histórico",
    items: [
      { id: 'ticketCategoryId', name: 'Categoria dos Tickets', type: 'channel', placeholder: 'Selecione a categoria' },
      { id: 'ticketLogChannelId', name: 'Canal de Transcrições', type: 'channel', placeholder: 'Selecione o canal' }
    ]
  },
  {
    category: "🛡️ Cargos",
    desc: "Definição de hierarquia e cargos automáticos",
    items: [
      { id: 'adminRoleId', name: 'Cargo de Administrador', type: 'role', placeholder: 'Selecione o cargo' },
      { id: 'modRoleId', name: 'Cargo de Moderador', type: 'role', placeholder: 'Selecione o cargo' },
      { id: 'autoRoleId', name: 'Cargo Automático', type: 'role', placeholder: 'Selecione o cargo' },
      { id: 'memberRoleId', name: 'Membro Registrado', type: 'role', placeholder: 'Selecione o cargo' },
      { id: 'mutedRoleId', name: 'Silenciado (Muted)', type: 'role', placeholder: 'Selecione o cargo' }
    ]
  }
];

const GLOBAL_SETTINGS = [
  {
    category: "🤖 Perfil do Bryan",
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
    category: "🎨 Visual Global",
    desc: "Personalização de rodapés e cores em todos os servidores",
    items: [
      { id: 'footerText', name: 'Texto de Rodapé Padrão', type: 'text', placeholder: 'Aparece nos embeds gerais' },
      { id: 'rpFooterText', name: 'Rodapé Roleplay', type: 'text', placeholder: 'Aparece nos comandos de /rp' },
      { id: 'botIconUrl', name: 'URL do Ícone do Bot', type: 'text', placeholder: 'Link direto da imagem do ícone para Embeds' },
      { id: 'primaryColor', name: 'Cor Primária dos Embeds', type: 'color', placeholder: '#8B5CF6' }
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

  // ROTA PARA AUTOCOMPLETE DE CANAIS E CARGOS DA GUILD
  app.get('/api/discord-data', async (req, res) => {
    const { guildId } = req.query;
    const token = process.env.DISCORD_TOKEN;
    if (!guildId || !token) return res.json({ channels: [], roles: [] });

    try {
      const [channelsRes, rolesRes] = await Promise.all([
        axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers: { Authorization: `Bot ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers: { Authorization: `Bot ${token}` } }).catch(() => ({ data: [] }))
      ]);

      const channels = channelsRes.data.map((c: any) => ({ id: c.id, name: c.name, type: c.type }));
      const roles = rolesRes.data.map((r: any) => ({ id: r.id, name: r.name }));

      res.json({ channels, roles });
    } catch (error) {
      res.json({ channels: [], roles: [] });
    }
  });

  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bryan Bot — Moderação, IA e RPG</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { 
      --bg: #0B0D17; 
      --card: #131521; 
      --card-hover: #1A1D2D; 
      --border: #2A2E45; 
      --primary: #8B5CF6; 
      --primary-hover: #7C3AED; 
      --text: #F2F3F5; 
      --text-muted: #9CA3AF; 
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background: var(--bg); color: var(--text); overflow-x: hidden; line-height: 1.6; }
    
    /* Nav */
    nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem 5%; background: rgba(11, 13, 23, 0.85); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid var(--border); }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 1.3rem; color: white; text-decoration: none; letter-spacing: -0.5px; }
    .brand img { width: 38px; height: 38px; border-radius: 50%; border: 2px solid var(--primary); }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.95rem; margin-left: 20px; transition: 0.2s; }
    .nav-links a:hover { color: white; }
    .nav-links .btn-login { background: var(--primary); color: white; padding: 8px 20px; border-radius: 6px; margin-left: 20px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3); }
    .nav-links .btn-login:hover { background: var(--primary-hover); }
    
    /* Hero */
    .hero { text-align: center; padding: 140px 20px 100px 20px; position: relative; overflow: hidden; }
    .hero-bg { position: absolute; top: -20%; left: 50%; transform: translateX(-50%); width: 1000px; height: 1000px; background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 60%); z-index: -1; pointer-events: none; }
    .hero h1 { font-size: clamp(2.8rem, 6vw, 5rem); font-weight: 800; letter-spacing: -2px; margin-bottom: 20px; line-height: 1.1; background: linear-gradient(to right, #fff, #A78BFA); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { font-size: 1.15rem; color: var(--text-muted); max-width: 650px; margin: 0 auto 40px auto; }
    
    /* Buttons */
    .btn-group { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }
    .btn { padding: 15px 32px; border-radius: 8px; font-weight: 600; font-size: 1rem; text-decoration: none; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary { background: var(--primary); color: white; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4); }
    .btn-primary:hover { background: var(--primary-hover); transform: translateY(-3px); box-shadow: 0 6px 25px rgba(139, 92, 246, 0.5); }
    .btn-secondary { background: var(--card); color: white; border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--card-hover); transform: translateY(-3px); border-color: var(--primary); }
    
    /* Features */
    .features { padding: 80px 5%; max-width: 1200px; margin: 0 auto; }
    .features-title { text-align: center; font-size: 2.2rem; font-weight: 800; margin-bottom: 50px; color: white; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); padding: 35px; border-radius: 16px; transition: 0.3s; position: relative; overflow: hidden; }
    .card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: var(--primary); opacity: 0; transition: 0.3s; }
    .card:hover { border-color: var(--primary); transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    .card:hover::before { opacity: 1; }
    .card-icon { width: 55px; height: 55px; background: rgba(139, 92, 246, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 20px; border: 1px solid rgba(139, 92, 246, 0.2); }
    .card h3 { font-size: 1.3rem; font-weight: 700; margin-bottom: 12px; color: white; }
    .card p { color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; }
    
    footer { text-align: center; padding: 40px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.9rem; margin-top: 50px; background: var(--card); }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="brand"><img src="/skylineicon.jpg" alt="Bryan"> Bryan Bot</a>
    <div class="nav-links">
      <a href="${botInviteUrl}">Adicionar ao Servidor</a>
      <a href="/login" class="btn-login">Acessar Painel</a>
    </div>
  </nav>
  
  <header class="hero">
    <div class="hero-bg"></div>
    <h1>O bot definitivo para o seu servidor.</h1>
    <p>Traga o <b>Bryan</b> para a sua comunidade. Inteligência Artificial avançada por voz, Feed Social nativo, RPG imersivo e moderação absoluta em um único lugar.</p>
    <div class="btn-group">
      <a href="${botInviteUrl}" class="btn btn-primary">Adicionar ao Discord</a>
      <a href="/login" class="btn btn-secondary">Configurar Bot</a>
    </div>
  </header>
  
  <section class="features">
    <h2 class="features-title">Sistemas Integrados</h2>
    <div class="grid">
      <div class="card"><div class="card-icon">🎙️</div><h3>Inteligência Artificial</h3><p>Acesse chamadas de voz com o Bryan, com a Suki ou crie a IA exclusiva do seu servidor.</p></div>
      <div class="card"><div class="card-icon">📸</div><h3>Feed Social (Instagram)</h3><p>Crie uma rede social interna perfeita com direito a seguidores, curtidas e comentários.</p></div>
      <div class="card"><div class="card-icon">⚔️</div><h3>RPG & Economia</h3><p>Um ecossistema gigante com Dungeons, World Bosses, inventário e missões diárias.</p></div>
      <div class="card"><div class="card-icon">💎</div><h3>Sistema VIP</h3><p>Recompense os apoiadores com cargos, painéis especiais e gradientes exclusivos.</p></div>
      <div class="card"><div class="card-icon">🎫</div><h3>Sistema de Tickets</h3><p>Organize o atendimento da sua comunidade com logs automáticos e transcrições.</p></div>
      <div class="card"><div class="card-icon">🎵</div><h3>Música FFmpeg</h3><p>Qualidade de áudio de estúdio para escutar Spotify ou YouTube com os amigos na call.</p></div>
    </div>
  </section>
  
  <footer><p>© 2026 Bryan Bot.</p></footer>
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
      const { id: userId, username, avatar } = userRes.data;
      
      const isBotOwner = userId === BOT_OWNER_ID;
      const userRoles = await prisma.allianceServerMember.findMany({ where: { userId } });

      if (!isBotOwner && userRoles.length === 0) return res.status(403).send('<body style="background: #0B0D17; color: #EF4444; text-align: center; padding-top: 150px; font-family: sans-serif;"><h1>🛑 Acesso Negado</h1><p style="color:#9CA3AF;">Sem permissão ativa na base de dados.</p><br><a href="/" style="color: #8B5CF6; font-weight: bold; text-decoration: none;">Voltar ao Início</a></body>');

      res.cookie('skyline_auth', 'permitido', { maxAge: 86400000 }); 
      res.cookie('skyline_userid', userId, { maxAge: 86400000 }); 
      res.cookie('skyline_username', username, { maxAge: 86400000 }); 
      if (avatar) res.cookie('skyline_avatar', avatar, { maxAge: 86400000 });

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
    const avatarHash = req.cookies?.skyline_avatar;
    
    // Avatar em alta resolução direto do Discord
    const avatarUrl = avatarHash 
      ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`
      : '/skylineicon.jpg';

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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { 
      --bg: #0B0D17; 
      --sidebar: #131521; 
      --header: #131521; 
      --card: #1A1D2D; 
      --card-hover: #22263A; 
      --border: #2A2E45; 
      --primary: #8B5CF6; 
      --primary-hover: #7C3AED; 
      --green: #10B981; 
      --red: #EF4444; 
      --text: #F2F3F5; 
      --text-muted: #9CA3AF; 
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    
    .sidebar { width: 280px; background: var(--sidebar); display: flex; flex-direction: column; border-right: 1px solid var(--border); }
    .brand { padding: 22px 20px; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 12px; color: white; border-bottom: 1px solid var(--border); letter-spacing: -0.5px; }
    .brand img { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--primary); }
    
    .nav-items { flex: 1; padding: 15px 0; overflow-y: auto; }
    .nav-group { 
      font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: var(--text-muted); 
      margin: 15px 0 5px 20px; letter-spacing: 0.5px; cursor: pointer; display: flex; align-items: center; 
      justify-content: space-between; padding-right: 20px; user-select: none; transition: 0.2s;
    }
    .nav-group:hover { color: var(--text); }
    .nav-group::after { content: '▼'; font-size: 0.6rem; transition: transform 0.2s; }
    .nav-group.collapsed::after { transform: rotate(-90deg); }
    
    .nav-children { overflow: hidden; transition: max-height 0.3s ease; max-height: 1000px; padding: 0 10px; }
    .nav-children.collapsed { max-height: 0; }
    
    .nav-btn { background: transparent; color: var(--text-muted); border: none; padding: 10px 15px; margin-bottom: 2px; width: 100%; text-align: left; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: 0.15s; border-radius: 6px; }
    .nav-btn:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }
    .nav-btn.active { background: rgba(139, 92, 246, 0.15); color: var(--primary); border-left: 3px solid var(--primary); border-radius: 0 6px 6px 0;}
    
    .user-profile { padding: 15px 20px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.2); }
    .user-profile .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--card) center/cover; border: 2px solid var(--border); }
    .user-profile .info h4 { font-size: 0.9rem; margin-bottom: 2px; color: white; font-weight: 700; }
    .user-profile .info span { font-size: 0.75rem; color: var(--primary); font-weight: 600; }
    
    .main { flex: 1; display: flex; flex-direction: column; background: var(--bg); position: relative;}
    .header { padding: 18px 40px; border-bottom: 1px solid var(--border); background: var(--header); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index:5;}
    .header h2 { font-size: 1.3rem; font-weight: 800; color: white; letter-spacing: -0.5px; }
    
    .server-selector { display: flex; align-items: center; gap: 10px; }
    .server-selector select { background: var(--card); border: 1px solid var(--border); color: white; padding: 10px 15px; border-radius: 6px; outline: none; font-size: 0.9rem; min-width: 250px; cursor: pointer; font-weight: 600; transition: 0.2s; appearance: none; }
    .server-selector select:focus, .server-selector select:hover { border-color: var(--primary); background: var(--card-hover); }

    .content { padding: 40px; overflow-y: auto; flex: 1; }
    .section-title { font-size: 1.4rem; font-weight: 800; margin-bottom: 8px; color: white; letter-spacing: -0.5px; }
    .section-desc { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 25px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .card-toggle { background: var(--card); border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; border: 1px solid var(--border); }
    .card-toggle:hover { background: var(--card-hover); border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
    .card-info { display: flex; align-items: center; gap: 15px; }
    .card-icon { width: 45px; height: 45px; background: rgba(139, 92, 246, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid rgba(139, 92, 246, 0.2); }
    .card-text h3 { font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: white; }
    .card-text p { font-size: 0.85rem; color: var(--text-muted); max-width: 220px; line-height: 1.4; }
    
    .switch { position: relative; width: 44px; height: 26px; flex-shrink: 0; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border); transition: .3s; border-radius: 34px; }
    .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: var(--text-muted); transition: .3s; border-radius: 50%; }
    input:checked + .slider { background-color: rgba(16, 185, 129, 0.2); border: 1px solid var(--green); }
    input:checked + .slider:before { transform: translateX(18px); background-color: var(--green); box-shadow: 0 0 10px var(--green); }
    
    .card-input { background: var(--card); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--border); transition: 0.2s; }
    .card-input:hover { background: var(--card-hover); border-color: var(--primary); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
    .card-input label { font-size: 0.95rem; font-weight: 700; color: white; }
    .input-group { display: flex; gap: 12px; align-items: flex-start; }
    .input-group input[type="text"], .input-group input[type="number"], .input-group textarea { flex: 1; background: #0B0D17; border: 1px solid var(--border); color: white; padding: 12px 15px; border-radius: 6px; outline: none; font-size: 0.95rem; transition: 0.2s; width: 100%; }
    .input-group input:focus, .input-group textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2); }
    .input-group textarea { resize: vertical; min-height: 90px; }
    
    /* Autocomplete Styles */
    .autocomplete { position: relative; flex: 1; width: 100%; }
    .autocomplete-items { position: absolute; border: 1px solid var(--border); border-radius: 6px; background-color: var(--card-hover); z-index: 99; top: 100%; left: 0; right: 0; max-height: 250px; overflow-y: auto; display: none; margin-top: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .autocomplete-items.show { display: block; }
    .autocomplete-item { padding: 10px 15px; cursor: pointer; color: var(--text-muted); font-size: 0.9rem; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.02); transition: 0.2s; }
    .autocomplete-item:hover { background-color: var(--primary); color: white; }
    .autocomplete-item span { color: white; font-weight: 600; }
    
    .color-picker-wrapper { width: 44px; height: 44px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); cursor: pointer; flex-shrink:0; }
    .color-picker-wrapper input { width: 200%; height: 200%; transform: translate(-25%, -25%); cursor: pointer; }
    .btn-save { background: var(--primary); color: white; border: none; padding: 0 20px; height: 44px; border-radius: 6px; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: 0.2s; white-space: nowrap; flex-shrink:0; }
    .btn-save:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4); }
    
    .tag-container { display: flex; gap: 8px; margin-top: 5px; flex-wrap: wrap; }
    .tag { background: #0B0D17; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; padding: 6px 10px; border-radius: 4px; cursor: pointer; transition: 0.2s; border: 1px solid var(--border); }
    .tag:hover { background: var(--primary); color: white; border-color: var(--primary); }
    
    /* Discord Live Preview Styles */
    .discord-preview { background: #131521; border-radius: 8px; padding: 20px; margin-top: 10px; border: 1px solid var(--border); }
    .discord-msg-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .discord-msg-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--primary); border: 2px solid var(--border); }
    .discord-msg-name { color: white; font-weight: 600; font-size: 1.05rem; }
    .discord-msg-time { color: var(--text-muted); font-size: 0.8rem; margin-left: 5px; font-weight: 500;}
    .discord-embed { border-left: 4px solid var(--primary); background: #1A1D2D; border-radius: 4px; padding: 16px; margin-top: 8px; max-width: 480px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
    .discord-embed-title { color: #FFFFFF; font-weight: 700; font-size: 1.05rem; }
    .discord-embed-desc { color: #DBDEE1; font-size: 0.9rem; white-space: pre-wrap; line-height: 1.4; }
    .discord-embed-thumb { float: right; max-width: 90px; max-height: 90px; border-radius: 6px; margin-left: 15px; }
    .discord-embed-image { max-width: 100%; border-radius: 6px; margin-top: 10px; border: 1px solid rgba(255,255,255,0.05); }
    .discord-embed-body { display: flex; justify-content: space-between; }
    .discord-mention { color: #C9CDD2; background: rgba(139, 92, 246, 0.3); padding: 0 4px; border-radius: 4px; font-weight: 600; }

    #toast { visibility: hidden; min-width: 250px; background: var(--green); color: white; text-align: center; border-radius: 6px; padding: 14px 24px; position: fixed; right: 40px; bottom: 40px; font-weight: 600; font-size: 1rem; opacity: 0; transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    #toast.error { background: var(--red); }
    #toast.show { visibility: visible; opacity: 1; transform: translateY(-15px); }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="brand"><img src="/skylineicon.jpg" alt="Logo"> Bryan Bot</div>
    <div class="nav-items" id="sidebar-nav">
      <!-- Nav gerada via JS -->
    </div>
    <div class="user-profile">
      <div class="avatar" style="background-image: url('${avatarUrl}');"></div>
      <div class="info">
        <h4>${userName}</h4>
        <span>${userId === BOT_OWNER_ID ? 'Dono do Bot' : 'Admin do Servidor'}</span>
      </div>
    </div>
  </div>
  
  <div class="main">
    <div class="header">
      <h2 id="main-header-title">Visão Geral</h2>
      <div class="server-selector">
        <select id="serverSelect" onchange="loadConfig()">${serverOptionsHTML}</select>
      </div>
    </div>
    <div class="content" id="main-content">
      <!-- Conteúdo gerado via JS -->
    </div>
  </div>
  
  <div id="toast">Ação concluída!</div>
  
  <script>
    const SERVER_CATEGORIES = ${JSON.stringify(SERVER_CATEGORIES)};
    const GLOBAL_CATEGORIES = ${JSON.stringify(GLOBAL_CATEGORIES)};
    const SERVER_SETTINGS = ${JSON.stringify(SERVER_SETTINGS)};
    const GLOBAL_SETTINGS = ${JSON.stringify(GLOBAL_SETTINGS)};
    
    let stateData = null;
    let discordDataCache = { channels: [], roles: [] };

    function intToHex(num, fallback = '#8B5CF6') {
      if (num === null || num === undefined || isNaN(num)) return fallback;
      return '#' + num.toString(16).padStart(6, '0').toUpperCase();
    }

    function insertTag(inputId, tag) {
      const el = document.getElementById(inputId);
      if (!el) return; el.value += tag + ' '; el.focus();
    }

    function toggleNavGroup(headerEl) {
      headerEl.classList.toggle('collapsed');
      headerEl.nextElementSibling.classList.toggle('collapsed');
    }

    async function loadConfig() {
      const guildId = document.getElementById('serverSelect').value;
      if (!guildId) return;
      
      const [resConfig, resDiscord] = await Promise.all([
        fetch('/api/config?guildId=' + guildId),
        fetch('/api/discord-data?guildId=' + guildId)
      ]);
      
      stateData = await resConfig.json();
      discordDataCache = await resDiscord.json();
      
      buildNavigation(stateData.isOwner);
    }

    function buildNavigation(isOwner) {
      const navContainer = document.getElementById('sidebar-nav');
      let navHtml = '';

      navHtml += '<div class="nav-group" onclick="toggleNavGroup(this)">Módulos do Servidor</div><div class="nav-children">';
      SERVER_CATEGORIES.forEach((cat, i) => {
        navHtml += \`<button class="nav-btn" onclick="renderContent('modulos', \${i}, this)">\${cat.category.substring(3)}</button>\`;
      });
      navHtml += '</div>';

      navHtml += '<div class="nav-group" onclick="toggleNavGroup(this)">Configurações</div><div class="nav-children">';
      SERVER_SETTINGS.forEach((cat, i) => {
        navHtml += \`<button class="nav-btn" onclick="renderContent('configs', \${i}, this)">\${cat.category.substring(3)}</button>\`;
      });
      navHtml += '</div>';

      if (isOwner) {
        navHtml += '<div class="nav-group" onclick="toggleNavGroup(this)">Globais (Módulos)</div><div class="nav-children">';
        GLOBAL_CATEGORIES.forEach((cat, i) => {
          navHtml += \`<button class="nav-btn" onclick="renderContent('global_modulos', \${i}, this)">\${cat.category.substring(3)}</button>\`;
        });
        navHtml += '</div>';

        navHtml += '<div class="nav-group" onclick="toggleNavGroup(this)">Globais (Configs)</div><div class="nav-children">';
        GLOBAL_SETTINGS.forEach((cat, i) => {
          navHtml += \`<button class="nav-btn" onclick="renderContent('global_configs', \${i}, this)">\${cat.category.substring(3)}</button>\`;
        });
        navHtml += '</div>';
      }

      navContainer.innerHTML = navHtml;
      
      const firstBtn = navContainer.querySelector('.nav-btn');
      if(firstBtn) firstBtn.click();
    }

    function renderContent(type, index, btn) {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      if(btn) btn.classList.add('active');

      const contentDiv = document.getElementById('main-content');
      const headerTitle = document.getElementById('main-header-title');
      let catData, html = '';

      if (type === 'modulos') {
        catData = SERVER_CATEGORIES[index];
        headerTitle.innerText = catData.category;
        html = generateModulesHtml([catData], stateData.serverConfig, 'server');
      } else if (type === 'configs') {
        catData = SERVER_SETTINGS[index];
        headerTitle.innerText = catData.category;
        html = generateSettingsHtml([catData], stateData.serverConfig, 'server');
      } else if (type === 'global_modulos') {
        catData = GLOBAL_CATEGORIES[index];
        headerTitle.innerText = catData.category;
        html = generateModulesHtml([catData], stateData.globalConfig, 'global');
      } else if (type === 'global_configs') {
        catData = GLOBAL_SETTINGS[index];
        headerTitle.innerText = catData.category;
        html = generateSettingsHtml([catData], stateData.globalConfig, 'global');
      }

      contentDiv.innerHTML = html;
      
      setTimeout(() => {
        document.querySelectorAll('.embed-builder-desc').forEach(el => {
           updatePreview(el.id.replace('_desc', ''));
        });
      }, 100);
    }

    function generateModulesHtml(categories, dbData, type) {
      let html = '';
      categories.forEach(cat => {
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
        if (cat.desc) html += '<p class="section-desc">' + cat.desc + '</p>';
        html += '<div class="grid" ' + (cat.items.some(i => i.type === 'embed_builder') ? 'style="display: flex; flex-direction: column;"' : '') + '>';
        cat.items.forEach(item => {
          const inputId = 'input_' + type + '_' + item.id;
          const rawVal = dbData ? dbData[item.id] : null;

          if (item.type === 'embed_builder') {
            let parsed = { title: '', description: '', color: '#8B5CF6', thumbnail: '', image: '' };
            if (rawVal) {
              try { parsed = rawVal.startsWith('{') ? JSON.parse(rawVal) : { title: '', description: rawVal, color: '#8B5CF6', thumbnail: '', image: '' }; } catch(e) {}
            }
            html += '<div class="card-input" style="width: 100%;">' +
                      '<label>🛠️ Construtor de Embed</label>' +
                      '<div style="display: flex; gap: 30px; flex-wrap: wrap; margin-top: 5px;">' +
                        '<div style="flex: 1; min-width: 300px; display: flex; flex-direction: column; gap: 12px;">' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_title" placeholder="Título (Opcional)" value="' + (parsed.title || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="input-group"><textarea id="' + inputId + '_desc" class="embed-builder-desc" placeholder="Descrição (Use {user}, {guild}, {memberCount})" oninput="updatePreview(\\'' + inputId + '\\')" style="min-height: 120px;">' + (parsed.description || '') + '</textarea></div>' +
                          '<div class="input-group">' +
                             '<div class="color-picker-wrapper"><input type="color" id="' + inputId + '_color" value="' + (parsed.color || '#8B5CF6') + '" oninput="document.getElementById(\\'' + inputId + '_color_text\\').value = this.value.toUpperCase(); updatePreview(\\'' + inputId + '\\')"></div>' +
                             '<input type="text" id="' + inputId + '_color_text" value="' + (parsed.color || '#8B5CF6') + '" oninput="document.getElementById(\\'' + inputId + '_color\\').value = this.value; updatePreview(\\'' + inputId + '\\')">' +
                          '</div>' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_thumb" placeholder="URL da Thumbnail (Opcional)" value="' + (parsed.thumbnail || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_img" placeholder="URL da Imagem Maior (Opcional)" value="' + (parsed.image || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="tag-container" style="margin-top:0;">' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{user}\\'); updatePreview(\\'' + inputId + '\\')">+{user}</span>' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{guild}\\'); updatePreview(\\'' + inputId + '\\')">+{guild}</span>' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{memberCount}\\'); updatePreview(\\'' + inputId + '\\')">+{memberCount}</span>' +
                          '</div>' +
                          '<button class="btn-save" style="margin-top: 10px;" onclick="saveEmbedBuilder(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\')">💾 Salvar Embed</button>' +
                        '</div>' +
                        '<div style="flex: 1; min-width: 320px;">' +
                          '<label style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 5px; display: block;">Preview em Tempo Real</label>' +
                          '<div class="discord-preview">' +
                            '<div class="discord-msg-header"><div class="discord-msg-avatar"></div><div><span class="discord-msg-name">Bryan Bot</span><span class="discord-msg-time">Hoje às 12:00</span></div></div>' +
                            '<div class="discord-embed" id="' + inputId + '_preview_card" style="border-left-color: ' + (parsed.color || '#8B5CF6') + ';">' +
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
            const hexColor = intToHex(rawVal, '#8B5CF6');
            html += '<div class="card-input">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<div class="color-picker-wrapper"><input type="color" value="' + hexColor + '" oninput="document.getElementById(\\'' + inputId + '\\').value = this.value.toUpperCase()"></div>' +
                        '<input type="text" id="' + inputId + '" value="' + hexColor + '">' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'color\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          } else if (item.type === 'channel' || item.type === 'role') {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="card-input">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<div class="autocomplete">' +
                          '<input type="text" id="' + inputId + '" placeholder="' + item.placeholder + '" value="' + val + '" onfocus="showOptions(this, \\'' + item.type + '\\')" oninput="filterOptions(this, \\'' + item.type + '\\')" onblur="hideOptionsDelayed(\\'' + inputId + '\\')">' +
                          '<div class="autocomplete-items" id="' + inputId + '-list"></div>' +
                        '</div>' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'text\\')">Salvar</button>' +
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

    // Lógicas de Auto-Complete
    function showOptions(inputEl, entityType) {
      const listEl = document.getElementById(inputEl.id + '-list');
      renderOptions(inputEl.id, entityType, inputEl.value);
      listEl.classList.add('show');
    }

    function filterOptions(inputEl, entityType) {
      renderOptions(inputEl.id, entityType, inputEl.value);
    }

    function hideOptionsDelayed(inputId) {
      setTimeout(() => {
        const listEl = document.getElementById(inputId + '-list');
        if(listEl) listEl.classList.remove('show');
      }, 200);
    }

    function selectOption(inputId, idValue) {
      const inputEl = document.getElementById(inputId);
      inputEl.value = idValue;
      const listEl = document.getElementById(inputId + '-list');
      listEl.classList.remove('show');
    }

    function renderOptions(inputId, entityType, filterText) {
      const listEl = document.getElementById(inputId + '-list');
      const data = entityType === 'channel' ? discordDataCache.channels : discordDataCache.roles;
      const lowerFilter = filterText.toLowerCase();

      const filtered = data.filter(d => d.name.toLowerCase().includes(lowerFilter) || d.id.includes(lowerFilter)).slice(0, 15);

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="autocomplete-item">Nenhum resultado... (Você pode colar o ID)</div>';
        return;
      }

      listEl.innerHTML = filtered.map(d => {
        let icon = '🛡️';
        if (entityType === 'channel') {
           if (d.type === 0) icon = '💬'; // Texto
           else if (d.type === 4) icon = '📁'; // Categoria
           else if (d.type === 2) icon = '🔊'; // Voz
        }
        return \`<div class="autocomplete-item" onclick="selectOption('\${inputId}', '\${d.id}')">\${icon} <span>\${d.name}</span> <small style="opacity:0.5; font-size:0.7rem; margin-left:auto;">\${d.id}</small></div>\`;
      }).join('');
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
      res.ok ? showToast('✅ Salvo com sucesso!') : showToast('❌ Erro ao salvar.', true);
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
      res.ok ? showToast('Salvo com sucesso!') : showToast('Erro ao atualizar.', true);
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
