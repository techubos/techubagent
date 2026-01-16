
// SHARED JOB UTILS (Edge Functions)
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export async function enqueueJob(
    supabase: SupabaseClient,
    type: 'transcribe_audio' | 'generate_summary' | 'sync_history' | 'send_notification',
    payload: any,
    organizationId: string
) {
    const { data, error } = await supabase
        .from('job_queue')
        .insert({
            type,
            payload,
            organization_id: organizationId,
            status: 'pending'
        })
        .select()
        .single();

    if (error) {
        console.error(`[JobQueue] Error enqueuing ${type}:`, error);
        throw error;
    }

    return data;
}
