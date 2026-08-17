import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma } from '../database/client';

// 🧩 MAPEAMENTO DO BANCO DE DADOS (Exatamente como no seu Prisma)
const SERVER_FEATURES = [
  { id: 'featLeveling', name: '🎯 XP / Níveis', desc: 'XP por mensagem, level up e ranking.' },
  { id: 'featRpg', name: '⚔️ Sistema de RPG', desc: 'Sistema RPG completo: dungeon, crafting, skills.' },
  { id: 'featTickets', name: '🎫 Tickets / Suporte', desc: 'Sistema de suporte ao membro em canais privados.' },
  { id: 'featPolls', name: '📊 Enquetes', desc: 'Criação de enquetes interativas.' },
  { id: 'featGiveaways', name: '🎁 Sorteios', desc: 'Sistema de sorteios com participação por botão.' },
  { id: 'featSelfRole', name: '🎭 Registro de Cargos', desc: 'Menus de auto-cargo para membros.' },
  { id: 'featMissions', name: '📋 Missões', desc: 'Missões diárias e semanais com recompensas.' },
  { id: 'featSocial', name: '🤝 Roleplay (/rp)', desc: 'Comandos de roleplay social (abraçar, beijar).' },
  { id: 'featEconomy', name: '🪙 Economia (moedas)', desc: 'Sistema de moedas, loja e transferências.' },
  { id: 'featMod', name: '🔨 Auto-Moderação', desc: 'Anti-spam, anti-links e moderação automática.' },
  { id: 'featAnnouncements', name: '📢 Anúncios / Eventos', desc: 'Sistema de anúncios e eventos do servidor.' }
];

const GLOBAL_FEATURES = [
  { id: 'featAfk', name: '💤 Sistema AFK', desc: '/afk disponível, menções detectadas.' },
  { id: 'featWelcomeDm', name: '📩 DM de Boas-vindas', desc: 'Mensagem de boas vindas enviada no privado.' }
];

// 👑 COLOQUE O SEU ID DO DISCORD AQUI PARA TER ACESSO MASTER
const BOT_OWNER_ID = '1195254699943796791'; 

