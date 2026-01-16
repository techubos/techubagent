
// @ts-nocheck
// Zero-Dependency Evolution Gateway V3 (No-CORS Proxy)
// Handles Sending, Deletion, Creation, and Status check server-side.


const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { action = 'send_message', instanceName, phone: rawPhone, content } = body

        // 1. Resolve Credentials (Payload > Env)
        const envUrl = Deno.env.get('EVOLUTION_API_URL')
        const envKey = Deno.env.get('EVOLUTION_API_KEY')

        // Remove trailing slashes from URL
        const cleanUrl = (url: string) => url ? url.replace(/\/+$/, "") : "";

        const finalUrl = cleanUrl(body.serverUrl || envUrl);
        const finalKey = body.apiKey || envKey;
        const finalInstance = instanceName || Deno.env.get('EVOLUTION_INSTANCE_NAME');

        if (!finalUrl || !finalKey) {
            throw new Error("Missing Evolution Credentials (URL or API Key). Configure via Settings or .env.")
        }

        console.log(`[EvoGatewayV3] Action: ${action} | Instance: ${finalInstance} | URL: ${finalUrl}`)

        // === ROUTER ===

        if (action === 'delete_instance') {
            await fetch(`${finalUrl}/instance/logout/${encodeURIComponent(finalInstance)}`, {
                method: 'DELETE',
                headers: { 'apikey': finalKey }
            }).catch(e => console.warn("Logout failed (ignoring):", e))

            const delRes = await fetch(`${finalUrl}/instance/delete/${encodeURIComponent(finalInstance)}`, {
                method: 'DELETE',
                headers: { 'apikey': finalKey }
            })

            const result = delRes.ok ? await delRes.json() : { status: 'assumed_deleted' }
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'create_instance') {
            const createRes = await fetch(`${finalUrl}/instance/create`, {
                method: 'POST',
                headers: {
                    'apikey': finalKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    instanceName: finalInstance,
                    qrcode: true,
                    integration: "WHATSAPP-BAILEYS",
                    reject_call: false,
                    msgHistoryLimit: 1200,
                    syncFullHistory: true, // Fixed here
                    fetchFullHistory: true
                })
            })

            if (!createRes.ok) {
                const errText = await createRes.text()
                if (createRes.status === 403 || errText.includes("already exists") || errText.includes("já existe")) {
                    console.log("[EvoGatewayV3] Instance already exists, treating as success.");
                    return new Response(JSON.stringify({
                        instance: { instanceName: finalInstance, status: "already_exists" },
                        hash: "EXISTING_IGNORED"
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
                throw new Error(`Create Failed: ${errText}`)
            }
            return new Response(JSON.stringify(await createRes.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'fetch_qr') {
            const qrRes = await fetch(`${finalUrl}/instance/connect/${encodeURIComponent(finalInstance)}`, {
                headers: { 'apikey': finalKey }
            })
            if (!qrRes.ok) throw new Error("Failed to fetch QR code")
            return new Response(JSON.stringify(await qrRes.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'connection_status') {
            const statusRes = await fetch(`${finalUrl}/instance/connectionState/${encodeURIComponent(finalInstance)}`, {
                headers: { 'apikey': finalKey }
            })
            if (statusRes.status === 404) {
                return new Response(JSON.stringify({ instance: { state: 'not_found' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            return new Response(JSON.stringify(await statusRes.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'set_webhook') {
            const { webhookUrl, events, enabled } = body;
            const webhookRes = await fetch(`${finalUrl}/webhook/set/${encodeURIComponent(finalInstance)}`, {
                method: 'POST',
                headers: {
                    'apikey': finalKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    enabled: enabled !== false,
                    url: webhookUrl,
                    webhook: webhookUrl,
                    events: events || ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "CONTACTS_UPSERT"]
                })
            })

            if (!webhookRes.ok) {
                const errText = await webhookRes.text();
                // Return success anyway, just log error, to avoid UI block
                return new Response(JSON.stringify({ error: errText, status: 'failed_but_ignored' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }
            return new Response(JSON.stringify(await webhookRes.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'fetch_history') {
            const { phone, limit } = body;
            const historyRes = await fetch(`${finalUrl}/chat/findMessages/${encodeURIComponent(finalInstance)}`, {
                method: 'POST',
                headers: { 'apikey': finalKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    where: { key: { remoteJid: `${phone}@s.whatsapp.net` } },
                    options: { limit: limit || 20 }
                })
            });
            if (!historyRes.ok) throw new Error(`History Fetch Failed: ${await historyRes.text()}`);
            return new Response(JSON.stringify(await historyRes.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'fetch_webhook') {
            const wbRes = await fetch(`${finalUrl}/webhook/find/${encodeURIComponent(finalInstance)}`, { headers: { 'apikey': finalKey } });
            if (!wbRes.ok) return new Response(JSON.stringify({}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            return new Response(JSON.stringify(await wbRes.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'send_message') {
            const phone = rawPhone.split('@')[0].replace(/\D/g, '')
            // Using known good sending logic
            const evoRes = await fetch(`${finalUrl}/message/sendText/${encodeURIComponent(finalInstance)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': finalKey },
                body: JSON.stringify({
                    number: phone,
                    options: { delay: 1200, presence: 'composing' },
                    text: content
                })
            })

            if (evoRes.ok) {
                const evoData = await evoRes.json()
                // Log success but rely on webhook for DB
                return new Response(JSON.stringify(evoData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            } else {
                throw new Error(`Evolution Send Failed: ${await evoRes.text()}`)
            }
        }

        throw new Error(`Unknown Action: ${action}`)

    } catch (error: any) {
        console.error(`[EvoGatewayV3] CRASH: ${error.message}`)
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            step: 'edge_function_gateway'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})
