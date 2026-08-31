import { Client, TextChannel } from 'discord.js';
import { prisma } from '../database/client';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// Memória temporária para saber quando foi a última mensagem de cada servidor
export const lastMessageTime = new Map<string, number>();

async function generateReviveQuestion(promptConfig: string): Promise<string> {
  if (!MISTRAL_API_KEY) return 'E aí galera, qual a boa de hoje?';

  const systemPrompt = `
Você é o animador do servidor Discord. O chat está morto há horas e seu trabalho é revivê-lo com UMA pergunta engajadora, criativa e direta.

🚨 REGRAS ABSOLUTAS E INQUEBRÁVEIS:
1. NUNCA fale sobre política, religião, depressão, violência, morte, tragédias, doenças ou qualquer tema que possa gerar gatilhos (triggers).
2. Seja leve, divertido e casual. Fale a língua da internet (pode usar gírias naturais).
3. Faça apenas UMA pergunta. Não faça introduções longas.
4. Se o usuário forneceu um tema abaixo, siga-o. Se não, invente algo sobre cultura pop, jogos, animes, comida ou dilemas engraçados.

TEMA ESCOLHIDO PELO ADMIN: "${promptConfig || 'Faça um dilema engraçado ou uma pergunta sobre jogos/animes.'}"`;

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

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || 'Chat morreu? Alguém vivo aí? 👀';
  } catch (error) {
    return 'Chat morreu? Alguém vivo aí? 👀'; // Fallback seguro
  }
}

export function startReviveChatMonitor(client: Client) {
  // Roda o verificador a cada 5 minutos
  setInterval(async () => {
    try {
      const configs = await prisma.guildConfig.findMany({
        where: { featReviveChat: true, reviveChannelId: { not: null } }
      });

      for (const cfg of configs) {
        const guildId = cfg.guildId;
        const channelId = cfg.reviveChannelId!;
        const timeoutMinutes = cfg.reviveTimeout || 120; // Padrão 2 horas
        const timeoutMs = timeoutMinutes * 60 * 1000;

        const lastMsg = lastMessageTime.get(guildId) || Date.now();
        const timeSinceLastMsg = Date.now() - lastMsg;

        // Se passou do tempo limite de inatividade...
        if (timeSinceLastMsg >= timeoutMs) {
          const channel = client.channels.cache.get(channelId) as TextChannel;
          
          if (channel) {
            const question = await generateReviveQuestion(cfg.revivePrompt || '');
            const mention = cfg.reviveRoleId ? `<@&${cfg.reviveRoleId}> ` : '';
            
            await channel.send(`${mention}**O chat ficou quieto demais...** 🧟\n> ${question}`);
            
            // Reseta o timer para não floodar
            lastMessageTime.set(guildId, Date.now());
          }
        }
      }
    } catch (error) {
      console.error('[ReviveChat] Erro no monitoramento:', error);
    }
  }, 5 * 60 * 1000); // 5 minutos
}
