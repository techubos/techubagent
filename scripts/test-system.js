
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;

// Hardcoded Service Key for Local Reliability during Test
const SERVICE_KEY_INPUT = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb2Vmc3pocWxsZW5nbnZqYnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjEzMiwiZXhwIjoyMDgzNDcyMTMyfQ.z03uiVa5HSL9XcTBYSBzoLGDyomduf_uHtS98HF6nno";

if (!SUPABASE_URL) {
    console.error(chalk.red('Missing VITE_SUPABASE_URL in .env'));
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY_INPUT, {
    auth: { persistSession: false }
});

const TEST_PHONE = '5511999998888'; // Fake number
const TEST_MSG_ID = `TEST-${Date.now()}`;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/evolution-webhook`;

async function runTest() {
    console.clear();
    console.log(chalk.bold.blue('=========================================='));
    console.log(chalk.bold.blue('   TECHUB AGENT - SYSTEM AUTO-TEST v1.1   '));
    console.log(chalk.bold.blue('=========================================='));

    // Config Check
    console.log(chalk.gray(`Target: ${WEBHOOK_URL}`));

    let allPassed = true;

    // HELPER: ASSERT
    const assert = (condition, msg) => {
        if (condition) {
            console.log(`${chalk.green('✔ PASS')} ${msg}`);
        } else {
            console.log(`${chalk.red('✘ FAIL')} ${msg}`);
            allPassed = false;
        }
    };

    try {
        // STEP 1: Simulate Webhook (Evolution API -> Edge Function)
        console.log(chalk.yellow('\n1. Simulating Incoming Webhook...'));

        const payload = {
            event: 'messages.upsert',
            instance: 'gama', // Using REAL instance name to trigger Org lookup
            data: {
                key: {
                    remoteJid: `${TEST_PHONE}@s.whatsapp.net`,
                    fromMe: false,
                    id: TEST_MSG_ID
                },
                pushName: 'Test Automátizado',
                messageTimestamp: Math.floor(Date.now() / 1000),
                message: {
                    conversation: 'AUTO_TEST_MESSAGE_SYSTEM_CHECK'
                }
            },
            organization_id: '00000000-0000-0000-0000-000000000000'
        };

        const res = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        assert(res.status === 200, `Webhook Endpoint returned 200 OK (Status: ${res.status})`);

        // STEP 2: Wait for Processing (Queue)
        console.log(chalk.yellow('\n2. Waiting for Async Processing (5s)...'));
        await new Promise(r => setTimeout(r, 5000));

        // STEP 3: Check Queue Status
        console.log(chalk.yellow('\n3. Verifying Queue...'));
        const { data: queueItems } = await supabase
            .from('webhook_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10); // Check recent

        // Check using simple text match logic
        const myQueueItem = queueItems?.find(i => JSON.stringify(i.payload).includes(TEST_MSG_ID));

        if (myQueueItem) {
            assert(true, `Found Payload in Queue (ID: ${myQueueItem.id})`);

            // Allow 'completed' OR 'error' if unique constraint (it implies processor ran)
            // But we prefer completed
            if (myQueueItem.status === 'completed') {
                assert(true, `Queue Status is 'completed'`);
            } else {
                console.log(chalk.gray(`   Status: ${myQueueItem.status} | Error: ${myQueueItem.error_log}`));
                if (myQueueItem.status === 'processing') assert(false, 'Still Stuck in Processing');
                else if (myQueueItem.status === 'error') assert(false, 'Processor reported Error');
            }

        } else {
            assert(false, 'Payload NOT found in recent processing queue.');
            console.log(chalk.gray('Recent IDs:', queueItems?.map(i => i.id).join(', ')));
        }

        // STEP 4: Check Database (Messages & Contact)
        console.log(chalk.yellow('\n4. Verifying Persistence...'));

        const { data: msg, error: dbErr } = await supabase
            .from('messages')
            .select('*') // Removed join for isolation
            .eq('whatsapp_message_id', TEST_MSG_ID)
            .maybeSingle();

        if (dbErr) console.log(chalk.red('   DB Error:', dbErr.message));

        if (msg) {
            assert(true, 'Message found in "messages" table.');
            assert(msg.content === 'AUTO_TEST_MESSAGE_SYSTEM_CHECK', 'Message content matches.');

            if (msg.contact_id) {
                assert(true, 'Message linked to a Contact ID.');
            } else {
                assert(false, 'Contact ID missing');
            }

        } else {
            assert(false, `Message with ID ${TEST_MSG_ID} not found in DB.`);
        }

        // STEP 5: Check System Health
        console.log(chalk.yellow('\n5. Verifying System Health...'));
        const { data: health } = await supabase
            .from('system_health')
            .select('*')
            .eq('component', 'processor')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (health) {
            assert(health.status === 'healthy', `Processor Health is 'healthy'`);
        } else {
            console.warn(chalk.gray('   No health record found yet.'));
        }

        // CLEANUP (Optional)
        if (msg) {
            console.log(chalk.gray('\nCleaning up test data...'));
            await supabase.from('messages').delete().eq('id', msg.id);
        }

    } catch (err) {
        console.error(chalk.red('\nFATAL ERROR EXECUTION:'), err.message);
        if (err.response) console.error(chalk.gray('Response Data:', JSON.stringify(err.response.data)));
        allPassed = false;
    }

    console.log('\n');
    if (allPassed) {
        console.log(chalk.bold.green('✅ SYSTEM TEST PASSED SUCCESSFULLY'));
        process.exit(0);
    } else {
        console.log(chalk.bold.red('❌ SYSTEM TEST FAILED'));
        process.exit(1);
    }
}

runTest();
