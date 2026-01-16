import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { query, history } = await req.json();
        const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

        const chatLog = history.map((m: any) => `${m.role === 'user' ? 'CLIENTE' : 'ATENDENTE'}: ${m.content}`).join('\n');

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Você é um Consultor de Vendas Sênior integrando a um CRM. 
                        Analise o histórico de conversa e o pedido de ajuda do atendente.
                        
                        RETORNE APENAS UM JSON NO FORMATO:
                        {
                          "advice": "Sua orientação estratégica curta (máximo 3 frases)",
                          "suggestions": ["Sugestão de resposta 1", "Sugestão de resposta 2", "Sugestão de resposta 3"]
                        }
                        
                        As sugestões devem ser prontas para enviar, em linguagem natural e empática.`
                    },
                    { role: 'user', content: `HISTÓRICO:\n${chatLog}\n\nPEDIDO DE AJUDA: ${query}` }
                ],
                response_format: { type: "json_object" }
            })
        });

        const aiData = await aiRes.json();
        const result = JSON.parse(aiData.choices[0].message.content);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});
