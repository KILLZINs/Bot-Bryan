const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

type MemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

async function callMistral(
  systemPrompt: string,
  userMessage: string,
  memory: MemoryMessage[] = [],
  temperature = 0.55
): Promise<string> {
  if (!MISTRAL_API_KEY) {
    console.error('[Mistral/Bryan] ERRO: MISTRAL_API_KEY não definida!');
    return '🔑 Chave da Mistral não configurada. Adicione MISTRAL_API_KEY no Railway.';
  }

  const messages = [
    {
      role: 'system' as const,
      content: systemPrompt,
    },
    ...memory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: userMessage,
    },
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
        max_tokens: 450,
        temperature,
      }),
    });

    const body = await res.text();
    let data: any = null;

    try {
      data = body ? JSON.parse(body) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error(
        `[Mistral/Bryan] HTTP ${res.status}:`,
        body.slice(0, 1000)
      );

      if (res.status === 401) {
        return '🔑 A chave da Mistral é inválida. Verifique MISTRAL_API_KEY no Railway.';
      }

      if (res.status === 429) {
        return '⏳ Calma aí KKKK, a Mistral limitou as requisições.';
      }

      if (res.status === 402) {
        return '💳 A conta da Mistral não pode processar essa requisição agora.';
      }

      return `❌ Erro ${res.status} ao contactar a IA.`;
    }

    const content = data?.choices?.[0]?.message?.content;

    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }

    console.error(
      '[Mistral/Bryan] Resposta inesperada:',
      body.slice(0, 1000)
    );

    return 'Ué... fiquei sem resposta KKKK';
  } catch (err) {
    console.error('[Mistral/Bryan] Erro de conexão/fetch:', err);
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

  return callMistral(
    prompt,
    safeMessage,
    memory,
    0.55
  );
}
