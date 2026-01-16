const axios = require('axios');

const EVO_URL = "https://evolution.gamacreativedesign.com.br";
const EVO_KEY = "429683C4C977415CAAFCCE10F7D57E11";
const TARGET_WEBHOOK_URL = "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/evolution-webhook";
const INSTANCE = "org_e5c17522";

async function diagnose() {
    console.log(`🔎 Checking Webhook for ${INSTANCE}...`);
    try {
        const url = `${EVO_URL}/webhook/find/${INSTANCE}`;
        const res = await axios.get(url, {
            headers: { 'apikey': EVO_KEY }
        });

        console.log("Current Config:", JSON.stringify(res.data, null, 2));

        const currentUrl = res.data?.webhook?.url || res.data?.url || null;
        const isEnabled = res.data?.webhook?.enabled || res.data?.enabled || false;

        if (!res.data || currentUrl !== TARGET_WEBHOOK_URL || !isEnabled) {
            console.log("⚠️ Webhook Config Mismatch or Disabled!");
            console.log(`Expected: ${TARGET_WEBHOOK_URL}`);
            console.log("🔧 Attempting to FIX...");

            const setUrl = `${EVO_URL}/webhook/set/${INSTANCE}`;
            const payload = {
                "webhook": {
                    "url": TARGET_WEBHOOK_URL,
                    "byEvents": false, // False means ALL events? Or should I enable specific?
                    // Usually better to specify events if "byEvents" is true.
                    // If false, it sends everything? 
                    // Let's check docs or assume 'true' and list them.
                    "enabled": true,
                    "events": [
                        "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE",
                        "SEND_MESSAGE", "CONTACTS_UPSERT", "CONTACTS_UPDATE",
                        "CONNECTION_UPDATE", "GROUPS_UPSERT"
                    ]
                }
            };

            // Try simple payload first if v2
            const payloadV2 = {
                "url": TARGET_WEBHOOK_URL,
                "enabled": true,
                "events": [
                    "MESSAGES_UPSERT", "MESSAGES_UPDATE",
                    "CONTACTS_UPSERT", "CONTACTS_UPDATE",
                    "CONNECTION_UPDATE", "messages.upsert", "messaging-history.set"
                ]
            };

            // Evolution API payload structure is tricky.
            // I will try the standard one.
            await axios.post(setUrl, {
                "enabled": true,
                "url": TARGET_WEBHOOK_URL,
                "webhookByEvents": true,
                "events": [
                    "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE",
                    "SEND_MESSAGE", "CONTACTS_UPSERT", "CONTACTS_UPDATE",
                    "PROSP_UPSERT", // Maybe custom?
                    "CONNECTION_UPDATE",
                    "QRCODE_UPDATED",
                    "MESSAGES_SET" // History
                ]
            }, { headers: { 'apikey': EVO_KEY } });

            console.log("✅ Webhook Updated. Verifying...");
            const res2 = await axios.get(url, { headers: { 'apikey': EVO_KEY } });
            console.log("New Config:", JSON.stringify(res2.data, null, 2));

        } else {
            console.log("✅ Webhook Config looks CORRECT.");
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
        if (e.response) console.error("Response:", e.response.data);
    }
}

diagnose();
