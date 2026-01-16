
const API_URL = "https://evolution.gamacreativedesign.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";
const INSTANCES = ["teclab", "teclab00"];

async function checkInstance(name) {
    console.log(`\n--- Checking Instance: ${name} ---`);

    // 1. Connection Status
    try {
        const res = await fetch(`${API_URL}/instance/connectionState/${name}`, {
            headers: { "apikey": API_KEY }
        });
        if (res.status === 404) {
            console.log("Status: NOT FOUND (404)");
            return;
        }
        const data = await res.json();
        console.log("Connection State:", JSON.stringify(data, null, 2));
    } catch (e: any) {
        console.error("Error:", e.message);
    }

    // 2. Webhook Config
    try {
        const res = await fetch(`${API_URL}/webhook/find/${name}`, {
            headers: { "apikey": API_KEY }
        });
        const data = await res.json();
        console.log("Webhook Config:", JSON.stringify(data, null, 2));
    } catch (e: any) {
        console.error("Failed to check webhook:", e.message);
    }
}

async function main() {
    for (const name of INSTANCES) {
        await checkInstance(name);
    }
}

main();
