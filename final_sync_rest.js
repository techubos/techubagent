
// FINAL SYNC SCRIPT - REST ONLY - NO SDK
// To avoid global fetch pollution

const supabaseUrl = "https://eqoefszhqllengnvjbrm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjEzMiwiZXhwIjoyMDgzNDcyMTMyfQ.z03uiVa5HSL9XcTBYSBzoLGDyomduf_uHtS98HF6nno";
const evoUrl = "https://evolution.gamacreativedesign.com.br";
const evoKey = "429683C4C977415CAAFCCE10F7D57E11";
const instance = "gama";
const orgId = "e5c17522-5779-49ba-93e1-c6445f341e1a";

async function supaFetch(path, method, body) {
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : 'return=minimal'
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Supabase Error ${res.status}: ${txt}`);
    }
    return res;
}

async function syncContact(phone, contactId) {
    try {
        const cleanPhone = phone.replace(/\D/g, '');
        console.log(`Syncing ${cleanPhone}...`);

        // Fetch from Evolution (Using EXACT Probe Headers/Body)
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
            console.log(`Evo API Error: ${response.status}`);
            return;
        }

        const msgData = await response.json();
        // DEBUG LOG RAW
        console.log("RAW MSG DATA:", JSON.stringify(msgData).substring(0, 500));

        // Parse correct structure based on logs: {"messages":{"total":...,"records":[...]}}
        let evoMessages = [];
        if (Array.isArray(msgData)) {
            evoMessages = msgData;
        } else if (msgData?.messages?.records && Array.isArray(msgData.messages.records)) {
            evoMessages = msgData.messages.records;
        } else if (msgData?.messages && Array.isArray(msgData.messages)) {
            evoMessages = msgData.messages;
        }

        console.log(`Found ${evoMessages.length} messages.`);
        if (evoMessages.length > 0) {
            // Check if object
            if (typeof evoMessages[0] !== 'object') {
                console.log("Still getting IDs? First item:", evoMessages[0]);
                return;
            }
        }

        const payloads = evoMessages.map(msg => {
            if (!msg.key) return null;
            const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption;
            const fromMe = msg.key.fromMe || false;

            if (!content && !msg.message?.imageMessage && !msg.message?.audioMessage) return null;

            return {
                contact_id: contactId, // CRITICAL FIX: Explicit link
                phone: cleanPhone,
                organization_id: orgId,
                role: fromMe ? 'assistant' : 'user',
                content: content || '[Mídia]',
                status: 'delivered',
                whatsapp_message_id: msg.key.id,
                created_at: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
                payload: msg
            };
        }).filter(p => p !== null);

        console.log(`Inserting ${payloads.length} msgs...`);
        if (payloads.length > 0) {
            await supaFetch('messages?on_conflict=whatsapp_message_id', 'POST', payloads);
            console.log("Inserted.");
        }

    } catch (e) {
        console.error("Exception:", e.message);
    }
}

async function run() {
    console.log("Fetching contacts...");
    const res = await supaFetch(`contacts?select=id,phone&organization_id=eq.${orgId}`, 'GET');
    const contacts = await res.json();

    console.log(`Found ${contacts.length} contacts.`);

    // Critical First
    const critical = contacts.find(c => c.phone && c.phone.includes("99630882"));
    if (critical) {
        console.log("!!! SYNCING CRITICAL !!!");
        await syncContact(critical.phone, critical.id);
    }

    for (const c of contacts) {
        if (critical && c.id === critical.id) continue;
        if (!c.phone) continue;
        await syncContact(c.phone, c.id);
    }
    console.log("DONE.");
}

run();
