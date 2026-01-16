
// WEBHOOK RECOVERY JOB
// Runs periodically to rescue stuck events
// @deno-types="https://esm.sh/@supabase/supabase-js@2.39.0/dist/module/index.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MAX_RETRIES = 3;

Deno.serve(async (req) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Find Saturated/Stuck Items
        // Created > 5 mins ago AND status = pending OR processing
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data: stuckItems, error } = await supabase
            .from('webhook_queue')
            .select('*')
            .in('status', ['pending', 'processing'])
            .lt('created_at', fiveMinutesAgo)
            .limit(50);

        if (error) throw error;

        if (!stuckItems || stuckItems.length === 0) {
            return new Response('No stuck items found', { status: 200 });
        }

        const results = { recovered: 0, failed: 0 };

        // 2. Process Each
        for (const item of stuckItems) {
            const currentRetries = (item.metadata?.retry_count || 0);

            if (currentRetries >= MAX_RETRIES) {
                // Mark as dead letter
                await supabase.from('webhook_queue')
                    .update({ status: 'failed', error_log: 'Max retries exceeded via recovery job' })
                    .eq('id', item.id);
                results.failed++;
                continue;
            }

            // Increment Retry
            const newMetadata = { ...(item.metadata || {}), retry_count: currentRetries + 1, recovered_at: new Date().toISOString() };

            // Re-invoke Processor
            // We use the 'functions.invoke' to trigger the processor V2 on this specific item
            const { error: invokeError } = await supabase.functions.invoke('webhook-processor-v2', {
                body: { record: item } // Mimic the DB trigger payload format
            });

            if (invokeError) {
                console.error(`Failed to invoke recovery for ${item.id}:`, invokeError);
                // Just update metadata to record attempt
                await supabase.from('webhook_queue')
                    .update({ metadata: newMetadata })
                    .eq('id', item.id);
            } else {
                // Processor v2 will update the status to 'completed' or 'error' itself
                results.recovered++;
            }
        }

        // 3. Log Run
        await supabase.from('debug_logs').insert({
            service: 'webhook-recovery',
            level: 'info',
            message: `Recovery Job Ran: ${results.recovered} recovered, ${results.failed} failed hard.`,
            payload: results
        });

        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
