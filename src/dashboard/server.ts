import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import { prisma } from '../database/client';
import { askBryan } from '../ai/bryan';
import { getCharacter, computeStats, type FullCharacter } from '../rpg/services/character';
import { getEnemiesForLocation, getEnemy } from '../rpg/constants/enemies';
import { getLocation } from '../rpg/constants/locations';
import { getClass } from '../rpg/constants/classes';
import { startInteractiveCombat, takeCombatAction, CombatBlockedError, type CombatAction } from '../rpg/services/combat';

const BOT_OWNER_ID = '1195254699943796791';
const TMDB_KEY = '3fd2be6f0c70a2a598f084ddfb75487c'; 

// =====================================================================
// 🕹️ CATÁLOGO DE ATIVIDADES DO BRYAN
// =====================================================================
const ACTIVITIES = [
  {
    id: 'rpg',
    name: 'RPG Skyline',
    icon: '⚔️',
    tagline: 'Batalhe, veja sua ficha e inventário em tempo real.',
    status: 'live',
    href: '/atividades/rpg'
  },
  {
    id: 'chat',
    name: 'Falar com o Bryan',
    icon: '🤖',
    tagline: 'Converse com a IA do bot direto pelo navegador.',
    status: 'live',
    href: '/atividades/chat'
  },
  {
    id: 'social',
    name: 'Feed Social',
    icon: '📸',
    tagline: 'Reviva as postagens do Instagram interno do servidor.',
    status: 'soon',
    href: '#'
  },
  {
    id: 'missions',
    name: 'Missões Diárias',
    icon: '📜',
    tagline: 'Acompanhe suas missões e recompensas do dia.',
    status: 'soon',
    href: '#'
  }
];

function isCombatBlockedMessage(msg: string) {
  return { blocked: true, message: msg };
}

const SERVER_CATEGORIES = [
  { category: "🤖 Inteligência Artificial", desc: "Sistemas de voz e conversação avançada", features: [{ id: 'featVoiceAi', name: 'Callia (IA de Voz)', desc: 'Permite que os membros chamem o Bryan ou a IA Local.', icon: '🎙️' }] },
  { category: "📸 Social & Comunidade", desc: "Engajamento, interações e rede social interna", features: [{ id: 'featSocial', name: 'Feed Social / Insta', desc: 'Postagens de fotos com curtidas e comentários.', icon: '📸' }, { id: 'featLeveling', name: 'Sistema de XP', desc: 'Progressão por mensagens e avisos.', icon: '⭐' }, { id: 'featGiveaways', name: 'Sorteios', desc: 'Sorteios automatizados.', icon: '🎁' }, { id: 'featPolls', name: 'Enquetes', desc: 'Votações com contagem de votos.', icon: '📊' }, { id: 'featReviveChat', name: 'Reviver Chat (IA)', desc: 'Acorda o chat com perguntas geradas por IA após inatividade.', icon: '🧟' }] },
  { category: "⚔️ RPG & Economia", desc: "Sistemas de progressão, missões e mercado", features: [{ id: 'featRpg', name: 'Sistema RPG', desc: 'Ativa todo o ecossistema RPG.', icon: '⚔️' }, { id: 'featEconomy', name: 'Economia & Loja', desc: 'Sistema de moedas e loja de itens.', icon: '🪙' }, { id: 'featMissions', name: 'Missões Diárias', desc: 'Desafios automáticos com recompensas.', icon: '📜' }] },
  { category: "🛡️ Segurança & Moderação", desc: "Proteção em tempo real contra ataques e spam", features: [{ id: 'featMod', name: 'Módulo de Moderação', desc: 'Comandos administrativos, ban, kick e warns.', icon: '🔨' }, { id: 'antiSpam', name: 'Defesa Anti-Spam', desc: 'Bloqueia envio rápido de mensagens.', icon: '⚡' }, { id: 'antiLinks', name: 'Filtro Anti-Links', desc: 'Remove convites e links suspeitos.', icon: '🔗' }] },
  { category: "🎫 Atendimento & Utilidades", desc: "Suporte aos membros e streaming", features: [{ id: 'featTickets', name: 'Tickets de Suporte', desc: 'Salas privadas de atendimento.', icon: '🎫' }, { id: 'featSelfRole', name: 'Registro de Auto-Cargos', desc: 'Menus de seleção para cargos.', icon: '🎭' }, { id: 'featMusic', name: 'Player de Música', desc: 'Streaming de áudio em canais de voz.', icon: '🎵' }, { id: 'featAnnouncements', name: 'Anúncios & Eventos', desc: 'Transmissão de comunicados.', icon: '📢' }] }
];

const GLOBAL_CATEGORIES = [
  { category: "⚙️ Sistemas Centrais Globais", features: [{ id: 'featAfk', name: 'Sistema AFK Global', desc: 'Comando /afk na rede.' }, { id: 'featWelcomeDm', name: 'DM de Boas-vindas', desc: 'Mensagem privada a novos membros.' }] },
  { category: "🌍 Master Switches (Trava Absoluta)", features: [{ id: 'featSocial', name: 'Feed Social (Insta)', desc: 'Desativa o Feed globalmente.' }, { id: 'featVoiceAi', name: 'IA de Voz (Callia)', desc: 'Proíbe a Callia em todos os servers.' }, { id: 'featRpg', name: 'Sistema RPG', desc: 'Desliga o RPG globalmente.' }, { id: 'featEconomy', name: 'Economia & Lojas', desc: 'Congela todas as lojas.' }, { id: 'featTickets', name: 'Sistema de Tickets', desc: 'Bloqueia novos atendimentos.' }, { id: 'featMusic', name: 'Player de Música', desc: 'Desliga o bot de música.' }, { id: 'antiSpam', name: 'Defesa Anti-Spam', desc: 'Desativa o bloqueador em massa.' }, { id: 'featGiveaways', name: 'Sorteios', desc: 'Trava todos os sorteios.' }, { id: 'featLeveling', name: 'Sistema de XP', desc: 'Congela ganho de XP global.' }, { id: 'featReviveChat', name: 'Reviver Chat (IA)', desc: 'Desliga o monitor de inatividade.' }] }
];

const SERVER_SETTINGS = [
  { category: "💬 Boas-Vindas", desc: "Crie um embed rico para receber os novos membros no servidor.", items: [{ id: 'welcomeMessage', name: 'Construtor de Embed', type: 'embed_builder', placeholder: '' }] },
  { category: "🤖 IA Customizada", desc: "Configure a personalidade da IA caso este servidor não possua a Suki.", items: [{ id: 'aiCustomName', name: 'Nome da IA Local', type: 'text', placeholder: 'Ex: Jarvis, Cortana...' }, { id: 'aiCustomVoice', name: 'Voz da IA (M/F)', type: 'text', placeholder: 'Masculina ou Feminina' }, { id: 'aiCustomAvatar', name: 'Avatar da IA (URL)', type: 'text', placeholder: 'Link de uma imagem png/jpg' }, { id: 'aiSystemPrompt', name: 'Prompt de Comportamento Base', type: 'textarea', placeholder: 'Descreva a personalidade da IA para este servidor...' }] },
  { category: "🧟 Reviver Chat", desc: "O bot enviará uma pergunta gerada por IA para reanimar o chat inativo.", items: [{ id: 'reviveChannelId', name: 'Canal Alvo', type: 'channel', placeholder: 'Selecione o canal' }, { id: 'reviveRoleId', name: 'Cargo para Mencionar', type: 'role', placeholder: 'Selecione o cargo' }, { id: 'reviveTimeout', name: 'Tempo de Inatividade', type: 'number', placeholder: 'Tempo em minutos (Ex: 120 para 2 horas)' }, { id: 'revivePrompt', name: 'Prompt da IA', type: 'textarea', placeholder: 'Ex: Faça uma pergunta polêmica e divertida sobre animes ou jogos.' }] },
  { category: "💎 Sistema VIP", desc: "Configuração do ecossistema de apoiadores e benefícios", items: [{ id: 'vipRoleId', name: 'Cargo VIP Base', type: 'role', placeholder: 'Selecione o cargo' }, { id: 'vipTicketCategoryId', name: 'Cat. de Gradiente', type: 'channel', placeholder: 'Selecione a categoria' }] },
  { category: "📸 Feed Social", desc: "Personalize a aparência dos posts e canais de fotos", items: [{ id: 'feedChannelId', name: 'Canal do Feed', type: 'channel', placeholder: 'Selecione o canal' }, { id: 'feedEmbedColor', name: 'Cor do Card (HEX)', type: 'color', placeholder: '#8B5CF6' }, { id: 'feedLikeEmoji', name: 'Emoji de Curtir', type: 'text', placeholder: '❤️' }, { id: 'feedFollowEmoji', name: 'Emoji de Seguir', type: 'text', placeholder: '🔔' }, { id: 'feedCommentEmoji', name: 'Emoji de Comentar', type: 'text', placeholder: '💬' }, { id: 'feedFooterText', name: 'Rodapé das Postagens', type: 'text', placeholder: '📸 Instagram Skyline' }] },
  { category: "🌌 Rede Aliança", desc: "Integração oficial do servidor na rede global", items: [{ id: 'allianceChannelId', name: 'Canal da Aliança', type: 'channel', placeholder: 'Selecione o canal' }] },
  { category: "📁 Canais de Logs", desc: "Direcione onde cada sistema do bot enviará avisos", items: [{ id: 'welcomeChannelId', name: 'Canal de Boas-Vindas', type: 'channel', placeholder: 'Selecione o canal' }, { id: 'announcementChannelId', name: 'Canal de Anúncios', type: 'channel', placeholder: 'Selecione o canal' }, { id: 'logChannelId', name: 'Canal de Logs Gerais', type: 'channel', placeholder: 'Selecione o canal' }, { id: 'levelUpChannelId', name: 'Canal de Level Up', type: 'channel', placeholder: 'Selecione o canal' }, { id: 'suggestionChannelId', name: 'Canal de Sugestões', type: 'channel', placeholder: 'Selecione o canal' }, { id: 'feedbackChannelId', name: 'Canal de Feedback', type: 'channel', placeholder: 'Selecione o canal' }] },
  { category: "🎫 Tickets", desc: "Configuração de atendimento e histórico", items: [{ id: 'ticketCategoryId', name: 'Categoria dos Tickets', type: 'channel', placeholder: 'Selecione a categoria' }, { id: 'ticketLogChannelId', name: 'Canal de Transcrições', type: 'channel', placeholder: 'Selecione o canal' }] },
  { category: "🛡️ Cargos", desc: "Definição de hierarquia e cargos automáticos", items: [{ id: 'adminRoleId', name: 'Cargo de Administrador', type: 'role', placeholder: 'Selecione o cargo' }, { id: 'modRoleId', name: 'Cargo de Moderador', type: 'role', placeholder: 'Selecione o cargo' }, { id: 'autoRoleId', name: 'Cargo Automático', type: 'role', placeholder: 'Selecione o cargo' }, { id: 'memberRoleId', name: 'Membro Registrado', type: 'role', placeholder: 'Selecione o cargo' }, { id: 'mutedRoleId', name: 'Silenciado (Muted)', type: 'role', placeholder: 'Selecione o cargo' }] }
];

