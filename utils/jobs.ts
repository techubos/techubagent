
import { supabase } from './supabaseClient';

export async function enqueueJob(
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
