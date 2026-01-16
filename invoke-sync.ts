
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Node.js compatible env vars
const SUPABASE_URL = 'https://eqoefszhqllengnvjbrm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTYxMzIsImV4cCI6MjA4MzQ3MjEzMn0.QH-DG0QBo_WVBW9XskmCKg8eua5xykt3BWNZu2H2I_8';

async function invokeSync() {
    console.log("🚀 Invoking Sync Function...");

    // We can just use fetch directly to the function URL if we know it
    // Or use the provided URL in the deployment output: https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/sync-contacts-on-connect
    const functionUrl = 'https://eqoefszhqllengnvjbrm.supabase.co/functions/v1/sync-contacts-on-connect';

    console.log(`Endpoint: ${functionUrl}`);

    try {
        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // Will try to run this with npx tsx and local .env if possible, or just anonymous
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instance_id: "teclab",
                organization_id: "e5c17522-5779-49ba-93e1-c6445f341e1a"
            })
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log("Response:", text);

    } catch (e) {
        console.error("Invoke Exception:", e);
    }
}

invokeSync();
