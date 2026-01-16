const axios = require('axios');

const URL = "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/webhook-processor-v2";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTYxMzIsImV4cCI6MjA4MzQ3MjEzMn0.QH-DG0QBo_WVBW9XskmCKg8eua5xykt3BWNZu2H2I_8";

async function runDirectTest() {
    console.log("🚀 STARTING DIRECT PROCESSOR TEST");
    const timestamp = Date.now();
    const testPhone = "5511999997777"; // Different phone to avoid confusion
    const instanceName = "teclab";

    // 1. Prepare Payload (Mimic record from Trigger)
    // The Edge Function expects { record: { organization_id: "...", payload: { ... } } }
    // We need a valid Organization ID or let the fallback handle it?
    // The processor usually expects `organization_id` in the record.
    // In `evolution-webhook`, it looks up the ID.
    // In `webhook-processor`, it EXPECTS the ID to be passed from the queue.
    // So we MUST provide a valid `organization_id` for this direct test, 
    // OR allow the fallback if I added it to processor? 
    // No, I added fallback to `evolution-webhook`.
    // The `webhook-processor` takes `record.organization_id`.

    // I need the Org ID for "teclab".
    // I saw it in the logs: e5c17522-5779-49ba-93e1-c6445f341e1a
    const validOrgId = "e5c17522-5779-49ba-93e1-c6445f341e1a";

    console.log(`Using Org ID: ${validOrgId}`);

    // History Payload
    const historyPayload = {
        event: "MESSAGES_SET",
        instance: instanceName,
        data: {
            messages: [
                {
                    key: { remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: false, id: `DIRECT_${timestamp}_1` },
                    message: { conversation: "Direct History 1" },
                    messageTimestamp: Math.floor(Date.now() / 1000),
                    pushName: "Direct User"
                },
                {
                    key: { remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: true, id: `DIRECT_${timestamp}_2` },
                    message: { conversation: "Direct History 2" },
                    messageTimestamp: Math.floor(Date.now() / 1000),
                    pushName: "Me"
                }
            ]
        }
    };

    try {
        const res = await axios.post(URL, {
            record: {
                id: `manual_direct_${timestamp}`,
                organization_id: validOrgId,
                payload: historyPayload
            }
        }, { headers: { Authorization: `Bearer ${KEY}` } });
        console.log("✅ Success:", res.data);
    } catch (e) {
        console.error("❌ Failed:", e.message);
        if (e.response) console.error("Response:", e.response.data);
    }
}

runDirectTest();
