import { prisma } from '../database/client';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-flash-latest';

type MemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  memory: MemoryMessage[] = [],
  temperature = 0.60,
  attempt = 0
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return '🔑 Chave da Gemini não configurada no servidor.';
  }

  const contents = [
    ...memory.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    })),
    { role: 'user' as const, parts: [{ text: userMessage }] },
  ];

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY.trim(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature, maxOutputTokens: 250 },
        }),
      }
    );

    const body = await res.text();
    let data: any = null;
    try { data = body ? JSON.parse(body) : null; } catch { data = null; }

    if (res.status === 429 && attempt < 2) {
      await sleep(1000 * (attempt + 1));
      return callGemini(systemPrompt, userMessage, memory, temperature, attempt + 1);
    }
    if (res.status === 400 || res.status === 403) {
      return '🔑 A chave da Gemini é inválida ou sem permissão. Verifique GEMINI_API_KEY.';
    }
    if (!res.ok) return `❌ Erro na Gemini: ${res.status}`;

    if (data?.promptFeedback?.blockReason) {
      return 'Prefiro não responder isso agora, muda de assunto?';
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const content = Array.isArray(parts) ? parts.map((p: any) => p?.text || '').join('').trim() : '';
    return content || 'Deu branco aqui, desculpa.';
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

  return callGemini(finalPrompt, safeMessage, [], 0.60);
}
