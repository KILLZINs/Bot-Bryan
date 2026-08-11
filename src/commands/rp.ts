import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  EmbedBuilder, GuildMember,
} from 'discord.js';
import { Command } from '../types';
import { prisma } from '../database/client';
import { COLORS } from '../utils/embeds';
import { getBotConfig } from '../utils/botConfig';
import { applyTemplate } from '../utils/embedTemplates';

// ─── GIF LIBRARY ────────────────────────────────────────────────────────────

const FALLBACK: Record<string, string[]> = {
  abracar:          ['https://media.tenor.com/GCpA2vTg06IAAAAC/anime-hug.gif','https://media.tenor.com/Y0nwWvRMzFwAAAAC/hug-anime.gif','https://media.tenor.com/oiCi-p0r0KEAAAAC/hug-anime.gif'],
  beijar:           ['https://media.tenor.com/G8k1WEK2XYQAAAAC/anime-kiss.gif','https://media.tenor.com/kMYc7tHwT80AAAAC/anime-kiss.gif','https://media.tenor.com/Ly4j56jDO-0AAAAC/kiss-anime.gif'],
  cafune:           ['https://media.tenor.com/BuWq9PmT7XMAAAAC/headpat-anime.gif','https://media.tenor.com/LYJTTxOOoZsAAAAC/headpat-anime.gif','https://media.tenor.com/JBzCOBkxMwsAAAAC/anime-headpat.gif'],
  tapa:             ['https://media.tenor.com/S3vWZnM4C7sAAAAC/anime-slap.gif','https://media.tenor.com/0TKCe7dCHIUAAAAC/slap-anime.gif','https://media.tenor.com/0K7rPsYJSksAAAAC/slap-hard-anime.gif'],
  morder:           ['https://media.tenor.com/IpgBjX9HXicAAAAC/anime-bite.gif','https://media.tenor.com/TGS6BrU9BQIAAAAC/bite-anime.gif','https://media.tenor.com/nFy1Y3o5nZIAAAAC/anime-bite.gif'],
  chorar:           ['https://media.tenor.com/5I3A-FaXr_EAAAAC/anime-cry.gif','https://media.tenor.com/Q_lFhv5vNikAAAAC/cry-anime.gif','https://media.tenor.com/cMNFMnwJGX4AAAAC/anime-sad-cry.gif'],
  dancar:           ['https://media.tenor.com/tT_6VGSiN9gAAAAC/anime-dance.gif','https://media.tenor.com/L_JzuKCHtKwAAAAC/anime-dance.gif','https://media.tenor.com/sXJFMPpXeIcAAAAC/anime-dancing.gif'],
  rir:              ['https://media.tenor.com/9DmMHBuoaqsAAAAC/anime-laugh.gif','https://media.tenor.com/5R1QLiGV-o8AAAAC/laughing-anime.gif','https://media.tenor.com/klGr5r3lzCkAAAAC/anime-laugh.gif'],
  acenar:           ['https://media.tenor.com/r5v68rZ-ND8AAAAC/anime-wave.gif','https://media.tenor.com/IlBaIqSxrqcAAAAC/wave-anime.gif','https://media.tenor.com/tnMCgpF2VcwAAAAC/wave-hi-anime.gif'],
  cutucar:          ['https://media.tenor.com/MbZMerYLsEkAAAAC/anime-poke.gif','https://media.tenor.com/8q0n3VoO9N0AAAAC/poke-anime.gif','https://media.tenor.com/c7Oc8RTtNB4AAAAC/anime-poke.gif'],
  aconchegar:       ['https://media.tenor.com/tGJFb9CYpXgAAAAC/cuddle-anime.gif','https://media.tenor.com/zQECaWPZ_cYAAAAC/anime-cuddle.gif','https://media.tenor.com/FGK58e24Pq0AAAAC/cuddle.gif'],
  highfive:         ['https://media.tenor.com/r5v68rZ-ND8AAAAC/anime-high-five.gif','https://media.tenor.com/M8MbLIjI5GEAAAAC/high-five-anime.gif'],
  piscar:           ['https://media.tenor.com/JHHLIaMJSVkAAAAC/anime-wink.gif','https://media.tenor.com/nQa2HO64_8QAAAAC/wink-anime.gif'],
  dormir:           ['https://media.tenor.com/Y4PwCn5G2YsAAAAC/sleep-anime.gif','https://media.tenor.com/TqnFpMzMG4QAAAAC/anime-sleeping.gif','https://media.tenor.com/0lHD2vToJnIAAAAC/anime-sleep.gif'],
  dedo_legal:       ['https://media.tenor.com/VTXNyVl6Yq0AAAAC/thumbs-up-anime.gif','https://media.tenor.com/5kqU_K5R7CMAAAAC/anime-thumbs-up.gif'],
  beber:            ['https://media.tenor.com/5MN4nA5_hIIAAAAC/anime-drink.gif','https://media.tenor.com/dxTgMiCLNUcAAAAC/anime-drinking.gif'],
  recusar:          ['https://media.tenor.com/yFi3KfGOuLEAAAAC/anime-no.gif','https://media.tenor.com/9g2j0dAXGqYAAAAC/no-anime.gif'],
  chutar:           ['https://media.tenor.com/O6DKqvPVNWsAAAAC/kick-anime.gif','https://media.tenor.com/ZBR6iLlMICoAAAAC/anime-kick.gif'],
  apontar:          ['https://media.tenor.com/4Q0-tBJoiTwAAAAC/anime-point.gif','https://media.tenor.com/HlLqBlWq27wAAAAC/point-anime.gif'],
  // ─── Novas ações SFW ────────────────────────────────────────────────────────────
  abraco_por_tras:  ['https://media.tenor.com/j-ICDRD6QRMAAAAC/anime-hug.gif','https://media.tenor.com/KGQGKNzMzMMAAAAC/hug-from-behind-anime.gif','https://media.tenor.com/tGJFb9CYpXgAAAAC/cuddle-anime.gif'],
  proteger:         ['https://media.tenor.com/GCpA2vTg06IAAAAC/anime-hug.gif','https://media.tenor.com/Y0nwWvRMzFwAAAAC/hug-anime.gif','https://media.tenor.com/JBzCOBkxMwsAAAAC/anime-headpat.gif'],
  confortar:        ['https://media.tenor.com/GCpA2vTg06IAAAAC/anime-hug.gif','https://media.tenor.com/tGJFb9CYpXgAAAAC/cuddle-anime.gif','https://media.tenor.com/Y0nwWvRMzFwAAAAC/hug-anime.gif'],
  corar:            ['https://media.tenor.com/klGr5r3lzCkAAAAC/anime-laugh.gif','https://media.tenor.com/5I3A-FaXr_EAAAAC/anime-cry.gif','https://media.tenor.com/Q_lFhv5vNikAAAAC/cry-anime.gif'],
  ninar:            ['https://media.tenor.com/TqnFpMzMG4QAAAAC/anime-sleeping.gif','https://media.tenor.com/Y4PwCn5G2YsAAAAC/sleep-anime.gif','https://media.tenor.com/0lHD2vToJnIAAAAC/anime-sleep.gif'],
  pegar_no_colo:    ['https://media.tenor.com/tGJFb9CYpXgAAAAC/cuddle-anime.gif','https://media.tenor.com/FGK58e24Pq0AAAAC/cuddle.gif','https://media.tenor.com/GCpA2vTg06IAAAAC/anime-hug.gif'],
  xingar_carinhoso: ['https://media.tenor.com/5I3A-FaXr_EAAAAC/anime-cry.gif','https://media.tenor.com/9DmMHBuoaqsAAAAC/anime-laugh.gif','https://media.tenor.com/klGr5r3lzCkAAAAC/anime-laugh.gif'],
  suspirar:         ['https://media.tenor.com/TqnFpMzMG4QAAAAC/anime-sleeping.gif','https://media.tenor.com/Q_lFhv5vNikAAAAC/cry-anime.gif'],
  // ─── 18+ / sugestivo ───────────────────────────────────────────────────────────────
  sarrar:           ['https://media.tenor.com/Fxt79qS2XNIAAAAC/anime-dancing.gif','https://media.tenor.com/3-W2-2u-BRIAAAAC/anime-dance-sexy.gif','https://media.tenor.com/sXJFMPpXeIcAAAAC/anime-dance.gif'],
  beijo_triplo:     ['https://media.tenor.com/jj8j8Jrfg2cAAAAC/anime-kiss-three.gif','https://media.tenor.com/G8k1WEK2XYQAAAAC/anime-kiss.gif','https://media.tenor.com/Ly4j56jDO-0AAAAC/kiss-anime.gif'],
  trisal:           ['https://media.tenor.com/zj4XXo0Haj8AAAAC/anime-kiss-couple.gif','https://media.tenor.com/jj8j8Jrfg2cAAAAC/anime-kiss-three.gif'],
  morder_pescoco:   ['https://media.tenor.com/TGS6BrU9BQIAAAAC/bite-anime.gif','https://media.tenor.com/nFy1Y3o5nZIAAAAC/anime-bite.gif','https://media.tenor.com/IpgBjX9HXicAAAAC/anime-bite.gif'],
  seduzir:          ['https://media.tenor.com/3-W2-2u-BRIAAAAC/anime-dance-sexy.gif','https://media.tenor.com/Fxt79qS2XNIAAAAC/anime-dancing.gif'],
};

