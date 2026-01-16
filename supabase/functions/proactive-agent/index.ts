// PROACTIVE AGENT v1 (The Follow-up Machine)
// @deno-types="https://esm.sh/@supabase/supabase-js@2.39.0/dist/module/index.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const body = await req.json().catch(() => ({}));
        const { action } = body;

        if (action === 'daily_followup') {
            console.log('🌅 Starting Morning Follow-up Routine...');

            // 1. Find leads with no interaction in last 48h that are NOT closed/archived
            const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

            const { data: stagnantLeads, error: fetchError } = await supabase
                .from('contacts')
                .select('*')
                .lt('last_interaction_at', fortyEightHoursAgo)
                .in('status', ['lead', 'talking', 'opportunity'])
                .lt('ai_followup_count', 3) // Max 3 proactive followups
                .limit(20);

            if (fetchError) throw fetchError;

            if (!stagnantLeads?.length) {
                return new Response(JSON.stringify({ message: 'No stagnant leads found' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            console.log(`🕵️ Found ${stagnantLeads.length} stagnant leads. Generating follow-ups...`);

            // 2. Load Global Settings for OpenAI
            const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'agent_config').single();
            const agentConfig = settingsData?.value || {};

            const openaiKey = agentConfig.apiKeys?.openai || Deno.env.get('OPENAI_API_KEY');
            const evoUrl = agentConfig.evolutionConfig?.url || Deno.env.get('EVOLUTION_API_URL');
            const evoKey = agentConfig.evolutionConfig?.apiKey || Deno.env.get('EVOLUTION_API_KEY');
            const evoInstance = agentConfig.evolutionConfig?.instanceName || Deno.env.get('EVOLUTION_INSTANCE_NAME');

            const results = [];

            for (const lead of stagnantLeads) {
                // Fetch context
                const { data: history } = await supabase
                    .from('messages')
                    .select('role, content')
                    .eq('contact_id', lead.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                const prompt = `Você é um SDR proativo. O lead ${lead.name} não responde há 48h.
                OBJETIVO: Fazer um follow-up CURTO e GENTIL para retomar o contato.
                CONTEÚDO DA ÚLTIMA INTERAÇÃO: ${history?.[0]?.content || "Início de prospecção"}.
                HISTÓRICO RECENTE: ${JSON.stringify(history?.reverse())}
                REGRAS: Máximo 20 palavras. Não seja chato.`;

                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'system', content: prompt }]
                    })
                });
                const aiData = await aiRes.json();
                const text = aiData.choices[0].message.content;

                // Send Message via Evolution
                const evRes = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                    method: 'POST',
                    headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: lead.phone, text, linkPreview: false })
                });

                if (evRes.ok) {
                    // Update Lead Status
                    await supabase.from('contacts').update({
                        ai_followup_count: (lead.ai_followup_count || 0) + 1,
                        last_interaction_at: new Date().toISOString()
                    }).eq('id', lead.id);

                    console.log(`✅ Follow-up sent to ${lead.name} (${lead.phone})`);
                    results.push({ id: lead.id, status: 'sent' });
                } else {
                    console.error(`❌ Failed to send to ${lead.phone}:`, await evRes.text());
                    results.push({ id: lead.id, status: 'failed' });
                }
            }

            return new Response(JSON.stringify({ success: true, results }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response('Invalid Action', { status: 400 });

    } catch (e) {
        console.error('💥 Proactive Agent Error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
