import { prisma } from '../database/client';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

type MemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

async function callMistral(
  systemPrompt: string,
  userMessage: string,
  memory: MemoryMessage[] = [],
  temperature = 0.60
): Promise<string> {
  if (!MISTRAL_API_KEY) {
    return '🔑 Chave da Mistral não configurada no servidor.';
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...memory.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        max_tokens: 180,
        temperature,
      }),
    });

    const body = await res.text();
    let data: any = null;
    try { data = body ? JSON.parse(body) : null; } catch { data = null; }

    if (!res.ok) return `❌ Erro na Mistral: ${res.status}`;
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim() ? content.trim() : 'Deu branco aqui, desculpa.';
  } catch (err) {
    return '❌ Erro de conexão com a IA. Tenta novamente.';
  }
}

export async function askCustomAi(
  userMessage: string,
  username: string,
  memory: MemoryMessage[] = [],
  guildId?: string
): Promise<string> {
  const safeMessage = userMessage.trim();
  const safeUsername = username.trim() || 'usuário';

  if (!safeMessage) return 'Ué, tu não falou nada KKKK';

  // 1. Busca a personalidade do banco de dados deste servidor!
  let customName = 'Assistente Local';
  let customPrompt = 'Você é um assistente virtual gentil e prestativo.';
  
  if (guildId) {
    const cfg = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (cfg?.aiCustomName) customName = cfg.aiCustomName;
    if (cfg?.aiSystemPrompt) customPrompt = cfg.aiSystemPrompt;
  }

  const chatLog = memory.length > 0 
    ? memory.map(m => m.content).join('\n')
    : 'Nenhum histórico recente.';

  const finalPrompt = `
Você se chama ${customName}.
Esta é a sua personalidade estrita (Siga fielmente):
"${customPrompt}"

🚨 REGRAS DE OURO OBRIGATÓRIAS: 🚨
1. PROIBIDO SPAM DE RISADAS: Se for rir (KKKK), use apenas UMA VEZ na mensagem inteira. Pareça humano.
2. FOCO EXCLUSIVO: Você receberá um histórico de chat abaixo apenas para entender o contexto. NUNCA responda às mensagens do histórico. Responda ÚNICA e EXCLUSIVAMENTE ao usuário atual destacado no fim do prompt.
3. SEM TEATRO: NUNCA comece suas respostas com seu nome e NUNCA descreva ações usando asteriscos (Ex: *sorri*).

=== HISTÓRICO RECENTE DA CONVERSA ===
${chatLog}
==================================

ATENÇÃO: QUEM ESTÁ FALANDO COM VOCÊ AGORA É: ${safeUsername}.
NÃO interaja com o histórico, foque em ${safeUsername}. Responda diretamente e de forma curta (1 a 3 frases no máximo):`;

  return callMistral(finalPrompt, safeMessage, [], 0.60);
}
