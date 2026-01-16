// WEBHOOK PROCESSOR V3.3 (Resilient & Professional)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { processAIRequest } from "../_shared/ai-engine/orchestrator.ts";
import { shouldAiRespond } from "../_shared/ai-decision-engine.ts";
import { sanitizePhone, sanitizeMessage } from "../_shared/sanitize.ts";
import { MessageSchema, ContactSchema } from "../_shared/validation-schemas.ts";

const MAX_ATTEMPTS = 5;

Deno.serve(async (req: Request) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payloadBody = await req.json();
    const record = payloadBody.record;

    if (!record || !record.id) {
        return new Response('Invalid Payload', { status: 400 });
    }

    const queueId = record.id;
    const body = record.payload;
    const orgId = record.organization_id;
    const attempts = record.attempts || 0;

    try {
        // 1. Validate Organization & Context
        if (!orgId) {
            // Try last-minute lookup
            const instance = body.instance || body.instanceName || body.instance_name;
            const { data: conn } = await supabase.from('connections').select('organization_id').eq('instance_name', instance).maybeSingle();
            if (!conn?.organization_id) throw new Error(`Organization NOT found for instance: ${instance}`);
            // Update queue record for future reference
            await supabase.from('webhook_queue').update({ organization_id: conn.organization_id }).eq('id', queueId);
        }

        const currentOrgId = orgId || (await supabase.from('connections').select('organization_id').eq('instance_name', body.instance || body.instanceName).maybeSingle()).data?.organization_id;

        // 2. Delegate to Processing Logic
        await processDatabaseEvent(supabase, body, currentOrgId);

        // 3. Mark as Completed
        await supabase.from('webhook_queue').update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            error_log: null
        }).eq('id', queueId);

        // 4. Background: Process any ready AI buffers (Self-healing pulse)
        await processBuffers(supabase).catch(e => console.error("[Buffer Pulse Fail]:", e.message));

        return new Response('OK', { status: 200 });

    } catch (err: any) {
        console.error(`[Processor Failure] Queue ID ${queueId}:`, err.message);

        const nextAttempts = attempts + 1;

        if (nextAttempts >= MAX_ATTEMPTS) {
            // MOVE TO DEAD LETTER QUEUE
            await supabase.from('dead_letter_queue').insert({
                original_queue_id: queueId,
                payload: body,
                organization_id: orgId,
                last_error: err.message,
                error_history: [...(record.error_history || []), { error: err.message, time: new Date().toISOString() }]
            });

            await supabase.from('webhook_queue').update({
                status: 'dead',
                error_log: `Moved to DLQ: ${err.message}`
            }).eq('id', queueId);
        } else {
            // EXPONENTIAL BACKOFF: 2^attempts minutes (1, 2, 4, 8, 16...)
            const delayMinutes = Math.pow(2, attempts);
            const nextRetry = new Date();
            nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);

            await supabase.from('webhook_queue').update({
                status: 'pending',
                attempts: nextAttempts,
                next_retry_at: nextRetry.toISOString(),
                error_log: err.message
            }).eq('id', queueId);
        }

        return new Response('RETRY_SCHEDULED', { status: 200 });
    }
});

