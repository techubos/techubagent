import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Check Database Connectivity & Latency
        const startDb = performance.now()
        const { error: dbError } = await supabase.from('contacts').select('count', { count: 'exact', head: true })
        const endDb = performance.now()

        if (dbError) throw new Error(`DB Error: ${dbError.message}`)

        // 2. Check Evolution API
        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
        const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') // or fetch from config

        let evoStatus = 'unknown'
        let evoLatency = 0

        if (evolutionUrl && evolutionKey && instanceName) {
            const startEvo = performance.now()
            try {
                const res = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
                    headers: { 'apikey': evolutionKey }
                })
                if (res.ok) {
                    const data = await res.json()
                    evoStatus = data?.instance?.state || 'connected' // Adapt to actual response
                } else {
                    evoStatus = `error_${res.status}`
                }
            } catch (e: any) {
                evoStatus = `failed_${e.message}`
            }
            evoLatency = performance.now() - startEvo
        }

        const health = {
            status: 'ok',
            database: {
                connected: true,
                latency_ms: Math.round(endDb - startDb)
            },
            evolution: {
                status: evoStatus,
                latency_ms: Math.round(evoLatency)
            },
            timestamp: new Date().toISOString()
        }

        return new Response(JSON.stringify(health), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

    } catch (error: any) {
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})
