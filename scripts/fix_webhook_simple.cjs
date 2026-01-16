const axios = require('axios');

const EVO_URL = "https://evolution.gamacreativedesign.com.br";
const EVO_KEY = "429683C4C977415CAAFCCE10F7D57E11";
const TARGET_WEBHOOK_URL = "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/evolution-webhook";
const INSTANCE = "org_e5c17522";

async function fixWebhookCorrect() {
    const setUrl = `${EVO_URL}/webhook/set/${INSTANCE}`;
    console.log(`🔧 Trying Correct Config for ${INSTANCE}...`);

    const payload = {
        "webhook": {
            "enabled": true,
            "url": TARGET_WEBHOOK_URL,
            "events": [
                "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE",
                "SEND_MESSAGE", "CONTACTS_UPSERT", "CONTACTS_UPDATE",
                "CONNECTION_UPDATE", "MESSAGES_SET"
            ]
        }
    };

    try {
        const res = await axios.post(setUrl, payload, {
            headers: { 'apikey': EVO_KEY }
        });
        console.log("✅ SUCCESS!");
        console.log("Data:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("❌ Failed.");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error:", e.message);
        }
    }
}

fixWebhookCorrect();
