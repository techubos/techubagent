import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

        const supabase = createClient(supabaseUrl, supabaseKey)

        const { action, contactId, messages } = await req.json()

        if (action === 'summarize') {
            if (!messages || messages.length === 0) throw new Error("Messages are required for summary")

            const historyText = messages.map((m: any) => `${m.role === 'user' ? 'Cliente' : 'IA'}: ${m.content}`).join('\n')

            const prompt = `
            Resuma a conversa abaixo de forma extremamente concisa para um atendente humano que está assumindo o chat agora.
            Destaque:
            1. O que o cliente quer/pediu.
            2. Qual o humor/sentimento dele.
            3. Algum dado importante coletado (telefone, e-mail, pedido).
            
            Conversa:
            ${historyText}
            `

            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.5
                })
            })

            const aiData = await aiRes.json()
            const summary = aiData.choices[0].message.content

            return new Response(JSON.stringify({ summary }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        throw new Error("Invalid action")

    } catch (error: any) {
        console.error("[AI-HELPER-ERR]", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
