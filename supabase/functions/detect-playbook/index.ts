import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Playbook Definitions
const PLAYBOOKS = {
    LEAD_FRIO: "O usuário é um LEAD FRIO (primeira interação ou pouco engajamento). SEU OBJETIVO: Educar e aquecer. Faça perguntas abertas para entender a necessidade. Não venda nada ainda. Seja consultivo e paciente.",
    CLIENTE_QUENTE: "O usuário é um CLIENTE QUENTE (demonstrou interesse claro, perguntou preço ou agendamento). SEU OBJETIVO: Fechar a venda ou agendamento. Seja direto, crie urgência leve e ofereça horários disponíveis. Use Gatilho da Escassez.",
    CLIENTE_IRRITADO: "O usuário está IRRITADO (reclamação, tom agressivo, palavras negativas). SEU OBJETIVO: Acalmar e resolver. Peça desculpas, mostre empatia extrema e ofereça solução imediata ou transbordo humano. NÃO discuta.",
    REATIVACAO: "O usuário é REATIVAÇÃO (sumiu e voltou, ou estamos tentando recuperar). SEU OBJETIVO: Reconectar sem pressão. Use tom casual ('Oi sumido!'), ofereça uma novidade ou condição especial para trazê-lo de volta."
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { message, history, contactId } = await req.json()

        // 1. Prepare messages for Gemini
        // We convert the history to a simple string format for analysis
        const historyText = history.map((m: any) => `${m.role === 'user' ? 'Usuário' : 'Agente'}: ${m.content}`).join('\n')
        const currentMessage = `Usuário (Agora): ${message}`

        const prompt = `
        Analise a conversa abaixo e classifique o contexto do usuário em um dos seguintes Playbooks:
        
        1. LEAD_FRIO: Primeira interação, dúvidas básicas, sem sinal de compra.
        2. CLIENTE_QUENTE: Perguntou preço, disponibilidade, "como funciona", demonstrou interesse claro.
        3. CLIENTE_IRRITADO: Reclamação, palavrões, tom agressivo, insatisfação.
        4. REATIVACAO: Cliente antigo voltando, ou contato após longo silêncio.
        5. NEUTRO: Conversa casual, resposta curta ("sim", "não"), ou inconclusiva.

        Histórico:
        ${historyText}
        ${currentMessage}

        Responda APENAS um JSON no seguinte formato:
        {
            "playbook": "NOME_DO_PLAYBOOK" (ou "NEUTRO"),
            "confidence": 0.0 a 1.0,
            "reason": "Explicação breve"
        }
        `

        // 2. Call Gemini API
        const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
        if (!geminiKey) throw new Error('GEMINI_API_KEY missing')

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            }
        )

        if (!response.ok) {
            const err = await response.text()
            throw new Error(`Gemini Error: ${err}`)
        }

        const data = await response.json()
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text

        let analysis = { playbook: null, confidence: 0, reason: '' }
        try {
            analysis = JSON.parse(resultText)
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", resultText)
        }

        // 3. Log to Database if confidence is high
        if (analysis.playbook && analysis.confidence > 0.7) {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )

            await supabase.from('playbook_activations').insert({
                contact_id: contactId,
                playbook_name: analysis.playbook,
                reason: analysis.reason,
                confidence_score: analysis.confidence
            })
        }

        // 4. Return the instructions
        const instructions = PLAYBOOKS[analysis.playbook as keyof typeof PLAYBOOKS] || null

        return new Response(
            JSON.stringify({
                playbook: analysis.playbook,
                instructions,
                meta: analysis
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
