
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

Deno.serve(async (req) => {
    try {
        console.log("Processing scheduled messages...");

        // 1. Fetch pending messages
        const { data: pending, error } = await supabase
            .from('scheduled_messages')
            .select(`
                *,
                contacts (
                    name,
                    company,
                    phone,
                    instance_name,
                    chatwoot_conversation_id
                )
            `)
            .eq('status', 'pending')
            .lte('scheduled_for', new Date().toISOString());

        if (error) {
            console.error("Error fetching pending messages:", error);
            throw error;
        }

        if (!pending || pending.length === 0) {
            console.log("No pending messages found.");
            return new Response(JSON.stringify({ message: "No pending messages" }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        console.log(`Found ${pending.length} messages to process.`);
        const results = [];

        for (const msg of pending) {
            try {
                const contact = msg.contacts;
                if (!contact) {
                    console.error(`Message ${msg.id} has no associated contact.`);
                    await supabase.from('scheduled_messages').update({ status: 'failed' }).eq('id', msg.id);
                    continue;
                }

                let finalContent = msg.content;

                // 2. Dynamic Variable Replacement
                const now = new Date();
                const variables: Record<string, string> = {
                    '{nome}': contact.name || 'Cliente',
                    '{empresa}': contact.company || 'TecHub',
                    '{horario}': now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    '{atendente}': 'TecHub Agent'
                };

                Object.entries(variables).forEach(([key, val]) => {
                    finalContent = finalContent.replace(new RegExp(key, 'gi'), val);
                });

                // 3. Send Message
                let success = false;
                const EVOLUTION_URL = Deno.env.get("EVOLUTION_API_URL");
                const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY");

                // Check Chatwoot first if desired, but requirement mentions sending automated messages likely via Evolution
                // Assuming Evolution API for automated output to ensure it reaches WhatsApp
                if (msg.message_type === 'audio' && msg.media_url) {
                    const audioResponse = await fetch(`${EVOLUTION_URL}/message/sendWhatsAppAudio/${contact.instance_name || 'main'}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY! },
                        body: JSON.stringify({
                            number: contact.phone,
                            audio: msg.media_url,
                            delay: 1200,
                            encoding: true
                        })
                    });
                    success = audioResponse.ok;
                    if (!success) console.error(`Failed to send audio to ${contact.phone}: ${await audioResponse.text()}`);
                } else {
                    const textResponse = await fetch(`${EVOLUTION_URL}/message/sendText/${contact.instance_name || 'main'}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY! },
                        body: JSON.stringify({
                            number: contact.phone,
                            options: { delay: 1200, presence: "composing" },
                            textMessage: { text: finalContent }
                        })
                    });
                    success = textResponse.ok;
                    if (!success) console.error(`Failed to send text to ${contact.phone}: ${await textResponse.text()}`);
                }

                // 4. Update Status
                const updateStatus = success ? 'sent' : 'failed';
                await supabase
                    .from('scheduled_messages')
                    .update({ status: updateStatus })
                    .eq('id', msg.id);

                results.push({ id: msg.id, status: updateStatus });

            } catch (innerError: any) {
                console.error(`Error processing msg ${msg.id}:`, innerError);
                await supabase.from('scheduled_messages').update({ status: 'failed' }).eq('id', msg.id);
                results.push({ id: msg.id, status: 'failed', error: innerError.message });
            }
        }

        return new Response(JSON.stringify({ processed: pending.length, results }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
});
