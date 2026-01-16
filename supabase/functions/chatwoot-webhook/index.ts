import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const payload = await req.json();
        const { event, message_type, content, conversation, sender, created_at, id: message_id, attachments, status: msg_status, inbox } = payload;

        // We only care about message creation and update events
        if (event !== 'message_created' && event !== 'message_updated') {
            return new Response(JSON.stringify({ ok: true, skipped: true, event }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 0. Find the corresponding organization_id from our connections
        const inboxIdStr = inbox?.id?.toString();
        const { data: connection, error: connError } = await supabase
            .from('connections')
            .select('organization_id')
            .eq('chatwoot_inbox_id', inboxIdStr)
            .maybeSingle();

        if (connError || !connection) {
            console.error(`No connection found for chatwoot_inbox_id: ${inboxIdStr}`);
            // Return 200 to acknowledge receipt even if no mapping found to prevent infinite retries
            return new Response(JSON.stringify({ ok: false, error: "connection_not_found" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const organizationId = connection.organization_id;

        const phone = sender?.phone_number || '';
        if (!phone) {
            console.log("No phone number found for sender, skipping.");
            return new Response(JSON.stringify({ ok: true, skipped: "no_phone" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const cleanPhone = phone.replace(/\D/g, '');

        // 1. Ensure Contact exists with correct organization_id
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id')
            .eq('phone', cleanPhone)
            .eq('organization_id', organizationId)
            .maybeSingle();

        let finalContactId = contact?.id;

        if (!finalContactId) {
            const { data: newContact, error: createError } = await supabase
                .from('contacts')
                .insert({
                    name: sender.name || cleanPhone,
                    phone: cleanPhone,
                    status: 'lead',
                    organization_id: organizationId
                })
                .select()
                .single();
            if (createError) throw createError;
            finalContactId = newContact.id;
        }

        // 2. Map attachments (images/audio)
        let mediaUrl = null;
        let msgType = 'text';

        if (attachments && attachments.length > 0) {
            mediaUrl = attachments[0].data_url;
            const contentType = attachments[0].file_type || '';
            if (contentType.includes('image')) msgType = 'image';
            else if (contentType.includes('audio')) msgType = 'audio';
        }

        // 3. Save Message to our DB (to keep the premium UI updated)
        const { error: msgErr } = await supabase.from('messages').upsert({
            whatsapp_message_id: message_id.toString(),
            contact_id: finalContactId,
            content: content || '',
            role: message_type === 'incoming' ? 'user' : 'assistant',
            from_me: message_type === 'outgoing',
            phone: cleanPhone,
            created_at: new Date(created_at).toISOString(),
            message_type: msgType,
            media_url: mediaUrl,
            status: msg_status || (message_type === 'incoming' ? 'received' : 'sent'),
            organization_id: organizationId,
            payload: {
                chatwoot_conversation_id: conversation?.id,
                chatwoot_account_id: payload.account?.id,
                chatwoot_message_id: message_id
            }
        }, { onConflict: 'whatsapp_message_id' });

        if (msgErr) throw msgErr;

        // 4. Trigger AI Processing if it's an incoming message
        if (message_type === 'incoming' && !payload.sender?.type?.includes('bot')) {
            const { error: invokeErr } = await supabase.functions.invoke('ai-chat-processor', {
                body: {
                    contact_id: finalContactId,
                    organization_id: organizationId,
                    source: 'chatwoot'
                }
            });
            if (invokeErr) console.error("AI Processor Trigger Error:", invokeErr);
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error("Webhook Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
