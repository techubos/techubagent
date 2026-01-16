
const API_URL = "https://evolution.gamacreativedesign.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";
const INSTANCE = "teclab";
const WEBHOOK_URL = "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/evolution-webhook";

async function setWebhook() {
    console.log(`\n--- Configuring Webhook for: ${INSTANCE} ---`);
    console.log(`Target URL: ${WEBHOOK_URL}`);

    try {
        const res = await fetch(`${API_URL}/webhook/set/${INSTANCE}`, {
            method: 'POST',
            headers: {
                "apikey": API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                webhook: {
                    enabled: true,
                    url: WEBHOOK_URL,
                    events: [
                        "MESSAGES_UPSERT",
                        "MESSAGES_UPDATE",
                        "SEND_MESSAGE",
                        "CONTACTS_UPSERT"
                    ],
                    byEvents: false,
                    base64: true
                }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API Error: ${res.status} - ${errText}`);
        }

        const data = await res.json();
        console.log("Success:", JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Failed to set webhook:", e.message);
    }
}

setWebhook();
