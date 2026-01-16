import axios from 'axios';

const SUPABASE_URL = "https://eqoefszhqllengnvjbrm.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTYxMzIsImV4cCI6MjA4MzQ3MjEzMn0.QH-DG0QBo_WVBW9XskmCKg8eua5xykt3BWNZu2H2I_8";

const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/evolution-webhook`;

async function main() {
    console.log("🧪 Testing Webhook Fix...");

    // Simulate Evolution Payload
    const payload = {
        event: "messages.upsert",
        instance: "teclab", // Known valid instance
        data: {
            key: {
                remoteJid: "5511999999999@s.whatsapp.net",
                fromMe: false,
                id: "TEST_MSG_" + Date.now()
            },
            pushName: "Tester",
            message: {
                conversation: "Test message to verify organization_id resolution"
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
        }
    };

    try {
        console.log(`📡 Sending to: ${WEBHOOK_URL}`);
        const res = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                'Authorization': `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Response Status: ${res.status}`);
        console.log(`✅ Response Data:`, res.data);

        if (res.status === 200) {
            console.log("SUCCESS: Webhook accepted payload. Use DB check to confirm organization_id.");
        }
    } catch (e) {
        console.error("❌ Request Failed:");
        if (e.response) {
            console.error(`Status: ${e.response.status}`);
            console.error(`Data:`, e.response.data);
        } else {
            console.error(e.message);
        }
    }
}

main();
