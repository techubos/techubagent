// ANALYZE LEAD SENTIMENT v1.0
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { contact_id } = await req.json();
        if (!contact_id) return new Response('Missing contact_id', { status: 400 });

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch recent conversation history
        const { data: messages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('contact_id', contact_id)
            .order('created_at', { ascending: false })
            .limit(15);

        if (!messages || messages.length < 2) {
            return new Response('Not enough context', { status: 200 });
        }

        const historyText = messages.reverse().map((m: any) => `${m.role}: ${m.content}`).join('\n');

        // 2. Ask OpenAI to score
        const prompt = `
        Analyze this conversation between a lead and a company agent/AI.
        Determine the "Lead Score" (0-100) indicating how likely they are to purchase or convert.
        
        Criteria:
        - 0-30: Cold, disinterested, angry, or just starting.
        - 31-70: Warm, asking questions, engaged.
        - 71-100: Hot, asking for price, payment method, scheduling, or urgent.

        Return ONLY a JSON object: { "score": number, "reason": "short explanation" }

        Conversation:
        ${historyText}
        `;

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: 'You are a sales expert.' }, { role: 'user', content: prompt }],
                temperature: 0.0,
                response_format: { type: "json_object" }
            })
        });

        const aiData = await aiRes.json();

        let result = { score: 0, reason: '' };
        try {
            const rawContent = aiData.choices[0].message.content;
            // Tenta limpar markdown ```json se existir
            const cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(cleanContent);
        } catch (parseErr) {
            console.error("JSON Parse Error (AI):", parseErr);
            // Fallback: Score neutro
            result = { score: 50, reason: "Erro na análise automática" };
        }
        const score = result.score || 0;

        let temperature = 'cold';
        if (score > 70) temperature = 'hot';
        else if (score > 30) temperature = 'warm';

        // 3. Update Contact
        await supabase.from('contacts').update({
            lead_score: score,
            lead_temperature: temperature,
            last_score_update: new Date().toISOString()
        }).eq('id', contact_id);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
