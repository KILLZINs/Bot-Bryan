import express from 'express';
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
    category: "🛡️ Administração & Moderação",
    features: [
      { id: 'featMod', name: '🔨 Auto-Moderação', desc: 'Filtro anti-spam, links e punições automáticas.' },
      { id: 'featTickets', name: '🎫 Tickets / Suporte', desc: 'Atendimento via canais privados.' },
      { id: 'featSelfRole', name: '🎭 Registro de Cargos', desc: 'Menus interativos para auto-cargo.' }
    ]
  },
  {
    category: "🎉 Engajamento & Comunidade",
    features: [
      { id: 'featLeveling', name: '🎯 XP & Níveis', desc: 'Progressão por mensagens e ranking.' },
      { id: 'featGiveaways', name: '🎁 Sorteios', desc: 'Sorteios automatizados com participação via botão.' },
      { id: 'featPolls', name: '📊 Enquetes', desc: 'Ferramenta de criação de enquetes na comunidade.' },
      { id: 'featSocial', name: '🤝 Roleplay Social', desc: 'Ações de RP como abraçar, bater, beijar.' },
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
      { id: 'featSocial', name: '🤝 Roleplay Social', desc: 'Desliga interações como beijar, bater, abraçar.' },
      { id: 'featAnnouncements', name: '📢 Anúncios', desc: 'Bloqueia os comandos de eventos e avisos.' },
      { id: 'featMusic', name: '🎵 Sistema de Música', desc: 'Desliga o motor de áudio globalmente por segurança.' }
    ]
  }
];

// ==========================================
// ⚙️ 2. CONFIGURAÇÕES AVANÇADAS (INPUTS: TEXT E NUMBER)
// ==========================================
const SERVER_SETTINGS = [
  {
    category: "📁 Canais e Categorias (IDs)",
    items: [
      { id: 'logChannelId', name: 'Canal de Logs', type: 'text', placeholder: 'Onde os logs de moderação vão cair' },
      { id: 'welcomeChannelId', name: 'Canal de Boas-Vindas', type: 'text', placeholder: 'Canal para novas entradas' },
      { id: 'announcementChannelId', name: 'Canal de Anúncios', type: 'text', placeholder: 'Canal para avisos globais/eventos' },
      { id: 'suggestionChannelId', name: 'Canal de Sugestões', type: 'text', placeholder: 'Onde o /sugestao vai ser enviado' },
      { id: 'feedbackChannelId', name: 'Canal de Feedback', type: 'text', placeholder: 'Onde o /feedback vai ser enviado' },
      { id: 'levelUpChannelId', name: 'Canal de Level Up', type: 'text', placeholder: 'Avisa que o membro subiu de nível' }
    ]
  },
  {
    category: "🎫 Sistema de Tickets (IDs)",
    items: [
      { id: 'ticketCategoryId', name: 'Categoria de Tickets', type: 'text', placeholder: 'Onde os tickets abrem' },
      { id: 'ticketLogChannelId', name: 'Logs de Tickets (Transcripts)', type: 'text', placeholder: 'Salvar o histórico dos tickets' }
    ]
  },
  {
    category: "🛡️ Cargos de Permissão e Moderação (IDs)",
    items: [
      { id: 'adminRoleId', name: 'Cargo de Administrador', type: 'text', placeholder: 'Cargo com passe livre no bot' },
      { id: 'modRoleId', name: 'Cargo de Moderador', type: 'text', placeholder: 'Pode usar comandos de punição' },
      { id: 'mutedRoleId', name: 'Cargo de Mutado', type: 'text', placeholder: 'Cargo dado ao tomar mute' },
      { id: 'autoRoleId', name: 'Cargo Automático (Auto-Role)', type: 'text', placeholder: 'Dado ao membro quando entra' },
      { id: 'memberRoleId', name: 'Cargo de Membro Registrado', type: 'text', placeholder: 'Cargo oficial da comunidade' }
    ]
  },
  {
    category: "🎯 Balanceamento de XP",
    items: [
      { id: 'xpMin', name: 'XP Mínimo por Mensagem', type: 'number', placeholder: 'Ex: 15' },
      { id: 'xpMax', name: 'XP Máximo por Mensagem', type: 'number', placeholder: 'Ex: 25' },
      { id: 'xpCooldown', name: 'Cooldown de XP (Segundos)', type: 'number', placeholder: 'Ex: 60' }
    ]
  },
  {
    category: "💬 Mensagens Personalizadas",
    items: [
      { id: 'welcomeMessage', name: 'Mensagem de Recepção', type: 'text', placeholder: 'Ex: Bem-vindo(a) à Aliança, {user}!' }
    ]
  }
];

