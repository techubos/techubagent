
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { connectionId } = await req.json()

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const chatwootUrl = Deno.env.get('CHATWOOT_API_URL')!
        const chatwootToken = Deno.env.get('CHATWOOT_API_TOKEN')!
        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')!
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')!
        const accountId = "1" // Default account ID

        const supabase = createClient(supabaseUrl, supabaseKey)

        // 1. Get Connection Details
        const { data: connection, error: connError } = await supabase
            .from('connections')
            .select('*')
            .eq('id', connectionId)
            .single()

        if (connError || !connection) throw new Error("Connection not found")

        const instanceName = connection.instance_name

        // 2. Create Inbox in Chatwoot
        console.log(`[Provision] Creating Chatwoot Inbox for instance: ${instanceName}`)
        const inboxRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/inboxes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_access_token': chatwootToken
            },
            body: JSON.stringify({
                name: `WhatsApp - ${instanceName}`,
                channel: { type: "api" }
            })
        })

        if (!inboxRes.ok) throw new Error(`Chatwoot Inbox Creation failed: ${inboxRes.statusText}`)
        const inboxData = await inboxRes.json()
        const inboxId = inboxData.id

        // 3. Configure Evolution API
        console.log(`[Provision] Configuring Evolution instance: ${instanceName} with Inbox: ${inboxId}`)
        try {
            const evoRes = await fetch(`${evolutionUrl}/chatwoot/set/${instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': evolutionKey
                },
                body: JSON.stringify({
                    enabled: true,
                    url: chatwootUrl,
                    accountId: accountId,
                    token: chatwootToken,
                    signMsg: true,
                    signDelimiter: "\n",
                    reopenConversation: true,
                    conversationPending: false,
                    inboxId: String(inboxId)
                })
            })

            const evoData = await evoRes.json()
            if (!evoRes.ok || evoData.status === 400 || evoData.error) {
                console.error(`[Provision] Evolution Config failed:`, evoData)
                throw new Error(evoData.response?.message?.[0] || evoData.error || "Evolution Config failed")
            }
            console.log(`[Provision] Evolution Config success for ${instanceName}`)
        } catch (error: any) {
            console.error(`[Provision] TRIGGERING ROLLBACK for Inbox ${inboxId} due to error:`, error.message)
            // ROLLBACK: Delete the created inbox in Chatwoot
            await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/inboxes/${inboxId}`, {
                method: 'DELETE',
                headers: { 'api_access_token': chatwootToken }
            }).catch(e => console.error("[Rollback Fail] Could not delete inbox:", e))

            throw error // Re-throw to catch block below
        }

        // 4. Update Webhook in Chatwoot (Ensure it's there)
        console.log(`[Provision] Ensuring Chatwoot Webhook is active`)
        const webhookRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/webhooks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_access_token': chatwootToken
            },
            body: JSON.stringify({
                url: `${supabaseUrl}/functions/v1/chatwoot-webhook-v2`,
                subscriptions: ["message_created", "message_updated"]
            })
        })

        // We log but don't fail here as webhook might already exist
        if (!webhookRes.ok) console.warn("[Provision] Webhook creation returned:", await webhookRes.text())

        // 5. Add Agent to Inbox (Crucial for visibility)
        console.log(`[Provision] Adding agent to inbox: ${inboxId}`)
        const agentId = 1;
        const agentRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/inbox_members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_access_token': chatwootToken
            },
            body: JSON.stringify({
                inbox_id: inboxId,
                user_ids: [agentId]
            })
        })
        if (!agentRes.ok) console.warn("[Provision] Agent assignment failed:", await agentRes.text())

        // 6. Save Inbox ID to Connection
        const { error: updateError } = await supabase
            .from('connections')
            .update({ chatwoot_inbox_id: String(inboxId) })
            .eq('id', connectionId)

        if (updateError) throw updateError

        return new Response(JSON.stringify({
            success: true,
            inboxId: inboxId,
            message: "Provisionamento e atribuição de agente concluídos com sucesso."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error: any) {
        console.error(`[Provision Error]`, error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})
