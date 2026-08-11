# ⚔️ Aliança Skyline — Bot Discord

Bot oficial da Aliança Skyline, com tema roxo e funcionalidades completas para gerenciamento de guild no Discord.

---

## 🚀 Deploy no Railway (passo a passo)

### 1. Suba o código para o GitHub

```bash
cd discord-bot
git init
git add .
git commit -m "feat: bot aliança skyline"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### 2. Crie o bot no Discord

1. Acesse [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clique em **New Application** → nome: `Aliança Skyline`
3. Vá em **Bot** → clique em **Add Bot**
4. Ative os **Privileged Gateway Intents**:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Copie o **Token** do bot
6. Vá em **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Administrator` (ou permissões específicas)
7. Acesse o link gerado para adicionar o bot ao servidor

### 3. Configure o Railway

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em **New Project → Deploy from GitHub repo**
3. Selecione o repositório do bot
4. Clique em **+ New** → **Database → Add PostgreSQL** (banco gratuito!)
5. Vá em **Variables** e adicione:

```
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=id_do_bot
GUILD_ID=id_do_servidor
DATABASE_URL=${{Postgres.DATABASE_URL}}  ← Railway preenche automaticamente
LOG_CHANNEL_ID=id_do_canal_de_logs
WELCOME_CHANNEL_ID=id_do_canal_de_boas_vindas
ANNOUNCEMENT_CHANNEL_ID=id_do_canal_de_anuncios
TICKET_CATEGORY_ID=id_da_categoria_de_tickets
ADMIN_ROLE_ID=id_do_cargo_admin
MOD_ROLE_ID=id_do_cargo_moderador
MEMBER_ROLE_ID=id_do_cargo_membro
MUTED_ROLE_ID=id_do_cargo_mutado
```

6. O deploy acontece automaticamente!

### 4. Registre os comandos slash

Após o deploy, no terminal do Railway (ou localmente com as variáveis configuradas):

```bash
npm run deploy
```

---

## ✨ Funcionalidades

### 👥 Gerenciamento de Membros
| Comando | Descrição |
|---|---|
| `/membro info [@usuario]` | Exibe perfil completo com XP, nível, rank e moedas |
| `/membro lista` | Lista todos os membros registrados |
| `/membro adicionar @usuario` | [MOD] Adiciona membro à aliança |
| `/membro remover @usuario` | [MOD] Remove membro da aliança |
| `/rank definir @usuario rank` | [MOD] Define o rank do membro |
| `/rank lista` | Lista todos os ranks disponíveis |
| `/nivel [@usuario]` | Mostra nível e barra de XP |
| `/ranking [tipo]` | Ranking por XP ou moedas |

### 🪙 Sistema de Economia
| Comando | Descrição |
|---|---|
| `/recompensa saldo [@usuario]` | Consulta saldo de moedas |
| `/recompensa dar @usuario qtd [motivo]` | [MOD] Dá moedas a um membro |
| `/recompensa remover @usuario qtd` | [MOD] Remove moedas |
| `/recompensa transferir @usuario qtd` | Transfere moedas entre membros |

### 🏆 Conquistas
| Comando | Descrição |
|---|---|
| `/conquista todas` | Lista todas as conquistas disponíveis |
| `/conquista listar [@usuario]` | Conquistas de um membro |
| `/conquista criar nome desc [ícone] [moedas]` | [ADMIN] Cria conquista |
| `/conquista conceder @usuario nome` | [MOD] Concede conquista |

### 🎯 Nível e XP (Automático)
- Ganho de **10 XP por mensagem** (cooldown de 1 minuto)
- Notificação automática ao subir de nível
- 7 ranks: Recruta → Membro → Veterano → Elite → Capitão → Comandante → Líder

### 📅 Eventos
| Comando | Descrição |
|---|---|
| `/evento criar nome desc data [vagas]` | [MOD] Cria evento |
| `/evento listar` | Lista próximos eventos |
| `/evento entrar id` | Inscreve no evento |
| `/evento presenca id` | [MOD] Lista de presença |
| `/evento finalizar id [moedas]` | [MOD] Finaliza e recompensa |
| `/evento cancelar id` | [MOD] Cancela evento |

