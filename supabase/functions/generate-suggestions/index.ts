import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { contact_id } = await req.json();
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch Context (Last 20 messages)
        const { data: messages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('contact_id', contact_id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ suggestions: [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const historyText = messages.reverse()
            .map((m: any) => `${m.role === 'assistant' ? 'Agent' : 'User'}: ${m.content}`)
            .join('\n');

        // 2. Call LLM for Suggestions
        const systemPrompt = `
            Você é um assistente de vendas experiente e prestativo.
            Analise o histórico da conversa abaixo e sugira 3 respostas curtas, profissionais e diretas que o Agente pode enviar agora.
            As respostas devem ser em Português do Brasil e ter no máximo 15 palavras cada.
            
            Retorne APENAS um JSON válido no formato:
            { "suggestions": ["Sugestão 1", "Sugestão 2", "Sugestão 3"] }
        `.trim();

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `HISTÓRICO:\n${historyText}` }
                ],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        let content = { suggestions: [] };

        try {
            const rawText = data.choices[0].message.content;
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            content = JSON.parse(cleanText);
        } catch (parseErr) {
            console.error("JSON Parse Error (Suggestions):", parseErr);
            content = { suggestions: ["Olá, como posso ajudar?", "Poderia me dar mais detalhes?", "Certo, entendi."] };
        }

        return new Response(JSON.stringify(content), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error("Error generating suggestions:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
