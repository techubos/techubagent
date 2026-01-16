import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Verify authentication
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
        if (authError || !user) throw new Error('Invalid token')

        const { action, payload } = await req.json()

        // 1. Fetch AI Config from DB (Robust check)
        const { data: settings } = await supabaseClient
            .from('settings')
            .select('key, value')
            .in('key', ['ai_config', 'agent_config'])

        const aiConfig = settings?.find(s => s.key === 'ai_config')?.value
        const agentConfig = settings?.find(s => s.key === 'agent_config')?.value

        const apiKey = aiConfig?.openai_api_key || agentConfig?.apiKeys?.openai

        if (!apiKey) {
            throw new Error('OpenAI API Key not configured. Please set it in Agent Settings.')
        }

        let result;

        if (action === 'chat') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: payload.model || 'gpt-4o-mini',
                    messages: payload.messages,
                    temperature: payload.temperature ?? 0.7,
                    response_format: payload.response_format
                })
            })
            result = await response.json()
        } else if (action === 'embed') {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: payload.text
                })
            })
            result = await response.json()
        } else {
            throw new Error('Invalid action')
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
