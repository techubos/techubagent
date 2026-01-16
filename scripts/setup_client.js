
import { execSync } from 'child_process';
import https from 'https';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log("\n🚀 TECHUB AUTOMATION - CLIENT SETUP WIZARD 🚀\n");

async function main() {
    try {
        // 1. Gather Info
        console.log("--- 1. CONFIGURATION ---");
        const instanceName = await ask("Enter Client Instance Name (e.g., client1): ");
        const evolutionUrl = await ask("Enter Evolution API URL (e.g., https://api.evo.com): ");
        const evolutionKey = await ask("Enter Evolution Global API Key: ");
        const supabaseUrl = await ask("Enter Supabase URL (https://xyz.supabase.co): ");
        // const supabaseKey = await ask("Enter Supabase Service Key: "); // Required for backend, but we need to set secrets via CLI

        if (!instanceName || !evolutionUrl || !evolutionKey || !supabaseUrl) {
            console.error("❌ All fields are required!");
            process.exit(1);
        }

        // 2. Set Supabase Secrets
        console.log("\n--- 2. INJECTING SECRETS ---");
        try {
            const secretCmd = `npx supabase secrets set EVOLUTION_API_URL="${evolutionUrl}" EVOLUTION_API_KEY="${evolutionKey}" EVOLUTION_INSTANCE_NAME="${instanceName}" SUPABASE_URL="${supabaseUrl}"`;
            console.log("Running:", secretCmd);
            execSync(secretCmd, { stdio: 'inherit' });
            console.log("✅ Secrets Set Successfully!");
        } catch (e) {
            console.error("❌ Failed to set secrets. Ensure you are logged in (npx supabase login) and linked.");
            // process.exit(1); // Don't exit, maybe manual fix possible
        }

        // 3. Create Instance
        console.log("\n--- 3. CREATING INSTANCE ON EVOLUTION ---");
        const createUrl = `${evolutionUrl}/instance/create`;
        const createBody = JSON.stringify({
            instanceName: instanceName,
            token: "", // Optional
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
        });

        const createRes = await makeRequest(createUrl, 'POST', createBody, evolutionKey);
        console.log("Creation Response:", JSON.stringify(createRes, null, 2));

        // 4. Configure Webhook
        console.log("\n--- 4. CONFIGURING WEBHOOK ---");
        const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;
        const setWebhookUrl = `${evolutionUrl}/webhook/set/${instanceName}`;
        const webhookBody = JSON.stringify({
            webhookUrl: webhookUrl,
            webhookByEvents: true,
            events: [
                "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE",
                "CONTACTS_UPSERT", "CONTACTS_UPDATE", "CONNECTION_UPDATE"
            ],
            enabled: true
        });

        const hookRes = await makeRequest(setWebhookUrl, 'POST', webhookBody, evolutionKey);
        console.log("Webhook Response:", JSON.stringify(hookRes, null, 2));

        console.log("\n✅ SETUP COMPLETE! Scan the QR Code below/via frontend.");

    } catch (e) {
        console.error("\n💥 FATAL ERROR:", e.message);
    } finally {
        rl.close();
    }
}

function makeRequest(url, method, body, key) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': key
            }
        };

        const req = https.request(u, options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve({ text: data }); }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

main();
