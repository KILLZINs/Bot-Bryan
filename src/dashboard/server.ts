server_code = '''import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma } from '../database/client';

// 👑 COLOQUE O SEU ID DO DISCORD AQUI PARA ACESSO MÁXIMO
const BOT_OWNER_ID = '1195254699943796791'; 

// ==========================================
// 🧩 1. MÓDULOS (LIGA/DESLIGA - BOOLEANS)
// ==========================================
const SERVER_CATEGORIES = [
  {
    category: "⚔️ RPG & Economia",
    features: [
      { id: 'featRpg', name: 'Sistema RPG (Geral)', desc: 'Botão mestre: Ativa/desativa todo o ecossistema RPG.' },
      { id: 'featEconomy', name: '🪙 Economia', desc: 'Sistema de moedas, transferências e loja.' },
      { id: 'featMissions', name: '📋 Missões', desc: 'Missões diárias e semanais com recompensas.' }
    ]
  },
  {
    category: "🛡️ Segurança & Moderação",
    features: [
      { id: 'featMod', name: '🔨 Módulo de Moderação', desc: 'Comandos administrativos e punições.' },
      { id: 'antiSpam', name: '⚡ Proteção Anti-Spam', desc: 'Detecta e bloqueia envio rápido e repetitivo de mensagens.' },
      { id: 'antiLinks', name: '🔗 Filtro Anti-Links / Invites', desc: 'Bloqueia convites externos e links suspeitos.' }
    ]
  },
  {
    category: "🎫 Suporte & Cargos",
    features: [
      { id: 'featTickets', name: '🎫 Tickets / Atendimento', desc: 'Salas privadas de suporte com transcrições.' },
      { id: 'featSelfRole', name: '🎭 Registro de Auto-Cargos', desc: 'Menus interativos para escolha de cargos.' }
    ]
  },
  {
    category: "🎉 Engajamento & Comunidade",
    features: [
      { id: 'featSocial', name: '📸 Feed Social & Roleplay', desc: 'Instagram integrado no Discord e comandos sociais de RP.' },
      { id: 'featLeveling', name: '🎯 XP & Níveis', desc: 'Progressão por mensagens e ranking.' },
      { id: 'featGiveaways', name: '🎁 Sorteios', desc: 'Sorteios automatizados com participação via botão.' },
      { id: 'featPolls', name: '📊 Enquetes', desc: 'Ferramenta de criação de enquetes na comunidade.' },
      { id: 'featAnnouncements', name: '📢 Anúncios', desc: 'Eventos globais e avisos do servidor.' },
      { id: 'featMusic', name: '🎵 Sistema de Música', desc: 'Permite que o bot toque músicas nos canais de voz.' }
    ]
  }
];

const GLOBAL_CATEGORIES = [
  {
    category: "⚙️ Sistemas Centrais",
    features: [
      { id: 'featAfk', name: '💤 Sistema AFK', desc: 'Habilita comando /afk e monitoramento de menções.' },
      { id: 'featWelcomeDm', name: '📩 DM de Boas-vindas', desc: 'Recepciona novos membros com mensagem no privado.' }
    ]
  },
  {
    category: "🌍 Master Switches (Desliga em TODOS os servidores)",
    features: [
      { id: 'featRpg', name: 'Sistema RPG (Geral)', desc: 'Desliga o ecossistema RPG inteiro do bot.' },
      { id: 'featEconomy', name: '🪙 Economia', desc: 'Trava moedas, lojas e transferências globais.' },
      { id: 'featMissions', name: '📋 Missões', desc: 'Congela missões diárias e semanais.' },
      { id: 'featMod', name: '🔨 Auto-Moderação', desc: 'Desliga filtros e punições do bot.' },
      { id: 'featTickets', name: '🎫 Tickets', desc: 'Impede a criação de tickets em qualquer lugar.' },
      { id: 'featSelfRole', name: '🎭 Registro de Cargos', desc: 'Desativa os menus interativos de cargo.' },
      { id: 'featLeveling', name: '🎯 XP & Níveis', desc: 'Congela o ganho de XP em todos os servidores.' },
      { id: 'featGiveaways', name: '🎁 Sorteios', desc: 'Trava todos os sorteios atuais e futuros.' },
      { id: 'featPolls', name: '📊 Enquetes', desc: 'Desativa a ferramenta de enquetes.' },
      { id: 'featSocial', name: '🤝 Roleplay Social & Feed', desc: 'Desliga o Feed e interações de RP.' },
      { id: 'featAnnouncements', name: '📢 Anúncios', desc: 'Bloqueia os comandos de eventos e avisos.' },
      { id: 'featMusic', name: '🎵 Sistema de Música', desc: 'Desliga o motor de áudio globalmente por segurança.' }
    ]
  }
];

// ==========================================
// ⚙️ 2. CONFIGURAÇÕES AVANÇADAS (INPUTS)
// ==========================================
const SERVER_SETTINGS = [
  {
    category: "📸 Feed Social / Instagram",
    items: [
      { id: 'feedChannelId', name: 'Canal do Feed (ID)', type: 'text', placeholder: 'ID do canal onde as fotos serão postadas' },
      { id: 'feedEmbedColor', name: 'Cor do Embed das Postagens', type: 'color', placeholder: 'Escolha a cor do card' },
      { id: 'feedLikeEmoji', name: 'Emoji de Curtir', type: 'text', placeholder: 'Padrão: 💜' },
      { id: 'feedFollowEmoji', name: 'Emoji de Seguir', type: 'text', placeholder: 'Padrão: 🔔' },
      { id: 'feedCommentEmoji', name: 'Emoji de Comentar', type: 'text', placeholder: 'Padrão: 💬' },
      { id: 'feedFooterText', name: 'Texto de Rodapé do Post', type: 'text', placeholder: 'Ex: 📸 Instagram Skyline' }
    ]
  },
  {
    category: "📁 Canais do Servidor (IDs)",
    items: [
      { id: 'welcomeChannelId', name: 'Canal de Boas-Vindas', type: 'text', placeholder: 'Canal para novas entradas' },
      { id: 'announcementChannelId', name: 'Canal de Anúncios', type: 'text', placeholder: 'Canal para avisos globais e eventos' },
      { id: 'logChannelId', name: 'Canal de Logs Gerais', type: 'text', placeholder: 'Onde os logs de auditoria vão cair' },
      { id: 'suggestionChannelId', name: 'Canal de Sugestões', type: 'text', placeholder: 'Onde o /sugestao é enviado' },
      { id: 'feedbackChannelId', name: 'Canal de Feedback', type: 'text', placeholder: 'Onde o /feedback é enviado' },
      { id: 'levelUpChannelId', name: 'Canal ou Fórum de Level Up', type: 'text', placeholder: 'Notificações de subida de nível' }
    ]
  },
  {
    category: "🎫 Atendimento & Tickets (IDs)",
    items: [
      { id: 'ticketCategoryId', name: 'Categoria de Tickets (ID)', type: 'text', placeholder: 'Categoria onde as salas de ticket abrem' },
      { id: 'ticketLogChannelId', name: 'Canal de Transcrições/Logs (ID)', type: 'text', placeholder: 'Onde o histórico de tickets fechados é salvo' }
    ]
  },
  {
    category: "🛡️ Cargos do Sistema (IDs)",
    items: [
      { id: 'adminRoleId', name: 'Cargo de Administrador', type: 'text', placeholder: 'Passe livre nas configurações' },
      { id: 'modRoleId', name: 'Cargo de Moderador', type: 'text', placeholder: 'Acesso a comandos de punição' },
      { id: 'autoRoleId', name: 'Cargo Automático (Auto-Role)', type: 'text', placeholder: 'Entregue imediatamente ao novo membro' },
      { id: 'memberRoleId', name: 'Cargo de Membro Registrado', type: 'text', placeholder: 'Cargo oficial da comunidade' },
      { id: 'mutedRoleId', name: 'Cargo de Silenciado (Muted)', type: 'text', placeholder: 'Atribuído em punições de silenciamento' }
    ]
  },
  {
    category: "💬 Mensagens de Boas-Vindas",
    items: [
      { id: 'welcomeMessage', name: 'Mensagem de Recepção (Use {user} e {guild})', type: 'textarea', placeholder: 'Ex: Olá {user}, seja muito bem-vindo(a) ao servidor {guild}!' }
    ]
  }
];

const GLOBAL_SETTINGS = [
  {
    category: "🎨 Identidade Visual Global",
    items: [
      { id: 'footerText', name: 'Texto de Rodapé Padrão', type: 'text', placeholder: 'Aparece na maioria das embeds' },
      { id: 'rpFooterText', name: 'Rodapé dos Comandos /rp', type: 'text', placeholder: 'Ex: ⚔️ Aliança Skyline • /genero' },
      { id: 'botIconUrl', name: 'URL do Ícone do Bot', type: 'text', placeholder: 'Ex: https://i.imgur.com/foto.png' },
      { id: 'primaryColor', name: 'Cor Primária dos Embeds', type: 'color', placeholder: 'Escolha a cor principal' }
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

  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bryan Bot — Ecossistema Discord & IA de Voz</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              background: #08060c;
              color: #f1edfa;
              font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
              overflow-x: hidden;
              line-height: 1.6;
            }

            .bg-glow {
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              z-index: -1;
              background: 
                radial-gradient(circle at 15% 15%, rgba(123, 44, 191, 0.28) 0%, transparent 40%),
                radial-gradient(circle at 85% 85%, rgba(157, 78, 221, 0.22) 0%, transparent 45%),
                radial-gradient(circle at 50% 50%, rgba(225, 48, 108, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 75% 20%, rgba(0, 245, 212, 0.1) 0%, transparent 35%),
                linear-gradient(180deg, #0b0914 0%, #06050a 100%);
            }

            nav {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 20px 8%;
              backdrop-filter: blur(15px);
              background: rgba(11, 9, 20, 0.75);
              border-bottom: 1px solid rgba(157, 78, 221, 0.2);
              position: sticky;
              top: 0;
              z-index: 100;
            }
            .brand {
              display: flex;
              align-items: center;
              gap: 14px;
              text-decoration: none;
              color: white;
            }
            .brand img {
              width: 44px;
              height: 44px;
              border-radius: 50%;
              border: 2px solid #b388eb;
              box-shadow: 0 0 20px rgba(179, 136, 235, 0.5);
              object-fit: cover;
            }
            .brand-name {
              font-weight: 800;
              font-size: 1.25rem;
              letter-spacing: 1px;
              background: linear-gradient(135deg, #ffffff 0%, #e0c3fc 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .nav-actions {
              display: flex;
              gap: 15px;
              align-items: center;
            }

            .btn {
              padding: 12px 26px;
              border-radius: 10px;
              font-weight: 700;
              font-size: 14px;
              text-decoration: none;
              display: inline-flex;
              align-items: center;
              gap: 10px;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              cursor: pointer;
              letter-spacing: 0.5px;
            }
            .btn-primary {
              background: linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%);
              color: #ffffff;
              border: 1px solid rgba(224, 195, 252, 0.3);
              box-shadow: 0 0 25px rgba(123, 44, 191, 0.5);
            }
            .btn-primary:hover {
              transform: translateY(-3px) scale(1.02);
              box-shadow: 0 10px 30px rgba(157, 78, 221, 0.8);
            }
            .btn-invite {
              background: linear-gradient(135deg, #5865F2 0%, #4752C4 100%);
              color: white;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 0 20px rgba(88, 101, 242, 0.4);
            }
            .btn-invite:hover {
              transform: translateY(-3px) scale(1.02);
              box-shadow: 0 10px 30px rgba(88, 101, 242, 0.7);
            }
            .btn-secondary {
              background: rgba(30, 24, 45, 0.6);
              color: #e0c3fc;
              border: 1px solid rgba(157, 78, 221, 0.3);
              backdrop-filter: blur(10px);
            }
            .btn-secondary:hover {
              background: rgba(45, 34, 70, 0.8);
              border-color: #b388eb;
              color: white;
              transform: translateY(-2px);
            }

            .hero {
              text-align: center;
              padding: 80px 8% 50px 8%;
              max-width: 1200px;
              margin: 0 auto;
            }
            .hero-badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 8px 22px;
              background: rgba(123, 44, 191, 0.25);
              border: 1px solid rgba(179, 136, 235, 0.4);
              border-radius: 50px;
              font-size: 13px;
              font-weight: 700;
              color: #e0c3fc;
              margin-bottom: 25px;
              box-shadow: 0 0 25px rgba(123, 44, 191, 0.35);
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .hero h1 {
              font-size: clamp(2.4rem, 5vw, 4.3rem);
              font-weight: 800;
              line-height: 1.15;
              margin-bottom: 25px;
              letter-spacing: -1px;
            }
            .hero-gradient {
              background: linear-gradient(135deg, #ffffff 20%, #c77dff 60%, #e1306c 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .hero p {
              font-size: clamp(1rem, 2vw, 1.25rem);
              color: #b5a9c9;
              max-width: 800px;
              margin: 0 auto 40px auto;
            }
            .hero-buttons {
              display: flex;
              gap: 20px;
              justify-content: center;
              flex-wrap: wrap;
            }

            .stats-ribbon {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 20px;
              max-width: 1100px;
              margin: 30px auto 70px auto;
              padding: 0 5%;
            }
            .stat-card {
              background: rgba(18, 14, 28, 0.6);
              border: 1px solid rgba(157, 78, 221, 0.25);
              padding: 25px;
              border-radius: 16px;
              text-align: center;
              backdrop-filter: blur(10px);
              transition: 0.3s;
            }
            .stat-card:hover {
              border-color: #b388eb;
              transform: translateY(-4px);
              box-shadow: 0 10px 30px rgba(123, 44, 191, 0.25);
            }
            .stat-num {
              font-size: 2.2rem;
              font-weight: 800;
              color: #ffffff;
              background: linear-gradient(135deg, #fff 0%, #e0c3fc 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              margin-bottom: 5px;
            }
            .stat-label {
              font-size: 13px;
              color: #9a8ca8;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
            }

            .features-section {
              padding: 40px 8% 90px 8%;
              max-width: 1250px;
              margin: 0 auto;
            }
            .section-header {
              text-align: center;
              margin-bottom: 55px;
            }
            .section-header h2 {
              font-size: 2.3rem;
              font-weight: 800;
              margin-bottom: 12px;
              color: #ffffff;
            }
            .section-header p {
              color: #a79cb7;
              font-size: 1.05rem;
            }

            .features-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
              gap: 28px;
            }
            .feature-card {
              background: rgba(16, 12, 26, 0.75);
              border: 1px solid rgba(157, 78, 221, 0.2);
              border-radius: 18px;
              padding: 35px 30px;
              backdrop-filter: blur(12px);
              transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
              position: relative;
              overflow: hidden;
            }
            .feature-card::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 3px;
              background: linear-gradient(90deg, transparent, #b388eb, transparent);
              opacity: 0;
              transition: 0.3s;
            }
            .feature-card:hover {
              transform: translateY(-6px);
              border-color: rgba(179, 136, 235, 0.5);
              box-shadow: 0 15px 35px rgba(123, 44, 191, 0.25);
            }
            .feature-card:hover::before {
              opacity: 1;
            }
            .feature-icon {
              width: 58px;
              height: 58px;
              border-radius: 14px;
              background: rgba(123, 44, 191, 0.25);
              border: 1px solid rgba(179, 136, 235, 0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 26px;
              margin-bottom: 20px;
              box-shadow: 0 0 20px rgba(123, 44, 191, 0.3);
            }
            .feature-card h3 {
              font-size: 1.25rem;
              font-weight: 700;
              color: #ffffff;
              margin-bottom: 12px;
            }
            .feature-card p {
              color: #a79bb8;
              font-size: 0.95rem;
              line-height: 1.6;
            }

            .highlight-badge {
              display: inline-block;
              padding: 4px 10px;
              background: linear-gradient(135deg, #00f5d4 0%, #00bbf9 100%);
              border-radius: 6px;
              font-size: 11px;
              font-weight: 800;
              color: #050408;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 14px;
            }
            .insta-badge {
              background: linear-gradient(135deg, #e1306c 0%, #c13584 100%);
              color: white;
            }

            .cta-banner {
              background: linear-gradient(135deg, rgba(123, 44, 191, 0.35) 0%, rgba(225, 48, 108, 0.22) 100%);
              border: 1px solid rgba(179, 136, 235, 0.4);
              border-radius: 24px;
              padding: 60px 40px;
              text-align: center;
              max-width: 1000px;
              margin: 40px auto 90px auto;
              backdrop-filter: blur(15px);
              box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            .cta-banner h2 {
              font-size: 2.2rem;
              font-weight: 800;
              margin-bottom: 15px;
              color: white;
            }
            .cta-banner p {
              color: #d1c5e2;
              font-size: 1.1rem;
              max-width: 600px;
              margin: 0 auto 35px auto;
            }

            footer {
              border-top: 1px solid rgba(157, 78, 221, 0.18);
              padding: 40px 8%;
              text-align: center;
              color: #7b6f8b;
              font-size: 14px;
              background: #050408;
            }
            footer a {
              color: #b388eb;
              text-decoration: none;
              font-weight: 600;
            }

            @media (max-width: 768px) {
              nav { padding: 15px 5%; }
              .hero { padding: 50px 5% 30px 5%; }
              .features-grid { grid-template-columns: 1fr; }
              .nav-actions .btn-invite { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="bg-glow"></div>

          <!-- Navbar -->
          <nav>
            <a href="/" class="brand">
              <img src="/skylineicon.jpg" alt="Bryan Bot Icon">
              <span class="brand-name">Bryan Bot</span>
            </a>
            <div class="nav-actions">
              <a href="${botInviteUrl}" target="_blank" class="btn btn-invite">
                <span>➕ Adicionar Bot</span>
              </a>
              <a href="/login" class="btn btn-primary">
                <span>⚡ Painel Web</span>
              </a>
            </div>
          </nav>

          <!-- Hero Section -->
          <section class="hero">
            <div class="hero-badge">🎙️ Nova Geração com IA de Voz & Feed Social</div>
            <h1>Potencialize seu servidor com <span class="hero-gradient">IA de Voz & Recursos Exclusivos</span></h1>
            <p>O Bryan Bot reúne conversação por voz com inteligência artificial, feed social estilo Instagram, ecossistema RPG completo, suporte por tickets e moderação blindada.</p>
            
            <div class="hero-buttons">
              <a href="${botInviteUrl}" target="_blank" class="btn btn-invite" style="padding: 16px 36px; font-size: 16px;">
                <span>➕ Adicionar ao Discord</span>
              </a>
              <a href="/login" class="btn btn-secondary" style="padding: 16px 36px; font-size: 16px;">
                <span>⚙️ Acessar Dashboard</span>
              </a>
            </div>
          </section>

          <!-- Estatísticas -->
          <div class="stats-ribbon">
            <div class="stat-card">
              <div class="stat-num">🎙️ IA Real</div>
              <div class="stat-label">Síntese de Voz ElevenLabs</div>
            </div>
            <div class="stat-card">
              <div class="stat-num">100%</div>
              <div class="stat-label">Uptime no Railway</div>
            </div>
            <div class="stat-card">
              <div class="stat-num">📸 Social</div>
              <div class="stat-label">Feed & Notificações PV</div>
            </div>
            <div class="stat-card">
              <div class="stat-num">14+</div>
              <div class="stat-label">Módulos Ativos</div>
            </div>
          </div>

          <!-- Grade de Recursos -->
          <section class="features-section">
            <div class="section-header">
              <h2>Recursos de Elite para o seu Servidor</h2>
              <p>Projetado para entregar a melhor experiência visual, sonora e interativa.</p>
            </div>

            <div class="features-grid">
              <!-- DESTAQUE 1: VOZ COM IA -->
              <div class="feature-card">
                <span class="highlight-badge">🎙️ Exclusivo IA</span>
                <div class="feature-icon" style="background: rgba(0, 245, 212, 0.2); border-color: rgba(0, 245, 212, 0.4);">🧠</div>
                <h3>Sistema de Voz & Conversação com IA</h3>
                <p>O bot entra no canal de voz e conversa em tempo real com os membros. Integração de voz neural ultra-realista via <strong>ElevenLabs</strong> e respostas inteligentes com <strong>Gemini / OpenAI / Mistral</strong>.</p>
              </div>

              <!-- DESTAQUE 2: FEED INSTAGRAM -->
              <div class="feature-card">
                <span class="highlight-badge insta-badge">🔥 Exclusivo</span>
                <div class="feature-icon" style="background: rgba(225, 48, 108, 0.2); border-color: rgba(225, 48, 108, 0.4);">📸</div>
                <h3>Feed Social / Instagram</h3>
                <p>Publicações automáticas com cards estilo Instagram. Sistema interativo de curtidas, comentários via modal, seguidores e <strong>notificações privadas no PV de quem você segue</strong>.</p>
              </div>

              <!-- CARD 3: RPG & ECONOMIA -->
              <div class="feature-card">
                <div class="feature-icon">⚔️</div>
                <h3>RPG Multiplayer & Economia</h3>
                <p>Crie seu personagem, dispute dungeons, enfrente World Bosses, aprenda talentos divinos, suba de nível e compre cosméticos, fundos e títulos exclusivos na loja.</p>
              </div>

              <!-- CARD 4: TICKETS -->
              <div class="feature-card">
                <div class="feature-icon">🎫</div>
                <h3>Suporte & Atendimento</h3>
                <p>Criação de salas de atendimento privadas por categoria, geração de transcrições em canais de logs e controle total de permissões para a equipe de Staff.</p>
              </div>

              <!-- CARD 5: AUTO-MOD & SEGURANÇA -->
              <div class="feature-card">
                <div class="feature-icon">🛡️</div>
                <h3>Segurança & Auto-Mod</h3>
                <p>Proteção ativa contra spams, links maliciosos e convites externos. Logs detalhados de moderação, sistema de avisos (warns) e controle rigoroso de hierarquia.</p>
              </div>

              <!-- CARD 6: MÚSICA & LEVELING -->
              <div class="feature-card">
                <div class="feature-icon">🎵</div>
                <h3>Música & Leveling Dinâmico</h3>
                <p>Reprodução de áudio sem travamentos via motor FFmpeg e sistema de ganho de XP por mensagens com notificações em canais de texto ou <strong>fóruns dedicados</strong>.</p>
              </div>
            </div>

            <!-- Banner CTA -->
            <div class="cta-banner">
              <h2>Pronto para transformar sua comunidade?</h2>
              <p>Adicione o Bryan Bot agora mesmo e configure tudo facilmente pelo nosso painel online.</p>
              <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <a href="${botInviteUrl}" target="_blank" class="btn btn-invite" style="padding: 15px 32px;">
                  <span>➕ Convidar Bryan Bot</span>
                </a>
                <a href="/login" class="btn btn-primary" style="padding: 15px 32px;">
                  <span>⚡ Acessar Painel</span>
                </a>
              </div>
            </div>
          </section>

          <footer>
            <p>© 2026 <strong>Bryan Bot</strong> • Desenvolvido para a <strong>Aliança Skyline</strong>.</p>
            <p style="margin-top: 8px; font-size: 13px;">Hospedado com alta performance no Railway & PostgreSQL.</p>
          </footer>
        </body>
      </html>
    `);
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

    // Tratamento de Cores (converte #RRGGBB em Int decimal para o Prisma)
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

    // Regras obrigatórias do Prisma
    if (feature === 'primaryColor' && (finalValue === null || isNaN(Number(finalValue)))) finalValue = 10180278;
    if (feature === 'feedEmbedColor' && (finalValue === null || isNaN(Number(finalValue)))) finalValue = 14757996;

    try {
      if (type === 'server') await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: finalValue } });
      else if (type === 'global') await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: finalValue } });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar dado.' }); }
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

    res.send(`
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bryan Dashboard</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background-color: #0b0a0f; color: #dcddde; font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; height: 100vh; overflow: hidden; }
            ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: #0b0a0f; } ::-webkit-scrollbar-thumb { background: #3d1c73; border-radius: 4px; }
            
            .sidebar { width: 300px; background-color: rgba(15,12,20,1); display: flex; flex-direction: column; border-right: 1px solid rgba(157, 78, 221, 0.2); z-index: 10; }
            .sidebar-header { padding: 45px 20px 25px 20px; text-align: center; border-bottom: 1px solid rgba(157, 78, 221, 0.2); margin-bottom: 20px; background: linear-gradient(rgba(15,12,20,0.8), rgba(15,12,20,1)), url('/skyline%20banner%204k.jpg') center/cover; }
            .sidebar-header h2 { color: #ffffff; font-size: 20px; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(0,0,0,0.8); margin-bottom: 5px; font-weight: 800;}
            
            .user-profile { padding: 0 25px; margin-bottom: 30px; display: flex; align-items: center; gap: 15px; }
            .user-avatar { width: 48px; height: 48px; border-radius: 50%; border: 2px solid #7b2cbf; box-shadow: 0 0 15px rgba(123,44,191,0.4); background: url('/skylineicon.jpg') center/cover; }
            .user-info { display: flex; flex-direction: column; }
            .user-name { color: #ffffff; font-weight: bold; font-size: 15px; }
            .user-role { color: #b0a8ba; font-size: 12px; }

            .server-selector { padding: 0 25px; margin-bottom: 25px; }
            .server-selector select { width: 100%; padding: 14px; background-color: #1a1721; color: #ffffff; border: 1px solid #3d1c73; border-radius: 6px; font-weight: bold; outline: none; cursor: pointer; }
            
            .content { flex: 1; padding: 40px 50px; overflow-y: auto; background-image: radial-gradient(circle at right top, rgba(123,44,191,0.08) 0%, transparent 50%); }
            
            .tabs-nav { display: flex; gap: 20px; border-bottom: 2px solid rgba(157, 78, 221, 0.2); margin-bottom: 30px; padding-bottom: 10px; }
            .tab-btn { background: transparent; border: none; color: #a097a8; font-size: 16px; font-weight: bold; cursor: pointer; padding: 10px 15px; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; }
            .tab-btn:hover { color: #e0c3fc; }
            .tab-btn.active { color: #ffffff; border-bottom: 3px solid #7b2cbf; padding-bottom: 7px; text-shadow: 0 0 10px rgba(157,78,221,0.5); }

            .tab-content { display: none; }
            .tab-content.active { display: block; animation: fadeIn 0.4s; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

            .category-title { color: #e0c3fc; font-size: 16px; margin: 30px 0 15px 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid rgba(157, 78, 221, 0.2); padding-bottom: 10px;}
            
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 20px; }
            .card { background-color: rgba(22,18,30,0.6); padding: 22px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(106, 13, 173, 0.3); backdrop-filter: blur(5px); }
            .card h3 { color: #ffffff; font-size: 15px; margin-bottom: 6px; }
            .card p { font-size: 12.5px; color: #a097a8; margin: 0; }
            
            .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #1f1b29; transition: .3s; border-radius: 34px; border: 1px solid #4a287a; }
            .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: #b0a8ba; transition: .3s; border-radius: 50%; }
            input:checked + .slider { background-color: #7b2cbf; border-color: #b388eb; }
            input:checked + .slider:before { transform: translateX(20px); background-color: white; }

            .setting-item { background: rgba(22,18,30,0.6); padding: 18px; border-radius: 8px; border: 1px solid rgba(106, 13, 173, 0.3); display: flex; flex-direction: column; gap: 10px; }
            .setting-item label { color: #ffffff; font-weight: bold; font-size: 14px; }
            .input-group { display: flex; gap: 10px; align-items: center; }
            .input-group input[type="text"], .input-group input[type="number"] { flex: 1; background: #1a1721; border: 1px solid #3d1c73; color: white; padding: 12px; border-radius: 6px; outline: none; transition: 0.3s; font-size: 14px; }
            .input-group textarea { flex: 1; background: #1a1721; border: 1px solid #3d1c73; color: white; padding: 12px; border-radius: 6px; outline: none; transition: 0.3s; min-height: 80px; font-family: inherit; font-size: 14px; }
            .input-group input[type="color"] { width: 50px; height: 44px; background: #1a1721; border: 1px solid #3d1c73; border-radius: 6px; cursor: pointer; padding: 2px; }
            .input-group input:focus, .input-group textarea:focus { border-color: #b388eb; box-shadow: 0 0 10px rgba(157,78,221,0.2); }
            .save-btn { background: #7b2cbf; border: none; color: white; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; text-transform: uppercase; font-size: 12px; align-self: stretch; display: flex; align-items: center; justify-content: center; }
            .save-btn:hover { background: #9d4edd; box-shadow: 0 0 15px rgba(157,78,221,0.5); }

            #toast { visibility: hidden; min-width: 250px; background-color: #e0c3fc; color: #111214; text-align: center; border-radius: 6px; padding: 16px; position: fixed; right: 30px; bottom: 30px; font-weight: bold; opacity: 0; transition: 0.4s; z-index: 999; box-shadow: 0 5px 20px rgba(157,78,221,0.4); }
            #toast.show { visibility: visible; opacity: 1; bottom: 50px; }
          </style>
        </head>
        <body>
          <div class="sidebar">
            <div class="sidebar-header"><h2>Bryan Dashboard</h2><p>ADMINISTRAÇÃO</p></div>
            <div class="user-profile">
              <div class="user-avatar"></div>
              <div class="user-info">
                <span class="user-name">${userName}</span>
                <span class="user-role">${userId === BOT_OWNER_ID ? 'Admin Chefe' : 'Representante'}</span>
              </div>
            </div>
            <div class="server-selector">
              <p style="color: #b0a8ba; font-size: 11px; font-weight: bold; margin-bottom: 5px;">GERENCIANDO SERVIDOR</p>
              <select id="serverSelect" onchange="loadConfig()">${serverOptionsHTML}</select>
            </div>
          </div>
          
          <div class="content">
            <div class="tabs-nav">
              <button class="tab-btn active" onclick="switchTab('modulos', this)">🧩 Módulos (Liga/Desliga)</button>
              <button class="tab-btn" onclick="switchTab('configuracoes', this)">⚙️ Configurações Avançadas</button>
            </div>

            <!-- ABA 1: MÓDULOS -->
            <div id="modulos" class="tab-content active">
              <div id="serverModulesArea">Carregando módulos...</div>
              ${userId === BOT_OWNER_ID ? `<div id="globalModulesArea" style="margin-top: 50px;"></div>` : ''}
            </div>

            <!-- ABA 2: CONFIGURAÇÕES -->
            <div id="configuracoes" class="tab-content">
              <div id="serverSettingsArea">Carregando configurações...</div>
              ${userId === BOT_OWNER_ID ? `<div id="globalSettingsArea" style="margin-top: 50px;"></div>` : ''}
            </div>
          </div>

          <div id="toast">Ação concluída!</div>

          <script>
            const SERVER_CATEGORIES = ${JSON.stringify(SERVER_CATEGORIES)};
            const GLOBAL_CATEGORIES = ${JSON.stringify(GLOBAL_CATEGORIES)};
            const SERVER_SETTINGS = ${JSON.stringify(SERVER_SETTINGS)};
            const GLOBAL_SETTINGS = ${JSON.stringify(GLOBAL_SETTINGS)};

            function intToHexColor(intVal, fallback = '#E1306C') {
              if (intVal === null || intVal === undefined || isNaN(intVal)) return fallback;
              return '#' + intVal.toString(16).padStart(6, '0');
            }

            function switchTab(tabId, btnElement) {
              document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
              document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
              document.getElementById(tabId).classList.add('active');
              btnElement.classList.add('active');
            }

            async function loadConfig() {
              const guildId = document.getElementById('serverSelect').value;
              if(!guildId) return;

              const res = await fetch('/api/config?guildId=' + guildId);
              const data = await res.json();

              renderModules('serverModulesArea', SERVER_CATEGORIES, data.serverConfig, 'server');
              renderSettings('serverSettingsArea', SERVER_SETTINGS, data.serverConfig, 'server');

              if(data.isOwner) {
                  renderModules('globalModulesArea', GLOBAL_CATEGORIES, data.globalConfig, 'global', '👑 Módulos Globais (Apenas Bryan)');
                  renderSettings('globalSettingsArea', GLOBAL_SETTINGS, data.globalConfig, 'global', '👑 Identidade Visual Global (Apenas Bryan)');
              }
            }

            function renderModules(containerId, categoryList, dbData, type, customTitle = null) {
              const container = document.getElementById(containerId);
              if(!container) return;
              let html = customTitle ? \`<div class="category-title" style="color: #ffffff; border-color: #ffffff; font-size: 18px;">\${customTitle}</div>\` : '';
              html += categoryList.map(cat => {
                let catHtml = \`<div class="category-title">\${cat.category}</div><div class="grid">\`;
                catHtml += cat.features.map(feat => {
                  const isChecked = dbData[feat.id] ? 'checked' : '';
                  return \`<div class="card"><div class="card-info"><h3>\${feat.name}</h3><p>\${feat.desc}</p></div><label class="switch"><input type="checkbox" \${isChecked} onchange="toggleFeature('\${type}', '\${feat.id}', this.checked)"><span class="slider"></span></label></div>\`;
                }).join('');
                catHtml += \`</div>\`;
                return catHtml;
              }).join('');
              container.innerHTML = html;
            }

            function renderSettings(containerId, categoryList, dbData, type, customTitle = null) {
              const container = document.getElementById(containerId);
              if(!container) return;
              let html = customTitle ? \`<div class="category-title" style="color: #ffffff; border-color: #ffffff; font-size: 18px;">\${customTitle}</div>\` : '';
              html += categoryList.map(cat => {
                let catHtml = \`<div class="category-title">\${cat.category}</div><div class="grid">\`;
                catHtml += cat.items.map(item => {
                  const inputId = \`input_\${type}_\${item.id}\`;

                  if (item.type === 'color') {
                    const fallback = item.id === 'primaryColor' ? '#9B51E0' : '#E1306C';
                    const hexColor = intToHexColor(dbData[item.id], fallback);
                    return \`<div class="setting-item"><label>\${item.name}</label><div class="input-group"><input type="color" id="\${inputId}_picker" value="\${hexColor}" oninput="document.getElementById('\${inputId}').value = this.value"><input type="text" id="\${inputId}" placeholder="Ex: #E1306C" value="\${hexColor}" oninput="document.getElementById('\${inputId}_picker').value = this.value"><button class="save-btn" onclick="saveSetting('\${type}', '\${item.id}', '\${inputId}', 'color')">Salvar</button></div></div>\`;
                  }

                  if (item.type === 'textarea') {
                    const value = dbData[item.id] !== null && dbData[item.id] !== undefined ? dbData[item.id] : '';
                    return \`<div class="setting-item"><label>\${item.name}</label><div class="input-group" style="flex-direction: column;"><textarea id="\${inputId}" placeholder="\${item.placeholder}">\${value}</textarea><button class="save-btn" style="width: 100%;" onclick="saveSetting('\${type}', '\${item.id}', '\${inputId}', 'text')">Salvar Mensagem</button></div></div>\`;
                  }

                  const value = dbData[item.id] !== null && dbData[item.id] !== undefined ? dbData[item.id] : '';
                  return \`<div class="setting-item"><label>\${item.name}</label><div class="input-group"><input type="\${item.type}" id="\${inputId}" placeholder="\${item.placeholder}" value="\${value}"><button class="save-btn" onclick="saveSetting('\${type}', '\${item.id}', '\${inputId}', '\${item.type}')">Salvar</button></div></div>\`;
                }).join('');
                catHtml += \`</div>\`;
                return catHtml;
              }).join('');
              container.innerHTML = html;
            }

            async function toggleFeature(type, featureId, state) {
              const guildId = document.getElementById('serverSelect').value;
              const res = await fetch('/api/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature: featureId, state }) });
              res.ok ? showToast("✅ Módulo atualizado!") : showToast("❌ Erro ao salvar.", true);
            }

            async function saveSetting(type, featureId, inputId, valueType) {
              const guildId = document.getElementById('serverSelect').value;
              const value = document.getElementById(inputId).value;
              const res = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature: featureId, value, valueType }) });
              res.ok ? showToast("💾 Configuração salva com sucesso!") : showToast("❌ Falha ao salvar a configuração.", true);
            }

            function showToast(msg, isError = false) {
              const toast = document.getElementById('toast');
              toast.innerText = msg;
              toast.style.backgroundColor = isError ? '#ed4245' : '#e0c3fc';
              toast.style.color = isError ? 'white' : '#111214';
              toast.className = 'show';
              setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
            }

            window.onload = loadConfig;
          </script>
        </body>
      </html>
    `);
  });

  app.listen(port, '0.0.0.0', () => console.log(`🌐 Dashboard Web rodando na porta ${port}`));
}
'''

def check_brackets(code):
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    for i, char in enumerate(code):
        if char in '({[':
            stack.append((char, i))
        elif char in ')}]':
            if not stack:
                return f"Unexpected closing {char} at char {i}"
            top, pos = stack.pop()
            if pairs[char] != top:
                return f"Mismatched {top} at {pos} with {char} at {i}"
    if stack:
        return f"Unclosed {stack[-1][0]} at {stack[-1][1]}"
    return "OK"

print("Audit check on dashboard server:", check_brackets(server_code))
