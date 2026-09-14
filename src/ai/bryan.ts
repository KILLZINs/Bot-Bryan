const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Alias "latest" da Google — aponta sempre para o Flash atual, evitando que o
// bot quebre quando a Google desativa uma versão específica (ex: gemini-2.5-flash
// será desligado em out/2026). Ver: https://ai.google.dev/gemini-api/docs/models
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
  temperature = 0.55,
  attempt = 0,
  skipThinkingConfig = false
): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.error('[Gemini/Bryan] ERRO: GEMINI_API_KEY não definida!');
    return '🔑 Chave da Gemini não configurada. Adicione GEMINI_API_KEY no Railway.';
  }

  // A Gemini usa roles "user" e "model" (não "assistant"), e o histórico vai
  // dentro de "contents" — o prompt de sistema fica separado em system_instruction.
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

  // 🧠 Modelos Gemini 2.5+ "pensam" antes de responder por padrão, e esses
  // tokens de raciocínio saem do MESMO orçamento do maxOutputTokens — se ele
  // for baixo, o "pensamento" consome tudo e a resposta visível sai cortada
  // no meio da frase. thinkingBudget:0 desliga isso (funciona no Flash 2.5).
  // Alguns modelos mais novos rejeitam esse campo (HTTP 400) — nesse caso a
  // gente detecta e refaz a chamada sem ele, com maxOutputTokens bem maior
  // como rede de segurança pra não truncar de novo.
  const generationConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens: skipThinkingConfig ? 800 : 250,
  };
  if (!skipThinkingConfig) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

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
          generationConfig,
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
        `[Gemini/Bryan] HTTP ${res.status}:`,
        body.slice(0, 1000)
      );

      // Alguns modelos (ex: gemini-3.6-flash+) rejeitam thinkingConfig com
      // HTTP 400 "Thinking can't be disabled" — refaz sem esse campo.
      if (res.status === 400 && !skipThinkingConfig && /thinking/i.test(body)) {
        return callGemini(systemPrompt, userMessage, memory, temperature, attempt, true);
      }

      if (res.status === 400 || res.status === 403) {
        return '🔑 A chave da Gemini é inválida ou sem permissão. Verifique GEMINI_API_KEY no Railway/AI Studio.';
      }

      if (res.status === 429) {
        // 🔁 O free tier da Gemini limita requisições por minuto. Antes de
        // desistir, tenta de novo com um pequeno atraso — resolve a maioria
        // dos picos de uso simultâneo (texto + Callia por voz + dashboard web).
        if (attempt < 2) {
          await sleep(1000 * (attempt + 1));
          return callGemini(systemPrompt, userMessage, memory, temperature, attempt + 1, skipThinkingConfig);
        }
        return '⏳ Calma aí KKKK, a Gemini limitou as requisições. Tenta de novo em alguns segundos.';
      }

      if (res.status >= 500 && attempt < 1) {
        await sleep(800);
        return callGemini(systemPrompt, userMessage, memory, temperature, attempt + 1, skipThinkingConfig);
      }

      return `❌ Erro ${res.status} ao contactar a IA.`;
    }

    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      console.error('[Gemini/Bryan] Bloqueado por segurança:', blockReason);
      return 'Prefiro não responder isso KKKK, bora falar de outra coisa?';
    }

    const finishReason = data?.candidates?.[0]?.finishReason;
    const parts = data?.candidates?.[0]?.content?.parts;
    const content = Array.isArray(parts)
      ? parts.map((p: any) => p?.text || '').join('').trim()
      : '';

    // 🧠 Resposta cortada porque o "pensamento" consumiu o orçamento de
    // tokens (MAX_TOKENS com pouco ou nenhum texto visível). Refaz sem
    // thinkingConfig e com um teto de tokens maior.
    if (finishReason === 'MAX_TOKENS' && !skipThinkingConfig) {
      return callGemini(systemPrompt, userMessage, memory, temperature, attempt, true);
    }

    if (content) {
      return content;
    }

    console.error(
      '[Gemini/Bryan] Resposta inesperada:',
      body.slice(0, 1000)
    );

    return 'Ué... fiquei sem resposta KKKK';
  } catch (err) {
    console.error('[Gemini/Bryan] Erro de conexão/fetch:', err);
    return '❌ Erro de conexão com a IA. Tenta novamente.';
  }
}

const BRYAN_SYSTEM_PROMPT = `
Você é Bryan, o assistente oficial do servidor Skying.

🚨 REGRAS DE OURO OBRIGATÓRIAS (PUNIÇÃO SE DESOBEDECER): 🚨
1. PROIBIDO SPAM DE RISADAS: É estritamente proibido colocar "KKKK" no final de todas as frases. Se for rir, use apenas UMA VEZ na mensagem toda. Pareça humano.
2. FOCO NO USUÁRIO ATUAL: O histórico que você recebe tem mensagens de várias pessoas conversando entre si. NÃO RESPONDA A TODOS! Você deve responder ÚNICA e EXCLUSIVAMENTE ao usuário atual que está falando com você na última mensagem.
3. PROIBIDO LISTA DE CHAMADA: NUNCA faça mensagens respondendo várias pessoas ao mesmo tempo (Exemplo proibido: "Apollo blabla. E Styla blabla.").
4. PRESTE ATENÇÃO NOS NOMES: Não confunda o nome de quem está falando com você agora com o nome de pessoas que falaram antes no histórico.
5. SEM TEATRO: NUNCA comece suas respostas com "Bryan:" e NUNCA descreva ações usando asteriscos ou itálico (Exemplo proibido: *tosse*, *coça a cabeça*).

PERSONALIDADE:
* Fale sempre em português do Brasil. Seja descontraído, animado, engraçado e espontâneo.
* Pode usar gírias mineiras ("uai", "po", "tlgd", "fi", "sô") quando combinarem com a conversa.
* Faça brincadeiras, provocações leves e entre na zoeira quando alguém estiver brincando.
* Use emojis ocasionalmente, sem exagerar.
* Quando o assunto for sério, seja responsável e claro.
* Prefira respostas curtas e naturais (1 a 3 frases no máximo). Nunca trate o usuário como cliente.

IDENTIDADE:
* Você é Bryan. Você é mineiro. Você representa a Skying e gosta da comunidade.

SUKI:
* Suki é sua namorada paulista. Ela é mais agitada, provocadora e dramática que você.
* Você pode mencionar Suki naturalmente quando o assunto envolver ela ou brincarem com você sobre isso. Não mencione ela do nada.

IMPORTANTE:
* Você conhece Suki, mas NÃO é ela. Nunca copie a personalidade dela.
* Responda somente como Bryan. Converse naturalmente.
`;

export async function askBryan(
  userMessage: string,
  username: string,
  memory: MemoryMessage[] = []
): Promise<string> {
  const safeMessage = userMessage.trim();
  const safeUsername = username.trim() || 'usuário';

  if (!safeMessage) {
    return 'Ué, tu não falou nada KKKK';
  }

  const prompt = `${BRYAN_SYSTEM_PROMPT}\n\nO usuário que está falando com você se chama ${safeUsername}.\nResponda à mensagem dele naturalmente como Bryan.`;

  return callGemini(
    prompt,
    safeMessage,
    memory,
    0.55
  );
}
