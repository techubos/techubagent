
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import ProgressBar from 'progress';
import dotenv from 'dotenv';
import promptSync from 'prompt-sync';
import fs from 'fs';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prompt = promptSync();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
// Better to use service role if available, but let's try with what we have or ask user
const EVOLUTION_URL = process.env.VITE_EVOLUTION_API_URL;
const EVOLUTION_API_KEY = "429683C4C977415CAAFCCE10F7D57E11"; // Hardcoded for crisis

if (!SUPABASE_URL || !SUPABASE_KEY || !EVOLUTION_URL) {
    console.error(chalk.red('Missing .env variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_EVOLUTION_API_URL)'));
    process.exit(1);
}

// Service Role Key Override (Optional)
const SERVICE_KEY_INPUT = prompt(chalk.yellow('Enter Supabase Service Role Key (Press Enter to use Anon Key from .env): '));
const FINAL_KEY = SERVICE_KEY_INPUT.trim() || SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, FINAL_KEY, {
    auth: { persistSession: false }
});

async function main() {
    console.clear();
    console.log(chalk.bold.blue('=========================================='));
    console.log(chalk.bold.blue('   TECHUB AGENT - MANUAL SYNC TOOL v1.0   '));
    console.log(chalk.bold.blue('=========================================='));

    // 1. Inputs
    const exampleOrg = '00000000-0000-0000-0000-000000000000';
    console.log(chalk.gray(`Default Organization ID? (Leave empty to fetch from DB connection)`));

    // Auto-detect org if possible
    let orgId = '';
    const { data: connections } = await supabase.from('connections').select('organization_id, instance_name').limit(1);
    if (connections && connections.length > 0) {
        console.log(chalk.green(`Found active connection for Org: ${connections[0].organization_id} (${connections[0].instance_name})`));
        const useIt = prompt(`Use this organization? (Y/n): `);
        if (useIt.toLowerCase() !== 'n') {
            orgId = connections[0].organization_id;
        }
    }

    if (!orgId) {
        orgId = prompt('Enter Organization ID: ');
    }

    if (!orgId) {
        console.error(chalk.red('Organization ID is required.'));
        process.exit(1);
    }

    const targetPhone = prompt('Target Phone (Leave empty for ALL contacts): ').replace(/\D/g, '');

    // 2. Fetch Contacts
    let contacts = [];
    console.log(chalk.cyan('\nFetching contacts from Supabase...'));

    let query = supabase.from('contacts').select('*').eq('organization_id', orgId);
    if (targetPhone) {
        query = query.eq('phone', targetPhone);
    }

    const { data: dbContacts, error } = await query;
    if (error) {
        console.error(chalk.red(`Supabase Error: ${error.message}`));
        process.exit(1);
    }

    if (!dbContacts || dbContacts.length === 0) {
        console.warn(chalk.yellow('No contacts found.'));
        process.exit(0);
    }

    contacts = dbContacts;
    console.log(chalk.green(`Found ${contacts.length} contacts to process.`));

    // 3. Setup Progress
    const bar = new ProgressBar('Syncing [:bar] :current/:total :percent :etas | :phone', {
        complete: '=',
        incomplete: ' ',
        width: 40,
        total: contacts.length
    });

    // 4. Processing Loop
    const stats = {
        totalMessages: 0,
        newMessages: 0,
        failedContacts: 0,
        startTime: Date.now()
    };

    const { data: conn } = await supabase.from('connections').select('instance_name').eq('organization_id', orgId).single();
    const instance = conn?.instance_name || 'gama'; // Fallback

    for (const contact of contacts) {
        const phone = contact.phone;
        bar.tick({ phone });

        try {
            // Find Messages from Evolution
            const response = await axios.post(`${EVOLUTION_URL}/chat/findMessages/${instance}`, {
                number: phone,
                limit: 50,
                count: 50
            }, {
                headers: { 'apikey': EVOLUTION_API_KEY }
            });

            // Parse Data
            let rawData = [];
            if (Array.isArray(response.data)) rawData = response.data;
            else if (response.data?.messages?.records) rawData = response.data.messages.records;
            else if (Array.isArray(response.data?.data)) rawData = response.data.data;

            if (rawData.length > 0) {
                // Map
                const payloads = rawData.map(msg => {
                    const key = msg.key || {};
                    const contentObj = msg.message || {};
                    let text = '';
                    let type = 'text';

                    if (contentObj.conversation) text = contentObj.conversation;
                    else if (contentObj.extendedTextMessage?.text) text = contentObj.extendedTextMessage.text;
                    else if (contentObj.imageMessage) { type = 'image'; text = contentObj.imageMessage.caption || ''; }
                    else if (contentObj.audioMessage) { type = 'audio'; }

                    if (!text && type === 'text') return null;

                    return {
                        contact_id: contact.id,
                        organization_id: orgId,
                        phone: phone,
                        role: key.fromMe ? 'assistant' : 'user',
                        content: text || (type === 'audio' ? '[Audio]' : '[Media]'),
                        message_type: type,
                        whatsapp_message_id: key.id,
                        status: 'delivered',
                        created_at: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
                        from_me: key.fromMe,
                        payload: msg
                    };
                }).filter(x => x !== null);

                // Upsert
                if (payloads.length > 0) {
                    const { error: upsertErr, count } = await supabase.from('messages').upsert(payloads, {
                        onConflict: 'whatsapp_message_id',
                        count: 'exact'
                    });

                    if (upsertErr) {
                        // console.error(`Upsert fail for ${phone}: ${upsertErr.message}`);
                    } else {
                        stats.totalMessages += payloads.length;
                        // 'count' is tricky with upsert (it counts updates too). 
                        // Real logic for "new" usually requires checking before insert, but for speed we just count processed.
                        stats.newMessages += (count || 0); // Approximation
                    }
                }
            }
        } catch (err) {
            stats.failedContacts++;
            // console.error(`Error processing ${phone}: ${err.message}`);
        }
    }

    // 5. Final Report
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

    console.log('\n');
    console.log(chalk.bold.green('================ SYNC COMPLETE ================'));
    console.log(`⏱️  Duration:      ${chalk.bold(duration)}s`);
    console.log(`📂 Contacts:      ${contacts.length}`);
    console.log(`📨 Msgs Processed: ${chalk.cyan(stats.totalMessages)}`);
    console.log(`❌ Failed Contacts:${chalk.red(stats.failedContacts)}`);
    console.log('================================================');

    process.exit(0);
}

main().catch(err => {
    console.error(chalk.red('Fatal Error:', err));
    process.exit(1);
});
