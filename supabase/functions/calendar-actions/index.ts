
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
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use Service Role to access tokens
        )

        const { action, eventData, integrationId } = await req.json()
        // eventData: { summary, description, startTime, endTime, attendees }

        console.log(`[Calendar] Action: ${action} for integration ${integrationId}`)

        // 1. Get Integration Token
        let { data: integration, error: dbError } = await supabaseClient
            .from('integrations')
            .select('*')
            .eq('id', integrationId)
            .single()

        if (dbError || !integration) throw new Error('Integration not found')

        let accessToken = integration.access_token

        // 2. Check Expiration & Refresh if needed
        const expiresAt = new Date(integration.expires_at).getTime()
        const now = Date.now()

        // Refresh if expired or expiring in 5 mins
        if (now > expiresAt - (5 * 60 * 1000)) {
            console.log('[Calendar] Token expired. Refreshing...')
            const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
            const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    refresh_token: integration.refresh_token,
                    grant_type: 'refresh_token'
                })
            })

            const refreshData = await refreshResponse.json()
            if (refreshData.error) throw new Error('Failed to refresh token: ' + refreshData.error_description)

            accessToken = refreshData.access_token
            const newExpiresAt = new Date(now + refreshData.expires_in * 1000).toISOString()

            // Update DB
            await supabaseClient
                .from('integrations')
                .update({
                    access_token: accessToken,
                    expires_at: newExpiresAt
                })
                .eq('id', integrationId)
        }

        // 3. Perform Action (Create Event)
        if (action === 'create_event') {
            const event = {
                summary: eventData.summary,
                description: eventData.description,
                start: { dateTime: eventData.startTime }, // ISO String
                end: { dateTime: eventData.endTime },     // ISO String
                attendees: eventData.attendees ? eventData.attendees.map(email => ({ email })) : [],
            }

            const calendarRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            })

            const calendarData = await calendarRes.json()

            if (!calendarRes.ok) {
                // Log Failure
                await supabaseClient.from('sync_logs').insert({
                    integration_id: integrationId,
                    action: 'create_event',
                    status: 'error',
                    details: calendarData
                })
                throw new Error('Google Calendar Error: ' + JSON.stringify(calendarData))
            }

            // Log Success
            await supabaseClient.from('sync_logs').insert({
                integration_id: integrationId,
                action: 'create_event',
                status: 'success',
                details: { eventId: calendarData.id, link: calendarData.htmlLink }
            })

            return new Response(JSON.stringify(calendarData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })

    } catch (error) {
        console.error('[Calendar Error]', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
