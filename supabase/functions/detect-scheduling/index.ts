import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { message } = await req.json()

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
        const now = new Date();

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Você é uma IA que detecta intenções de agendamento em mensagens de texto.
                        Retorne APENAS um JSON no seguinte formato:
                        {
                          "is_scheduling": boolean,
                          "date": "YYYY-MM-DD" | null,
                          "time": "HH:mm" | null,
                          "reason": string | null
                        }
                        Considere a data atual como: ${now.toISOString()}.`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                response_format: { type: "json_object" }
            })
        })

        const data = await response.json()
        console.log('[Detect Scheduling] OpenAI Response:', JSON.stringify(data));

        const extraction = JSON.parse(data.choices[0].message.content)

        return new Response(JSON.stringify({
            success: true,
            extraction
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error: unknown) {
        console.error('[Detect Scheduling] Error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
