
const WEBHOOK_URL = "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/evolution-webhook";

async function trigger() {
    console.log("Triggering Webhook manually...");

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                instance: "teclab",
                data: {
                    key: {
                        remoteJid: "5511999999999@s.whatsapp.net",
                        fromMe: false,
                        id: "MANUAL_TEST_" + Date.now()
                    },
                    message: {
                        conversation: "Teste manual via Script"
                    },
                    pushName: "Tester"
                }
            })
        });

        const text = await res.text();
        console.log(`Response: ${res.status} - ${text}`);
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

trigger();
