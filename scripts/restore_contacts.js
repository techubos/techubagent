
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://evolution.gamacreativedesign.com.br';
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'teclab';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase Credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('🚀 Starting Contact Restore (SCHEMA FIXED)...');

    const { data: conn } = await supabase
        .from('connections')
        .select('organization_id')
        .eq('instance_name', INSTANCE_NAME)
        .single();

    if (!conn) { console.error('❌ Connection not found'); return; }
    const orgId = conn.organization_id;

    console.log(`⬇️ Fetching contacts...`);
    try {
        const response = await axios.post(`${EVOLUTION_URL}/chat/findContacts/${INSTANCE_NAME}`, {}, {
            headers: { 'apikey': EVOLUTION_KEY }
        });

        let contactsRaw = [];
        if (Array.isArray(response.data)) contactsRaw = response.data;
        else if (response.data.contacts) contactsRaw = response.data.contacts;

        console.log(`📦 Raw items found: ${contactsRaw.length}`);

        let groupsSkipped = 0;
        let invalidSkipped = 0;

        const validContacts = contactsRaw.map(c => {
            let whatsappId = c.remoteJid || c.jid || c.id;

            if (!whatsappId) { invalidSkipped++; return null; }

            if (whatsappId.includes('@g.us') || c.isGroup === true || c.type === 'group') {
                groupsSkipped++;
                return null;
            }

            if (!whatsappId.includes('@') && /^\d+$/.test(whatsappId)) {
                whatsappId += '@s.whatsapp.net';
            }

            if (!whatsappId.includes('@s.whatsapp.net')) {
                invalidSkipped++;
                return null;
            }

            return {
                organization_id: orgId,
                phone: whatsappId.split('@')[0],
                name: c.pushName || c.name || c.verifiedName || c.notifyName || `Contato ${whatsappId.split('@')[0].slice(-4)}`,
                // SCHEMA FIXS:
                profile_pic_url: c.profilePicUrl || c.image || c.picture,
                evolution_id: whatsappId
                // Removed 'source' and 'imported_at' as they don't exist in DB
            };
        }).filter(c => c !== null);

        console.log(`\n📊 Summary:`);
        console.log(`   - Groups Skipped: ${groupsSkipped}`);
        console.log(`   - ✅ Valid Contacts to Import: ${validContacts.length}`);

        if (validContacts.length === 0) return;

        const BATCH_SIZE = 50;
        let successCount = 0;

        for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
            const batch = validContacts.slice(i, i + BATCH_SIZE);
            const { error: insertError } = await supabase
                .from('contacts')
                .upsert(batch, { onConflict: 'phone', ignoreDuplicates: false });

            if (insertError) console.error(`❌ Batch Error:`, insertError.message);
            else {
                successCount += batch.length;
                process.stdout.write(`\r⏳ Importing... ${successCount}/${validContacts.length}`);
            }
        }
        console.log('\n\n✨ SUCESSO! Contacts restored to Database.');

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

main();
