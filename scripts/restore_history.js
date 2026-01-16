import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIG ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Use SERVICE_ROLE_KEY if available, else ANON (Requires RLS disabled on messages)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const EVO_URL = process.env.VITE_EVOLUTION_API_URL || process.env.EVOLUTION_API_URL;
const EVO_KEY = process.env.VITE_EVOLUTION_API_KEY || process.env.EVOLUTION_API_KEY;

// NOTE: Hardcoded instance fallback if connections table is empty/ambiguous
const FALLBACK_INSTANCE = 'gama';

if (!SUPABASE_URL || !SUPABASE_KEY || !EVO_URL || !EVO_KEY) {
    console.error("❌ Mising ENV vars. Check .env file.");
    console.log("Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' }
});

async function main() {
    console.log("🚀 Starting History Restore...");

    // 1. Get Instance Name
    let instanceName = FALLBACK_INSTANCE;
    const { data: connections } = await supabase.from('connections').select('instance_name').limit(1);
    if (connections && connections.length > 0) {
        instanceName = connections[0].instance_name;
        console.log(`✅ Using Instance from DB: ${instanceName}`);
    } else {
        console.warn(`⚠️ No connection found in DB. Using fallback: ${instanceName}`);
    }

    // 2. Fetch All Contacts (We need their IDs and Phones)
    console.log("📦 Fetching contacts from Supabase...");
    const { data: contacts, error: contactError } = await supabase
        .from('contacts')
        .select('id, phone, organization_id')
        .not('phone', 'is', null);

    if (contactError) {
        console.error("❌ Error fetching contacts:", contactError.message);
        process.exit(1);
    }

    console.log(`✅ Found ${contacts.length} contacts. Starting sync...`);

    let totalMessages = 0;
    let errors = 0;

    for (const [index, contact] of contacts.entries()) {
        const progress = Math.round(((index + 1) / contacts.length) * 100);
        const cleanPhone = contact.phone.replace(/\D/g, ''); // 551199999999

        if (!cleanPhone) continue;

        try {
            // console.log(`[${progress}%] Syncing history for ${cleanPhone}...`);

            // 3. Fetch Messages from Evolution
            // POST /chat/findMessages/{instance}
            // { number: "55...", count: 50, page: 1 }
            const response = await axios.post(`${EVO_URL}/chat/findMessages/${instanceName}`, {
                where: {
                    key: {
                        remoteJid: `${cleanPhone}@s.whatsapp.net`
                    }
                },
                options: {
                    limit: 50,
                    sort: { role: 1 }, // Optional: try to sort
                    offset: 0
                }
            }, {
                headers: { 'apikey': EVO_KEY }
            });

            const messagesData = response.data;
            // Structure: Array of messages OR { messages: { records: [...] } }
            let messages = [];
            if (Array.isArray(messagesData)) messages = messagesData;
            else if (messagesData?.messages?.records) messages = messagesData.messages.records;
            else if (messagesData?.data) messages = messagesData.data;

            if (!messages || messages.length === 0) {
                console.log(`⚠️ No messages for ${cleanPhone} (Status: ${response.status})`);
                // verbose: console.log("Response:", JSON.stringify(messagesData).substring(0, 100));
                process.stdout.write('.');
                continue;
            } else {
                console.log(`\n✅ ${cleanPhone}: Found ${messages.length} msgs`);
                const sampleJid = messages[0].key?.remoteJid || 'undefined';
                console.log(`   🔎 Sample JID: ${sampleJid} (Expected: ${cleanPhone})`);

                // Safety: Filter by JID if mismatch
                if (sampleJid !== 'undefined' && !sampleJid.includes(cleanPhone)) {
                    console.warn(`   ⚠️ DATA MISMATCH! API returned data for ${sampleJid} when asked for ${cleanPhone}. Skipping.`);
                    continue;
                }
            }

            // 4. Map to Supabase Schema
            const payloads = messages.map(msg => {
                const key = msg.key || {};
                const contentObj = msg.message || {};

                let text = '';
                let type = 'text';

                // Robust Content Extraction
                if (contentObj.conversation) text = contentObj.conversation;
                else if (contentObj.extendedTextMessage?.text) text = contentObj.extendedTextMessage.text;
                else if (contentObj.imageMessage) { type = 'image'; text = contentObj.imageMessage.caption || ''; }
                else if (contentObj.audioMessage) { type = 'audio'; }
                else if (contentObj.videoMessage) { type = 'video'; text = contentObj.videoMessage.caption || ''; }
                else if (contentObj.documentMessage) { type = 'document'; text = contentObj.documentMessage.fileName || 'Documento'; }

                if (!text && type === 'text') return null;

                const ts = msg.messageTimestamp
                    ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : parseInt(msg.messageTimestamp))
                    : Date.now() / 1000;

                return {
                    contact_id: contact.id,
                    organization_id: contact.organization_id, // Important for RLS
                    phone: contact.phone,
                    role: key.fromMe ? 'assistant' : 'user',
                    content: text || (type === 'audio' ? '[Áudio]' : '[Mídia]'),
                    message_type: type,
                    whatsapp_message_id: key.id || `restored_${Date.now()}_${Math.random()}`,
                    status: 'delivered', // Assume delivered for history
                    created_at: new Date(ts * 1000).toISOString(),
                    from_me: key.fromMe || false,
                    payload: msg // Store full payload just in case
                };
            }).filter(x => x !== null);

            if (payloads.length > 0) {
                const { data: inserted, error: upsertErr } = await supabase
                    .from('messages')
                    .upsert(payloads, { onConflict: 'whatsapp_message_id' }) // Revert to Upsert
                    .select();

                if (upsertErr) {
                    console.error(`\n❌ DB Error ${cleanPhone}:`, upsertErr.message);
                    errors++;
                } else if (!inserted || inserted.length === 0) {
                    console.error(`\n⚠️ Zero rows inserted for ${cleanPhone} (RLS Blocked or Silent Fail)`);
                    errors++;
                } else {
                    totalMessages += inserted.length;
                    process.stdout.write('✅');
                    console.log(`\nSample Insert: ID ${inserted[0].id} | WA_ID ${inserted[0].whatsapp_message_id} | Contact ${inserted[0].contact_id}`);
                }
            }

        } catch (e) {
            // 404 means no history found usually, or invalid number
            // console.warn(`Error fetching ${cleanPhone}: ${e.message}`);
            process.stdout.write('x');
            errors++;
        }
    }

    console.log(`\n\n🎉 Restore Complete!`);
    console.log(`Total Messages Restored: ${totalMessages}`);
    console.log(`Errors/Skips: ${errors}`);
}

main().catch(console.error);
