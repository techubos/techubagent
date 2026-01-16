const axios = require('axios');

const URL = "https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/webhook-processor-v2";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTYxMzIsImV4cCI6MjA4MzQ3MjEzMn0.QH-DG0QBo_WVBW9XskmCKg8eua5xykt3BWNZu2H2I_8";

async function ping() {
    console.log("Pinging Processor directly...");
    try {
        const res = await axios.post(URL, {
            record: {
                id: "manual_ping",
                organization_id: "00000000-0000-0000-0000-000000000000",
                payload: { event: "ping_test", data: {} }
            }
        }, { headers: { Authorization: `Bearer ${KEY}` } });
        console.log("Status:", res.status);
        console.log("Data:", res.data);
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Data:", e.response.data);
            console.error("Status:", e.response.status);
        }
    }
}

ping();
