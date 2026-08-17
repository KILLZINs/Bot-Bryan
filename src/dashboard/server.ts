import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import { prisma } from '../database/client'; // Conexão com seu banco Prisma

// 🧩 SISTEMA PLUG AND PLAY
const SYSTEM_CONFIGS = [
  { id: 'sistema_rpg', name: '⚔️ Sistema de RPG', desc: 'Ativa batalhas, dungeons e exploração.', active: true },
  { id: 'sistema_pets', name: '🐾 Sistema de Pets', desc: 'Habilita pets em combate e level up.', active: true },
  { id: 'boss_mundial', name: '🐉 Boss Mundial', desc: 'Spawns aleatórios de bosses na aliança.', active: false },
  { id: 'sistema_vip', name: '👑 Benefícios VIP', desc: 'Dobra o XP e Ouro ganho pelos VIPs.', active: true },
  { id: 'logs_avancados', name: '📜 Logs Avançados', desc: 'Registra as ações no banco de dados.', active: true },
];

// 👑 COLOQUE O SEU ID DO DISCORD AQUI PARA TER ACESSO MASTER
const BOT_OWNER_ID = 'COLOQUE_SEU_ID_AQUI'; 

export function startDashboard() {
  const app = express();
  app.use(cookieParser());
  const port = Number(process.env.PORT) || 8080;

  const dashboardUrl = process.env.DASHBOARD_URL || 'https://bryanbot.up.railway.app';
  const clientId = process.env.CLIENT_ID; 
  const clientSecret = process.env.CLIENT_SECRET;

  // 1️⃣ TELA INICIAL (Login)
  app.get('/', (req, res) => {
    res.send(`
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Skyline - Centro de Comando</title>
          <style>
            body { background-color: #0b0a0f; color: white; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding-top: 150px; margin: 0; background-image: radial-gradient(circle at 50% 0%, #2b0b5e 0%, transparent 50%); }
            h1 { color: #f1c40f; margin-bottom: 10px; font-size: 2.8rem; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 0 15px rgba(241, 196, 15, 0.5); }
            .container { background-color: rgba(20, 18, 24, 0.8); padding: 50px; border-radius: 15px; display: inline-block; box-shadow: 0 0 40px rgba(138, 43, 226, 0.3); border: 1px solid #3d1c73; backdrop-filter: blur(10px); }
            .btn-discord { background-color: #6a0dad; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block; margin-top: 30px; transition: all 0.3s ease; box-shadow: 0 0 15px rgba(106, 13, 173, 0.6); border: 1px solid #9d4edd; }
            .btn-discord:hover { background-color: #9d4edd; transform: translateY(-3px); box-shadow: 0 0 25px rgba(157, 78, 221, 0.9); }
            .subtitle { color: #b5bac1; font-size: 1.1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🛡️ Skyline Admin</h1>
            <p class="subtitle">Acesso restrito para Representantes e Donos de Servidor.</p>
            <a href="/login" class="btn-discord">Autenticar Credenciais</a>
          </div>
        </body>
      </html>
    `);
  });

  // 2️⃣ ROTA DE LOGIN
  app.get('/login', (req, res) => {
    const redirectUri = encodeURIComponent(`${dashboardUrl}/auth/callback`);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    res.redirect(authUrl);
  });

  // 3️⃣ O CÃO DE GUARDA COM ACESSO AO BANCO DE DADOS
  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.send('Código não fornecido.');

    try {
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${dashboardUrl}/auth/callback`,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      const accessToken = tokenResponse.data.access_token;

      // Pega os dados do usuário no Discord
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const userId = userResponse.data.id;
      const username = userResponse.data.username;
      
      // 🛑 Consulta no Banco de Dados (AllianceServerMember)
      const isBotOwner = userId === BOT_OWNER_ID;
      const userRoles = await prisma.allianceServerMember.findMany({
        where: { userId: userId }
      });

      // Se não for o dono do bot E não tiver nenhum cargo registrado na Aliança, toma Block!
      if (!isBotOwner && userRoles.length === 0) { 
        return res.status(403).send(`
          <body style="background-color: #0b0a0f; color: white; font-family: sans-serif; text-align: center; padding-top: 150px;">
            <h1 style="color: #ed4245; text-shadow: 0 0 10px rgba(237,66,69,0.5);">🛑 Acesso Negado</h1>
            <p style="color: #b5bac1;">Identidade: <b>${username}</b></p>
            <p style="color: #949ba4;">Você não está registrado como Representante ou Dono de nenhum servidor da Aliança.</p>
            <br><a href="/" style="color: #9d4edd; text-decoration: none; font-weight: bold;">Voltar</a>
          </body>
        `);
      }

      // 🎫 Dá o Crachá pro usuário guardando o ID dele
      res.cookie('skyline_auth', 'permitido', { maxAge: 1000 * 60 * 60 * 24 }); 
      res.cookie('skyline_userid', userId, { maxAge: 1000 * 60 * 60 * 24 }); 
      res.cookie('skyline_username', username, { maxAge: 1000 * 60 * 60 * 24 }); 
      res.redirect('/painel');

    } catch (error) {
      console.error(error);
      res.status(500).send('Erro interno ao processar o login.');
    }
  });

  // 4️⃣ O DASHBOARD DINÂMICO
  app.get('/painel', async (req, res) => {
    if (req.cookies?.skyline_auth !== 'permitido') {
      return res.redirect('/');
    }

    const userId = req.cookies?.skyline_userid;
    const userName = req.cookies?.skyline_username || 'Representante';

    // 🔍 BUSCAR OS SERVIDORES DO USUÁRIO PARA O SELETOR
    let authorizedServers = [];
    
    if (userId === BOT_OWNER_ID) {
      // Se for você, puxa todos os servidores da tabela AllianceServer
      authorizedServers = await prisma.allianceServer.findMany();
    } else {
      // Se for um representante, puxa só os dele via relação
      const memberRecords = await prisma.allianceServerMember.findMany({
        where: { userId: userId },
        include: { server: true } // Puxa os dados do servidor junto
      });
      // Extrai a parte do servidor da resposta
      authorizedServers = memberRecords.map(record => record.server).filter(s => s !== null);
    }

    // Gerar as tags <option> para o HTML
    const serverOptionsHTML = authorizedServers.length > 0 
      ? authorizedServers.map(s => `<option value="${s.guildId}">${s.guildName || 'Servidor Desconhecido'}</option>`).join('')
      : `<option disabled>Nenhum servidor encontrado</option>`;

    // Cards
    const cardsHTML = SYSTEM_CONFIGS.map(config => `
      <div class="card">
        <div class="card-info">
          <h3>${config.name}</h3>
          <p>${config.desc}</p>
        </div>
        <label class="switch">
          <input type="checkbox" ${config.active ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `).join('');

    res.send(`
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Skyline - Configurações</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background-color: #0b0a0f; color: #dcddde; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; height: 100vh; overflow: hidden; }
            
            /* Sidebar Roxa Neon */
            .sidebar { width: 280px; background-color: rgba(20, 18, 24, 0.95); display: flex; flex-direction: column; border-right: 1px solid #3d1c73; box-shadow: 2px 0 20px rgba(106, 13, 173, 0.15); z-index: 10; }
            .sidebar-header { padding: 30px 20px; text-align: center; border-bottom: 1px solid #2b0b5e; margin-bottom: 20px; background: linear-gradient(180deg, rgba(106,13,173,0.1) 0%, transparent 100%); }
            .sidebar-header h2 { color: #f1c40f; font-size: 26px; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(241,196,15,0.4); margin-bottom: 5px; }
            .sidebar-header p { color: #9d4edd; font-size: 12px; font-weight: bold; }
            
            /* Perfil do Usuário */
            .user-profile { padding: 0 20px; margin-bottom: 25px; display: flex; align-items: center; gap: 10px; }
            .user-avatar { width: 40px; height: 40px; border-radius: 50%; background-color: #5865F2; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; border: 2px solid #9d4edd; box-shadow: 0 0 10px rgba(157,78,221,0.5); }
            .user-info { display: flex; flex-direction: column; }
            .user-name { color: white; font-weight: bold; font-size: 14px; }
            .user-role { color: #a3a3a3; font-size: 11px; }

            /* Seletor de Servidor */
            .server-selector { padding: 0 20px; margin-bottom: 25px; }
            .server-selector p { font-size: 12px; color: #a3a3a3; margin-bottom: 8px; text-transform: uppercase; font-weight: bold; }
            .server-selector select { width: 100%; padding: 12px; background-color: #111214; color: white; border: 1px solid #3d1c73; border-radius: 8px; font-weight: bold; outline: none; cursor: pointer; transition: 0.3s; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); }
            .server-selector select:focus { border-color: #9d4edd; box-shadow: 0 0 10px rgba(157, 78, 221, 0.4); }
            .server-selector option { background-color: #111214; }

            .nav-menu { padding: 0 15px; display: flex; flex-direction: column; gap: 8px; }
            .nav-item { padding: 14px 15px; background-color: transparent; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px; transition: all 0.2s ease; display: flex; align-items: center; gap: 12px; color: #a3a3a3; border: 1px solid transparent; }
            .nav-item:hover { background-color: rgba(106, 13, 173, 0.1); color: #dbdee1; border-color: rgba(106, 13, 173, 0.3); }
            .nav-item.active { background: linear-gradient(90deg, #6a0dad 0%, #47126b 100%); color: white; box-shadow: 0 4px 15px rgba(106, 13, 173, 0.4); border-color: #9d4edd; }
            
            /* Área Principal */
            .content { flex: 1; padding: 50px; overflow-y: auto; background-image: radial-gradient(circle at right top, rgba(106,13,173,0.05) 0%, transparent 50%); }
            .content h1 { color: white; margin-bottom: 10px; font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
            .content p.subtitle { margin-bottom: 40px; font-size: 16px; color: #a3a3a3; }
            
            /* Grid dos Cards */
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 25px; }
            .card { background-color: rgba(20, 18, 24, 0.7); padding: 25px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #2b0b5e; transition: all 0.3s ease; box-shadow: 0 8px 20px rgba(0,0,0,0.2); backdrop-filter: blur(5px); }
            .card:hover { transform: translateY(-5px); border-color: #9d4edd; box-shadow: 0 10px 25px rgba(157, 78, 221, 0.3); background-color: rgba(30, 20, 40, 0.8); }
            .card h3 { color: #f2f3f5; font-size: 18px; margin-bottom: 8px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
            .card p { font-size: 13.5px; color: #a3a3a3; margin: 0; line-height: 1.5; }
            
            /* Toggle Switch Neon */
            .switch { position: relative; display: inline-block; width: 50px; height: 26px; flex-shrink: 0; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #111214; transition: .3s; border-radius: 34px; border: 1px solid #3d1c73; box-shadow: inset 0 0 5px rgba(0,0,0,0.5); }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: #a3a3a3; transition: .3s; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.5); }
            input:checked + .slider { background-color: #6a0dad; border-color: #9d4edd; box-shadow: 0 0 10px rgba(157,78,221,0.5); }
            input:checked + .slider:before { transform: translateX(24px); background-color: white; box-shadow: 0 0 8px white; }
          </style>
        </head>
        <body>
          <div class="sidebar">
            <div class="sidebar-header">
              <h2>🛡️ Skyline</h2>
              <p>PAINEL DE COMANDO</p>
            </div>
            
            <div class="user-profile">
              <div class="user-avatar">${userName.charAt(0).toUpperCase()}</div>
              <div class="user-info">
                <span class="user-name">${userName}</span>
                <span class="user-role">${userId === BOT_OWNER_ID ? 'Administrador Chefe' : 'Representante'}</span>
              </div>
            </div>

            <div class="server-selector">
              <p>Gerenciar Servidor</p>
              <select id="serverSelect">
                ${serverOptionsHTML}
              </select>
            </div>

            <div class="nav-menu">
              <div class="nav-item active">⚙️ Funcionalidades</div>
              <div class="nav-item">📜 Logs e Registros</div>
              <div class="nav-item">💎 Membros VIP</div>
            </div>
          </div>
          
          <div class="content">
            <h1>Configurações do Bot</h1>
            <p class="subtitle">Gerencie os módulos ativos na Aliança Skyline para o servidor selecionado.</p>
            <div class="grid">
              ${cardsHTML}
            </div>
          </div>
        </body>
      </html>
    `);
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Dashboard Web rodando na porta ${port}`);
  });
}
