import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // Get the user from the authorization header
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) throw new Error("Unauthorized");

        const orgId = user.user_metadata.organization_id;
        if (!orgId) throw new Error("Organization not found");

        // Fetch from the materialized view
        const { data, error } = await supabaseClient
            .from('contacts_with_stats')
            .select('*')
            .eq('organization_id', orgId)
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        return new Response(JSON.stringify(data), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                // Cache for 5 minutes (300s), allowing stale-while-revalidate for an extra 10 minutes (600s)
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
