import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sleep helper function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { campaignId } = await req.json()
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Fetch Campaign
        const { data: campaign, error: campError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()

        if (campError || !campaign) throw new Error("Campaign not found")

        console.log(`🚀 Starting Campaign: ${campaign.name} (${campaign.id})`)
        await supabase.from('campaigns').update({ status: 'running' }).eq('id', campaignId)

        // 2. Fetch Targets
        // Assuming 'target_tags' is array of strings.
        // We want contacts that have AT LEAST ONE of the tags (overlap 'ov') OR ALL? 
        // Typically 'ov' (is in segment).
        let query = supabase.from('contacts').select('id, name, phone, tags').eq('status', 'lead') // Basic filter

        if (campaign.target_tags && campaign.target_tags.length > 0) {
            query = query.overlaps('tags', campaign.target_tags)
        }

        const { data: contacts, error: contactError } = await query

        if (contactError) throw contactError
        console.log(`🎯 Found ${contacts?.length || 0} targets`)

        let sent = 0
        let failed = 0

        // 3. Execution Loop
        for (const contact of (contacts || [])) {
            if (!contact.phone) continue

            try {
                let content = campaign.message_template || "Olá {{name}}!"

                // 3.1 Personalization - Name
                content = content.replace(/{{name}}/g, contact.name || "Cliente")

                // 3.2 Personalization - Memories
                if (content.includes('[memories]')) {
                    // Fetch top memory
                    const { data: mem } = await supabase
                        .from('contact_memory')
                        .select('fact_value')
                        .eq('contact_id', contact.id)
                        .eq('is_active', true)
                        .order('confidence_score', { ascending: false })
                        .limit(1)
                        .single()

                    const memoryText = mem?.fact_value ? `(Lembro que você: ${mem.fact_value})` : ""
                    content = content.replace('[memories]', memoryText)
                }

                // 3.3 Send (Humanized & Splitted)
                // Enforce 300 chars limit for better delivery/UX
                const smartSplit = (text: string, maxLength: number = 300): string[] => {
                    const result: string[] = [];
                    const segments = text.split('\n');
                    for (const segment of segments) {
                        let current = segment.trim();
                        if (current.length === 0) continue;
                        if (current.length > maxLength) {
                            while (current.length > maxLength) {
                                let splitAt = -1;
                                const boundaries = [' ', '.', '!', '?', ',', ';'];
                                for (const b of boundaries) {
                                    const found = current.lastIndexOf(b, maxLength);
                                    if (found > splitAt) splitAt = found;
                                }
                                if (splitAt === -1 || splitAt < maxLength * 0.7) splitAt = maxLength;
                                else splitAt += 1;

                                result.push(current.substring(0, splitAt).trim());
                                current = current.substring(splitAt).trim();
                            }
                        }
                        if (current.length > 0) result.push(current);
                    }
                    return result;
                }

                const messagesToSend = smartSplit(content, 300);

                for (const msg of messagesToSend) {
                    const { error: sendError } = await supabase.functions.invoke('evolution-send-v3', {
                        body: {
                            action: 'send_message',
                            phone: contact.phone,
                            content: msg
                        }
                    })
                    if (sendError) throw new Error("Invoke failed")

                    // Small delay between segments of the SAME campaign message
                    if (messagesToSend.length > 1) await sleep(1000);
                }

                // We should really check the response of invoke, but assuming success for now if no throw.
                sent++
                console.log(`✅ Sent to ${contact.phone}`)

            } catch (e) {
                console.error(`❌ Failed to ${contact.phone}:`, e)
                failed++
            }

            // 3.4 Rate Limit (Random 2-5s)
            const delay = Math.floor(Math.random() * 3000) + 2000
            await sleep(delay)
        }

        // 4. Finish
        await supabase.from('campaigns').update({
            status: 'completed',
            stats: { sent, failed, finished_at: new Date().toISOString() } // Assuming 'stats' jsonb column exists or we fail silently/should check usage
        }).eq('id', campaignId)

        return new Response(JSON.stringify({ sent, failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

    } catch (error: any) {
        console.error("Campaign Error:", error)
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})
