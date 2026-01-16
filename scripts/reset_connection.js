import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const EVO_URL = process.env.VITE_EVOLUTION_API_URL;
const EVO_KEY = process.env.VITE_EVOLUTION_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !EVO_URL || !EVO_KEY) {
    console.error("❌ Missing env vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔄 Resetting WhatsApp Connection...");

    // 1. Get Instance
    const { data: connections } = await supabase.from('connections').select('*');

    if (!connections || connections.length === 0) {
        console.log("⚠️ No active connections found in DB. Nothing to reset.");
        return;
    }

    for (const conn of connections) {
        const instance = conn.instance_name;
        console.log(`🔌 Disconnecting ${instance}...`);

        try {
            // Logout
            await axios.delete(`${EVO_URL}/instance/logout/${instance}`, {
                headers: { 'apikey': EVO_KEY }
            });
            console.log("   ✅ Logout sent to API");
        } catch (e) {
            console.log(`   ⚠️ Logout failed/ignored: ${e.message}`);
        }

        try {
            // Delete
            await axios.delete(`${EVO_URL}/instance/delete/${instance}`, {
                headers: { 'apikey': EVO_KEY }
            });
            console.log("   ✅ Instance DELETED from Evolution");
        } catch (e) {
            console.log(`   ⚠️ Delete failed: ${e.message}`);
        }

        // Clean DB
        const { error } = await supabase.from('connections').delete().eq('id', conn.id);
        if (error) console.error("   ❌ DB Delete Error:", error.message);
        else console.log("   ✅ Removed from Supabase DB");
    }

    console.log("\n✅ Reset Complete. User must now Re-Scan QR code.");
}

main();
