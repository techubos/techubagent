import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://eqoefszhqllengnvjbrm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjEzMiwiZXhwIjoyMDgzNDcyMTMyfQ.z03uiVa5HSL9XcTBYSBzoLGDyomduf_uHtS98HF6nno";
const evoUrl = "https://evolution.gamacreativedesign.com.br";
const evoKey = "429683C4C977415CAAFCCE10F7D57E11";
const instance = "gama";
const orgId = "e5c17522-5779-49ba-93e1-c6445f341e1a";

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncContact(phone, contactId) {
    try {
        const cleanPhone = phone.replace(/\D/g, '');
        console.log(`Syncing ${cleanPhone}...`);

        // Fetch from Evolution (Directly)
        // Using LIMIT 10
        const response = await fetch(`${evoUrl}/chat/findMessages/${instance}`, {
            method: 'POST',
            headers: {
                'apikey': evoKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: cleanPhone,
                limit: 1,
                count: 1
            })
        });

        if (!response.ok) {
            console.error(`Evo API Error: ${response.status}`);
            return;
        }

        const msgData = await response.json();
        // console.log("Raw Response Key Type:", typeof msgData.messages);

        let evoMessages = [];
        if (Array.isArray(msgData)) {
            evoMessages = msgData;
        } else if (msgData?.messages) {
            if (Array.isArray(msgData.messages)) {
                evoMessages = msgData.messages;
            } else if (typeof msgData.messages === 'object') {
                // Handle object map
                console.log("Messages is object, converting to array...");
                evoMessages = Object.values(msgData.messages);
            }
        } else if (msgData?.data && Array.isArray(msgData.data)) {
            evoMessages = msgData.data;
        } else {
            console.log("Unknown format. Keys:", Object.keys(msgData || {}));
            // If it's a single message object?
            if (msgData?.key) evoMessages = [msgData];
        }

        console.log(`Found ${evoMessages.length} messages.`);
        if (evoMessages.length > 0) {
            console.log("Sample Msg:", JSON.stringify(evoMessages[0]).substring(0, 300));
        }

        if (evoMessages.length === 0) return;

        const payloads = evoMessages.map(msg => {
            if (!msg.key) return null;
            const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption;
            const fromMe = msg.key.fromMe || false;

            // Basic filtering
            if (!content && !msg.message?.imageMessage && !msg.message?.audioMessage) return null;

            return {
                phone: cleanPhone,
                organization_id: orgId,
                role: fromMe ? 'assistant' : 'user',
                content: content || '[Mídia]',
                status: 'delivered', // Default for history
                whatsapp_message_id: msg.key.id,
                created_at: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
                payload: msg
            };
        }).filter(p => p !== null);

        console.log(`Inserting ${payloads.length} msgs to DB...`);
        if (payloads.length > 0) {
            // Using service role, RLS is bypassed but we use upsert
            const { error } = await supabase.from('messages').upsert(payloads, { onConflict: 'whatsapp_message_id' });
            if (error) console.error("DB Error:", error);
            else console.log("DB Success.");
        }

    } catch (e) {
        console.error("Sync Exception:", e);
    }
}

async function run() {
    console.log("HARDCODED TEST RUN for 553199630882");
    await syncContact('553199630882', 'hardcoded-test-id');
}

run();
