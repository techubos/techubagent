
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testResilience() {
    const orgId = 'qnlftndskmewudfuvakv'; // Valid test orgId
    const messageId = 'TEST_MSG_' + Date.now();

    console.log('🚀 Starting Resilience Tests...');

    // 1. STAGE: Insert a valid message
    console.log('Step 1: Inserting valid message...');
    const { data: q1, error: e1 } = await supabase.from('webhook_queue').insert({
        payload: {
            event: 'messages.upsert',
            instance: 'test_instance',
            data: {
                key: { id: messageId, remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
                message: { conversation: 'Hello Resilience' },
                messageTimestamp: Math.floor(Date.now() / 1000)
            }
        },
        organization_id: orgId,
        status: 'pending',
        next_retry_at: new Date().toISOString()
    }).select();

    if (e1) console.error('❌ Q1 Insert Failed:', e1.message);
    else console.log('✅ Q1 Inserted. ID:', q1[0].id);

    // 2. STAGE: Insert a duplicate
    console.log('Step 2: Inserting duplicate message...');
    const { error: e2 } = await supabase.from('webhook_queue').insert({
        payload: {
            event: 'messages.upsert',
            instance: 'test_instance',
            data: {
                key: { id: messageId, remoteJid: '5511999999999@s.whatsapp.net', fromMe: false }
            }
        },
        organization_id: orgId,
        status: 'pending'
    });

    if (e2 && e2.code === '23505') console.log('✅ Duplicate blocked by Database Index (Idempotency Working!)');
    else if (e2) console.error('❌ Duplicate Test Error:', e2.message);
    else console.error('❌ Duplicate was NOT blocked by unique index!');

    console.log('Test complete. Please check webhook-processor-v2 logs to confirm processing.');
}

testResilience();
