import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const url = new URL(req.url)
        const mediaUrl = url.searchParams.get('url')

        if (!mediaUrl) throw new Error("Missing url parameter")

        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
        if (!evolutionKey) throw new Error("Missing EVOLUTION_API_KEY secret")

        console.log("[PROXY] Fetching media:", mediaUrl)

        const response = await fetch(mediaUrl, {
            headers: { 'apikey': evolutionKey }
        })

        if (!response.ok) {
            const err = await response.text()
            throw new Error(`Media fetch failed: ${err}`)
        }

        const blob = await response.blob()
        const contentType = response.headers.get('content-type') || 'application/octet-stream'

        return new Response(blob, {
            headers: {
                ...corsHeaders,
                'Content-Type': contentType,
                'Content-Disposition': 'inline'
            },
            status: 200
        })

    } catch (e: any) {
        console.error("[PROXY-ERR]", e.message)
        return new Response(JSON.stringify({ error: e.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
