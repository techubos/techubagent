import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { action, agentId, startTime, endTime, eventData } = await req.json();

        // 1. Get Integration Token
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('*')
            .eq('provider', 'google')
            .limit(1)
            .single();

        if (intError || !integration) {
            return new Response(JSON.stringify({ error: "Google Calendar não conectado." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            });
        }

        const accessToken = integration.metadata.access_token;

        if (action === 'check_availability') {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/freeBusy`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    timeMin: startTime,
                    timeMax: endTime,
                    items: [{ id: 'primary' }]
                })
            });
            const result = await response.json();
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'create_event') {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });
            const result = await response.json();
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: "Ação não suportada" }), { status: 400 });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
