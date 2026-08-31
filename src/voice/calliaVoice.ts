import {
  AudioPlayer,
  AudioPlayerStatus,
  EndBehaviorType,
  StreamType,
  VoiceConnection,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from '@discordjs/voice';
import { GuildMember, VoiceBasedChannel } from 'discord.js';
import prism from 'prism-media';
import { Readable } from 'node:stream';
import { prisma } from '../database/client';
import axios from 'axios';

export type CalliaPersona = 'bryan' | 'suki' | 'custom';

export type CalliaMemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type CalliaAiHandlers = {
  askBryan: (message: string, username: string, memory: CalliaMemoryMessage[]) => Promise<string>;
  askSuki: (message: string, username: string, memory: CalliaMemoryMessage[]) => Promise<string>;
  askCustomAi: (message: string, username: string, memory: CalliaMemoryMessage[], guildId: string) => Promise<string>;
};

type CalliaSessionOptions = {
  member: GuildMember;
  channel: VoiceBasedChannel;
  persona: CalliaPersona;
  ai: CalliaAiHandlers;
  onStatus?: (message: string) => Promise<void>;
};

type SessionLike = {
  stop(): void;
  setPersona(persona: CalliaPersona): void;
};

const sessions = new Map<string, SessionLike>();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

function requireElevenLabs(): string {
  if (!ELEVENLABS_API_KEY?.trim()) {
    throw new Error('ELEVENLABS_API_KEY não está configurada para transcrição.');
  }
  return ELEVENLABS_API_KEY.trim();
}

function pcmToWav(pcm: Buffer, sampleRate = 48_000, channels = 2): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

// 🎤 O BOT OUVE PELA ELEVENLABS
async function transcribe(wav: Buffer): Promise<string> {
  const apiKey = requireElevenLabs();
  const form = new FormData();

  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'discord-speech.wav');
  form.append('model_id', 'scribe_v1');
  form.append('language_code', 'por');

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`ElevenLabs STT ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = JSON.parse(body) as { text?: string };
  return data.text?.trim() ?? '';
}

// 🤖 MOTOR DE VOZ TRIPLO (TikTok -> StreamElements -> Google)
async function synthesize(text: string, persona: CalliaPersona, guildId: string): Promise<Buffer> {
  let isMale = false;
  
  if (persona === 'bryan') {
    isMale = true;
  } else if (persona === 'custom') {
    try {
      const cfg = await prisma.guildConfig.findUnique({ where: { guildId } });
      if (cfg?.aiCustomVoice && cfg.aiCustomVoice.toLowerCase().startsWith('m')) {
        isMale = true;
      }
    } catch (e) {}
  }

  // Corta em 150 caracteres para respeitar os limites das APIs Gratuitas
  const chunks = text.match(/[\s\S]{1,150}(?!\w)|[\s\S]{1,150}/g) || [text];
  const audioBuffers: Buffer[] = [];

  // ==========================================
  // TENTATIVA 1: TIKTOK TTS (Muito Realista e não bloqueia fácil)
  // ==========================================
  let tiktokFailed = false;
  const tiktokVoice = isMale ? 'br_005' : 'br_001'; // br_005 (Pedro/Masc), br_001 (Júlia/Fem)

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    try {
      const res = await fetch('https://tiktok-tts.weilnet.workers.dev/api/generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk.trim(), voice: tiktokVoice })
      });
      const data = (await res.json()) as { data?: string, error?: string };
      
      if (data.data) {
        audioBuffers.push(Buffer.from(data.data, 'base64'));
        await new Promise(r => setTimeout(r, 200)); // anti-spam
      } else {
        tiktokFailed = true; break;
      }
    } catch (e) {
      tiktokFailed = true; break;
    }
  }

  if (!tiktokFailed && audioBuffers.length > 0) {
    return Buffer.concat(audioBuffers);
  }

  console.log('[CALLIA] TikTok TTS falhou, tentando StreamElements...');
  audioBuffers.length = 0; // Limpa os buffers para tentar de novo

  // ==========================================
  // TENTATIVA 2: STREAMELEMENTS VIA AXIOS (Para burlar bloqueio CF)
  // ==========================================
  let streamElementsFailed = false;
  const seVoice = isMale ? 'Ricardo' : 'Vitoria';

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    try {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=${seVoice}&text=${encodeURIComponent(chunk.trim())}`;
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      audioBuffers.push(Buffer.from(res.data));
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      streamElementsFailed = true;
      break;
    }
  }

  if (!streamElementsFailed && audioBuffers.length > 0) {
    return Buffer.concat(audioBuffers);
  }

  console.log('[CALLIA] StreamElements falhou, ativando Plano C: Google Tradutor');
  audioBuffers.length = 0;

  // ==========================================
  // TENTATIVA 3: GOOGLE TRADUTOR (Fallback final - Só tem voz feminina)
  // ==========================================
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt-BR&q=${encodeURIComponent(chunk.trim())}`;
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      audioBuffers.push(Buffer.from(res.data));
    } catch (e) {}
  }

  return Buffer.concat(audioBuffers);
}

class CalliaSession implements SessionLike {
  private readonly connection: VoiceConnection;
  private readonly player: AudioPlayer;
  private readonly member: GuildMember;
  private readonly ai: CalliaAiHandlers;
  private readonly onStatus?: (message: string) => Promise<void>;
  private persona: CalliaPersona;
  private stopped = false;
  private processing = false;
  private memory: CalliaMemoryMessage[] = [];

  constructor(options: CalliaSessionOptions) {
    this.member = options.member;
    this.persona = options.persona;
    this.ai = options.ai;
    this.onStatus = options.onStatus;
    this.player = createAudioPlayer();
    this.connection = joinVoiceChannel({
      channelId: options.channel.id,
      guildId: options.channel.guild.id,
      adapterCreator: options.channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    this.connection.subscribe(this.player);
    this.listen();
  }

  setPersona(persona: CalliaPersona): void {
    this.persona = persona;
    this.memory = [];
  }

  stop(): void {
    this.stopped = true;
    this.player.stop(true);
    this.connection.destroy();
    sessions.delete(this.member.guild.id);
  }

  private async status(message: string): Promise<void> {
    await this.onStatus?.(message);
  }

  private listen(): void {
    const receiver = this.connection.receiver;

    receiver.speaking.on('start', (userId: string) => {
      if (this.stopped || this.processing || userId !== this.member.id) {
        return;
      }

      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 900,
        },
      });

      const decoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48_000,
      });

      const chunks: Buffer[] = [];

      opusStream
        .pipe(decoder)
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .once('error', (error: Error) => {
          console.error('[CALLIA] Erro ao decodificar voz:', error);
        })
        .once('end', () => {
          void this.processSpeech(pcmToWav(Buffer.concat(chunks)));
        });
    });
  }

  private async processSpeech(wav: Buffer): Promise<void> {
    if (this.stopped || this.processing || wav.length < 44 + 1_500) {
      return;
    }

    this.processing = true;

    try {
      await this.status('Ouvindo...');
      const text = await transcribe(wav);

      if (!text) return;

      const username = this.member.displayName || this.member.user.username;
      
      let aiName = 'Bryan';
      if (this.persona === 'suki') aiName = 'Suki';
      if (this.persona === 'custom') aiName = 'A IA Local';

      await this.status(`${aiName} está pensando...`);
      
      let response = '';
      if (this.persona === 'bryan') {
        response = await this.ai.askBryan(text, username, this.memory);
      } else if (this.persona === 'suki') {
        response = await this.ai.askSuki(text, username, this.memory);
      } else {
        response = await this.ai.askCustomAi(text, username, this.memory, this.member.guild.id);
      }

      this.memory.push(
        { role: 'user', content: text },
        { role: 'assistant', content: response },
      );
      this.memory = this.memory.slice(-8);

      await this.status(`${aiName} está falando...`);

      const audio = await synthesize(response, this.persona, this.member.guild.id);
      const resource = createAudioResource(Readable.from(audio), { inputType: StreamType.Arbitrary });

      this.player.play(resource);

      await new Promise<void>((resolve) => {
        if (this.player.state.status === AudioPlayerStatus.Idle) {
          resolve();
          return;
        }
        const finish = () => {
          this.player.off(AudioPlayerStatus.Idle, finish);
          resolve();
        };
        this.player.once(AudioPlayerStatus.Idle, finish);
      });
    } catch (error) {
      console.error('[CALLIA] Falha no ciclo de voz:', error);
      await this.status('Não consegui processar sua fala.').catch(() => {});
    } finally {
      this.processing = false;
    }
  }
}

export function startCalliaSession(options: CalliaSessionOptions): void {
  sessions.get(options.member.guild.id)?.stop();
  const session = new CalliaSession(options);
  sessions.set(options.member.guild.id, session);
}

export function stopCalliaSession(guildId: string): boolean {
  const session = sessions.get(guildId);
  if (!session) return false;
  session.stop();
  return true;
}

export function changeCalliaPersona(guildId: string, persona: CalliaPersona): boolean {
  const session = sessions.get(guildId);
  if (!session) return false;
  session.setPersona(persona);
  return true;
}
