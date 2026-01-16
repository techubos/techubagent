import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export async function sendWhatsAppMessage(phone: string, message: string, instanceName: string) {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionUrl || !evolutionKey) {
        console.error("Evolution API not configured");
        return;
    }

    try {
        const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey
            },
            body: JSON.stringify({
                number: phone,
                textMessage: { text: message }
            })
        });

        if (!res.ok) {
            console.error("Evolution API Error:", await res.text());
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

Deno.serve(async (req) => {
    try {
        const now = new Date();
        // Look ahead 60 minutes for any reminders that match the current time window
        // Ideally ran every minute.

        // We want events that are scheduled, haven't sent reminder (or maybe specific reminder logic), 
        // and start_time is in the future.
        // Simpler logic: Fetch all upcoming events for next 24h, check if any reminder matches NOW.

        const { data: events, error } = await supabase
            .from('calendar_events')
            .select('*, contacts(name, phone), connections(instance_name)')
            .eq('status', 'scheduled')
            .gt('start_time', now.toISOString())
            .lt('start_time', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());

        if (error) throw error;

        const updates = [];

        for (const event of events || []) {
            const startTime = new Date(event.start_time);
            const diffMs = startTime.getTime() - now.getTime();
            const diffMinutes = Math.floor(diffMs / 60000);

            // Get instance name (assuming one active connection per org)
            const instanceName = Array.isArray(event.connections)
                ? event.connections[0]?.instance_name
                : event.connections?.instance_name;

            if (event.reminder_minutes && event.reminder_minutes.includes(diffMinutes)) {
                // Send Notification
                if (event.whatsapp_notification && event.contacts?.phone && instanceName) {
                    const msg = `🔔 *Lembrete de Evento*\n\n📌 **${event.title}**\n📅 ${startTime.toLocaleString('pt-BR')}\n${event.description ? `📝 ${event.description}` : ''}`;
                    await sendWhatsAppMessage(event.contacts.phone, msg, instanceName);
                }

                // In-app notification
                if (event.user_id) {
                    await supabase.from('notifications').insert({
                        user_id: event.user_id,
                        title: 'Lembrete de Evento',
                        content: `Evento "${event.title}" começa em ${diffMinutes} minutos.`,
                        type: 'info'
                    });
                }

                updates.push(event.id);
            }
        }

        return new Response(JSON.stringify({ processed: updates.length, ids: updates }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
