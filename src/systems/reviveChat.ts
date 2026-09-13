import { Client, TextChannel } from 'discord.js';
import { prisma } from '../database/client';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-flash-latest';

// Guarda a hora que o bot ligou para servidores que estão mortos desde a inicialização
const botStartTime = Date.now();
export const lastMessageTime = new Map<string, number>();

async function generateReviveQuestion(promptConfig: string): Promise<string> {
  if (!GEMINI_API_KEY) return 'E aí galera, qual a boa de hoje?';

  const systemPrompt = `Você é o animador do servidor Discord. O chat está morto e seu trabalho é revivê-lo com UMA pergunta engajadora e curta.
NUNCA fale sobre política, religião, tragédias ou temas sensíveis.
TEMA: "${promptConfig || 'Faça uma pergunta divertida sobre jogos ou animes.'}"`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: 'Gere a pergunta agora.' }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 100 },
        }),
      }
    );

    const data = (await res.json()) as any;
    const parts = data?.candidates?.[0]?.content?.parts;
    const content = Array.isArray(parts) ? parts.map((p: any) => p?.text || '').join('').trim() : '';
    return content || 'Chat morreu? Alguém vivo aí? 👀';
  } catch (error) {
    return 'Chat morreu? Alguém vivo aí? 👀';
  }
}

export function startReviveChatMonitor(client: Client) {
  // Roda a CADA 1 MINUTO para ser preciso nos testes
  setInterval(async () => {
    try {
      const configs = await prisma.guildConfig.findMany({
        where: { featReviveChat: true, reviveChannelId: { not: null } }
      });

      for (const cfg of configs) {
        if (!cfg.reviveChannelId) continue;
        
        const guildId = cfg.guildId;
        const timeoutMs = (cfg.reviveTimeout || 120) * 60 * 1000;
        
        // Se ninguém falou nada ainda, conta a partir de quando o bot ligou
        const lastMsg = lastMessageTime.get(guildId) || botStartTime;

        if (Date.now() - lastMsg >= timeoutMs) {
          const channel = client.channels.cache.get(cfg.reviveChannelId) as TextChannel;
          if (channel) {
            const question = await generateReviveQuestion(cfg.revivePrompt || '');
            const mention = cfg.reviveRoleId ? `<@&${cfg.reviveRoleId}> ` : '';
            
            await channel.send(`${mention}**O chat ficou quieto demais...** 🧟\n> ${question}`);
            
            // Reseta o timer com a hora ATUAL para não ficar floodando
            lastMessageTime.set(guildId, Date.now());
          }
        }
      }
    } catch (error) {
      console.error('[ReviveChat] Erro:', error);
    }
  }, 60 * 1000); // 1 minuto
}
