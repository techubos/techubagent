
// DEBUG REGYS ONLY
const supabaseUrl = "https://eqoefszhqllengnvjbrm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjEzMiwiZXhwIjoyMDgzNDcyMTMyfQ.z03uiVa5HSL9XcTBYSBzoLGDyomduf_uHtS98HF6nno";
const evoUrl = "https://evolution.gamacreativedesign.com.br";
const evoKey = "429683C4C977415CAAFCCE10F7D57E11";
const instance = "gama"; // or teclab? User trace showed instance='teclab' in one log, but 'gama' in others. Using 'gama' based on previous success.
// WAIT: The logs in Step 3117 showed "instance":"teclab" for a webhook??
// "instanceId":"6a1cc642..."
// But previous successful syncs used "gama".
// Let's stick to "gama" first, as that worked for other numbers.

const targetPhone = "553198149957";
const contactId = "649952b0-8fb1-4d96-bbe1-b3506fb0e27d";
const orgId = "e5c17522-5779-49ba-93e1-c6445f341e1a";

async function run() {
    console.log(`DEBUGGING REGYS: ${targetPhone}`);

    // 1. Fetch Evo
    const response = await fetch(`${evoUrl}/chat/findMessages/${instance}`, {
        method: 'POST',
        headers: {
            'apikey': evoKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            number: targetPhone,
            limit: 50,
            count: 50
        })
    });

    if (!response.ok) {
        console.log(`API ERROR: ${response.status} - ${await response.text()}`);
        return;
    }

    const msgData = await response.json();
    console.log("RAW DATA KEYS:", Object.keys(msgData));
    if (msgData.messages) console.log("MSG KEYS:", Object.keys(msgData.messages));

    let evoMessages = [];
    if (msgData?.messages?.records && Array.isArray(msgData.messages.records)) {
        evoMessages = msgData.messages.records;
    } else if (msgData?.messages && Array.isArray(msgData.messages)) {
        evoMessages = msgData.messages;
    } else if (Array.isArray(msgData)) {
        evoMessages = msgData;
    }

    console.log(`FOUND ${evoMessages.length} MESSAGES via standard parsing.`);

    if (evoMessages.length === 0) {
        console.log("Trying alternative fetch with count=1...");
        const r2 = await fetch(`${evoUrl}/chat/findMessages/${instance}`, {
            method: 'POST',
            headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: targetPhone, limit: 10, count: 1 })
        });
        const d2 = await r2.json();
        console.log("R2 RAW:", JSON.stringify(d2).substring(0, 200));
    }

    // Try Insert
    if (evoMessages.length > 0) {
        const payloads = evoMessages.map(msg => {
            const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption;
            const fromMe = msg.key.fromMe || false;
            return {
                contact_id: contactId,
                phone: targetPhone,
                organization_id: orgId,
                role: fromMe ? 'assistant' : 'user',
                content: content || '[Mídia]',
                status: 'delivered',
                whatsapp_message_id: msg.key.id,
                created_at: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
                payload: msg
            };
        });

        console.log(`Attempting to insert ${payloads.length}...`);

        const res = await fetch(`${supabaseUrl}/rest/v1/messages?on_conflict=whatsapp_message_id`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payloads)
        });

        if (res.ok) console.log("INSERT SUCCESS");
        else console.log("INSERT FAIL:", res.status, await res.text());
    }
}

run();
