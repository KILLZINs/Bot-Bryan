import { Client, TextChannel } from 'discord.js';
import { prisma } from '../database/client';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// Guarda a hora que o bot ligou para servidores que estão mortos desde a inicialização
const botStartTime = Date.now();
export const lastMessageTime = new Map<string, number>();

async function generateReviveQuestion(promptConfig: string): Promise<string> {
  if (!MISTRAL_API_KEY) return 'E aí galera, qual a boa de hoje?';

  const systemPrompt = `Você é o animador do servidor Discord. O chat está morto e seu trabalho é revivê-lo com UMA pergunta engajadora e curta.
NUNCA fale sobre política, religião, tragédias ou temas sensíveis.
TEMA: "${promptConfig || 'Faça uma pergunta divertida sobre jogos ou animes.'}"`;

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'system', content: systemPrompt }],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    const data = (await res.json()) as any;
    return data?.choices?.[0]?.message?.content?.trim() || 'Chat morreu? Alguém vivo aí? 👀';
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
