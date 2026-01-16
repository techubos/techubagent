
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
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { action, contactId } = await req.json()

        // 1. Get Pipedrive Integration
        let { data: integration, error: dbError } = await supabaseClient
            .from('integrations')
            .select('*')
            .eq('provider', 'pipedrive')
            .eq('active', true)
            .single()

        if (!integration) {
            return new Response(JSON.stringify({ message: 'No active Pipedrive integration' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let accessToken = integration.access_token

        // 2. Check Expiration & Refresh
        const expiresAt = new Date(integration.expires_at).getTime()
        const now = Date.now()

        if (now > expiresAt - (5 * 60 * 1000)) {
            console.log('[CRM-SYNC] Refreshing Pipedrive Token...')
            const PIPEDRIVE_CLIENT_ID = Deno.env.get('PIPEDRIVE_CLIENT_ID')
            const PIPEDRIVE_CLIENT_SECRET = Deno.env.get('PIPEDRIVE_CLIENT_SECRET')
            const authString = btoa(`${PIPEDRIVE_CLIENT_ID}:${PIPEDRIVE_CLIENT_SECRET}`)

            const refreshResponse = await fetch('https://oauth.pipedrive.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: integration.refresh_token
                })
            })

            const refreshData = await refreshResponse.json()
            if (refreshData.error) throw new Error('Failed to refresh token: ' + refreshData.error)

            accessToken = refreshData.access_token

            await supabaseClient
                .from('integrations')
                .update({
                    access_token: accessToken,
                    expires_at: new Date(now + refreshData.expires_in * 1000).toISOString()
                })
                .eq('id', integration.id)
        }

        // 3. ACTION: SYNC CONTACT
        if (action === 'sync_contact') {
            const { data: contact } = await supabaseClient.from('contacts').select('*').eq('id', contactId).single()
            if (!contact) throw new Error('Contact not found')

            // Search for Person by name/phone
            // Simple implementation: Create Person
            const personBody = {
                name: contact.name || contact.phone,
                phone: [{ value: contact.phone, label: 'work' }]
            }

            const createRes = await fetch('https://api.pipedrive.com/v1/persons', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(personBody)
            })

            const createData = await createRes.json()

            if (!createData.success) {
                throw new Error('Pipedrive Error: ' + JSON.stringify(createData))
            }

            const personId = createData.data.id

            // Create Deal (Optional)
            const dealBody = {
                title: `Deal: ${contact.name}`,
                person_id: personId,
                value: 0,
                currency: 'BRL'
            }

            await fetch('https://api.pipedrive.com/v1/deals', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(dealBody)
            })

            // Log Success
            await supabaseClient.from('sync_logs').insert({
                integration_id: integration.id,
                action: 'sync_contact',
                status: 'success',
                details: { personId, dealCreated: true }
            })

            return new Response(JSON.stringify({ success: true, personId }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ message: 'Unknown action' }), { headers: corsHeaders })

    } catch (error) {
        console.error('[CRM Sync Error]', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
