const GROQ_API_KEY = process.env.GROQ_API_KEY;
// GPT-OSS 120B é o modelo recomendado pela própria Groq (o antigo
// llama-3.3-70b-versatile foi desativado em 16/ago/2026). Ver:
// https://console.groq.com/docs/deprecations
const GROQ_MODEL = 'openai/gpt-oss-120b';

type MemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroq(
  systemPrompt: string,
  userMessage: string,
  memory: MemoryMessage[] = [],
  temperature = 0.55,
  attempt = 0
): Promise<string> {
  if (!GROQ_API_KEY) {
    console.error('[Groq/Bryan] ERRO: GROQ_API_KEY não definida!');
    return '🔑 Chave da Groq não configurada. Adicione GROQ_API_KEY no Railway.';
  }

  // Formato OpenAI-compatible: messages com role "system"/"user"/"assistant".
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...memory.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 300,
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
      console.error(`[Groq/Bryan] HTTP ${res.status}:`, body.slice(0, 1000));

      if (res.status === 401 || res.status === 403) {
        return '🔑 A chave da Groq é inválida ou sem permissão. Verifique GROQ_API_KEY em console.groq.com/keys.';
      }

      if (res.status === 429) {
        // 🔁 30 req/min no free tier — antes de desistir, tenta de novo com
        // um pequeno atraso (resolve picos de uso simultâneo).
        if (attempt < 2) {
          await sleep(1000 * (attempt + 1));
          return callGroq(systemPrompt, userMessage, memory, temperature, attempt + 1);
        }
        return '⏳ Calma aí KKKK, a Groq limitou as requisições. Tenta de novo em alguns segundos.';
      }

      if (res.status === 400) {
        // Modelo removido/renomeado pela Groq — acontece de vez em quando,
        // eles avisam por e-mail com bastante antecedência quando muda.
        return `❌ O modelo da IA (${GROQ_MODEL}) parece ter sido descontinuado pela Groq. Confira em console.groq.com/docs/deprecations.`;
      }

      if (res.status >= 500 && attempt < 1) {
        await sleep(800);
        return callGroq(systemPrompt, userMessage, memory, temperature, attempt + 1);
      }

      return `❌ Erro ${res.status} ao contactar a IA.`;
    }

    const content = data?.choices?.[0]?.message?.content;

    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }

    console.error('[Groq/Bryan] Resposta inesperada:', body.slice(0, 1000));

    return 'Ué... fiquei sem resposta KKKK';
  } catch (err) {
    console.error('[Groq/Bryan] Erro de conexão/fetch:', err);
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

  return callGroq(
    prompt,
    safeMessage,
    memory,
    0.55
  );
}
