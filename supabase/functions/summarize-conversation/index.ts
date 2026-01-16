// SUMMARIZE CONVERSATION v1
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { contact_id } = await req.json();
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch last 30 messages
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('role, content')
            .eq('contact_id', contact_id)
            .order('created_at', { ascending: false })
            .limit(30);

        if (msgError || !messages || messages.length === 0) {
            return new Response(JSON.stringify({ summary: "Sem mensagens suficientes para resumir." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const chatLog = messages.reverse().map(m => `${m.role === 'user' ? 'CLIENTE' : 'ATENDENTE'}: ${m.content}`).join('\n');

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Você é um assistente de CRM. Resuma a conversa a seguir em exatas 2 frases curtas e diretas. Foque em: O que o cliente quer e qual o status atual da negociação.' },
                    { role: 'user', content: chatLog }
                ]
            })
        });

        const aiData = await aiRes.json();
        const summary = aiData.choices[0].message.content;

        // Save to contact
        await supabase.from('contacts').update({ summary }).eq('id', contact_id);

        return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});
