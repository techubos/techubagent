// OUTSCRAPER SEARCH ENGINE v2 (Social + AI Filters)
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
        const {
            segment,
            state,
            city,
            limit = 10,
            enrich_social = false,
            ai_filter = '',
            min_rating = 0,
            only_with_phone = true,
            campaignId = null
        } = await req.json()

        if (!segment) throw new Error('Segment is required')

        // Fetch Keys from DB
        const { data: settingsData } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'agent_config')
            .single();

        const agentConfig = settingsData?.value || {};

        const outscraperKey = agentConfig.apiKeys?.outscraper || Deno.env.get('OUTSCRAPER_API_KEY');
        const openaiKey = agentConfig.apiKeys?.openai || Deno.env.get('OPENAI_API_KEY');

        if (!outscraperKey) throw new Error('Chave da API Outscraper não configurada. Vá em Configurações > API e adicione sua chave.')

        const fullQuery = `${segment} em ${city || ''} ${state || ''}`.trim()
        console.log(`🔍 Advanced Search: "${fullQuery}" (Enrich: ${enrich_social}, Campaign: ${campaignId})`)

        if (campaignId) {
            await supabase.from("prospecting_campaigns").update({ status: "running" }).eq("id", campaignId);
        }

        // 1. CALL OUTSCRAPER
        let apiUrl = `https://api.app.outscraper.com/maps/search-v2?query=${encodeURIComponent(fullQuery)}&limit=${limit}&async=false`
        if (enrich_social) {
            apiUrl += `&domains_service=true`
        }

        const outRes = await fetch(apiUrl, { headers: { 'X-API-KEY': outscraperKey } })
        if (!outRes.ok) throw new Error(`Outscraper Error: ${await outRes.text()}`)

        const data = await outRes.json()
        let results = data.data?.[0] || []

        // 1a. Basic Technical Filters
        if (only_with_phone) {
            results = results.filter((r: any) => r.phone && r.phone.trim() !== '')
        }
        if (min_rating > 0) {
            results = results.filter((r: any) => (r.rating || 0) >= min_rating)
        }

        console.log(`📈 Before AI: ${results.length} leads.`)

        // 2. AI FILTERING (Optional)
        if (ai_filter && results.length > 0 && openaiKey) {
            try {
                const leadSummary = results.map((r: any, i: number) => `[ID:${i}] Name: ${r.name}, Category: ${r.type || r.category}, Desc: ${r.description || ''}`).join('\n')

                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: `Filter this list of leads based on these instructions: ${ai_filter}. Return ONLY a JSON array of IDs worth keeping. Format: [0, 4, 7]` },
                            { role: 'user', content: leadSummary }
                        ],
                        response_format: { type: 'json_object' }
                    })
                })
                const aiData = await aiRes.json()
                const text = aiData.choices[0].message.content
                const json = JSON.parse(text)
                const idsToKeep = Array.isArray(json) ? json : (json.ids || json.keep || [])
                results = results.filter((_: any, i: number) => idsToKeep.includes(i))
                console.log(`🤖 After AI: ${results.length} leads.`)
            } catch (e) {
                console.error('AI Filtering Error:', e)
            }
        }

        // 3. PREPARE FOR DB
        const leadsToInsert = results.map((item: any) => ({
            name: item.name,
            phone: item.phone,
            address: item.full_address,
            site: item.site,
            rating: item.rating,
            reviews: item.reviews_count || 0,
            category: item.type || item.category,
            search_query: fullQuery,
            state: state,
            city: city,
            instagram: item.instagram,
            facebook: item.facebook,
            email: item.email_1 || item.email,
            metadata: item,
            status: 'pending'
        }))

        // 4. INSERT
        if (leadsToInsert.length > 0) {
            await fetch(`${supabaseUrl}/rest/v1/leads`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates'
                },
                body: JSON.stringify(leadsToInsert)
            })
        }

        if (campaignId) {
            await supabase.from("prospecting_campaigns").update({
                status: "completed",
                valid_leads: leadsToInsert.length,
                total_leads: results.length
            }).eq("id", campaignId);
        }

        return new Response(JSON.stringify({
            success: true,
            count: leadsToInsert.length,
            leads: leadsToInsert
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error) {
        console.error('💥 Outscraper Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
