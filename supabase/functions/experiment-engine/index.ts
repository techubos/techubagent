
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const structure = await req.json()
        const { experimentId } = structure

        if (!experimentId) throw new Error("Missing experimentId")

        // 1. Fetch Experiment
        const { data: experiment, error: expError } = await supabase
            .from('experiments')
            .select('*, experiment_variants(*)')
            .eq('id', experimentId)
            .single()

        if (expError || !experiment) throw new Error("Experiment not found")

        // 2. Fetch Target Audience
        let query = supabase.from('contacts').select('id, name, phone').neq('phone', null)

        if (experiment.target_tags && experiment.target_tags.length > 0) {
            query = query.contains('tags', experiment.target_tags)
        }

        const { data: contacts } = await query

        if (!contacts || contacts.length === 0) {
            return new Response(JSON.stringify({ message: "No contacts found for this audience." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 3. Shuffle & Split
        const shuffled = contacts.sort(() => 0.5 - Math.random())
        const total = shuffled.length
        const sampleSize = Math.floor((total * (experiment.sample_size_percent || 20)) / 100)
        // We need 2 samples (A and B), so sampleSize is the TOTAL sample. 
        // Example: 1000 contacts. 20% sample = 200 contacts.
        // Variant A gets 100. Variant B gets 100.
        // Remaining 800 wait.

        const variantASize = Math.floor(sampleSize / 2)
        const variantBSize = Math.floor(sampleSize / 2)

        const groupA = shuffled.slice(0, variantASize)
        const groupB = shuffled.slice(variantASize, variantASize + variantBSize)
        // The rest are strictly ignored for now.

        const variants = experiment.experiment_variants
        const varA = variants[0]
        const varB = variants[1]

        // 4. Create Broadcasts (Simulation)
        // In a real system, we'd insert into a 'messages' queue.
        // Here we'll just log or create a 'broadcast' record for tracking.

        // For MVP, likely we want to CREATE the actual broadcast records so the 'send-campaign' engine picks them up?
        // Or we just insert directly into `messages`?
        // Let's assume we create 2 mini-broadcasts.

        if (groupA.length > 0 && varA) {
            await supabase.from('broadcasts').insert({
                name: `${experiment.name} [VAR A]`,
                status: 'scheduled',
                scheduled_at: new Date().toISOString(),
                message_template: varA.content,
                target_contact_ids: groupA.map(c => c.id),
                experiment_id: experiment.id // Link back
            })
        }

        if (groupB.length > 0 && varB) {
            await supabase.from('broadcasts').insert({
                name: `${experiment.name} [VAR B]`,
                status: 'scheduled',
                scheduled_at: new Date().toISOString(),
                message_template: varB.content,
                target_contact_ids: groupB.map(c => c.id),
                experiment_id: experiment.id
            })
        }

        return new Response(JSON.stringify({
            success: true,
            total: total,
            sample_total: sampleSize,
            group_a: groupA.length,
            group_b: groupB.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
