
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// HARDCODED CONFIG FOR DEBUGGING
const EVOLUTION_URL = 'https://evolution.gamacreativedesign.com.br';
const EVOLUTION_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'teclab'; // Replace with user's instance if known, or 'teclab'

async function debugSync() {
    console.log("🚀 Starting Debug Sync...");

    // 2. Fetch Contacts from Evolution (TRY POST)
    const url = `${EVOLUTION_URL}/chat/findContacts/${INSTANCE_NAME}`;
    console.log(`Fetching: ${url}`);

    try {
        const res = await fetch(url, {
            method: 'POST', // Try POST
            headers: {
                'apikey': EVOLUTION_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // Empty body often required for POST
        });

        console.log(`Status: ${res.status}`);
        if (!res.ok) {
            console.error("Error Text:", await res.text());
            return;
        }

        const data = await res.json();
        // console.log("Data Payload:", JSON.stringify(data).slice(0, 200) + "...");

        let contacts = [];
        if (Array.isArray(data)) contacts = data;
        else if (data.contacts) contacts = data.contacts;
        else if (data.data?.contacts) contacts = data.data.contacts;

        console.log(`✅ Found ${contacts.length} contacts.`);

        if (contacts.length > 0) {
            const first = contacts[0];
            console.log("🔥 KEYS:", Object.keys(first));
            // Log only 200 chars to avoid truncation
            console.log("🔥 SAMPLE JSON START:", JSON.stringify(first).substring(0, 300));
        }
        console.log(`✅ Valid WhatsApp Filtered: ${validContacts.length}`);

        if (validContacts.length > 0) {
            console.log("Sample Contact:", validContacts[0]);
        }

    } catch (e) {
        console.error("Fetch Exception:", e);
    }
}

debugSync();
