const axios = require('axios');

const EVO_URL = "https://evolution.gamacreativedesign.com.br";
const EVO_KEY = "429683C4C977415CAAFCCE10F7D57E11";
const TARGET_WEBHOOK_URL = "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/evolution-webhook";
const INSTANCE = "org_e5c17522";

async function forceSetWebhook() {
    const setUrl = `${EVO_URL}/webhook/set/${INSTANCE}`;
    const events = [
        "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE",
        "SEND_MESSAGE", "CONTACTS_UPSERT", "CONTACTS_UPDATE",
        "CONNECTION_UPDATE", "MESSAGES_SET"
    ];

    const attempts = [
        {
            name: "V2 Flat Structure",
            payload: {
                "enabled": true,
                "url": TARGET_WEBHOOK_URL,
                "webhookByEvents": true,
                "events": events
            }
        },
        {
            name: "V1 Nested Structure",
            payload: {
                "webhook": {
                    "enabled": true,
                    "url": TARGET_WEBHOOK_URL,
                    "events": events
                }
            }
        },
        {
            name: "Legacy Structure",
            payload: {
                "enabled": true,
                "url": TARGET_WEBHOOK_URL
            }
        }
    ];

    for (const attempt of attempts) {
        console.log(`\n🔧 Trying: ${attempt.name}`);
        try {
            const res = await axios.post(setUrl, attempt.payload, {
                headers: { 'apikey': EVO_KEY }
            });
            console.log("✅ SUCCESS!");
            console.log("Data:", res.data);
            return; // Exit on success
        } catch (e) {
            console.error("❌ Failed.");
            if (e.response && e.response.data) {
                console.error("Error Data:", JSON.stringify(e.response.data, null, 2));
            } else {
                console.log("Error:", e.message);
            }
        }
    }
}

forceSetWebhook();