const GLOBAL_SETTINGS = [
  { category: "🤖 Perfil do Bryan", desc: "Altere a aparência, bio e status dinâmicos do Bryan diretamente no Discord.", items: [{ id: 'botAvatarUrl', name: 'Foto de Perfil (URL)', type: 'text', placeholder: 'Link da imagem (terminada em .png ou .jpg)' }, { id: 'botBannerUrl', name: 'Banner do Perfil (URL)', type: 'text', placeholder: 'Link do banner' }, { id: 'botPronouns', name: 'Pronomes', type: 'text', placeholder: 'Ex: Ele/Dele' }, { id: 'botBio', name: 'Biografia do Perfil', type: 'textarea', placeholder: 'Escreva a bio que aparecerá no perfil do bot' }, { id: 'botStatusRotation', name: 'Status Rotativo (1 por linha)', type: 'textarea', placeholder: 'Ex:\nJogando Roblox\nAssistindo Netflix\nOuvindo Spotify' }] },
  { category: "🎨 Visual Global", desc: "Personalização de rodapés e cores em todos os servidores", items: [{ id: 'footerText', name: 'Texto de Rodapé Padrão', type: 'text', placeholder: 'Aparece nos embeds gerais' }, { id: 'rpFooterText', name: 'Rodapé Roleplay', type: 'text', placeholder: 'Aparece nos comandos de /rp' }, { id: 'botIconUrl', name: 'URL do Ícone do Bot', type: 'text', placeholder: 'Link direto da imagem do ícone para Embeds' }, { id: 'primaryColor', name: 'Cor Primária dos Embeds', type: 'color', placeholder: '#8B5CF6' }] }
];

async function validateGuildAccess(userId: string, guildId: string): Promise<boolean> {
  if (userId === BOT_OWNER_ID) return true;
  const access = await prisma.allianceServerMember.findFirst({ where: { userId, guildId } });
  return access !== null;
}

