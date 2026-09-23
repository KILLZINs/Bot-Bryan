import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import path from 'path';
import type { Client } from 'discord.js';
import { useMainPlayer, QueryType } from 'discord-player';
import { prisma } from '../database/client';
import { askBryan } from '../ai/bryan';
import { getCharacter, computeStats, distributeStatPoints, type FullCharacter } from '../rpg/services/character';
import { getEnemiesForLocation, getEnemy, getBossesForLocation } from '../rpg/constants/enemies';
import { getLocation, LOCATION_LIST } from '../rpg/constants/locations';
import { getClass, rpgXpForLevel } from '../rpg/constants/classes';
import { startInteractiveCombat, takeCombatAction, CombatBlockedError, isDungeonOnCooldown, type CombatAction, type CombatMode } from '../rpg/services/combat';
import { activeExpeditions, startExpedition, processRandomDungeonEvent, finishExpedition, type DungeonRun } from '../rpg/panels/dungeon';
import { craftItem } from '../rpg/panels/forja';
import { CRAFT_RECIPES, getItem, ITEMS } from '../rpg/constants/items';
import { TAVERNA_MENU, buyTavernaItem, rollTavernaDice } from '../rpg/panels/taverna';
import { castFishingLine, reelFishingLine } from '../rpg/panels/pescaria';
import { FISHING_ENERGY_COST, FISHING_COOLDOWN_MS } from '../rpg/constants/fishing';
import { ensureDailyMissions, ensureWeeklyMissions, claimDailyReward, claimWeeklyReward, DAILY_MISSION_POOL, WEEKLY_MISSION_POOL } from '../commands/utility/missoes';
import { ensureClassMissions, claimClassMission } from '../rpg/services/class-missions';
import { doExplore } from '../rpg/panels/exploracao';
import { EXPLORE_ENERGY_COST, EXPLORE_COOLDOWN_MS } from '../rpg/constants/exploration';
import { DIVINE_SKILLS } from '../rpg/constants/skills';
import { getActiveBoss, attackWorldBoss, WORLD_BOSS_TEMPLATES, bossHpBar } from '../rpg/services/worldBoss';
import { getPendingPvpChallenge, createPvpChallenge, resolvePendingPvpChallenge, declinePvpChallenge, PvpBlockedError } from '../rpg/services/combat';
import { CLASS_MISSIONS } from '../rpg/constants/class-missions';
import { equipItem, useConsumable, sellItem, buyItem } from '../rpg/services/inventory';
import { travelTo } from '../rpg/panels/travel';
import { SHOP_CATEGORIES } from '../rpg/panels/shop';
import { TRAIN_OPTIONS, doTrain } from '../rpg/panels/treinar';
import { MEDITATION_OPTIONS, startMeditation, collectMeditation } from '../rpg/panels/meditar';
import { getActiveBuffs, formatBuffList } from '../rpg/services/temp-buffs';
import { getDayPhase, PHASE_INFO } from '../rpg/services/day-night';
import {
  FutError, createClan, joinClan, addClanMember as addFutClanMember, removeClanMember as removeFutClanMember, listClans, countClans as countFutClans, maxClansPerGuild, getClanByName, getClanById, getClanByJoinCode, deleteClan,
  listTeams as listFutTeams, createTeam as createFutTeam, deleteTeam as deleteFutTeam, setMemberTeam as setFutMemberTeam,
  createPartida, getOpenPartida, getPartidaById, deletePartida, listPartidaHistory, joinPartida, addOfflinePlayer,
  setTeam, autoBalanceTeams, startPartida, recordEvent, finishPartida, getProfile as getFutProfile, getRanking as getFutRanking,
  getUserProfile as getFutUserProfile, setUserPosition as setFutUserPosition, listGoalVideos,
  createChamada as createFutChamada, listChamadas as listFutChamadas, deleteChamada as deleteFutChamada, respondChamada as respondFutChamada,
  undoLastEvent as undoFutLastEvent, reopenPartida as reopenFutPartida,
  listPartidaGoals as listFutPartidaGoals, saveGoalAnimation as saveFutGoalAnimation, getGoalAnimation as getFutGoalAnimation, listMatchEvents as listFutMatchEvents,
  getClanOverview as getFutClanOverview, listFullClanStats as listFullFutClanStats,
  type FutEventType, type FutMode, type FutTeam, type FutResultado, type FutRsvpStatus, type FutVisibility,
} from '../fut/services/pelada';

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
    tagline: 'Batalhe, veja sua ficha e inventário — login com Discord.',
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
    id: 'music',
    name: 'Música',
    icon: '🎵',
    tagline: 'Busque músicas, favorite e monte playlists — login com Discord.',
    status: 'live',
    href: '/atividades/musica'
  },
  {
    id: 'fut',
    name: 'Rachão',
    icon: '⚽',
    tagline: 'Crie seu clã, jogue partidas de futsal/campo e acompanhe seu ranking — login com Discord.',
    status: 'live',
    href: '/atividades/fut'
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

// Missões diárias/semanais são por (jogador, servidor) — mas o site não tem
// necessariamente um "servidor atual" como um comando do Discord tem. A
// pessoa escolhe o servidor no seletor do site (guarda em um cookie
// "selected_guild"); sem escolha nenhuma, cai no primeiro servidor da
// Aliança cadastrado (comportamento antigo, pra não quebrar quem já usava).
async function resolveGuildId(explicit?: string, cookieGuildId?: string): Promise<string | null> {
  if (explicit) return explicit;
  if (cookieGuildId) return cookieGuildId;
  const first = await prisma.allianceServer.findFirst();
  return first?.guildId ?? null;
}

// =====================================================================
// 🚀 DISCORD ACTIVITIES — autenticação embutida (sem sair da call)
// =====================================================================
// Gera o script que roda em TODAS as páginas de /atividades. Se a página
// estiver rodando dentro do "foguetinho" do Discord (Activity), ele detecta
// isso (frame_id/instance_id na URL), carrega o SDK oficial via CDN e troca
// o "code" da Activity pelos MESMOS cookies (player_auth/player_userid) que
// o /login/player normal já usa — assim toda a lógica existente (perfil,
// inventário, loja, combate) funciona sem nenhuma mudança dentro da call.
// window.activityReady é uma Promise: resolve `true` se autenticou dentro
// da Activity, `false` se é navegador normal (aí o fluxo de login/cookie de
// sempre continua valendo, sem mudanças).
function activitySdkBootstrap(clientId: string): string {
  return `
<script type="module">
  window.activityReady = (async () => {
    const params = new URLSearchParams(window.location.search);
    const isActivity = params.has('frame_id') || params.has('instance_id');
    window.isDiscordActivity = isActivity;
    if (!isActivity) return false;

    try {
      const { DiscordSDK } = await import('https://cdn.jsdelivr.net/npm/@discord/embedded-app-sdk@2.5.0/+esm');
      const discordSdk = new DiscordSDK('${clientId}');
      await discordSdk.ready();

      window.discordChannelId = discordSdk.channelId || null;
      window.discordGuildId = discordSdk.guildId || null;

      const { code } = await discordSdk.commands.authorize({
        client_id: '${clientId}',
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify'],
      });

      const res = await fetch('/api/activity/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      return res.ok;
    } catch (err) {
      console.error('[Discord Activity] Falha ao autenticar dentro da call:', err);
      return false;
    }
  })();
</script>
<script>
  // Propaga frame_id/instance_id (os parâmetros que identificam que estamos
  // dentro do foguetinho) em toda navegação entre páginas de /atividades.
  // Sem isso, ao clicar num card do hub (ou em "← Atividades"), a PRÓXIMA
  // página perde esses parâmetros, acha que é um navegador comum, e mostra
  // o botão de "Entrar com Discord" — que não funciona dentro da Activity
  // (ela roda numa sandbox que não navega pra fora pro discord.com).
  (function () {
    var search = window.location.search;
    if (!search) return;
    function patch() {
      document.querySelectorAll('a[href^="/atividades"]').forEach(function (a) {
        var href = a.getAttribute('href');
        if (href && href.indexOf('?') === -1) a.setAttribute('href', href + search);
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch);
    else patch();
  })();
</script>`;
}

function renderAtividadesHub(res: express.Response, clientId: string) {
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
${activitySdkBootstrap(clientId)}
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
    <p>Tudo o que você faria dentro do Discord, agora também aqui — direto do navegador ou sem sair da call.</p>
  </header>
  <div class="act-grid">${cardsHtml}</div>
</body>
</html>`);
}

function enrichItem(itemId: string) {
  const item: any = getItem(itemId);
  return item
    ? { id: itemId, name: item.name, emoji: item.emoji, rarity: item.rarity, slot: item.slot, type: item.type, maxStack: item.maxStack, sellPrice: item.sellPrice }
    : { id: itemId, name: itemId, emoji: '📦', rarity: null, slot: null, type: null, maxStack: 99, sellPrice: 0 };
}

// Espelha EXATAMENTE a lógica que já existe dentro de buildCombatResultEmbed
// (dungeon.ts) pra decidir o que acontece com uma expedição quando um
// combate termina — opera sobre o MESMO Map `activeExpeditions` compartilhado
// com o Discord, então fica sempre em sincronia, não importa por onde a
// pessoa esteja jogando.
function applyExpeditionOutcome(discordId: string, turn: any) {
  if (!turn.finished) return null;
  const run = activeExpeditions.get(discordId);
  if (!run) return null;

  if (turn.result?.result === 'vitoria') {
    run.currentFloor++;
    if (run.currentFloor > run.maxFloors) {
      return { run, next: 'finish' };
    }
    return { run, next: 'continue' };
  }

  activeExpeditions.delete(discordId);
  return { run: null, next: 'lost' };
}

// Middleware: exige login de JOGADOR (qualquer conta do Discord — não precisa
// ser staff da Aliança). Isso é INTENCIONALMENTE separado do login /login do
// painel administrativo (que exige cadastro em AllianceServerMember) — aqui
// qualquer pessoa pode entrar, só precisa provar que é dona daquele Discord ID.
function requirePlayerAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.cookies?.player_auth === 'permitido' && req.cookies?.player_userid) return next();
  return res.status(401).json({ error: 'Faça login com o Discord para continuar.', loginUrl: '/login/player' });
}

const PLAYER_REDIRECT_WHITELIST = new Set(['/atividades/rpg', '/atividades', '/atividades/chat', '/atividades/musica', '/atividades/fut']);
function safePlayerRedirect(next: unknown): string {
  return typeof next === 'string' && PLAYER_REDIRECT_WHITELIST.has(next) ? next : '/atividades/rpg';
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
  { category: "🤖 Perfil do Bryan", desc: "Altere a aparência, bio e status dinâmicos do Bryan diretamente no Discord.", items: [{ id: 'botAvatarUrl', name: 'Foto de Perfil (URL)', type: 'text', placeholder: 'Link da imagem (terminada em .png ou .jpg)' }, { id: 'botBannerUrl', name: 'Banner do Perfil (URL)', type: 'text', placeholder: 'Link do banner' }, { id: 'botPronouns', name: 'Pronomes', type: 'text', placeholder: 'Ex: Ele/Dele' }, { id: 'botBio', name: 'Biografia do Perfil', type: 'textarea', placeholder: 'Escreva a bio que aparecerá no perfil do bot' }, { id: 'botStatusRotation', name: 'Status Rotativo (1 por linha)', type: 'textarea', placeholder: 'Ex:\nJogando Roblox\nAssistindo Netflix\nOuvindo Spotify' }, { id: 'botStatusInterval', name: 'Intervalo de Troca (segundos)', type: 'number', placeholder: 'Ex: 30 (mínimo 10)' }] },
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

export function startDashboard(discordClient: Client) {
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
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://bryanfut.up.railway.app';
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
    if (req.hostname.includes('bryanflix')) {
      await renderBryanflix(res);
      return;
    }

    // 🚀 Aberto pelo foguetinho de Activities do Discord (dentro de uma call)
    if (req.query.frame_id || req.query.instance_id) {
      renderAtividadesHub(res, clientId!);
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
    renderAtividadesHub(res, clientId!);
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

  // =====================================================================
  // 🎵 MÚSICA (estilo Spotify) — usa a MESMA engine (discord-player) que os
  // comandos /play do Discord. Buscar, favoritar e montar playlists é
  // 100% no site (Postgres via Prisma); tocar de fato num canal de voz só
  // funciona de dentro da Activity (foguetinho), porque precisa saber em
  // qual canal de voz a pessoa está — window.discordChannelId, exposto pelo
  // activitySdkBootstrap logo depois do discordSdk.ready().
  // =====================================================================
  function trackToJson(t: any) {
    return {
      title: t.title,
      author: t.author || null,
      url: t.url,
      thumbnail: t.thumbnail || null,
      duration: t.duration || null,
    };
  }

  app.get('/api/activities/music/search', requirePlayerAuth, async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ tracks: [] });
    try {
      const player = useMainPlayer();
      const isLink = /^https?:\/\//i.test(q);
      const result = await player.search(q, {
        searchEngine: isLink ? QueryType.AUTO : QueryType.SOUNDCLOUD_SEARCH,
      });
      if (!result.hasTracks()) return res.json({ tracks: [] });
      res.json({ tracks: result.tracks.slice(0, 20).map(trackToJson) });
    } catch (err) {
      console.error('[Música/Site] Erro na busca:', err);
      res.status(500).json({ error: 'Não consegui buscar essa música agora.' });
    }
  });

  app.get('/api/activities/music/favorites', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const favorites = await prisma.musicFavorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    res.json({ favorites });
  });

  app.post('/api/activities/music/favorites/toggle', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const { title, author, url, thumbnail, duration } = req.body || {};
    if (!title || !url) return res.status(400).json({ error: 'Faixa inválida.' });

    const existing = await prisma.musicFavorite.findUnique({ where: { userId_url: { userId, url } } });
    if (existing) {
      await prisma.musicFavorite.delete({ where: { id: existing.id } });
      return res.json({ favorited: false });
    }
    await prisma.musicFavorite.create({ data: { userId, title, author: author || null, url, thumbnail: thumbnail || null, duration: duration || null } });
    res.json({ favorited: true });
  });

  app.get('/api/activities/music/playlists', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const playlists = await prisma.musicPlaylist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { tracks: { orderBy: { addedAt: 'asc' } } },
    });
    res.json({ playlists });
  });

  app.post('/api/activities/music/playlists', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Dê um nome pra playlist.' });
    const playlist = await prisma.musicPlaylist.create({ data: { userId, name }, include: { tracks: true } });
    res.json({ playlist });
  });

  app.delete('/api/activities/music/playlists/:id', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const playlist = await prisma.musicPlaylist.findUnique({ where: { id: req.params.id } });
    if (!playlist || playlist.userId !== userId) return res.status(404).json({ error: 'Playlist não encontrada.' });
    await prisma.musicPlaylist.delete({ where: { id: playlist.id } });
    res.json({ ok: true });
  });

  app.post('/api/activities/music/playlists/:id/tracks', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const playlist = await prisma.musicPlaylist.findUnique({ where: { id: req.params.id } });
    if (!playlist || playlist.userId !== userId) return res.status(404).json({ error: 'Playlist não encontrada.' });

    const { title, author, url, thumbnail, duration } = req.body || {};
    if (!title || !url) return res.status(400).json({ error: 'Faixa inválida.' });

    const track = await prisma.musicPlaylistTrack.create({
      data: { playlistId: playlist.id, title, author: author || null, url, thumbnail: thumbnail || null, duration: duration || null },
    });
    res.json({ track });
  });

  app.delete('/api/activities/music/playlists/:id/tracks/:trackId', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const playlist = await prisma.musicPlaylist.findUnique({ where: { id: req.params.id } });
    if (!playlist || playlist.userId !== userId) return res.status(404).json({ error: 'Playlist não encontrada.' });
    await prisma.musicPlaylistTrack.delete({ where: { id: req.params.trackId } }).catch(() => null);
    res.json({ ok: true });
  });

  // Toca de fato num canal de voz — só funciona dentro da Activity, porque
  // precisa do channelId da call atual (não dá pra "escolher" um canal pelo
  // navegador comum sem sair da call). Reaproveita a MESMA lógica/opções do
  // comando /play (src/commands/music/play.ts) pra não divergir do bot.
  app.post('/api/activities/music/play', requirePlayerAuth, async (req, res) => {
    const { url, title, channelId, guildId } = req.body || {};
    if (!url || !channelId || !guildId) {
      return res.status(400).json({ error: 'Isso só funciona de dentro da Activity, dentro de uma call de voz.' });
    }

    try {
      const guild = await discordClient.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel || !channel.isVoiceBased()) {
        return res.status(400).json({ error: 'Esse canal não é um canal de voz válido.' });
      }

      const player = useMainPlayer();
      const searchResult = await player.search(url, { searchEngine: QueryType.AUTO });
      if (!searchResult.hasTracks()) return res.status(404).json({ error: 'Não encontrei mais essa faixa.' });

      const { track } = await player.play(channel, searchResult, {
        nodeOptions: {
          metadata: { title },
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000,
          leaveOnEnd: false,
          leaveOnStop: true,
          leaveOnStopCooldown: 5000,
          connectionTimeout: 120000,
          bufferingTimeout: 30000,
          volume: 100,
        },
      });

      res.json({ ok: true, title: track.title });
    } catch (err) {
      console.error('[Música/Site] Erro ao tocar:', err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Não consegui tocar essa faixa. Detalhes: ${message.slice(0, 300)}` });
    }
  });

  app.get('/atividades/musica', (req, res) => {
    if (req.cookies?.player_auth !== 'permitido' || !req.cookies?.player_userid) {
      return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Música — Bryan Bot</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
${activitySdkBootstrap(clientId!)}
<style>
  :root { --bg: #05050A; --primary: #1DB954; --card: #12131F; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; }
  .box { text-align: center; padding: 40px; max-width: 420px; }
  .box h1 { font-size: 1.6rem; margin-bottom: 12px; }
  .box p { color: var(--text-muted); margin-bottom: 26px; line-height: 1.5; }
  .box a.btn { display: inline-block; background: var(--primary); color: #05050A; text-decoration: none; font-weight: 800; padding: 14px 28px; border-radius: 999px; }
  .box a.back { display: block; margin-top: 18px; color: var(--text-muted); text-decoration: none; font-size: 0.9rem; }
</style>
</head>
<body>
  <div class="box" id="gateBox">
    <h1 id="gateTitle">🎵 Música do Bryan</h1>
    <p id="gateDesc">Pra buscar músicas, favoritar e montar suas playlists, entra com sua conta do Discord.</p>
    <a class="btn" id="gateBtn" href="/login/player?next=/atividades/musica">Entrar com Discord</a>
    <a class="back" href="/atividades">← Voltar às Atividades</a>
  </div>
  <script>
    // Dentro do foguetinho (Discord Activity) NÃO existe redirecionamento de
    // página pro discord.com — não faz sentido mostrar o botão de login ali,
    // porque clicar nele não funciona (a Activity roda numa sandbox que não
    // navega pra fora). A autenticação acontece sozinha via SDK no bootstrap
    // acima; aqui só escondemos o botão e mostramos o status.
    window.activityReady.then((ok) => {
      if (window.isDiscordActivity) {
        document.getElementById('gateBtn').style.display = 'none';
        if (ok) {
          document.getElementById('gateTitle').innerText = '✅ Entrando...';
          document.getElementById('gateDesc').innerText = 'Autenticado com sucesso, carregando...';
          window.location.reload();
        } else {
          document.getElementById('gateTitle').innerText = '⚠️ Não deu pra autenticar automaticamente';
          document.getElementById('gateDesc').innerText = 'Tenta fechar e abrir a Activity de novo.';
        }
      }
    });
  </script>
</body>
</html>`);
    }

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Música — Bryan Bot</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
${activitySdkBootstrap(clientId!)}
<style>
  :root { --bg: #05050A; --bg2: #0A0A12; --primary: #1DB954; --card: #12131F; --card2: #181A28; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  html, body { height: 100%; }
  body { background: var(--bg); color: var(--text); display: flex; overflow: hidden; }
  a { color: inherit; }
  .sidebar { width: 240px; flex-shrink: 0; background: var(--bg2); border-right: 1px solid var(--border); padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; height: 100vh; overflow-y: auto; }
  .brand { font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; padding: 6px 10px 18px; }
  .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer; color: var(--text-muted); font-weight: 600; font-size: 0.92rem; background: none; border: none; width: 100%; text-align: left; }
  .nav-item:hover { color: white; }
  .nav-item.active { color: white; background: var(--card2); }
  .nav-sep { height: 1px; background: var(--border); margin: 12px 0; }
  .pl-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
  .pl-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; cursor: pointer; color: var(--text-muted); font-size: 0.88rem; font-weight: 600; }
  .pl-item:hover { color: white; background: var(--card2); }
  .pl-item.active { color: white; background: var(--card2); }
  .pl-item .del { opacity: 0; font-size: 0.85rem; }
  .pl-item:hover .del { opacity: 0.6; }
  .pl-item .del:hover { opacity: 1 !important; color: #E74C3C; }
  #newPlaylistBtn { margin-top: 10px; background: none; border: 1px dashed var(--border); color: var(--text-muted); padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.85rem; }
  #newPlaylistBtn:hover { border-color: var(--primary); color: var(--primary); }
  .back-link { display: block; margin-top: 14px; color: var(--text-muted); text-decoration: none; font-size: 0.82rem; text-align: center; }
  .main { flex: 1; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .topbar { padding: 18px 28px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 16px; }
  .search-box { flex: 1; max-width: 480px; position: relative; }
  .search-box input { width: 100%; background: var(--card2); border: 1px solid var(--border); color: white; padding: 12px 16px 12px 40px; border-radius: 999px; outline: none; font-size: 0.92rem; }
  .search-box input:focus { border-color: var(--primary); }
  .search-box::before { content: '🔎'; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 0.9rem; opacity: 0.6; }
  .content { flex: 1; overflow-y: auto; padding: 20px 28px 60px; }
  .content h2 { font-size: 1.3rem; margin-bottom: 16px; }
  .empty-hint { color: var(--text-muted); font-size: 0.92rem; padding: 40px 0; text-align: center; }
  .track-row { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-radius: 10px; }
  .track-row:hover { background: var(--card2); }
  .track-row img { width: 46px; height: 46px; border-radius: 6px; object-fit: cover; background: var(--card); flex-shrink: 0; }
  .track-info { flex: 1; min-width: 0; }
  .track-info .t-title { font-weight: 700; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .track-info .t-author { color: var(--text-muted); font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t-duration { color: var(--text-muted); font-size: 0.8rem; width: 46px; text-align: right; flex-shrink: 0; }
  .t-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .t-actions button { background: none; border: none; color: var(--text-muted); font-size: 1.05rem; cursor: pointer; padding: 6px; border-radius: 6px; line-height: 1; }
  .t-actions button:hover { color: white; background: rgba(255,255,255,0.08); }
  .t-actions button.fav.active { color: var(--primary); }
  .t-actions button.play { color: var(--primary); }
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--card2); border: 1px solid var(--border); padding: 12px 22px; border-radius: 10px; font-size: 0.88rem; opacity: 0; pointer-events: none; transition: .25s; z-index: 999; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .web-player-bar { position: fixed; left: 0; right: 0; bottom: 0; background: var(--bg2); border-top: 1px solid var(--border); padding: 10px 16px; display: none; align-items: center; gap: 12px; z-index: 998; }
  .web-player-bar.show { display: flex; }
  .web-player-bar .wp-title { font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .web-player-bar iframe { flex: 1; height: 80px; border: none; border-radius: 8px; }
  .web-player-bar .wp-close { background: none; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer; padding: 6px; }
  .web-player-bar .wp-close:hover { color: white; }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(-6px); }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center; z-index: 1000; }
  .modal-overlay.show { display: flex; }
  .modal { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 26px; width: 100%; max-width: 360px; }
  .modal h3 { margin-bottom: 16px; font-size: 1.05rem; }
  .modal input[type="text"] { width: 100%; background: var(--card2); border: 1px solid var(--border); color: white; padding: 12px 14px; border-radius: 8px; outline: none; margin-bottom: 16px; font-size: 0.92rem; }
  .modal input[type="text"]:focus { border-color: var(--primary); }
  .modal .pl-pick { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
  .modal .pl-pick button { text-align: left; background: var(--card2); border: 1px solid var(--border); color: white; padding: 10px 12px; border-radius: 8px; cursor: pointer; font-size: 0.88rem; }
  .modal .pl-pick button:hover { border-color: var(--primary); }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .modal-actions button { padding: 10px 18px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; font-size: 0.88rem; }
  .modal-actions .cancel { background: none; color: var(--text-muted); }
  .modal-actions .confirm { background: var(--primary); color: #05050A; }
  .loading { color: var(--text-muted); font-size: 0.9rem; padding: 20px 0; text-align: center; }
</style>
</head>
<body>
  <aside class="sidebar">
    <div class="brand">🎵 Música</div>
    <button class="nav-item active" id="navSearch" onclick="showView('search')">🔎 Buscar</button>
    <button class="nav-item" id="navFavorites" onclick="showView('favorites')">💚 Favoritas</button>
    <div class="nav-sep"></div>
    <div style="padding: 0 12px; color: var(--text-muted); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Suas Playlists</div>
    <div class="pl-list" id="plList"></div>
    <button id="newPlaylistBtn" onclick="openNewPlaylistModal()">+ Nova Playlist</button>
    <a class="back-link" href="/atividades">← Voltar às Atividades</a>
  </aside>

  <div class="main">
    <div class="topbar">
      <div class="search-box">
        <input id="searchInput" type="text" placeholder="O que você quer ouvir?" autocomplete="off">
      </div>
    </div>
    <div class="content" id="content">
      <div class="empty-hint">Digite algo na busca pra começar 🎧</div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <div class="web-player-bar" id="webPlayerBar">
    <span class="wp-title" id="webPlayerTitle"></span>
    <iframe id="webPlayerFrame" scrolling="no" frameborder="no" allow="autoplay"></iframe>
    <button class="wp-close" onclick="closeWebPlayer()" title="Fechar player">✕</button>
  </div>

  <div class="modal-overlay" id="playlistModal">
    <div class="modal">
      <h3>Nova playlist</h3>
      <input type="text" id="newPlaylistName" placeholder="Nome da playlist" maxlength="60">
      <div class="modal-actions">
        <button class="cancel" onclick="closeNewPlaylistModal()">Cancelar</button>
        <button class="confirm" onclick="confirmNewPlaylist()">Criar</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="addToPlaylistModal">
    <div class="modal">
      <h3>Adicionar à playlist</h3>
      <div class="pl-pick" id="plPick"></div>
      <div class="modal-actions">
        <button class="cancel" onclick="closeAddToPlaylistModal()">Fechar</button>
      </div>
    </div>
  </div>

  <script>
    let playlists = [];
    let favorites = [];
    let currentView = 'search';
    let currentPlaylistId = null;
    let pendingTrackForPlaylist = null;

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2600);
    }

    function isFavorited(url) {
      return favorites.some(f => f.url === url);
    }

    function trackRowHtml(t, opts) {
      opts = opts || {};
      const fav = isFavorited(t.url);
      const dataAttr = encodeURIComponent(JSON.stringify(t));
      const removeBtn = opts.removableFromPlaylist
        ? \`<button title="Remover da playlist" onclick="removeFromCurrentPlaylist('\${t.id || ''}', event)">🗑️</button>\`
        : '';
      return \`
        <div class="track-row" data-track="\${dataAttr}">
          <img src="\${t.thumbnail || ''}" onerror="this.style.visibility='hidden'">
          <div class="track-info">
            <div class="t-title">\${t.title}</div>
            <div class="t-author">\${t.author || ''}</div>
          </div>
          <div class="t-duration">\${t.duration || ''}</div>
          <div class="t-actions">
            <button class="play" title="Tocar na call" onclick="playTrack(event)">▶️</button>
            <button class="fav \${fav ? 'active' : ''}" title="Favoritar" onclick="toggleFavorite(event)">\${fav ? '💚' : '🤍'}</button>
            <button title="Adicionar à playlist" onclick="openAddToPlaylistModal(event)">➕</button>
            \${removeBtn}
          </div>
        </div>\`;
    }

    function getTrackFromEl(evtOrEl) {
      const el = evtOrEl.target ? evtOrEl.target.closest('.track-row') : evtOrEl;
      return JSON.parse(decodeURIComponent(el.getAttribute('data-track')));
    }

    async function playTrack(evt) {
      const t = getTrackFromEl(evt);

      // Dentro do foguetinho, numa call de voz: toca de verdade no canal,
      // igual o /play do Discord. Fora disso (navegador normal, sem call),
      // o som sai do próprio site — via o player embutido do SoundCloud.
      if (window.isDiscordActivity && window.discordChannelId && window.discordGuildId) {
        showToast('▶️ Chamando ' + t.title + '...');
        try {
          const res = await fetch('/api/activities/music/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: t.url, title: t.title, channelId: window.discordChannelId, guildId: window.discordGuildId }),
          });
          const data = await res.json();
          if (!res.ok) return showToast('❌ ' + (data.error || 'Erro ao tocar.'));
          showToast('🎶 Tocando na call: ' + data.title);
        } catch (e) {
          showToast('❌ Erro de conexão ao tentar tocar.');
        }
        return;
      }

      playInBrowser(t);
    }

    function playInBrowser(t) {
      const bar = document.getElementById('webPlayerBar');
      const frame = document.getElementById('webPlayerFrame');
      const titleEl = document.getElementById('webPlayerTitle');
      if (!/soundcloud\\.com/i.test(t.url)) {
        showToast('🎧 Essa faixa só toca dentro de uma call do Discord (não é do SoundCloud).');
        return;
      }
      frame.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(t.url) + '&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false&color=%231DB954';
      titleEl.textContent = t.title + (t.author ? ' — ' + t.author : '');
      bar.classList.add('show');
      showToast('🎶 Tocando no site: ' + t.title);
    }

    function closeWebPlayer() {
      document.getElementById('webPlayerBar').classList.remove('show');
      document.getElementById('webPlayerFrame').src = '';
    }

    async function toggleFavorite(evt) {
      const t = getTrackFromEl(evt);
      const res = await fetch('/api/activities/music/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      });
      const data = await res.json();
      await loadFavorites();
      if (data.favorited) showToast('💚 Adicionado às favoritas');
      else showToast('Removido das favoritas');
      if (currentView === 'search') refreshSearchFavIcons();
      if (currentView === 'favorites') renderFavoritesView();
    }

    function refreshSearchFavIcons() {
      document.querySelectorAll('#content .track-row').forEach(row => {
        const t = JSON.parse(decodeURIComponent(row.getAttribute('data-track')));
        const btn = row.querySelector('.fav');
        if (!btn) return;
        const fav = isFavorited(t.url);
        btn.classList.toggle('active', fav);
        btn.textContent = fav ? '💚' : '🤍';
      });
    }

    function openAddToPlaylistModal(evt) {
      pendingTrackForPlaylist = getTrackFromEl(evt);
      const pick = document.getElementById('plPick');
      if (playlists.length === 0) {
        pick.innerHTML = '<div class="empty-hint" style="padding:10px 0;">Você ainda não tem playlists. Crie uma primeiro!</div>';
      } else {
        pick.innerHTML = playlists.map(p => \`<button onclick="confirmAddToPlaylist('\${p.id}')">\${p.name} (\${p.tracks.length})</button>\`).join('');
      }
      document.getElementById('addToPlaylistModal').classList.add('show');
    }
    function closeAddToPlaylistModal() {
      document.getElementById('addToPlaylistModal').classList.remove('show');
      pendingTrackForPlaylist = null;
    }
    async function confirmAddToPlaylist(playlistId) {
      if (!pendingTrackForPlaylist) return;
      await fetch('/api/activities/music/playlists/' + playlistId + '/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingTrackForPlaylist),
      });
      showToast('✅ Adicionado à playlist');
      closeAddToPlaylistModal();
      await loadPlaylists();
    }

    function openNewPlaylistModal() {
      document.getElementById('newPlaylistName').value = '';
      document.getElementById('playlistModal').classList.add('show');
      document.getElementById('newPlaylistName').focus();
    }
    function closeNewPlaylistModal() {
      document.getElementById('playlistModal').classList.remove('show');
    }
    async function confirmNewPlaylist() {
      const name = document.getElementById('newPlaylistName').value.trim();
      if (!name) return;
      const res = await fetch('/api/activities/music/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      closeNewPlaylistModal();
      await loadPlaylists();
      showToast('✅ Playlist criada');
    }

    async function deletePlaylist(id, evt) {
      evt.stopPropagation();
      if (!confirm('Apagar essa playlist?')) return;
      await fetch('/api/activities/music/playlists/' + id, { method: 'DELETE' });
      if (currentPlaylistId === id) showView('search');
      await loadPlaylists();
    }

    async function removeFromCurrentPlaylist(trackId, evt) {
      evt.stopPropagation();
      if (!currentPlaylistId || !trackId) return;
      await fetch('/api/activities/music/playlists/' + currentPlaylistId + '/tracks/' + trackId, { method: 'DELETE' });
      await loadPlaylists();
      openPlaylist(currentPlaylistId);
    }

    async function loadFavorites() {
      const res = await fetch('/api/activities/music/favorites');
      const data = await res.json();
      favorites = data.favorites || [];
    }

    async function loadPlaylists() {
      const res = await fetch('/api/activities/music/playlists');
      const data = await res.json();
      playlists = data.playlists || [];
      renderPlaylistSidebar();
      if (currentView === 'playlist' && currentPlaylistId) {
        openPlaylist(currentPlaylistId, true);
      }
    }

    function renderPlaylistSidebar() {
      const el = document.getElementById('plList');
      if (playlists.length === 0) {
        el.innerHTML = '';
        return;
      }
      el.innerHTML = playlists.map(p => \`
        <div class="pl-item \${currentView === 'playlist' && currentPlaylistId === p.id ? 'active' : ''}" onclick="openPlaylist('\${p.id}')">
          <span>\${p.name}</span>
          <span class="del" onclick="deletePlaylist('\${p.id}', event)">✕</span>
        </div>\`).join('');
    }

    function showView(view) {
      currentView = view;
      currentPlaylistId = null;
      document.getElementById('navSearch').classList.toggle('active', view === 'search');
      document.getElementById('navFavorites').classList.toggle('active', view === 'favorites');
      renderPlaylistSidebar();
      if (view === 'search') {
        document.getElementById('content').innerHTML = document.getElementById('searchInput').value.trim()
          ? document.getElementById('content').innerHTML
          : '<div class="empty-hint">Digite algo na busca pra começar 🎧</div>';
      } else if (view === 'favorites') {
        renderFavoritesView();
      }
    }

    function renderFavoritesView() {
      const content = document.getElementById('content');
      content.innerHTML = '<h2>💚 Suas Favoritas</h2>';
      if (favorites.length === 0) {
        content.innerHTML += '<div class="empty-hint">Você ainda não favoritou nenhuma música.</div>';
        return;
      }
      content.innerHTML += favorites.map(f => trackRowHtml(f)).join('');
    }

    function openPlaylist(id, silent) {
      currentView = 'playlist';
      currentPlaylistId = id;
      document.getElementById('navSearch').classList.remove('active');
      document.getElementById('navFavorites').classList.remove('active');
      renderPlaylistSidebar();
      const playlist = playlists.find(p => p.id === id);
      const content = document.getElementById('content');
      if (!playlist) { content.innerHTML = '<div class="empty-hint">Playlist não encontrada.</div>'; return; }
      content.innerHTML = '<h2>🎼 ' + playlist.name + '</h2>';
      if (playlist.tracks.length === 0) {
        content.innerHTML += '<div class="empty-hint">Essa playlist ainda está vazia. Adicione músicas pela busca!</div>';
      } else {
        content.innerHTML += playlist.tracks.map(t => trackRowHtml(t, { removableFromPlaylist: true })).join('');
      }
    }

    let searchTimeout = null;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchTimeout);
      if (!q) {
        showView('search');
        return;
      }
      searchTimeout = setTimeout(() => doSearch(q), 500);
    });

    async function doSearch(q) {
      currentView = 'search';
      currentPlaylistId = null;
      document.getElementById('navSearch').classList.add('active');
      document.getElementById('navFavorites').classList.remove('active');
      renderPlaylistSidebar();
      const content = document.getElementById('content');
      content.innerHTML = '<div class="loading">Buscando "' + q + '"...</div>';
      try {
        const res = await fetch('/api/activities/music/search?q=' + encodeURIComponent(q));
        const data = await res.json();
        const tracks = data.tracks || [];
        if (tracks.length === 0) {
          content.innerHTML = '<div class="empty-hint">Nada encontrado pra "' + q + '". Tente outro termo.</div>';
          return;
        }
        content.innerHTML = '<h2>Resultados pra "' + q + '"</h2>' + tracks.map(t => trackRowHtml(t)).join('');
      } catch (e) {
        content.innerHTML = '<div class="empty-hint">❌ Erro ao buscar. Tente de novo.</div>';
      }
    }

    (async () => {
      await window.activityReady;
      await Promise.all([loadFavorites(), loadPlaylists()]);
    })();
  </script>
</body>
</html>`);
  });

  // =====================================================================
  // ⚽ RACHÃO (/atividades/fut) — o site é a interface PRINCIPAL desse
  // sistema (o Discord fica mais pra anunciar o que rola). "Pelada" aqui
  // é um CLÃ persistente (não tem modo, não "finaliza"); dentro dele
  // acontecem PARTIDAS de verdade (futsal ou campo), com estatísticas de
  // cada jogador separadas por modo. Reaproveita 100% da mesma engine de
  // src/fut/services/pelada.ts que o comando /fut usa.
  // =====================================================================
  // Resolve a URL do avatar de alguém pelo ID do Discord, pra mostrar a foto
  // real da pessoa no site (jogador de clã, elenco, partida, ranking...).
  async function getAvatarUrl(discordId: string | null): Promise<string | null> {
    if (!discordId) return null;
    const user = await discordClient.users.fetch(discordId).catch(() => null);
    return user ? user.displayAvatarURL({ size: 128 }) : null;
  }

  async function serializeFutClan(clan: NonNullable<Awaited<ReturnType<typeof getClanById>>>, viewerId?: string) {
    const members = await Promise.all(clan.members.map(async (m) => ({
      id: m.id,
      discordId: m.discordId,
      displayName: m.displayName,
      teamId: m.teamId,
      avatarUrl: await getAvatarUrl(m.discordId),
    })));
    // O código de convite (pra clã privado) só aparece pra quem já é
    // membro/criador — pra essa pessoa poder compartilhar com quem quiser.
    const souMembro = !!viewerId && (clan.creatorId === viewerId || members.some((m) => m.discordId === viewerId));
    return {
      id: clan.id,
      name: clan.name,
      creatorId: clan.creatorId,
      visibility: clan.visibility,
      joinCode: souMembro ? clan.joinCode : null,
      members,
      teams: clan.teams.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    };
  }

  async function serializeFutPartida(partida: NonNullable<Awaited<ReturnType<typeof getPartidaById>>>) {
    const players = await Promise.all(partida.players.map(async (p) => ({
      id: p.id, discordId: p.discordId, displayName: p.displayName, position: p.position, team: p.team,
      goals: p.goals, assists: p.assists, defesas: p.defesas, golsConcedidos: p.golsConcedidos, errosGraves: p.errosGraves,
      nota: p.nota, avatarUrl: await getAvatarUrl(p.discordId),
    })));
    return {
      id: partida.id,
      clanId: partida.clanId,
      name: partida.name,
      mode: partida.mode,
      status: partida.status,
      scoreA: partida.scoreA,
      scoreB: partida.scoreB,
      resultado: partida.resultado,
      creatorId: partida.creatorId,
      players,
    };
  }

  function handleFutError(res: express.Response, err: unknown) {
    if (err instanceof FutError) return res.status(400).json({ error: err.message });
    console.error('[Rachão/Site] Erro inesperado:', err);
    res.status(500).json({ error: 'Alguma coisa deu errado. Tenta de novo.' });
  }

  // ── Seletor de servidor (a pessoa pode estar em vários servidores da
  // Aliança — escolhe qual usar antes de ver os clãs do Fut, missões, etc) ──
  async function listGuildsForPlayer(discordId: string) {
    const servers = await prisma.allianceServer.findMany({ orderBy: { guildName: 'asc' } });
    const withMembership = await Promise.all(servers.map(async (s) => {
      const guild = discordClient.guilds.cache.get(s.guildId);
      if (!guild) return null;
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) return null;
      return { guildId: s.guildId, name: s.guildName || guild.name };
    }));
    return withMembership.filter((g): g is { guildId: string; name: string } => g !== null);
  }

  app.get('/api/activities/guilds', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const guilds = await listGuildsForPlayer(userId);
    const selected = (req.cookies?.selected_guild as string | undefined) || guilds[0]?.guildId || null;
    res.json({ guilds, selected });
  });

  app.post('/api/activities/select-guild', requirePlayerAuth, async (req, res) => {
    const userId = req.cookies!.player_userid as string;
    const guildId = String(req.body?.guildId || '');
    const guilds = await listGuildsForPlayer(userId);
    if (!guilds.some((g) => g.guildId === guildId)) {
      return res.status(400).json({ error: 'Você não faz parte desse servidor.' });
    }
    res.cookie('selected_guild', guildId, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true, selected: guildId });
  });

  app.get('/api/activities/fut/clans', requirePlayerAuth, async (req, res) => {
    const guildId = await resolveGuildId(typeof req.query.guildId === 'string' ? req.query.guildId : undefined, req.cookies?.selected_guild as string | undefined);
    if (!guildId) return res.status(400).json({ error: 'Nenhum servidor da Aliança configurado ainda.' });
    const userId = req.cookies!.player_userid as string;
    const [clans, totalClans] = await Promise.all([listClans(guildId, userId), countFutClans(guildId)]);
    res.json({ clans: await Promise.all(clans.map((c) => serializeFutClan(c, userId))), meId: userId, totalClans, maxClans: maxClansPerGuild() });
  });

  app.post('/api/activities/fut/clans', requirePlayerAuth, async (req, res) => {
    try {
      const guildId = await resolveGuildId(req.body?.guildId, req.cookies?.selected_guild as string | undefined);
      if (!guildId) return res.status(400).json({ error: 'Nenhum servidor da Aliança configurado ainda.' });
      const userId = req.cookies!.player_userid as string;
      const username = (req.cookies!.player_username as string) || 'Jogador';
      const visibility: FutVisibility = req.body?.visibility === 'privado' ? 'privado' : 'publico';
      const clan = await createClan(guildId, userId, username, String(req.body?.name || ''), visibility);
      res.json({ clan: await serializeFutClan(clan, userId) });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/join', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      const username = (req.cookies!.player_username as string) || 'Jogador';
      const joinCode = typeof req.body?.joinCode === 'string' ? req.body.joinCode : undefined;
      await joinClan(req.params.id, userId, username, joinCode);
      res.json({ clan: await serializeFutClan((await getClanById(req.params.id))!, userId) });
    } catch (err) { handleFutError(res, err); }
  });

  // Achar um clã privado pelo código de convite (pra quem recebeu o código
  // mas não vê o clã na lista, já que clã privado só aparece pra membros).
  app.get('/api/activities/fut/clans/by-code/:joinCode', requirePlayerAuth, async (req, res) => {
    const clan = await getClanByJoinCode(req.params.joinCode);
    if (!clan) return res.status(404).json({ error: 'Nenhum clã encontrado com esse código.' });
    res.json({ clan: await serializeFutClan(clan, req.cookies!.player_userid as string) });
  });

  app.delete('/api/activities/fut/clans/:id', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      await deleteClan(req.params.id, userId);
      res.json({ ok: true });
    } catch (err) { handleFutError(res, err); }
  });

  // ── Elenco: times internos e fixos do clã (ex: Time Amarelo x Time Azul) ─
  // Diferente do "team" A/B abaixo, que é só o lado de UMA partida.
  app.get('/api/activities/fut/clans/:id/teams', requirePlayerAuth, async (req, res) => {
    const teams = await listFutTeams(req.params.id);
    const withAvatars = await Promise.all(teams.map(async (t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      members: await Promise.all(t.members.map(async (m) => ({
        id: m.id, discordId: m.discordId, displayName: m.displayName, avatarUrl: await getAvatarUrl(m.discordId),
      }))),
    })));
    res.json({ teams: withAvatars });
  });

  app.post('/api/activities/fut/clans/:id/teams', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      const team = await createFutTeam(req.params.id, userId, String(req.body?.name || ''), req.body?.color || undefined);
      res.json({ team });
    } catch (err) { handleFutError(res, err); }
  });

  app.delete('/api/activities/fut/clans/:id/teams/:teamId', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      await deleteFutTeam(req.params.teamId, userId);
      res.json({ ok: true });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/members/team', requirePlayerAuth, async (req, res) => {
    try {
      const ref = { discordId: req.body?.discordId || undefined, apelido: req.body?.apelido || undefined };
      const teamId = req.body?.teamId || null;
      await setFutMemberTeam(req.params.id, ref, teamId);
      res.json({ clan: await serializeFutClan((await getClanById(req.params.id))!, req.cookies!.player_userid as string) });
    } catch (err) { handleFutError(res, err); }
  });

  app.get('/api/activities/fut/clans/:id/partida', requirePlayerAuth, async (req, res) => {
    const partida = await getOpenPartida(req.params.id);
    res.json({ partida: partida ? await serializeFutPartida(partida) : null, meId: req.cookies!.player_userid });
  });

  app.post('/api/activities/fut/clans/:id/partida', requirePlayerAuth, async (req, res) => {
    try {
      const clan = await getClanById(req.params.id);
      if (!clan) return res.status(404).json({ error: 'Clã não encontrado.' });
      const modo: FutMode = req.body?.modo === 'campo' ? 'campo' : 'futsal';
      const nome = typeof req.body?.nome === 'string' ? req.body.nome : undefined;
      const userId = req.cookies!.player_userid as string;
      const username = (req.cookies!.player_username as string) || 'Jogador';
      const partida = await createPartida(clan.id, userId, username, modo, nome);
      res.json({ partida: await serializeFutPartida(partida) });
    } catch (err) { handleFutError(res, err); }
  });

  async function currentFutPartidaOr400(req: express.Request, res: express.Response) {
    const partida = await getOpenPartida(req.params.id);
    if (!partida) { res.status(400).json({ error: 'Nenhuma partida em aberto nesse clã. Crie uma primeiro.' }); return null; }
    return partida;
  }

  app.delete('/api/activities/fut/clans/:id/partida', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const userId = req.cookies!.player_userid as string;
      await deletePartida(partida.id, userId);
      res.json({ ok: true });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/join-partida', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const userId = req.cookies!.player_userid as string;
      const username = (req.cookies!.player_username as string) || 'Jogador';
      await joinPartida(partida.id, userId, username, req.body?.posicao || undefined);
      res.json({ partida: await serializeFutPartida((await getPartidaById(partida.id))!) });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/add-offline', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const apelido = String(req.body?.apelido || '');
      await addOfflinePlayer(partida.id, apelido, req.body?.posicao || undefined);
      res.json({ partida: await serializeFutPartida((await getPartidaById(partida.id))!) });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/team', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const team = req.body?.team === 'B' ? 'B' : 'A';
      await setTeam(partida.id, { discordId: req.body?.discordId || undefined, apelido: req.body?.apelido || undefined }, team as FutTeam);
      res.json({ partida: await serializeFutPartida((await getPartidaById(partida.id))!) });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/auto-balance', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const userId = req.cookies!.player_userid as string;
      const balanced = await autoBalanceTeams(partida.id, userId);
      res.json({ partida: await serializeFutPartida(balanced!) });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/start', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const userId = req.cookies!.player_userid as string;
      await startPartida(partida.id, userId);
      res.json({ partida: await serializeFutPartida((await getPartidaById(partida.id))!) });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/event', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const type = req.body?.type as FutEventType;
      if (!['gol', 'defesa', 'concedido', 'erro'].includes(type)) return res.status(400).json({ error: 'Tipo de evento inválido.' });

      const ref = { discordId: req.body?.discordId || undefined, apelido: req.body?.apelido || undefined };
      const assistRef = (req.body?.assistDiscordId || req.body?.assistApelido)
        ? { discordId: req.body?.assistDiscordId || undefined, apelido: req.body?.assistApelido || undefined }
        : undefined;
      const videoUrl = typeof req.body?.videoUrl === 'string' ? req.body.videoUrl : undefined;

      await recordEvent(partida.id, ref, type, assistRef, videoUrl);
      res.json({ partida: await serializeFutPartida((await getPartidaById(partida.id))!) });
    } catch (err) { handleFutError(res, err); }
  });

  // Desfaz o último evento da partida em andamento — "subtrair coisa
  // durante o jogo em caso de erro".
  app.post('/api/activities/fut/clans/:id/event/undo', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const userId = req.cookies!.player_userid as string;
      const desfeito = await undoFutLastEvent(partida.id, userId);
      res.json({ partida: await serializeFutPartida((await getPartidaById(partida.id))!), desfeito: { type: desfeito.type, displayName: desfeito.player.displayName } });
    } catch (err) { handleFutError(res, err); }
  });

  // Adiciona alguém DIRETO no elenco do clã (nome + ID, se tiver) — cobre o
  // caso de clã público: a visibilidade é só pública, mas isso não bota
  // ninguém no elenco sozinho, o criador precisa poder trazer gente à mão.
  app.post('/api/activities/fut/clans/:id/members', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName : '';
      const discordId = typeof req.body?.discordId === 'string' && req.body.discordId.trim() ? req.body.discordId : undefined;
      await addFutClanMember(req.params.id, userId, { discordId, displayName });
      const clan = await getClanById(req.params.id);
      res.json({ clan: clan ? await serializeFutClan(clan, userId) : null });
    } catch (err) { handleFutError(res, err); }
  });

  // Remove alguém do elenco do clã — só quem criou o clã.
  app.delete('/api/activities/fut/clans/:id/members/:memberId', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      const clan = await getClanById(req.params.id);
      if (!clan) return res.status(404).json({ error: 'Clã não encontrado.' });
      const alvo = clan.members.find((m) => m.id === req.params.memberId);
      if (!alvo) return res.status(404).json({ error: 'Membro não encontrado nesse clã.' });

      await removeFutClanMember(clan.id, userId, { discordId: alvo.discordId ?? undefined, apelido: alvo.discordId ? undefined : alvo.displayName });
      const updated = await getClanById(req.params.id);
      res.json({ clan: updated ? await serializeFutClan(updated, userId) : null });
    } catch (err) { handleFutError(res, err); }
  });

  // Detalhe completo de UMA partida específica (aberta, em andamento ou já
  // finalizada) — "acessar as estatísticas da partida após ela terminar".
  app.get('/api/activities/fut/clans/:id/partidas/:partidaId', requirePlayerAuth, async (req, res) => {
    const partida = await getPartidaById(req.params.partidaId);
    if (!partida || partida.clanId !== req.params.id) return res.status(404).json({ error: 'Partida não encontrada nesse clã.' });
    const events = await listFutMatchEvents(partida.id);
    res.json({ partida: await serializeFutPartida(partida), events });
  });

  // Reabre UMA partida específica (qualquer uma do histórico, não só a mais
  // recente) pra corrigir gols/estatísticas/resultado — "no pós partida,
  // tudo pode ser capaz de ser alterado".
  app.post('/api/activities/fut/clans/:id/partidas/:partidaId/reopen', requirePlayerAuth, async (req, res) => {
    try {
      const alvo = await getPartidaById(req.params.partidaId);
      if (!alvo || alvo.clanId !== req.params.id) return res.status(404).json({ error: 'Partida não encontrada nesse clã.' });
      const userId = req.cookies!.player_userid as string;
      const reaberta = await reopenFutPartida(alvo.id, userId);
      res.json({ partida: await serializeFutPartida(reaberta) });
    } catch (err) { handleFutError(res, err); }
  });

  app.get('/api/activities/fut/clans/:id/gols', requirePlayerAuth, async (req, res) => {
    const partida = await getOpenPartida(req.params.id) ?? (await listPartidaHistory(req.params.id, 1))[0];
    if (!partida) return res.json({ videos: [] });
    const videos = await listGoalVideos(partida.id);
    res.json({ videos: videos.map((v) => ({ id: v.id, videoUrl: v.videoUrl, displayName: v.player?.displayName || 'Desconhecido' })) });
  });

  // Gols de uma partida específica — pra escolher qual animar no editor.
  app.get('/api/activities/fut/clans/:id/partidas/:partidaId/gols', requirePlayerAuth, async (req, res) => {
    const partida = await getPartidaById(req.params.partidaId);
    if (!partida || partida.clanId !== req.params.id) return res.status(404).json({ error: 'Partida não encontrada nesse clã.' });
    const gols = await listFutPartidaGoals(partida.id);
    res.json({ gols });
  });

  // Animação do gol (montada por frames arrastáveis, no pós-partida).
  app.get('/api/activities/fut/clans/:id/events/:eventId/animation', requirePlayerAuth, async (req, res) => {
    try {
      const anim = await getFutGoalAnimation(req.params.eventId);
      if (anim.clanId !== req.params.id) return res.status(404).json({ error: 'Gol não encontrado nesse clã.' });
      const userId = req.cookies!.player_userid as string;
      res.json({ ...anim, souCriador: anim.creatorId === userId });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/events/:eventId/animation', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      const frames = await saveFutGoalAnimation(req.params.eventId, userId, req.body?.frames);
      res.json({ frames });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/finish', requirePlayerAuth, async (req, res) => {
    try {
      const partida = await currentFutPartidaOr400(req, res);
      if (!partida) return;
      const userId = req.cookies!.player_userid as string;
      const resultado = req.body?.resultado as FutResultado | undefined;
      const finished = await finishPartida(partida.id, userId, resultado || undefined);
      res.json({ partida: await serializeFutPartida(finished) });
    } catch (err) { handleFutError(res, err); }
  });

  app.get('/api/activities/fut/clans/:id/profile', requirePlayerAuth, async (req, res) => {
    const mode: FutMode = req.query.mode === 'campo' ? 'campo' : 'futsal';
    const userId = typeof req.query.userId === 'string' ? req.query.userId : (req.cookies!.player_userid as string);
    const [profile, userProfile] = await Promise.all([getFutProfile(req.params.id, userId, mode), getFutUserProfile(userId)]);
    const posicao = (mode === 'futsal' ? userProfile?.positionFutsal : userProfile?.positionCampo) || null;
    res.json({ profile, posicao });
  });

  app.get('/api/activities/fut/clans/:id/ranking', requirePlayerAuth, async (req, res) => {
    const mode: FutMode = req.query.mode === 'campo' ? 'campo' : 'futsal';
    const ranking = await getFutRanking(req.params.id, mode, 10);
    const withNames = await Promise.all(ranking.map(async (p) => {
      const user = await discordClient.users.fetch(p.discordId).catch(() => null);
      return { ...p, displayName: user?.username || p.discordId, avatarUrl: user ? user.displayAvatarURL({ size: 64 }) : null };
    }));
    res.json({ ranking: withNames });
  });

  // Estatísticas do clã inteiro (agregado) + elenco completo individual
  // (sem limite de top-N) — item "salvar tanto os da pelada inteira quanto
  // individualmente, mostrando a de todo o elenco".
  app.get('/api/activities/fut/clans/:id/overview', requirePlayerAuth, async (req, res) => {
    const mode: FutMode = req.query.mode === 'campo' ? 'campo' : 'futsal';
    const [overview, elenco] = await Promise.all([getFutClanOverview(req.params.id, mode), listFullFutClanStats(req.params.id, mode)]);
    const elencoComNomes = await Promise.all(elenco.map(async (p) => {
      const user = await discordClient.users.fetch(p.discordId).catch(() => null);
      return { ...p, displayName: user?.username || p.discordId, avatarUrl: user ? user.displayAvatarURL({ size: 64 }) : null };
    }));
    const withUser = async (stat: typeof overview.artilheiro) => {
      if (!stat) return null;
      const user = await discordClient.users.fetch(stat.discordId).catch(() => null);
      return { ...stat, displayName: user?.username || stat.discordId, avatarUrl: user ? user.displayAvatarURL({ size: 64 }) : null };
    };
    const [artilheiro, garcom, melhorNota] = await Promise.all([withUser(overview.artilheiro), withUser(overview.garcom), withUser(overview.melhorNota)]);
    res.json({ overview: { ...overview, artilheiro, garcom, melhorNota }, elenco: elencoComNomes });
  });

  app.get('/api/activities/fut/clans/:id/historico', requirePlayerAuth, async (req, res) => {
    const partidas = await listPartidaHistory(req.params.id, 10);
    res.json({ partidas: await Promise.all(partidas.map(serializeFutPartida)) });
  });

  // Perfil PESSOAL (posição preferida) — global, não depende de clã.
  app.get('/api/activities/fut/me', requirePlayerAuth, async (req, res) => {
    const profile = await getFutUserProfile(req.cookies!.player_userid as string);
    res.json({ positionFutsal: profile?.positionFutsal || '', positionCampo: profile?.positionCampo || '' });
  });

  app.post('/api/activities/fut/me/position', requirePlayerAuth, async (req, res) => {
    try {
      const mode: FutMode = req.body?.mode === 'campo' ? 'campo' : 'futsal';
      const userId = req.cookies!.player_userid as string;
      await setFutUserPosition(userId, mode, String(req.body?.position || ''));
      const profile = await getFutUserProfile(userId);
      res.json({ positionFutsal: profile?.positionFutsal || '', positionCampo: profile?.positionCampo || '' });
    } catch (err) { handleFutError(res, err); }
  });

  // ── "Chamar o fut": convite (local, horário, PIX, link) + RSVP ──────────
  function serializeChamada(chamada: { id: string; local: string; horario: string; pix: string | null; link: string | null; mensagem: string | null; creatorId: string; createdAt: Date; respostas: { discordId: string; displayName: string; status: string }[] }) {
    return {
      id: chamada.id, local: chamada.local, horario: chamada.horario, pix: chamada.pix, link: chamada.link,
      mensagem: chamada.mensagem, creatorId: chamada.creatorId, createdAt: chamada.createdAt,
      respostas: chamada.respostas,
    };
  }

  app.get('/api/activities/fut/clans/:id/chamadas', requirePlayerAuth, async (req, res) => {
    const chamadas = await listFutChamadas(req.params.id, 5);
    res.json({ chamadas: chamadas.map(serializeChamada) });
  });

  app.post('/api/activities/fut/clans/:id/chamadas', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      const chamada = await createFutChamada(req.params.id, userId, {
        local: String(req.body?.local || ''),
        horario: String(req.body?.horario || ''),
        pix: req.body?.pix || undefined,
        link: req.body?.link || undefined,
        mensagem: req.body?.mensagem || undefined,
      });
      res.json({ chamada: serializeChamada({ ...chamada, respostas: [] }) });
    } catch (err) { handleFutError(res, err); }
  });

  app.delete('/api/activities/fut/clans/:id/chamadas/:chamadaId', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      await deleteFutChamada(req.params.chamadaId, userId);
      res.json({ ok: true });
    } catch (err) { handleFutError(res, err); }
  });

  app.post('/api/activities/fut/clans/:id/chamadas/:chamadaId/rsvp', requirePlayerAuth, async (req, res) => {
    try {
      const userId = req.cookies!.player_userid as string;
      const username = (req.cookies!.player_username as string) || 'Jogador';
      const status = req.body?.status as FutRsvpStatus;
      if (!['vou', 'talvez', 'nao_vou'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
      await respondFutChamada(req.params.chamadaId, userId, username, status);
      const chamadas = await listFutChamadas(req.params.id, 5);
      res.json({ chamadas: chamadas.map(serializeChamada) });
    } catch (err) { handleFutError(res, err); }
  });

  app.get('/atividades/fut', (req, res) => {
    const isLogged = req.cookies?.player_auth === 'permitido' && req.cookies?.player_userid;

    if (!isLogged) {
      return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rachão — Login</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
${activitySdkBootstrap(clientId!)}
<style>
  :root { --bg: #05050A; --primary: #22C55E; --card: #12131F; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: radial-gradient(circle at 50% 0%, rgba(34,197,94,0.16), transparent 45%), var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 5%; }
  nav a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
  .brand { font-weight: 800; color: white; }
  .gate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; }
  .gate .icon { font-size: 3.4rem; margin-bottom: 18px; }
  .gate h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 12px; }
  .gate p { color: var(--text-muted); max-width: 420px; margin-bottom: 30px; line-height: 1.5; }
  .discord-btn { display: inline-flex; align-items: center; gap: 10px; background: #5865F2; color: white; text-decoration: none; font-weight: 700; padding: 14px 28px; border-radius: 10px; box-shadow: 0 8px 25px rgba(88,101,242,0.4); transition: 0.2s; }
  .discord-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(88,101,242,0.55); }
  .note { color: var(--text-muted); font-size: 0.8rem; margin-top: 18px; max-width: 380px; }
</style>
</head>
<body>
  <nav><span class="brand">⚽ Rachão</span><a href="/atividades">← Atividades</a></nav>
  <div class="gate" id="gateBox">
    <div class="icon">🔒</div>
    <h1 id="gateTitle">Entre com sua conta do Discord</h1>
    <p id="gateDesc">Suas estatísticas de Rachão são pessoais — por isso pedimos login com o Discord.</p>
    <a class="discord-btn" id="gateBtn" href="/login/player?next=/atividades/fut">🎮 Entrar com Discord</a>
    <p class="note">Isso não te dá acesso ao painel administrativo do bot — é só pra identificar seu jogador.</p>
  </div>
  <script>
    window.activityReady.then((ok) => {
      if (window.isDiscordActivity) {
        document.getElementById('gateBtn').style.display = 'none';
        if (ok) {
          document.getElementById('gateTitle').innerText = '✅ Entrando...';
          document.getElementById('gateDesc').innerText = 'Autenticado com sucesso, carregando...';
          window.location.reload();
        } else {
          document.getElementById('gateTitle').innerText = '⚠️ Não deu pra autenticar automaticamente';
          document.getElementById('gateDesc').innerText = 'Tenta fechar e abrir a Activity de novo.';
        }
      }
    });
  </script>
</body>
</html>`);
    }

    const meId = req.cookies?.player_userid as string;

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rachão — Bryan Bot</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
${activitySdkBootstrap(clientId!)}
<style>
  :root { --bg: #05050A; --bg2: #0A0A12; --primary: #22C55E; --card: #12131F; --card2: #181A28; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; --red: #E74C3C; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: var(--bg); color: var(--text); min-height: 100vh; padding-bottom: 40px; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 5%; border-bottom: 1px solid var(--border); }
  nav a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
  .brand { font-weight: 800; color: white; display: flex; align-items: center; gap: 8px; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px 20px; }
  .crumb { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; font-size: 0.85rem; color: var(--text-muted); }
  .crumb button { background: none; border: none; color: var(--primary); font-weight: 700; cursor: pointer; font-size: 0.85rem; padding: 0; }
  .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
  .tab { background: var(--card); border: 1px solid var(--border); color: var(--text-muted); padding: 10px 18px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.88rem; }
  .tab.active { color: #05050A; background: var(--primary); border-color: var(--primary); }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-bottom: 18px; }
  .card h2 { font-size: 1.1rem; margin-bottom: 14px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  input, select { background: var(--card2); border: 1px solid var(--border); color: white; padding: 11px 14px; border-radius: 8px; outline: none; font-size: 0.9rem; }
  input:focus, select:focus { border-color: var(--primary); }
  button.btn { background: var(--primary); color: #05050A; border: none; padding: 11px 20px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 0.88rem; }
  button.btn:hover { filter: brightness(1.1); }
  button.btn.secondary { background: var(--card2); color: white; border: 1px solid var(--border); }
  button.btn.danger { background: var(--red); color: white; }
  .clan-list { display: flex; flex-direction: column; gap: 10px; }
  .clan-item { display: flex; justify-content: space-between; align-items: center; background: var(--card2); border: 1px solid var(--border); padding: 14px 16px; border-radius: 10px; cursor: pointer; }
  .clan-item:hover { border-color: var(--primary); }
  .clan-item .meta { color: var(--text-muted); font-size: 0.8rem; }
  .clan-item .actions button { margin-left: 6px; }
  .score-big { text-align: center; font-size: 2.4rem; font-weight: 800; margin: 6px 0 18px; }
  .teams { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
  .team-col h3 { font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
  .player-row { display: flex; justify-content: space-between; align-items: center; background: var(--card2); padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; font-size: 0.86rem; }
  .player-row .stats { color: var(--text-muted); font-size: 0.78rem; }
  .unassigned { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
  .chip { background: var(--card2); border: 1px solid var(--border); padding: 6px 12px; border-radius: 999px; font-size: 0.82rem; display: flex; align-items: center; gap: 8px; }
  .chip button { background: none; border: none; color: var(--text-muted); font-size: 0.75rem; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
  .chip button:hover { color: white; background: rgba(255,255,255,0.08); }
  .empty-hint { color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 30px 0; }
  .status-badge { font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--card2); color: var(--text-muted); }
  .status-badge.aberta { color: #F5C242; }
  .status-badge.em_andamento { color: var(--primary); }
  .status-badge.finalizada { color: var(--red); }
  table.stats-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
  table.stats-table td { padding: 8px 6px; border-bottom: 1px solid var(--border); }
  .rank-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
  .mode-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
  .mode-toggle button { flex: 1; }
</style>
</head>
<body>
  <nav>
    <span class="brand">⚽ Rachão</span>
    <a href="/atividades">← Atividades</a>
  </nav>
  <div class="wrap">
    <div id="clanListView">
      <div class="card" id="serverSelectCard" style="display:none;">
        <h2>🌐 Servidor</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;">Você tá em mais de um servidor da Aliança — escolha qual usar.</p>
        <div class="row"><select id="guildSelect" onchange="selecionarServidor()" style="flex:1;min-width:200px;"></select></div>
      </div>
      <div class="card">
        <h2>🧍 Minha posição preferida</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;">Usada automaticamente quando você entra numa partida (dá pra mudar na hora também).</p>
        <div class="row">
          <input id="posFutsal" type="text" placeholder="Posição no Futsal (ex: Pivô)" style="flex:1;min-width:160px;">
          <input id="posCampo" type="text" placeholder="Posição no Campo (ex: Meia)" style="flex:1;min-width:160px;">
          <button class="btn secondary" onclick="salvarMinhasPosicoes()">Salvar</button>
        </div>
      </div>
      <div class="card">
        <h2>Seus clãs <small id="clanSlotCount" style="color:var(--text-muted);font-weight:normal;"></small></h2>
        <div class="row">
          <input id="newClanName" type="text" placeholder="Nome do novo clã" style="flex:1;min-width:160px;">
          <select id="newClanVisibility" style="width:140px;">
            <option value="publico">🌐 Público</option>
            <option value="privado">🔒 Privado</option>
          </select>
          <button class="btn" onclick="criarClan()">Criar Clã</button>
        </div>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-top:6px;">Privado: só quem já é membro vê na lista — pra entrar, precisa do código de convite (gerado na hora e mostrado só pros membros).</p>
        <div class="clan-list" id="clanList"></div>
      </div>
      <div class="card">
        <h2>🔑 Tenho um código de convite</h2>
        <div class="row">
          <input id="joinCodeInput" type="text" placeholder="Código do clã privado" style="flex:1;min-width:160px;text-transform:uppercase;">
          <button class="btn secondary" onclick="entrarPorCodigo()">Entrar</button>
        </div>
      </div>
    </div>

    <div id="clanDetailView" style="display:none">
      <div class="crumb"><button onclick="voltarParaClanList()">← Clãs</button><span id="clanBreadcrumb"></span></div>
      <div class="tabs">
        <button class="tab active" id="tabPelada" onclick="showTab('pelada')">Partida</button>
        <button class="tab" id="tabChamar" onclick="showTab('chamar')">Chamar</button>
        <button class="tab" id="tabElenco" onclick="showTab('elenco')">Elenco</button>
        <button class="tab" id="tabHistorico" onclick="showTab('historico')">Histórico</button>
        <button class="tab" id="tabPerfil" onclick="showTab('perfil')">Perfil</button>
        <button class="tab" id="tabRanking" onclick="showTab('ranking')">Ranking</button>
        <button class="tab" id="tabStats" onclick="showTab('stats')">Estatísticas do clã</button>
      </div>
      <div id="panelPelada"></div>
      <div id="panelChamar" style="display:none"></div>
      <div id="panelElenco" style="display:none"></div>
      <div id="panelHistorico" style="display:none"></div>
      <div id="panelPerfil" style="display:none"></div>
      <div id="panelRanking" style="display:none"></div>
      <div id="panelStats" style="display:none"></div>
    </div>
  </div>
  <div class="toast" id="toast"></div>

  <script>
    const ME_ID = ${JSON.stringify(meId)};
    let clans = [];
    let currentClan = null;
    let currentTab = 'pelada';
    let currentMode = 'futsal';
    let pollTimer = null;

    function showToast(msg) {
      let el = document.getElementById('toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#181A28;border:1px solid #262A40;padding:12px 22px;border-radius:10px;font-size:0.88rem;opacity:0;transition:.25s;z-index:999;';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 2600);
    }

    async function api(path, opts) {
      const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro na requisição.');
      return data;
    }

    // ── Minha posição preferida (global, independe de clã) ──────────────
    async function loadMinhasPosicoes() {
      try {
        const data = await api('/api/activities/fut/me');
        document.getElementById('posFutsal').value = data.positionFutsal || '';
        document.getElementById('posCampo').value = data.positionCampo || '';
      } catch (e) { /* silencioso */ }
    }

    async function salvarMinhasPosicoes() {
      const futsal = document.getElementById('posFutsal').value.trim();
      const campo = document.getElementById('posCampo').value.trim();
      try {
        if (futsal) await api('/api/activities/fut/me/position', { method: 'POST', body: JSON.stringify({ mode: 'futsal', position: futsal }) });
        if (campo) await api('/api/activities/fut/me/position', { method: 'POST', body: JSON.stringify({ mode: 'campo', position: campo }) });
        showToast('✅ Posições salvas!');
      } catch (e) { showToast('❌ ' + e.message); }
    }

    // ── Lista de clãs ──────────────────────────────────────────────────
    let clanSlots = { total: 0, max: 3 };

    async function loadClans() {
      try {
        const data = await api('/api/activities/fut/clans');
        clans = data.clans;
        clanSlots = { total: data.totalClans ?? clans.length, max: data.maxClans ?? 3 };
        renderClanList();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    function renderClanList() {
      const el = document.getElementById('clanList');
      const slotEl = document.getElementById('clanSlotCount');
      if (slotEl) slotEl.textContent = '(' + clanSlots.total + '/' + clanSlots.max + ' slots usados)';
      if (!clans.length) { el.innerHTML = '<div class="empty-hint">Nenhum clã ainda. Crie o primeiro!</div>'; return; }
      el.innerHTML = clans.map(c => \`
        <div class="clan-item" onclick="abrirClan('\${c.id}')">
          <div><strong>\${c.visibility === 'privado' ? '🔒 ' : ''}\${c.name}</strong><div class="meta">\${c.members.slice(0, 5).map(m => avatarHtml(m.avatarUrl, m.displayName, 20)).join('')}\${c.members.length} membro(s)\${c.teams && c.teams.length ? ' · ' + c.teams.length + ' time(s)' : ''}\${c.joinCode ? ' · código: <strong>' + c.joinCode + '</strong>' : ''}</div></div>
          <div class="actions">\${c.creatorId === ME_ID ? '<button class="btn danger" onclick="event.stopPropagation();deletarClan(\\''+c.id+'\\')">Deletar</button>' : ''}</div>
        </div>\`).join('');
    }

    async function criarClan() {
      const name = document.getElementById('newClanName').value.trim();
      const visibility = document.getElementById('newClanVisibility').value;
      if (!name) return;
      try {
        const data = await api('/api/activities/fut/clans', { method: 'POST', body: JSON.stringify({ name, visibility }) });
        document.getElementById('newClanName').value = '';
        showToast(data.clan.joinCode ? '✅ Clã privado criado! Código: ' + data.clan.joinCode : '✅ Clã criado!');
        loadClans();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function entrarPorCodigo() {
      const code = document.getElementById('joinCodeInput').value.trim();
      if (!code) return;
      try {
        const found = await api('/api/activities/fut/clans/by-code/' + encodeURIComponent(code));
        await api('/api/activities/fut/clans/' + found.clan.id + '/join', { method: 'POST', body: JSON.stringify({ joinCode: code }) });
        document.getElementById('joinCodeInput').value = '';
        showToast('✅ Você entrou no clã ' + found.clan.name + '!');
        loadClans();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    // ── Seletor de servidor (pra quem tá em mais de um servidor da Aliança) ─
    async function loadServers() {
      try {
        const data = await api('/api/activities/guilds');
        const card = document.getElementById('serverSelectCard');
        const select = document.getElementById('guildSelect');
        if (!data.guilds || data.guilds.length <= 1) { card.style.display = 'none'; return; }
        card.style.display = 'block';
        select.innerHTML = data.guilds.map(g => \`<option value="\${g.guildId}"\${g.guildId === data.selected ? ' selected' : ''}>\${g.name}</option>\`).join('');
      } catch (e) { /* silencioso — não trava a página por causa disso */ }
    }

    async function selecionarServidor() {
      const guildId = document.getElementById('guildSelect').value;
      try {
        await api('/api/activities/select-guild', { method: 'POST', body: JSON.stringify({ guildId }) });
        showToast('✅ Servidor alterado!');
        loadClans();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function deletarClan(id) {
      if (!confirm('Deletar esse clã? Todas as partidas e estatísticas dele serão apagadas.')) return;
      try { await api('/api/activities/fut/clans/' + id, { method: 'DELETE' }); showToast('🗑️ Clã deletado.'); loadClans(); }
      catch (e) { showToast('❌ ' + e.message); }
    }

    function abrirClan(id) {
      currentClan = clans.find(c => c.id === id);
      if (!currentClan) return;
      document.getElementById('clanListView').style.display = 'none';
      document.getElementById('clanDetailView').style.display = 'block';
      document.getElementById('clanBreadcrumb').textContent = currentClan.name;
      showTab('pelada');
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => { if (currentTab === 'pelada') refreshPartida(); }, 4000);
    }

    function voltarParaClanList() {
      if (pollTimer) clearInterval(pollTimer);
      currentClan = null;
      document.getElementById('clanDetailView').style.display = 'none';
      document.getElementById('clanListView').style.display = 'block';
      loadClans();
    }

    function showTab(tab, skipLoad) {
      currentTab = tab;
      document.getElementById('tabPelada').classList.toggle('active', tab === 'pelada');
      document.getElementById('tabChamar').classList.toggle('active', tab === 'chamar');
      document.getElementById('tabElenco').classList.toggle('active', tab === 'elenco');
      document.getElementById('tabHistorico').classList.toggle('active', tab === 'historico');
      document.getElementById('tabPerfil').classList.toggle('active', tab === 'perfil');
      document.getElementById('tabRanking').classList.toggle('active', tab === 'ranking');
      document.getElementById('tabStats').classList.toggle('active', tab === 'stats');
      document.getElementById('panelPelada').style.display = tab === 'pelada' ? 'block' : 'none';
      document.getElementById('panelChamar').style.display = tab === 'chamar' ? 'block' : 'none';
      document.getElementById('panelElenco').style.display = tab === 'elenco' ? 'block' : 'none';
      document.getElementById('panelHistorico').style.display = tab === 'historico' ? 'block' : 'none';
      document.getElementById('panelPerfil').style.display = tab === 'perfil' ? 'block' : 'none';
      document.getElementById('panelRanking').style.display = tab === 'ranking' ? 'block' : 'none';
      document.getElementById('panelStats').style.display = tab === 'stats' ? 'block' : 'none';
      if (skipLoad) return;
      if (tab === 'pelada') refreshPartida();
      if (tab === 'chamar') loadChamadas();
      if (tab === 'elenco') loadElenco();
      if (tab === 'historico') loadHistorico();
      if (tab === 'perfil') loadPerfil();
      if (tab === 'ranking') loadRanking();
      if (tab === 'stats') loadClanStats();
    }

    function avatarHtml(url, name, size) {
      const s = size || 28;
      if (url) return '<img src="' + url + '" alt="" style="width:' + s + 'px;height:' + s + 'px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;">';
      const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
      return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + s + 'px;height:' + s + 'px;border-radius:50%;background:#262A40;color:#9aa0c0;font-size:' + Math.round(s*0.45) + 'px;vertical-align:middle;margin-right:6px;">' + letter + '</span>';
    }

    // Badge colorido pra nota (estilo Sofascore/Betano) — mesma faixa que o
    // Discord usa em emoji (notaBand em src/fut/services/pelada.ts), só que
    // aqui como cor de verdade: <6 vermelho, 6-6.9 laranja, 7-7.9 verde, 8+ dourado.
    function notaBadgeHtml(nota) {
      if (nota == null) return '';
      const n = Number(nota);
      let bg = '#e74c3c', fg = '#fff';
      if (n >= 8) { bg = '#f1c40f'; fg = '#1a1a1a'; }
      else if (n >= 7) { bg = '#2ecc71'; fg = '#0a2a12'; }
      else if (n >= 6) { bg = '#f39c12'; fg = '#1a1a1a'; }
      return '<span style="display:inline-block;min-width:32px;padding:2px 6px;border-radius:6px;background:' + bg + ';color:' + fg + ';font-weight:700;font-size:0.78rem;text-align:center;">' + n.toFixed(1) + '</span>';
    }

    function setMode(mode) {
      currentMode = mode;
      if (currentTab === 'perfil') loadPerfil();
      if (currentTab === 'ranking') loadRanking();
    }

    function modeToggleHtml() {
      return \`<div class="mode-toggle">
        <button class="btn \${currentMode === 'futsal' ? '' : 'secondary'}" onclick="setMode('futsal')">Futsal</button>
        <button class="btn \${currentMode === 'campo' ? '' : 'secondary'}" onclick="setMode('campo')">Campo</button>
      </div>\`;
    }

    function playerOptionsHtml(partida) {
      return partida.players.map(p => \`<option value="\${p.discordId || ''}|\${p.displayName}">\${p.displayName}\${p.team ? ' (' + p.team + ')' : ''}</option>\`).join('');
    }

    function parsePlayerValue(val) {
      const [discordId, apelido] = val.split('|');
      return discordId ? { discordId } : { apelido };
    }

    function renderPartida(partida) {
      const panel = document.getElementById('panelPelada');
      if (!partida) {
        panel.innerHTML = \`
          <div class="card">
            <h2>Nenhuma partida em aberto</h2>
            <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:14px;">Crie uma partida pra começar a jogar nesse clã.</p>
            <div class="row">
              <select id="newModo"><option value="futsal">Futsal</option><option value="campo">Campo</option></select>
              <input id="newNome" type="text" placeholder="Nome da partida (opcional)" style="flex:1;min-width:160px;">
              <button class="btn" onclick="criarPartida()">Criar Partida</button>
            </div>
          </div>\`;
        return;
      }

      const timeA = partida.players.filter(p => p.team === 'A');
      const timeB = partida.players.filter(p => p.team === 'B');
      const semTime = partida.players.filter(p => !p.team);
      const souEu = partida.players.some(p => p.discordId === ME_ID);
      const souCriador = partida.creatorId === ME_ID;
      const statusLabel = partida.status === 'aberta' ? '🟡 Aberta' : partida.status === 'em_andamento' ? '🟢 Em andamento' : '🔴 Finalizada';

      function playerRowHtml(p) {
        const notaTxt = (partida.status === 'finalizada' && p.nota != null) ? ' ' + notaBadgeHtml(p.nota) : '';
        return \`<div class="player-row"><span>\${avatarHtml(p.avatarUrl, p.displayName, 22)}\${p.displayName}\${p.position ? ' <small style="color:var(--text-muted);">(' + p.position + ')</small>' : ''}</span><span class="stats">⚽\${p.goals} 🅰️\${p.assists} 🧤\${p.defesas} 🥅\${p.golsConcedidos} ⚠️\${p.errosGraves}\${notaTxt}</span></div>\`;
      }

      let html = \`
        <div class="card">
          <div class="row" style="justify-content:space-between;align-items:center;">
            <h2 style="margin:0;">\${partida.name || 'Partida'} <span class="status-badge \${partida.status}">\${statusLabel}</span></h2>
            \${souCriador && partida.status !== 'finalizada' ? '<button class="btn danger" onclick="deletarPartida()">Deletar</button>' : ''}
          </div>
          <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:10px;">Modo: <strong>\${partida.mode === 'futsal' ? 'Futsal' : 'Campo'}</strong></p>
          <div class="score-big">\${partida.scoreA} x \${partida.scoreB}</div>
          <div class="teams">
            <div class="team-col"><h3>Time A</h3>\${timeA.length ? timeA.map(playerRowHtml).join('') : '<div class="empty-hint" style="padding:10px 0;">vazio</div>'}</div>
            <div class="team-col"><h3>Time B</h3>\${timeB.length ? timeB.map(playerRowHtml).join('') : '<div class="empty-hint" style="padding:10px 0;">vazio</div>'}</div>
          </div>\`;

      if (semTime.length) {
        html += \`<div class="unassigned">\${semTime.map(p => \`
          <span class="chip">\${p.displayName}
            <button onclick="definirTime('\${p.discordId || ''}|\${p.displayName}','A')">→A</button>
            <button onclick="definirTime('\${p.discordId || ''}|\${p.displayName}','B')">→B</button>
          </span>\`).join('')}</div>\`;
      }

      if (partida.status === 'aberta') {
        html += \`<div class="row">\${souEu ? '' : '<button class="btn" onclick="entrarPartida()">Entrar na partida</button>'}<button class="btn secondary" onclick="iniciarPartida()">Iniciar partida</button>\${souCriador ? '<button class="btn secondary" onclick="autoEquilibrar()">🎲 Auto-equilibrar times</button>' : ''}</div>\`;
        html += \`<div class="row"><input id="offlineApelido" type="text" placeholder="Apelido (jogador sem Discord)"><input id="offlinePosicao" type="text" placeholder="Posição (opcional)" style="width:140px;"><button class="btn secondary" onclick="adicionarOffline()">Adicionar</button></div>\`;
      }

      if (partida.status === 'em_andamento') {
        html += \`
          <div class="row">
            <select id="eventPlayer">\${playerOptionsHtml(partida)}</select>
            <select id="eventAssist"><option value="">Sem assistência</option>\${playerOptionsHtml(partida)}</select>
          </div>
          <div class="row"><input id="eventVideo" type="text" placeholder="Link do vídeo do gol (opcional)" style="flex:1;min-width:200px;"></div>
          <div class="row">
            <button class="btn" onclick="registrarEvento('gol')">⚽ Gol</button>
            <button class="btn secondary" onclick="registrarEvento('defesa')">🧤 Defesa</button>
            <button class="btn secondary" onclick="registrarEvento('concedido')">🥅 Concedido</button>
            <button class="btn secondary" onclick="registrarEvento('erro')">⚠️ Erro grave</button>
          </div>
          <div class="row">
            <button class="btn secondary" onclick="desfazerEvento()" title="Remove o último evento registrado, em caso de engano">↩️ Desfazer último evento</button>
            <button class="btn danger" onclick="finalizarPartida()">Finalizar partida</button>
          </div>\`;
      }

      if (partida.status === 'finalizada') {
        const resLabel = partida.resultado === 'empate' ? 'Empate' : partida.resultado === 'vitoria_a' ? 'Vitória do Time A' : 'Vitória do Time B';
        html += \`<p style="text-align:center;color:var(--text-muted);">\${resLabel} — estatísticas salvas em \${partida.mode}. Crie uma nova partida quando quiser.</p>
          <div class="row" style="justify-content:center;">
            \${souCriador ? '<button class="btn secondary" onclick="reabrirPartida(\\''+partida.id+'\\')" title="Corrigir gols, estatísticas ou resultado dessa partida">✏️ Reabrir pra editar</button>' : ''}
            <button class="btn secondary" onclick="abrirDetalhesPartida('\${partida.id}')">📋 Ver detalhes / animação dos gols</button>
            <button class="btn" onclick="criarPartida()">Criar nova partida</button>
          </div>\`;
      }

      if (partida.status !== 'aberta') {
        html += \`<div class="row" style="justify-content:center;margin-top:8px;">
          <button class="btn secondary" onclick="verVideosGol()">🎬 Vídeos de gol</button>
        </div><div id="videosGolBox"></div>\`;
      }

      html += '</div>';
      panel.innerHTML = html;
    }

    async function verVideosGol() {
      const box = document.getElementById('videosGolBox');
      if (!box) return;
      box.innerHTML = '<div class="empty-hint">Carregando...</div>';
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/gols');
        if (!data.videos.length) { box.innerHTML = '<div class="empty-hint">Nenhum gol com vídeo salvo ainda.</div>'; return; }
        box.innerHTML = '<div class="unassigned">' + data.videos.map(v => \`<span class="chip">🎬 \${v.displayName} — <a href="\${v.videoUrl}" target="_blank" rel="noopener">assistir</a></span>\`).join('') + '</div>';
      } catch (e) { box.innerHTML = '<div class="empty-hint">❌ ' + e.message + '</div>'; }
    }

    async function refreshPartida() {
      if (!currentClan) return;
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/partida');
        renderPartida(data.partida);
      } catch (e) { /* silencioso no polling */ }
    }

    async function criarPartida() {
      const modo = document.getElementById('newModo') ? document.getElementById('newModo').value : 'futsal';
      const nome = document.getElementById('newNome') ? document.getElementById('newNome').value : '';
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/partida', { method: 'POST', body: JSON.stringify({ modo, nome }) });
        showToast('✅ Partida criada!');
        refreshPartida();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function deletarPartida() {
      if (!confirm('Deletar a partida em aberto?')) return;
      try { await api('/api/activities/fut/clans/' + currentClan.id + '/partida', { method: 'DELETE' }); showToast('🗑️ Partida deletada.'); refreshPartida(); }
      catch (e) { showToast('❌ ' + e.message); }
    }

    async function entrarPartida() {
      try { await api('/api/activities/fut/clans/' + currentClan.id + '/join-partida', { method: 'POST', body: '{}' }); showToast('✅ Você entrou!'); refreshPartida(); }
      catch (e) { showToast('❌ ' + e.message); }
    }

    async function adicionarOffline() {
      const apelido = document.getElementById('offlineApelido').value.trim();
      const posicao = document.getElementById('offlinePosicao').value.trim();
      if (!apelido) return;
      try { await api('/api/activities/fut/clans/' + currentClan.id + '/add-offline', { method: 'POST', body: JSON.stringify({ apelido, posicao }) }); showToast('✅ Jogador adicionado!'); refreshPartida(); }
      catch (e) { showToast('❌ ' + e.message); }
    }

    async function definirTime(val, team) {
      const ref = parsePlayerValue(val);
      try { await api('/api/activities/fut/clans/' + currentClan.id + '/team', { method: 'POST', body: JSON.stringify(Object.assign({ team }, ref)) }); refreshPartida(); }
      catch (e) { showToast('❌ ' + e.message); }
    }

    async function iniciarPartida() {
      try { await api('/api/activities/fut/clans/' + currentClan.id + '/start', { method: 'POST', body: '{}' }); showToast('✅ Partida iniciada!'); refreshPartida(); }
      catch (e) { showToast('❌ ' + e.message); }
    }

    async function autoEquilibrar() {
      try { await api('/api/activities/fut/clans/' + currentClan.id + '/auto-balance', { method: 'POST', body: '{}' }); showToast('🎲 Times equilibrados pelo XP de cada um!'); refreshPartida(); }
      catch (e) { showToast('❌ ' + e.message); }
    }

    async function registrarEvento(type) {
      const playerVal = document.getElementById('eventPlayer').value;
      const assistVal = document.getElementById('eventAssist').value;
      if (!playerVal) return showToast('❌ Escolha um jogador.');
      const ref = parsePlayerValue(playerVal);
      const body = { type, discordId: ref.discordId, apelido: ref.apelido };
      if (type === 'gol') {
        if (assistVal) {
          const assistRef = parsePlayerValue(assistVal);
          body.assistDiscordId = assistRef.discordId;
          body.assistApelido = assistRef.apelido;
        }
        const videoEl = document.getElementById('eventVideo');
        if (videoEl && videoEl.value.trim()) body.videoUrl = videoEl.value.trim();
      }
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/event', { method: 'POST', body: JSON.stringify(body) });
        showToast(type === 'gol' ? '✅ Gol registrado! Monte a animação dele depois, em "Ver detalhes".' : '✅ Evento registrado!');
        refreshPartida();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function desfazerEvento() {
      if (!confirm('Desfazer o último evento registrado nessa partida?')) return;
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/event/undo', { method: 'POST', body: '{}' });
        showToast('↩️ Desfeito: ' + (data.desfeito ? data.desfeito.type + ' de ' + data.desfeito.displayName : 'último evento') + '.');
        renderPartida(data.partida);
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function reabrirPartida(partidaId) {
      if (!confirm('Reabrir essa partida pra editar? As estatísticas dela serão revertidas do clã até você finalizar de novo.')) return;
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/partidas/' + partidaId + '/reopen', { method: 'POST', body: '{}' });
        showToast('✏️ Partida reaberta! Edite o que precisar e finalize de novo quando terminar.');
        renderPartida(data.partida);
        showTab('pelada');
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function finalizarPartida() {
      if (!confirm('Finalizar a partida e salvar as estatísticas de todo mundo?')) return;
      try { const data = await api('/api/activities/fut/clans/' + currentClan.id + '/finish', { method: 'POST', body: '{}' }); showToast('🏁 Partida finalizada!'); renderPartida(data.partida); }
      catch (e) { showToast('❌ ' + e.message); }
    }

    // ── Histórico: lista clicável de partidas finalizadas ────────────────
    async function loadHistorico() {
      const panel = document.getElementById('panelHistorico');
      panel.innerHTML = '<div class="empty-hint">Carregando...</div>';
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/historico');
        if (!data.partidas.length) { panel.innerHTML = '<div class="card"><div class="empty-hint">Nenhuma partida finalizada nesse clã ainda.</div></div>'; return; }
        panel.innerHTML = '<div class="card"><h2>📜 Histórico</h2><p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">Clique numa partida pra ver detalhes, editar ou montar a animação dos gols.</p>' + data.partidas.map(p => {
          const resLabel = p.resultado === 'empate' ? 'Empate' : p.resultado === 'vitoria_a' ? 'Vitória do Time A' : 'Vitória do Time B';
          return \`<div class="rank-item" style="cursor:pointer;" onclick="abrirDetalhesPartida('\${p.id}')">
            <span>\${p.name || 'Partida'} <span class="status-badge" style="text-transform:capitalize;">\${p.mode}</span></span>
            <span>\${p.scoreA} x \${p.scoreB} — \${resLabel} ›</span>
          </div>\`;
        }).join('') + '</div>';
      } catch (e) { panel.innerHTML = '<div class="card"><div class="empty-hint">❌ ' + e.message + '</div></div>'; }
    }

    // Detalhe de uma partida específica (aberta, em andamento ou finalizada):
    // estatísticas completas, play-by-play e, por gol, o editor de animação.
    async function abrirDetalhesPartida(partidaId) {
      showTab('historico', true);
      const panel = document.getElementById('panelHistorico');
      panel.innerHTML = '<div class="empty-hint">Carregando...</div>';
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/partidas/' + partidaId);
        const partida = data.partida;
        const souCriador = partida.creatorId === ME_ID;
        const resLabel = partida.resultado === 'empate' ? 'Empate' : partida.resultado === 'vitoria_a' ? 'Vitória do Time A' : partida.resultado === 'vitoria_b' ? 'Vitória do Time B' : '—';
        const timeA = partida.players.filter(p => p.team === 'A');
        const timeB = partida.players.filter(p => p.team === 'B');

        function rowHtml(p) {
          const notaTxt = p.nota != null ? ' ' + notaBadgeHtml(p.nota) : '';
          return \`<div class="player-row"><span>\${avatarHtml(p.avatarUrl, p.displayName, 22)}\${p.displayName}</span><span class="stats">⚽\${p.goals} 🅰️\${p.assists} 🧤\${p.defesas} 🥅\${p.golsConcedidos} ⚠️\${p.errosGraves}\${notaTxt}</span></div>\`;
        }

        const golEvents = data.events.filter(e => e.type === 'gol');
        const eventIcon = { gol: '⚽', assistencia: '🅰️', defesa: '🧤', concedido: '🥅', erro: '⚠️' };
        const eventosHtml = data.events.length ? data.events.map(e => {
          const animBtn = e.type === 'gol' ? '<button class="btn secondary" onclick="abrirAnimacaoGol(\\'' + e.id + '\\')">' + (e.hasAnimation ? '🎬 Ver animação' : '🎬 Montar animação') + '</button>' : '';
          const videoLink = e.videoUrl ? ' <a href="' + e.videoUrl + '" target="_blank" rel="noopener">vídeo</a>' : '';
          return \`<div class="rank-item"><span>\${eventIcon[e.type] || '•'} \${e.displayName}</span><span>\${animBtn}\${videoLink}</span></div>\`;
        }).join('') : '<div class="empty-hint">Nenhum evento registrado.</div>';

        panel.innerHTML = \`
          <div class="crumb"><button onclick="loadHistorico()">← Histórico</button></div>
          <div class="card">
            <h2>\${partida.name || 'Partida'} <span class="status-badge \${partida.status}">\${partida.status === 'finalizada' ? '🔴 Finalizada' : partida.status === 'em_andamento' ? '🟢 Em andamento' : '🟡 Aberta'}</span></h2>
            <p style="color:var(--text-muted);font-size:0.82rem;">Modo: <strong>\${partida.mode === 'futsal' ? 'Futsal' : 'Campo'}</strong>\${partida.status === 'finalizada' ? ' · ' + resLabel : ''}</p>
            <div class="score-big">\${partida.scoreA} x \${partida.scoreB}</div>
            <div class="teams">
              <div class="team-col"><h3>Time A</h3>\${timeA.length ? timeA.map(rowHtml).join('') : '<div class="empty-hint">vazio</div>'}</div>
              <div class="team-col"><h3>Time B</h3>\${timeB.length ? timeB.map(rowHtml).join('') : '<div class="empty-hint">vazio</div>'}</div>
            </div>
            \${souCriador ? \`<div class="row" style="justify-content:center;margin-top:10px;"><button class="btn secondary" onclick="reabrirPartida('\${partida.id}')">✏️ Reabrir pra editar (gols/estatísticas/resultado)</button></div>\` : ''}
          </div>
          <div class="card">
            <h2>📋 Eventos da partida</h2>
            \${eventosHtml}
          </div>
          <div id="animEditorCard"></div>\`;
      } catch (e) { panel.innerHTML = '<div class="card"><div class="empty-hint">❌ ' + e.message + '</div></div>'; }
    }

    // ── Editor de animação do gol: frames arrastáveis (bola, jogadores,
    // seta de direção) montados no PÓS-PARTIDA. Cada frame é uma "foto" da
    // jogada; reproduzindo os frames em sequência, vira a animação. ───────
    let animEventId = null;
    let animFrames = [[]];
    let animFrameIdx = 0;
    let animSelectedId = null;
    let animSouCriador = false;
    let animPlaying = false;

    const ANIM_TOKEN_LABEL = { bola: '⚽', jogadorA: '🟡', jogadorB: '🔵', seta: '➡️' };

    async function abrirAnimacaoGol(eventId) {
      const card = document.getElementById('animEditorCard');
      if (!card) return;
      card.innerHTML = '<div class="card"><div class="empty-hint">Carregando...</div></div>';
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/events/' + eventId + '/animation');
        animEventId = eventId;
        animFrames = (data.frames && data.frames.length) ? data.frames : [[]];
        animFrameIdx = 0;
        animSelectedId = null;
        animSouCriador = !!data.souCriador;
        renderAnimEditor(data.displayName);
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { card.innerHTML = '<div class="card"><div class="empty-hint">❌ ' + e.message + '</div></div>'; }
    }

    function renderAnimEditor(displayName) {
      const card = document.getElementById('animEditorCard');
      if (!card) return;
      card.innerHTML = \`
        <div class="card">
          <h2>🎬 Animação do gol — \${displayName}</h2>
          <p style="color:var(--text-muted);font-size:0.8rem;">\${animSouCriador ? 'Arraste os itens pro campo pra montar o frame atual. Arraste um item já colocado pra reposicionar. Clique 2x nele pra remover. Clique 1x numa seta pra ajustar o ângulo.' : 'Modo visualização — só quem criou a partida pode editar.'}</p>
          <div class="row" style="align-items:flex-start;gap:20px;flex-wrap:wrap;">
            <div>
              <div id="animPitch" style="position:relative;width:300px;height:190px;background:#12331f;border-radius:8px;border:2px solid #3a6b4a;overflow:hidden;"
                   ondragover="animAllowDrop(event)" ondrop="animDrop(event)">
                <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:#3a6b4a;"></div>
                <div style="position:absolute;right:0;top:30%;bottom:30%;width:14%;border:1px solid #3a6b4a;"></div>
                <div style="position:absolute;left:0;top:30%;bottom:30%;width:14%;border:1px solid #3a6b4a;"></div>
              </div>
              \${animSouCriador ? \`<div class="row" style="margin-top:8px;">
                <span class="chip" draggable="true" ondragstart="animDragStart(event,'bola')" title="Arraste pro campo">⚽ Bola</span>
                <span class="chip" draggable="true" ondragstart="animDragStart(event,'jogadorA')" title="Arraste pro campo">🟡 Jogador A</span>
                <span class="chip" draggable="true" ondragstart="animDragStart(event,'jogadorB')" title="Arraste pro campo">🔵 Jogador B</span>
                <span class="chip" draggable="true" ondragstart="animDragStart(event,'seta')" title="Arraste pro campo">➡️ Direção</span>
              </div>\` : ''}
            </div>
            <div style="min-width:200px;">
              <p style="font-size:0.82rem;">Frame <strong id="animFrameIdx">1</strong> / <strong id="animFrameTotal">1</strong></p>
              <div class="row">
                <button class="btn secondary" onclick="animPrevFrame()">◀</button>
                <button class="btn secondary" onclick="animNextFrame()">▶</button>
                \${animSouCriador ? '<button class="btn secondary" onclick="animAddFrame()">+ Frame</button>' : ''}
                \${animSouCriador ? '<button class="btn danger" onclick="animDeleteFrame()">🗑️</button>' : ''}
              </div>
              <div class="row">
                <button class="btn secondary" onclick="animPlay()">▶️ Reproduzir</button>
                \${animSouCriador ? '<button class="btn" onclick="animSave()">💾 Salvar</button>' : ''}
              </div>
              <div class="row" id="animAngleRow" style="display:none;align-items:center;">
                <label style="font-size:0.75rem;color:var(--text-muted);">Ângulo da seta:</label>
                <input id="animAngleInput" type="range" min="0" max="359" oninput="animSetAngle(this.value)" style="flex:1;">
              </div>
            </div>
          </div>
        </div>\`;
      renderAnimFrame();
    }

    function renderAnimFrame() {
      const pitch = document.getElementById('animPitch');
      const idxEl = document.getElementById('animFrameIdx');
      const totalEl = document.getElementById('animFrameTotal');
      if (!pitch) return;
      if (idxEl) idxEl.textContent = String(animFrameIdx + 1);
      if (totalEl) totalEl.textContent = String(animFrames.length);

      // Remove tokens antigos (mantém as linhas de fundo do campo, que são
      // os 3 primeiros filhos fixos criados no renderAnimEditor).
      Array.from(pitch.querySelectorAll('.anim-token')).forEach(el => el.remove());

      const frame = animFrames[animFrameIdx] || [];
      frame.forEach(tok => {
        const el = document.createElement('div');
        el.className = 'anim-token';
        el.draggable = animSouCriador;
        el.style.cssText = 'position:absolute;transform:translate(-50%,-50%) rotate(' + (tok.type === 'seta' ? tok.angle : 0) + 'deg);left:' + tok.x + '%;top:' + tok.y + '%;font-size:20px;cursor:' + (animSouCriador ? 'grab' : 'default') + ';user-select:none;';
        el.textContent = ANIM_TOKEN_LABEL[tok.type] || '⚽';
        el.title = tok.type;
        if (animSouCriador) {
          el.addEventListener('dragstart', (ev) => animDragStart(ev, null, tok.id));
          el.addEventListener('click', (ev) => { ev.stopPropagation(); animSelectToken(tok.id); });
          el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); animRemoveToken(tok.id); });
        }
        pitch.appendChild(el);
      });
    }

    function animAllowDrop(ev) { ev.preventDefault(); }

    function animDragStart(ev, newType, existingId) {
      const payload = existingId ? { id: existingId } : { type: newType };
      ev.dataTransfer.setData('text/plain', JSON.stringify(payload));
    }

    function animDrop(ev) {
      ev.preventDefault();
      if (!animSouCriador) return;
      const pitch = document.getElementById('animPitch');
      const rect = pitch.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      let data;
      try { data = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (e) { return; }

      const frame = animFrames[animFrameIdx];
      if (data.id) {
        const tok = frame.find(t => t.id === data.id);
        if (tok) { tok.x = x; tok.y = y; }
      } else {
        frame.push({ id: Math.random().toString(36).slice(2, 10), type: data.type, x, y, angle: 0 });
      }
      renderAnimFrame();
    }

    function animSelectToken(id) {
      animSelectedId = id;
      const frame = animFrames[animFrameIdx];
      const tok = frame.find(t => t.id === id);
      const row = document.getElementById('animAngleRow');
      if (tok && tok.type === 'seta') {
        row.style.display = 'flex';
        document.getElementById('animAngleInput').value = tok.angle;
      } else if (row) {
        row.style.display = 'none';
      }
    }

    function animSetAngle(val) {
      const frame = animFrames[animFrameIdx];
      const tok = frame.find(t => t.id === animSelectedId);
      if (tok) { tok.angle = Number(val); renderAnimFrame(); }
    }

    function animRemoveToken(id) {
      animFrames[animFrameIdx] = animFrames[animFrameIdx].filter(t => t.id !== id);
      renderAnimFrame();
    }

    function animPrevFrame() { if (animFrameIdx > 0) { animFrameIdx--; renderAnimFrame(); } }
    function animNextFrame() { if (animFrameIdx < animFrames.length - 1) { animFrameIdx++; renderAnimFrame(); } }

    function animAddFrame() {
      if (!animSouCriador) return;
      const copy = (animFrames[animFrameIdx] || []).map(t => Object.assign({}, t));
      animFrames.splice(animFrameIdx + 1, 0, copy);
      animFrameIdx++;
      renderAnimFrame();
    }

    function animDeleteFrame() {
      if (!animSouCriador || animFrames.length <= 1) return;
      animFrames.splice(animFrameIdx, 1);
      animFrameIdx = Math.max(0, animFrameIdx - 1);
      renderAnimFrame();
    }

    function animPlay() {
      if (animPlaying || animFrames.length < 2) { renderAnimFrame(); return; }
      animPlaying = true;
      const original = animFrameIdx;
      let i = 0;
      const timer = setInterval(() => {
        animFrameIdx = i;
        renderAnimFrame();
        i++;
        if (i >= animFrames.length) {
          clearInterval(timer);
          animPlaying = false;
          animFrameIdx = original;
          renderAnimFrame();
        }
      }, 700);
    }

    async function animSave() {
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/events/' + animEventId + '/animation', { method: 'POST', body: JSON.stringify({ frames: animFrames }) });
        animFrames = data.frames;
        showToast('💾 Animação salva!');
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function loadPerfil() {
      const panel = document.getElementById('panelPerfil');
      panel.innerHTML = modeToggleHtml() + '<div class="empty-hint">Carregando...</div>';
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/profile?mode=' + currentMode);
        const posicao = data.posicao || 'Não definida';
        if (!data.profile) {
          panel.innerHTML = modeToggleHtml() + '<div class="card"><h2>Suas estatísticas (' + currentMode + ')</h2><table class="stats-table"><tr><td>Posição</td><td style="text-align:right;">' + posicao + '</td></tr></table><div class="empty-hint" style="margin-top:10px;">Você ainda não finalizou nenhuma partida de ' + currentMode + ' nesse clã.</div></div>';
          return;
        }
        const p = data.profile;
        panel.innerHTML = modeToggleHtml() + \`
          <div class="card">
            <h2>Suas estatísticas (\${currentMode})</h2>
            <table class="stats-table">
              <tr><td>Posição</td><td style="text-align:right;">\${posicao}</td></tr>
              <tr><td>Nota média</td><td style="text-align:right;">\${notaBadgeHtml(p.notaMedia)}</td></tr>
              <tr><td>Partidas</td><td style="text-align:right;">\${p.totalPartidas}</td></tr>
              <tr><td>Vitórias / Derrotas / Empates</td><td style="text-align:right;">\${p.vitorias} / \${p.derrotas} / \${p.empates}</td></tr>
              <tr><td>XP</td><td style="text-align:right;">\${p.xp}</td></tr>
              <tr><td>Gols</td><td style="text-align:right;">\${p.goals}</td></tr>
              <tr><td>Assistências</td><td style="text-align:right;">\${p.assists}</td></tr>
              <tr><td>Defesas</td><td style="text-align:right;">\${p.defesas}</td></tr>
              <tr><td>Gols Concedidos</td><td style="text-align:right;">\${p.golsConcedidos}</td></tr>
              <tr><td>Erros Graves</td><td style="text-align:right;">\${p.errosGraves}</td></tr>
            </table>
          </div>\`;
      } catch (e) { panel.innerHTML = modeToggleHtml() + '<div class="card"><div class="empty-hint">❌ ' + e.message + '</div></div>'; }
    }

    async function loadRanking() {
      const panel = document.getElementById('panelRanking');
      panel.innerHTML = modeToggleHtml() + '<div class="empty-hint">Carregando...</div>';
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/ranking?mode=' + currentMode);
        if (!data.ranking.length) { panel.innerHTML = modeToggleHtml() + '<div class="card"><div class="empty-hint">Ninguém finalizou uma partida de ' + currentMode + ' ainda.</div></div>'; return; }
        panel.innerHTML = modeToggleHtml() + '<div class="card"><h2>🏆 Ranking (' + currentMode + ')</h2>' + data.ranking.map((p, i) => \`
          <div class="rank-item"><span>\${i + 1}. \${avatarHtml(p.avatarUrl, p.displayName, 24)}\${p.displayName}</span><span>\${p.xp} XP · \${notaBadgeHtml(p.notaMedia)}</span></div>\`).join('') + '</div>';
      } catch (e) { panel.innerHTML = modeToggleHtml() + '<div class="card"><div class="empty-hint">❌ ' + e.message + '</div></div>'; }
    }

    // ── Estatísticas do clã inteiro (agregado) + elenco completo ─────────
    // (item: "salvar tanto os da pelada inteira quanto individualmente,
    // mostrando a de todo o elenco" — sem limite de top-N como o Ranking).
    async function loadClanStats() {
      const panel = document.getElementById('panelStats');
      panel.innerHTML = modeToggleHtml() + '<div class="empty-hint">Carregando...</div>';
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/overview?mode=' + currentMode);
        const o = data.overview;
        if (!o.totalJogadores) {
          panel.innerHTML = modeToggleHtml() + '<div class="card"><div class="empty-hint">Ninguém finalizou uma partida de ' + currentMode + ' nesse clã ainda.</div></div>';
          return;
        }
        let html = modeToggleHtml() + \`
          <div class="card">
            <h2>📊 Visão geral do clã (\${currentMode})</h2>
            <table class="stats-table">
              <tr><td>Partidas finalizadas</td><td style="text-align:right;">\${o.totalPartidas}</td></tr>
              <tr><td>Jogadores com estatísticas</td><td style="text-align:right;">\${o.totalJogadores}</td></tr>
              <tr><td>Vitórias / Derrotas / Empates (somado)</td><td style="text-align:right;">\${o.totalVitorias} / \${o.totalDerrotas} / \${o.totalEmpates}</td></tr>
              <tr><td>Gols do elenco</td><td style="text-align:right;">\${o.totalGols}</td></tr>
              <tr><td>Assistências do elenco</td><td style="text-align:right;">\${o.totalAssists}</td></tr>
              <tr><td>Defesas do elenco</td><td style="text-align:right;">\${o.totalDefesas}</td></tr>
              <tr><td>Gols concedidos</td><td style="text-align:right;">\${o.totalConcedidos}</td></tr>
              <tr><td>Erros graves</td><td style="text-align:right;">\${o.totalErros}</td></tr>
            </table>\`;
        if (o.artilheiro) html += \`<p style="margin-top:10px;">👑 <strong>Artilheiro:</strong> \${avatarHtml(o.artilheiro.avatarUrl, o.artilheiro.displayName, 20)}\${o.artilheiro.displayName} — \${o.artilheiro.goals} gols</p>\`;
        if (o.garcom) html += \`<p>🎯 <strong>Garçom:</strong> \${avatarHtml(o.garcom.avatarUrl, o.garcom.displayName, 20)}\${o.garcom.displayName} — \${o.garcom.assists} assists</p>\`;
        if (o.melhorNota) html += \`<p>⭐ <strong>Melhor nota média:</strong> \${avatarHtml(o.melhorNota.avatarUrl, o.melhorNota.displayName, 20)}\${o.melhorNota.displayName} — \${notaBadgeHtml(o.melhorNota.notaMedia)}</p>\`;
        html += '</div>';

        html += '<div class="card"><h2>👥 Elenco completo (' + data.elenco.length + ')</h2><table class="stats-table"><tr><td><strong>Jogador</strong></td><td style="text-align:right;"><strong>Nota</strong></td><td style="text-align:right;"><strong>J</strong></td><td style="text-align:right;"><strong>⚽</strong></td><td style="text-align:right;"><strong>🅰️</strong></td><td style="text-align:right;"><strong>🧤</strong></td><td style="text-align:right;"><strong>🥅</strong></td><td style="text-align:right;"><strong>⚠️</strong></td><td style="text-align:right;"><strong>XP</strong></td></tr>' +
          data.elenco.map(p => \`<tr>
            <td>\${avatarHtml(p.avatarUrl, p.displayName, 20)}\${p.displayName}</td>
            <td style="text-align:right;">\${notaBadgeHtml(p.notaMedia)}</td>
            <td style="text-align:right;">\${p.totalPartidas}</td>
            <td style="text-align:right;">\${p.goals}</td>
            <td style="text-align:right;">\${p.assists}</td>
            <td style="text-align:right;">\${p.defesas}</td>
            <td style="text-align:right;">\${p.golsConcedidos}</td>
            <td style="text-align:right;">\${p.errosGraves}</td>
            <td style="text-align:right;">\${p.xp}</td>
          </tr>\`).join('') + '</table></div>';

        panel.innerHTML = html;
      } catch (e) { panel.innerHTML = modeToggleHtml() + '<div class="card"><div class="empty-hint">❌ ' + e.message + '</div></div>'; }
    }

    // ── Elenco: times internos e fixos do clã ────────────────────────────
    async function loadElenco() {
      const panel = document.getElementById('panelElenco');
      panel.innerHTML = '<div class="empty-hint">Carregando...</div>';
      try {
        const [teamsData] = await Promise.all([api('/api/activities/fut/clans/' + currentClan.id + '/teams')]);
        renderElenco(teamsData.teams);
      } catch (e) { panel.innerHTML = '<div class="card"><div class="empty-hint">❌ ' + e.message + '</div></div>'; }
    }

    function renderElenco(teams) {
      const panel = document.getElementById('panelElenco');
      const souCriador = currentClan.creatorId === ME_ID;
      const todosMembros = currentClan.members || [];
      const idsComTime = new Set();
      teams.forEach(t => t.members.forEach(m => idsComTime.add(m.id)));
      const semTime = todosMembros.filter(m => !idsComTime.has(m.id));

      const teamOptionsHtml = '<option value="">Sem time</option>' + teams.map(t => \`<option value="\${t.id}">\${t.name}</option>\`).join('');

      function memberChipHtml(m) {
        const ehCriador = m.discordId && m.discordId === currentClan.creatorId;
        return \`<span class="chip">\${avatarHtml(m.avatarUrl, m.displayName, 20)}\${m.displayName}
          \${souCriador ? \`<select onchange="definirElenco(this.value, '\${m.discordId || ''}', '\${m.displayName}')" style="margin-left:6px;">\${teamOptionsHtml}</select>\` : ''}
          \${souCriador && !ehCriador ? \`<button class="btn danger" style="padding:2px 8px;margin-left:4px;" onclick="removerMembro('\${m.id}')" title="Remover do elenco">✕</button>\` : ''}
        </span>\`;
      }

      let html = '<div class="card"><div class="row" style="justify-content:space-between;align-items:center;"><h2 style="margin:0;">👕 Elenco</h2></div>';
      html += '<p style="color:var(--text-muted);font-size:0.85rem;">Todo mundo que faz parte do clã (' + todosMembros.length + ' no total).</p>';

      if (souCriador) {
        html += \`<div class="card" style="background:rgba(255,255,255,0.03);margin:10px 0 16px;">
          <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;">➕ Adicionar alguém direto no elenco — o clã ser público é só pra visibilidade, não bota ninguém aqui sozinho.</p>
          <div class="row">
            <input id="newMemberNome" type="text" placeholder="Nome da pessoa" style="flex:1;min-width:140px;">
            <input id="newMemberId" type="text" placeholder="ID do Discord (opcional)" style="width:180px;">
            <button class="btn" onclick="adicionarMembro()">Adicionar</button>
          </div>
          <p style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Pra pegar o ID: ative o Modo Desenvolvedor no Discord, clique com o botão direito na pessoa e "Copiar ID". Sem ID, a pessoa entra só com o nome (sem conta vinculada).</p>
        </div>\`;
      }

      html += '<div class="unassigned" style="margin-bottom:14px;">' + (todosMembros.length ? todosMembros.map(memberChipHtml).join('') : '<span class="empty-hint">Ninguém no elenco ainda.</span>') + '</div>';
      html += '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:14px;">Times fixos do clã (diferente do time A/B de uma partida específica).</p>';

      if (souCriador) {
        html += \`<div class="row"><input id="newTeamName" type="text" placeholder="Nome do time (ex: Amarelo)"><input id="newTeamColor" type="text" placeholder="Cor (opcional)" style="width:140px;"><button class="btn" onclick="criarElencoTime()">Criar time</button></div>\`;
      }

      if (!teams.length) {
        html += '<div class="empty-hint" style="margin-top:10px;">Nenhum time interno ainda.</div>';
      } else {
        for (const t of teams) {
          html += \`<div class="team-col" style="margin-top:14px;">
            <div class="row" style="justify-content:space-between;align-items:center;">
              <h3 style="margin:0;">\${t.name}\${t.color ? ' <small style="color:var(--text-muted);">(' + t.color + ')</small>' : ''}</h3>
              \${souCriador ? \`<button class="btn danger" onclick="deletarElencoTime('\${t.id}','\${t.name}')">Deletar</button>\` : ''}
            </div>
            <div class="unassigned" style="margin-top:8px;">\${t.members.length ? t.members.map(memberChipHtml).join('') : '<span class="empty-hint">vazio</span>'}</div>
          </div>\`;
        }
      }

      if (semTime.length) {
        html += \`<h3 style="margin-top:14px;">Sem time</h3><div class="unassigned">\${semTime.map(memberChipHtml).join('')}</div>\`;
      }

      html += '</div>';
      panel.innerHTML = html;
    }

    // Recarrega a lista de clãs e atualiza a referência local (currentClan),
    // sem trocar de tela — usado depois de ações que mudam o elenco.
    async function refreshCurrentClan() {
      if (!currentClan) return;
      try {
        const data = await api('/api/activities/fut/clans');
        clans = data.clans;
        clanSlots = { total: data.totalClans ?? clans.length, max: data.maxClans ?? 3 };
        currentClan = clans.find(c => c.id === currentClan.id) || currentClan;
      } catch (e) { /* silencioso */ }
    }

    async function adicionarMembro() {
      const nome = document.getElementById('newMemberNome').value.trim();
      const idDiscord = document.getElementById('newMemberId').value.trim();
      if (!nome) return showToast('❌ Informe um nome.');
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/members', { method: 'POST', body: JSON.stringify({ displayName: nome, discordId: idDiscord || undefined }) });
        document.getElementById('newMemberNome').value = '';
        document.getElementById('newMemberId').value = '';
        showToast('✅ ' + nome + ' entrou no elenco!');
        await refreshCurrentClan();
        loadElenco();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function removerMembro(memberId) {
      const membro = (currentClan.members || []).find(m => m.id === memberId);
      const nome = membro ? membro.displayName : 'essa pessoa';
      if (!confirm('Remover ' + nome + ' do elenco?')) return;
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/members/' + memberId, { method: 'DELETE' });
        showToast('🗑️ ' + nome + ' removido(a) do elenco.');
        await refreshCurrentClan();
        loadElenco();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function criarElencoTime() {
      const name = document.getElementById('newTeamName').value.trim();
      const color = document.getElementById('newTeamColor').value.trim();
      if (!name) return;
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/teams', { method: 'POST', body: JSON.stringify({ name, color }) });
        showToast('✅ Time criado!');
        loadElenco();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function deletarElencoTime(teamId, name) {
      if (!confirm('Deletar o time "' + name + '"?')) return;
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/teams/' + teamId, { method: 'DELETE' });
        showToast('🗑️ Time deletado.');
        loadElenco();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function definirElenco(teamId, discordId, displayName) {
      try {
        const body = { teamId: teamId || null };
        if (discordId) body.discordId = discordId; else body.apelido = displayName;
        await api('/api/activities/fut/clans/' + currentClan.id + '/members/team', { method: 'POST', body: JSON.stringify(body) });
        showToast('✅ Elenco atualizado!');
        loadElenco();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    // ── Chamar o fut: convite (local, horário, PIX, link) + RSVP ─────────
    async function loadChamadas() {
      const panel = document.getElementById('panelChamar');
      panel.innerHTML = '<div class="empty-hint">Carregando...</div>';
      try {
        const data = await api('/api/activities/fut/clans/' + currentClan.id + '/chamadas');
        renderChamadas(data.chamadas);
      } catch (e) { panel.innerHTML = '<div class="card"><div class="empty-hint">❌ ' + e.message + '</div></div>'; }
    }

    function renderChamadas(chamadas) {
      const panel = document.getElementById('panelChamar');
      let html = \`<div class="card">
        <h2>📣 Chamar o fut</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:14px;">Marque local, horário e PIX pra galera confirmar presença.</p>
        <div class="row"><input id="chamarLocal" type="text" placeholder="Local" style="flex:1;min-width:140px;"><input id="chamarHorario" type="text" placeholder="Horário (ex: Hoje 20h)" style="flex:1;min-width:140px;"></div>
        <div class="row"><input id="chamarPix" type="text" placeholder="PIX (opcional)" style="flex:1;min-width:140px;"><input id="chamarLink" type="text" placeholder="Link do grupo (opcional)" style="flex:1;min-width:140px;"></div>
        <div class="row"><input id="chamarMensagem" type="text" placeholder="Mensagem (opcional)" style="flex:1;min-width:200px;"><button class="btn" onclick="criarChamada()">Chamar!</button></div>
      </div>\`;

      if (!chamadas.length) {
        html += '<div class="card"><div class="empty-hint">Nenhuma chamada ainda.</div></div>';
      } else {
        for (const c of chamadas) {
          const meResposta = (c.respostas || []).find(r => r.discordId === ME_ID);
          const vou = (c.respostas || []).filter(r => r.status === 'vou');
          const talvez = (c.respostas || []).filter(r => r.status === 'talvez');
          const naoVou = (c.respostas || []).filter(r => r.status === 'nao_vou');
          html += \`<div class="card" style="margin-top:12px;">
            <div class="row" style="justify-content:space-between;align-items:center;">
              <h3 style="margin:0;">📍 \${c.local} — 🕒 \${c.horario}</h3>
              \${c.creatorId === ME_ID ? '<button class="btn danger" onclick="deletarChamada(\\''+c.id+'\\')">Deletar</button>' : ''}
            </div>
            \${c.mensagem ? '<p style="font-size:0.88rem;">' + c.mensagem + '</p>' : ''}
            \${c.pix ? '<p style="font-size:0.85rem;color:var(--text-muted);">💸 PIX: <strong>' + c.pix + '</strong></p>' : ''}
            \${c.link ? '<p style="font-size:0.85rem;"><a href="' + c.link + '" target="_blank" rel="noopener">🔗 Link do grupo</a></p>' : ''}
            <div class="row">
              <button class="btn \${meResposta && meResposta.status === 'vou' ? '' : 'secondary'}" onclick="rsvpChamada('\${c.id}','vou')">✅ Vou (\${vou.length})</button>
              <button class="btn \${meResposta && meResposta.status === 'talvez' ? '' : 'secondary'}" onclick="rsvpChamada('\${c.id}','talvez')">🤔 Talvez (\${talvez.length})</button>
              <button class="btn \${meResposta && meResposta.status === 'nao_vou' ? '' : 'secondary'}" onclick="rsvpChamada('\${c.id}','nao_vou')">❌ Não vou (\${naoVou.length})</button>
            </div>
            \${vou.length ? '<p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Confirmados: ' + vou.map(r => r.displayName).join(', ') + '</p>' : ''}
          </div>\`;
        }
      }
      panel.innerHTML = html;
    }

    async function criarChamada() {
      const local = document.getElementById('chamarLocal').value.trim();
      const horario = document.getElementById('chamarHorario').value.trim();
      const pix = document.getElementById('chamarPix').value.trim();
      const link = document.getElementById('chamarLink').value.trim();
      const mensagem = document.getElementById('chamarMensagem').value.trim();
      if (!local || !horario) return showToast('❌ Preencha local e horário.');
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/chamadas', { method: 'POST', body: JSON.stringify({ local, horario, pix, link, mensagem }) });
        showToast('📣 Fut chamado!');
        loadChamadas();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function rsvpChamada(chamadaId, status) {
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/chamadas/' + chamadaId + '/rsvp', { method: 'POST', body: JSON.stringify({ status }) });
        loadChamadas();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    async function deletarChamada(chamadaId) {
      if (!confirm('Deletar essa chamada?')) return;
      try {
        await api('/api/activities/fut/clans/' + currentClan.id + '/chamadas/' + chamadaId, { method: 'DELETE' });
        showToast('🗑️ Chamada deletada.');
        loadChamadas();
      } catch (e) { showToast('❌ ' + e.message); }
    }

    (async () => {
      await window.activityReady;
      await Promise.all([loadServers(), loadClans(), loadMinhasPosicoes()]);
    })();
  </script>
</body>
</html>`);
  });

  // ----- RPG: Ficha + Batalha (engine real do jogo) -----
  // ----- RPG: Ficha + Batalha (engine real do jogo, atrás de login do Discord) -----
  app.get('/atividades/rpg', (req, res) => {
    const isLogged = req.cookies?.player_auth === 'permitido' && req.cookies?.player_userid;

    if (!isLogged) {
      return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RPG Skyline — Login</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
${activitySdkBootstrap(clientId!)}
<style>
  :root { --bg: #05050A; --primary: #8B5CF6; --primary2: #C084FC; --card: #12131F; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: radial-gradient(circle at 50% 0%, rgba(139,92,246,0.18), transparent 45%), var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 5%; }
  nav a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
  .brand { font-weight: 800; color: white; }
  .gate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; }
  .gate .icon { font-size: 3.4rem; margin-bottom: 18px; }
  .gate h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 12px; }
  .gate p { color: var(--text-muted); max-width: 420px; margin-bottom: 30px; line-height: 1.5; }
  .discord-btn { display: inline-flex; align-items: center; gap: 10px; background: #5865F2; color: white; text-decoration: none; font-weight: 700; padding: 14px 28px; border-radius: 10px; box-shadow: 0 8px 25px rgba(88,101,242,0.4); transition: 0.2s; }
  .discord-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(88,101,242,0.55); }
  .note { color: var(--text-muted); font-size: 0.8rem; margin-top: 18px; max-width: 380px; }
</style>
</head>
<body>
  <nav><span class="brand">⚔️ RPG Skyline</span><a href="/atividades">← Atividades</a></nav>
  <div class="gate" id="gateBox">
    <div class="icon">🔒</div>
    <h1 id="gateTitle">Entre com sua conta do Discord</h1>
    <p id="gateDesc">Sua ficha de RPG é pessoal — por isso pedimos login com o Discord em vez de um ID digitado, pra garantir que só você veja e jogue com o seu personagem.</p>
    <a class="discord-btn" id="gateBtn" href="/login/player?next=/atividades/rpg">🎮 Entrar com Discord</a>
    <p class="note">Isso não te dá acesso ao painel administrativo do bot — é só pra identificar seu personagem de RPG.</p>
  </div>
  <script>
    // Dentro de uma Discord Activity, não existe redirecionamento de página
    // pro discord.com — a autenticação acontece no bootstrap acima (SDK).
    // Se der certo, só recarrega a página: o servidor já vai ver os cookies.
    window.activityReady.then((authed) => {
      if (window.isDiscordActivity) {
        document.getElementById('gateBtn').style.display = 'none';
        if (authed) {
          document.getElementById('gateTitle').innerText = '✅ Entrando...';
          document.getElementById('gateDesc').innerText = 'Autenticado com sucesso, carregando sua ficha...';
          window.location.reload();
        } else {
          document.getElementById('gateTitle').innerText = '⚠️ Não deu pra autenticar automaticamente';
          document.getElementById('gateDesc').innerText = 'Tenta fechar e abrir a Activity de novo.';
        }
      }
    });
  </script>
</body>
</html>`);
    }

    const username = req.cookies?.player_username || 'Aventureiro';
    const avatarHash = req.cookies?.player_avatar;
    const userId = req.cookies?.player_userid;
    const avatarUrl = avatarHash ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128` : '';

    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RPG Skyline</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --bg: #05050A; --primary: #8B5CF6; --primary2: #C084FC; --card: #12131F; --card2: #191B2B; --border: #262A40; --text: #F2F3F5; --text-muted: #9CA3AF; --green:#2ECC71; --red:#E74C3C; --gold:#F5C242; --orange:#F39C12; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  body { background: radial-gradient(circle at 10% 0%, rgba(139,92,246,0.15), transparent 40%), var(--bg); color: var(--text); min-height: 100vh; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 5%; border-bottom: 1px solid var(--border); }
  nav a { color: var(--text-muted); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
  .brand { font-weight: 800; color: white; }
  .nav-user { display: flex; align-items: center; gap: 10px; }
  .nav-user img { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--primary); }
  .nav-user span { font-weight: 700; font-size: 0.9rem; }
  .nav-user a.logout { color: var(--text-muted); font-size: 0.8rem; border: 1px solid var(--border); padding: 5px 12px; border-radius: 8px; }
  .nav-user a.logout:hover { border-color: var(--red); color: var(--red); }

  .music-widget { position: fixed; bottom: 20px; right: 20px; z-index: 999; background: var(--card); border: 1px solid var(--border); border-radius: 999px; padding: 10px 16px; display: flex; align-items: center; gap: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .music-widget button { background: transparent; border: none; font-size: 1.2rem; cursor: pointer; line-height: 1; }
  .music-widget input[type="range"] { width: 80px; accent-color: var(--primary); cursor: pointer; }
  #wrap { max-width: 980px; margin: 0 auto; padding: 30px 20px 80px; }

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
  .item-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .item-card .qty { color: var(--primary); font-weight: 700; margin-left: auto; }
  .item-actions { display: flex; gap: 6px; width: 100%; margin-top: 6px; }
  .item-actions button { flex: 1; background: var(--card2); border: 1px solid var(--border); color: white; padding: 6px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; }
  .item-actions button:hover { border-color: var(--primary); }
  .item-actions button.sell:hover { border-color: var(--gold); }

  .equip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-bottom: 24px; }
  .equip-slot { background: var(--card); border: 1px dashed var(--border); border-radius: 10px; padding: 12px; font-size: 0.8rem; text-align: center; }
  .equip-slot .slot-name { color: var(--text-muted); font-size: 0.68rem; text-transform: uppercase; margin-bottom: 4px; }
  .equip-slot.filled { border-style: solid; border-color: var(--primary); }

  .tab-nav { display: flex; gap: 8px; margin: 24px 0 18px; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
  .tab-btn { background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 9px 18px; border-radius: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; }
  .tab-btn:hover { color: white; border-color: var(--primary); }
  .tab-btn.active { background: linear-gradient(120deg, var(--primary), var(--primary2)); color: white; border-color: transparent; }

  .action-feedback { padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; margin-bottom: 14px; }
  .action-feedback.ok { background: rgba(46,204,113,0.12); border: 1px solid var(--green); color: var(--green); }
  .action-feedback.fail { background: rgba(231,76,60,0.12); border: 1px solid var(--red); color: var(--red); }

  .cat-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
  .cat-pill { background: var(--card); border: 1px solid var(--border); color: var(--text-muted); padding: 8px 14px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
  .cat-pill:hover, .cat-pill.active { border-color: var(--primary); color: white; }
  .shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .shop-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  .shop-card .name { font-weight: 700; margin-bottom: 4px; }
  .shop-card .desc { color: var(--text-muted); font-size: 0.78rem; margin-bottom: 10px; min-height: 32px; }
  .shop-card .buy-row { display: flex; justify-content: space-between; align-items: center; }
  .shop-card .price { color: var(--gold); font-weight: 800; }
  .shop-card button { background: var(--primary); color: white; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.8rem; }

  .loc-list { display: flex; flex-direction: column; gap: 10px; }
  .loc-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .loc-card.current { border-color: var(--green); }
  .loc-card.locked { opacity: 0.5; }
  .loc-card .info b { font-size: 1rem; }
  .loc-card .info div { color: var(--text-muted); font-size: 0.78rem; margin-top: 3px; }
  .loc-card button { background: var(--primary); color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; }

  .points-banner { background: var(--card); border: 1px solid var(--primary); border-radius: 12px; padding: 16px 20px; margin-bottom: 18px; font-weight: 700; text-align: center; }
  .point-row { display: flex; align-items: center; justify-content: space-between; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-bottom: 10px; }
  .point-row .btns { display: flex; gap: 6px; }
  .point-row button { background: var(--card2); border: 1px solid var(--border); color: white; padding: 6px 12px; border-radius: 6px; font-weight: 700; cursor: pointer; }
  .point-row button:hover { border-color: var(--primary); }

  .btn-again { display: block; margin: 18px auto 0; background: var(--primary); color: white; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 700; cursor: pointer; }

  /* ===== Arena de Batalha ===== */
  .battle-setup { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; margin-bottom: 20px; }
  .battle-setup select { flex: 1; min-width: 200px; background: #0B0C14; border: 1px solid var(--border); color: white; padding: 12px 14px; border-radius: 10px; outline: none; }
  .btn-fight { background: linear-gradient(120deg, var(--primary), var(--primary2)); color: white; border: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .btn-fight:hover { filter: brightness(1.1); }
  .btn-random { background: var(--card2); border: 1px solid var(--border); color: white; padding: 12px 22px; border-radius: 10px; font-weight: 700; cursor: pointer; white-space: nowrap; }

  .arena { display: none; border-radius: 18px; padding: 26px 24px; margin-bottom: 20px; border: 1px solid var(--border); transition: border-color 0.3s, background 0.3s; background: var(--card); }
  .arena.show { display: block; }
  .arena-title { font-weight: 800; font-size: 1rem; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
  .arena-stage { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; padding: 16px 10px 34px; position: relative; }
  .arena-stage::after { content: ''; position: absolute; bottom: 14px; left: 5%; right: 5%; height: 2px; background: linear-gradient(to right, transparent, var(--border), transparent); }
  .combatant { display: flex; flex-direction: column; align-items: center; width: 42%; }
  .sprite { font-size: 4rem; line-height: 1; margin-bottom: 12px; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5)); animation: floatY 3s ease-in-out infinite; }
  .combatant.enemy .sprite { animation-delay: 0.4s; }
  @keyframes floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .combatant-name { font-weight: 800; font-size: 0.95rem; margin-bottom: 8px; }
  .combatant .bars { width: 100%; max-width: 220px; }
  .combatant .bar-row span.tag { width: 26px; flex-shrink:0; font-weight:700; }
  .vs-badge { font-weight: 800; color: var(--text-muted); font-size: 1.3rem; padding-bottom: 46px; }

  .action-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-top: 6px; }
  .action-btn { background: var(--card2); border: 1px solid var(--border); color: white; padding: 14px 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: 0.15s; text-align: center; }
  .action-btn:hover:not(:disabled) { border-color: var(--primary); background: #22243A; transform: translateY(-2px); }
  .action-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .combat-log { background: #0B0C14; border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin-top: 16px; max-height: 220px; overflow-y: auto; font-size: 0.85rem; line-height: 1.6; color: #D5D7E0; }
  .combat-log b { color: white; }
  .combat-log::-webkit-scrollbar { width: 6px; }
  .combat-log::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  .result-banner { text-align: center; padding: 18px; border-radius: 14px; margin-top: 16px; font-weight: 800; font-size: 1.15rem; }
  .result-banner.vitoria { background: rgba(46,204,113,0.12); border: 1px solid var(--green); color: var(--green); }
  .result-banner.derrota { background: rgba(231,76,60,0.12); border: 1px solid var(--red); color: var(--red); }
  .result-banner.fuga, .result-banner.empate { background: rgba(243,156,18,0.1); border: 1px solid var(--orange); color: var(--orange); }
  .reward-fields { display: flex; gap: 10px; justify-content: center; margin-top: 10px; flex-wrap: wrap; }
  .reward-field { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 6px 14px; font-size: 0.85rem; font-weight: 600; color: var(--text); }
  .drop-list { margin-top: 8px; font-size: 0.85rem; color: var(--text-muted); }

  .buff-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
  .buff-chip { background: rgba(139,92,246,0.12); border: 1px solid var(--primary); color: var(--primary2); padding: 6px 12px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; }

  .train-grid, .med-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .train-card, .med-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; text-align: center; }
  .train-card .icon, .med-card .icon { font-size: 1.8rem; margin-bottom: 8px; }
  .train-card .name, .med-card .name { font-weight: 700; margin-bottom: 6px; }
  .train-card .desc, .med-card .desc { color: var(--text-muted); font-size: 0.78rem; min-height: 34px; margin-bottom: 12px; }
  .train-card button, .med-card button { width: 100%; background: var(--primary); color: white; border: none; padding: 9px; border-radius: 8px; font-weight: 700; cursor: pointer; }
  .train-card button:disabled, .med-card button:disabled { opacity: 0.4; cursor: not-allowed; }

  .cooldown-banner { background: rgba(243,156,18,0.1); border: 1px solid var(--orange); color: var(--orange); padding: 12px 16px; border-radius: 10px; font-weight: 700; text-align: center; margin-bottom: 18px; }
  .phase-banner { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; font-size: 0.85rem; color: var(--text-muted); }
  .med-progress { background: var(--card); border: 1px solid var(--primary); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 18px; }
  .btn-collect { background: linear-gradient(120deg, var(--primary), var(--primary2)); color: white; border: none; padding: 12px 30px; border-radius: 10px; font-weight: 800; cursor: pointer; margin-top: 12px; }

  .floor-track { display: flex; gap: 6px; margin-bottom: 20px; }
  .floor-dot { flex: 1; height: 10px; border-radius: 5px; background: var(--border); }
  .floor-dot.done { background: var(--green); }
  .floor-dot.current { background: var(--primary); box-shadow: 0 0 10px var(--primary); }
  .floor-dot.boss { background: var(--red); }
  .dungeon-entrance { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-bottom: 18px; }
  .dungeon-entrance h4 { margin-bottom: 8px; }
  .dungeon-entrance .enemy-chip { display: inline-block; background: var(--card2); border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; margin: 3px 4px 3px 0; font-size: 0.8rem; }
  .btn-enter { background: linear-gradient(120deg, var(--red), var(--orange)); color: white; border: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; cursor: pointer; margin-top: 14px; }
  .btn-enter:disabled { opacity: 0.4; cursor: not-allowed; }
  .crawler-log { background: #0B0C14; border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin-bottom: 18px; font-size: 0.85rem; line-height: 1.7; color: #D5D7E0; max-height: 200px; overflow-y: auto; }
  .crawler-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
  .crawler-actions button { padding: 14px; border-radius: 10px; font-weight: 700; cursor: pointer; border: 1px solid var(--border); }
  .btn-crawl-fight { background: var(--red); color: white; border: none; }
  .btn-crawl-boss { background: linear-gradient(120deg, var(--red), var(--gold)); color: white; border: none; }
  .btn-crawl-event { background: var(--primary); color: white; border: none; }
  .btn-crawl-flee { background: var(--card2); color: white; }

  .city-subnav { display: flex; gap: 10px; margin-bottom: 18px; }
  .city-subnav button { background: var(--card); border: 1px solid var(--border); color: var(--text-muted); padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; }
  .city-subnav button.active { background: linear-gradient(120deg, var(--gold), var(--orange)); color: #1a1200; border-color: transparent; }
  .recipe-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .recipe-card.locked { opacity: 0.55; }
  .recipe-card .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .recipe-card .head b { font-size: 1.05rem; }
  .recipe-card .ing-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .ing-chip { background: #0B0C14; border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; font-size: 0.75rem; }
  .ing-chip.ok { border-color: var(--green); color: var(--green); }
  .ing-chip.bad { border-color: var(--red); color: var(--red); }
  .recipe-card button { background: var(--gold); color: #1a1200; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; }
  .recipe-card button:disabled { opacity: 0.4; cursor: not-allowed; background: var(--border); color: var(--text-muted); }
  .tavern-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px; }
  .tavern-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; }
  .tavern-card .icon { font-size: 1.8rem; margin-bottom: 6px; }
  .tavern-card .desc { color: var(--text-muted); font-size: 0.78rem; min-height: 32px; margin-bottom: 10px; }
  .tavern-card button { width: 100%; background: var(--primary); color: white; border: none; padding: 9px; border-radius: 8px; font-weight: 700; cursor: pointer; }
  .dice-box { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; text-align: center; }
  .btn-dice { background: linear-gradient(120deg, var(--gold), var(--orange)); color: #1a1200; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 800; cursor: pointer; margin-top: 10px; }

  .fish-box { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 26px; text-align: center; }
  .fish-box .icon { font-size: 2.5rem; margin-bottom: 10px; }
  .fish-box .status { font-weight: 700; margin-bottom: 14px; }
  .btn-fish { background: linear-gradient(120deg, #1E90FF, var(--primary2)); color: white; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 800; cursor: pointer; }
  .btn-fish:disabled { opacity: 0.4; cursor: not-allowed; }
  .fish-catch { background: var(--card); border: 1px solid var(--gold); border-radius: 14px; padding: 20px; text-align: center; margin-top: 14px; }

  .mission-section { margin-bottom: 26px; }
  .mission-row { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; }
  .mission-row .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .mission-row .top b { font-size: 0.92rem; }
  .mission-row .reward { font-size: 0.75rem; color: var(--gold); font-weight: 700; }
  .mission-row .bar-track { height: 8px; }
  .mission-row .btn-claim { width: 100%; margin-top: 10px; background: linear-gradient(120deg, var(--green), #1abc9c); color: white; border: none; padding: 8px; border-radius: 8px; font-weight: 700; cursor: pointer; }
  .mission-row .btn-claim:disabled { background: var(--border); color: var(--text-muted); cursor: not-allowed; }
  .mission-row.claimed { opacity: 0.5; }

  .explore-box { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 26px; text-align: center; }
  .explore-box .icon { font-size: 2.5rem; margin-bottom: 10px; }
  .btn-explore { background: linear-gradient(120deg, #16a085, var(--green)); color: white; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 800; cursor: pointer; }
  .btn-explore:disabled { opacity: 0.4; cursor: not-allowed; }
  .explore-result { background: var(--card); border: 1px solid var(--green); border-radius: 14px; padding: 20px; margin-top: 16px; }
  .explore-result .fields { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 10px; }

  .skill-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; gap: 14px; align-items: flex-start; }
  .skill-card.locked { opacity: 0.45; }
  .skill-card.equipped { border-color: var(--primary); box-shadow: 0 0 14px rgba(139,92,246,0.2); }
  .skill-card .emoji { font-size: 1.8rem; }
  .skill-card .info { flex: 1; }
  .skill-card .info .top { display: flex; justify-content: space-between; align-items: center; }
  .skill-card .info .top b { font-size: 1rem; }
  .skill-card .desc { color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 8px; }
  .skill-card .rank-tag { background: rgba(245,194,66,0.15); color: var(--gold); border: 1px solid var(--gold); border-radius: 999px; padding: 2px 10px; font-size: 0.72rem; font-weight: 800; }
  .skill-card input[type="checkbox"] { width: 20px; height: 20px; accent-color: var(--primary); cursor: pointer; }
  .skill-card input[type="checkbox"]:disabled { cursor: not-allowed; }
  .btn-equip-skills { display: block; margin: 16px auto 0; background: var(--primary); color: white; border: none; padding: 12px 30px; border-radius: 10px; font-weight: 800; cursor: pointer; }

  .boss-card { background: radial-gradient(circle at 50% 0%, rgba(231,76,60,0.15), transparent 60%), var(--card); border: 1px solid var(--red); border-radius: 16px; padding: 26px; text-align: center; margin-bottom: 20px; }
  .boss-card .sprite { font-size: 3.5rem; margin-bottom: 8px; }
  .boss-card h3 { font-size: 1.3rem; margin-bottom: 4px; }
  .boss-card .desc { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 14px; }
  .boss-hp-track { height: 22px; background: #1A1D2D; border-radius: 11px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 6px; }
  .boss-hp-fill { height: 100%; background: linear-gradient(90deg, var(--red), var(--orange)); transition: width 0.4s ease; }
  .boss-hp-text { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; }
  .btn-attack-boss { background: linear-gradient(120deg, var(--red), #8B0000); color: white; border: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 1rem; }
  .btn-attack-boss:disabled { opacity: 0.4; cursor: not-allowed; }
  .boss-leaderboard { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px; }
  .lb-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
  .lb-row:last-child { border-bottom: none; }
  .lb-row.me { color: var(--primary2); font-weight: 700; }
  .lb-rank { color: var(--text-muted); width: 24px; display: inline-block; }

  .pvp-challenge-box { background: radial-gradient(circle at 50% 0%, rgba(230,126,34,0.15), transparent 60%), var(--card); border: 1px solid var(--orange); border-radius: 16px; padding: 26px; text-align: center; margin-bottom: 20px; }
  .pvp-challenge-box .icon { font-size: 2.5rem; margin-bottom: 8px; }
  .pvp-actions { display: flex; gap: 12px; justify-content: center; margin-top: 16px; }
  .btn-pvp-accept { background: linear-gradient(120deg, var(--green), #1abc9c); color: white; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 800; cursor: pointer; }
  .btn-pvp-decline { background: var(--card2); color: white; border: 1px solid var(--red); padding: 12px 26px; border-radius: 10px; font-weight: 800; cursor: pointer; }
  .pvp-send-box { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; margin-bottom: 18px; }
  .pvp-send-box input { width: 100%; background: #0B0C14; border: 1px solid var(--border); color: white; padding: 12px 14px; border-radius: 10px; outline: none; margin: 10px 0; }
  .btn-pvp-challenge { background: linear-gradient(120deg, var(--orange), var(--red)); color: white; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 800; cursor: pointer; }
  .pvp-stats-row { display: flex; gap: 14px; margin-bottom: 18px; }
  .pvp-stat-card { flex: 1; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; }
  .pvp-stat-card .value { font-size: 1.4rem; font-weight: 800; }
  .pvp-stat-card .label { color: var(--text-muted); font-size: 0.75rem; }

  .btn-again { display: block; margin: 18px auto 0; background: var(--primary); color: white; border: none; padding: 12px 26px; border-radius: 10px; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
  <nav>
    <span class="brand">⚔️ RPG Skyline</span>
    <div class="nav-user">
      ${avatarUrl ? `<img src="${avatarUrl}" alt="">` : ''}
      <span>${username}</span>
      <a href="/atividades">← Atividades</a>
      <a class="logout" href="/logout/player">Sair</a>
    </div>
  </nav>

  <div id="musicWidget" class="music-widget">
    <button id="musicToggle" title="Tocar/pausar música ambiente">🔇</button>
    <input id="musicVolume" type="range" min="0" max="100" value="25" title="Volume">
  </div>

  <div id="wrap"><p class="empty">⏳ Carregando sua ficha...</p></div>

  <script>
    const state = { stats: null, cls: null, inCombat: false, activeTab: 'batalha', profileData: null };

    // ───────────────────────── MÚSICA AMBIENTE ─────────────────────────
    // Pad ambiente sintetizado na hora via Web Audio API — sem depender de
    // nenhum arquivo de áudio externo (zero risco de link quebrado ou
    // direitos autorais). Guarda volume/estado no localStorage do navegador.
    const music = { ctx: null, gain: null, playing: false, volume: 25 };

    function initMusicEngine() {
      if (music.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      music.ctx = new Ctx();

      const master = music.ctx.createGain();
      master.gain.value = music.volume / 100 * 0.18; // teto baixo — é ambiente, não trilha de boss
      master.connect(music.ctx.destination);
      music.gain = master;

      const filter = music.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.7;
      filter.connect(master);

      // Um "reverb" bem simples via delay com feedback, pra dar espaço ao som
      // em vez dele soar seco/parado (era isso que causava a sensação de zumbido).
      const delay = music.ctx.createDelay(2);
      delay.delayTime.value = 0.6;
      const feedback = music.ctx.createGain();
      feedback.gain.value = 0.35;
      const wet = music.ctx.createGain();
      wet.gain.value = 0.5;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(master);

      // Cada nota tem seu próprio LFO de volume (períodos diferentes, fora de
      // fase), fazendo o acorde "respirar" e variar em vez de tocar sempre no
      // mesmo volume parado — é isso que dá a sensação de pad em vez de zumbido.
      const notes = [110, 164.81, 220, 220.5]; // Lá2, Mi3, Lá3 (+ uma leve dupla no topo)
      notes.forEach((freq, i) => {
        const osc = music.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = (i - 1.5) * 5;

        const oscGain = music.ctx.createGain();
        oscGain.gain.value = 0.18;

        // LFO de amplitude — período entre 9 e 17s, diferente por nota.
        const ampLfo = music.ctx.createOscillator();
        ampLfo.frequency.value = 1 / (9 + i * 2.7);
        const ampLfoGain = music.ctx.createGain();
        ampLfoGain.gain.value = 0.12;
        ampLfo.connect(ampLfoGain);
        ampLfoGain.connect(oscGain.gain);
        ampLfo.start();

        osc.connect(oscGain);
        oscGain.connect(filter);
        oscGain.connect(delay);
        osc.start();
      });

      // LFO lento modulando o filtro, pra dar uma "respiração" ao pad.
      const lfo = music.ctx.createOscillator();
      lfo.frequency.value = 0.045;
      const lfoGain = music.ctx.createGain();
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    }

    function setMusicVolume(v) {
      music.volume = v;
      localStorage.setItem('rpg_music_volume', String(v));
      if (music.gain) music.gain.gain.value = v / 100 * 0.18;
    }

    function toggleMusic() {
      if (!music.ctx) initMusicEngine();
      if (music.ctx.state === 'suspended') music.ctx.resume();

      music.playing = !music.playing;
      document.getElementById('musicToggle').textContent = music.playing ? '🔊' : '🔇';
      localStorage.setItem('rpg_music_playing', music.playing ? '1' : '0');

      if (music.playing) music.ctx.resume();
      else music.ctx.suspend();
    }

    (function initMusicUI() {
      const savedVol = parseInt(localStorage.getItem('rpg_music_volume') || '25', 10);
      music.volume = isNaN(savedVol) ? 25 : savedVol;
      document.getElementById('musicVolume').value = music.volume;

      document.getElementById('musicToggle').addEventListener('click', toggleMusic);
      document.getElementById('musicVolume').addEventListener('input', (e) => setMusicVolume(parseInt(e.target.value, 10)));

      // Se a pessoa já tinha deixado tocando antes, tenta retomar — mas
      // navegadores bloqueiam áudio sem interação, então também religamos
      // no primeiro clique em qualquer lugar da página, só uma vez.
      const wantedPlaying = localStorage.getItem('rpg_music_playing') === '1';
      if (wantedPlaying) {
        const resumeOnce = () => {
          if (!music.playing) toggleMusic();
          document.removeEventListener('click', resumeOnce);
        };
        document.addEventListener('click', resumeOnce, { once: true });
      }
    })();


    async function loadProfile() {
      const wrap = document.getElementById('wrap');
      try {
        const res = await fetch('/api/activities/rpg/profile');
        if (res.status === 401) { window.location.href = '/login/player?next=/atividades/rpg'; return; }
        if (res.status === 404) { const d = await res.json(); wrap.innerHTML = '<p class="error">' + d.error + '</p>'; return; }
        if (!res.ok) { wrap.innerHTML = '<p class="error">Erro ao carregar ficha.</p>'; return; }
        renderProfile(await res.json());
      } catch (e) {
        wrap.innerHTML = '<p class="error">Erro de conexão.</p>';
      }
    }

    // Recarrega só os dados + a barra do topo (HP/EN/XP/Ouro), SEM destruir a
    // aba atualmente aberta. Isso corrige o bug de "vida não atualiza": antes,
    // várias ações (curar, treinar, pescar...) atualizavam o personagem no
    // banco mas só o loadProfile()/switchTab() completos redesenhavam a barra
    // — agora toda ação que muda HP/Energia/Ouro/XP chama isso.
    async function refreshProfile() {
      try {
        const res = await fetch('/api/activities/rpg/profile');
        if (!res.ok) return state.profileData;
        const data = await res.json();
        state.profileData = data;
        state.stats = data.stats;
        state.cls = data.class;
        const headerWrap = document.getElementById('profileHeaderWrap');
        if (headerWrap) headerWrap.innerHTML = buildHeaderHtml(data);
        return data;
      } catch (e) {
        return state.profileData;
      }
    }

    function buildHeaderHtml(data) {
      const c = data.character, s = data.stats, cls = data.class, loc = data.location;
      const hpPct = Math.max(0, Math.min(100, (c.currentHp / s.maxHp) * 100));
      const enPct = Math.max(0, Math.min(100, (c.currentEnergy / s.maxEnergy) * 100));
      const xpPct = Math.max(0, Math.min(100, (c.xp / data.xpNeeded) * 100));

      return \`
        <div class="profile-header">
          <div class="avatar-ring">\${cls ? cls.emoji : '⚔️'}</div>
          <div style="flex:1;">
            <h2>\${c.username} <span style="color:var(--text-muted); font-weight:600; font-size:0.9rem;">— \${cls ? cls.name : c.class} · Nv. \${c.level}</span></h2>
            <div class="sub">🪙 \${c.gold} de ouro · \${loc ? loc.emoji + ' ' + loc.name : c.currentLocation}\${c.statPoints > 0 ? ' · ✨ ' + c.statPoints + ' ponto(s) livre(s)' : ''}</div>
            <div class="bars">
              <div class="bar-row"><span class="tag">HP</span><div class="bar-track"><div class="bar-fill" style="width:\${hpPct}%; background:var(--red);"></div></div> \${c.currentHp}/\${s.maxHp}</div>
              <div class="bar-row"><span class="tag">EN</span><div class="bar-track"><div class="bar-fill" style="width:\${enPct}%; background:var(--green);"></div></div> \${c.currentEnergy}/\${s.maxEnergy}</div>
              <div class="bar-row"><span class="tag">XP</span><div class="bar-track"><div class="bar-fill" style="width:\${xpPct}%; background:var(--primary2);"></div></div> \${c.xp}/\${data.xpNeeded}</div>
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
      \`;
    }

    function renderProfile(data) {
      state.profileData = data;
      state.stats = data.stats;
      state.cls = data.class;

      document.getElementById('wrap').innerHTML = \`
        <div id="profileHeaderWrap">\${buildHeaderHtml(data)}</div>
        <div class="tab-nav" id="tabNav">
          \${['batalha','dungeon','boss','pvp','cidade','explorar','pesca','missoes','habilidades','inventario','loja','viajar','treinar','meditar','pontos'].map(t => \`<button class="tab-btn \${state.activeTab === t ? 'active' : ''}" onclick="switchTab('\${t}')">\${tabLabel(t)}</button>\`).join('')}
        </div>
        <div id="tabBody"></div>
      \`;

      renderTab(state.activeTab);
    }

    function tabLabel(t) {
      return { batalha: '⚔️ Batalha', dungeon: '🏰 Dungeon', boss: '🐉 Boss Mundial', pvp: '🤺 PvP', cidade: '🏙️ Cidade', explorar: '🌍 Explorar', pesca: '🎣 Pesca', missoes: '📋 Missões', habilidades: '✨ Habilidades', inventario: '🎒 Inventário', loja: '🛒 Loja', viajar: '🗺️ Viajar', treinar: '🥊 Treinar', meditar: '🧘 Meditar', pontos: '📊 Pontos' }[t];
    }

    function switchTab(t) {
      state.activeTab = t;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      renderProfile(state.profileData);
    }

    function renderTab(t) {
      if (t === 'batalha') return renderBatalhaTab();
      if (t === 'dungeon') return renderDungeonTab();
      if (t === 'boss') return renderBossTab();
      if (t === 'pvp') return renderPvpTab();
      if (t === 'cidade') return renderCidadeTab();
      if (t === 'explorar') return renderExplorarTab();
      if (t === 'pesca') return renderPescaTab();
      if (t === 'missoes') return renderMissoesTab();
      if (t === 'habilidades') return renderHabilidadesTab();
      if (t === 'inventario') return renderInventarioTab();
      if (t === 'loja') return renderLojaTab();
      if (t === 'viajar') return renderViajarTab();
      if (t === 'treinar') return renderTreinarTab();
      if (t === 'meditar') return renderMeditarTab();
      if (t === 'pontos') return renderPontosTab();
    }

    function actionFeedback(result) {
      return \`<div class="action-feedback \${result.success ? 'ok' : 'fail'}">\${result.message}</div>\`;
    }

    // ───────────────────────── ABA: BATALHA ─────────────────────────
    function renderBatalhaTab() {
      document.getElementById('tabBody').innerHTML = \`
        <div class="battle-setup">
          <select id="enemySelect"><option value="">Carregando inimigos da região...</option></select>
          <button class="btn-fight" onclick="startCombat(document.getElementById('enemySelect').value)">▶ Lutar</button>
          <button class="btn-random" onclick="startCombat(null)">🎲 Caçar Aleatório</button>
        </div>
        <div class="arena" id="arena"></div>
      \`;
      loadEnemies();
    }

    async function loadEnemies() {
      const sel = document.getElementById('enemySelect');
      try {
        const res = await fetch('/api/activities/rpg/enemies');
        const data = await res.json();
        if (!data.enemies || !data.enemies.length) { sel.innerHTML = '<option value="">Nenhum inimigo encontrado aqui</option>'; return; }
        sel.innerHTML = data.enemies.map(e => \`<option value="\${e.id}">\${e.emoji} \${e.name} (HP \${e.baseHp})</option>\`).join('');
      } catch (e) {
        sel.innerHTML = '<option value="">Erro ao carregar inimigos</option>';
      }
    }

    // ───────────────────────── ABA: PVP ─────────────────────────
    async function renderPvpTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando arena...</p>';
      try {
        const res = await fetch('/api/activities/rpg/pvp');
        const data = await res.json();

        const statsHtml = \`
          <div class="pvp-stats-row">
            <div class="pvp-stat-card"><div class="value">\${data.pvpWins}</div><div class="label">Vitórias</div></div>
            <div class="pvp-stat-card"><div class="value">\${data.pvpLosses}</div><div class="label">Derrotas</div></div>
            <div class="pvp-stat-card"><div class="value">\${data.pvpEnabled ? '✅' : '🚫'}</div><div class="label">PvP \${data.pvpEnabled ? 'Ativado' : 'Desativado'}</div></div>
          </div>\`;

        let challengeHtml = '';
        if (data.incoming) {
          challengeHtml = \`
            <div class="pvp-challenge-box">
              <div class="icon">⚔️</div>
              <p style="font-weight:800; font-size:1.1rem;">\${data.incoming.attackerUsername} te desafiou para um duelo!</p>
              <p style="color:var(--text-muted); font-size:0.85rem; margin-top:6px;">Se você recusar ou não responder em 2 minutos, nada acontece — ninguém perde nada.</p>
              <div class="pvp-actions">
                <button class="btn-pvp-accept" onclick="doPvpRespond('accept')">✅ Aceitar Duelo</button>
                <button class="btn-pvp-decline" onclick="doPvpRespond('decline')">❌ Recusar</button>
              </div>
            </div>\`;
        }

        const sendHtml = \`
          <div class="pvp-send-box">
            <p style="font-weight:700; margin-bottom:4px;">🎯 Desafiar alguém</p>
            <p style="color:var(--text-muted); font-size:0.82rem;">Cole o ID do Discord da pessoa que você quer desafiar. Ela vai ver um pedido de duelo com Aceitar/Recusar — o combate só acontece se ela aceitar.</p>
            <input id="pvpTargetId" type="text" placeholder="ID do Discord do alvo">
            <button class="btn-pvp-challenge" \${data.onCooldown ? 'disabled' : ''} onclick="doSendChallenge()">⚔️ Enviar Desafio</button>
            \${data.onCooldown ? \`<p style="color:var(--orange); font-size:0.8rem; margin-top:8px;">⏳ Aguarde \${data.cooldownRemMin} min para desafiar de novo</p>\` : ''}
          </div>\`;

        document.getElementById('tabBody').innerHTML = \`<div id="pvpFeedback"></div>\${statsHtml}\${challengeHtml}\${sendHtml}\`;
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar PvP.</p>';
      }
    }

    async function doSendChallenge() {
      const targetId = document.getElementById('pvpTargetId').value.trim();
      if (!targetId) return;
      try {
        const res = await fetch('/api/activities/rpg/pvp/challenge', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetId })
        });
        const result = await res.json();
        document.getElementById('pvpFeedback').innerHTML = actionFeedback(result);
      } catch (e) {}
    }

    async function doPvpRespond(action) {
      try {
        const res = await fetch('/api/activities/rpg/pvp/' + action, { method: 'POST' });
        const result = await res.json();

        if (action === 'decline') {
          document.getElementById('pvpFeedback').innerHTML = '<div class="action-feedback ok">Duelo recusado. Ninguém perdeu nada.</div>';
          renderPvpTab();
          return;
        }

        if (!result.success) {
          document.getElementById('pvpFeedback').innerHTML = actionFeedback(result);
          renderPvpTab();
          return;
        }

        const won = result.winner === state.profileData.character.discordId;
        document.getElementById('tabBody').innerHTML = \`
          <div class="result-banner \${won ? 'vitoria' : 'derrota'}">\${won ? '🏆 Você venceu o duelo!' : '💀 Você perdeu o duelo!'}
            <div class="reward-fields">
              <div class="reward-field">⭐ +\${result.xpGained} XP</div>
              <div class="reward-field">💰 \${won ? '+' : '-'}\${result.goldStolen} Ouro</div>
            </div>
          </div>
          <div class="combat-log">\${(result.log || []).map(l => '<div>' + l + '</div>').join('')}</div>
          <button class="btn-again" onclick="refreshProfile().then(renderPvpTab);">Voltar</button>
        \`;
      } catch (e) {}
    }

    // ───────────────────────── ABA: CIDADE (FORJA + TAVERNA) ─────────────────────────
    let citySubTab = 'forja';

    function renderCidadeTab() {
      const loc = state.profileData.location;
      const isCity = !!(loc?.hasShop && loc?.hasCraft);

      document.getElementById('tabBody').innerHTML = \`
        <div class="city-subnav">
          <button class="\${citySubTab === 'forja' ? 'active' : ''}" onclick="switchCitySub('forja')">⚒️ Forja</button>
          <button class="\${citySubTab === 'taverna' ? 'active' : ''}" onclick="switchCitySub('taverna')">🍺 Taverna</button>
          <button class="\${citySubTab === 'curar' ? 'active' : ''}" onclick="switchCitySub('curar')">🏥 Curar HP</button>
        </div>
        <div id="cityBody"><p class="empty">⏳ Carregando...</p></div>
      \`;

      // Forja, Curandeiro e Taverna agora só existem em cidade de verdade —
      // igual ao Discord, onde as três checam hasShop/hasCraft antes de abrir.
      if (!isCity) {
        document.getElementById('cityBody').innerHTML = \`<p class="error">🏰 Você está em <b>\${loc?.name || 'uma região selvagem'}</b>, sem infraestrutura de cidade. Viaje até um assentamento seguro (aba 🗺️ Viajar) para acessar forja, curandeiro e taverna.</p>\`;
        return;
      }

      if (citySubTab === 'forja') renderForjaSub();
      else if (citySubTab === 'taverna') renderTavernaSub();
      else renderCurarSub();
    }

    function switchCitySub(tab) {
      citySubTab = tab;
      renderCidadeTab();
    }

    async function renderCurarSub() {
      try {
        const res = await fetch('/api/activities/rpg/heal');
        const data = await res.json();

        const body = data.full
          ? '<p style="color:var(--green); font-weight:700;">✅ Você já está com HP e Energia no máximo!</p>'
          : \`
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:14px;">❤️ HP faltando: <b>\${data.hpMissing}</b> · ⚡ Energia faltando: <b>\${data.enMissing}</b></p>
            <button class="btn-enter" \${data.gold < data.cost ? 'disabled' : ''} onclick="doHeal()">🏥 Curar tudo por \${data.cost}🪙</button>
            \${data.gold < data.cost ? '<p style="color:var(--red); font-size:0.8rem; margin-top:8px;">Ouro insuficiente.</p>' : ''}
          \`;

        document.getElementById('cityBody').innerHTML = \`<div id="healFeedback"></div><div class="dungeon-entrance">\${body}</div>\`;
      } catch (e) {
        document.getElementById('cityBody').innerHTML = '<p class="error">Erro ao carregar curandeiro.</p>';
      }
    }

    async function doHeal() {
      try {
        const res = await fetch('/api/activities/rpg/heal', { method: 'POST' });
        const result = await res.json();
        document.getElementById('healFeedback').innerHTML = actionFeedback(result);
        if (result.success) {
          await refreshProfile();
          renderCurarSub();
        }
      } catch (e) {}
    }

    async function renderForjaSub() {
      try {
        const res = await fetch('/api/activities/rpg/forge');
        const data = await res.json();

        const cardsHtml = data.recipes.map(r => {
          const ingHtml = r.ingredients.map(i => \`<span class="ing-chip \${i.have >= i.need ? 'ok' : 'bad'}">\${i.emoji} \${i.name} \${i.have}/\${i.need}</span>\`).join('');
          return \`
            <div class="recipe-card \${r.canCraft ? '' : 'locked'}">
              <div class="head"><b>\${r.outputEmoji} \${r.outputName} x\${r.outputQty}</b><span>💰 \${r.costGold} · Nv.\${r.minLevel}</span></div>
              <div class="ing-list">\${ingHtml}</div>
              <button \${r.canCraft ? '' : 'disabled'} onclick="doCraft('\${r.id}')">Forjar</button>
            </div>\`;
        }).join('');

        document.getElementById('cityBody').innerHTML = \`<div id="forgeFeedback"></div>\${cardsHtml}\`;
      } catch (e) {
        document.getElementById('cityBody').innerHTML = '<p class="error">Erro ao carregar a forja.</p>';
      }
    }

    async function doCraft(recipeId) {
      try {
        const res = await fetch('/api/activities/rpg/forge/craft', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipeId })
        });
        const result = await res.json();
        document.getElementById('forgeFeedback').innerHTML = actionFeedback(result);
        if (result.success) renderForjaSub();
      } catch (e) {}
    }

    async function renderTavernaSub() {
      try {
        const res = await fetch('/api/activities/rpg/tavern');
        const data = await res.json();

        const buffsHtml = (data.activeBuffs || []).length
          ? '<div class="buff-list">' + data.activeBuffs.map(b => \`<span class="buff-chip">✨ \${b.label || b.source}</span>\`).join('') + '</div>'
          : '';

        const cardsHtml = data.menu.map(i => \`
          <div class="tavern-card">
            <div class="icon">\${i.emoji}</div>
            <div style="font-weight:700; margin-bottom:4px;">\${i.name}</div>
            <div class="desc">\${i.description}</div>
            <button onclick="doTavernBuy('\${i.id}')">Pedir · \${i.price}🪙</button>
          </div>\`).join('');

        document.getElementById('cityBody').innerHTML = \`
          <div id="tavernFeedback"></div>
          \${buffsHtml}
          <div class="tavern-grid">\${cardsHtml}</div>
          <div class="dice-box">
            <div style="font-size:1.8rem;">🎲</div>
            <b>Dados da Taverna</b>
            <p style="color:var(--text-muted); font-size:0.85rem; margin:6px 0;">Aposta fixa de 20🪙. Tire mais que a casa pra dobrar (10+ é jackpot!).</p>
            <button class="btn-dice" onclick="doTavernDice()">Jogar Dados</button>
            <div id="diceResult" style="margin-top:12px; font-weight:700;"></div>
          </div>
        \`;
      } catch (e) {
        document.getElementById('cityBody').innerHTML = '<p class="error">Erro ao carregar a taverna.</p>';
      }
    }

    async function doTavernBuy(itemId) {
      try {
        const res = await fetch('/api/activities/rpg/tavern/buy', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId })
        });
        const result = await res.json();
        document.getElementById('tavernFeedback').innerHTML = actionFeedback(result);
        if (result.success) renderTavernaSub();
      } catch (e) {}
    }

    async function doTavernDice() {
      try {
        const res = await fetch('/api/activities/rpg/tavern/dice', { method: 'POST' });
        const data = await res.json();
        document.getElementById('diceResult').innerHTML = \`\${data.description}<br><span style="color:var(--text-muted); font-weight:500; font-size:0.85rem;">🎲 Você: \${data.yourRoll} · 🏠 Casa: \${data.houseRoll} · 💰 Saldo: \${data.balance}</span>\`;
      } catch (e) {}
    }

    // ───────────────────────── ABA: PESCA ─────────────────────────
    async function renderPescaTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando área de pesca...</p>';
      try {
        const res = await fetch('/api/activities/rpg/fishing');
        const data = await res.json();

        const phaseBonus = data.phaseInfo.fishBonus > 0 ? \` (+\${Math.round(data.phaseInfo.fishBonus*100)}% peixe raro ✨)\` : '';
        let statusHtml, btnHtml;

        if (data.isReady) {
          statusHtml = '🐟 <b>Algo puxou a isca!</b> Puxe agora!';
          btnHtml = '<button class="btn-fish" onclick="doReel()">🪝 Puxar!</button>';
        } else if (data.isWaiting) {
          statusHtml = '🎣 Isca na água... aguardando.';
          btnHtml = '<button class="btn-fish" disabled>⏳ Aguardando</button>';
        } else {
          statusHtml = \`Lance a isca e espere \${Math.round(FISHING_WAIT_MIN)} min para puxar.\`;
          btnHtml = \`<button class="btn-fish" \${data.currentEnergy < data.energyCost ? 'disabled' : ''} onclick="doCast()">🎣 Lançar Isca (\${data.energyCost}⚡)</button>\`;
        }

        document.getElementById('tabBody').innerHTML = \`
          <div id="fishFeedback"></div>
          <div class="phase-banner">\${data.phaseInfo.emoji} Fase do dia: <b>\${data.phaseInfo.name}</b>\${phaseBonus}</div>
          <div class="fish-box">
            <div class="icon">🎣</div>
            <div class="status">\${statusHtml}</div>
            \${btnHtml}
            <div id="fishCatch"></div>
          </div>
        \`;

        if (data.isWaiting && data.reelableAt) {
          const remaining = Math.max(0, new Date(data.reelableAt).getTime() - Date.now());
          setTimeout(renderPescaTab, remaining + 500);
        }
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar pesca.</p>';
      }
    }
    const FISHING_WAIT_MIN = 2;

    async function doCast() {
      try {
        const res = await fetch('/api/activities/rpg/fishing/cast', { method: 'POST' });
        const result = await res.json();
        document.getElementById('fishFeedback').innerHTML = actionFeedback(result);
        if (result.success) renderPescaTab();
      } catch (e) {}
    }

    async function doReel() {
      try {
        const res = await fetch('/api/activities/rpg/fishing/reel', { method: 'POST' });
        const result = await res.json();
        if (!result.success) { document.getElementById('fishFeedback').innerHTML = actionFeedback(result); return; }
        document.getElementById('fishCatch').innerHTML = \`<div class="fish-catch"><b>\${result.title}</b><p style="color:var(--text-muted); font-size:0.85rem; margin-top:6px;">\${result.description.replace(/\\n/g,'<br>')}</p></div>\`;
        await refreshProfile();
        setTimeout(renderPescaTab, 2500);
      } catch (e) {}
    }

    // ───────────────────────── ABA: MISSÕES ─────────────────────────
    async function renderMissoesTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando missões...</p>';
      try {
        const res = await fetch('/api/activities/rpg/missions');
        const data = await res.json();

        function missionRow(m, kind) {
          const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
          const title = m.title || m.label;
          const desc = m.description ? \`<div style="color:var(--text-muted); font-size:0.78rem; margin-bottom:6px;">\${m.description}</div>\` : '';
          return \`
            <div class="mission-row \${m.claimed ? 'claimed' : ''}">
              <div class="top"><b>\${m.emoji ? m.emoji + ' ' : ''}\${title}</b><span class="reward">⭐\${m.xp} 💰\${m.gold}\${m.energy ? ' ⚡'+m.energy : ''}</span></div>
              \${desc}
              <div class="bar-track"><div class="bar-fill" style="width:\${pct}%; background:var(--primary);"></div></div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">\${m.progress}/\${m.target}</div>
              <button class="btn-claim" \${!m.completed || m.claimed ? 'disabled' : ''} onclick="doClaimMission('\${m.id}','\${kind}')">\${m.claimed ? '✅ Coletado' : m.completed ? '🎁 Coletar' : 'Em progresso'}</button>
            </div>\`;
        }

        const dailyHtml = data.daily.length ? data.daily.map(m => missionRow(m, 'daily')).join('') : '<p class="empty">Nenhuma missão diária.</p>';
        const weeklyHtml = data.weekly.length ? data.weekly.map(m => missionRow(m, 'weekly')).join('') : '<p class="empty">Nenhuma missão semanal.</p>';
        const classHtml = data.classMissions.length ? data.classMissions.map(m => missionRow(m, 'class')).join('') : '<p class="empty">Nenhuma missão de classe hoje.</p>';

        document.getElementById('tabBody').innerHTML = \`
          <div id="missionFeedback"></div>
          <div class="mission-section"><div class="section-title" style="margin-top:0;">📅 Diárias</div>\${dailyHtml}</div>
          <div class="mission-section"><div class="section-title">📆 Semanais</div>\${weeklyHtml}</div>
          <div class="mission-section"><div class="section-title">🎭 De Classe</div>\${classHtml}</div>
        \`;
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar missões.</p>';
      }
    }

    async function doClaimMission(missionId, kind) {
      try {
        const res = await fetch('/api/activities/rpg/missions/claim', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ missionId, kind })
        });
        const result = await res.json();
        document.getElementById('missionFeedback').innerHTML = actionFeedback(result);
        if (result.success) {
          await refreshProfile();
          renderMissoesTab();
        }
      } catch (e) {}
    }

    // ───────────────────────── ABA: EXPLORAR REGIÃO ─────────────────────────
    async function renderExplorarTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando...</p>';
      try {
        const res = await fetch('/api/activities/rpg/explore');
        const data = await res.json();

        const disabled = data.onCooldown || data.currentEnergy < data.energyCost || data.currentHp <= 0;
        const statusMsg = data.onCooldown
          ? \`⏳ Aguarde \${data.remainingMin} min\`
          : data.currentHp <= 0
            ? '💀 Sem HP — cure-se na Cidade primeiro'
            : \`Custo: \${data.energyCost}⚡ (você tem \${data.currentEnergy})\`;

        document.getElementById('tabBody').innerHTML = \`
          <div id="exploreFeedback"></div>
          <div class="explore-box">
            <div class="icon">🌍</div>
            <p style="font-weight:700; margin-bottom:6px;">Explore a região em busca de eventos e recursos</p>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:16px;">\${statusMsg}</p>
            <button class="btn-explore" \${disabled ? 'disabled' : ''} onclick="doExploreAction()">🧭 Explorar!</button>
            <div id="exploreResult"></div>
          </div>
        \`;
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar exploração.</p>';
      }
    }

    async function doExploreAction() {
      try {
        const res = await fetch('/api/activities/rpg/explore', { method: 'POST' });
        const result = await res.json();
        if (!result.success) { document.getElementById('exploreFeedback').innerHTML = actionFeedback(result); return; }

        const fieldsHtml = (result.fields || []).map(f => \`<div class="reward-field">\${f.name}: \${f.value.replace(/\\*\\*/g,'')}</div>\`).join('');
        document.getElementById('exploreResult').innerHTML = \`
          <div class="explore-result">
            <b>\${result.title}</b>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-top:6px;">\${result.description}</p>
            <div class="fields">\${fieldsHtml}</div>
          </div>\`;

        await refreshProfile();
        setTimeout(renderExplorarTab, 2500);
      } catch (e) {}
    }

    // ───────────────────────── ABA: HABILIDADES DIVINAS ─────────────────────────
    async function renderHabilidadesTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando habilidades...</p>';
      try {
        const res = await fetch('/api/activities/rpg/skills');
        const data = await res.json();

        if (!data.skills.length) {
          document.getElementById('tabBody').innerHTML = '<p class="empty">Sua classe não possui habilidades divinas.</p>';
          return;
        }

        const cardsHtml = data.skills.map(s => \`
          <div class="skill-card \${!s.unlocked ? 'locked' : ''} \${s.equipped ? 'equipped' : ''}">
            <div class="emoji">\${s.emoji}</div>
            <div class="info">
              <div class="top">
                <b>\${s.name}\${!s.unlocked ? ' 🔒 Lv.' + s.unlockLevel : ''}</b>
                <span class="rank-tag">Rank \${s.rank}</span>
              </div>
              <div class="desc">\${s.description}<br>Custo: \${s.energyCost}⚡ · XP: \${s.exp}/\${s.nextExp}</div>
            </div>
            <input type="checkbox" data-skill-id="\${s.id}" \${!s.unlocked ? 'disabled' : ''} \${s.equipped ? 'checked' : ''} onchange="toggleSkillCheck(this)">
          </div>\`).join('');

        document.getElementById('tabBody').innerHTML = \`
          <div id="skillFeedback"></div>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:14px;">\${data.classEmoji} Classe: <b>\${data.className}</b> · Equipe até \${data.maxEquip} habilidades para usar em combate.</p>
          \${cardsHtml}
          <button class="btn-equip-skills" onclick="saveEquippedSkills()">✨ Salvar Habilidades Equipadas</button>
        \`;
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar habilidades.</p>';
      }
    }

    function toggleSkillCheck(checkboxEl) {
      const checked = document.querySelectorAll('.skill-card input[type="checkbox"]:checked');
      if (checked.length > 3) {
        checkboxEl.checked = false;
        document.getElementById('skillFeedback').innerHTML = '<div class="action-feedback fail">Você só pode equipar até 3 habilidades.</div>';
      }
    }

    async function saveEquippedSkills() {
      const checked = Array.from(document.querySelectorAll('.skill-card input[type="checkbox"]:checked'));
      const skillIds = checked.map(c => c.getAttribute('data-skill-id'));
      if (!skillIds.length) { document.getElementById('skillFeedback').innerHTML = '<div class="action-feedback fail">Selecione ao menos 1 habilidade.</div>'; return; }

      try {
        const res = await fetch('/api/activities/rpg/skills/equip', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillIds })
        });
        const result = await res.json();
        document.getElementById('skillFeedback').innerHTML = actionFeedback(result.success !== false ? { success: true, message: result.message } : { success: false, message: result.error });
        if (result.success) renderHabilidadesTab();
      } catch (e) {}
    }

    // ───────────────────────── ABA: BOSS MUNDIAL ─────────────────────────
    async function renderBossTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Verificando bosses ativos...</p>';
      try {
        const res = await fetch('/api/activities/rpg/worldboss');
        const data = await res.json();

        if (!data.boss) {
          document.getElementById('tabBody').innerHTML = '<p class="empty">🐉 Nenhum Boss Mundial ativo no momento. Fique de olho nos anúncios da Aliança!</p>';
          return;
        }

        const b = data.boss;
        const hpPct = Math.max(0, Math.min(100, (b.currentHp / b.maxHp) * 100));
        const lbHtml = b.leaderboard.length
          ? b.leaderboard.map((p, i) => \`<div class="lb-row \${p.isMe ? 'me' : ''}"><span><span class="lb-rank">#\${i+1}</span>\${p.username}\${p.isMe ? ' (você)' : ''}</span><span>\${p.damageDealt.toLocaleString('pt-BR')} dano · \${p.hits} golpes</span></div>\`).join('')
          : '<p class="empty">Ninguém atacou ainda — seja o primeiro!</p>';

        document.getElementById('tabBody').innerHTML = \`
          <div id="bossFeedback"></div>
          <div class="boss-card">
            <div class="sprite">\${b.emoji}</div>
            <h3>\${b.name} <span style="color:var(--text-muted); font-weight:600; font-size:0.9rem;">Nv.\${b.level}</span></h3>
            <div class="desc">\${b.description}</div>
            <div class="boss-hp-track"><div class="boss-hp-fill" style="width:\${hpPct}%;"></div></div>
            <div class="boss-hp-text">❤️ \${b.currentHp.toLocaleString('pt-BR')} / \${b.maxHp.toLocaleString('pt-BR')} HP</div>
            <button class="btn-attack-boss" \${data.onCooldown ? 'disabled' : ''} onclick="doAttackBoss()">⚔️ Atacar!</button>
            \${data.onCooldown ? \`<p style="color:var(--text-muted); font-size:0.8rem; margin-top:10px;">⏳ Aguarde \${data.cooldownRemMin} min para atacar de novo</p>\` : ''}
          </div>
          <div class="section-title" style="margin-top:0;">🏆 Ranking de Dano</div>
          <div class="boss-leaderboard">\${lbHtml}</div>
        \`;
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar Boss Mundial.</p>';
      }
    }

    async function doAttackBoss() {
      try {
        const res = await fetch('/api/activities/rpg/worldboss/attack', { method: 'POST' });
        const result = await res.json();
        document.getElementById('bossFeedback').innerHTML = actionFeedback({ success: result.success, message: result.message });
        if (result.success) {
          setTimeout(renderBossTab, 1200);
        }
      } catch (e) {}
    }

    // ───────────────────────── ABA: INVENTÁRIO ─────────────────────────
    const EQUIP_SLOT_LABEL = { weapon: 'Arma', helmet: 'Elmo', chest: 'Peitoral', pants: 'Calça', boots: 'Botas', gloves: 'Luvas', shield: 'Escudo', ring: 'Anel', amulet: 'Amuleto', backpack: 'Mochila', pet: 'Pet' };
    const EQUIPABLE_SLOTS = Object.keys(EQUIP_SLOT_LABEL);

    function renderInventarioTab() {
      const data = state.profileData;
      const eq = data.equipment || {};

      const equipHtml = EQUIPABLE_SLOTS.map(slot => {
        const item = eq[slot];
        return \`<div class="equip-slot \${item ? 'filled' : ''}"><div class="slot-name">\${EQUIP_SLOT_LABEL[slot]}</div>\${item ? item.emoji + ' ' + item.name : '<span style="color:var(--text-muted);">Vazio</span>'}</div>\`;
      }).join('');

      const items = data.inventory || [];
      const itemsHtml = items.length ? items.map(i => {
        const canEquip = i.maxStack === 1 && EQUIPABLE_SLOTS.includes(i.slot);
        const canUse = i.slot === 'consumable';
        const canSell = i.sellPrice > 0;
        return \`
          <div class="item-card">
            \${i.emoji} \${i.name} <span class="qty">x\${i.quantity}</span>
            <div class="item-actions">
              \${canEquip ? \`<button onclick="doItemAction('equip','\${i.id}')">Equipar</button>\` : ''}
              \${canUse ? \`<button onclick="doItemAction('use','\${i.id}')">Usar</button>\` : ''}
              \${canSell ? \`<button class="sell" onclick="doItemAction('sell','\${i.id}')">Vender \${i.sellPrice}🪙</button>\` : ''}
            </div>
          </div>\`;
      }).join('') : '<p class="empty">Inventário vazio.</p>';

      document.getElementById('tabBody').innerHTML = \`
        <div id="invFeedback"></div>
        <div class="section-title" style="margin-top:0;">🛡️ Equipamento</div>
        <div class="equip-grid">\${equipHtml}</div>
        <div class="section-title">🎒 Itens</div>
        <div class="item-list">\${itemsHtml}</div>
      \`;
    }

    async function doItemAction(action, itemId) {
      try {
        const res = await fetch('/api/activities/rpg/inventory/' + action, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, qty: 1 })
        });
        const result = await res.json();
        document.getElementById('invFeedback').innerHTML = actionFeedback(result);
        if (result.success) {
          await refreshProfile();
          renderInventarioTab();
          document.getElementById('invFeedback').innerHTML = actionFeedback(result);
        }
      } catch (e) {}
    }

    // ───────────────────────── ABA: LOJA ─────────────────────────
    let shopCategories = null;
    let shopActiveCat = null;

    async function renderLojaTab() {
      const loc = state.profileData.location;
      if (!loc?.hasShop) {
        document.getElementById('tabBody').innerHTML = \`<p class="error">🏰 A loja só existe em cidades. Você está em <b>\${loc?.name || 'uma região selvagem'}</b> — viaje até um assentamento seguro na aba 🗺️ Viajar.</p>\`;
        return;
      }
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando loja...</p>';
      try {
        const res = await fetch('/api/activities/rpg/shop');
        const data = await res.json();
        shopCategories = data.categories;
        if (!shopActiveCat) shopActiveCat = shopCategories[0].id;
        renderShopCategory(shopActiveCat);
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar loja.</p>';
      }
    }

    async function renderShopCategory(catId) {
      shopActiveCat = catId;
      const pillsHtml = shopCategories.map(c => \`<button class="cat-pill \${c.id === catId ? 'active' : ''}" onclick="renderShopCategory('\${c.id}')">\${c.label}</button>\`).join('');

      document.getElementById('tabBody').innerHTML = \`
        <div id="shopFeedback"></div>
        <div class="cat-pills">\${pillsHtml}</div>
        <div class="shop-grid" id="shopGrid"><p class="empty">⏳ Carregando itens...</p></div>
      \`;

      try {
        const res = await fetch('/api/activities/rpg/shop?category=' + catId);
        const data = await res.json();
        const grid = document.getElementById('shopGrid');
        if (!data.items.length) { grid.innerHTML = '<p class="empty">Nenhum item nessa categoria.</p>'; return; }
        grid.innerHTML = data.items.map(i => \`
          <div class="shop-card">
            <div class="name">\${i.emoji} \${i.name}</div>
            <div class="desc">\${i.description || ''}</div>
            <div class="buy-row"><span class="price">💰 \${i.price}</span><button onclick="doBuy('\${i.id}')">Comprar</button></div>
          </div>\`).join('');
      } catch (e) {}
    }

    async function doBuy(itemId) {
      try {
        const res = await fetch('/api/activities/rpg/shop/buy', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, qty: 1 })
        });
        const result = await res.json();
        document.getElementById('shopFeedback').innerHTML = actionFeedback(result);
        if (result.success) {
          await refreshProfile();
        }
      } catch (e) {}
    }

    // ───────────────────────── ABA: VIAJAR ─────────────────────────
    async function renderViajarTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando mapa...</p>';
      try {
        const res = await fetch('/api/activities/rpg/locations');
        const data = await res.json();
        const html = data.locations.map(l => \`
          <div class="loc-card \${l.isCurrent ? 'current' : ''} \${l.locked ? 'locked' : ''}">
            <div class="info">
              <b>\${l.emoji} \${l.name}</b>
              <div>Nv.\${l.minLevel}+ · ⚡\${l.travelCostEnergy} energia \${l.hasDungeon ? '· 🏰 Dungeon' : ''}</div>
            </div>
            \${l.isCurrent ? '<span style="color:var(--green); font-weight:700;">📍 Aqui</span>' : (l.locked ? '<span style="color:var(--text-muted);">🔒 Bloqueado</span>' : \`<button onclick="doTravel('\${l.id}')">Viajar</button>\`)}
          </div>\`).join('');
        document.getElementById('tabBody').innerHTML = '<div id="travelFeedback"></div><div class="loc-list">' + html + '</div>';
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar mapa.</p>';
      }
    }

    async function doTravel(destinationId) {
      try {
        const res = await fetch('/api/activities/rpg/travel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationId })
        });
        const result = await res.json();
        if (result.success) {
          await refreshProfile();
          renderProfile(state.profileData);
        } else {
          document.getElementById('travelFeedback').innerHTML = actionFeedback(result);
        }
      } catch (e) {}
    }

    // ───────────────────────── ABA: TREINAR ─────────────────────────
    async function renderTreinarTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando treino...</p>';
      try {
        const res = await fetch('/api/activities/rpg/train');
        const data = await res.json();

        const buffsHtml = (data.activeBuffs || []).length
          ? '<div class="buff-list">' + data.activeBuffs.map(b => \`<span class="buff-chip">✨ \${b.label || b.source}</span>\`).join('') + '</div>'
          : '';

        const cooldownHtml = data.onCooldown
          ? \`<div class="cooldown-banner">⏳ Aguarde \${data.cooldownRemMin} min para treinar de novo</div>\`
          : '';

        const cardsHtml = data.options.map(o => \`
          <div class="train-card">
            <div class="icon">\${o.emoji}</div>
            <div class="name">\${o.label}</div>
            <div class="desc">\${o.description}<br>Custo: \${o.energyCost}⚡</div>
            <button \${data.onCooldown || data.currentEnergy < o.energyCost ? 'disabled' : ''} onclick="doTrainAction('\${o.id}')">Treinar</button>
          </div>\`).join('');

        document.getElementById('tabBody').innerHTML = \`
          <div id="trainFeedback"></div>
          \${buffsHtml}
          \${cooldownHtml}
          <div class="train-grid">\${cardsHtml}</div>
        \`;
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar treino.</p>';
      }
    }

    async function doTrainAction(statId) {
      try {
        const res = await fetch('/api/activities/rpg/train', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statId })
        });
        const result = await res.json();
        document.getElementById('trainFeedback').innerHTML = actionFeedback(result);
        if (result.success) {
          await refreshProfile();
          renderTreinarTab();
        }
      } catch (e) {}
    }

    // ───────────────────────── ABA: MEDITAR ─────────────────────────
    async function renderMeditarTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando meditação...</p>';
      try {
        const res = await fetch('/api/activities/rpg/meditate');
        const data = await res.json();

        const phaseBonus = data.phaseInfo.meditaBonus > 0 ? \` (+\${Math.round(data.phaseInfo.meditaBonus * 100)}% eficiência agora ✨)\` : '';
        const phaseHtml = \`<div class="phase-banner">\${data.phaseInfo.emoji} Fase do dia: <b>\${data.phaseInfo.name}</b>\${phaseBonus}</div>\`;

        let bodyHtml;
        if (data.isReady) {
          bodyHtml = \`
            <div class="med-progress">
              <div style="font-size:2rem;">🪷</div>
              <div style="font-weight:800; margin:8px 0;">Meditação concluída!</div>
              <button class="btn-collect" onclick="doCollectMeditation()">🪷 Coletar Bônus</button>
            </div>\`;
        } else if (data.isMeditating) {
          bodyHtml = \`
            <div class="med-progress">
              <div style="font-size:2rem;">🧘</div>
              <div style="font-weight:800; margin:8px 0;">Meditando... \${data.remainingMin} min restante(s)</div>
            </div>\`;
        } else {
          bodyHtml = '<div class="med-grid">' + data.options.map(o => \`
            <div class="med-card">
              <div class="icon">\${o.emoji}</div>
              <div class="name">\${o.label}</div>
              <div class="desc">Restaura \${Math.round(o.hpPercent*100)}% HP + \${o.energyFlat}⚡\${o.buffChance > 0 ? '<br>' + Math.round(o.buffChance*100) + '% chance de +15% XP' : ''}</div>
              <button onclick="doStartMeditation('\${o.id}')">Meditar</button>
            </div>\`).join('') + '</div>';
        }

        document.getElementById('tabBody').innerHTML = '<div id="medFeedback"></div>' + phaseHtml + bodyHtml;
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar meditação.</p>';
      }
    }

    async function doStartMeditation(optionId) {
      try {
        const res = await fetch('/api/activities/rpg/meditate/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionId })
        });
        const result = await res.json();
        document.getElementById('medFeedback').innerHTML = actionFeedback(result);
        if (result.success) renderMeditarTab();
      } catch (e) {}
    }

    async function doCollectMeditation() {
      try {
        const res = await fetch('/api/activities/rpg/meditate/collect', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          document.getElementById('medFeedback').innerHTML = \`<div class="action-feedback ok">🪷 +\${result.hpGained} HP · +\${result.energyGained}⚡\${result.buffGiven ? ' · ✨ Buff de XP ativado!' : ''}</div>\`;
          await refreshProfile();
          setTimeout(renderMeditarTab, 1500);
        } else {
          document.getElementById('medFeedback').innerHTML = actionFeedback(result);
        }
      } catch (e) {}
    }

    // ───────────────────────── ABA: DUNGEON (EXPEDIÇÃO) ─────────────────────────
    async function renderDungeonTab() {
      document.getElementById('tabBody').innerHTML = '<p class="empty">⏳ Carregando dungeon...</p>';
      try {
        const res = await fetch('/api/activities/rpg/dungeon');
        const data = await res.json();

        if (data.run) {
          renderCrawler(data.run, data.currentHp, data.currentEnergy);
          return;
        }

        if (data.location.isSafeZone) {
          document.getElementById('tabBody').innerHTML = '<p class="error">🏰 Você está em uma zona segura. Viaje para uma região hostil na aba 🗺️ Viajar primeiro!</p>';
          return;
        }
        if (!data.location.hasDungeon) {
          document.getElementById('tabBody').innerHTML = \`<p class="error">\${data.location.name} não possui labirintos. Tente outra região!</p>\`;
          return;
        }

        const enemiesHtml = data.enemies.map(e => \`<span class="enemy-chip">\${e.emoji} \${e.name}</span>\`).join('') || '<span class="empty">Nenhum inimigo conhecido no seu nível.</span>';
        const bossesHtml = data.bosses.length ? data.bosses.map(b => \`<span class="enemy-chip">💀 \${b.emoji} \${b.name}</span>\`).join('') : '<span class="empty">Nenhum boss disponível.</span>';

        document.getElementById('tabBody').innerHTML = \`
          <div id="dungeonFeedback"></div>
          <div class="dungeon-entrance">
            <h4>⚔️ Expedições — \${data.location.emoji} \${data.location.name}</h4>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:14px;">Você passará por 5 andares de combates ou eventos aleatórios até a câmara do Boss. Se fugir ou morrer no caminho, perde o progresso.</p>
            <p style="font-weight:700; margin-bottom:4px;">👹 Ameaças</p>
            <div>\${enemiesHtml}</div>
            <p style="font-weight:700; margin:12px 0 4px;">💀 Guardiões</p>
            <div>\${bossesHtml}</div>
            <p style="margin-top:14px; color:var(--text-muted); font-size:0.85rem;">⚡ Custo: 20 energia (você tem \${data.currentEnergy}) \${data.cooldown.onCooldown ? '· ⏳ Cooldown: ' + data.cooldown.remaining : ''}</p>
            <button class="btn-enter" \${data.cooldown.onCooldown || data.currentEnergy < 20 || data.currentHp <= 0 ? 'disabled' : ''} onclick="startDungeonRun()">🚪 Adentrar Expedição</button>
          </div>
        \`;
      } catch (e) {
        document.getElementById('tabBody').innerHTML = '<p class="error">Erro ao carregar dungeon.</p>';
      }
    }

    async function startDungeonRun() {
      try {
        const res = await fetch('/api/activities/rpg/dungeon/start', { method: 'POST' });
        const data = await res.json();
        if (!data.success) { document.getElementById('dungeonFeedback').innerHTML = \`<div class="action-feedback fail">\${data.error}</div>\`; return; }
        renderCrawler(data.run, null, null);
      } catch (e) {}
    }

    function renderCrawler(run, hp, energy) {
      const dotsHtml = Array.from({ length: run.maxFloors }, (_, i) => {
        const floor = i + 1;
        const cls = floor === run.maxFloors ? 'boss' : floor < run.currentFloor ? 'done' : floor === run.currentFloor ? 'current' : '';
        return \`<div class="floor-dot \${cls}"></div>\`;
      }).join('');

      const logHtml = run.logs.slice(-4).map(l => '<div>' + l + '</div>').join('');

      let actionsHtml;
      if (run.currentFloor >= run.maxFloors) {
        actionsHtml = \`
          <button class="btn-crawl-boss" onclick="dungeonFight('boss')">⚔️ Enfrentar Boss</button>
          <button class="btn-crawl-flee" onclick="dungeonFlee()">🏃 Fugir Covardemente</button>\`;
      } else if (run.currentFloor % 2 === 0) {
        actionsHtml = \`<button class="btn-crawl-event" onclick="dungeonEvent()">🔍 Avançar (Evento)</button>\`;
      } else {
        actionsHtml = \`
          <button class="btn-crawl-fight" onclick="dungeonFight('normal')">⚔️ Lutar (Inimigo Comum)</button>
          <button class="btn-crawl-flee" onclick="dungeonFlee()">🏃 Fugir para a Cidade</button>\`;
      }

      document.getElementById('tabBody').innerHTML = \`
        <div id="dungeonFeedback"></div>
        <div class="floor-track">\${dotsHtml}</div>
        <p style="font-weight:700; margin-bottom:10px;">🗺️ Andar \${run.currentFloor}/\${run.maxFloors}</p>
        <div class="crawler-log">\${logHtml}</div>
        <div class="crawler-actions" id="crawlerActions">\${actionsHtml}</div>
        <div class="arena" id="dungeonArena"></div>
      \`;
    }

    async function dungeonEvent() {
      try {
        const res = await fetch('/api/activities/rpg/dungeon/event', { method: 'POST' });
        const data = await res.json();
        if (!data.success) { document.getElementById('dungeonFeedback').innerHTML = actionFeedback(data); return; }
        renderCrawler(data.run, null, null);
      } catch (e) {}
    }

    async function dungeonFight(pool) {
      const arena = document.getElementById('dungeonArena');
      document.getElementById('crawlerActions').style.display = 'none';
      arena.classList.add('show');
      arena.innerHTML = '<p class="empty">⏳ Preparando combate...</p>';

      try {
        const res = await fetch('/api/activities/rpg/combat/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pool })
        });
        const turn = await res.json();
        if (res.status === 409) { arena.innerHTML = \`<p class="error">⏳ \${turn.message}</p>\`; return; }
        renderDungeonArena(turn);
      } catch (e) {
        arena.innerHTML = '<p class="error">Erro de conexão.</p>';
      }
    }

    async function dungeonArenaAction(action) {
      try {
        const res = await fetch('/api/activities/rpg/combat/action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
        const turn = await res.json();
        renderDungeonArena(turn);
      } catch (e) {}
    }

    function renderDungeonArena(turn) {
      const s = state.stats;
      const maxHp = s ? s.maxHp : turn.playerHp;
      const maxEn = s ? s.maxEnergy : turn.playerEnergy;
      const heroEmoji = state.cls ? state.cls.emoji : '🧙';

      const playerHpPct = Math.max(0, Math.min(100, (turn.playerHp / maxHp) * 100));
      const playerEnPct = Math.max(0, Math.min(100, (turn.playerEnergy / maxEn) * 100));
      const enemyHpPct = Math.max(0, Math.min(100, (turn.enemyHp / turn.enemyMaxHp) * 100));
      const logHtml = (turn.log || []).map(l => '<div>' + l.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>') + '</div>').join('');

      let resultHtml = '';
      if (turn.finished && turn.result) {
        const r = turn.result;
        const titleMap = { vitoria: '🏆 Vitória!', derrota: '💀 Derrota!', fuga: '🏃 Fuga', empate: '💥 Empate!' };
        const dropsHtml = (r.itemsDropped && r.itemsDropped.length)
          ? '<div class="drop-list">🎁 ' + r.itemsDropped.map(i => i.emoji + ' <b>' + i.name + '</b>').join('  •  ') + '</div>'
          : '';

        let nextBtn = '';
        const outcome = turn.expeditionOutcome;
        if (outcome?.next === 'finish') {
          nextBtn = '<button class="btn-again" onclick="dungeonFinishRun()">🏆 Resgatar Recompensas!</button>';
        } else if (outcome?.next === 'continue') {
          window.__pendingRun = outcome.run;
          nextBtn = '<button class="btn-again" onclick="continueCrawler()">🚪 Avançar na Expedição</button>';
        } else if (outcome?.next === 'lost') {
          nextBtn = '<button class="btn-again" onclick="renderDungeonTab()">😔 Voltar à Entrada</button>';
        } else {
          nextBtn = '<button class="btn-again" onclick="loadProfile();">🔄 Atualizar Ficha</button>';
        }

        resultHtml = \`
          <div class="result-banner \${r.result}">\${titleMap[r.result] || r.result}
            <div class="reward-fields">
              <div class="reward-field">⭐ +\${r.xpGained} XP</div>
              <div class="reward-field">💰 +\${r.goldGained} Ouro</div>
            </div>
            \${dropsHtml}
          </div>
          \${nextBtn}
        \`;
      }

      document.getElementById('dungeonArena').innerHTML = \`
        <div class="arena-title"><span>\${turn.finished ? 'Resultado' : '⚔️ Expedição — Rodada ' + (turn.round || 1)}</span></div>
        <div class="arena-stage">
          <div class="combatant hero">
            <div class="sprite">\${heroEmoji}</div>
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
          <button class="action-btn" onclick="dungeonArenaAction('attack')">⚔️ Atacar</button>
          \${(turn.skills && turn.skills.length ? turn.skills : [{id:'', name:'Habilidade', ready:false}]).map(s => \`<button class="action-btn" onclick="dungeonArenaAction('skill:\${s.id}')" \${s.ready ? '' : 'disabled'}>✨ \${s.name}</button>\`).join('')}
          <button class="action-btn" onclick="dungeonArenaAction('defend')">🛡️ Defender</button>
          <button class="action-btn" onclick="dungeonArenaAction('potion')" \${turn.potionAvailable ? '' : 'disabled'}>🧪 Poção</button>
          <button class="action-btn" onclick="dungeonArenaAction('flee')">🏃 Fugir</button>
        </div>\` : ''}
        <div class="combat-log" id="dungeonCombatLog">\${logHtml}</div>
        \${resultHtml}
      \`;

      const logEl = document.getElementById('dungeonCombatLog');
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }

    function continueCrawler() {
      renderCrawler(window.__pendingRun, null, null);
    }

    async function dungeonFinishRun() {
      try {
        const res = await fetch('/api/activities/rpg/dungeon/finish', { method: 'POST' });
        const data = await res.json();
        document.getElementById('tabBody').innerHTML = \`
          <div class="result-banner vitoria">\${data.title || '🏆 Expedição Concluída!'}
            <div class="reward-fields">
              <div class="reward-field">⭐ +\${data.xpGained} XP</div>
              <div class="reward-field">💰 +\${data.goldGained} Ouro</div>
            </div>
          </div>
          <button class="btn-again" onclick="renderDungeonTab();">Explorar Outra</button>
        \`;
        await refreshProfile();
      } catch (e) {}
    }

    async function dungeonFlee() {
      try {
        await fetch('/api/activities/rpg/dungeon/flee', { method: 'POST' });
        renderDungeonTab();
      } catch (e) {}
    }

    // ───────────────────────── ABA: PONTOS DE ATRIBUTO ─────────────────────────
    const STAT_LABELS = { strength: 'Força 💪', agility: 'Agilidade 🏃', intelligence: 'Inteligência 🧠', vitality: 'Vitalidade ❤️', luck: 'Sorte 🍀' };

    function renderPontosTab() {
      const c = state.profileData.character;
      const rows = Object.keys(STAT_LABELS).map(stat => \`
        <div class="point-row">
          <span>\${STAT_LABELS[stat]}</span>
          <div class="btns">
            <button \${c.statPoints < 1 ? 'disabled' : ''} onclick="doAddPoint('\${stat}',1)">+1</button>
            <button \${c.statPoints < 5 ? 'disabled' : ''} onclick="doAddPoint('\${stat}',5)">+5</button>
          </div>
        </div>\`).join('');

      document.getElementById('tabBody').innerHTML = \`
        <div id="pointsFeedback"></div>
        <div class="points-banner">✨ Você tem <b>\${c.statPoints}</b> ponto(s) de atributo livre(s)</div>
        \${rows}
      \`;
    }

    async function doAddPoint(stat, points) {
      try {
        const res = await fetch('/api/activities/rpg/points', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stat, points })
        });
        const result = await res.json();
        document.getElementById('pointsFeedback').innerHTML = actionFeedback(result);
        if (result.success) {
          await refreshProfile();
          renderPontosTab();
        }
      } catch (e) {}
    }

    async function startCombat(enemyId) {
      const arena = document.getElementById('arena');
      arena.classList.add('show');
      arena.innerHTML = '<p class="empty">⏳ Preparando batalha...</p>';

      try {
        const res = await fetch('/api/activities/rpg/combat/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enemyId: enemyId || undefined })
        });
        if (res.status === 401) { window.location.href = '/login/player?next=/atividades/rpg'; return; }
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
          body: JSON.stringify({ action })
        });
        if (res.status === 401) { window.location.href = '/login/player?next=/atividades/rpg'; return; }
        const turn = await res.json();
        if (res.status === 409) { document.getElementById('arena').innerHTML += \`<p class="error">⏳ \${turn.message}</p>\`; return; }
        renderArena(turn);
      } catch (e) {}
    }

    // Cores/títulos espelham exatamente o embed do Discord (buildCombatTurnEmbed /
    // buildCombatResultEmbed em dungeon.ts): verde = Caçada em andamento,
    // verde/vermelho/laranja = vitória/derrota/fuga.
    function renderArena(turn) {
      const s = state.stats;
      const maxHp = s ? s.maxHp : turn.playerHp;
      const maxEn = s ? s.maxEnergy : turn.playerEnergy;
      const heroEmoji = state.cls ? state.cls.emoji : '🧙';

      const playerHpPct = Math.max(0, Math.min(100, (turn.playerHp / maxHp) * 100));
      const playerEnPct = Math.max(0, Math.min(100, (turn.playerEnergy / maxEn) * 100));
      const enemyHpPct = Math.max(0, Math.min(100, (turn.enemyHp / turn.enemyMaxHp) * 100));

      const logHtml = (turn.log || []).map(l => '<div>' + l.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>') + '</div>').join('');
      const arena = document.getElementById('arena');

      let resultHtml = '';
      let borderColor = '#2ECC71'; // Caçada em andamento

      if (turn.finished && turn.result) {
        const r = turn.result;
        const titleMap = { vitoria: '🏆 Vitória!', derrota: '💀 Derrota!', fuga: '🏃 Fuga', empate: '💥 Empate!' };
        borderColor = r.result === 'vitoria' ? '#2ECC71' : r.result === 'derrota' ? '#E74C3C' : '#F39C12';

        const dropsHtml = (r.itemsDropped && r.itemsDropped.length)
          ? '<div class="drop-list">🎁 ' + r.itemsDropped.map(i => i.emoji + ' <b>' + i.name + '</b>').join('  •  ') + '</div>'
          : '';

        resultHtml = \`
          <div class="result-banner \${r.result}">\${titleMap[r.result] || r.result}
            <div class="reward-fields">
              <div class="reward-field">⭐ +\${r.xpGained} XP</div>
              <div class="reward-field">💰 +\${r.goldGained} Ouro</div>
            </div>
            \${dropsHtml}
          </div>
          <button class="btn-again" onclick="loadProfile();">🔄 Atualizar Ficha</button>
        \`;
        state.inCombat = false;
      }

      arena.style.borderColor = borderColor;

      arena.innerHTML = \`
        <div class="arena-title"><span>\${turn.finished ? 'Resultado' : '🌲 Caçada — Rodada ' + (turn.round || 1)}</span></div>
        <div class="arena-stage">
          <div class="combatant hero">
            <div class="sprite">\${heroEmoji}</div>
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
          <button class="action-btn" onclick="sendAction('attack')">⚔️ Atacar</button>
          \${(turn.skills && turn.skills.length ? turn.skills : [{id:'', name:'Habilidade', ready:false}]).map(s => \`<button class="action-btn" onclick="sendAction('skill:\${s.id}')" \${s.ready ? '' : 'disabled'}>✨ \${s.name}</button>\`).join('')}
          <button class="action-btn" onclick="sendAction('defend')">🛡️ Defender</button>
          <button class="action-btn" onclick="sendAction('potion')" \${turn.potionAvailable ? '' : 'disabled'}>🧪 Poção</button>
          <button class="action-btn" onclick="sendAction('flee')">🏃 Fugir</button>
        </div>\` : ''}

        <div class="combat-log" id="combatLog">\${logHtml}</div>
        \${resultHtml}
      \`;

      const logEl = document.getElementById('combatLog');
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }

    loadProfile();
  </script>
</body>
</html>`);
  });


  app.get('/api/activities/rpg/profile', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;

    try {
      const character = await getCharacter(discordId);
      if (!character) return res.status(404).json({ error: 'Você ainda não tem um personagem de RPG. Crie um pelo comando do Discord primeiro!' });

      const stats = computeStats(character);
      const cls = getClass(character.class);
      const loc = getLocation(character.currentLocation);
      const rawInventory = await prisma.rpgInventoryItem.findMany({ where: { characterId: discordId } });
      const inventory = rawInventory.map(i => ({ ...enrichItem(i.itemId), quantity: i.quantity }));

      const EQUIP_SLOTS = ['weapon', 'helmet', 'chest', 'pants', 'boots', 'gloves', 'shield', 'ring', 'amulet', 'backpack', 'pet'];
      const equipment: Record<string, any> = {};
      if (character.equipment) {
        for (const slot of EQUIP_SLOTS) {
          const itemId = (character.equipment as any)[slot];
          equipment[slot] = itemId ? enrichItem(itemId) : null;
        }
      }

      const xpNeeded = rpgXpForLevel(character.level);
      res.json({ character, stats, class: cls, location: loc, inventory, equipment, xpNeeded });
    } catch (e) {
      console.error('[Atividades/RPG] Erro ao buscar personagem:', e);
      res.status(500).json({ error: 'Erro ao buscar personagem' });
    }
  });

  // Lista os inimigos disponíveis na localização atual do personagem (mesma
  // fonte usada na "Caçada Livre" do Discord: getEnemiesForLocation).
  app.get('/api/activities/rpg/enemies', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;

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
  // O discordId agora vem SEMPRE do cookie de sessão (nunca do corpo da
  // requisição) — assim ninguém consegue lutar/ver a ficha de outra pessoa
  // só colando o ID dela.
  app.post('/api/activities/rpg/combat/start', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { guildId, enemyId, pool } = req.body || {};

    try {
      const character = await getCharacter(discordId);
      if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

      const run = activeExpeditions.get(discordId);

      let enemy = enemyId ? getEnemy(enemyId) : undefined;
      if (!enemy) {
        const locationId = run?.locationId ?? character.currentLocation;
        const candidates = pool === 'boss'
          ? getBossesForLocation(locationId, character.level)
          : getEnemiesForLocation(locationId, character.level);
        if (!candidates.length) return res.status(404).json({ error: 'Nenhum inimigo encontrado nessa região.' });
        enemy = candidates[Math.floor(Math.random() * candidates.length)];
      }

      // Igual a doBattleRandom/doBattleEnemy: se há expedição ativa, o modo
      // interno de combate vira 'expedition' (afeta balanceamento), não 'hunt'.
      const mode: CombatMode = run ? 'expedition' : 'hunt';

      const turn: any = await startInteractiveCombat(character, enemy, guildId, mode);
      if (turn.finished && turn.result?.itemsDropped) {
        turn.result.itemsDropped = turn.result.itemsDropped.map(enrichItem);
      }
      turn.expeditionOutcome = applyExpeditionOutcome(discordId, turn);
      res.json(turn);
    } catch (err) {
      if (err instanceof CombatBlockedError) return res.status(409).json(isCombatBlockedMessage(err.message));
      console.error('[Atividades/RPG] Erro ao iniciar combate:', err);
      res.status(500).json({ error: 'Erro ao iniciar combate' });
    }
  });

  app.post('/api/activities/rpg/combat/action', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { action } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action é obrigatório' });

    try {
      const turn: any = await takeCombatAction(discordId, action as CombatAction);
      if (turn.finished && turn.result?.itemsDropped) {
        turn.result.itemsDropped = turn.result.itemsDropped.map(enrichItem);
      }
      turn.expeditionOutcome = applyExpeditionOutcome(discordId, turn);
      res.json(turn);
    } catch (err) {
      if (err instanceof CombatBlockedError) return res.status(409).json(isCombatBlockedMessage(err.message));
      console.error('[Atividades/RPG] Erro na ação de combate:', err);
      res.status(500).json({ error: 'Erro ao processar ação' });
    }
  });

  // ── Dungeon / Expedição: mesma engine (startExpedition, processRandomDungeonEvent,
  // finishExpedition) e o MESMO Map activeExpeditions de src/rpg/panels/dungeon.ts
  // — uma expedição iniciada no site aparece pro Discord e vice-versa.
  app.get('/api/activities/rpg/dungeon', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const run = activeExpeditions.get(discordId) || null;
    const loc = getLocation(character.currentLocation);
    const cooldown = isDungeonOnCooldown(character, 5);
    const enemies = getEnemiesForLocation(loc.id, character.level).slice(0, 5);
    const bosses = getBossesForLocation(loc.id, character.level);

    res.json({
      run, location: loc, cooldown,
      enemies: enemies.map(e => ({ id: e.id, name: e.name, emoji: e.emoji })),
      bosses: bosses.map(b => ({ id: b.id, name: b.name, emoji: b.emoji })),
      currentHp: character.currentHp, currentEnergy: character.currentEnergy,
    });
  });

  app.post('/api/activities/rpg/dungeon/start', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const result = await startExpedition(character, character.currentLocation);
    res.json(result);
  });

  app.post('/api/activities/rpg/dungeon/event', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const run = activeExpeditions.get(discordId);
    if (!run) return res.status(404).json({ error: 'Nenhuma expedição ativa.' });

    const updatedRun = await processRandomDungeonEvent(character, run);
    res.json({ success: true, run: updatedRun });
  });

  app.post('/api/activities/rpg/dungeon/finish', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const run = activeExpeditions.get(discordId);
    if (!run) return res.status(404).json({ error: 'Nenhuma expedição ativa.' });

    const { embed, ...rest } = await finishExpedition(character, run) as any;
    activeExpeditions.delete(discordId);

    const fields = embed?.data?.fields || [];
    const xpGained = parseInt((fields.find((f: any) => f.name.includes('XP'))?.value || '+0').replace(/\D/g, '')) || 0;
    const goldGained = parseInt((fields.find((f: any) => f.name.includes('Ouro'))?.value || '+0').replace(/\D/g, '')) || 0;

    res.json({ success: true, title: embed?.data?.title, description: embed?.data?.description, xpGained, goldGained });
  });

  app.post('/api/activities/rpg/dungeon/flee', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    activeExpeditions.delete(discordId);
    res.json({ success: true });
  });

  // ── Cidade: Forja (mesma CRAFT_RECIPES + craftItem() de src/rpg/panels/forja.ts)
  app.get('/api/activities/rpg/forge', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const inventory = await prisma.rpgInventoryItem.findMany({ where: { characterId: discordId, quantity: { gt: 0 } } });
    const invMap = new Map(inventory.map(i => [i.itemId, i.quantity]));

    const recipes = CRAFT_RECIPES.map((r: any) => {
      const output = getItem(r.outputItem);
      const ingredients = r.ingredients.map((ing: any) => {
        const ingItem = getItem(ing.itemId);
        return { itemId: ing.itemId, name: ingItem?.name || ing.itemId, emoji: ingItem?.emoji || '📦', need: ing.qty, have: invMap.get(ing.itemId) || 0 };
      });
      const canCraft = character.level >= r.minLevel && character.gold >= r.costGold && ingredients.every((i: any) => i.have >= i.need);
      return {
        id: r.id, outputName: output?.name || r.outputItem, outputEmoji: output?.emoji || '⚒️',
        outputQty: r.outputQty, minLevel: r.minLevel, costGold: r.costGold, ingredients, canCraft,
      };
    });

    res.json({ recipes, gold: character.gold, level: character.level });
  });

  app.post('/api/activities/rpg/forge/craft', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { recipeId } = req.body || {};
    if (!recipeId) return res.status(400).json({ error: 'recipeId é obrigatório' });

    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    const loc = getLocation(character.currentLocation);
    if (!loc?.hasCraft) return res.status(403).json({ success: false, message: 'A forja só existe em cidades. Viaje até um assentamento seguro primeiro.' });

    const result = await craftItem(discordId, recipeId);
    res.json(result);
  });

  // ── Cidade: Taverna (mesmo TAVERNA_MENU, buyTavernaItem() e
  // rollTavernaDice() de src/rpg/panels/taverna.ts — cura HP/energia,
  // buffs temporários e o minijogo de dados, tudo real).
  app.get('/api/activities/rpg/tavern', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const buffs = await getActiveBuffs(discordId);
    res.json({ menu: TAVERNA_MENU, gold: character.gold, activeBuffs: buffs });
  });

  app.post('/api/activities/rpg/tavern/buy', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório' });

    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    const tavLoc = getLocation(character.currentLocation);
    if (!tavLoc?.hasShop) return res.json({ success: false, message: 'A Taverna só existe em cidades. Viaje até um assentamento seguro primeiro.' });

    const result = await buyTavernaItem(character, itemId);
    res.json(result);
  });

  app.post('/api/activities/rpg/tavern/dice', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    const diceLoc = getLocation(character.currentLocation);
    if (!diceLoc?.hasShop) return res.status(403).json({ error: 'A Taverna só existe em cidades.' });

    const { embed } = await rollTavernaDice(character) as any;
    const data = embed?.data || {};
    const fields = data.fields || [];
    const getField = (name: string) => fields.find((f: any) => f.name.includes(name))?.value || '';

    res.json({
      description: data.description,
      yourRoll: getField('Seu Dado'),
      houseRoll: getField('Casa'),
      balance: getField('Saldo'),
    });
  });

  // ── Pescaria: mesmas castFishingLine()/reelFishingLine() de
  // src/rpg/panels/pescaria.ts — cooldown, sessão de isca na água e a
  // tabela real de raridade de peixes (rollFish), tudo real.
  app.get('/api/activities/rpg/fishing', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const stats = computeStats(character);
    const session = await prisma.rpgFishingSession.findUnique({ where: { discordId } });
    const isWaiting = !!(session && session.reelableAt > new Date());
    const isReady = !!(session && session.reelableAt <= new Date());
    const phase = getDayPhase();

    res.json({
      isWaiting, isReady,
      reelableAt: session?.reelableAt ?? null,
      currentEnergy: character.currentEnergy, maxEnergy: stats.maxEnergy,
      energyCost: FISHING_ENERGY_COST,
      phase, phaseInfo: PHASE_INFO[phase],
    });
  });

  app.post('/api/activities/rpg/fishing/cast', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const result = await castFishingLine(character);
    res.json(result);
  });

  app.post('/api/activities/rpg/fishing/reel', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const result = await reelFishingLine(character) as any;
    if (!result.success) return res.json(result);

    const data = result.embed?.data || {};
    res.json({ success: true, title: data.title, description: data.description });
  });

  // ── Missões: diárias/semanais (por servidor, com claimDailyReward/
  // claimWeeklyReward de src/commands/utility/missoes.ts) + missões de
  // classe (claimClassMission de src/rpg/services/class-missions.ts).
  app.get('/api/activities/rpg/missions', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const guildId = await resolveGuildId(req.query.guildId as string | undefined, req.cookies?.selected_guild as string | undefined);

    let daily: any[] = [];
    let weekly: any[] = [];
    if (guildId) {
      await Promise.all([ensureDailyMissions(discordId, guildId), ensureWeeklyMissions(discordId, guildId)]);
      const today = new Date().toISOString().slice(0, 10);
      [daily, weekly] = await Promise.all([
        prisma.dailyMission.findMany({ where: { memberId: discordId, guildId, dateStr: today }, orderBy: { completed: 'asc' } }),
        prisma.weeklyMission.findMany({ where: { memberId: discordId, guildId } , orderBy: { completed: 'asc' } }),
      ]);
    }

    await ensureClassMissions(discordId, character.class);
    const classDateStr = new Date().toISOString().slice(0, 10);
    const classMissions = await prisma.rpgClassMission.findMany({ where: { discordId, dateStr: classDateStr } });

    const dailyOut = daily.map(m => ({ id: m.id, label: DAILY_MISSION_POOL.find((p: any) => p.type === m.type)?.label || m.type, progress: m.progress, target: m.target, completed: m.completed, claimed: m.claimed, xp: m.xpReward, gold: m.coinReward }));
    const weeklyOut = weekly.map(m => ({ id: m.id, label: WEEKLY_MISSION_POOL.find((p: any) => p.type === m.type)?.label || m.type, progress: m.progress, target: m.target, completed: m.completed, claimed: m.claimed, xp: m.xpReward, gold: m.coinReward }));
    const classOut = classMissions.map(m => {
      const tpl = CLASS_MISSIONS.find((t: any) => t.key === m.missionKey);
      return { id: m.id, emoji: tpl?.emoji || '📜', title: tpl?.title || m.missionKey, description: tpl?.description || '', progress: m.progress, target: m.target, completed: m.completed, claimed: m.claimed, xp: m.xpReward, gold: m.goldReward, energy: m.energyReward };
    });

    res.json({ daily: dailyOut, weekly: weeklyOut, classMissions: classOut, hasGuild: !!guildId });
  });

  app.post('/api/activities/rpg/missions/claim', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { missionId, kind } = req.body || {};
    if (!missionId || !kind) return res.status(400).json({ error: 'missionId e kind são obrigatórios' });

    try {
      if (kind === 'class') {
        const result = await claimClassMission(discordId, missionId);
        return res.json(result);
      }
      const guildId = await resolveGuildId(req.body.guildId, req.cookies?.selected_guild as string | undefined);
      if (!guildId) return res.status(400).json({ error: 'Nenhum servidor associado ao bot foi encontrado.' });

      const result = kind === 'weekly'
        ? await claimWeeklyReward(missionId, discordId, guildId)
        : await claimDailyReward(missionId, discordId, guildId);
      res.json(result);
    } catch (err) {
      console.error('[Atividades/RPG] Erro ao coletar missão:', err);
      res.status(500).json({ error: 'Erro ao coletar recompensa.' });
    }
  });

  // ── Cidade: Curar HP — mesma fórmula EXATA de rpgButtonHandler.ts
  // (case 'curandeiro'): cost = max(5, ceil(hpMissing*0.12 + enMissing*0.08)).
  app.get('/api/activities/rpg/heal', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const stats = computeStats(character);
    const hpMissing = stats.maxHp - character.currentHp;
    const enMissing = stats.maxEnergy - character.currentEnergy;
    const cost = Math.max(5, Math.ceil(hpMissing * 0.12 + enMissing * 0.08));
    const full = hpMissing === 0 && enMissing === 0;

    res.json({ hpMissing, enMissing, cost, full, gold: character.gold });
  });

  app.post('/api/activities/rpg/heal', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    const healLoc = getLocation(character.currentLocation);
    if (!healLoc?.hasShop) return res.json({ success: false, message: 'O curandeiro só existe em cidades. Viaje até um assentamento seguro primeiro.' });

    const stats = computeStats(character);
    const hpMissing = stats.maxHp - character.currentHp;
    const enMissing = stats.maxEnergy - character.currentEnergy;
    const cost = Math.max(5, Math.ceil(hpMissing * 0.12 + enMissing * 0.08));

    if (hpMissing === 0 && enMissing === 0) {
      return res.json({ success: false, message: '✅ Você já está com HP e Energia no máximo!' });
    }
    if (character.gold < cost) {
      return res.json({ success: false, message: `Curar custa ${cost} ouro. Você tem apenas ${character.gold} ouro.` });
    }

    const healed = await prisma.rpgCharacter.updateMany({
      where: { discordId, gold: { gte: cost } },
      data: { currentHp: stats.maxHp, currentEnergy: stats.maxEnergy, gold: { decrement: cost }, lastRest: new Date() },
    });
    if (healed.count === 0) return res.json({ success: false, message: 'Seu saldo mudou, tente de novo.' });

    res.json({ success: true, message: `🏥 Curado por completo! −${cost}🪙`, cost });
  });

  // ── Explorar Região: mesma doExplore() de src/rpg/panels/exploracao.ts
  // (diferente de Caçada — é evento aleatório de exploração, sem combate).
  app.get('/api/activities/rpg/explore', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const onCooldown = !!(character.lastExplore && (Date.now() - character.lastExplore.getTime()) < EXPLORE_COOLDOWN_MS);
    const remainingMin = onCooldown ? Math.ceil((EXPLORE_COOLDOWN_MS - (Date.now() - character.lastExplore!.getTime())) / 60000) : 0;

    res.json({ onCooldown, remainingMin, energyCost: EXPLORE_ENERGY_COST, currentEnergy: character.currentEnergy, currentHp: character.currentHp });
  });

  app.post('/api/activities/rpg/explore', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const result = await doExplore(character) as any;
    if (!result.success) return res.json(result);

    const data = result.embed?.data || {};
    res.json({ success: true, title: data.title, description: data.description, fields: data.fields || [] });
  });

  // ── Habilidades Divinas: equipar até 3 (mesma regra do select do Discord),
  // usando DIVINE_SKILLS + a classe do personagem. O rank/XP de cada
  // habilidade é lido direto de RpgLearnedSkill (criado automaticamente na
  // primeira vez, igual buildHabilidadesEmbed faz).
  app.get('/api/activities/rpg/skills', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const cls = getClass(character.class);
    const availableSkills = (cls?.divineSkills || []).map((id: string) => DIVINE_SKILLS[id]).filter(Boolean);

    let learned = await prisma.rpgLearnedSkill.findMany({ where: { characterId: discordId } });
    const learnedMap = new Map(learned.map(s => [s.skillId, s]));
    const toCreate = availableSkills.filter((s: any) => !learnedMap.has(s.id));
    if (toCreate.length > 0) {
      await Promise.all(toCreate.map((s: any) =>
        prisma.rpgLearnedSkill.create({ data: { characterId: discordId, skillId: s.id, rank: 'F', exp: 0 } }).catch(() => null)
      ));
      learned = await prisma.rpgLearnedSkill.findMany({ where: { characterId: discordId } });
    }
    const freshLearnedMap = new Map(learned.map(s => [s.skillId, s]));

    const equippedIds: string[] = Array.isArray(character.equippedSkills)
      ? (character.equippedSkills as string[])
      : (character.divineSkillId ? [character.divineSkillId] : []);

    // Mesma fórmula real do combat.ts: multiplicador dobra por rank
    // (1,2,4,8,16,32,64,128) — não crescimento de 1.5x que eu tinha usado
    // por engano aqui antes.
    const RANK_MULT = [1, 2, 4, 8, 16, 32, 64, 128];
    const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    const skills = availableSkills.map((s: any) => {
      const l = freshLearnedMap.get(s.id);
      const rank = l?.rank ?? 'F';
      const exp = l?.exp ?? 0;
      const rankIndex = Math.max(0, RANKS.indexOf(rank));
      const nextExp = Math.round((s.rankUpExpRequired || 150) * (RANK_MULT[rankIndex] ?? 1));
      return {
        id: s.id, name: s.name, emoji: s.emoji, description: s.description,
        energyCost: s.energyCost, unlockLevel: s.unlockLevel,
        unlocked: character.level >= s.unlockLevel,
        equipped: equippedIds.includes(s.id),
        rank, exp, nextExp,
      };
    });

    res.json({ skills, equippedIds, maxEquip: 3, className: cls?.name || character.class, classEmoji: cls?.emoji || '✨' });
  });

  app.post('/api/activities/rpg/skills/equip', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { skillIds } = req.body || {};
    if (!Array.isArray(skillIds) || skillIds.length < 1 || skillIds.length > 3) {
      return res.status(400).json({ error: 'Selecione de 1 a 3 habilidades.' });
    }

    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const cls = getClass(character.class);
    const availableIds = new Set((cls?.divineSkills || []));
    const validIds = skillIds.filter((id: string) => {
      const skill = DIVINE_SKILLS[id];
      return availableIds.has(id) && skill && character.level >= skill.unlockLevel;
    });
    if (!validIds.length) return res.status(400).json({ error: 'Nenhuma habilidade válida selecionada.' });

    await prisma.rpgCharacter.update({ where: { discordId }, data: { equippedSkills: validIds } });
    res.json({ success: true, message: '✨ Habilidades equipadas para combate com sucesso!' });
  });

  // ── Boss Mundial: mesma getActiveBoss()/attackWorldBoss() de
  // src/rpg/services/worldBoss.ts — HP compartilhado da guilda, cooldown de
  // 5min por jogador, e o ranking de dano vem do mesmo banco. Invocar boss
  // fica de fora por enquanto (é uma ação de staff no Discord); aqui só a
  // participação, que é o que qualquer jogador já faz.
  app.get('/api/activities/rpg/worldboss', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const guildId = await resolveGuildId(req.query.guildId as string | undefined, req.cookies?.selected_guild as string | undefined);
    if (!guildId) return res.json({ boss: null });

    const boss = await getActiveBoss(guildId);
    if (!boss) return res.json({ boss: null });

    const me = boss.participants.find((p: any) => p.discordId === discordId);
    const onCooldown = !!(me?.lastHit && (Date.now() - me.lastHit.getTime()) < 5 * 60 * 1000);
    const cooldownRemMin = onCooldown ? Math.ceil((5 * 60 * 1000 - (Date.now() - me!.lastHit!.getTime())) / 60000) : 0;

    res.json({
      boss: {
        name: boss.name, emoji: boss.emoji, description: boss.description,
        currentHp: boss.currentHp, maxHp: boss.maxHp, level: boss.level,
        hpBar: bossHpBar(boss.currentHp, boss.maxHp),
        leaderboard: boss.participants.map((p: any) => ({ username: p.username, damageDealt: p.damageDealt, hits: p.hits, isMe: p.discordId === discordId })),
      },
      onCooldown, cooldownRemMin,
    });
  });

  app.post('/api/activities/rpg/worldboss/attack', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const username = req.cookies.player_username as string || 'Aventureiro';
    const guildId = await resolveGuildId(req.body?.guildId, req.cookies?.selected_guild as string | undefined);
    if (!guildId) return res.status(400).json({ error: 'Nenhum servidor associado ao bot foi encontrado.' });

    const result = await attackWorldBoss(discordId, username, guildId);
    res.json(result);
  });

  // ── PvP: mesmo sistema de desafio (Aceitar/Recusar) de
  // src/rpg/services/combat.ts — o Map de desafios pendentes é COMPARTILHADO
  // com o Discord (mesmo processo), então um desafio criado num lado aparece
  // pro alvo no outro também.
  app.get('/api/activities/rpg/pvp', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const incoming = getPendingPvpChallenge(discordId);
    const onCooldown = !!(character.lastPvp && (Date.now() - character.lastPvp.getTime()) < 10 * 60 * 1000);
    const cooldownRemMin = onCooldown ? Math.ceil((10 * 60 * 1000 - (Date.now() - character.lastPvp!.getTime())) / 60000) : 0;

    res.json({
      incoming: incoming && incoming.defenderId === discordId ? incoming : null,
      pvpEnabled: character.pvpEnabled,
      pvpWins: character.pvpWins, pvpLosses: character.pvpLosses,
      onCooldown, cooldownRemMin,
    });
  });

  app.post('/api/activities/rpg/pvp/challenge', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { targetId } = req.body || {};
    if (!targetId) return res.status(400).json({ error: 'targetId é obrigatório' });
    if (targetId === discordId) return res.json({ success: false, message: 'Você não pode se desafiar!' });

    const [attacker, defender] = await Promise.all([getCharacter(discordId), getCharacter(targetId)]);
    if (!attacker) return res.status(404).json({ error: 'Seu personagem não foi encontrado' });
    if (!defender) return res.json({ success: false, message: 'Esse jogador ainda não tem personagem de RPG.' });
    if (!attacker.pvpEnabled || !defender.pvpEnabled) return res.json({ success: false, message: 'Um dos jogadores está com PvP desativado.' });

    const onCooldown = attacker.lastPvp && (Date.now() - attacker.lastPvp.getTime()) < 10 * 60 * 1000;
    if (onCooldown) return res.json({ success: false, message: 'Aguarde 10 minutos entre batalhas PvP.' });

    try {
      createPvpChallenge(attacker, defender);
      res.json({ success: true, message: `⚔️ Desafio enviado para ${defender.username}! Ele(a) tem 2 minutos para responder.` });
    } catch (err) {
      if (err instanceof PvpBlockedError) return res.json({ success: false, message: err.message });
      throw err;
    }
  });

  app.post('/api/activities/rpg/pvp/accept', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    try {
      const pvpResult = await resolvePendingPvpChallenge(discordId);
      res.json({ success: true, ...pvpResult });
    } catch (err) {
      if (err instanceof PvpBlockedError) return res.json({ success: false, message: err.message });
      throw err;
    }
  });

  app.post('/api/activities/rpg/pvp/decline', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    declinePvpChallenge(discordId);
    res.json({ success: true });
  });


  // ── Inventário: equipar / usar / vender — usa EXATAMENTE as mesmas
  // funções de src/rpg/services/inventory.ts que os botões do Discord chamam
  // (rpgSelectHandler.ts). Nada de lógica duplicada aqui.
  app.post('/api/activities/rpg/inventory/equip', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório' });
    const result = await equipItem(discordId, itemId);
    res.json(result);
  });

  app.post('/api/activities/rpg/inventory/use', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório' });
    const result = await useConsumable(discordId, itemId);
    res.json(result);
  });

  app.post('/api/activities/rpg/inventory/sell', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { itemId, qty } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório' });
    const result = await sellItem(discordId, itemId, Number(qty) || 1);
    res.json(result);
  });

  // ── Loja: mesmo catálogo (SHOP_CATEGORIES + ITEMS com price > 0) e mesma
  // função de compra (buyItem) usada em src/rpg/panels/shop.ts no Discord.
  app.get('/api/activities/rpg/shop', requirePlayerAuth, async (req, res) => {
    const category = req.query.category as string | undefined;
    if (!category) return res.json({ categories: SHOP_CATEGORIES, items: [] });

    const items = Object.values(ITEMS)
      .filter((i: any) => (i.type === category || i.slot === category) && i.price > 0)
      .map((i: any) => ({ id: i.id, name: i.name, emoji: i.emoji, price: i.price, rarity: i.rarity, description: i.description }));

    res.json({ categories: SHOP_CATEGORIES, items });
  });

  app.post('/api/activities/rpg/shop/buy', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { itemId, qty } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório' });

    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    const loc = getLocation(character.currentLocation);
    if (!loc?.hasShop) return res.json({ success: false, message: 'A loja só existe em cidades. Viaje até um assentamento seguro primeiro.' });

    const result = await buyItem(discordId, itemId, Number(qty) || 1);
    res.json(result);
  });

  // ── Viagem: mesma lista (LOCATION_LIST) e mesma função (travelTo) de
  // src/rpg/panels/travel.ts — respeita custo de energia e cooldown reais.
  app.get('/api/activities/rpg/locations', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const locations = LOCATION_LIST.map(l => ({
      id: l.id, name: l.name, emoji: l.emoji, minLevel: l.minLevel,
      travelCostEnergy: l.travelCostEnergy, hasDungeon: l.hasDungeon,
      isCurrent: l.id === character.currentLocation,
      locked: character.level < l.minLevel,
    }));

    res.json({ locations });
  });

  app.post('/api/activities/rpg/travel', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { destinationId } = req.body || {};
    if (!destinationId) return res.status(400).json({ error: 'destinationId é obrigatório' });

    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const result = await travelTo(character, destinationId);
    res.json(result);
  });

  // ── Pontos de atributo: mesma função de src/rpg/services/character.ts.
  app.post('/api/activities/rpg/points', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { stat, points } = req.body || {};
    const validStats = ['strength', 'agility', 'intelligence', 'vitality', 'luck'];
    if (!validStats.includes(stat)) return res.status(400).json({ error: 'Atributo inválido' });

    const result = await distributeStatPoints(discordId, stat, Number(points) || 1);
    res.json(result);
  });

  // ── Treinar: mesmas TRAIN_OPTIONS e doTrain() de src/rpg/panels/treinar.ts
  // (buffs temporários, cooldown de 20min, custo de energia — tudo real).
  app.get('/api/activities/rpg/train', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const buffs = await getActiveBuffs(discordId);
    const onCooldown = character.lastTrain && (Date.now() - character.lastTrain.getTime()) < 20 * 60 * 1000;
    const cooldownRemMin = onCooldown
      ? Math.ceil((20 * 60 * 1000 - (Date.now() - character.lastTrain!.getTime())) / 60000)
      : 0;

    res.json({
      options: TRAIN_OPTIONS,
      activeBuffs: buffs,
      onCooldown,
      cooldownRemMin,
      currentEnergy: character.currentEnergy,
    });
  });

  app.post('/api/activities/rpg/train', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { statId } = req.body || {};
    if (!statId) return res.status(400).json({ error: 'statId é obrigatório' });

    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const result = await doTrain(character, statId);
    res.json(result);
  });

  // ── Meditar: mesmas MEDITATION_OPTIONS, startMeditation() e
  // collectMeditation() de src/rpg/panels/meditar.ts (bônus de fase do dia
  // real, cooldown de 30min, chance de buff de XP — tudo real).
  app.get('/api/activities/rpg/meditate', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const phase = getDayPhase();
    const isMeditating = !!(character.meditatingUntil && character.meditatingUntil > new Date());
    const isReady = !!(character.meditatingUntil && character.meditatingUntil <= new Date());
    const remainingMin = isMeditating ? Math.ceil((character.meditatingUntil!.getTime() - Date.now()) / 60000) : 0;

    res.json({
      options: MEDITATION_OPTIONS,
      phase,
      phaseInfo: PHASE_INFO[phase],
      isMeditating,
      isReady,
      remainingMin,
      currentHp: character.currentHp,
      currentEnergy: character.currentEnergy,
    });
  });

  app.post('/api/activities/rpg/meditate/start', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const { optionId } = req.body || {};
    if (!optionId) return res.status(400).json({ error: 'optionId é obrigatório' });

    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const result = await startMeditation(character, optionId);
    res.json(result);
  });

  app.post('/api/activities/rpg/meditate/collect', requirePlayerAuth, async (req, res) => {
    const discordId = req.cookies.player_userid as string;
    const character = await getCharacter(discordId);
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const result = await collectMeditation(character);
    res.json(result);
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

  // =====================================================================
  // 🔑 LOGIN DE JOGADOR (separado do login admin do painel!)
  // Qualquer conta do Discord pode entrar aqui — não checa AllianceServerMember.
  // Serve só para as Atividades (RPG, chat) saberem com certeza QUEM é o
  // jogador, sem depender de um ID digitado manualmente (que qualquer um
  // poderia colar e ver/mexer na ficha alheia).
  // =====================================================================
  app.get('/login/player', (req, res) => {
    const next = safePlayerRedirect(req.query.next);
    const state = encodeURIComponent(next);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(dashboardUrl + '/auth/callback/player')}&response_type=code&scope=identify&state=${state}`);
  });

  app.get('/auth/callback/player', async (req, res) => {
    const code = req.query.code as string;
    const next = safePlayerRedirect(req.query.state);
    if (!code) return res.redirect('/login/player');

    try {
      const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: clientId!, client_secret: clientSecret!, grant_type: 'authorization_code', code, redirect_uri: `${dashboardUrl}/auth/callback/player`,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } });
      const { id: userId, username, avatar } = userRes.data;

      res.cookie('player_auth', 'permitido', { maxAge: 86400000, httpOnly: false });
      res.cookie('player_userid', userId, { maxAge: 86400000, httpOnly: false });
      res.cookie('player_username', username, { maxAge: 86400000, httpOnly: false });
      if (avatar) res.cookie('player_avatar', avatar, { maxAge: 86400000, httpOnly: false });

      res.redirect(next);
    } catch (error) {
      console.error('[Login/Player] Erro na autenticação:', error);
      res.status(500).send('Erro na autenticação com o Discord.');
    }
  });

  app.get('/logout/player', (req, res) => {
    res.clearCookie('player_auth');
    res.clearCookie('player_userid');
    res.clearCookie('player_username');
    res.clearCookie('player_avatar');
    res.redirect('/atividades');
  });

  // ── Autenticação dentro de uma Discord Activity (o "foguetinho" na call) ──
  // O código vem do comando authorize() do Embedded App SDK, executado no
  // navegador dentro do iframe da Activity. A troca por token AQUI não leva
  // redirect_uri — é um fluxo diferente do OAuth por redirecionamento comum
  // usado em /auth/callback/player. O resultado são os MESMOS cookies
  // player_*, então tudo que já existe (perfil, loja, combate) funciona sem
  // nenhuma mudança dentro da call.
  app.post('/api/activity/auth', async (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code é obrigatório' });

    try {
      const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: clientId!, client_secret: clientSecret!, grant_type: 'authorization_code', code,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } });
      const { id: userId, username, avatar } = userRes.data;

      res.cookie('player_auth', 'permitido', { maxAge: 86400000, httpOnly: false });
      res.cookie('player_userid', userId, { maxAge: 86400000, httpOnly: false });
      res.cookie('player_username', username, { maxAge: 86400000, httpOnly: false });
      if (avatar) res.cookie('player_avatar', avatar, { maxAge: 86400000, httpOnly: false });

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Activity Auth] Erro ao autenticar:', error?.response?.data || error);
      res.status(500).json({ error: 'Erro ao autenticar dentro da Activity.' });
    }
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
      // Trava de segurança: um intervalo baixo/zero faria o bot atualizar a
      // presença rápido demais e levar rate limit do Discord.
      if (feature === 'botStatusInterval' && finalValue < 10) finalValue = 10;
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
