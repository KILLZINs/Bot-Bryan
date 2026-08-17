import express from 'express';

export function startDashboard() {
  const app = express();
  // O Railway define a porta automaticamente pelo ambiente
  const port = Number(process.env.PORT) || 8080;

  // Rota principal (A página inicial do site)
  app.get('/', (req, res) => {
    res.send(`
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aliança Skyline - Dashboard</title>
          <style>
            body { 
              background-color: #1e1f22; 
              color: white; 
              font-family: sans-serif; 
              text-align: center; 
              padding-top: 100px; 
            }
            h1 { color: #f1c40f; }
            .container {
              background-color: #2b2d31;
              padding: 40px;
              border-radius: 10px;
              display: inline-block;
              box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>👑 Painel da Aliança Skyline</h1>
            <p>O servidor web está vivo e rodando perfeitamente junto com o bot!</p>
            <p style="color: #b5bac1;">Em breve: Login restrito via Discord para a Allowlist.</p>
          </div>
        </body>
      </html>
    `);
  });

  // Liga o servidor e avisa o Railway que pode aceitar conexões (0.0.0.0)
  app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Dashboard Web rodando na porta ${port}`);
  });
}
