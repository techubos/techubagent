
const API_URL = "https://evolution.gamacreativedesign.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";
const INSTANCE = "teclab";

async function checkWebhook() {
    console.log(`\n--- Checking Webhook for: ${INSTANCE} ---`);

    try {
        const res = await fetch(`${API_URL}/webhook/find/${INSTANCE}`, {
            method: 'GET',
            headers: {
                "apikey": API_KEY
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API Error: ${res.status} - ${errText}`);
        }

        const data = await res.json();
        console.log("Current Settings:", JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Failed to check webhook:", e.message);
    }
}

checkWebhook();