export function startDashboard() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  
  // 🌟 Libera a pasta 'public' para o site conseguir ler suas imagens do Skyline
  app.use(express.static(path.join(process.cwd(), 'public')));
  
  const port = Number(process.env.PORT) || 8080;
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://bryanbot.up.railway.app';
  const clientId = process.env.CLIENT_ID; 
  const clientSecret = process.env.CLIENT_SECRET;

  // 1️⃣ TELA INICIAL (Login com Tema Skyline)
  app.get('/', (req, res) => {
    res.send(`
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bryan Dashboard - Acesso</title>
          <style>
            body { 
              background: linear-gradient(rgba(11, 10, 15, 0.8), rgba(11, 10, 15, 0.95)), url('/skyline%20banner%204k.jpg') no-repeat center center fixed; 
              background-size: cover;
              color: white; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding-top: 100px; margin: 0; 
            }
            .icon-glow { width: 120px; height: 120px; border-radius: 50%; border: 3px solid #9d4edd; box-shadow: 0 0 25px rgba(157, 78, 221, 0.8); margin-bottom: 20px; object-fit: cover; }
            h1 { color: #f1c40f; margin-bottom: 5px; font-size: 2.5rem; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 15px rgba(241, 196, 15, 0.5); }
            .container { background-color: rgba(20, 18, 24, 0.85); padding: 50px; border-radius: 15px; display: inline-block; box-shadow: 0 0 40px rgba(138, 43, 226, 0.4); border: 1px solid #3d1c73; backdrop-filter: blur(10px); }
            .btn-discord { background-color: #6a0dad; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block; margin-top: 25px; transition: 0.3s; border: 1px solid #9d4edd; }
            .btn-discord:hover { background-color: #9d4edd; transform: translateY(-3px); box-shadow: 0 0 20px rgba(157, 78, 221, 0.9); }
            .subtitle { color: #b5bac1; font-size: 1.1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="/skylineicon.jpg" class="icon-glow" alt="Skyline Icon">
            <h1>Bryan Dashboard</h1>
            <p class="subtitle">Acesso restrito. Área de Comando.</p>
            <a href="/login" class="btn-discord">Autenticar Credenciais</a>
          </div>
        </body>
      </html>
    `);
  });

  // 2️⃣ ROTA DE LOGIN
  app.get('/login', (req, res) => {
    const redirectUri = encodeURIComponent(`${dashboardUrl}/auth/callback`);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`);
  });

  // 3️⃣ CÃO DE GUARDA
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
            <p style="color: #949ba4;">Você não possui credenciais ativas como Representante ou Dono na Aliança.</p>
            <br><a href="/" style="color: #9d4edd; font-weight: bold; text-decoration: none;">Voltar</a>
          </body>
        `);
      }

      res.cookie('skyline_auth', 'permitido', { maxAge: 1000 * 60 * 60 * 24 }); 
      res.cookie('skyline_userid', userId, { maxAge: 1000 * 60 * 60 * 24 }); 
      res.cookie('skyline_username', username, { maxAge: 1000 * 60 * 60 * 24 }); 
      res.redirect('/painel');
    } catch (error) { res.status(500).send('Erro na autenticação.'); }
  });

  // =========================================================================
  // 🔌 API INTERNA: Busca as configurações no banco
  // =========================================================================
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
    } catch (error) { res.status(500).json({ error: 'Erro no banco de dados' }); }
  });

  // =========================================================================
  // 🔌 API INTERNA: Salva o clique do Switch direto no Banco
  // =========================================================================
  app.post('/api/toggle', async (req, res) => {
    const { type, guildId, feature, state } = req.body;
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });

    try {
      if (type === 'server') {
        await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: state } });
      } else if (type === 'global' && userId === BOT_OWNER_ID) {
        await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: state } });
      }
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar' }); }
  });

  // 4️⃣ DASHBOARD TEMATIZADO
  app.get('/painel', async (req, res) => {
    if (req.cookies?.skyline_auth !== 'permitido') return res.redirect('/');

    const userId = req.cookies?.skyline_userid;
    const userName = req.cookies?.skyline_username || 'Representante';

    // Puxa só os servidores que o cara tem permissão
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
            body { background-color: #0b0a0f; color: #dcddde; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; height: 100vh; overflow: hidden; }
            
            .sidebar { width: 280px; background-color: rgba(20,18,24,1); display: flex; flex-direction: column; border-right: 1px solid #3d1c73; box-shadow: 2px 0 20px rgba(106,13,173,0.15); z-index: 10; }
            
            /* Header com a sua imagem de Banner */
            .sidebar-header { 
              padding: 40px 20px 20px 20px; text-align: center; border-bottom: 1px solid #2b0b5e; margin-bottom: 20px;
              background: linear-gradient(rgba(20,18,24,0.7), rgba(20,18,24,1)), url('/skyline%20banner%204k.jpg') center/cover;
            }
            .sidebar-header h2 { color: #f1c40f; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 10px rgba(0,0,0,0.8); margin-bottom: 5px; }
            .sidebar-header p { color: #dbdee1; font-size: 11px; font-weight: bold; }
            
            .user-profile { padding: 0 20px; margin-bottom: 25px; display: flex; align-items: center; gap: 10px; }
            
            /* Avatar com a sua imagem de Icone */
            .user-avatar { width: 45px; height: 45px; border-radius: 50%; border: 2px solid #9d4edd; box-shadow: 0 0 10px rgba(157,78,221,0.5); background: url('/skylineicon.jpg') center/cover; }
            .user-info { display: flex; flex-direction: column; }
            .user-name { color: white; font-weight: bold; font-size: 14px; }
            .user-role { color: #a3a3a3; font-size: 11px; }

            .server-selector { padding: 0 20px; margin-bottom: 25px; }
            .server-selector p { font-size: 12px; color: #a3a3a3; margin-bottom: 8px; text-transform: uppercase; font-weight: bold; }
            .server-selector select { width: 100%; padding: 12px; background-color: #111214; color: white; border: 1px solid #3d1c73; border-radius: 8px; font-weight: bold; outline: none; cursor: pointer; transition: 0.3s; }
            .server-selector select:focus { border-color: #9d4edd; box-shadow: 0 0 10px rgba(157,78,221,0.4); }
            .server-selector option { background-color: #111214; }

            .content { flex: 1; padding: 40px; overflow-y: auto; background-image: radial-gradient(circle at right top, rgba(106,13,173,0.05) 0%, transparent 50%); }
            
            /* Header de Conteúdo também com Banner mesclado */
            .content-header { 
              background: linear-gradient(90deg, rgba(30,20,45,1) 0%, rgba(106,13,173,0.3) 100%), url('/skyline%20banner%204k.jpg') right/cover; 
              padding: 40px; border-radius: 15px; margin-bottom: 30px; border: 1px solid #3d1c73; box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            }
            .content-header h1 { color: white; margin-bottom: 5px; font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
            .content-header p { color: #dbdee1; font-size: 16px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }

            .section-title { color: #9d4edd; font-size: 20px; margin: 30px 0 15px 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 10px;}
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
            .card { background-color: rgba(20,18,24,0.7); padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #2b0b5e; transition: 0.3s; box-shadow: 0 8px 20px rgba(0,0,0,0.2); backdrop-filter: blur(5px); }
            .card:hover { border-color: #9d4edd; box-shadow: 0 10px 25px rgba(157,78,221,0.3); }
            .card h3 { color: #f2f3f5; font-size: 16px; margin-bottom: 5px; font-weight: 600; }
            .card p { font-size: 12.5px; color: #a3a3a3; margin: 0; line-height: 1.4; }
            
            /* Toggle Switch Neon */
            .switch { position: relative; display: inline-block; width: 46px; height: 24px; flex-shrink: 0; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #111214; transition: .3s; border-radius: 34px; border: 1px solid #3d1c73; }
            .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: #a3a3a3; transition: .3s; border-radius: 50%; }
            input:checked + .slider { background-color: #6a0dad; border-color: #9d4edd; box-shadow: 0 0 10px rgba(157,78,221,0.5); }
            input:checked + .slider:before { transform: translateX(22px); background-color: white; box-shadow: 0 0 8px white; }

            /* Notificação de Sucesso (Toast) */
            #toast { visibility: hidden; min-width: 250px; background-color: #57F287; color: #111214; text-align: center; border-radius: 5px; padding: 15px; position: fixed; z-index: 100; right: 30px; bottom: 30px; font-weight: bold; box-shadow: 0 4px 15px rgba(87,242,135,0.4); opacity: 0; transition: opacity 0.5s, bottom 0.5s; }
            #toast.show { visibility: visible; opacity: 1; bottom: 50px; }
          </style>
        </head>
        <body>
          <div class="sidebar">
            <div class="sidebar-header">
              <h2>Bryan Dashboard</h2>
              <p>SISTEMA CENTRAL DE COMANDO</p>
            </div>
            <div class="user-profile">
              <div class="user-avatar"></div>
              <div class="user-info">
                <span class="user-name">${userName}</span>
                <span class="user-role">${userId === BOT_OWNER_ID ? 'Administrador Chefe' : 'Representante'}</span>
              </div>
            </div>
            <div class="server-selector">
              <p>Gerenciar Servidor</p>
              <select id="serverSelect" onchange="loadConfig()">
                ${serverOptionsHTML}
              </select>
            </div>
          </div>
          
          <div class="content">
            <div class="content-header">
              <h1>Painel de Controle</h1>
              <p>Alterações feitas aqui são aplicadas no banco de dados e sincronizadas com o bot em tempo real.</p>
            </div>
            
            <div class="section-title">⚙️ Módulos do Servidor</div>
            <div class="grid" id="serverGrid">Carregando...</div>

            ${userId === BOT_OWNER_ID ? `
              <div class="section-title" style="margin-top: 50px; color: #f1c40f;">👑 Funcionalidades Globais (Apenas Bryan)</div>
              <div class="grid" id="globalGrid">Carregando...</div>
            ` : ''}
          </div>

          <div id="toast">Salvo com sucesso!</div>

          <!-- LÓGICA DO JAVASCRIPT INJETADA NA PÁGINA -->
          <script>
            const SERVER_FEATURES = ${JSON.stringify(SERVER_FEATURES)};
            const GLOBAL_FEATURES = ${JSON.stringify(GLOBAL_FEATURES)};

            async function loadConfig() {
              const guildId = document.getElementById('serverSelect').value;
              if(!guildId) return;

              const res = await fetch('/api/config?guildId=' + guildId);
              const data = await res.json();

              renderCards('serverGrid', SERVER_FEATURES, data.serverConfig, 'server');
              if(data.isOwner) renderCards('globalGrid', GLOBAL_FEATURES, data.globalConfig, 'global');
            }

            function renderCards(containerId, featureList, dbData, type) {
              const container = document.getElementById(containerId);
              if(!container) return;
              container.innerHTML = featureList.map(feat => {
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
            }

            async function toggleFeature(type, featureId, state) {
              const guildId = document.getElementById('serverSelect').value;
              const res = await fetch('/api/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, guildId, feature: featureId, state })
              });
              res.ok ? showToast("✅ Sincronizado com o banco e o bot!") : showToast("❌ Erro ao salvar.", true);
            }

            function showToast(msg, isError = false) {
              const toast = document.getElementById('toast');
              toast.innerText = msg;
              toast.style.backgroundColor = isError ? '#ed4245' : '#57F287';
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
