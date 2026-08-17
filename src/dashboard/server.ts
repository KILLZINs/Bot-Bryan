import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma } from '../database/client';

// 👑 COLOQUE O SEU ID DO DISCORD AQUI PARA ACESSO MÁXIMO
const BOT_OWNER_ID = 'COLOQUE_SEU_ID_AQUI'; 

// 🧩 CATEGORIAS DE MÓDULOS DO SERVIDOR
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
      { id: 'featAnnouncements', name: '📢 Anúncios', desc: 'Eventos globais e avisos do servidor.' }
    ]
  }
];

// 🧩 FUNCIONALIDADES GLOBAIS DO BOT
const GLOBAL_CATEGORIES = [
  {
    category: "⚙️ Sistemas Centrais",
    features: [
      { id: 'featAfk', name: '💤 Sistema AFK', desc: 'Habilita comando /afk e monitoramento de menções.' },
      { id: 'featWelcomeDm', name: '📩 DM de Boas-vindas', desc: 'Recepciona novos membros com mensagem no privado.' }
    ]
  }
];

export function startDashboard() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  
  // Acesso às imagens Skyline
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
            body { 
              background: linear-gradient(rgba(11, 10, 15, 0.85), rgba(11, 10, 15, 0.98)), url('/skyline%20banner%204k.jpg') no-repeat center center fixed; 
              background-size: cover;
              color: white; font-family: 'Segoe UI', Tahoma, sans-serif; text-align: center; padding-top: 100px; margin: 0; 
            }
            .icon-glow { width: 120px; height: 120px; border-radius: 50%; border: 2px solid #b388eb; box-shadow: 0 0 30px rgba(157, 78, 221, 0.6); margin-bottom: 25px; object-fit: cover; }
            h1 { color: #ffffff; margin-bottom: 5px; font-size: 2.2rem; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 0 20px rgba(255, 255, 255, 0.3); font-weight: 800; }
            .container { background-color: rgba(18, 15, 24, 0.75); padding: 60px 50px; border-radius: 12px; display: inline-block; box-shadow: 0 0 50px rgba(106, 13, 173, 0.3); border: 1px solid rgba(157, 78, 221, 0.3); backdrop-filter: blur(12px); }
            .btn-discord { background-color: #7b2cbf; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; margin-top: 30px; transition: 0.3s; border: 1px solid #9d4edd; letter-spacing: 1px; text-transform: uppercase; }
            .btn-discord:hover { background-color: #9d4edd; transform: translateY(-2px); box-shadow: 0 5px 20px rgba(157, 78, 221, 0.7); }
            .subtitle { color: #b0a8ba; font-size: 1rem; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="/skylineicon.jpg" class="icon-glow" alt="Skyline Icon">
            <h1>Bryan Dashboard</h1>
            <p class="subtitle">SISTEMA CENTRAL DE COMANDO</p>
            <a href="/login" class="btn-discord">Autenticar Credenciais</a>
          </div>
        </body>
      </html>
    `);
  });

  app.get('/login', (req, res) => {
    const redirectUri = encodeURIComponent(`${dashboardUrl}/auth/callback`);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`);
  });

  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.send('Código não fornecido.');

    try {
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: clientId!, client_secret: clientSecret!, grant_type: 'authorization_code', code: code, redirect_uri: `${dashboardUrl}/auth/callback`,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
      });
      
      const { id: userId, username } = userResponse.data;
      
      const isBotOwner = userId === BOT_OWNER_ID;
      const userRoles = await prisma.allianceServerMember.findMany({ where: { userId: userId } });

      if (!isBotOwner && userRoles.length === 0) { 
        return res.status(403).send(`
          <body style="background-color: #0b0a0f; color: white; font-family: sans-serif; text-align: center; padding-top: 150px;">
            <h1 style="color: #ed4245;">🛑 Acesso Negado</h1>
            <p style="color: #949ba4;">Você não possui credenciais ativas na Aliança.</p>
            <br><a href="/" style="color: #b388eb; font-weight: bold;">Voltar</a>
          </body>
        `);
      }

      res.cookie('skyline_auth', 'permitido', { maxAge: 1000 * 60 * 60 * 24 }); 
      res.cookie('skyline_userid', userId, { maxAge: 1000 * 60 * 60 * 24 }); 
      res.cookie('skyline_username', username, { maxAge: 1000 * 60 * 60 * 24 }); 
      res.redirect('/painel');
    } catch (error) { res.status(500).send('Erro na autenticação.'); }
  });

  app.get('/api/config', async (req, res) => {
    const guildId = req.query.guildId as string;
    const userId = req.cookies?.skyline_userid;
    if (!userId || !guildId) return res.status(401).json({ error: 'Não autorizado' });

    try {
      let serverConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
      if (!serverConfig) serverConfig = await prisma.guildConfig.create({ data: { guildId } });

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
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });

    try {
      if (type === 'server') {
        const dbCols = await prisma.guildConfig.findFirst();
        if(dbCols && Object.keys(dbCols).includes(feature)) {
            await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: state } });
        }
      } else if (type === 'global' && userId === BOT_OWNER_ID) {
        await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: state } });
      }
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar.' }); }
  });

  app.get('/painel', async (req, res) => {
    if (req.cookies?.skyline_auth !== 'permitido') return res.redirect('/');

    const userId = req.cookies?.skyline_userid;
    const userName = req.cookies?.skyline_username || 'Administrador';

    let authorizedServers = [];
    if (userId === BOT_OWNER_ID) {
      authorizedServers = await prisma.allianceServer.findMany();
    } else {
      const memberRecords = await prisma.allianceServerMember.findMany({ where: { userId: userId }, include: { server: true } });
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
            
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: #0b0a0f; }
            ::-webkit-scrollbar-thumb { background: #3d1c73; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #7b2cbf; }

            .sidebar { width: 300px; background-color: rgba(15,12,20,1); display: flex; flex-direction: column; border-right: 1px solid rgba(157, 78, 221, 0.2); box-shadow: 2px 0 20px rgba(0,0,0,0.5); z-index: 10; }
            
            .sidebar-header { 
              padding: 45px 20px 25px 20px; text-align: center; border-bottom: 1px solid rgba(157, 78, 221, 0.2); margin-bottom: 20px;
              background: linear-gradient(rgba(15,12,20,0.8), rgba(15,12,20,1)), url('/skyline%20banner%204k.jpg') center/cover;
            }
            .sidebar-header h2 { color: #ffffff; font-size: 20px; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(0,0,0,0.8); margin-bottom: 5px; font-weight: 800;}
            .sidebar-header p { color: #b388eb; font-size: 10px; font-weight: bold; letter-spacing: 1px;}
            
            .user-profile { padding: 0 25px; margin-bottom: 30px; display: flex; align-items: center; gap: 15px; }
            .user-avatar { width: 48px; height: 48px; border-radius: 50%; border: 2px solid #7b2cbf; box-shadow: 0 0 15px rgba(123,44,191,0.4); background: url('/skylineicon.jpg') center/cover; }
            .user-info { display: flex; flex-direction: column; }
            .user-name { color: #ffffff; font-weight: bold; font-size: 15px; letter-spacing: 0.5px;}
            .user-role { color: #b0a8ba; font-size: 12px; }

            .server-selector { padding: 0 25px; margin-bottom: 25px; }
            .server-selector p { font-size: 11px; color: #b0a8ba; margin-bottom: 8px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;}
            .server-selector select { width: 100%; padding: 14px; background-color: #1a1721; color: #ffffff; border: 1px solid #3d1c73; border-radius: 6px; font-weight: bold; outline: none; cursor: pointer; transition: 0.3s; }
            .server-selector select:focus { border-color: #b388eb; box-shadow: 0 0 15px rgba(157,78,221,0.2); }
            .server-selector option { background-color: #1a1721; }

            .content { flex: 1; padding: 40px 50px; overflow-y: auto; background-image: radial-gradient(circle at right top, rgba(123,44,191,0.08) 0%, transparent 50%); }
            
            .content-header { 
              background: linear-gradient(90deg, rgba(20,15,30,1) 0%, rgba(106,13,173,0.2) 100%), url('/skyline%20banner%204k.jpg') right/cover; 
              padding: 40px; border-radius: 12px; margin-bottom: 40px; border: 1px solid rgba(157, 78, 221, 0.2); box-shadow: 0 8px 30px rgba(0,0,0,0.4);
            }
            .content-header h1 { color: #ffffff; margin-bottom: 8px; font-size: 30px; text-shadow: 0 2px 5px rgba(0,0,0,0.8); font-weight: 800; letter-spacing: 1px;}
            .content-header p { color: #b0a8ba; font-size: 15px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }

            .category-title { color: #e0c3fc; font-size: 16px; margin: 40px 0 15px 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid rgba(157, 78, 221, 0.2); padding-bottom: 10px;}
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 20px; }
            
            .card { background-color: rgba(22,18,30,0.6); padding: 22px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(106, 13, 173, 0.3); transition: 0.3s; backdrop-filter: blur(5px); }
            .card:hover { border-color: #b388eb; box-shadow: 0 5px 20px rgba(157,78,221,0.2); background-color: rgba(30,25,40,0.8);}
            .card h3 { color: #ffffff; font-size: 15px; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px;}
            .card p { font-size: 12.5px; color: #a097a8; margin: 0; line-height: 1.5; }
            
            .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #1f1b29; transition: .3s; border-radius: 34px; border: 1px solid #4a287a; }
            .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: #b0a8ba; transition: .3s; border-radius: 50%; }
            input:checked + .slider { background-color: #7b2cbf; border-color: #b388eb; box-shadow: 0 0 10px rgba(157,78,221,0.4); }
            input:checked + .slider:before { transform: translateX(20px); background-color: white; box-shadow: 0 0 5px white; }

            #toast { visibility: hidden; min-width: 250px; background-color: #e0c3fc; color: #111214; text-align: center; border-radius: 6px; padding: 16px; position: fixed; z-index: 100; right: 30px; bottom: 30px; font-weight: bold; box-shadow: 0 5px 20px rgba(157,78,221,0.4); opacity: 0; transition: 0.4s; }
            #toast.show { visibility: visible; opacity: 1; bottom: 50px; }
          </style>
        </head>
        <body>
          <div class="sidebar">
            <div class="sidebar-header">
              <h2>Bryan Dashboard</h2>
              <p>ADMINISTRAÇÃO</p>
            </div>
            <div class="user-profile">
              <div class="user-avatar"></div>
              <div class="user-info">
                <span class="user-name">${userName}</span>
                <span class="user-role">${userId === BOT_OWNER_ID ? 'Admin Chefe' : 'Representante'}</span>
              </div>
            </div>
            <div class="server-selector">
              <p>Gerenciando Servidor</p>
              <select id="serverSelect" onchange="loadConfig()">
                ${serverOptionsHTML}
              </select>
            </div>
          </div>
          
          <div class="content">
            <div class="content-header">
              <h1>Painel de Controle</h1>
              <p>As alterações feitas aqui são sincronizadas instantaneamente com o banco de dados e o bot.</p>
            </div>
            
            <div id="serverConfigArea">Carregando módulos...</div>

            ${userId === BOT_OWNER_ID ? `
              <div id="globalConfigArea" style="margin-top: 50px;"></div>
            ` : ''}
          </div>

          <div id="toast">Ação concluída!</div>

          <script>
            const SERVER_CATEGORIES = ${JSON.stringify(SERVER_CATEGORIES)};
            const GLOBAL_CATEGORIES = ${JSON.stringify(GLOBAL_CATEGORIES)};

            async function loadConfig() {
              const guildId = document.getElementById('serverSelect').value;
              if(!guildId) return;

              const res = await fetch('/api/config?guildId=' + guildId);
              const data = await res.json();

              renderCategorizedCards('serverConfigArea', SERVER_CATEGORIES, data.serverConfig, 'server');
              if(data.isOwner) {
                  renderCategorizedCards('globalConfigArea', GLOBAL_CATEGORIES, data.globalConfig, 'global', '👑 Funcionalidades Globais (Apenas Bryan)');
              }
            }

            function renderCategorizedCards(containerId, categoryList, dbData, type, customMainTitle = null) {
              const container = document.getElementById(containerId);
              if(!container) return;
              
              let html = customMainTitle ? \`<div class="category-title" style="color: #ffffff; border-color: #ffffff; font-size: 18px;">\${customMainTitle}</div>\` : '';

              html += categoryList.map(cat => {
                let catHtml = \`<div class="category-title">\${cat.category}</div><div class="grid">\`;
                catHtml += cat.features.map(feat => {
                  const isChecked = dbData[feat.id] ? 'checked' : '';
                  return \`
                    <div class="card">
                      <div class="card-info">
                        <h3>\${feat.name}</h3>
                        <p>\${feat.desc}</p>
                      </div>
                      <label class="switch">
                        <input type="checkbox" \${isChecked} onchange="toggleFeature('\${type}', '\${feat.id}', this.checked)">
                        <span class="slider"></span>
                      </label>
                    </div>
                  \`;
                }).join('');
                catHtml += \`</div>\`;
                return catHtml;
              }).join('');

              container.innerHTML = html;
            }

            async function toggleFeature(type, featureId, state) {
              const guildId = document.getElementById('serverSelect').value;
              const res = await fetch('/api/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, guildId, feature: featureId, state })
              });
              res.ok ? showToast("✅ Sincronizado com o banco!") : showToast("❌ Erro. Coluna não existe no DB.", true);
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
