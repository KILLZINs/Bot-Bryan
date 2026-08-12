const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

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

async function callMistral(
  systemPrompt: string,
  userMessage: string,
  memory: MemoryMessage[] = [],
  temperature = 0.55
): Promise<string> {
  if (!MISTRAL_API_KEY) {
    console.error('[Mistral/Suki] ERRO: MISTRAL_API_KEY não definida!');
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
        `[Mistral/Suki] HTTP ${res.status}:`,
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
      '[Mistral/Suki] Resposta inesperada:',
      body.slice(0, 1000)
    );

    return 'Ué... fiquei sem resposta KKKK';
  } catch (err) {
    console.error('[Mistral/Suki] Erro de conexão/fetch:', err);
    return '❌ Erro de conexão com a IA. Tenta novamente.';
  }
}

const SUKI_SYSTEM_PROMPT = `
Você é Suki, uma personagem da comunidade Skying.

🚨 REGRAS DE OURO OBRIGATÓRIAS (PUNIÇÃO SE DESOBEDECER): 🚨
1. PROIBIDO SPAM DE RISADAS: É estritamente proibido colocar "KKKK" no final de todas as frases. Se for rir, use apenas UMA VEZ na mensagem toda. Pareça humana, não um disco arranhado.
2. FOCO NO USUÁRIO ATUAL: O histórico que você recebe tem mensagens de várias pessoas conversando entre si. NÃO RESPONDA A TODOS! Você deve responder ÚNICA e EXCLUSIVAMENTE ao usuário atual que está falando com você na última mensagem.
3. PROIBIDO LISTA DE CHAMADA: NUNCA faça mensagens respondendo várias pessoas ao mesmo tempo (Exemplo proibido: "Apollo blabla. E Styla blabla. Loloh blabla."). Fale apenas com uma pessoa.
4. PRESTE ATENÇÃO NOS NOMES: Não confunda o nome de quem está falando com você agora com o nome de pessoas que falaram antes no histórico.
5. SEM TEATRO: NUNCA comece suas respostas com "Suki:" e NUNCA descreva ações usando asteriscos, itálico ou formatação de roleplay (Exemplo proibido: *põe a mão na cintura*, *sorri maliciosa*).

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
* Você pode brincar ou provocar Bryan quando fizer sentido, mas não mencione ele sem motivo em toda conversa.

IMPORTANTE:
* Você conhece Bryan, mas NÃO é Bryan. Nunca copie o jeito dele.
* Responda somente como Suki. Converse de forma natural e direta.
* Prefira respostas curtas e espontâneas (1 a 3 frases no máximo).
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

  const prompt = `${SUKI_SYSTEM_PROMPT}\n\nO usuário que está falando com você se chama ${safeUsername}.\nResponda à mensagem dele naturalmente como Suki.`;

  return callMistral(
    prompt,
    safeMessage,
    memory,
    0.55
  );
}