async function processDatabaseEvent(supabase: any, body: any, orgId: string) {
    const data = body.data;
    const event = body.event;

    // Handle Connection Updates
    if (event === 'connection.update') {
        const state = data?.state || 'close';
        await supabase.from('connections').update({ status: state, updated_at: new Date().toISOString() }).eq('instance_name', body.instance);
        return;
    }

    // Handle Contact Syncs
    if (['contacts.upsert', 'contacts.update', 'CONTACTS_UPSERT', 'CONTACTS_UPDATE'].includes(event)) {
        const contacts = Array.isArray(data) ? data : [data];
        for (const c of contacts) {
            const phone = c.id.split('@')[0];
            await supabase.from('contacts').upsert({
                organization_id: orgId,
                phone: sanitizePhone(phone),
                name: c.pushName || c.name || phone,
                profile_pic_url: c.profilePictureUrl || '',
                status: 'lead'
            }, { onConflict: 'organization_id, phone' });
        }
        return;
    }

    // Handle Messages (Single or History)
    if (['messages.upsert', 'messages.set', 'MESSAGES_UPSERT', 'MESSAGES_SET'].includes(event)) {
        const messages = Array.isArray(data) ? data : (data.messages || [data]);

        console.log(`[Batch Processor] Processing ${messages.length} messages for Org ${orgId}`);

        // Process message chunk in parallel (Limit concurrency if needed, but for small history sets Promise.all is fine)
        const processResults = await Promise.allSettled(messages.map(async (msgData: any) => {
            if (!msgData.key) return;

            const phone = sanitizePhone(msgData.key.remoteJid.split('@')[0]);
            const whatsappId = msgData.key.id;
            const isFromMe = !!msgData.key.fromMe;

            // 1. Ensure Contact exists (Atomic)
            const { data: contact, error: cErr } = await supabase.from('contacts').upsert({
                organization_id: orgId,
                phone: phone,
                name: msgData.pushName || phone,
                status: 'lead'
            }, { onConflict: 'organization_id, phone' }).select('id').single();

            if (cErr) throw cErr;

            // 2. Process Content & Handle Media Persistence
            let content = '';
            let messageType = 'text';
            let mediaUrl = null;
            const m = msgData.message || {};

            if (m.conversation) content = m.conversation;
            else if (m.extendedTextMessage?.text) content = m.extendedTextMessage.text;
            else if (m.imageMessage) { content = m.imageMessage.caption || '[Imagem]'; messageType = 'image'; }
            else if (m.audioMessage) { content = '[Áudio]'; messageType = 'audio'; }
            else if (m.videoMessage) { content = m.videoMessage.caption || '[Vídeo]'; messageType = 'video'; }

            if (!content && !m) return;

            // Media Hardening: Download and persist if it's media
            if (['image', 'audio', 'video'].includes(messageType)) {
                try {
                    mediaUrl = await handleMediaPersistence(supabase, msgData, orgId);
                } catch (mediaErr: any) {
                    console.error(`[Media Fail] ID ${whatsappId}:`, mediaErr.message);
                }
            }

            // 3. Insert Message (Deduplicated via unique index on whatsapp_message_id)
            const msgTimestamp = Number(msgData.messageTimestamp) || Math.floor(Date.now() / 1000);

            const { error: mErr } = await supabase.from('messages').upsert({
                contact_id: contact.id,
                organization_id: orgId,
                content: content,
                phone: phone,
                role: isFromMe ? 'assistant' : 'user',
                from_me: isFromMe, // FIX: Ensure UI correctly identifies message direction
                message_type: messageType,
                status: isFromMe ? 'sent' : 'delivered',
                whatsapp_message_id: whatsappId,
                media_url: mediaUrl,
                created_at: new Date(msgTimestamp * 1000).toISOString(),
                payload: msgData
            }, { onConflict: 'whatsapp_message_id' });

            if (mErr && mErr.code !== '23505') throw mErr;

            // 4. Update Conversation for Realtime UI
            await supabase.from('conversations').upsert({
                organization_id: orgId,
                contact_id: contact.id,
                status: 'open',
                last_message_at: new Date(msgTimestamp * 1000).toISOString(),
                summary: content.substring(0, 50)
            }, { onConflict: 'organization_id, contact_id' });

            // 5. Trigger AI / Workflows (Async with buffering)
            if (!isFromMe && event !== 'messages.set') {
                await triggerFollowups(supabase, contact.id, orgId, content);
            }
        }));

        // Log failures in batch
        const failures = processResults.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error(`[Batch Error] ${failures.length} messages failed in batch process.`);
            // Throw first error to trigger queue retry if critical
            const firstError = failures[0] as PromiseRejectedResult;
            throw new Error(firstError.reason);
        }
    }
}