const GLOBAL_SETTINGS = [
  {
    category: "🎨 Personalização Global do Bot",
    items: [
      { id: 'footerText', name: 'Texto de Rodapé Padrão', type: 'text', placeholder: 'Aparece na maioria das embeds' },
      { id: 'rpFooterText', name: 'Rodapé Roleplay', type: 'text', placeholder: 'Aparece nos comandos de /rp' },
      { id: 'botIconUrl', name: 'Ícone do Bot (Link da Imagem)', type: 'text', placeholder: 'Ex: https://i.imgur.com/foto.png' },
      { id: 'primaryColor', name: 'Cor Primária (Número Decimal)', type: 'number', placeholder: 'Ex: 10180278' }
    ]
  }
];

// ==========================================
// 🚀 INÍCIO DO SERVIDOR WEB
// ==========================================
export function startDashboard() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  
  // Imagens da Skyline
  app.use(express.static(path.join(process.cwd(), 'public')));
  
  const port = Number(process.env.PORT) || 8080;
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://bryanbot.up.railway.app';
  const clientId = process.env.CLIENT_ID; 
  const clientSecret = process.env.CLIENT_SECRET;

  app.get('/', (req, res) => {
    res.send(`
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bryan Dashboard - Acesso</title>
          <style>
            body { background: linear-gradient(rgba(11, 10, 15, 0.85), rgba(11, 10, 15, 0.98)), url('/skyline%20banner%204k.jpg') no-repeat center center fixed; background-size: cover; color: white; font-family: 'Segoe UI', sans-serif; text-align: center; padding-top: 100px; margin: 0; }
            .icon-glow { width: 120px; height: 120px; border-radius: 50%; border: 2px solid #b388eb; box-shadow: 0 0 30px rgba(157, 78, 221, 0.6); margin-bottom: 25px; object-fit: cover; }
            h1 { color: #ffffff; margin-bottom: 5px; font-size: 2.2rem; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 0 20px rgba(255, 255, 255, 0.3); font-weight: 800; }
            .container { background-color: rgba(18, 15, 24, 0.75); padding: 60px 50px; border-radius: 12px; display: inline-block; box-shadow: 0 0 50px rgba(106, 13, 173, 0.3); border: 1px solid rgba(157, 78, 221, 0.3); backdrop-filter: blur(12px); }
            .btn-discord { background-color: #7b2cbf; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; margin-top: 30px; transition: 0.3s; border: 1px solid #9d4edd; text-transform: uppercase; letter-spacing: 1px; }
            .btn-discord:hover { background-color: #9d4edd; transform: translateY(-2px); box-shadow: 0 5px 20px rgba(157, 78, 221, 0.7); }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="/skylineicon.jpg" class="icon-glow">
            <h1>Bryan Dashboard</h1>
            <p style="color: #b0a8ba; font-weight: 500;">SISTEMA CENTRAL DE COMANDO</p>
            <a href="/login" class="btn-discord">Autenticar Credenciais</a>
          </div>
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

  app.get('/api/config', async (req, res) => {
    const { guildId } = req.query;
    const userId = req.cookies?.skyline_userid;
    if (!userId || !guildId) return res.status(401).json({ error: 'Não autorizado' });

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
    const { type, guildId, feature, state } = req.body;
    try {
      if (type === 'server') await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: state } });
      else if (type === 'global') await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: state } });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar.' }); }
  });

  app.post('/api/update', async (req, res) => {
    const { type, guildId, feature, value, valueType } = req.body;
    let finalValue: string | number | null = value;

    if (valueType === 'number') {
      finalValue = parseInt(value, 10);
      if (isNaN(finalValue)) finalValue = 0;
    }
    if (value === "") finalValue = null;

    // 🛡️ Segurança: primaryColor é Int obrigatório no Prisma, não pode ser null.
    if (feature === 'primaryColor' && finalValue === null) finalValue = 10180278; 

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
            .input-group { display: flex; gap: 10px; }
            .input-group input { flex: 1; background: #1a1721; border: 1px solid #3d1c73; color: white; padding: 12px; border-radius: 6px; outline: none; transition: 0.3s; }
            .input-group input:focus { border-color: #b388eb; box-shadow: 0 0 10px rgba(157,78,221,0.2); }
            .save-btn { background: #7b2cbf; border: none; color: white; padding: 0 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; text-transform: uppercase; font-size: 12px;}
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
                  const value = dbData[item.id] !== null ? dbData[item.id] : '';
                  const inputId = \`input_\${type}_\${item.id}\`;
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
