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
    desc: "Suporte aos membros e streaming de voz",
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
    category: "🌍 Master Switches (Desliga em TODOS os Servidores)",
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

  // ─── TELA INICIAL (LANDING PAGE MODERNA E COMPLETA) ──────────────────────
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
      padding: 18px 8%;
      background: rgba(9, 7, 16, 0.85);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
    }
    .brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: white; }
    .brand img {
      width: 44px; height: 44px; border-radius: 50%;
      border: 2px solid var(--primary);
      box-shadow: 0 0 20px var(--primary-glow);
      object-fit: cover;
    }
    .brand-name {
      font-weight: 900; font-size: 1.35rem; letter-spacing: 0.5px;
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
      text-align: center; padding: 85px 8% 45px 8%; max-width: 1200px; margin: 0 auto;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 10px; padding: 8px 24px;
      background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(192, 132, 252, 0.4);
      border-radius: 50px; font-size: 13px; font-weight: 800; color: #e0c3fc;
      margin-bottom: 25px; box-shadow: 0 0 25px rgba(139, 92, 246, 0.3);
      text-transform: uppercase; letter-spacing: 1px;
    }
    .hero h1 {
      font-size: clamp(2.4rem, 5vw, 4.3rem); font-weight: 900; line-height: 1.15;
      margin-bottom: 25px; letter-spacing: -1.5px;
    }
    .gradient-text {
      background: linear-gradient(135deg, #ffffff 15%, #c084fc 55%, #e1306c 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero p {
      font-size: clamp(1.05rem, 2vw, 1.25rem); color: #b3a7c6; max-width: 800px;
      margin: 0 auto 40px auto;
    }
    .hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .stats-bar {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px; max-width: 1100px; margin: 30px auto 70px auto; padding: 0 5%;
    }
    .stat-box {
      background: var(--card-bg); border: 1px solid var(--border);
      padding: 24px; border-radius: 18px; text-align: center;
      backdrop-filter: blur(12px); transition: 0.3s;
    }
    .stat-box:hover {
      border-color: rgba(192, 132, 252, 0.5); transform: translateY(-4px);
      box-shadow: 0 10px 30px rgba(139, 92, 246, 0.25);
    }
    .stat-box .num {
      font-size: 2.2rem; font-weight: 900; color: white;
      background: linear-gradient(135deg, #ffffff 0%, #e0c3fc 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .stat-box .lbl {
      font-size: 13px; color: #9485a8; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;
    }
    .features-wrap { padding: 30px 8% 90px 8%; max-width: 1250px; margin: 0 auto; }
    .section-title { text-align: center; margin-bottom: 55px; }
    .section-title h2 { font-size: 2.4rem; font-weight: 900; color: white; margin-bottom: 12px; }
    .section-title p { color: #a597b9; font-size: 1.1rem; }
    .features-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 28px;
    }
    .f-card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 20px; padding: 35px 30px;
      backdrop-filter: blur(15px); transition: all 0.35s ease;
      position: relative; overflow: hidden;
    }
    .f-card:hover {
      transform: translateY(-6px);
      border-color: rgba(192, 132, 252, 0.5);
      box-shadow: 0 18px 40px rgba(139, 92, 246, 0.25);
    }
    .f-icon {
      width: 58px; height: 58px; border-radius: 16px;
      background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(192, 132, 252, 0.35);
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; margin-bottom: 20px;
    }
    .f-badge {
      display: inline-block; padding: 4px 12px; border-radius: 6px;
      font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;
    }
    .f-badge-ai { background: linear-gradient(135deg, #00f5d4 0%, #00bbf9 100%); color: #07060b; }
    .f-badge-insta { background: linear-gradient(135deg, #e1306c 0%, #c13584 100%); color: white; }
    .f-card h3 { font-size: 1.3rem; font-weight: 800; color: white; margin-bottom: 12px; }
    .f-card p { color: #a596b8; font-size: 0.95rem; line-height: 1.65; }
    .cta-banner {
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(225, 48, 108, 0.22) 100%);
      border: 1px solid rgba(192, 132, 252, 0.4); border-radius: 24px; padding: 60px 40px; text-align: center;
      max-width: 1000px; margin: 60px auto 90px auto; backdrop-filter: blur(15px);
    }
    .cta-banner h2 { font-size: 2.2rem; font-weight: 900; margin-bottom: 15px; color: white; }
    .cta-banner p { color: #d8cde9; font-size: 1.1rem; max-width: 600px; margin: 0 auto 35px auto; }
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

  <div class="stats-bar">
    <div class="stat-box"><div class="num">🎙️ IA Real</div><div class="lbl">Voz ElevenLabs Neural</div></div>
    <div class="stat-box"><div class="num">📸 Instagram</div><div class="lbl">Feed Social com PV</div></div>
    <div class="stat-box"><div class="num">100%</div><div class="lbl">Uptime no Railway</div></div>
    <div class="stat-box"><div class="num">14+</div><div class="lbl">Módulos Ativos</div></div>
  </div>

  <section class="features-wrap">
    <div class="section-title">
      <h2>Todas as Funcionalidades do Bryan Bot</h2>
      <p>Desenvolvido com excelência para a comunidade da Aliança Skyline.</p>
    </div>

    <div class="features-grid">
      <!-- 1. VOZ COM IA -->
      <div class="f-card">
        <span class="f-badge f-badge-ai">🎙️ Destaque IA</span>
        <div class="f-icon" style="background: rgba(0, 245, 212, 0.2); border-color: rgba(0, 245, 212, 0.4);">🧠</div>
        <h3>Voz & Conversação com IA</h3>
        <p>O bot conecta ao canal de voz e conversa em tempo real com os membros. Síntese de voz neural ultra-realista via <strong>ElevenLabs</strong> e respostas contextuais com <strong>Gemini / OpenAI / Mistral</strong>.</p>
      </div>

      <!-- 2. FEED INSTAGRAM -->
      <div class="f-card">
        <span class="f-badge f-badge-insta">🔥 Exclusivo</span>
        <div class="f-icon" style="background: rgba(225, 48, 108, 0.2); border-color: rgba(225, 48, 108, 0.4);">📸</div>
        <h3>Feed Social / Instagram</h3>
        <p>Publicações automáticas de fotos com cards elegantes estilo Instagram. Botões de curtir, comentar via modal nativo, seguir criadores e <strong>notificações automáticas no PV de quem você segue</strong>.</p>
      </div>

      <!-- 3. RPG DISCORD -->
      <div class="f-card">
        <div class="f-icon">⚔️</div>
        <h3>RPG Multiplayer no Discord</h3>
        <p>Crie personagens com geração visual em Canvas, encare dungeons de 5 andares, derrote World Bosses, desbloqueie talentos divinos e dispute o ranking do servidor.</p>
      </div>

      <!-- 4. TICKETS -->
      <div class="f-card">
        <div class="f-icon">🎫</div>
        <h3>Suporte & Atendimento</h3>
        <p>Criação ágil de canais privados por categoria, geração de transcrições completas em canais de logs e controle total de acesso para a equipe de Staff.</p>
      </div>

      <!-- 5. SEGURANÇA & AUTO-MOD -->
      <div class="f-card">
        <div class="f-icon">🛡️</div>
        <h3>Segurança & Auto-Mod</h3>
        <p>Proteção ativa contra envio massivo de spam, links suspeitos e convites externos. Logs detalhados de auditoria e controle rigoroso de hierarquia.</p>
      </div>

      <!-- 6. MÚSICA & LEVELING -->
      <div class="f-card">
        <div class="f-icon">🎵</div>
        <h3>Música & Leveling Dinâmico</h3>
        <p>Player de música FFmpeg com áudio sem travamentos em canais de voz e sistema inteligente de XP por mensagens com suporte a <strong>canais ou fóruns</strong>.</p>
      </div>
    </div>

    <div class="cta-banner">
      <h2>Pronto para transformar sua comunidade?</h2>
      <p>Adicione o Bryan Bot agora mesmo e configure tudo facilmente pelo nosso painel online.</p>
      <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
        <a href="${botInviteUrl}" target="_blank" class="btn btn-invite" style="padding: 15px 32px;"><span>➕ Convidar Bryan Bot</span></a>
        <a href="/login" class="btn btn-primary" style="padding: 15px 32px;"><span>⚡ Acessar Painel</span></a>
      </div>
    </div>
  </section>

  <footer>
    <p>© 2026 <strong>Bryan Bot</strong> • Desenvolvido para a <strong>Aliança Skyline</strong>.</p>
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

      if (!isBotOwner && userRoles.length === 0) return res.status(403).send('<body style="background: #0b0a0f; color: #ed4245; text-align: center; padding-top: 150px; font-family: sans-serif;"><h1>🛑 Acesso Negado</h1><p style="color:white;">Sem credenciais ativas na Aliança.</p><br><a href="/" style="color: #b388eb; font-weight: bold;">Voltar</a></body>');

      res.cookie('skyline_auth', 'permitido', { maxAge: 86400000 }); 
      res.cookie('skyline_userid', userId, { maxAge: 86400000 }); 
      res.cookie('skyline_username', username, { maxAge: 86400000 }); 
      res.redirect('/painel');
    } catch (error) { res.status(500).send('Erro na autenticação.'); }
  });

  // 🛡️ SEGURANÇA: API /api/config com validação de permissão de acesso ao servidor
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

  // 🛡️ SEGURANÇA: API /api/toggle com validação de autenticação e permissão
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

  // 🛡️ SEGURANÇA: API /api/update com suporte a Colors (HEX/DEC), Textarea, Números e Strings
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

  // ─── PAINEL DE CONTROLE (REDESIGN COMPLETO E MODERNO) ────────────────────
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
    ::-webkit-scrollbar-thumb:hover { background: rgba(168, 85, 247, 0.7); }

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