async function handleMediaPersistence(supabase: any, msgData: any, orgId: string): Promise<string | null> {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!evolutionUrl || !evolutionKey) return null;

    const whatsappId = msgData.key.id;
    const m = msgData.message;
    let base64Data = msgData.base64; // Evolution sometimes sends base64 in the webhook

    // If no base64, try to fetch it from Evolution's proxy (requires instance to be active)
    if (!base64Data) {
        try {
            const fetchUrl = `${evolutionUrl}/chat/getBase64FromMedia/${instanceName}`;
            const response = await fetch(fetchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
                body: JSON.stringify({ message: { key: msgData.key, message: msgData.message } })
            });
            const result = await response.json();
            base64Data = result.base64;
        } catch (e: any) {
            console.warn(`[Media Proxy Fail] ${whatsappId}:`, e.message);
            return null;
        }
    }

    if (!base64Data) return null;

    // Convert Base64 to ArrayBuffer for Supabase Upload
    const headerSplit = base64Data.split(',');
    const pureBase64 = headerSplit.length > 1 ? headerSplit[1] : headerSplit[0];
    const mimeType = headerSplit[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';

    // Use Deno's native decoding
    const binary = Uint8Array.from(atob(pureBase64), c => c.charCodeAt(0));

    const extension = mimeType.split('/')[1] || 'bin';
    const filePath = `${orgId}/${msgData.key.remoteJid.split('@')[0]}/${whatsappId}.${extension}`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('crm_media')
        .upload(filePath, binary, {
            contentType: mimeType,
            upsert: true
        });

    if (uploadErr) throw uploadErr;

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
        .from('crm_media')
        .getPublicUrl(filePath);

    return publicUrl;
}

async function triggerFollowups(supabase: any, contactId: string, orgId: string, content: string) {
    const { data: contactState } = await supabase.from('contacts').select('handling_mode').eq('id', contactId).single();

    if (contactState?.handling_mode === 'manual') return;

    // Buffering Logic: Wait 15s for more messages
    const triggerAt = new Date();
    triggerAt.setSeconds(triggerAt.getSeconds() + 15);

    await supabase.rpc('buffer_ai_message', {
        p_contact_id: contactId,
        p_org_id: orgId,
        p_content: content,
        p_trigger_at: triggerAt.toISOString()
    });

    console.log(`[AI Buffer] Message buffered for ${contactId}. Trigger at ${triggerAt.toISOString()}`);
}

async function processBuffers(supabase: any) {
    // Pick buffers where trigger_at < now
    const { data: readyBuffers, error } = await supabase
        .from('ai_message_buffer')
        .delete()
        .lt('trigger_at', new Date().toISOString())
        .select();

    if (error) {
        console.error("[Buffer Process Fail]:", error.message);
        return;
    }

    if (!readyBuffers || readyBuffers.length === 0) return;

    for (const buffer of readyBuffers) {
        const contactId = buffer.contact_id;
        const orgId = buffer.organization_id;
        const content = buffer.aggregated_content;

        console.log(`[AI/Workflow Trigger] Processing for ${contactId}`);

        try {
            const { data: contactState } = await supabase.from('contacts').select('current_workflow_id, current_node_id, handling_mode').eq('id', contactId).single();

            if (contactState?.handling_mode === 'manual') continue;

            // 1. Check for Active Workflows
            if (contactState?.current_workflow_id) {
                console.log(`[Workflow] Triggering flow ${contactState.current_workflow_id} for ${contactId}`);
                await supabase.functions.invoke('flow-engine', {
                    body: { contactId, flowId: contactState.current_workflow_id, currentNodeId: contactState.current_node_id, message: content }
                });
                continue;
            }

            // 2. AI Decision Engine
            const decision = await shouldAiRespond(supabase, contactId, orgId, content);
            if (decision.shouldRespond) {
                console.log(`[AI] Drafting response for ${contactId}`);
                await processAIRequest(supabase, {
                    contactId,
                    organizationId: orgId,
                    userMessage: content,
                    history: [] // History is usually handled inside processAIRequest or fetched there
                }, Deno.env.get('OPENAI_API_KEY')!);
            }
        } catch (e: any) {
            console.error(`[Buffer Loop Fail] Contact ${contactId}:`, e.message);
        }
    }
}
