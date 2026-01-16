import { AIContext, Intent } from './types.ts';

export async function detectIntent(
    message: string,
    apiKey: string
): Promise<Intent> {
    // If no OpenAI key, fallback or error. assumed to be passed.

    // Quick heuristic fallback for speed/cost if message is very short
    const lower = message.toLowerCase();

    if (lower.includes('humano') || lower.includes('atendente')) {
        return { name: 'human_request', confidence: 1.0 };
    }

    const prompt = `
Analise esta mensagem e identifique a intenção principal:

Mensagem: "${message}"

Intenções possíveis:
- greeting (cumprimento: oi, olá, bom dia)
- question (pergunta sobre produto/serviço)
- complaint (reclamação, problema)
- pricing (pergunta sobre preço, quanto custa)
- scheduling (quer agendar, marcar horário)
- human_request (quer falar com humano)
- other (outra)

Responda APENAS com o nome da intenção em minúsculo.
  `;

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 10
            })
        });

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() || 'other';

        return {
            name: content as any,
            confidence: 0.9 // Estimating high confidence for LLM
        };

    } catch (e) {
        console.error("Intent Detection Error", e);
        return { name: 'other', confidence: 0 };
    }
}
