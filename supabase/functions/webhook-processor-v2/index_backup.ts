// WEBHOOK PROCESSOR V3.2 (Robust & Local-First + AI Brain + Feature Flags)
// @deno-types="https://esm.sh/@supabase/supabase-js@2.39.0/dist/module/index.d.ts"/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { processAIRequest } from "../_shared/ai-engine/orchestrator.ts";
import { shouldAiRespond } from "../_shared/ai-decision-engine.ts"; // Keep for pre-checks
import { sanitizePhone, sanitizeMessage } from "../_shared/sanitize.ts";
import { MessageSchema, ContactSchema } from "../_shared/validation-schemas.ts";
import { enqueueJob } from "../_shared/jobs.ts";

const SERVICE_NAME = 'processor';

// Logging Helper for Centralized Dashboard
const log = async (level: string, component: string, message: string, metadata: any = {}, orgId?: string) => {
    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await supabase.from('app_logs').insert({ level, component, message, metadata, organization_id: orgId });
    } catch (e) { console.error('Logger Error:', e); }
};

Deno.serve(async (req: Request) => {
    // 1. Setup & Auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payloadBody = await req.json();
    const record = payloadBody.record;

    if (!record || !record.id) {
        return new Response('Invalid Payload: Expected Database Webhook structure (record field missing). Ensure you are sending webhooks to evolution-webhook, not this processor.', { status: 400 });
    }

    const queueId = record.id;
    const body = record.payload;
    const orgId = record.organization_id;

    // Helper: Update Health
    const updateHealth = async (component: string, status: 'healthy' | 'degraded' | 'down', error?: string) => {
        try {
            await supabase.rpc('update_system_health', {
                p_org_id: orgId || '00000000-0000-0000-0000-000000000000',
                p_component: component,
                p_status: status,
                p_error: error
            });
        } catch (e) { /* Ignore */ }
    };

    try {
        const data = body.data;
        if (!data || !data.key) {
            await supabase.from('webhook_queue').update({ status: 'ignored', error_log: 'No data key' }).eq('id', queueId);
            return new Response('Ignored', { status: 200 });
        }

        const eventsToProcess = [
            'messages.upsert', 'messages.update', 'MESSAGES_UPSERT',
            'connection.update',
            'contacts.upsert', 'contacts.update', 'CONTACTS_UPSERT', 'CONTACTS_UPDATE',
            'messages.set', 'MESSAGES_SET' // History Sync Events
        ];

        if (!eventsToProcess.includes(body.event)) {
            // Silently ignore irrelevant events to keep logs clean
            if (!['presence.update', 'groups.update'].includes(body.event)) {
                await supabase.from('webhook_queue').update({ status: 'ignored', error_log: `Event type ${body.event}` }).eq('id', queueId);
            } else {
                await supabase.from('webhook_queue').update({ status: 'ignored' }).eq('id', queueId);
            }
            return new Response('Ignored Event', { status: 200 });
        }

        // === HANDLE CONNECTION UPDATE ===
        if (body.event === 'connection.update') {
            const instanceName = body.instance;
            const state = body.data?.state || 'close'; // open, close, connecting

            console.log(`[Processor] Connection Update: ${instanceName} -> ${state}`);

            // Update connections table
            const { error: connError } = await supabase
                .from('connections')
                .update({ status: state, updated_at: new Date().toISOString() })
                .eq('instance_name', instanceName);

            if (connError) {
                console.error('Error updating connection status:', connError);
                throw connError;
            }

            // Also update organization status for redundancy if needed
            // await supabase.from('organizations').update({ whatsapp_status: state }).eq('instance_name', instanceName);

            await supabase.from('webhook_queue').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', queueId);
            return new Response('Connection Updated', { status: 200 });
        }

        // === HANDLE CONTACTS SYNC ===
        if (['contacts.upsert', 'contacts.update', 'CONTACTS_UPSERT', 'CONTACTS_UPDATE'].includes(body.event)) {
            const contacts = Array.isArray(data) ? data : [data];
            console.log(`[Processor] Processing ${contacts.length} contacts...`);

            for (const c of contacts) {
                const phone = c.id.split('@')[0];
                const name = c.pushName || c.name || phone;
                const pic = c.profilePictureUrl || '';

                try {
                    await supabase.from('contacts').upsert({
                        organization_id: orgId,
                        phone: phone,
                        name: name,
                        profile_pic_url: pic,
                        status: 'lead',
                        handling_mode: 'ai'
                    }, { onConflict: 'organization_id, phone' });
                } catch (err) { console.error(`Contact Sync Fail ${phone}`, err); }
            }

            await supabase.from('webhook_queue').update({ status: 'completed' }).eq('id', queueId);
            return new Response('Contacts Synced', { status: 200 });
        }

        // === HANDLE HISTORY SYNC (MESSAGES.SET) ===
        let messagesToProcess = [];
        if (['messages.set', 'MESSAGES_SET'].includes(body.event)) {
            console.log(`[Processor] History Sync Batch...`);
            messagesToProcess = Array.isArray(data) ? data : (data.messages || []);
        } else {
            // Normal single message
            messagesToProcess = [data];
        }

        // BATCH PROCESS LOOP
        for (const messageData of messagesToProcess) {

            // ... (existing single message logic needs to be wrapped or adapted)
            // REFACTOR START: Extract Single Message Logic to avoid giant nesting? 
            // For minimal impact, I will Map `messagesToProcess` to the variables below 
            // BUT strict refactor is risky. 
            // Instead, I will treat the rest of the function as "Single Message Handler" 
            // and if it IS a batch, I loops it here? No, better to just allow the flow to continue if it is a single message.
            // If it is a batch, we loop and return.

            if (messagesToProcess.length > 1) {
                let synced = 0;
                for (const msgData of messagesToProcess) {
                    try {
                        await processSingleMessage(supabase, msgData, orgId);
                        synced++;
                    } catch (e) { console.error("History Msg Fail", e); }
                }
                await supabase.from('webhook_queue').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', queueId);
                return new Response(`Synced ${synced} messages`, { status: 200 });
            }

            // If Just 1 (Normal realtime message), continue to existing logic below...
            const data = messagesToProcess[0]; // Override 'data' variable for downstream logic
            const phone = sanitizePhone(data.key.remoteJid.split('@')[0]);
            const isFromMe = !!data.key.fromMe;
            const pushName = sanitizeMessage(data.pushName || phone);
            const whatsappId = data.key.id;
            const msgTimestamp = Number(data.messageTimestamp) || Math.floor(Date.now() / 1000);

            let content = '';
            let messageType = 'text';
            const msg = data.message || {};

            if (msg.conversation) content = msg.conversation;
            else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
            else if (msg.imageMessage) { content = msg.imageMessage.caption || '[Imagem]'; messageType = 'image'; }
            else if (msg.audioMessage) { content = '[Áudio]'; messageType = 'audio'; }
            else if (msg.videoMessage) { content = msg.videoMessage.caption || '[Vídeo]'; messageType = 'video'; }
            else if (msg.stickerMessage) { content = '[Figurinha]'; messageType = 'sticker'; }

            if (!content && !msg) {
                await supabase.from('webhook_queue').update({ status: 'completed', error_log: 'Empty Content' }).eq('id', queueId);
                return new Response('Empty Content', { status: 200 });
            }

            // === STEP 2: LOCAL PERSISTENCE ===
            let contactId: string;
            try {
                const { data: existingContact } = await supabase
                    .from('contacts')
                    .select('id, handling_mode')
                    .eq('phone', phone)
                    .eq('organization_id', orgId)
                    .maybeSingle();

                // Validate Contact Data
                const validatedContact = ContactSchema.parse({
                    phone,
                    name: pushName,
                    organization_id: orgId
                });

                if (existingContact) {
                    contactId = existingContact.id;
                } else {
                    const { data: newContact, error: createError } = await supabase
                        .from('contacts')
                        .insert({
                            ...validatedContact,
                            status: 'lead',
                            handling_mode: 'ai'
                        })
                        .select('id')
                        .single();

                    if (createError) throw createError;
                    contactId = newContact.id;
                }

                // Validate Message Data
                const validatedMessage = MessageSchema.parse({
                    contact_id: contactId,
                    organization_id: orgId,
                    content,
                    whatsapp_message_id: whatsappId
                });

                const { data: insertedMsg, error: msgError } = await supabase.from('messages').upsert({
                    ...validatedMessage,
                    phone,
                    role: isFromMe ? 'assistant' : 'user',
                    message_type: messageType,
                    status: isFromMe ? 'sent' : 'delivered',
                    created_at: new Date(msgTimestamp * 1000).toISOString(),
                    payload: data
                }, { onConflict: 'whatsapp_message_id' }).select('id').single();

                if (msgError) throw msgError;

                // === STEP 3: ASYNC JOBS (NEW) ===
                if (messageType === 'audio' && insertedMsg) {
                    console.log(`[Processor] Enqueuing transcription job for ${phone}`);
                    await enqueueJob(supabase, 'transcribe_audio', {
                        messageId: insertedMsg.id,
                        audioUrl: msg.audioMessage?.url || ''
                    }, orgId);
                }

            } catch (dbError: any) {
                console.error('CRITICAL DB FAIL:', dbError);
                await updateHealth('processor', 'down', dbError.message);
                await supabase.from('webhook_queue').update({ status: 'error', error_log: dbError.message }).eq('id', queueId);
                return new Response('DB Error', { status: 500 });
            }

            // === STEP 3: TRANSCRIPTION (Skipped) ===

            // === STEP 4: CHATWOOT SYNC (OPTIONAL & TOGGLEABLE) ===
            const { data: orgSettings } = await supabase
                .from('organizations')
                .select('chatwoot_enabled')
                .eq('id', orgId)
                .single();

            const isChatwootEnabled = orgSettings?.chatwoot_enabled ?? true; // Default true if not set

            if (isChatwootEnabled) {
                try {
                    console.log(`[Processor] Chatwoot Sync Active for ${phone}`);
                } catch (cwError: any) {
                    console.warn('Chatwoot Push Fail:', cwError);
                    await updateHealth('chatwoot', 'down', cwError.message);
                }
            } else {
                console.log(`[Processor] Chatwoot Skipped (Disabled) for ${phone}`);
            }

            // === STEP 4.5: WORKFLOW ENGINE ===
            try {
                // 1. Check if user is already in a active workflow
                const { data: contactState } = await supabase.from('contacts').select('current_workflow_id, current_node_id').eq('id', contactId).single();

                if (contactState?.current_workflow_id) {
                    console.log(`[Processor] Routing to Flow Engine (Flow: ${contactState.current_workflow_id})`);

                    await supabase.functions.invoke('flow-engine', {
                        body: { contactId, flowId: contactState.current_workflow_id, currentNodeId: contactState.current_node_id, message: content }
                    });

                    // Mark queue completed and exit
                    await supabase.from('webhook_queue').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', queueId);
                    return new Response('Routed to Workflow', { status: 200 });
                }

                // 2. Check for Keyword Triggers (Start New Flow)
                if (!isFromMe) { // Only triggers on user message
                    const { data: triggers } = await supabase
                        .from('workflows')
                        .select('id, trigger_config')
                        .eq('is_active', true)
                        .eq('trigger_type', 'keyword');

                    if (triggers && triggers.length > 0) {
                        const match = triggers.find((t: any) => {
                            const keywords = t.trigger_config?.keywords || [];
                            if (!Array.isArray(keywords)) return false;
                            return keywords.some((k: string) => content.toLowerCase().includes(k.toLowerCase()));
                        });

                        if (match) {
                            console.log(`[Processor] Triggered New Workflow: ${match.id}`);
                            // Start Flow (pass flowId, null node)
                            await supabase.functions.invoke('flow-engine', {
                                body: { contactId, flowId: match.id, currentNodeId: null, message: content }
                            });

                            // Mark queue completed and exit
                            await supabase.from('webhook_queue').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', queueId);
                            return new Response('Workflow Triggered', { status: 200 });
                        }
                    }
                }
            } catch (flowErr) {
                console.error("Workflow Check Failed:", flowErr);
                // Continue to AI if workflow check fails? Or Block?
                // Continue.
            }

            // === STEP 5: AI ORCHESTRATION ===
            if (!isFromMe) {
                const decision = await shouldAiRespond(supabase, contactId, orgId, content, {
                    cooldownSeconds: 120 // Default 2 minutes
                });

                if (decision.shouldRespond) {
                    // B. NEW AI BRAIN
                    const aiResponse = await processAIRequest(supabase, {
                        contactId,
                        organizationId: orgId,
                        userMessage: content,
                        history: []
                    }, Deno.env.get('OPENAI_API_KEY')!);

                    if (aiResponse.action === 'respond' || aiResponse.action === 'transfer_human') {
                        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
                        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
                        const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

                        if (evolutionUrl && evolutionKey) {
                            const metadata = aiResponse.metadata || {};
                            const shouldSimulateTyping = metadata.simulate_typing !== false; // Default true if undefined
                            const typingWpm = metadata.typing_wpm || 60;
                            const shouldSplit = metadata.split_messages !== false;

                            // Split messages logic
                            let messagesToSend = [aiResponse.message];
                            if (shouldSplit && aiResponse.message.length > 200) {
                                messagesToSend = aiResponse.message.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((m: string) => m.trim().length > 0);
                            }

                            for (const msgText of messagesToSend) {
                                // Calculate Delay
                                let delayMs = 0;
                                if (shouldSimulateTyping) {
                                    const wordCount = msgText.split(' ').length;
                                    delayMs = Math.min((wordCount / typingWpm) * 60 * 1000, 5000);

                                    // Send 'composing' presence
                                    try {
                                        await fetch(`${evolutionUrl}/chat/sendPresence/${instanceName}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
                                            body: JSON.stringify({ number: phone, presence: 'composing', delay: delayMs })
                                        });
                                    } catch (_) { /* ignore presence error */ }

                                    // Wait
                                    await new Promise(r => setTimeout(r, delayMs));
                                }

                                // Send Message
                                await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
                                    body: JSON.stringify({
                                        number: phone,
                                        textMessage: { text: msgText }
                                    })
                                });

                                // Log to DB
                                await supabase.from('messages').insert({
                                    contact_id: contactId,
                                    role: 'assistant',
                                    content: msgText,
                                    organization_id: orgId
                                });

                                // Short delay between chunks
                                if (messagesToSend.length > 1) await new Promise(r => setTimeout(r, 800));
                            }

                            console.log(`[AI Brain] Responded with ${messagesToSend.length} messages to ${phone}`);
                        }
                    }
                } else {
                    console.log(`[AI Decision] BLOCKED for ${phone}. Reason: ${decision.reason}`);
                    await log('debug', SERVICE_NAME, `AI Orchestration Blocked for ${phone}`, { reason: decision.reason, orgId }, orgId);
                }
            }

            // === FINALIZATION ===
            await supabase.from('webhook_queue').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', queueId);
            await updateHealth('processor', 'healthy');
            await log('info', SERVICE_NAME, `Message processed successfully for ${phone}`, { queueId, orgId }, orgId);

            return new Response('Processed', { status: 200 });

        } catch (unexpectedError: any) {
            console.error('UNEXPECTED:', unexpectedError);
            await updateHealth('processor', 'down', 'Unexpected Crash');
            await log('critical', SERVICE_NAME, `Unexpected Crash in Webhook Processor`, { error: unexpectedError.message, queueId }, orgId);
            await supabase.from('webhook_queue').update({ status: 'error', error_log: unexpectedError.message }).eq('id', queueId);
            return new Response('Unexpected Error', { status: 200 });
        }
    });

// Helper for Batch Processing (Copy of the main logic, stripped for history)
async function processSingleMessage(supabase: any, data: any, orgId: any) {
    if (!data.key) return;

    const rawPhone = data.key.remoteJid.split('@')[0];
    const phone = sanitizePhone(rawPhone);
    const isFromMe = !!data.key.fromMe;
    const whatsappId = data.key.id;
    const msgTimestamp = Number(data.messageTimestamp) || Math.floor(Date.now() / 1000);

    let content = '';
    let messageType = 'text';
    const msg = data.message || {};

    if (msg.conversation) content = msg.conversation;
    else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
    else if (msg.imageMessage) { content = msg.imageMessage.caption || '[Imagem]'; messageType = 'image'; }
    else if (msg.audioMessage) { content = '[Áudio]'; messageType = 'audio'; }
    else if (msg.videoMessage) { content = msg.videoMessage.caption || '[Vídeo]'; messageType = 'video'; }

    if (!content && !msg) return;

    // Fast Upsert Contact
    // For history sync, we assume contact might override or be created
    // We do a "Blind Upsert" for speed on history
    const { data: contact } = await supabase.from('contacts').select('id').eq('phone', phone).eq('organization_id', orgId).maybeSingle();
    let contactId = contact?.id;

    if (!contactId) {
        const { data: newC } = await supabase.from('contacts').insert({
            organization_id: orgId, phone, name: data.pushName || phone, status: 'lead', handling_mode: 'ai'
        }).select('id').single();
        contactId = newC?.id;
    }

    if (contactId) {
        await supabase.from('messages').upsert({
            contact_id: contactId,
            organization_id: orgId,
            content,
            phone,
            role: isFromMe ? 'assistant' : 'user',
            message_type: messageType,
            status: isFromMe ? 'sent' : 'delivered',
            whatsapp_message_id: whatsappId,
            created_at: new Date(msgTimestamp * 1000).toISOString(),
            payload: data
        }, { onConflict: 'whatsapp_message_id' });
    }
}
