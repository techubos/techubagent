
const API_URL = "https://gamaos-evolution-api.y9eirm.easypanel.host";
const API_KEY = "322E9738-33AE-4783-86C9-7A6770264B20";
const INSTANCE = "teclab";
const MSG_ID = "3A29A2BF3A19D937FB9C"; // Recent image message ID

async function probe() {
    const endpoints = [
        "/chat/getBase64FromMessage/" + INSTANCE,
        "/chat/fetchMedia/" + INSTANCE,
        "/instance/fetchMedia/" + INSTANCE,
        "/message/media/" + INSTANCE,
        "/chat/findMessages/" + INSTANCE
    ];

    for (const ep of endpoints) {
        console.log(`\n--- Testing ${ep} ---`);
        try {
            const res = await fetch(API_URL + ep, {
                method: 'POST',
                headers: { "apikey": API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: { id: MSG_ID, fromMe: false, remoteJid: "553199630882@s.whatsapp.net" }
                })
            });
            console.log("Status:", res.status);
            if (res.ok) {
                const data = await res.json();
                console.log("Success! Keys:", Object.keys(data));
            } else {
                console.log("Err:", await res.text());
            }
        } catch (e) {
            console.log("Fetch error:", e.message);
        }
    }
}

probe();
