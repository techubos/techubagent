import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sanitizeJSON } from "../_shared/sanitize.ts";

// Note: In a real Edge Function environment, we'd use a shared logger utility.
// For this example, I'll show how to use the logger concept inline or via a shared folder.
const log = async (level: string, component: string, message: string, metadata: any = {}, orgId?: string) => {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await supabase.from('app_logs').insert({ level, component, message, metadata, organization_id: orgId });
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Config
const EXECUTION_TIMEOUT_MS = 4500; // Leave 500ms for safety margin

Deno.serve(async (req) => {
    // 1. CORS is always first
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    // 2. Global Safety Catch - Returns 200 no matter what
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS);

        const response = await processWebhook(req, controller.signal);
        clearTimeout(timeoutId);
        return response;

    } catch (criticalError) {
        // Absolute worst case: just say OK and log to console (Supabase logs)
        console.error('💥 CRITICAL WEBHOOK FAILURE:', criticalError);
        return new Response('ACCEPTED_WITH_ERROR', { status: 200, headers: corsHeaders });
    }
});

async function processWebhook(req: Request, signal: AbortSignal): Promise<Response> {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: any = {};
    let rawBody = "";

    try {
        // 3. Fast Parsing
        rawBody = await req.text();
        if (!rawBody) return new Response('EMPTY', { status: 200, headers: corsHeaders });

        try {
            body = JSON.parse(rawBody);
            body = sanitizeJSON(body);
        } catch (jsonError) {
            await logToDebug(supabase, 'error', 'Invalid JSON Payload', { error: jsonError.message });
            return new Response('INVALID_JSON', { status: 200, headers: corsHeaders });
        }

        // 4. Fast Organization Context (Instance name is usually top level)
        const instance = body.instance || body.instanceName || body.instance_name;
        let organizationId = null;

        if (instance) {
            // Quick cache-friendly lookup
            const { data: conn } = await supabase
                .from('connections')
                .select('organization_id')
                .eq('instance_name', instance)
                .maybeSingle()
                .abortSignal(signal);

            organizationId = conn?.organization_id || null;
        }

        // 5. Atomic Push to Queue - THIS IS THE ONLY DURABLE STEP
        // We use the unique index on (organization_id, messageId) to prevent duplicates at the DB level
        const { error: queueError } = await supabase
            .from('webhook_queue')
            .insert({
                payload: body,
                status: 'pending',
                organization_id: organizationId,
                next_retry_at: new Date().toISOString()
            })
            .abortSignal(signal);

        if (queueError) {
            // If it's a conflict error (code 23505), it's a duplicate - we return 200/QUEUED anyway
            if (queueError.code === '23505') {
                return new Response('QUEUED_DUPLICATE', { status: 200, headers: corsHeaders });
            }
            throw new Error(`Queue insert failed: ${queueError.message}`);
        }

        return new Response('QUEUED', { status: 200, headers: corsHeaders });

    } catch (processError: any) {
        console.error('💥 Webhook Error:', processError.message);
        await logToDebug(supabase, 'error', 'Webhook Error', { error: processError.message });

        // Return 200 so Evolution stops retrying if we had a logic/db error
        return new Response('ACCEPTED_WITH_RECOVERY', { status: 200, headers: corsHeaders });
    }
}

async function logToDebug(supabase: any, level: string, message: string, payload: any) {
    try {
        await supabase.from('debug_logs').insert({
            service: 'evolution-webhook',
            level,
            message,
            payload
        });
    } catch (e) {
        console.error("Log failed", e); // Valid to ignore
    }
}
