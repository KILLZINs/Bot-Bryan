import express from 'express';
import axios from 'axios';
import { isGuildAllowed } from '../utils/allowlist';

// 🧩 SISTEMA PLUG AND PLAY DE FEATURES
// Quer adicionar um botão novo no site? É só adicionar uma linha aqui!
const SYSTEM_CONFIGS = [
  { id: 'sistema_rpg', name: '⚔️ Sistema de RPG', desc: 'Ativa batalhas, dungeons e exploração.', active: true },
  { id: 'sistema_pets', name: '🐾 Sistema de Pets', desc: 'Habilita pets em combate e level up.', active: true },
  { id: 'boss_mundial', name: '🐉 Boss Mundial', desc: 'Spawns aleatórios de bosses na aliança.', active: false },
  { id: 'sistema_vip', name: '👑 Benefícios VIP', desc: 'Dobra o XP e Ouro ganho pelos VIPs.', active: true },
  { id: 'logs_avancados', name: '📜 Logs Avançados', desc: 'Registra tudo no banco de dados.', active: true },
];

export function startDashboard() {
  const app = express();
  const port = Number(process.env.PORT) || 8080;

  const dashboardUrl = process.env.DASHBOARD_URL || 'https://bryanbot.up.railway.app';
  const clientId = process.env.CLIENT_ID; 
  const clientSecret = process.env.CLIENT_SECRET;

  // 1️⃣ TELA INICIAL (Porta de Entrada)
  app.get('/', (req, res) => {
    res.send(`
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aliança Skyline - Login</title>
          <style>
            body { background-color: #1e1f22; color: white; font-family: sans-serif; text-align: center; padding-top: 100px; margin: 0; }
            h1 { color: #f1c40f; }
            .container { background-color: #2b2d31; padding: 40px; border-radius: 10px; display: inline-block; box-shadow: 0 8px 15px rgba(0,0,0,0.5); }
            .btn-discord { background-color: #5865F2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 18px; display: inline-block; margin-top: 20px; transition: 0.2s; }
            .btn-discord:hover { background-color: #4752C4; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>👑 Painel da Aliança</h1>
            <p>Área restrita. Faça login para verificar sua autorização.</p>
            <a href="/login" class="btn-discord">Entrar com Discord</a>
          </div>
        </body>
      </html>
    `);
  });

  // 2️⃣ ROTA DE LOGIN
  app.get('/login', (req, res) => {
    const redirectUri = encodeURIComponent(`${dashboardUrl}/auth/callback`);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
    res.redirect(authUrl);
  });

  // 3️⃣ O CÃO DE GUARDA (Callback)
  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.send('Código não fornecido pelo Discord.');

    try {
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${dashboardUrl}/auth/callback`,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      const accessToken = tokenResponse.data.access_token;

      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const userGuildIds = guildsResponse.data.map((g: any) => g.id);
      const hasAccess = userGuildIds.some((id: string) => isGuildAllowed(id));

      if (!hasAccess) {
        return res.status(403).send(`
          <body style="background-color: #1e1f22; color: white; font-family: sans-serif; text-align: center; padding-top: 100px;">
            <h1 style="color: #ed4245;">🛑 Acesso Negado</h1>
            <p>Você não está em nenhum servidor autorizado da Aliança Skyline.</p>
            <br><a href="/" style="color: #5865F2; text-decoration: none;">Voltar</a>
          </body>
        `);
      }

      // 🎫 Dá o Crachá pro usuário (Cookie) e manda pro Painel!
      res.cookie('skyline_auth', 'permitido', { maxAge: 1000 * 60 * 60 * 24 }); // Dura 24h
      res.redirect('/painel');

    } catch (error) {
      res.status(500).send('Erro interno ao tentar processar o login.');
    }
  });

  // 4️⃣ O DASHBOARD AUDACIOSO
  app.get('/painel', (req, res) => {
    // Se o cara tentar entrar direto no /painel sem o crachá, é chutado pra fora
    if (!req.headers.cookie?.includes('skyline_auth=permitido')) {
      return res.redirect('/');
    }

    // Pega a nossa lista "Plug and Play" e desenha os cards magicamente
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
          <title>Dashboard - Skyline</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background-color: #1e1f22; color: #dcddde; font-family: sans-serif; display: flex; height: 100vh; }
            
            /* Sidebar Lateral */
            .sidebar { width: 250px; background-color: #2b2d31; padding: 20px; display: flex; flex-direction: column; gap: 15px; border-right: 1px solid #1e1f22; }
            .sidebar h2 { color: #f1c40f; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e1f22; padding-bottom: 15px; }
            .nav-item { padding: 10px 15px; background-color: #1e1f22; border-radius: 5px; cursor: pointer; font-weight: bold; transition: 0.2s; }
            .nav-item:hover, .nav-item.active { background-color: #5865F2; color: white; }
            
            /* Área Principal */
            .content { flex: 1; padding: 40px; overflow-y: auto; }
            .content h1 { color: white; margin-bottom: 10px; }
            .content p { margin-bottom: 30px; font-size: 16px; color: #949ba4; }
            
            /* Grid dos Cards Plug and Play */
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
            .card { background-color: #2b2d31; padding: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
            .card h3 { color: white; font-size: 18px; margin-bottom: 5px; }
            .card p { font-size: 14px; color: #949ba4; margin: 0; }
            
            /* Botão Toggle (Estilo iOS) */
            .switch { position: relative; display: inline-block; width: 50px; height: 28px; flex-shrink: 0; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #80848e; transition: .4s; border-radius: 34px; }
            .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: #57F287; }
            input:checked + .slider:before { transform: translateX(22px); }
          </style>
        </head>
        <body>
          <div class="sidebar">
            <h2>🛡️ Skyline</h2>
            <div class="nav-item active">⚙️ Funcionalidades</div>
            <div class="nav-item">📜 Logs e Registros</div>
            <div class="nav-item">💎 Membros VIP</div>
          </div>
          
          <div class="content">
            <h1>Configurações do Bot</h1>
            <p>Gerencie facilmente os módulos ativos na Aliança Skyline.</p>
            
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
