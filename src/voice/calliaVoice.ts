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
import WebSocket from 'ws';
import { randomBytes } from 'node:crypto';

export type CalliaPersona = 'bryan' | 'suki';

export type CalliaMemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type CalliaAiHandlers = {
  askBryan: (
    message: string,
    username: string,
    memory: CalliaMemoryMessage[],
  ) => Promise<string>;
  askSuki: (
    message: string,
    username: string,
    memory: CalliaMemoryMessage[],
  ) => Promise<string>;
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

// 🎤 O BOT OUVE PELA ELEVENLABS (Perfeito e nativo)
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

// 🤖 O BOT FALA PELA MICROSOFT EDGE (Com disfarce anti-403)
async function synthesize(text: string, persona: CalliaPersona): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const voice =
      persona === 'bryan'
        ? process.env.BRYAN_EDGE_VOICE ?? 'pt-BR-AntonioNeural'
        : process.env.SUKI_EDGE_VOICE ?? 'pt-BR-FranciscaNeural';

    const pitch = persona === 'bryan' ? '-5Hz' : '+3Hz';
    const rate = persona === 'bryan' ? '-3%' : '+5%';
    const safeText = text.slice(0, 1200).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 💡 O SEGREDO ESTÁ AQUI: Passamos os Headers fingindo ser o Navegador Edge!
    const ws = new WebSocket('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4', {
      headers: {
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      }
    });

    const reqId = randomBytes(16).toString('hex');
    const audioChunks: Buffer[] = [];

    ws.on('open', () => {
      ws.send(`X-Timestamp:${new Date().toUTCString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
      
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}'>${safeText}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data: any, isBinary: boolean) => {
      if (isBinary) {
        const buffer = data as Buffer;
        const headerLength = buffer.readUInt16BE(0);
        const audioData = buffer.subarray(2 + headerLength);
        if (audioData.length > 0) {
          audioChunks.push(audioData);
        }
      } else {
        const str = data.toString();
        if (str.includes('Path:turn.end')) {
          ws.close();
          resolve(Buffer.concat(audioChunks));
        }
      }
    });

    ws.on('error', (err) => {
      ws.close();
      reject(err);
    });
  });
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

      if (!text) {
        return;
      }

      const username = this.member.displayName || this.member.user.username;
      const ask = this.persona === 'bryan' ? this.ai.askBryan : this.ai.askSuki;

      await this.status(`${this.persona === 'bryan' ? 'Bryan' : 'Suki'} está pensando...`);
      const response = await ask(text, username, this.memory);

      this.memory.push(
        { role: 'user', content: text },
        { role: 'assistant', content: response },
      );
      this.memory = this.memory.slice(-8);

      await this.status(`${this.persona === 'bryan' ? 'Bryan' : 'Suki'} está falando...`);

      const audio = await synthesize(response, this.persona);
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
      await this.status('Não consegui processar sua fala. Verifique os logs do bot.').catch(() => {});
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
