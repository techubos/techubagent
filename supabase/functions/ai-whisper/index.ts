
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { messageHistory, currentDraft } = await req.json()

        // In a real scenario, use the LLM to predict next words
        // For speed, this should be a very fast model (Gemini Flash or local model)

        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) throw new Error("OPENAI_API_KEY missing")

        const prompt = `
    You are a helpful customer support assistant.
    Predict the next few words for the agent to type based on history and what they already typed.
    
    Conversation History:
    ${messageHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')}
    
    Agent is currently typing: "${currentDraft}"
    
    OUTPUT ONLY THE COMPLETION (max 10 words):
    `

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 30
            })
        })
        const aiData = await aiRes.json()
        const suggestion = aiData.choices[0].message.content.trim();

        return new Response(JSON.stringify({ suggestion }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