const NEKOS_CATEGORY: Record<string, string> = {
  abracar: 'hug',      beijar: 'kiss',    cafune: 'pat',       tapa: 'slap',
  morder: 'bite',      chorar: 'cry',     dancar: 'dance',     rir: 'laugh',
  acenar: 'wave',      cutucar: 'poke',   aconchegar: 'cuddle',
  highfive: 'highfive',piscar: 'wink',    dormir: 'sleep',
  dedo_legal: 'thumbsup', recusar: 'nope', beber: 'nom',       chutar: 'kick',
  // Novas
  abraco_por_tras: 'hug', proteger: 'hug', confortar: 'hug',
  corar: 'blush',    ninar: 'sleep',    pegar_no_colo: 'cuddle',
};

const WAIFU_CATEGORY: Record<string, string> = {
  apontar:        'stare',
  sarrar:         'dance',
  beijo_triplo:   'kiss',
  trisal:         'kiss',
  morder_pescoco: 'bite',
  seduzir:        'smug',
  suspirar:       'sad',
  xingar_carinhoso: 'pout',
  corar:          'blush',
};

const OTAKU_CATEGORY: Record<string, string> = {
  abracar: 'hug',   beijar: 'kiss',    cafune: 'pat',
  tapa: 'slap',     morder: 'bite',    chorar: 'cry',
  dancar: 'dance',  rir: 'laugh',      acenar: 'wave',
  cutucar: 'poke',  aconchegar:'cuddle', piscar: 'wink',
  dormir: 'zzz',    beber: 'sip',      recusar: 'nope',
  chutar: 'kick',   apontar: 'stare',
  sarrar: 'dance',  beijo_triplo:'kiss', trisal: 'kiss',
  morder_pescoco:'bite', seduzir: 'smug',
  abraco_por_tras: 'hug', confortar: 'hug', corar: 'blush',
};