// =====================================================================
// 🍿 RENDERIZADOR DO BRYANFLIX (A Netflix)
// =====================================================================
async function renderBryanflix(res: express.Response) {
  let trendingMovies: any[] = [];
  let trendingTv: any[] = [];
  let tmdbError = '';
  
  try {
    const [moviesRes, tvRes] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}&language=pt-BR`),
      axios.get(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_KEY}&language=pt-BR`)
    ]);
    trendingMovies = moviesRes.data.results || [];
    trendingTv = tvRes.data.results || [];
  } catch (err: any) {
    tmdbError = err.message;
    console.error('[Bryanflix] Erro no TMDB Trending SSR:', err.message);
  }

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bryanflix</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  :root { --bg: #05050A; --primary: #8B5CF6; --card: #131521; --text: #F2F3F5; --text-muted: #9CA3AF; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: var(--bg); color: var(--text); overflow-x: hidden; }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: #2A2E45; border-radius: 4px; }

  nav { display: flex; justify-content: space-between; align-items: center; padding: 15px 4%; background: linear-gradient(to bottom, rgba(5,5,10,0.95) 0%, transparent 100%); position: fixed; top: 0; width: 100%; z-index: 100; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.5rem; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; }
  
  .search-box { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; padding: 8px 15px; display: flex; gap: 10px; width: 300px; transition: 0.2s; }
  .search-box:focus-within { border-color: var(--primary); box-shadow: 0 0 10px rgba(139, 92, 246, 0.3); }
  .search-box input { background: transparent; border: none; outline: none; color: white; width: 100%; font-size: 0.9rem; }
  
  .hero { height: 60vh; display: flex; flex-direction: column; justify-content: flex-end; padding: 5% 4%; background: linear-gradient(to top, var(--bg) 0%, transparent 80%), radial-gradient(circle at center, rgba(139, 92, 246, 0.15) 0%, #05050A 100%); transition: background 0.5s ease; background-size: cover; background-position: center; }
  .hero h1 { font-size: 3.5rem; font-weight: 800; margin-bottom: 10px; text-shadow: 2px 2px 10px rgba(0,0,0,0.8); }
  .hero p { font-size: 1.1rem; max-width: 600px; color: #ddd; margin-bottom: 25px; text-shadow: 1px 1px 5px rgba(0,0,0,0.8); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;}
  .hero .btn-play { background: var(--primary); color: white; padding: 12px 30px; border-radius: 6px; font-weight: 800; font-size: 1.1rem; border: none; cursor: pointer; display: inline-flex; gap: 10px; align-items: center; transition: 0.2s; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4); }
  .hero .btn-play:hover { transform: scale(1.05); background: #7C3AED; }

  .section { padding: 20px 4%; }
  .section h2 { font-size: 1.3rem; margin-bottom: 15px; font-weight: 600; display: flex; align-items: center; gap: 10px; border-left: 4px solid var(--primary); padding-left: 10px; }
  
  .movie-row { display: flex; gap: 15px; overflow-x: auto; padding-bottom: 20px; scroll-behavior: smooth; }
  .movie-row::-webkit-scrollbar { height: 6px; }
  .movie-card { min-width: 160px; width: 160px; cursor: pointer; transition: 0.3s; position: relative; border-radius: 8px; overflow: hidden; background: #131521; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
  .movie-card img { width: 100%; height: 240px; object-fit: cover; border-radius: 8px; pointer-events: none; }
  .movie-card:hover { transform: scale(1.05); z-index: 10; box-shadow: 0 10px 20px rgba(139, 92, 246, 0.3); }
  
  .movie-info { position: absolute; bottom: 0; padding: 20px 10px 10px 10px; background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, transparent 100%); width: 100%; transition: 0.3s; pointer-events: none; }
  .movie-card:hover .movie-info { background: linear-gradient(to top, rgba(139, 92, 246, 0.9) 0%, rgba(0,0,0,0.7) 60%, transparent 100%); }
  .movie-info h4 { font-size: 0.9rem; margin-bottom: 5px; color: white; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-shadow: 1px 1px 3px black; }

  #player-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #05050A; z-index: 999999; display: none; flex-direction: column; }
  #player-modal.active { display: flex !important; }
  .player-header { padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; background: #131521; border-bottom: 1px solid var(--border); }
  .btn-close { background: rgba(239, 68, 68, 0.2); color: #EF4444; border: 1px solid #EF4444; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
  .btn-close:hover { background: #EF4444; color: white; }
  iframe { flex: 1; width: 100%; height: 100%; border: none; background: #000; }
</style>
</head>
<body>

<nav>
  <div class="brand">🍿 BRYANFLIX</div>
  <div class="search-box">
    <span>🔍</span>
    <input type="text" id="searchInput" placeholder="Buscar filmes ou séries...">
  </div>
</nav>

<header class="hero" id="hero-header">
  <h1 id="hero-title">Lançamentos da Aliança</h1>
  <p id="hero-desc">Assista aos melhores filmes e séries com os seus amigos direto nas calls de voz do servidor, sem sair do Discord. Sem anúncios, sem interrupções.</p>
  <div><button id="btn-hero-play" class="btn-play clickable-movie" data-type="movie" data-id="" data-title="">▶ Assistir Agora</button></div>
</header>

<div class="section" id="search-section" style="display: none;">
  <h2>🔍 Resultados da Busca</h2>
  <div class="movie-row" id="search-grid" style="flex-wrap: wrap;"></div>
</div>

<div class="section">
  <h2>🔥 Filmes em Alta</h2>
  <div class="movie-row" id="trending-movies">
    <p style="color:#9CA3AF; padding:20px; font-weight:600;">⏳ Carregando os melhores filmes...</p>
  </div>
</div>

<div class="section">
  <h2>📺 Séries Populares</h2>
  <div class="movie-row" id="trending-tv">
    <p style="color:#9CA3AF; padding:20px; font-weight:600;">⏳ Carregando as melhores séries...</p>
  </div>
</div>

<div id="player-modal">
  <div class="player-header">
    <h3 style="color:white; text-shadow: 1px 1px 3px black; font-size:1.1rem;" id="player-title">Carregando Filme...</h3>
    <button id="btn-close-player" class="btn-close">X FECHAR</button>
  </div>
  <iframe id="video-frame" allowfullscreen></iframe>
</div>

<script>
  const initialMovies = ${JSON.stringify(trendingMovies).replace(/</g, '\\u003c')};
  const initialTv = ${JSON.stringify(trendingTv).replace(/</g, '\\u003c')};
  const ssrError = "${tmdbError}";

  function createCard(item, type) {
    if (!item.poster_path) return '';
    const title = item.title || item.name || 'Sem Título';
    return \`
      <div class="movie-card clickable-movie" data-type="\${type}" data-id="\${item.id}" data-title="\${encodeURIComponent(title).replace(/'/g, "%27")}">
        <img src="/api/bryanflix/image?path=\${item.poster_path}" alt="Capa" onerror="this.src='https://via.placeholder.com/160x240?text=Capa'">
        <div class="movie-info">
          <h4>\${title}</h4>
          <span style="color:var(--primary); font-weight:bold; font-size:0.85rem;">⭐ \${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
        </div>
      </div>
    \`;
  }

  async function loadHome() {
    const moviesGrid = document.getElementById('trending-movies');
    const tvGrid = document.getElementById('trending-tv');

    let movies = initialMovies;
    let tv = initialTv;

    // Se o servidor falhou ao baixar antes da página carregar, tenta novamente pelo navegador!
    if (!movies || movies.length === 0) {
      try {
        const res = await fetch('/api/bryanflix/trending');
        const data = await res.json();
        movies = data.movies || [];
        tv = data.tv || [];
      } catch (e) {
        console.error("Fallback de API falhou:", e);
      }
    }

    if(movies && movies.length > 0) {
      moviesGrid.innerHTML = movies.map(m => createCard(m, 'movie')).join('');
      tvGrid.innerHTML = tv.map(s => createCard(s, 'tv')).join('');
      
      const topMovie = movies[0];
      document.getElementById('hero-title').innerText = topMovie.title || topMovie.name || 'Lançamentos';
      document.getElementById('hero-desc').innerText = (topMovie.overview || '').substring(0, 150) + '...';
      
      const heroBtn = document.getElementById('btn-hero-play');
      heroBtn.setAttribute('data-id', topMovie.id);
      heroBtn.setAttribute('data-title', encodeURIComponent(topMovie.title || topMovie.name).replace(/'/g, "%27"));
      heroBtn.setAttribute('data-type', 'movie');
      
      if(topMovie.backdrop_path) {
         document.getElementById('hero-header').style.backgroundImage = \`linear-gradient(to top, var(--bg) 0%, transparent 80%), radial-gradient(circle at center, rgba(139, 92, 246, 0.15) 0%, #05050A 100%), url('/api/bryanflix/image?path=\${topMovie.backdrop_path}')\`;
      }
    } else {
      moviesGrid.innerHTML = \`<p style="color:#EF4444; padding:20px;">Falha ao carregar catálogo. TMDB bloqueado ou offline. \${ssrError}</p>\`;
      tvGrid.innerHTML = '';
    }
  }

  let searchTimeout;
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = document.getElementById('searchInput').value.trim();
    const searchSection = document.getElementById('search-section');
    const searchGrid = document.getElementById('search-grid');

    if (query.length < 3) {
      searchSection.style.display = 'none';
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(\`/api/bryanflix/search?q=\${encodeURIComponent(query)}\`);
        const data = await res.json();
        const validResults = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
        
        if(validResults.length > 0) {
          searchGrid.innerHTML = validResults.map(r => createCard(r, r.media_type)).join('');
        } else {
          searchGrid.innerHTML = '<p style="color:#9CA3AF; padding:20px;">Nenhum resultado encontrado para "' + query + '".</p>';
        }
        searchSection.style.display = 'block';
      } catch (e) {}
    }, 600);
  });

  // =======================================================
  // 💡 NÚCLEO DO PLAYER (Delegação Total - Clicks Inquebráveis)
  // =======================================================
  document.addEventListener('click', function(e) {
    const card = e.target.closest('.clickable-movie');
    if (card) {
      const type = card.getAttribute('data-type');
      const id = card.getAttribute('data-id');
      const title = decodeURIComponent(card.getAttribute('data-title'));
      
      document.getElementById('player-title').innerText = title;
      const iframe = document.getElementById('video-frame');
      
      let rota = type === 'movie' ? \`/embed/movie/\${id}\` : \`/embed/tv/\${id}/1/1\`;
      
      const isDiscordActivity = window.location.search.includes('frame_id') || window.location.search.includes('instance_id');
      
      // Se for atividade do discord envia para o /player para burlar. Se for navegador comum, vai pro link original.
      iframe.src = isDiscordActivity ? \`/player\${rota}\` : \`https://embed.su\${rota}\`;
      
      document.getElementById('player-modal').classList.add('active');
    }
  });

  document.getElementById('btn-close-player').addEventListener('click', () => {
    document.getElementById('video-frame').src = '';
    document.getElementById('player-modal').classList.remove('active');
  });

  loadHome();
</script>
</body>
</html>`);
}

export function startDashboard() {
  const app = express();
  
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

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

  app.get('/api/bryanflix/trending', async (req, res) => {
    try {
      const [moviesRes, tvRes] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}&language=pt-BR`),
        axios.get(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_KEY}&language=pt-BR`)
      ]);
      res.json({ movies: moviesRes.data.results, tv: tvRes.data.results });
    } catch (err: any) {
      res.json({ movies: [], tv: [] });
    }
  });

  app.get('/api/bryanflix/search', async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) return res.json({ results: [] });
      const searchRes = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(query as string)}`);
      res.json({ results: searchRes.data.results });
    } catch (err: any) {
      res.json({ results: [] });
    }
  });

  app.get('/api/bryanflix/image', async (req, res) => {
    try {
      let imgPath = req.query.path as string;
      if (!imgPath) return res.status(404).end();
      if (!imgPath.startsWith('/')) imgPath = '/' + imgPath;
      
      const response = await axios({
        method: 'GET',
        url: `https://image.tmdb.org/t/p/w342${imgPath}`,
        responseType: 'stream' 
      });
      
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=31536000'); 
      response.data.pipe(res); 
    } catch (e: any) {
      res.status(404).end();
    }
  });

  app.get('/', async (req, res) => {
    if (req.hostname.includes('bryanflix') || req.query.frame_id || req.query.instance_id) {
      await renderBryanflix(res);
      return;
    }
    
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bryan Bot — Aliança Skyline</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { 
      --bg: #05050A; 
      --card: #12131F; 
      --card-hover: #1A1D2D; 
      --border: #262A40; 
      --primary: #8B5CF6; 
      --primary2: #C084FC;
      --primary-hover: #7C3AED; 
      --text: #F2F3F5; 
      --text-muted: #9CA3AF; 
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background: radial-gradient(circle at 15% -10%, rgba(139,92,246,0.20), transparent 40%), radial-gradient(circle at 90% 5%, rgba(192,132,252,0.14), transparent 35%), var(--bg); color: var(--text); overflow-x: hidden; line-height: 1.6; }
    
    nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem 5%; background: rgba(5, 5, 10, 0.75); backdrop-filter: blur(14px); position: sticky; top: 0; z-index: 1000; border-bottom: 1px solid var(--border); }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 1.3rem; color: white; text-decoration: none; letter-spacing: -0.5px; }
    .brand img { width: 38px; height: 38px; border-radius: 50%; border: 2px solid var(--primary); }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.95rem; margin-left: 24px; transition: 0.2s; }
    .nav-links a:hover { color: white; }
    .nav-links .btn-login { background: var(--primary); color: white; padding: 9px 22px; border-radius: 8px; margin-left: 24px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35); }
    .nav-links .btn-login:hover { background: var(--primary-hover); }
    
    .hero { text-align: center; padding: 150px 20px 110px 20px; position: relative; overflow: hidden; }
    .hero-bg { position: absolute; top: -25%; left: 50%; transform: translateX(-50%); width: 1100px; height: 1100px; background: radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 60%); z-index: -1; pointer-events: none; animation: pulseGlow 6s ease-in-out infinite; }
    @keyframes pulseGlow { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
    .hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.35); color: var(--primary2); font-weight: 700; font-size: 0.82rem; padding: 7px 16px; border-radius: 999px; margin-bottom: 26px; }
    .hero h1 { font-size: clamp(2.8rem, 6vw, 5.2rem); font-weight: 800; letter-spacing: -2px; margin-bottom: 22px; line-height: 1.08; background: linear-gradient(to right, #fff, var(--primary2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { font-size: 1.15rem; color: var(--text-muted); max-width: 650px; margin: 0 auto 44px auto; }
    
    .btn-group { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }
    .btn { padding: 15px 32px; border-radius: 10px; font-weight: 700; font-size: 1rem; text-decoration: none; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary { background: var(--primary); color: white; box-shadow: 0 8px 25px rgba(139, 92, 246, 0.45); }
    .btn-primary:hover { background: var(--primary-hover); transform: translateY(-3px); box-shadow: 0 10px 30px rgba(139, 92, 246, 0.55); }
    .btn-secondary { background: var(--card); color: white; border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--card-hover); transform: translateY(-3px); border-color: var(--primary); }
    .btn-ghost { background: transparent; color: var(--primary2); border: 1px solid rgba(192,132,252,0.4); }
    .btn-ghost:hover { background: rgba(192,132,252,0.08); transform: translateY(-3px); }
    
    .features { padding: 90px 5%; max-width: 1200px; margin: 0 auto; }
    .features-title { text-align: center; font-size: 2.2rem; font-weight: 800; margin-bottom: 10px; color: white; }
    .features-sub { text-align: center; color: var(--text-muted); margin-bottom: 50px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
    .card { background: linear-gradient(160deg, var(--card), #0d0e17); border: 1px solid var(--border); padding: 35px; border-radius: 18px; transition: 0.3s; position: relative; overflow: hidden; }
    .card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(to right, var(--primary), var(--primary2)); opacity: 0; transition: 0.3s; }
    .card:hover { border-color: var(--primary); transform: translateY(-6px); box-shadow: 0 16px 36px rgba(0,0,0,0.35); }
    .card:hover::before { opacity: 1; }
    .card-icon { width: 55px; height: 55px; background: rgba(139, 92, 246, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 20px; border: 1px solid rgba(139, 92, 246, 0.2); }
    .card h3 { font-size: 1.3rem; font-weight: 700; margin-bottom: 12px; color: white; }
    .card p { color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; }

    .activities-strip { max-width: 1200px; margin: 0 auto; padding: 0 5% 90px; }
    .strip-card { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(120deg, rgba(139,92,246,0.14), rgba(192,132,252,0.06)); border: 1px solid rgba(139,92,246,0.3); border-radius: 20px; padding: 40px; flex-wrap: wrap; gap: 20px; }
    .strip-card h3 { font-size: 1.5rem; font-weight: 800; margin-bottom: 8px; color: white; }
    .strip-card p { color: var(--text-muted); max-width: 480px; }
    
    footer { text-align: center; padding: 40px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.9rem; margin-top: 50px; background: var(--card); }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="brand"><img src="/skylineicon.jpg" alt="Bryan"> Bryan Bot</a>
    <div class="nav-links">
      <a href="/atividades">Atividades</a>
      <a href="${botInviteUrl}">Adicionar ao Servidor</a>
      <a href="/login" class="btn-login">Acessar Painel</a>
    </div>
  </nav>
  
  <header class="hero">
    <div class="hero-bg"></div>
    <span class="hero-badge">✨ Rede Aliança Skyline</span>
    <h1>O Guardião da Aliança.</h1>
    <p>Traga o <b>Bryan</b> para o seu servidor e conecte-se à maior rede interdimensional. Inteligência Artificial por voz, Feed Social, RPG imersivo e moderação absoluta.</p>
    <div class="btn-group">
      <a href="${botInviteUrl}" class="btn btn-primary">Adicionar ao Discord</a>
      <a href="/atividades" class="btn btn-ghost">🕹️ Ver Atividades</a>
      <a href="/login" class="btn btn-secondary">Configurar Bot</a>
    </div>
  </header>
  
  <section class="features">
    <h2 class="features-title">Sistemas Integrados</h2>
    <p class="features-sub">Tudo o que a sua Aliança precisa, em um só bot.</p>
    <div class="grid">
      <div class="card"><div class="card-icon">🎙️</div><h3>Inteligência Artificial</h3><p>Acesse chamadas de voz com o Bryan, com a Suki ou crie a IA exclusiva do seu servidor.</p></div>
      <div class="card"><div class="card-icon">📸</div><h3>Feed Social (Instagram)</h3><p>Crie uma rede social interna perfeita com direito a seguidores, curtidas e comentários.</p></div>
      <div class="card"><div class="card-icon">⚔️</div><h3>RPG & Economia</h3><p>Um ecossistema gigante com Dungeons, World Bosses, inventário e missões diárias.</p></div>
      <div class="card"><div class="card-icon">💎</div><h3>Sistema VIP</h3><p>Recompense os apoiadores com cargos, painéis especiais e gradientes exclusivos.</p></div>
      <div class="card"><div class="card-icon">🎫</div><h3>Sistema de Tickets</h3><p>Organize o atendimento da sua comunidade com logs automáticos e transcrições.</p></div>
      <div class="card"><div class="card-icon">🎵</div><h3>Música FFmpeg</h3><p>Qualidade de áudio de estúdio para escutar Spotify ou YouTube com os amigos na call.</p></div>
    </div>
  </section>

  <section class="activities-strip">
    <div class="strip-card">
      <div>
        <h3>🕹️ Novo: Atividades do Bryan</h3>
        <p>Veja sua ficha de RPG e converse com a IA do bot direto pelo navegador, sem precisar abrir o Discord.</p>
      </div>
      <a href="/atividades" class="btn btn-primary">Explorar Atividades</a>
    </div>
  </section>
  
  <footer><p>© 2026 Bryan Bot • Sistema Oficial da Aliança Skyline</p></footer>
</body>
</html>`);
  });

  app.get('/bryanflix', async (req, res) => {
    await renderBryanflix(res);
  });

  // =====================================================================
  // 🕹️ HUB DE ATIVIDADES DO BRYAN
  // =====================================================================
  app.get('/atividades', (req, res) => {
    const cardsHtml = ACTIVITIES.map(a => {
      const soon = a.status === 'soon';
      return `
        <a href="${soon ? '#' : a.href}" class="act-card ${soon ? 'soon' : ''}" ${soon ? 'onclick="return false;"' : ''}>
          <div class="act-icon">${a.icon}</div>
          <h3>${a.name}</h3>
          <p>${a.tagline}</p>
          <span class="act-badge">${soon ? '🔒 Em breve' : '▶ Abrir'}</span>
        </a>`;
    }).join('');

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Atividades — Bryan Bot</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --bg: #05050A; --primary: #8B5CF6; --primary2: #C084FC; --card: #12131F; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: radial-gradient(circle at 20% -10%, rgba(139,92,246,0.18), transparent 40%), radial-gradient(circle at 90% 10%, rgba(192,132,252,0.12), transparent 35%), var(--bg); color: var(--text); min-height: 100vh; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 5%; }
  .brand { font-weight: 800; font-size: 1.3rem; color: white; text-decoration: none; display:flex; align-items:center; gap:10px; }
  nav a.back { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.9rem; border: 1px solid var(--border); padding: 8px 16px; border-radius: 8px; transition: .2s; }
  nav a.back:hover { border-color: var(--primary); color: white; }
  header.hub-hero { text-align: center; padding: 60px 20px 40px; }
  header.hub-hero h1 { font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 800; letter-spacing: -1px; background: linear-gradient(to right, #fff, var(--primary2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px; }
  header.hub-hero p { color: var(--text-muted); font-size: 1.05rem; max-width: 560px; margin: 0 auto; }
  .act-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; max-width: 1100px; margin: 0 auto; padding: 20px 5% 80px; }
  .act-card { background: var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 32px 26px; text-decoration: none; color: var(--text); position: relative; overflow: hidden; transition: .25s; }
  .act-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(139,92,246,0.12), transparent 60%); opacity: 0; transition: .25s; }
  .act-card:not(.soon):hover { transform: translateY(-6px); border-color: var(--primary); box-shadow: 0 20px 40px rgba(139,92,246,0.25); }
  .act-card:not(.soon):hover::before { opacity: 1; }
  .act-card.soon { opacity: 0.55; cursor: not-allowed; }
  .act-icon { font-size: 2.3rem; margin-bottom: 16px; }
  .act-card h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 8px; }
  .act-card p { color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 18px; }
  .act-badge { font-size: 0.8rem; font-weight: 700; color: var(--primary2); }
</style>
</head>
<body>
  <nav>
    <a href="/" class="brand">🌌 Bryan Bot</a>
    <a href="/painel" class="back">← Voltar ao Painel</a>
  </nav>
  <header class="hub-hero">
    <h1>Atividades do Bryan</h1>
    <p>Tudo o que você faria dentro do Discord, agora também aqui — direto do navegador.</p>
  </header>
  <div class="act-grid">${cardsHtml}</div>
</body>
</html>`);
  });

  // ----- Chat com a IA (Bryan) -----
  app.get('/atividades/chat', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Falar com o Bryan</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --bg: #05050A; --primary: #8B5CF6; --card: #12131F; --bubble-user: #8B5CF6; --bubble-bot: #1A1D2D; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--text); display: flex; flex-direction: column; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 5%; border-bottom: 1px solid var(--border); }
  nav a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
  .brand { font-weight: 800; color: white; display:flex; align-items:center; gap:8px; }
  #chat-wrap { flex: 1; display: flex; flex-direction: column; max-width: 760px; width: 100%; margin: 0 auto; padding: 20px; overflow: hidden; }
  #messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 10px 4px 20px; }
  .msg { max-width: 78%; padding: 12px 16px; border-radius: 14px; line-height: 1.5; font-size: 0.95rem; white-space: pre-wrap; }
  .msg.user { align-self: flex-end; background: var(--bubble-user); color: white; border-bottom-right-radius: 4px; }
  .msg.bot { align-self: flex-start; background: var(--bubble-bot); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
  .msg.typing { color: var(--text-muted); font-style: italic; }
  #input-bar { display: flex; gap: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
  #input-bar input { flex: 1; background: var(--card); border: 1px solid var(--border); color: white; padding: 14px 16px; border-radius: 10px; outline: none; font-size: 0.95rem; }
  #input-bar input:focus { border-color: var(--primary); }
  #input-bar button { background: var(--primary); color: white; border: none; padding: 0 22px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: .2s; }
  #input-bar button:hover { background: #7C3AED; }
  #input-bar button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
</head>
<body>
  <nav>
    <span class="brand">🤖 Falar com o Bryan</span>
    <a href="/atividades">← Atividades</a>
  </nav>
  <div id="chat-wrap">
    <div id="messages">
      <div class="msg bot">E aí! Eu sou o Bryan 👋 Pode perguntar qualquer coisa sobre o servidor, o RPG, ou só bater um papo.</div>
    </div>
    <div id="input-bar">
      <input id="userInput" type="text" placeholder="Digite sua mensagem..." autocomplete="off">
      <button id="sendBtn">Enviar</button>
    </div>
  </div>
  <script>
    const messagesEl = document.getElementById('messages');
    const input = document.getElementById('userInput');
    const btn = document.getElementById('sendBtn');
    let history = [];

    function addMsg(text, cls) {
      const div = document.createElement('div');
      div.className = 'msg ' + cls;
      div.innerText = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      btn.disabled = true;
      addMsg(text, 'user');
      history.push({ role: 'user', content: text });
      const typingEl = addMsg('Bryan está digitando...', 'bot typing');

      try {
        const res = await fetch('/api/activities/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history })
        });
        const data = await res.json();
        typingEl.remove();
        addMsg(data.reply, 'bot');
        history.push({ role: 'assistant', content: data.reply });
      } catch (e) {
        typingEl.remove();
        addMsg('❌ Erro de conexão. Tenta de novo.', 'bot');
      }
      btn.disabled = false;
      input.focus();
    }

    btn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  </script>
</body>
</html>`);
  });

  app.post('/api/activities/chat', async (req, res) => {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Mensagem inválida' });

    const username = (req.cookies?.skyline_username as string) || 'Visitante do Site';
    const memory = Array.isArray(history) ? history.slice(-12) : [];

    // 🔁 Retry simples com backoff: a Mistral (free tier) as vezes devolve 429
    // por limite de requisições/s — o mesmo texto e voz (Callia) usam a mesma chave.
    let reply = await askBryan(message.slice(0, 1000), username, memory);
    if (reply.includes('limitou as requisições')) {
      await new Promise((r) => setTimeout(r, 1500));
      reply = await askBryan(message.slice(0, 1000), username, memory);
    }

    res.json({ reply });
  });

  // ----- RPG: Ficha + Batalha (engine real do jogo) -----
  app.get('/atividades/rpg', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RPG Skyline</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --bg: #05050A; --primary: #8B5CF6; --primary2: #C084FC; --card: #12131F; --card2: #191B2B; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; --green:#10B981; --red:#EF4444; --gold:#F5C242; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: radial-gradient(circle at 10% 0%, rgba(139,92,246,0.15), transparent 40%), var(--bg); color: var(--text); min-height: 100vh; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 5%; border-bottom: 1px solid var(--border); }
  nav a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
  .brand { font-weight: 800; color: white; }
  #wrap { max-width: 980px; margin: 0 auto; padding: 30px 20px 80px; }

  .id-bar { display: flex; gap: 10px; margin-bottom: 26px; }
  .id-bar input { flex: 1; background: var(--card); border: 1px solid var(--border); color: white; padding: 12px 16px; border-radius: 10px; outline: none; }
  .id-bar button { background: var(--primary); color: white; border: none; padding: 0 22px; border-radius: 10px; font-weight: 700; cursor: pointer; }
  .id-bar button:hover { background: #7C3AED; }

  .empty, .error { color: var(--text-muted); padding: 30px 0; text-align: center; }
  .error { color: var(--red); }

  .profile-header { display: flex; align-items: center; gap: 20px; background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-bottom: 20px; }
  .avatar-ring { width: 68px; height: 68px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary2)); display: flex; align-items: center; justify-content: center; font-size: 2rem; flex-shrink: 0; box-shadow: 0 0 24px rgba(139,92,246,0.4); }
  .profile-header h2 { font-size: 1.4rem; font-weight: 800; }
  .profile-header .sub { color: var(--text-muted); font-size: 0.9rem; margin-top: 4px; }
  .bars { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .bar-row { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--text-muted); }
  .bar-track { flex: 1; height: 8px; background: #1A1D2D; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; transition: width 0.35s ease; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; margin-bottom: 20px; }
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  .stat-card .label { color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .stat-card .value { font-size: 1.25rem; font-weight: 800; }

  .section-title { font-size: 1.05rem; font-weight: 700; margin: 30px 0 14px; display:flex; align-items:center; gap:8px; }
  .item-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .item-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 0.85rem; }
  .item-card .qty { color: var(--primary); font-weight: 700; }

  /* ===== Arena de Batalha (Task Bar / JRPG style) ===== */
  .battle-setup { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; margin-bottom: 20px; }
  .battle-setup select { flex: 1; min-width: 200px; background: #0B0C14; border: 1px solid var(--border); color: white; padding: 12px 14px; border-radius: 10px; outline: none; }
  .btn-fight { background: linear-gradient(120deg, var(--primary), var(--primary2)); color: white; border: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .btn-fight:hover { filter: brightness(1.1); }
  .btn-random { background: var(--card2); border: 1px solid var(--border); color: white; padding: 12px 22px; border-radius: 10px; font-weight: 700; cursor: pointer; white-space: nowrap; }

  .arena { display: none; background: radial-gradient(circle at 50% 0%, rgba(139,92,246,0.12), transparent 60%), var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 30px 24px; margin-bottom: 20px; }
  .arena.show { display: block; }
  .arena-stage { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; padding: 20px 10px 40px; position: relative; }
  .arena-stage::after { content: ''; position: absolute; bottom: 18px; left: 5%; right: 5%; height: 2px; background: linear-gradient(to right, transparent, var(--border), transparent); }
  .combatant { display: flex; flex-direction: column; align-items: center; width: 42%; }
  .combatant.enemy { align-items: center; }
  .sprite { font-size: 4.2rem; line-height: 1; margin-bottom: 14px; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5)); animation: floatY 3s ease-in-out infinite; }
  .combatant.enemy .sprite { animation-delay: 0.4s; }
  @keyframes floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .sprite.hit { animation: hitShake 0.35s ease; }
  @keyframes hitShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
  .combatant-name { font-weight: 800; font-size: 1rem; margin-bottom: 8px; }
  .combatant .bars { width: 100%; max-width: 220px; }
  .combatant .bar-row span.tag { width: 26px; flex-shrink:0; font-weight:700; }
  .vs-badge { font-weight: 800; color: var(--text-muted); font-size: 1.4rem; padding-bottom: 50px; }

  .action-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-top: 10px; }
  .action-btn { background: var(--card2); border: 1px solid var(--border); color: white; padding: 14px 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: 0.15s; text-align: center; }
  .action-btn:hover:not(:disabled) { border-color: var(--primary); background: #22243A; transform: translateY(-2px); }
  .action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .action-btn.attack { border-color: rgba(239,68,68,0.4); }
  .action-btn.skill { border-color: rgba(139,92,246,0.5); }
  .action-btn.flee { border-color: rgba(156,163,175,0.4); }

  .combat-log { background: #0B0C14; border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin-top: 18px; max-height: 220px; overflow-y: auto; font-size: 0.85rem; line-height: 1.6; color: #D5D7E0; }
  .combat-log b { color: white; }
  .combat-log::-webkit-scrollbar { width: 6px; }
  .combat-log::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  .result-banner { text-align: center; padding: 20px; border-radius: 14px; margin-top: 18px; font-weight: 800; font-size: 1.2rem; }
  .result-banner.vitoria { background: rgba(16,185,129,0.12); border: 1px solid var(--green); color: var(--green); }
  .result-banner.derrota { background: rgba(239,68,68,0.12); border: 1px solid var(--red); color: var(--red); }
  .result-banner.fuga, .result-banner.empate { background: rgba(156,163,175,0.1); border: 1px solid var(--border); color: var(--text-muted); }
  .result-rewards { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); margin-top: 8px; }
  .btn-again { display: block; margin: 18px auto 0; background: var(--primary); color: white; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
  <nav>
    <span class="brand">⚔️ RPG Skyline</span>
    <a href="/atividades">← Atividades</a>
  </nav>
  <div id="wrap">
    <div class="id-bar">
      <input id="discordId" type="text" placeholder="Cole seu ID do Discord para carregar seu personagem...">
      <button onclick="loadProfile()">Carregar</button>
    </div>
    <div id="result"></div>
  </div>

  <script>
    const state = { discordId: null, stats: null, cls: null, inCombat: false };

    async function loadProfile() {
      const id = document.getElementById('discordId').value.trim();
      const resultEl = document.getElementById('result');
      if (!id) return;
      state.discordId = id;
      resultEl.innerHTML = '<p class="empty">⏳ Carregando ficha...</p>';

      try {
        const res = await fetch('/api/activities/rpg/profile?discordId=' + encodeURIComponent(id));
        if (res.status === 404) { resultEl.innerHTML = '<p class="error">Nenhum personagem encontrado para esse ID.</p>'; return; }
        if (!res.ok) { resultEl.innerHTML = '<p class="error">Erro ao carregar ficha.</p>'; return; }
        const data = await res.json();
        renderProfile(data);
      } catch (e) {
        resultEl.innerHTML = '<p class="error">Erro de conexão.</p>';
      }
    }

    function renderProfile(data) {
      const c = data.character, s = data.stats, cls = data.class, loc = data.location;
      state.stats = s; state.cls = cls;

      const hpPct = Math.max(0, Math.min(100, (c.currentHp / s.maxHp) * 100));
      const enPct = Math.max(0, Math.min(100, (c.currentEnergy / s.maxEnergy) * 100));

      const itemsHtml = (data.inventory || []).length
        ? data.inventory.map(i => \`<div class="item-card">\${i.itemId} <span class="qty">x\${i.quantity}</span></div>\`).join('')
        : '<p class="empty">Inventário vazio.</p>';

      document.getElementById('result').innerHTML = \`
        <div class="profile-header">
          <div class="avatar-ring">\${cls ? cls.emoji : '⚔️'}</div>
          <div style="flex:1;">
            <h2>\${c.username} <span style="color:var(--text-muted); font-weight:600; font-size:0.9rem;">— \${cls ? cls.name : c.class} · Nv. \${c.level}</span></h2>
            <div class="sub">🪙 \${c.gold} de ouro · \${loc ? loc.emoji + ' ' + loc.name : c.currentLocation}</div>
            <div class="bars">
              <div class="bar-row"><span class="tag">HP</span><div class="bar-track"><div class="bar-fill" style="width:\${hpPct}%; background:var(--red);"></div></div> \${c.currentHp}/\${s.maxHp}</div>
              <div class="bar-row"><span class="tag">EN</span><div class="bar-track"><div class="bar-fill" style="width:\${enPct}%; background:var(--green);"></div></div> \${c.currentEnergy}/\${s.maxEnergy}</div>
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="stat-card"><div class="label">Ataque</div><div class="value">\${s.attack}</div></div>
          <div class="stat-card"><div class="label">Defesa</div><div class="value">\${s.defense}</div></div>
          <div class="stat-card"><div class="label">Crítico</div><div class="value">\${s.critChance}%</div></div>
          <div class="stat-card"><div class="label">Esquiva</div><div class="value">\${s.dodgeChance}%</div></div>
          <div class="stat-card"><div class="label">Poder</div><div class="value">\${s.combatPower}</div></div>
        </div>
        <div class="grid">
          <div class="stat-card"><div class="label">Força</div><div class="value">\${s.str}</div></div>
          <div class="stat-card"><div class="label">Agilidade</div><div class="value">\${s.agi}</div></div>
          <div class="stat-card"><div class="label">Inteligência</div><div class="value">\${s.int}</div></div>
          <div class="stat-card"><div class="label">Vitalidade</div><div class="value">\${s.vit}</div></div>
          <div class="stat-card"><div class="label">Sorte</div><div class="value">\${s.lck}</div></div>
        </div>

        <div class="section-title">⚔️ Batalha</div>
        <div class="battle-setup">
          <select id="enemySelect"><option value="">Carregando inimigos da região...</option></select>
          <button class="btn-fight" onclick="startCombat(document.getElementById('enemySelect').value)">▶ Lutar</button>
          <button class="btn-random" onclick="startCombat(null)">🎲 Caçar Aleatório</button>
        </div>
        <div class="arena" id="arena"></div>

        <div class="section-title">🎒 Inventário</div>
        <div class="item-list">\${itemsHtml}</div>
      \`;

      loadEnemies();
    }

    async function loadEnemies() {
      const sel = document.getElementById('enemySelect');
      try {
        const res = await fetch('/api/activities/rpg/enemies?discordId=' + encodeURIComponent(state.discordId));
        const data = await res.json();
        if (!data.enemies || !data.enemies.length) { sel.innerHTML = '<option value="">Nenhum inimigo encontrado aqui</option>'; return; }
        sel.innerHTML = data.enemies.map(e => \`<option value="\${e.id}">\${e.emoji} \${e.name} (HP \${e.baseHp})</option>\`).join('');
      } catch (e) {
        sel.innerHTML = '<option value="">Erro ao carregar inimigos</option>';
      }
    }

    async function startCombat(enemyId) {
      const arena = document.getElementById('arena');
      arena.classList.add('show');
      arena.innerHTML = '<p class="empty">⏳ Preparando batalha...</p>';

      try {
        const res = await fetch('/api/activities/rpg/combat/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordId: state.discordId, enemyId: enemyId || undefined })
        });
        const turn = await res.json();
        if (res.status === 409) { arena.innerHTML = \`<p class="error">⏳ \${turn.message}</p>\`; return; }
        if (!res.ok) { arena.innerHTML = '<p class="error">Erro ao iniciar combate.</p>'; return; }
        state.inCombat = true;
        renderArena(turn);
      } catch (e) {
        arena.innerHTML = '<p class="error">Erro de conexão.</p>';
      }
    }

    async function sendAction(action) {
      if (!state.inCombat) return;
      try {
        const res = await fetch('/api/activities/rpg/combat/action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordId: state.discordId, action })
        });
        const turn = await res.json();
        if (res.status === 409) { document.getElementById('arena').innerHTML += \`<p class="error">⏳ \${turn.message}</p>\`; return; }
        renderArena(turn, action);
      } catch (e) {}
    }

    function renderArena(turn, lastAction) {
      const s = state.stats;
      const maxHp = s ? s.maxHp : turn.playerHp;
      const maxEn = s ? s.maxEnergy : turn.playerEnergy;
      const heroEmoji = state.cls ? state.cls.emoji : '🧙';

      const playerHpPct = Math.max(0, Math.min(100, (turn.playerHp / maxHp) * 100));
      const playerEnPct = Math.max(0, Math.min(100, (turn.playerEnergy / maxEn) * 100));
      const enemyHpPct = Math.max(0, Math.min(100, (turn.enemyHp / turn.enemyMaxHp) * 100));

      const heroHitClass = lastAction && !turn.finished ? '' : '';
      const logHtml = (turn.log || []).map(l => '<div>' + l.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>') + '</div>').join('');

      let resultHtml = '';
      if (turn.finished && turn.result) {
        const r = turn.result;
        const titleMap = { vitoria: '🏆 Vitória!', derrota: '💀 Derrota', fuga: '🏃 Fuga', empate: '💥 Empate' };
        resultHtml = \`
          <div class="result-banner \${r.result}">\${titleMap[r.result] || r.result}
            <div class="result-rewards">
              \${r.xpGained ? '✨ +' + r.xpGained + ' XP &nbsp;·&nbsp; ' : ''}\${r.goldGained ? '🪙 +' + r.goldGained + ' Ouro' : ''}
              \${r.itemsDropped && r.itemsDropped.length ? '<br>🎁 ' + r.itemsDropped.join(', ') : ''}
            </div>
          </div>
          <button class="btn-again" onclick="loadProfile(); document.getElementById('discordId').value = state.discordId;">🔄 Atualizar Ficha</button>
        \`;
        state.inCombat = false;
      }

      document.getElementById('arena').innerHTML = \`
        <div class="arena-stage">
          <div class="combatant hero">
            <div class="sprite \${heroHitClass}">\${heroEmoji}</div>
            <div class="combatant-name">Você</div>
            <div class="bars">
              <div class="bar-row"><span class="tag">HP</span><div class="bar-track"><div class="bar-fill" style="width:\${playerHpPct}%; background:var(--red);"></div></div></div>
              <div class="bar-row"><span class="tag">EN</span><div class="bar-track"><div class="bar-fill" style="width:\${playerEnPct}%; background:var(--green);"></div></div></div>
            </div>
          </div>
          <div class="vs-badge">VS</div>
          <div class="combatant enemy">
            <div class="sprite">\${turn.enemyEmoji || '👹'}</div>
            <div class="combatant-name">\${turn.enemyName}</div>
            <div class="bars">
              <div class="bar-row"><span class="tag">HP</span><div class="bar-track"><div class="bar-fill" style="width:\${enemyHpPct}%; background:var(--gold);"></div></div></div>
            </div>
          </div>
        </div>

        \${!turn.finished ? \`
        <div class="action-bar">
          <button class="action-btn attack" onclick="sendAction('attack')">⚔️ Atacar</button>
          <button class="action-btn skill" onclick="sendAction('skill')" \${turn.skillReady ? '' : 'disabled'}>✨ \${turn.skillName || 'Habilidade'}</button>
          <button class="action-btn" onclick="sendAction('defend')">🛡️ Defender</button>
          <button class="action-btn" onclick="sendAction('potion')" \${turn.potionAvailable ? '' : 'disabled'}>🧪 Poção</button>
          <button class="action-btn flee" onclick="sendAction('flee')">🏃 Fugir</button>
        </div>\` : ''}

        <div class="combat-log" id="combatLog">\${logHtml}</div>
        \${resultHtml}
      \`;

      const logEl = document.getElementById('combatLog');
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }
  </script>
</body>
</html>`);
  });

  app.get('/api/activities/rpg/profile', async (req, res) => {
    const discordId = req.query.discordId as string;
    if (!discordId) return res.status(400).json({ error: 'discordId obrigatório' });

    try {
      const character = await getCharacter(discordId);
      if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

      const stats = computeStats(character);
      const cls = getClass(character.class);
      const loc = getLocation(character.currentLocation);
      const inventory = await prisma.rpgInventoryItem.findMany({ where: { characterId: discordId } });

      res.json({ character, stats, class: cls, location: loc, inventory });
    } catch (e) {
      console.error('[Atividades/RPG] Erro ao buscar personagem:', e);
      res.status(500).json({ error: 'Erro ao buscar personagem' });
    }
  });

  // Lista os inimigos disponíveis na localização atual do personagem (mesma
  // fonte usada na "Caçada Livre" do Discord: getEnemiesForLocation).
  app.get('/api/activities/rpg/enemies', async (req, res) => {
    const discordId = req.query.discordId as string;
    if (!discordId) return res.status(400).json({ error: 'discordId obrigatório' });

    try {
      const character = await getCharacter(discordId);
      if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

      const enemies = getEnemiesForLocation(character.currentLocation, character.level).slice(0, 25).map(e => ({
        id: e.id, name: e.name, emoji: e.emoji, baseHp: e.baseHp, baseAttack: e.baseAttack,
        xpReward: e.xpReward, goldMin: e.goldReward.min, goldMax: e.goldReward.max, type: e.type
      }));

      res.json({ location: getLocation(character.currentLocation), enemies });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao buscar inimigos' });
    }
  });

  // Inicia uma batalha real usando a MESMA engine de combate do Discord.
  // O estado da luta fica na sessão em memória (activeCombats) do combat.ts —
  // ou seja, se o jogador já estiver batalhando pelo Discord, o site respeita
  // e bloqueia (CombatBlockedError), exatamente como aconteceria lá.
  app.post('/api/activities/rpg/combat/start', async (req, res) => {
    const { discordId, guildId, enemyId } = req.body || {};
    if (!discordId) return res.status(400).json({ error: 'discordId obrigatório' });

    try {
      const character = await getCharacter(discordId);
      if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

      let enemy = enemyId ? getEnemy(enemyId) : undefined;
      if (!enemy) {
        const pool = getEnemiesForLocation(character.currentLocation, character.level);
        if (!pool.length) return res.status(404).json({ error: 'Nenhum inimigo encontrado nessa região.' });
        enemy = pool[Math.floor(Math.random() * pool.length)];
      }

      const turn = await startInteractiveCombat(character, enemy, guildId, 'hunt');
      res.json(turn);
    } catch (err) {
      if (err instanceof CombatBlockedError) return res.status(409).json(isCombatBlockedMessage(err.message));
      console.error('[Atividades/RPG] Erro ao iniciar combate:', err);
      res.status(500).json({ error: 'Erro ao iniciar combate' });
    }
  });

  app.post('/api/activities/rpg/combat/action', async (req, res) => {
    const { discordId, action } = req.body || {};
    if (!discordId || !action) return res.status(400).json({ error: 'discordId e action são obrigatórios' });

    try {
      const turn = await takeCombatAction(discordId, action as CombatAction);
      res.json(turn);
    } catch (err) {
      if (err instanceof CombatBlockedError) return res.status(409).json(isCombatBlockedMessage(err.message));
      console.error('[Atividades/RPG] Erro na ação de combate:', err);
      res.status(500).json({ error: 'Erro ao processar ação' });
    }
  });

  app.get('/api/discord-data', async (req, res) => {
    const { guildId } = req.query;
    const token = process.env.DISCORD_TOKEN;
    if (!guildId || !token) return res.json({ channels: [], roles: [] });

    try {
      const [channelsRes, rolesRes] = await Promise.all([
        axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers: { Authorization: `Bot ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers: { Authorization: `Bot ${token}` } }).catch(() => ({ data: [] }))
      ]);

      const channels = channelsRes.data.map((c: any) => ({ id: c.id, name: c.name, type: c.type }));
      const roles = rolesRes.data.map((r: any) => ({ id: r.id, name: r.name }));

      res.json({ channels, roles });
    } catch (error) {
      res.json({ channels: [], roles: [] });
    }
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
      const { id: userId, username, avatar } = userRes.data;
      
      const isBotOwner = userId === BOT_OWNER_ID;
      const userRoles = await prisma.allianceServerMember.findMany({ where: { userId } });

      if (!isBotOwner && userRoles.length === 0) return res.status(403).send('<body style="background: #0B0D17; color: #EF4444; text-align: center; padding-top: 150px; font-family: sans-serif;"><h1>🛑 Acesso Negado</h1><p style="color:#9CA3AF;">Sem permissão ativa na base de dados.</p><br><a href="/" style="color: #8B5CF6; font-weight: bold; text-decoration: none;">Voltar ao Início</a></body>');

      res.cookie('skyline_auth', 'permitido', { maxAge: 86400000 }); 
      res.cookie('skyline_userid', userId, { maxAge: 86400000 }); 
      res.cookie('skyline_username', username, { maxAge: 86400000 }); 
      if (avatar) res.cookie('skyline_avatar', avatar, { maxAge: 86400000 });

      res.redirect('/painel');
    } catch (error) { res.status(500).send('Erro na autenticação.'); }
  });

  app.get('/api/config', async (req, res) => {
    const { guildId } = req.query;
    const userId = req.cookies?.skyline_userid;
    if (!userId || !guildId) return res.status(401).json({ error: 'Não autorizado' });

    const hasAccess = await validateGuildAccess(userId, String(guildId));
    if (!hasAccess) return res.status(403).json({ error: 'Permissão negada.' });

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
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { type, guildId, feature, state } = req.body;

    if (type === 'global' && userId !== BOT_OWNER_ID) return res.status(403).json({ error: 'Apenas o Dono pode alterar.' });
    if (type === 'server') {
      const hasAccess = await validateGuildAccess(userId, guildId);
      if (!hasAccess) return res.status(403).json({ error: 'Acesso negado.' });
    }

    try {
      if (type === 'server') await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: state } });
      else if (type === 'global') await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: state } });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao salvar.' }); }
  });

  app.post('/api/update', async (req, res) => {
    const userId = req.cookies?.skyline_userid;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { type, guildId, feature, value, valueType } = req.body;

    if (type === 'global' && userId !== BOT_OWNER_ID) return res.status(403).json({ error: 'Apenas o Dono pode alterar.' });
    if (type === 'server') {
      const hasAccess = await validateGuildAccess(userId, guildId);
      if (!hasAccess) return res.status(403).json({ error: 'Acesso negado.' });
    }

    let finalValue: string | number | null = value;
    if (valueType === 'color') {
      if (typeof value === 'string' && value.startsWith('#')) {
        finalValue = parseInt(value.replace('#', ''), 16) || 14757996;
      } else {
        finalValue = parseInt(value, 10) || 14757996;
      }
    } else if (valueType === 'number') {
      finalValue = parseInt(value, 10) || 0;
    } else if (value === "" || value === null) {
      finalValue = null;
    }

    try {
      if (type === 'server') await prisma.guildConfig.update({ where: { guildId }, data: { [feature]: finalValue } });
      else if (type === 'global') await prisma.botConfig.update({ where: { id: 'global' }, data: { [feature]: finalValue } });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar.' }); }
  });

  app.get('/painel', async (req, res) => {
    if (req.cookies?.skyline_auth !== 'permitido') return res.redirect('/');
    const userId = req.cookies?.skyline_userid;
    const userName = req.cookies?.skyline_username || 'Administrador';
    const avatarHash = req.cookies?.skyline_avatar;
    
    const avatarUrl = avatarHash 
      ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`
      : '/skylineicon.jpg';

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
  <title>Dashboard - Bryan Bot</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { 
      --bg: #05050A; 
      --sidebar: #0D0E18; 
      --header: #0D0E18; 
      --card: #161826; 
      --card-hover: #1F2233; 
      --border: #262A40; 
      --primary: #8B5CF6; 
      --primary2: #C084FC;
      --primary-hover: #7C3AED; 
      --green: #10B981; 
      --red: #EF4444; 
      --text: #F2F3F5; 
      --text-muted: #9CA3AF; 
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background: radial-gradient(circle at 0% 0%, rgba(139,92,246,0.08), transparent 40%), var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    
    .sidebar { width: 280px; background: var(--sidebar); display: flex; flex-direction: column; border-right: 1px solid var(--border); }
    .brand { padding: 22px 20px; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 12px; color: white; border-bottom: 1px solid var(--border); letter-spacing: -0.5px; }
    .brand img { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--primary); }
    .sidebar-cta { margin: 14px 16px 0; display: block; text-align: center; background: linear-gradient(120deg, var(--primary), var(--primary2)); color: white; text-decoration: none; font-weight: 700; font-size: 0.85rem; padding: 11px; border-radius: 10px; box-shadow: 0 6px 18px rgba(139,92,246,0.35); transition: 0.2s; }
    .sidebar-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(139,92,246,0.5); }
    
    .nav-items { flex: 1; padding: 15px 0; overflow-y: auto; }
    .nav-group { 
      font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: var(--text-muted); 
      margin: 15px 0 5px 20px; letter-spacing: 0.5px; cursor: pointer; display: flex; align-items: center; 
      justify-content: space-between; padding-right: 20px; user-select: none; transition: 0.2s;
    }
    .nav-group:hover { color: var(--text); }
    .nav-group::after { content: '▼'; font-size: 0.6rem; transition: transform 0.2s; }
    .nav-group.collapsed::after { transform: rotate(-90deg); }
    
    .nav-children { overflow: hidden; transition: max-height 0.3s ease; max-height: 1000px; padding: 0 10px; }
    .nav-children.collapsed { max-height: 0; }
    
    .nav-btn { background: transparent; color: var(--text-muted); border: none; padding: 10px 15px; margin-bottom: 2px; width: 100%; text-align: left; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: 0.15s; border-radius: 6px; }
    .nav-btn:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }
    .nav-btn.active { background: rgba(139, 92, 246, 0.15); color: var(--primary); border-left: 3px solid var(--primary); border-radius: 0 6px 6px 0;}
    
    .user-profile { padding: 15px 20px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.2); }
    .user-profile .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--card) center/cover; border: 2px solid var(--border); }
    .user-profile .info h4 { font-size: 0.9rem; margin-bottom: 2px; color: white; font-weight: 700; }
    .user-profile .info span { font-size: 0.75rem; color: var(--primary); font-weight: 600; }
    
    .main { flex: 1; display: flex; flex-direction: column; background: var(--bg); position: relative;}
    .header { padding: 18px 40px; border-bottom: 1px solid var(--border); background: var(--header); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index:5;}
    .header h2 { font-size: 1.3rem; font-weight: 800; color: white; letter-spacing: -0.5px; }
    
    .server-selector { display: flex; align-items: center; gap: 10px; }
    .server-selector select { background: var(--card); border: 1px solid var(--border); color: white; padding: 10px 15px; border-radius: 6px; outline: none; font-size: 0.9rem; min-width: 250px; cursor: pointer; font-weight: 600; transition: 0.2s; appearance: none; }
    .server-selector select:focus, .server-selector select:hover { border-color: var(--primary); background: var(--card-hover); }

    .content { padding: 40px; overflow-y: auto; flex: 1; }
    .section-title { font-size: 1.4rem; font-weight: 800; margin-bottom: 8px; color: white; letter-spacing: -0.5px; }
    .section-desc { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 25px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .card-toggle { background: var(--card); border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; border: 1px solid var(--border); }
    .card-toggle:hover { background: var(--card-hover); border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
    .card-info { display: flex; align-items: center; gap: 15px; }
    .card-icon { width: 45px; height: 45px; background: rgba(139, 92, 246, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid rgba(139, 92, 246, 0.2); }
    .card-text h3 { font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: white; }
    .card-text p { font-size: 0.85rem; color: var(--text-muted); max-width: 220px; line-height: 1.4; }
    
    .switch { position: relative; width: 44px; height: 26px; flex-shrink: 0; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border); transition: .3s; border-radius: 34px; }
    .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: var(--text-muted); transition: .3s; border-radius: 50%; }
    input:checked + .slider { background-color: rgba(16, 185, 129, 0.2); border: 1px solid var(--green); }
    input:checked + .slider:before { transform: translateX(18px); background-color: var(--green); box-shadow: 0 0 10px var(--green); }
    
    .card-input { background: var(--card); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--border); transition: 0.2s; }
    .card-input:hover { background: var(--card-hover); border-color: var(--primary); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
    .card-input label { font-size: 0.95rem; font-weight: 700; color: white; }
    .input-group { display: flex; gap: 12px; align-items: flex-start; }
    .input-group input[type="text"], .input-group input[type="number"], .input-group textarea { flex: 1; background: #0B0D17; border: 1px solid var(--border); color: white; padding: 12px 15px; border-radius: 6px; outline: none; font-size: 0.95rem; transition: 0.2s; width: 100%; }
    .input-group input:focus, .input-group textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2); }
    .input-group textarea { resize: vertical; min-height: 90px; }
    
    /* Autocomplete Styles */
    .autocomplete { position: relative; flex: 1; width: 100%; }
    .autocomplete-items { position: absolute; border: 1px solid var(--border); border-radius: 6px; background-color: var(--card-hover); z-index: 99; top: 100%; left: 0; right: 0; max-height: 250px; overflow-y: auto; display: none; margin-top: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .autocomplete-items.show { display: block; }
    .autocomplete-item { padding: 10px 15px; cursor: pointer; color: var(--text-muted); font-size: 0.9rem; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.02); transition: 0.2s; }
    .autocomplete-item:hover { background-color: var(--primary); color: white; }
    .autocomplete-item span { color: white; font-weight: 600; }
    
    .color-picker-wrapper { width: 44px; height: 44px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); cursor: pointer; flex-shrink:0; }
    .color-picker-wrapper input { width: 200%; height: 200%; transform: translate(-25%, -25%); cursor: pointer; }
    .btn-save { background: var(--primary); color: white; border: none; padding: 0 20px; height: 44px; border-radius: 6px; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: 0.2s; white-space: nowrap; flex-shrink:0; }
    .btn-save:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4); }
    
    .tag-container { display: flex; gap: 8px; margin-top: 5px; flex-wrap: wrap; }
    .tag { background: #0B0D17; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; padding: 6px 10px; border-radius: 4px; cursor: pointer; transition: 0.2s; border: 1px solid var(--border); }
    .tag:hover { background: var(--primary); color: white; border-color: var(--primary); }
    
    /* Discord Live Preview Styles */
    .discord-preview { background: #131521; border-radius: 8px; padding: 20px; margin-top: 10px; border: 1px solid var(--border); }
    .discord-msg-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .discord-msg-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--primary); border: 2px solid var(--border); }
    .discord-msg-name { color: white; font-weight: 600; font-size: 1.05rem; }
    .discord-msg-time { color: var(--text-muted); font-size: 0.8rem; margin-left: 5px; font-weight: 500;}
    .discord-embed { border-left: 4px solid var(--primary); background: #1A1D2D; border-radius: 4px; padding: 16px; margin-top: 8px; max-width: 480px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
    .discord-embed-title { color: #FFFFFF; font-weight: 700; font-size: 1.05rem; }
    .discord-embed-desc { color: #DBDEE1; font-size: 0.9rem; white-space: pre-wrap; line-height: 1.4; }
    .discord-embed-thumb { float: right; max-width: 90px; max-height: 90px; border-radius: 6px; margin-left: 15px; }
    .discord-embed-image { max-width: 100%; border-radius: 6px; margin-top: 10px; border: 1px solid rgba(255,255,255,0.05); }
    .discord-embed-body { display: flex; justify-content: space-between; }
    .discord-mention { color: #C9CDD2; background: rgba(139, 92, 246, 0.3); padding: 0 4px; border-radius: 4px; font-weight: 600; }

    #toast { visibility: hidden; min-width: 250px; background: var(--green); color: white; text-align: center; border-radius: 6px; padding: 14px 24px; position: fixed; right: 40px; bottom: 40px; font-weight: 600; font-size: 1rem; opacity: 0; transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    #toast.error { background: var(--red); }
    #toast.show { visibility: visible; opacity: 1; transform: translateY(-15px); }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="brand"><img src="/skylineicon.jpg" alt="Logo"> Bryan Bot</div>
    <a href="/atividades" class="sidebar-cta" target="_blank">🕹️ Ver Atividades</a>
    <div class="nav-items" id="sidebar-nav">
      <!-- Nav gerada via JS -->
    </div>
    <div class="user-profile">
      <div class="avatar" style="background-image: url('${avatarUrl}');"></div>
      <div class="info">
        <h4>${userName}</h4>
        <span>${userId === BOT_OWNER_ID ? 'Dono do Bot' : 'Admin do Servidor'}</span>
      </div>
    </div>
  </div>
  
  <div class="main">
    <div class="header">
      <h2 id="main-header-title">Visão Geral</h2>
      <div class="server-selector">
        <select id="serverSelect" onchange="loadConfig()">${serverOptionsHTML}</select>
      </div>
    </div>
    <div class="content" id="main-content">
      <!-- Conteúdo gerado via JS -->
    </div>
  </div>
  
  <div id="toast">Ação concluída!</div>
  
  <script>
    const SERVER_CATEGORIES = ${JSON.stringify(SERVER_CATEGORIES)};
    const GLOBAL_CATEGORIES = ${JSON.stringify(GLOBAL_CATEGORIES)};
    const SERVER_SETTINGS = ${JSON.stringify(SERVER_SETTINGS)};
    const GLOBAL_SETTINGS = ${JSON.stringify(GLOBAL_SETTINGS)};
    
    let stateData = null;
    let discordDataCache = { channels: [], roles: [] };

    function intToHex(num, fallback = '#8B5CF6') {
      if (num === null || num === undefined || isNaN(num)) return fallback;
      return '#' + num.toString(16).padStart(6, '0').toUpperCase();
    }

    function insertTag(inputId, tag) {
      const el = document.getElementById(inputId);
      if (!el) return; el.value += tag + ' '; el.focus();
    }

    function toggleNavGroup(headerEl) {
      headerEl.classList.toggle('collapsed');
      headerEl.nextElementSibling.classList.toggle('collapsed');
    }

    async function loadConfig() {
      const guildId = document.getElementById('serverSelect').value;
      if (!guildId) return;
      
      const [resConfig, resDiscord] = await Promise.all([
        fetch('/api/config?guildId=' + guildId),
        fetch('/api/discord-data?guildId=' + guildId)
      ]);
      
      stateData = await resConfig.json();
      discordDataCache = await resDiscord.json();
      
      buildNavigation(stateData.isOwner);
    }

    function buildNavigation(isOwner) {
      const navContainer = document.getElementById('sidebar-nav');
      let navHtml = '';

      navHtml += '<div class="nav-group" onclick="toggleNavGroup(this)">Módulos do Servidor</div><div class="nav-children">';
      SERVER_CATEGORIES.forEach((cat, i) => {
        navHtml += \`<button class="nav-btn" onclick="renderContent('modulos', \${i}, this)">\${cat.category.substring(3)}</button>\`;
      });
      navHtml += '</div>';

      navHtml += '<div class="nav-group" onclick="toggleNavGroup(this)">Configurações</div><div class="nav-children">';
      SERVER_SETTINGS.forEach((cat, i) => {
        navHtml += \`<button class="nav-btn" onclick="renderContent('configs', \${i}, this)">\${cat.category.substring(3)}</button>\`;
      });
      navHtml += '</div>';

      if (isOwner) {
        navHtml += '<div class="nav-group" onclick="toggleNavGroup(this)">Globais (Módulos)</div><div class="nav-children">';
        GLOBAL_CATEGORIES.forEach((cat, i) => {
          navHtml += \`<button class="nav-btn" onclick="renderContent('global_modulos', \${i}, this)">\${cat.category.substring(3)}</button>\`;
        });
        navHtml += '</div>';

        navHtml += '<div class="nav-group" onclick="toggleNavGroup(this)">Globais (Configs)</div><div class="nav-children">';
        GLOBAL_SETTINGS.forEach((cat, i) => {
          navHtml += \`<button class="nav-btn" onclick="renderContent('global_configs', \${i}, this)">\${cat.category.substring(3)}</button>\`;
        });
        navHtml += '</div>';
      }

      navContainer.innerHTML = navHtml;
      
      const firstBtn = navContainer.querySelector('.nav-btn');
      if(firstBtn) firstBtn.click();
    }

    function renderContent(type, index, btn) {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      if(btn) btn.classList.add('active');

      const contentDiv = document.getElementById('main-content');
      const headerTitle = document.getElementById('main-header-title');
      let catData, html = '';

      if (type === 'modulos') {
        catData = SERVER_CATEGORIES[index];
        headerTitle.innerText = catData.category;
        html = generateModulesHtml([catData], stateData.serverConfig, 'server');
      } else if (type === 'configs') {
        catData = SERVER_SETTINGS[index];
        headerTitle.innerText = catData.category;
        html = generateSettingsHtml([catData], stateData.serverConfig, 'server');
      } else if (type === 'global_modulos') {
        catData = GLOBAL_CATEGORIES[index];
        headerTitle.innerText = catData.category;
        html = generateModulesHtml([catData], stateData.globalConfig, 'global');
      } else if (type === 'global_configs') {
        catData = GLOBAL_SETTINGS[index];
        headerTitle.innerText = catData.category;
        html = generateSettingsHtml([catData], stateData.globalConfig, 'global');
      }

      contentDiv.innerHTML = html;
      
      setTimeout(() => {
        document.querySelectorAll('.embed-builder-desc').forEach(el => {
           updatePreview(el.id.replace('_desc', ''));
        });
      }, 100);
    }

    function generateModulesHtml(categories, dbData, type) {
      let html = '';
      categories.forEach(cat => {
        if (cat.desc) html += '<p class="section-desc">' + cat.desc + '</p>';
        html += '<div class="grid">';
        cat.features.forEach(feat => {
          const checked = dbData && dbData[feat.id] ? 'checked' : '';
          const icon = feat.icon || '✨';
          html += '<div class="card-toggle">' +
                    '<div class="card-info">' +
                      '<div class="card-icon">' + icon + '</div>' +
                      '<div class="card-text"><h3>' + feat.name + '</h3><p>' + feat.desc + '</p></div>' +
                    '</div>' +
                    '<label class="switch"><input type="checkbox" ' + checked + ' onchange="toggleFeature(\\'' + type + '\\', \\'' + feat.id + '\\', this.checked)"><span class="slider"></span></label>' +
                  '</div>';
        });
        html += '</div>';
      });
      return html;
    }

    function generateSettingsHtml(categories, dbData, type) {
      let html = '';
      categories.forEach(cat => {
        if (cat.desc) html += '<p class="section-desc">' + cat.desc + '</p>';
        html += '<div class="grid" ' + (cat.items.some(i => i.type === 'embed_builder') ? 'style="display: flex; flex-direction: column;"' : '') + '>';
        cat.items.forEach(item => {
          const inputId = 'input_' + type + '_' + item.id;
          const rawVal = dbData ? dbData[item.id] : null;

          if (item.type === 'embed_builder') {
            let parsed = { title: '', description: '', color: '#8B5CF6', thumbnail: '', image: '' };
            if (rawVal) {
              try { parsed = rawVal.startsWith('{') ? JSON.parse(rawVal) : { title: '', description: rawVal, color: '#8B5CF6', thumbnail: '', image: '' }; } catch(e) {}
            }
            html += '<div class="card-input" style="width: 100%;">' +
                      '<label>🛠️ Construtor de Embed</label>' +
                      '<div style="display: flex; gap: 30px; flex-wrap: wrap; margin-top: 5px;">' +
                        '<div style="flex: 1; min-width: 300px; display: flex; flex-direction: column; gap: 12px;">' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_title" placeholder="Título (Opcional)" value="' + (parsed.title || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="input-group"><textarea id="' + inputId + '_desc" class="embed-builder-desc" placeholder="Descrição (Use {user}, {guild}, {memberCount})" oninput="updatePreview(\\'' + inputId + '\\')" style="min-height: 120px;">' + (parsed.description || '') + '</textarea></div>' +
                          '<div class="input-group">' +
                             '<div class="color-picker-wrapper"><input type="color" id="' + inputId + '_color" value="' + (parsed.color || '#8B5CF6') + '" oninput="document.getElementById(\\'' + inputId + '_color_text\\').value = this.value.toUpperCase(); updatePreview(\\'' + inputId + '\\')"></div>' +
                             '<input type="text" id="' + inputId + '_color_text" value="' + (parsed.color || '#8B5CF6') + '" oninput="document.getElementById(\\'' + inputId + '_color\\').value = this.value; updatePreview(\\'' + inputId + '\\')">' +
                          '</div>' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_thumb" placeholder="URL da Thumbnail (Opcional)" value="' + (parsed.thumbnail || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="input-group"><input type="text" id="' + inputId + '_img" placeholder="URL da Imagem Maior (Opcional)" value="' + (parsed.image || '') + '" oninput="updatePreview(\\'' + inputId + '\\')"></div>' +
                          '<div class="tag-container" style="margin-top:0;">' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{user}\\'); updatePreview(\\'' + inputId + '\\')">+{user}</span>' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{guild}\\'); updatePreview(\\'' + inputId + '\\')">+{guild}</span>' +
                            '<span class="tag" onclick="insertTag(\\'' + inputId + '_desc\\', \\'{memberCount}\\'); updatePreview(\\'' + inputId + '\\')">+{memberCount}</span>' +
                          '</div>' +
                          '<button class="btn-save" style="margin-top: 10px;" onclick="saveEmbedBuilder(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\')">💾 Salvar Embed</button>' +
                        '</div>' +
                        '<div style="flex: 1; min-width: 320px;">' +
                          '<label style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 5px; display: block;">Preview em Tempo Real</label>' +
                          '<div class="discord-preview">' +
                            '<div class="discord-msg-header"><div class="discord-msg-avatar"></div><div><span class="discord-msg-name">Bryan Bot</span><span class="discord-msg-time">Hoje às 12:00</span></div></div>' +
                            '<div class="discord-embed" id="' + inputId + '_preview_card" style="border-left-color: ' + (parsed.color || '#8B5CF6') + ';">' +
                              '<div class="discord-embed-body">' +
                                '<div style="flex: 1;">' +
                                  '<div class="discord-embed-title" id="' + inputId + '_preview_title"></div>' +
                                  '<div class="discord-embed-desc" id="' + inputId + '_preview_desc"></div>' +
                                '</div>' +
                                '<img id="' + inputId + '_preview_thumb" class="discord-embed-thumb" style="display: none;">' +
                              '</div>' +
                              '<img id="' + inputId + '_preview_img" class="discord-embed-image" style="display: none;">' +
                            '</div>' +
                          '</div>' +
                        '</div>' +
                      '</div>' +
                    '</div>';
          } else if (item.type === 'color') {
            const hexColor = intToHex(rawVal, '#8B5CF6');
            html += '<div class="card-input">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<div class="color-picker-wrapper"><input type="color" value="' + hexColor + '" oninput="document.getElementById(\\'' + inputId + '\\').value = this.value.toUpperCase()"></div>' +
                        '<input type="text" id="' + inputId + '" value="' + hexColor + '">' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'color\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          } else if (item.type === 'channel' || item.type === 'role') {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="card-input">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<div class="autocomplete">' +
                          '<input type="text" id="' + inputId + '" placeholder="' + item.placeholder + '" value="' + val + '" onfocus="showOptions(this, \\'' + item.type + '\\')" oninput="filterOptions(this, \\'' + item.type + '\\')" onblur="hideOptionsDelayed(\\'' + inputId + '\\')">' +
                          '<div class="autocomplete-items" id="' + inputId + '-list"></div>' +
                        '</div>' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'text\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          } else if (item.type === 'textarea') {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="card-input" style="grid-column: 1 / -1;">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<textarea id="' + inputId + '" placeholder="' + item.placeholder + '">' + val + '</textarea>' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'text\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          } else {
            const val = rawVal !== null && rawVal !== undefined ? rawVal : '';
            html += '<div class="card-input">' +
                      '<label>' + item.name + '</label>' +
                      '<div class="input-group">' +
                        '<input type="' + item.type + '" id="' + inputId + '" placeholder="' + item.placeholder + '" value="' + val + '">' +
                        '<button class="btn-save" onclick="saveSetting(\\'' + type + '\\', \\'' + item.id + '\\', \\'' + inputId + '\\', \\'' + item.type + '\\')">Salvar</button>' +
                      '</div>' +
                    '</div>';
          }
        });
        html += '</div>';
      });
      return html;
    }

    function showOptions(inputEl, entityType) {
      const listEl = document.getElementById(inputEl.id + '-list');
      renderOptions(inputEl.id, entityType, inputEl.value);
      listEl.classList.add('show');
    }

    function filterOptions(inputEl, entityType) {
      renderOptions(inputEl.id, entityType, inputEl.value);
    }

    function hideOptionsDelayed(inputId) {
      setTimeout(() => {
        const listEl = document.getElementById(inputId + '-list');
        if(listEl) listEl.classList.remove('show');
      }, 200);
    }

    function selectOption(inputId, idValue) {
      const inputEl = document.getElementById(inputId);
      inputEl.value = idValue;
      const listEl = document.getElementById(inputId + '-list');
      listEl.classList.remove('show');
    }

    function renderOptions(inputId, entityType, filterText) {
      const listEl = document.getElementById(inputId + '-list');
      const data = entityType === 'channel' ? discordDataCache.channels : discordDataCache.roles;
      const lowerFilter = filterText.toLowerCase();

      const filtered = data.filter(d => d.name.toLowerCase().includes(lowerFilter) || d.id.includes(lowerFilter)).slice(0, 15);

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="autocomplete-item">Nenhum resultado... (Você pode colar o ID)</div>';
        return;
      }

      listEl.innerHTML = filtered.map(d => {
        let icon = '🛡️';
        if (entityType === 'channel') {
           if (d.type === 0) icon = '💬'; 
           else if (d.type === 4) icon = '📁'; 
           else if (d.type === 2) icon = '🔊'; 
        }
        return \`<div class="autocomplete-item" onclick="selectOption('\${inputId}', '\${d.id}')">\${icon} <span>\${d.name}</span> <small style="opacity:0.5; font-size:0.7rem; margin-left:auto;">\${d.id}</small></div>\`;
      }).join('');
    }

    function updatePreview(inputId) {
      const title = document.getElementById(inputId + '_title').value;
      const desc = document.getElementById(inputId + '_desc').value;
      const color = document.getElementById(inputId + '_color').value;
      const thumb = document.getElementById(inputId + '_thumb').value;
      const img = document.getElementById(inputId + '_img').value;

      document.getElementById(inputId + '_preview_card').style.borderLeftColor = color;
      
      const titleEl = document.getElementById(inputId + '_preview_title');
      titleEl.innerText = title;
      titleEl.style.display = title ? 'block' : 'none';

      let parsedDesc = desc
        .replace(/\{user\}/g, '<span class="discord-mention">@NovoMembro</span>')
        .replace(/\{guild\}/g, '<b>Aliança Skyline</b>')
        .replace(/\{memberCount\}/g, '<b>1.500</b>')
        .replace(/\\n/g, '<br>');
      document.getElementById(inputId + '_preview_desc').innerHTML = parsedDesc;

      const thumbEl = document.getElementById(inputId + '_preview_thumb');
      if (thumb) { thumbEl.src = thumb; thumbEl.style.display = 'block'; } else { thumbEl.style.display = 'none'; }

      const imgEl = document.getElementById(inputId + '_preview_img');
      if (img) { imgEl.src = img; imgEl.style.display = 'block'; } else { imgEl.style.display = 'none'; }
    }

    async function saveEmbedBuilder(type, feature, inputId) {
      const guildId = document.getElementById('serverSelect').value;
      const payload = {
        title: document.getElementById(inputId + '_title').value.trim(),
        description: document.getElementById(inputId + '_desc').value.trim(),
        color: document.getElementById(inputId + '_color').value,
        thumbnail: document.getElementById(inputId + '_thumb').value.trim(),
        image: document.getElementById(inputId + '_img').value.trim()
      };
      
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, guildId, feature, value: JSON.stringify(payload), valueType: 'text' })
      });
      res.ok ? showToast('✅ Salvo com sucesso!') : showToast('❌ Erro ao salvar.', true);
    }

    async function toggleFeature(type, feature, state) {
      const guildId = document.getElementById('serverSelect').value;
      const res = await fetch('/api/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature, state }) });
      res.ok ? showToast('Módulo atualizado!') : showToast('Falha ao salvar.', true);
    }

    async function saveSetting(type, feature, inputId, valueType) {
      const guildId = document.getElementById('serverSelect').value;
      const value = document.getElementById(inputId).value;
      const res = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, guildId, feature, value, valueType }) });
      res.ok ? showToast('Salvo com sucesso!') : showToast('Erro ao atualizar.', true);
    }

    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.className = isError ? 'show error' : 'show';
      setTimeout(() => { toast.className = ''; }, 3000);
    }

    window.onload = loadConfig;
  </script>
</body>
</html>`);
  });

  app.listen(port, '0.0.0.0', () => console.log(`🌐 Servidor rodando na porta ${port}`));
}
