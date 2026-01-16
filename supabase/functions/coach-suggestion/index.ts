
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { contactId, history, memorySummary } = await req.json()
        const openaiKey = Deno.env.get('OPENAI_API_KEY')

        const prompt = `Você é um Treinador de Vendas/Atendimento de Elite. 
        Analise o histórico e o resumo de memória do lead.
        Sugira a MELHOR resposta para o atendente humano enviar agora.
        Seja empático, direto e focado em conversão ou resolução.
        
        RESUMO MEMÓRIA: ${memorySummary}
        HISTÓRICO: ${JSON.stringify(history)}
        
        Retorne apenas a sugestão de mensagem.`

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.7
            })
        })

        const data = await res.json()
        const suggestion = data.choices[0].message.content

        return new Response(JSON.stringify({ suggestion }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
