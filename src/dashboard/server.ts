import express from 'express';
import axios from 'axios';
import { isGuildAllowed } from '../utils/allowlist'; // Puxa a verificação direto do seu bot!

export function startDashboard() {
  const app = express();
  const port = Number(process.env.PORT) || 8080;

  // Usa as variáveis que você configurou no Railway
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://bryanbot.up.railway.app';
  const clientId = process.env.CLIENT_ID; 
  const clientSecret = process.env.CLIENT_SECRET; // Lendo exatamente como você criou!

  // 1️⃣ TELA INICIAL (Agora com o botão de Login)
  app.get('/', (req, res) => {
    res.send(`
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aliança Skyline - Dashboard</title>
          <style>
            body { background-color: #1e1f22; color: white; font-family: sans-serif; text-align: center; padding-top: 100px; }
            h1 { color: #f1c40f; }
            .container { background-color: #2b2d31; padding: 40px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
            .btn-discord { background-color: #5865F2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 18px; display: inline-block; margin-top: 20px; transition: 0.2s; }
            .btn-discord:hover { background-color: #4752C4; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>👑 Painel da Aliança Skyline</h1>
            <p>Área restrita. Faça login para verificar sua autorização.</p>
            <a href="/login" class="btn-discord">Entrar com Discord</a>
          </div>
        </body>
      </html>
    `);
  });

  // 2️⃣ ROTA DE LOGIN (Manda o usuário pro Discord)
  app.get('/login', (req, res) => {
    const redirectUri = encodeURIComponent(`${dashboardUrl}/auth/callback`);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
    
    res.redirect(authUrl);
  });

  // 3️⃣ O VEREDITO (O Discord devolve o usuário pra cá)
  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.send('Código não fornecido pelo Discord.');

    try {
      // Troca o código pelo Token do usuário
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${dashboardUrl}/auth/callback`,
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const accessToken = tokenResponse.data.access_token;

      // Pega a lista de servidores em que esse usuário está
      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const userGuildIds = guildsResponse.data.map((g: any) => g.id);

      // 🛡️ A BARREIRA DA ALLOWLIST
      // Verifica se algum servidor do usuário bate com a allowlist do bot
      const hasAccess = userGuildIds.some((id: string) => isGuildAllowed(id));

      if (!hasAccess) {
        return res.status(403).send(`
          <html lang="pt-BR">
            <body style="background-color: #1e1f22; color: white; font-family: sans-serif; text-align: center; padding-top: 100px;">
              <h1 style="color: #ed4245;">🛑 Acesso Negado</h1>
              <p>Este painel é exclusivo para membros da Aliança Skyline.</p>
              <p>Você não está em nenhum servidor autorizado pelo bot.</p>
              <br><a href="/" style="color: #5865F2; text-decoration: none;">Voltar ao início</a>
            </body>
          </html>
        `);
      }

      // 🎉 SUCESSO!
      res.send(`
        <html lang="pt-BR">
          <body style="background-color: #1e1f22; color: white; font-family: sans-serif; text-align: center; padding-top: 100px;">
            <h1 style="color: #57F287;">✅ Acesso Permitido!</h1>
            <p>Sua identidade foi verificada. Você faz parte da Aliança Skyline.</p>
            <p style="color: #b5bac1; margin-top: 20px;">O Dashboard completo será carregado aqui em breve.</p>
          </body>
        </html>
      `);

    } catch (error: any) {
      console.error('Erro na autenticação:', error?.response?.data || error.message);
      res.status(500).send('Erro interno ao tentar processar o login com o Discord.');
    }
  });

  // O '0.0.0.0' avisa pro Railway que pode aceitar conexões da internet
  app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Dashboard Web rodando na porta ${port}`);
  });
}
