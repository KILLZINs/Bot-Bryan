import {
  AudioPlayer,
  AudioPlayerStatus,
  EndBehaviorType,
  StreamType,
  VoiceConnection,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from 'discord-voip'; // 💡 O SEGREDO ESTÁ AQUI: Trocamos o pacote!
import { GuildMember, VoiceBasedChannel } from 'discord.js';
import prism from 'prism-media';
import { Readable } from 'node:stream';

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
const BRYAN_VOICE_ID = process.env.BRYAN_VOICE_ID;
const SUKI_VOICE_ID = process.env.SUKI_VOICE_ID;

function getVoiceId(persona: CalliaPersona): string {
  const voiceId = persona === 'bryan' ? BRYAN_VOICE_ID : SUKI_VOICE_ID;

  if (!voiceId?.trim()) {
    throw new Error(
      `A voz de ${persona === 'bryan' ? 'Bryan' : 'Suki'} não foi configurada. Defina ${
        persona === 'bryan' ? 'BRYAN_VOICE_ID' : 'SUKI_VOICE_ID'
      }.`,
    );
  }

  return voiceId.trim();
}

function requireElevenLabs(): string {
  if (!ELEVENLABS_API_KEY?.trim()) {
    throw new Error('ELEVENLABS_API_KEY não está configurada.');
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

async function transcribe(wav: Buffer): Promise<string> {
  const apiKey = requireElevenLabs();
  const form = new FormData();

  form.append(
    'file',
    new Blob([wav], { type: 'audio/wav' }),
    'discord-speech.wav',
  );
  form.append('model_id', 'scribe_v1');
  form.append('language_code', 'por');

  const response = await fetch(
    'https://api.elevenlabs.io/v1/speech-to-text',
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: form,
    },
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `ElevenLabs STT ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  const data = JSON.parse(body) as { text?: string };
  return data.text?.trim() ?? '';
}

async function synthesize(
  text: string,
  persona: CalliaPersona,
): Promise<Buffer> {
  const apiKey = requireElevenLabs();
  const voiceId = getVoiceId(persona);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId,
    )}`,
    {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 1200),
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `ElevenLabs TTS ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
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
          void this.processSpeech(
            pcmToWav(Buffer.concat(chunks)),
          );
        });
    });
  }

  private async processSpeech(wav: Buffer): Promise<void> {
    if (
      this.stopped ||
      this.processing ||
      wav.length < 44 + 1_500
    ) {
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
      const ask =
        this.persona === 'bryan'
          ? this.ai.askBryan
          : this.ai.askSuki;

      await this.status(
        `${this.persona === 'bryan' ? 'Bryan' : 'Suki'} está pensando...`,
      );

      const response = await ask(text, username, this.memory);

      this.memory.push(
        { role: 'user', content: text },
        { role: 'assistant', content: response },
      );
      this.memory = this.memory.slice(-8);

      await this.status(
        `${this.persona === 'bryan' ? 'Bryan' : 'Suki'} está falando...`,
      );

      const audio = await synthesize(response, this.persona);
      const resource = createAudioResource(
        Readable.from(audio),
        { inputType: StreamType.Arbitrary },
      );

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
      await this.status(
        'Não consegui processar sua fala. Verifique os logs do bot.',
      ).catch(() => {});
    } finally {
      this.processing = false;
    }
  }
}

export function startCalliaSession(
  options: CalliaSessionOptions,
): void {
  sessions.get(options.member.guild.id)?.stop();

  const session = new CalliaSession(options);
  sessions.set(options.member.guild.id, session);
}

export function stopCalliaSession(guildId: string): boolean {
  const session = sessions.get(guildId);

  if (!session) {
    return false;
  }

  session.stop();
  return true;
}

export function changeCalliaPersona(
  guildId: string,
  persona: CalliaPersona,
): boolean {
  const session = sessions.get(guildId);

  if (!session) {
    return false;
  }

  session.setPersona(persona);
  return true;
}
