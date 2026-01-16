
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const url = new URL(req.url)
        const route = url.pathname.split('/').pop() // connect | callback

        const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
        const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')
        const PIPEDRIVE_CLIENT_ID = Deno.env.get('PIPEDRIVE_CLIENT_ID')
        const PIPEDRIVE_CLIENT_SECRET = Deno.env.get('PIPEDRIVE_CLIENT_SECRET')

        // Determine provider from URL param or body (fallback to google for backward compat if needed, but better to require it)
        let provider = 'google'
        try {
            const body = await req.clone().json()
            if (body.provider) provider = body.provider
        } catch { }

        // Also check query param
        if (url.searchParams.get('provider')) provider = url.searchParams.get('provider')!

        const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/integrations-auth/callback` // Shared callback

        // 1. GENERATE AUTH URL
        if (route === 'connect') {
            let authUrl = ''

            if (provider === 'google') {
                if (!GOOGLE_CLIENT_ID) throw new Error('Missing Google Credentials')
                const scope = [
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/calendar.events'
                ].join(' ')
                authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=google`
            } else if (provider === 'pipedrive') {
                if (!PIPEDRIVE_CLIENT_ID) throw new Error('Missing Pipedrive Credentials')
                authUrl = `https://oauth.pipedrive.com/oauth/authorize?client_id=${PIPEDRIVE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=pipedrive`
            } else {
                throw new Error('Invalid provider')
            }

            return new Response(JSON.stringify({ url: authUrl }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 2. CALLBACK Handling
        if (route === 'callback') {
            const { code, state } = await req.json()
            if (!code) throw new Error('No code provided')

            provider = state || 'google' // Provider is passed in state
            let tokens: any = {}

            if (provider === 'google') {
                const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: GOOGLE_CLIENT_ID!,
                        client_secret: GOOGLE_CLIENT_SECRET!,
                        redirect_uri: REDIRECT_URI,
                        grant_type: 'authorization_code'
                    })
                })
                tokens = await tokenResponse.json()
            } else if (provider === 'pipedrive') {
                // Pipedrive Authorization Header
                const authString = btoa(`${PIPEDRIVE_CLIENT_ID}:${PIPEDRIVE_CLIENT_SECRET}`)
                const tokenResponse = await fetch('https://oauth.pipedrive.com/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: REDIRECT_URI
                    })
                })
                tokens = await tokenResponse.json()
            }

            if (tokens.error) throw new Error(tokens.error_description || tokens.error)

            // Save to Database
            await supabaseClient
                .from('integrations')
                .upsert({
                    provider: provider,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
                    metadata: { scope: tokens.scope || 'full' },
                    active: true
                }, { onConflict: 'provider' })

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        throw new Error('Route not found')

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
