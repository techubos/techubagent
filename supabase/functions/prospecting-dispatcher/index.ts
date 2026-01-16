// PROSPECTING DISPATCHER & GENERATOR (Anti-Ban)
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
        const { action, payload } = await req.json()

        // Fetch Config from DB
        const { data: settingsData } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'agent_config')
            .single();

        const agentConfig = settingsData?.value || {};

        const openaiKey = agentConfig.apiKeys?.openai || Deno.env.get('OPENAI_API_KEY');
        const evolutionUrl = agentConfig.evolutionConfig?.url || Deno.env.get('EVOLUTION_API_URL');
        const evolutionKey = agentConfig.evolutionConfig?.apiKey || Deno.env.get('EVOLUTION_API_KEY');
        const evolutionInstance = agentConfig.evolutionConfig?.instanceName || Deno.env.get('EVOLUTION_INSTANCE_NAME');

        // ACTION: GENERATE QUEUE
        if (action === 'generate') {
            const { contactIds, baseScript, deepEnrich } = payload
            if (!contactIds?.length || !baseScript) throw new Error('Contacts and Script required')

            console.log(`🚀 Generating queue for ${contactIds.length} leads...`)

            // 1. Fetch Contact Data
            const contactsRes = await fetch(`${supabaseUrl}/rest/v1/contacts?id=in.(${contactIds.join(',')})&select=id,name,phone,website,website_summary`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            })
            const contacts = await contactsRes.json()

            // 1.1 Web Scraping & Enrichment (Optional)
            const enrichedContacts = [...contacts]
            if (deepEnrich && openaiKey) {
                console.log(`🌐 Performing Deep Enrichment for ${contacts.length} leads...`)
                for (let i = 0; i < enrichedContacts.length; i++) {
                    const c = enrichedContacts[i]
                    if (c.website && !c.website_summary) {
                        try {
                            const siteRes = await fetch(c.website, { signal: AbortSignal.timeout(5000) })
                            const html = await siteRes.text()
                            const metaDesc = html.match(/<meta name="description" content="(.*)"/i)?.[1] ||
                                html.match(/<meta property="og:description" content="(.*)"/i)?.[1] ||
                                html.replace(/<[^>]*>/g, '').slice(0, 1000).trim()

                            const sumRes = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: 'gpt-4o-mini',
                                    messages: [
                                        { role: 'system', content: 'Summarize what this company does based on the text. Max 20 words. Focus on services offered.' },
                                        { role: 'user', content: metaDesc }
                                    ]
                                })
                            })
                            const sumData = await sumRes.json()
                            const summary = sumData.choices[0].message.content
                            enrichedContacts[i].website_summary = summary

                            await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${c.id}`, {
                                method: 'PATCH',
                                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ website_summary: summary })
                            })
                        } catch (e) {
                            console.error(`Failed to enrich ${c.website}:`, e.message)
                        }
                    }
                }
            }

            // 2. Generate Variations with AI
            if (!openaiKey) throw new Error('OpenAI key required for generation');

            const prompt = `Generate ${enrichedContacts.length} unique variations of this WhatsApp message for prospecting. 
            Base Script: "${baseScript}"
            For each lead, use their name and city if available. 
            IMPORTANT: If "company_bio" is provided, incorporate it NATURALLY to show you actually know what they do.
            Return a JSON array of objects: {"variations": [{"name": "...", "message": "..."}]}
            Lead Data: ${JSON.stringify(enrichedContacts.map((c: any) => ({ name: c.name, company_bio: c.website_summary || '' })))}`

            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'system', content: 'You are a professional prospecting copywriter. Generate variations that sound 100% human and natural, varying the greeting and structure.' }, { role: 'user', content: prompt }],
                    response_format: { type: 'json_object' }
                })
            })
            const aiData = await aiRes.json()
            const variations = JSON.parse(aiData.choices[0].message.content).variations || []

            // 3. Insert into Queue with Randomized Delays
            let nextSchedule = new Date()
            const queueItems = contacts.map((contact: any, idx: number) => {
                const variation = variations[idx]?.message || baseScript
                const delaySeconds = Math.floor(Math.random() * (300 - 180 + 1) + 180)
                nextSchedule = new Date(nextSchedule.getTime() + delaySeconds * 1000)

                return {
                    contact_id: contact.id,
                    message: variation,
                    scheduled_at: nextSchedule.toISOString(),
                    status: 'pending'
                }
            })

            const insertRes = await fetch(`${supabaseUrl}/rest/v1/prospecting_queue`, {
                method: 'POST',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(queueItems)
            })

            if (!insertRes.ok) throw new Error(`Queue Insert Error: ${await insertRes.text()}`)

            return new Response(JSON.stringify({ success: true, count: queueItems.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ACTION: START SEQUENCE (Prospecting 2.0)
        if (action === 'start_sequence') {
            const { contactIds, sequenceId } = payload;
            if (!contactIds?.length || !sequenceId) throw new Error('Contacts and Sequence ID required');

            console.log(`🚀 Starting Sequence ${sequenceId} for ${contactIds.length} leads...`);

            // 1. Verify Sequence Exists
            const { data: sequence } = await supabase.from('sequences').select('*').eq('id', sequenceId).single();
            if (!sequence) throw new Error('Sequence not found');

            // 2. Create Contact Sequences
            const toInsert = contactIds.map((cid: string) => ({
                contact_id: cid,
                sequence_id: sequenceId,
                status: 'active',
                current_step_index: 0,
                next_run_at: new Date().toISOString(), // Run immediately
                metadata: { source: 'campaign_launcher' }
            }));

            const { error: insertError } = await supabase.from('contact_sequences').insert(toInsert);
            if (insertError) throw insertError;

            // 3. Trigger immediate tick to send first messages
            // We can just call process_sequences here or let the standard tick handle it
            // Let's return success and let the background tick pick it up (or manual tick via UI)

            return new Response(JSON.stringify({ success: true, count: toInsert.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ACTION: VALIDATE PHONES (The Bouncer)
        if (action === 'validate_phones') {
            const { phones } = payload;
            if (!phones || !Array.isArray(phones)) throw new Error('Phones array required');

            console.log(`🦁 The Bouncer checking ${phones.length} numbers...`);

            // Allow batching if needed, but for now simple promise.all with concurrency limit
            const results = {};

            // Helper to check single number (with delay to avoid rate limit if needed)
            const checkNumber = async (phone: string) => {
                try {
                    // Normalize phone (remove + if present, keep digits)
                    const cleanPhone = phone.replace(/\D/g, '');
                    const res = await fetch(`${evolutionUrl}/chat/checkNumberStatus/${evolutionInstance}`, {
                        method: 'POST',
                        headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ number: cleanPhone })
                    });
                    const data = await res.json();

                    // Evolution checkNumberStatus usually returns: { exists: true, jid: "..." } or { exists: false }
                    // Some versions return status: 200/404. We assume { exists: boolean } based on standard Evo API.
                    return { phone, valid: data?.exists === true, type: 'cell' };
                } catch (e) {
                    console.error(`Check failed for ${phone}`, e);
                    return { phone, valid: false, error: true };
                }
            };

            // Process in chunks of 5 to respect API rate limits
            const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
            const chunks = chunk(phones, 5);

            const validationResults = [];

            for (const c of chunks) {
                const chunkResults = await Promise.all(c.map(p => checkNumber(p)));
                validationResults.push(...chunkResults);
                // Slight delay between chunks
                await new Promise(r => setTimeout(r, 500));
            }

            return new Response(JSON.stringify({ success: true, results: validationResults }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ACTION: SEARCH (Proxy for Outscraper/Google)
        // ... (We could merge existing searches here later)

        // ACTION: TICK (Run as Cron)
        if (action === 'tick') {
            console.log('⏰ Dispatcher Tick...')

            // 1. Load Safety Config & Stats
            const { data: configData } = await supabase.from('settings').select('value').eq('key', 'safety_config').single();
            const { data: statsData } = await supabase.from('settings').select('value').eq('key', 'safety_stats').single();

            const safetyConfig = configData?.value || { daily_limit: 100, min_delay_seconds: 60, jitter_seconds: 30 };
            let safetyStats = statsData?.value || { date: new Date().toISOString().split('T')[0], count: 0 };

            const today = new Date().toISOString().split('T')[0];

            // Generate valid today's stat if date changed
            if (safetyStats.date !== today) {
                safetyStats = { date: today, count: 0 };
                await supabase.from('settings').upsert({ key: 'safety_stats', value: safetyStats });
            }

            console.log(`🛡️ Safety Status: ${safetyStats.count}/${safetyConfig.daily_limit} sent today.`);

            if (safetyStats.count >= safetyConfig.daily_limit) {
                console.log('🛑 Daily Limit Reached. Skipping Tick.');
                return new Response(JSON.stringify({ status: 'limit_reached' }), { headers: corsHeaders });
            }

            // ... (Queue Processing Logic - Keeping it but adding safety check to process_sequences) ...

            // 1a. Load Agent Config (for OpenAI Key)
            const { data: agentData } = await supabase.from('settings').select('value').eq('key', 'agent_config').single();
            const openaiKey = agentData?.value?.apiKeys?.openai || Deno.env.get('OPENAI_API_KEY');

            // 5. PROCESS SEQUENCES
            try {
                // Pass config and current count to process_sequences
                await process_sequences(supabaseUrl, supabaseKey, evolutionUrl, evolutionKey, evolutionInstance, safetyConfig, safetyStats.count, today, supabase, openaiKey)
            } catch (e) {
                console.error('Sequence Processing Error:', e)
            }

            // 6. Trigger SLA Engine
            try {
                await fetch(`${supabaseUrl}/functions/v1/notification-processor`, {
                    method: 'POST',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'check_sla' })
                })
            } catch (e) {
                console.error('Failed to trigger SLA Check:', e)
            }

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
        }

        throw new Error('Invalid Action')

    } catch (error) {
        console.error('💥 Dispatcher Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: corsHeaders
        })
    }
})

async function process_sequences(
    supabaseUrl: string,
    supabaseKey: string,
    evolutionUrl: string,
    evolutionKey: string,
    evolutionInstance: string,
    safetyConfig: any,
    currentCount: number,
    today: string,

    supabase: any,
    openaiKey?: string
) {
    if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
        console.error('Evolution config missing for sequence processing');
        return;
    }
    console.log('🔄 Processing Sequences...')
    const now = new Date().toISOString()

    // Safety Vars
    let dailyCount = currentCount;
    const dailyLimit = safetyConfig.daily_limit || 50;

    const res = await fetch(`${supabaseUrl}/rest/v1/contact_sequences?status=eq.active&next_run_at=lte.${now}&limit=5`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
    const runs = await res.json()

    for (const run of runs) {
        const seqRes = await fetch(`${supabaseUrl}/rest/v1/sequences?id=eq.${run.sequence_id}&select=id,steps`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        })
        const sequence = (await seqRes.json())[0]
        const steps = sequence.steps || []
        const currentStep = steps[run.current_step_index]

        const contactRes = await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${run.contact_id}&select=id,phone,name`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        })
        const contact = (await contactRes.json())[0]

        if (!currentStep || !contact) {
            await update_run_status(supabaseUrl, supabaseKey, run.id, 'completed')
            continue
        }

        console.log(`🏃 Executing Sequence ${run.sequence_id} Step ${run.current_step_index} for ${contact.phone}`)

        let success = true

        if (currentStep.type === 'message') {
            // 1. CHECK DAILY LIMIT (Again, to be safe inside the loop)
            if (dailyCount >= dailyLimit) {
                console.log('🛑 Daily Limit Hit during sequence processing. Stopping.');
                break;
            }

            let text = currentStep.content.replace('{{name}}', contact.name || 'amigo');

            // --- 🤖 AI CHAMALEON MODE ---
            if (currentStep.messageType === 'ai_prompt' && openaiKey) {
                try {
                    console.log(`🦎 Generating Chameleon Message for ${contact.phone}...`);
                    const genRes = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [
                                {
                                    role: 'system',
                                    content: `Você é um especialista em Copywriting para WhatsApp (SDR).
CONTEXTO DO LEAD:
Nome: ${contact.name}
Empresa/Bio: ${contact.website_summary || 'N/A'}

SUA MISSÃO:
Escreva uma mensagem de prospecção ÚNICA e CURTA baseada na instrução abaixo.
Não use "Assunto:". Não use aspas. Seja natural. Use gírias leves se apropriado.
`
                                },
                                { role: 'user', content: `INSTRUÇÃO: ${currentStep.content}` }
                            ]
                        })
                    });
                    const genData = await genRes.json();
                    if (genData.choices?.[0]?.message?.content) {
                        text = genData.choices[0].message.content.trim();
                        // Strip quotes if AI added them
                        if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
                    }
                } catch (e) {
                    console.error('Chameleon Generation Failed, falling back to static prompt:', e);
                }
            }
            // ---------------------------

            const evRes = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
                method: 'POST',
                headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: contact.phone, text, linkPreview: false })
            })

            if (evRes.ok) {
                success = true;
                dailyCount++; // Increment local counter
                // Update DB Stat (Optimistic)
                await supabase.from('settings').upsert({
                    key: 'safety_stats',
                    value: { date: today, count: dailyCount }
                });
            } else {
                success = false;
                console.error('Evolution Error:', await evRes.text());
            }
        }

        if (success) {
            const nextStepIndex = run.current_step_index + 1
            const nextStep = steps[nextStepIndex]

            if (!nextStep) {
                await update_run_status(supabaseUrl, supabaseKey, run.id, 'completed')
            } else if (nextStep.type === 'wait') {
                let waitMs = parse_wait(nextStep.value)

                // ADD JITTER (Anti-Ban)
                // Default 10% jitter if not configured, otherwise use config
                const jitterSecs = safetyConfig.jitter_seconds ?? 60;
                const jitterMs = Math.floor(Math.random() * (jitterSecs * 1000));
                waitMs += jitterMs;

                // Enforce Min Delay
                const minDelayMs = (safetyConfig.min_delay_seconds ?? 30) * 1000;
                if (waitMs < minDelayMs) waitMs = minDelayMs;

                const nextDate = new Date(Date.now() + waitMs).toISOString()
                console.log(`⏱️ Scheduled next step for ${contact.phone} in ${waitMs / 1000}s (Jitter: ${jitterMs / 1000}s)`)

                await fetch(`${supabaseUrl}/rest/v1/contact_sequences?id=eq.${run.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        current_step_index: nextStepIndex + 1,
                        next_run_at: nextDate
                    })
                })
            } else {
                await fetch(`${supabaseUrl}/rest/v1/contact_sequences?id=eq.${run.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ current_step_index: nextStepIndex, next_run_at: now })
                })
            }
        }
    }
}

function parse_wait(val: string): number {
    const num = parseInt(val) || 0
    if (val.includes('h')) return num * 60 * 60 * 1000
    if (val.includes('m')) return num * 60 * 1000
    if (val.includes('d')) return num * 24 * 60 * 60 * 1000
    return num * 1000
}

async function update_run_status(supabaseUrl: string, supabaseKey: string, id: string, status: string) {
    await fetch(`${supabaseUrl}/rest/v1/contact_sequences?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    })
}
