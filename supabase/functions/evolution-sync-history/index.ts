
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_CONTACTS_PER_RUN = 10;
const TIMEOUT_MS = 10000;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        // Hardcoded for reliability during crisis
        const evoKey = "429683C4C977415CAAFCCE10F7D57E11";
        const evoUrl = Deno.env.get('EVOLUTION_API_URL');

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch Contacts (Logic: Prioritize those with fewest messages or Last Message Old?)
        // For simplicity: All contacts, paginated by offset provided in body or just random?
        // Better: Fetch contacts created/updated recently? 
        // Request Requirement: "Busca todos os contatos". We'll do a batch.

        const { data: contacts, error: contactError } = await supabase
            .from('contacts')
            .select('id, phone, organization_id')
            .not('phone', 'is', null) // Must have phone
            .limit(MAX_CONTACTS_PER_RUN);
        // In a real cron, we might want to randomize order or use a cursor table

        if (contactError) throw contactError;

        let totalSynced = 0;

        // 2. Iterate
        for (const contact of contacts) {
            const phone = contact.phone.replace(/\D/g, '');
            if (!phone || phone.length < 10) continue;

            const { data: conn } = await supabase.from('connections').select('instance_name').eq('organization_id', contact.organization_id).maybeSingle();
            const instance = conn?.instance_name || 'gama'; // Default fallback

            log(`Syncing ${phone} (Instance: ${instance})...`);

            try {
                // TIMEOUT CONTROL
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

                const response = await fetch(`${evoUrl}/chat/findMessages/${instance}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': evoKey
                    },
                    body: JSON.stringify({
                        number: phone,
                        limit: 50,
                        count: 50
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    log(`Failed to fetch ${phone}: ${response.status}`);
                    continue;
                }

                const body = await response.json();
                // PARSE
                let data: any[] = [];
                if (Array.isArray(body)) data = body;
                else if (body?.messages?.records) data = body.messages.records; // TARGET STRUCTURE
                else if (Array.isArray(body?.messages)) data = body.messages;
                else if (Array.isArray(body?.data)) data = body.data;

                if (!data || data.length === 0) {
                    log(`No messages for ${phone}`);
                    continue;
                }

                const payloads = data.map((msg: any) => {
                    // Robust Mapping
                    const key = msg.key || {};
                    const contentObj = msg.message || {};

                    let text = '';
                    let type = 'text';

                    if (contentObj.conversation) text = contentObj.conversation;
                    else if (contentObj.extendedTextMessage?.text) text = contentObj.extendedTextMessage.text;
                    else if (contentObj.imageMessage) { type = 'image'; text = contentObj.imageMessage.caption || ''; }
                    else if (contentObj.audioMessage) { type = 'audio'; }

                    if (!text && type === 'text') return null;

                    return {
                        contact_id: contact.id,
                        organization_id: contact.organization_id,
                        phone: phone,
                        role: key.fromMe ? 'assistant' : 'user',
                        content: text || (type === 'audio' ? '[Audio]' : '[Media]'),
                        message_type: type,
                        whatsapp_message_id: key.id,
                        status: 'delivered',
                        created_at: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
                        from_me: key.fromMe,
                        payload: msg
                    };
                }).filter(x => x !== null);

                if (payloads.length > 0) {
                    const { error: upsertErr } = await supabase.from('messages').upsert(payloads, { onConflict: 'whatsapp_message_id' });
                    if (upsertErr) log(`Upsert error ${phone}: ${upsertErr.message}`);
                    else totalSynced += payloads.length;
                }

            } catch (err) {
                log(`Error processing ${phone}: ${err.message}`);
            }
        }

        // 3. Update Health
        await supabase.rpc('update_system_health', {
            p_org_id: contacts[0]?.organization_id || '00000000-0000-0000-0000-000000000000',
            p_component: 'evolution',
            p_status: 'healthy'
        });

        return new Response(JSON.stringify({ success: true, processed: contacts.length, messages_synced: totalSynced, logs }), {
            headers: corsHeaders, status: 200
        });

    } catch (fatal) {
        return new Response(JSON.stringify({ error: fatal.message, logs }), { headers: corsHeaders, status: 500 });
    }
});
