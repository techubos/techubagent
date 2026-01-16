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
        const { agentId, contactId, proposedResponse, forceVariation = false } = await req.json()

        console.log(`🔍 Verificando repetição para agente ${agentId}`)

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Verificar se resposta é repetitiva
        const { data: checkData } = await supabase
            .rpc('check_recent_repetition', {
                p_agent_id: agentId,
                p_contact_id: contactId,
                p_response: proposedResponse,
                p_hours_window: 24
            })
            .single()

        const isRepetitive = checkData?.is_repetitive || false
        const timesUsed = checkData?.times_used || 0

        if (!isRepetitive && !forceVariation) {
            console.log('✅ Resposta não é repetitiva')
            return new Response(
                JSON.stringify({
                    is_repetitive: false,
                    should_regenerate: false,
                    times_used: 0
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`⚠️ Resposta usada ${timesUsed}x nas últimas 24h`)

        // Se forçar variação ou já usou 2+ vezes, gerar variação
        const shouldRegenerate = forceVariation || timesUsed >= 1 // More aggressive: if used once recently, vary it.

        let suggestion = null

        if (shouldRegenerate) {
            console.log('🎭 Gerando variação linguística...')
            suggestion = await generateVariation(proposedResponse)
        }

        return new Response(
            JSON.stringify({
                is_repetitive: true,
                times_used: timesUsed,
                should_regenerate: shouldRegenerate,
                suggested_variation: suggestion
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('💥 Erro:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } // Return 200 to avoid crash
        )
    }
})

// Gerar variação usando Gemini
async function generateVariation(originalText: string): Promise<string> {
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) return originalText

    const prompt = `
Você é um especialista em variação linguística.

TEXTO ORIGINAL:
"${originalText}"

TAREFA:
Reescreva este texto mantendo EXATAMENTE o mesmo significado e intenção, mas usando palavras e estrutura diferentes.

REGRAS:
- Mantenha o tom (formal/informal)
- Preserve o comprimento aproximado
- Não adicione nem remova informações
- Seja natural, não forçado

Retorne APENAS o texto reescrito, sem explicações.
`

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.9, // Alta criatividade para variação
                        maxOutputTokens: 200
                    }
                })
            }
        )

        const data = await response.json()
        const variation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

        // Se falhar ou retornar vazio, retorna original
        return variation || originalText
    } catch (error) {
        console.error('Erro ao gerar variação:', error)
        return originalText
    }
}
