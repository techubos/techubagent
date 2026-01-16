const axios = require('axios');

const SUPABASE_URL = "https://eqoefszhqllengnvjbrm.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTYxMzIsImV4cCI6MjA4MzQ3MjEzMn0.QH-DG0QBo_WVBW9XskmCKg8eua5xykt3BWNZu2H2I_8";
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/evolution-webhook`;

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
    console.log("🚀 STARTING END-TO-END SIMULATION");
    const timestamp = Date.now();
    const testPhone = "5511999998888";

    // STEP 0: Create Connection in DB (Simulate persistence)
    // We can't actually CREATE a connection from outside easily without Admin Key via SQL tool.
    // BUT we can rely on the fallback or use an EXISTING organization.
    // The previous test showed that 'teclab' worked for fallback. We will use 'teclab' as instance name 
    // to ensure it maps to the correct org.
    const instanceName = "teclab";

    console.log(`Using instance: ${instanceName}`);
    console.log(`Test Phone: ${testPhone}`);
    console.log(`Batch ID: HIST_${timestamp}`);

    // STEP 1: Connection Update
    console.log("\n📡 Step 1: Sending 'connection.update'...");
    try {
        await axios.post(WEBHOOK_URL, {
            event: "connection.update",
            instance: instanceName,
            data: { state: "open", statusReason: 200 }
        }, { headers: { Authorization: `Bearer ${ANON_KEY}` } });
        console.log("✅ Connection Update Sent.");
    } catch (e) { console.error("❌ Connection Update Failed", e.message); }

    await delay(2000);

    // STEP 2: Contacts Upsert
    console.log("\n📡 Step 2: Sending 'contacts.upsert'...");
    const contactPayload = {
        event: "contacts.upsert",
        instance: instanceName,
        data: [
            { id: `${testPhone}@s.whatsapp.net`, pushName: "Simulated User", profilePictureUrl: "http://example.com/pic.jpg" }
        ]
    };
    try {
        await axios.post(WEBHOOK_URL, contactPayload, { headers: { Authorization: `Bearer ${ANON_KEY}` } });
        console.log("✅ Contact Upsert Sent.");
    } catch (e) { console.error("❌ Contacts Failed", e.message); }

    await delay(2000);

    // STEP 3: History Sync (MESSAGES_SET)
    console.log("\n📡 Step 3: Sending 'MESSAGES_SET' (History)...");
    const historyPayload = {
        event: "MESSAGES_SET", // Testing Case Sensitivity too? The whitelist has both.
        instance: instanceName,
        data: {
            messages: [
                {
                    key: { remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: false, id: `HIST_${timestamp}_1` },
                    message: { conversation: "History Message 1 - Hello" },
                    messageTimestamp: Math.floor(Date.now() / 1000) - 1000,
                    pushName: "Simulated User"
                },
                {
                    key: { remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: true, id: `HIST_${timestamp}_2` },
                    message: { conversation: "History Message 2 - Hi there" },
                    messageTimestamp: Math.floor(Date.now() / 1000) - 900,
                    pushName: "Me"
                },
                {
                    key: { remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: false, id: `HIST_${timestamp}_3` },
                    message: { conversation: "History Message 3 - How are you?" },
                    messageTimestamp: Math.floor(Date.now() / 1000) - 800,
                    pushName: "Simulated User"
                }
            ]
        }
    };

    try {
        await axios.post(WEBHOOK_URL, historyPayload, { headers: { Authorization: `Bearer ${ANON_KEY}` } });
        console.log("✅ History Payload Sent.");
    } catch (e) { console.error("❌ History Failed", e.message); }

    console.log("\n⏳ Waiting 5 seconds for Async Processing...");
    await delay(5000);

    console.log("\n🔍 DATABASE CHECK INSTRUCTIONS:");
    console.log(`-- Check if contacts exist`);
    console.log(`SELECT * FROM contacts WHERE phone = '${testPhone}';`);
    console.log(`-- Check if history messages exist`);
    console.log(`SELECT * FROM messages WHERE phone = '${testPhone}' AND whatsapp_message_id LIKE 'HIST_%';`);
}

runTest();