### 🎫 Sistema de Tickets
| Comando | Descrição |
|---|---|
| `/ticket criar motivo` | Abre ticket de suporte (canal privado) |
| `/ticket fechar` | Fecha o ticket atual |
| `/ticket listar` | [MOD] Lista tickets abertos |

### 💬 Feedback e Sugestões
| Comando | Descrição |
|---|---|
| `/feedback enviar conteudo` | Envia feedback para a equipe |
| `/feedback listar [status]` | [MOD] Lista feedbacks |
| `/sugestao enviar conteudo` | Faz uma sugestão |
| `/sugestao listar [status]` | Lista sugestões |
| `/sugestao aprovar id` | [MOD] Aprova sugestão |
| `/enquete pergunta op1 op2 ...` | Cria enquete com reações |

### 🎁 Sorteios
| Comando | Descrição |
|---|---|
| `/sorteio criar premio duracao [vencedores]` | [MOD] Cria sorteio |
| `/sorteio entrar id` | Participa do sorteio |
| `/sorteio finalizar id` | [MOD] Finaliza antecipadamente |

### 🛡️ Moderação
| Comando | Descrição |
|---|---|
| `/mod warn @usuario motivo` | [MOD] Adverte membro |
| `/mod warns @usuario` | Vê histórico de avisos |
| `/mod clearwarns @usuario` | [MOD] Limpa avisos |
| `/mod kick @usuario [motivo]` | [MOD] Expulsa membro |
| `/mod ban @usuario [motivo]` | [ADMIN] Bane membro |
| `/mod unban userid` | [ADMIN] Desbane |
| `/mod mute @usuario duracao` | [MOD] Silencia (timeout) |
| `/mod unmute @usuario` | [MOD] Remove silêncio |
| `/mod purge quantidade` | [MOD] Deleta mensagens |

### 📢 Utilitários
| Comando | Descrição |
|---|---|
| `/anuncio titulo conteudo [canal] [mencao]` | [MOD] Envia anúncio oficial |
| `/serverinfo` | Estatísticas completas do servidor |
| `/ajuda [categoria]` | Lista todos os comandos |
| `/ping` | Latência do bot e banco de dados |

### 🤖 Automático (sem comando)
- **Boas-vindas** com embed roxo ao entrar no servidor
- **Auto-cargo** de membro ao entrar
- **Log** de entradas e saídas
- **XP automático** por mensagens com cooldown
- **Notificação de nível** ao subir
- **Sorteios** encerrados automaticamente no horário

---

## 🛠️ Desenvolvimento Local

```bash
git clone https://github.com/SEU_USUARIO/alianca-skyline-bot.git
cd alianca-skyline-bot
npm install
cp .env.example .env
# Preencha o .env com suas variáveis

# Suba o banco de dados
npm run db:push

# Registre os comandos
npm run deploy

# Inicie o bot
npm run dev
```

---

## 📁 Estrutura do Projeto

```
src/
├── commands/
│   ├── events/       # Eventos da aliança
│   ├── feedback/     # Feedback e sugestões
│   ├── members/      # Gerenciamento de membros
│   ├── moderation/   # Moderação
│   ├── rewards/      # Recompensas e conquistas
│   ├── tickets/      # Sistema de tickets
│   └── utility/      # Comandos utilitários
├── database/
│   └── client.ts     # Cliente Prisma
├── events/           # Handlers de eventos Discord
├── types/            # Tipos TypeScript
└── utils/
    ├── embeds.ts     # Embeds roxos padronizados
    └── helpers.ts    # Funções auxiliares
prisma/
└── schema.prisma     # Schema do banco de dados
```

---

## 💜 Tema Roxo

Todas as embeds usam a paleta de cores da Aliança Skyline:
- **Principal:** `#9B59B6`
- **Secundário:** `#7D3C98`
- **Sucesso:** `#27AE60`
- **Erro:** `#E74C3C`
- **Dourado:** `#F1C40F`

---

Feito com 💜 para a **Aliança Skyline**