async function tryApi(url: string, extract: (d: any) => string | undefined): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const data = await res.json();
    const extracted = extract(data);
    return extracted ?? null;
  } catch { return null; }
}

async function fetchGif(action: string): Promise<string> {
  const nekoCat = NEKOS_CATEGORY[action];
  if (nekoCat) {
    const url = await tryApi(`https://nekos.best/api/v2/${nekoCat}?amount=1`, d => d?.results?.[0]?.url);
    if (url) return url;
  }
  
  const waifuCat = WAIFU_CATEGORY[action];
  if (waifuCat) {
    const url = await tryApi(`https://api.waifu.pics/sfw/${waifuCat}`, d => d?.url);
    if (url) return url;
  }
  
  const otakuCat = OTAKU_CATEGORY[action];
  if (otakuCat) {
    const url = await tryApi(`https://api.otakugifs.xyz/gif?reaction=${otakuCat}`, d => d?.url);
    if (url) return url;
  }
  
  const fallbacks = FALLBACK[action] ?? FALLBACK.abracar;
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ─── MESSAGE BUILDER ───────────────────────────────────────────────────────────────

type Gender = 'M' | 'F' | 'NB';

function article(g: Gender, cap = false): string {
  if (g === 'M')  return cap ? 'O' : 'o';
  if (g === 'F')  return cap ? 'A' : 'a';
  return '';
}

function pronoun(g: Gender): string {
  if (g === 'M') return 'ele';
  if (g === 'F') return 'ela';
  return 'elu';
}

interface MsgDef {
  solo?: string;
  paired: string;
  paired_mm?: string;
  paired_ff?: string;
  paired_mf?: string;
  paired_fm?: string;
  triple?: string;
  color: number;
  nsfw?: boolean;
}

const ACTIONS: Record<string, MsgDef> = {
  // SFW originais
  abracar:          { color: COLORS.PRIMARY, paired: '**{art_S}{S}** deu um abraço quentinho em **{art_T}{T}**! 🤗', paired_mf: '**O {S}** apertou **a {T}** com muito carinho! 🤗', paired_fm: '**A {S}** abraçou **o {T}** com força! 🤗', paired_mm: '**{S}** e **{T}** trocaram um abraço de boracha! 💪', paired_ff: '**{S}** e **{T}** se abraçaram carinhosamente! 🤗' },
  beijar:           { color: COLORS.ERROR,  paired: '**{art_S}{S}** beijou **{art_T}{T}**! 💋', paired_mf: '**O {S}** deu um beijo em **a {T}**! 😘', paired_fm: '**A {S}** beijou **o {T}** de forma apaixonada! 😘', paired_mm: '**{S}** deu um beijo em **{T}**! 😘', paired_ff: '**{S}** e **{T}** se beijaram! 💋' },
  cafune:           { color: COLORS.PRIMARY, paired: '**{art_S}{S}** fez cafuné em **{art_T}{T}**! 🥰', paired_mf: '**O {S}** fez cafuné em **a {T}** com amor! 🥰', paired_fm: '**A {S}** fez cafuné em **o {T}**! 🥰', paired_mm: '**{S}** fez cafuné em **{T}**! 🥰', paired_ff: '**{S}** fez cafuné em **{T}**! 🥰' },
  tapa:             { color: COLORS.ERROR,  paired: '**{art_S}{S}** deu um tapa em **{art_T}{T}**! 👋', paired_mf: '**O {S}** deu um tapa em **a {T}**! Tá bem merecido? 🤣', paired_fm: '**A {S}** deu um tapa em **o {T}**! 😤', paired_mm: '**{S}** deu um tapa em **{T}**! 👋', paired_ff: '**{S}** deu um tapa em **{T}**! 👋' },
  morder:           { color: COLORS.WARNING, paired: '**{art_S}{S}** mordeu **{art_T}{T}**! 😤', paired_mf: '**O {S}** mordeu **a {T}**! Cuidado! 😈', paired_fm: '**A {S}** mordeu **o {T}**! Cuidado! 😈', paired_mm: '**{S}** mordeu **{T}**! 😤', paired_ff: '**{S}** mordeu **{T}**! 😤' },
  chorar:           { color: COLORS.INFO,   solo: '**{art_S}{S}** está chorando... 😢 Alguém dê um abraço!', paired: '**{art_S}{S}** está chorando no ombro de **{art_T}{T}** 😢' },
  dancar:           { color: COLORS.GOLD,   solo: '**{art_S}{S}** está dançando! 🕺', paired: '**{art_S}{S}** está dançando com **{art_T}{T}**! 💃🕺', paired_mf: '**O {S}** dançando com **a {T}**! 💃🕺', paired_fm: '**A {S}** dançando com **o {T}**! 💃🕺', paired_mm: '**{S}** e **{T}** estão dançando! 🕺', paired_ff: '**{S}** e **{T}** estão dançando! 💃' },
  rir:              { color: COLORS.GOLD,   solo: '**{art_S}{S}** está morrendo de rir! 😂', paired: '**{art_S}{S}** está rindo de **{art_T}{T}** 😂' },
  acenar:           { color: COLORS.SUCCESS, solo: '**{art_S}{S}** está acenando! 👋', paired: '**{art_S}{S}** acenou para **{art_T}{T}**! 👋' },
  cutucar:          { color: COLORS.WARNING, paired: '**{art_S}{S}** cutucou **{art_T}{T}**! 👉', paired_mf: '**O {S}** cutucou **a {T}** com o dedo! 👉', paired_fm: '**A {S}** ficou cutucando **o {T}**! 👉', paired_mm: '**{S}** cutucou **{T}**! 👉', paired_ff: '**{S}** cutucou **{T}**! 👉' },
  aconchegar:       { color: COLORS.PRIMARY, paired: '**{art_S}{S}** se aninhou com **{art_T}{T}**! 🥰', paired_mf: '**O {S}** se aninhou com **a {T}** no sofá! 🥰', paired_fm: '**A {S}** se aninhou com **o {T}**! 🥰', paired_mm: '**{S}** se aninhou com **{T}**! 🥰', paired_ff: '**{S}** se aninhou com **{T}**! 🥰' },
  highfive:         { color: COLORS.SUCCESS, paired: '**{art_S}{S}** deu um high five em **{art_T}{T}**! ✋🙌' },
  piscar:           { color: COLORS.INFO,   solo: '**{art_S}{S}** está piscando para você! 😉', paired: '**{art_S}{S}** piscou para **{art_T}{T}**! 😉', paired_mf: '**O {S}** piscou gostoso para **a {T}**! 😉', paired_fm: '**A {S}** piscou para **o {T}**! 😉', paired_mm: '**{S}** piscou para **{T}**! 😉', paired_ff: '**{S}** piscou para **{T}**! 😉' },
  dormir:           { color: COLORS.DARK,   solo: '**{art_S}{S}** foi dormir! 😴 Boas noites~', paired: '**{art_S}{S}** adormeceu no colo de **{art_T}{T}**! 😴' },
  dedo_legal:       { color: COLORS.SUCCESS, solo: '**{art_S}{S}** mandou um joinha! 👍', paired: '**{art_S}{S}** mandou um joinha para **{art_T}{T}**! 👍' },
  beber:            { color: COLORS.WARNING, solo: '**{art_S}{S}** está bebendo! 🍺 Saúde!', paired: '**{art_S}{S}** brindou com **{art_T}{T}**! 🍻 Saúde!' },
  recusar:          { color: COLORS.ERROR,  solo: '**{art_S}{S}** recusou! ❌', paired: '**{art_S}{S}** recusou **{art_T}{T}**! ❌' },
  chutar:           { color: COLORS.ERROR,  paired: '**{art_S}{S}** chutou **{art_T}{T}**! 🦵💥', paired_mf: '**O {S}** chutou **a {T}** 💥', paired_fm: '**A {S}** deu um chute voador em **o {T}**! 💥', paired_mm: '**{S}** chutou **{T}**! 🦵💥', paired_ff: '**{S}** chutou **{T}**! 🦵💥' },
  apontar:          { color: COLORS.WARNING, paired: '**{art_S}{S}** está apontando para **{art_T}{T}**! 👉', paired_mf: '**O {S}** apontou o dedo para **a {T}** 👉', paired_fm: '**A {S}** apontou para **o {T}** 👉', paired_mm: '**{S}** apontou para **{T}**! 👉', paired_ff: '**{S}** apontou para **{T}**! 👉' },
  // ─── Novas SFW ────────────────────────────────────────────────────────────────────
  abraco_por_tras:  { color: COLORS.PRIMARY, paired: '**{art_S}{S}** deu um abraço por trás em **{art_T}{T}**! 🫂💕', paired_mf: '**O {S}** abraçou **a {T}** por trás de surpresa! 🫂', paired_fm: '**A {S}** abraçou **o {T}** por trás! 🫂💕', paired_mm: '**{S}** abraçou **{T}** por trás! 🫂', paired_ff: '**{S}** abraçou **{T}** por trás! 🫂' },
  proteger:         { color: 0x3498DB,       paired: '**{art_S}{S}** protegeu **{art_T}{T}** com o próprio corpo! 🛡️💙', paired_mf: '**O {S}** colocou o corpo na frente de **a {T}**! 🛡️', paired_fm: '**A {S}** se colocou na frente de **o {T}** para protegê-lo! 🛡️💙', paired_mm: '**{S}** protegeu **{T}**! 🛡️', paired_ff: '**{S}** protegeu **{T}**! 🛡️💙' },
  confortar:        { color: 0x9B59B6,       paired: '**{art_S}{S}** está confortando **{art_T}{T}**... 🫂💜', paired_mf: '**O {S}** passou o braço em torno de **a {T}** com gentileza! 💜', paired_fm: '**A {S}** confortou **o {T}**... 🫂💜', paired_mm: '**{S}** confortou **{T}**! 🫂', paired_ff: '**{S}** confortou **{T}**! 🫂💜' },
  corar:            { color: 0xFF69B4,        solo: '**{art_S}{S}** está corando! 😳🌸', paired: '**{art_S}{S}** corou de **{art_T}{T}**! 😳', paired_mf: '**O {S}** ficou todo vermelho perto de **a {T}**! 😳', paired_fm: '**A {S}** ficou corada perto de **o {T}**! 😳', paired_mm: '**{S}** corou perto de **{T}**! 😳', paired_ff: '**{S}** corou perto de **{T}**! 😳🌸' },
  ninar:            { color: COLORS.DARK,   paired: '**{art_S}{S}** está ninando **{art_T}{T}**... 🌙🎵', paired_mf: '**O {S}** está cantando de ninar para **a {T}** adormecer! 🌙', paired_fm: '**A {S}** está ninando **o {T}**... 🌙🎵', paired_mm: '**{S}** está ninando **{T}**... 🌙', paired_ff: '**{S}** está ninando **{T}**... 🌙🎵' },
  pegar_no_colo:    { color: COLORS.PRIMARY, paired: '**{art_S}{S}** pegou **{art_T}{T}** no colo! 🤗💕', paired_mf: '**O {S}** carregou **a {T}** no colo! 💑', paired_fm: '**A {S}** pegou **o {T}** no colo! 🤗💕', paired_mm: '**{S}** pegou **{T}** no colo! 🤗', paired_ff: '**{S}** pegou **{T}** no colo! 🤗💕' },
  xingar_carinhoso: { color: COLORS.WARNING, solo: '**{art_S}{S}** está sendo grosseirinho(a) de amor! 😤💕', paired: '**{art_S}{S}** xingou **{art_T}{T}** carinhosamente! 😤💕', paired_mf: '**O {S}** xingou **a {T}** de um jeito fofo! 😤', paired_fm: '**A {S}** xingou **o {T}** com carinho! 😤💕', paired_mm: '**{S}** xingou **{T}** carinhosamente! 😤', paired_ff: '**{S}** xingou **{T}** carinhosamente! 😤💕' },
  suspirar:         { color: COLORS.INFO,   solo: '**{art_S}{S}** deu um suspiro profundo... 😮‍💨', paired: '**{art_S}{S}** suspirou olhando para **{art_T}{T}**... 😮‍💨💕' },
  // ─── 18+ ──────────────────────────────────────────────────────────────────────────
  sarrar:           { color: COLORS.ERROR, nsfw: true, paired: '**{art_S}{S}** sarrou em **{art_T}{T}**! 😏🔥', paired_mf: '**O {S}** sarrou gostoso em **a {T}**! 🔥😏', paired_fm: '**A {S}** sarrou em **o {T}**! 😏🔥', paired_mm: '**{S}** sarrou em **{T}**! 😏', paired_ff: '**{S}** sarrou em **{T}**! 😏🔥' },
  beijo_triplo:     { color: COLORS.ERROR, nsfw: true, solo: '**{art_S}{S}** quer dar um beijo triplo mas não tem ninguém aqui! 😅💋', paired: '**{art_S}{S}** tentou um beijo triplo mas só dois! 😅💋', triple: '**{S}**, **{T}** e **{T2}** trocaram um beijo triplo! 🔥😘' },
  trisal:           { color: COLORS.ERROR, nsfw: true, solo: '**{art_S}{S}** quer um trisal mas não tem ninguém disponível! 😅😈', paired: '**{art_S}{S}** convidou **{art_T}{T}** para um trisal! 😏', triple: '**{S}**, **{T}** e **{T2}** estão em um trisal! 🔥😈' },
  morder_pescoco:   { color: COLORS.ERROR, nsfw: true, paired: '**{art_S}{S}** mordeu o pescoço de **{art_T}{T}**! 🦷😈🔥', paired_mf: '**O {S}** mordeu o pescoço de **a {T}** de forma irresistível! 🦷🔥', paired_fm: '**A {S}** mordeu o pescoço de **o {T}**! 🦷😈🔥', paired_mm: '**{S}** mordeu o pescoço de **{T}**! 🦷😈', paired_ff: '**{S}** mordeu o pescoço de **{T}**! 🦷😈🔥' },
  seduzir:          { color: COLORS.ERROR, nsfw: true, solo: '**{art_S}{S}** está seduzindo geral! 😏🔥', paired: '**{art_S}{S}** está seduzindo **{art_T}{T}**! 😏🔥', paired_mf: '**O {S}** está seduzindo **a {T}** irresistivelmente! 😏🔥', paired_fm: '**A {S}** está seduzindo **o {T}**! 😏🔥', paired_mm: '**{S}** está seduzindo **{T}**! 😏', paired_ff: '**{S}** está seduzindo **{T}**! 😏🔥' },
};

function buildMessage(
  def: MsgDef,
  sUser: string, sGen: Gender,
  tUser?: string, tGen?: Gender,
  t2User?: string, t2Gen?: Gender,
): string {
  const artS  = article(sGen);
  const artT  = tGen  ? article(tGen)  : '';
  const artT2 = t2Gen ? article(t2Gen) : '';

  const replacements = (tmpl: string): string => {
    const result = tmpl
      .replace(/{art_S}/g,  artS  ? `${artS} `  : '')
      .replace(/{S}/g,  sUser)
      .replace(/{art_T}/g,  artT  ? `${artT} `  : '')
      .replace(/{T}/g,  tUser  ?? '')
      .replace(/{art_T2}/g, artT2 ? `${artT2} ` : '')
      .replace(/{T2}/g, t2User ?? '');
    return result.replace(/^(\*+)([a-záéíóú])/i, (_, stars, letter) => stars + letter.toUpperCase());
  };

  if (t2User && def.triple) return replacements(def.triple);
  if (!tUser) return replacements(def.solo ?? def.paired);

  const combo = `${sGen}_${tGen}`;
  const exactCombo: string | undefined =
    combo === 'M_F' ? def.paired_mf :
    combo === 'F_M' ? def.paired_fm :
    combo === 'M_M' ? def.paired_mm :
    combo === 'F_F' ? def.paired_ff : undefined;

  if (exactCombo) return replacements(exactCombo);
  return replacements(def.paired);
}

// ─── COMMAND ──────────────────────────────────────────────────────────────────────────

export default {
  category: 'roleplay',
  data: new SlashCommandBuilder()
    .setName('rp')
    .setDescription('Comandos de roleplay com GIFs animados e mensagens baseadas em gênero')
    .addStringOption(o =>
      o.setName('acao')
        .setDescription('Ação de roleplay clássica')
        .setRequired(false)
        .addChoices(
          // SFW originais
          { name: '🤗 Abraçar',          value: 'abracar' },
          { name: '😘 Beijar',           value: 'beijar' },
          { name: '🥰 Cafuné',           value: 'cafune' },
          { name: '👋 Tapa',             value: 'tapa' },
          { name: '😤 Morder',           value: 'morder' },
          { name: '😢 Chorar',           value: 'chorar' },
          { name: '💃 Dançar',           value: 'dancar' },
          { name: '😂 Rir',              value: 'rir' },
          { name: '👋 Acenar',           value: 'acenar' },
          { name: '👉 Cutucar',          value: 'cutucar' },
          { name: '🥰 Aconchegar',       value: 'aconchegar' },
          { name: '✋ High Five',         value: 'highfive' },
          { name: '😉 Piscar',           value: 'piscar' },
          { name: '😴 Dormir',           value: 'dormir' },
          { name: '👍 Dedo Legal',        value: 'dedo_legal' },
          { name: '🍺 Beber',            value: 'beber' },
          { name: '❌ Recusar',           value: 'recusar' },
          { name: '🦵 Chutar',           value: 'chutar' },
          { name: '👉 Apontar',          value: 'apontar' },
          // 18+ (em canal NSFW)
          { name: '🔥 Sarrar',           value: 'sarrar' },
          { name: '💋 Beijo Triplo',     value: 'beijo_triplo' },
          { name: '💕 Trisal',           value: 'trisal' },
          { name: '🦷 Morder Pescoço',   value: 'morder_pescoco' },
          { name: '😏 Seduzir',          value: 'seduzir' },
          { name: '🫂 Abraço por Trás',  value: 'abraco_por_tras' },
        )
    )
    .addStringOption(o =>
      o.setName('acao_especial')
        .setDescription('Ações especiais de roleplay')
        .setRequired(false)
        .addChoices(
          { name: '🛡️ Proteger',          value: 'proteger' },
          { name: '💜 Confortar',          value: 'confortar' },
          { name: '😳 Corar',              value: 'corar' },
          { name: '🌙 Ninar',              value: 'ninar' },
          { name: '🤗 Pegar no Colo',     value: 'pegar_no_colo' },
          { name: '😤 Xingar Carinhoso',  value: 'xingar_carinhoso' },
          { name: '😮‍💨 Suspirar',         value: 'suspirar' },
        )
    )
    .addUserOption(o => o.setName('alvo').setDescription('Quem você quer atingir').setRequired(false))
    .addUserOption(o => o.setName('alvo2').setDescription('Segundo alvo (trisal / beijo triplo)').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const { isFeatureEnabled, featureDisabledMsg } = await import('../utils/features');
    if (interaction.guildId && !(await isFeatureEnabled(interaction.guildId, 'featSocial'))) {
      return interaction.reply({ content: featureDisabledMsg('featSocial'), ephemeral: true });
    }

    const acao     = (interaction.options.getString('acao') ?? interaction.options.getString('acao_especial')) as keyof typeof ACTIONS | null;
    if (!acao) {
      return interaction.reply({ content: '❌ Escolha uma ação! Use `/rp acao:` ou `/rp acao_especial:`', ephemeral: true });
    }

    let   targetU  = interaction.options.getUser('alvo');
    let   target2U = interaction.options.getUser('alvo2');
    if (!targetU && target2U) { targetU = target2U; target2U = null; }
    const def      = ACTIONS[acao];
    if (!def) return interaction.reply({ content: 'Ação inválida.', ephemeral: true });

    await interaction.deferReply();

    const [senderDb, targetDb, target2Db] = await Promise.all([
      prisma.member.findUnique({ where: { discordId: interaction.user.id } }),
      targetU  ? prisma.member.findUnique({ where: { discordId: targetU.id  } }) : null,
      target2U ? prisma.member.findUnique({ where: { discordId: target2U.id } }) : null,
    ]);

    const sGen  = (senderDb?.gender  ?? 'NB') as Gender;
    const tGen  = (targetDb?.gender  ?? 'NB') as Gender;
    const t2Gen = (target2Db?.gender ?? 'NB') as Gender;

    const gifUrl  = await fetchGif(acao);
    const message = buildMessage(
      def,
      interaction.user.toString(), sGen,
      targetU  ? targetU.toString()  : undefined, tGen,
      target2U ? target2U.toString() : undefined, t2Gen,
    );

    const embed = new EmbedBuilder()
      .setColor(def.color)
      .setDescription(message)
      .setImage(gifUrl)
      .setFooter({ text: getBotConfig().rpFooterText })
      .setTimestamp();

    applyTemplate(embed, 'rp');
    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;
