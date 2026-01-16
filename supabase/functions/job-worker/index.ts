
// supabase/functions/job-worker/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SERVICE_NAME = 'job-worker';

async function transcribeAudio(supabase: any, audioUrl: string, messageId: string) {
    console.log(`[JobWorker] Transcribing audio: ${audioUrl} for message ${messageId}`);
    // Mock transcription for now, in a real scenario this would call a transcription API
    // or another internal service. For this implementation, we simulate progress.

    // Real logic would be:
    // const transcription = await whisperAPI(audioUrl);
    // await supabase.from('messages').update({ content: transcription }).eq('id', messageId);

    return { success: true, text: "Transcrição simulada concluída." };
}

async function generateSummary(supabase: any, contactId: string) {
    console.log(`[JobWorker] Generating summary for contact: ${contactId}`);
    // Logic to fetch last messages and summarize using AI
    return { success: true };
}

async function syncHistory(supabase: any, contactId: string) {
    console.log(`[JobWorker] Syncing history for contact: ${contactId}`);
    // Logic to fetch old messages from Evolution API and save to DB
    return { success: true };
}

async function processJob(supabase: any, job: any) {
    switch (job.type) {
        case 'transcribe_audio':
            return await transcribeAudio(supabase, job.payload.audioUrl, job.payload.messageId);
        case 'generate_summary':
            return await generateSummary(supabase, job.payload.contactId);
        case 'sync_history':
            return await syncHistory(supabase, job.payload.contactId);
        default:
            throw new Error(`Unknown job type: ${job.type}`);
    }
}

Deno.serve(async (req) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[JobWorker] Starting iteration...`);

    // 1. Fetch pending jobs
    const { data: jobs, error: fetchError } = await supabase
        .from('job_queue')
        .select('*')
        .eq('status', 'pending')
        .lt('attempts', 3)
        .order('created_at', { ascending: true })
        .limit(5);

    if (fetchError) {
        console.error(`[JobWorker] Error fetching jobs:`, fetchError);
        return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
        return new Response(JSON.stringify({ message: 'No jobs to process' }), { status: 200 });
    }

    const results = [];

    for (const job of jobs) {
        try {
            // 2. Mark as processing
            await supabase
                .from('job_queue')
                .update({
                    status: 'processing',
                    started_at: new Date().toISOString()
                })
                .eq('id', job.id);

            // 3. Process
            const result = await processJob(supabase, job);
            results.push({ job_id: job.id, success: true });

            // 4. Mark as completed
            await supabase
                .from('job_queue')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    error_message: null
                })
                .eq('id', job.id);

        } catch (error: any) {
            console.error(`[JobWorker] Error processing job ${job.id}:`, error);

            const isFinalAttempt = (job.attempts + 1) >= 3;

            await supabase
                .from('job_queue')
                .update({
                    status: isFinalAttempt ? 'failed' : 'pending',
                    attempts: job.attempts + 1,
                    error_message: error.message
                })
                .eq('id', job.id);

            results.push({ job_id: job.id, success: false, error: error.message });
        }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { 'Content-Type': 'application/json' }
    });
});
