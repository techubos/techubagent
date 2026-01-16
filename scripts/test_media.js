
const API_URL = "https://evolution.gamacreativedesign.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";
const INSTANCE = "teclab";
const MSG_ID = "3A8095917F1EF863D0D6"; // Gamma's image

async function testMedia() {
    console.log(`\n--- Testing Media Fetch for: ${MSG_ID} ---`);

    try {
        const res = await fetch(`${API_URL}/chat/getBase64FromMessage/${INSTANCE}`, {
            method: 'POST',
            headers: {
                "apikey": API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                key: {
                    id: MSG_ID,
                    fromMe: false,
                    remoteJid: "553199630882@s.whatsapp.net"
                }
            })
        });

        console.log("Status:", res.status);
        if (!res.ok) {
            console.log("Error Body:", await res.text());
        } else {
            const data = await res.json();
            console.log("Success! Data length:", data.base64?.length || "N/A");
            if (data.base64) console.log("Prefix:", data.base64.substring(0, 50));
        }

    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

testMedia();
