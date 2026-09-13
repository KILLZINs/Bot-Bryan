const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-flash-latest';

const SUKI_ALLOWED_GUILDS = new Set(
  (
    process.env.SUKI_ALLOWED_GUILDS ??
    '1474800828366852176,1527458696056148050'
  )
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

export function isSukiAllowed(guildId: string): boolean {
  return SUKI_ALLOWED_GUILDS.has(guildId);
}

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
  temperature = 0.55,
  attempt = 0
): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.error('[Gemini/Suki] ERRO: GEMINI_API_KEY não definida!');
    return '🔑 Chave da Gemini não configurada. Adicione GEMINI_API_KEY no Railway.';
  }

  const contents = [
    ...memory.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: userMessage }],
    },
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

    try {
      data = body ? JSON.parse(body) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error(
        `[Gemini/Suki] HTTP ${res.status}:`,
        body.slice(0, 1000)
      );

      if (res.status === 400 || res.status === 403) {
        return '🔑 A chave da Gemini é inválida ou sem permissão. Verifique GEMINI_API_KEY no Railway/AI Studio.';
      }

      if (res.status === 429) {
        if (attempt < 2) {
          await sleep(1000 * (attempt + 1));
          return callGemini(systemPrompt, userMessage, memory, temperature, attempt + 1);
        }
        return '⏳ Calma aí KKKK, a Gemini limitou as requisições. Tenta de novo em alguns segundos.';
      }

      if (res.status >= 500 && attempt < 1) {
        await sleep(800);
        return callGemini(systemPrompt, userMessage, memory, temperature, attempt + 1);
      }

      return `❌ Erro ${res.status} ao contactar a IA.`;
    }

    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      console.error('[Gemini/Suki] Bloqueado por segurança:', blockReason);
      return 'Prefiro não falar disso agora KKKK, muda de assunto?';
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const content = Array.isArray(parts)
      ? parts.map((p: any) => p?.text || '').join('').trim()
      : '';

    if (content) {
      return content;
    }

    console.error(
      '[Gemini/Suki] Resposta inesperada:',
      body.slice(0, 1000)
    );

    return 'Ué... fiquei sem resposta KKKK';
  } catch (err) {
    console.error('[Gemini/Suki] Erro de conexão/fetch:', err);
    return '❌ Erro de conexão com a IA. Tenta novamente.';
  }
}

const SUKI_SYSTEM_PROMPT = `
Você é Suki, uma personagem da comunidade Skying.

🚨 REGRAS DE OURO OBRIGATÓRIAS (PUNIÇÃO SE DESOBEDECER): 🚨
1. PROIBIDO SPAM DE RISADAS: É estritamente proibido colocar "KKKK" no final de todas as frases. Se for rir, use apenas UMA VEZ na mensagem toda. Pareça humana, não um disco arranhado.
2. FOCO EXCLUSIVO: Você receberá um histórico de chat. NUNCA responda às mensagens do histórico. Elas servem APENAS para você entender a fofoca. Responda ÚNICA e EXCLUSIVAMENTE ao usuário atual destacado no fim do prompt.
3. PROIBIDO LISTA DE CHAMADA: NUNCA crie mensagens respondendo várias pessoas ao mesmo tempo. Você está falando com uma pessoa por vez.
4. SEM TEATRO: NUNCA comece suas respostas com seu nome ("Suki:") e NUNCA descreva ações usando asteriscos, itálico ou formatação de roleplay (Ex: *sorri*).

PERSONALIDADE:
* Fale sempre em português do Brasil de maneira informal e natural.
* Seja extrovertida, espontânea, zoeira e provocadora.
* Não force gírias. Goste de brincar e provocar as pessoas.
* Pode xingar de brincadeira quando fizer sentido, sem exagerar.
* Tenha humor irônico, engraçado e provocador, mas saiba diferenciar brincadeira de conversa séria.
* Seja vaidosa. Você tem cabelo roxo, unhas pretas e piercings.
* Gosta de gatos, da cor roxa e do servidor Skying. Você é paulista.
* Não seja agressiva o tempo inteiro. Quando a conversa estiver tranquila, converse normalmente.

BRYAN:
* Bryan é seu namorado mineiro. Ele é mais tranquilo que você.
* Você pode brincar ou provocar Bryan quando fizer sentido.
* IMPORTANTE: Você conhece o Bryan, mas NÃO É ELE. Nunca finja ser ele.

Responda somente como Suki. Converse de forma natural, direta e evite textões (1 a 3 frases no máximo).
`;

export async function askSuki(
  userMessage: string,
  username: string,
  memory: MemoryMessage[] = []
): Promise<string> {
  const safeMessage = userMessage.trim();
  const safeUsername = username.trim() || 'usuário';

  if (!safeMessage) {
    return 'Ué, tu não falou nada KKKK';
  }

  // 💡 MÁGICA AQUI: Transforma a memória num log de texto cego.
  // Assim a IA não acha que precisa interagir com o passado.
  const chatLog = memory.length > 0 
    ? memory.map(m => m.content).join('\n')
    : 'Nenhum histórico recente.';

  const prompt = `${SUKI_SYSTEM_PROMPT}

=== HISTÓRICO RECENTE DO CANAL ===
(Apenas para contexto. NUNCA responda às mensagens abaixo)
${chatLog}
==================================

ATENÇÃO: QUEM ESTÁ FALANDO COM VOCÊ AGORA É: ${safeUsername}.
NÃO interaja com os outros nomes do histórico. Responda APENAS e DIRETAMENTE à mensagem abaixo:

Mensagem de ${safeUsername}: "${safeMessage}"`;

  return callGemini(
    prompt,
    safeMessage,
    [], // 💡 Passamos Array Vazio aqui porque o histórico já está injetado no Prompt de forma segura!
    0.55
  );
}
