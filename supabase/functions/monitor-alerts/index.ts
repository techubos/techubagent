import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async () => {
    // Cron trigger generally uses POST
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        const adminPhone = Deno.env.get('ADMIN_PHONE')

        // 1. Orphan Check (Missing Responses)
        // Find contacts where last message is User and no Assistant reply since then, and time > 5 min
        // Requires careful query. Simplified: fetch recent active contacts, check last message.
        // Or using `contacts` last_interaction?
        // Let's assume `contacts` table has `last_message_at`.
        // We need to know who sent the last message.
        // Let's query recent messages (last 24h).

        let recoverCount = 0

        // Fetch contacts with open conversations
        const { data: activeContacts } = await supabase
            .from('contacts')
            .select('id, phone, name')
            .neq('status', 'finished')
            .limit(50)

        for (const contact of (activeContacts || [])) {
            // Get last message
            const { data: msgs } = await supabase
                .from('messages')
                .select('*')
                .eq('contact_id', contact.id)
                .order('created_at', { ascending: false })
                .limit(1)

            if (msgs && msgs.length > 0) {
                const lastMsg = msgs[0]
                const now = new Date().getTime()
                const msgTime = new Date(lastMsg.created_at).getTime()
                const diffMin = (now - msgTime) / 1000 / 60

                // If last msg is USER (role='user' OR is_from_me=false/null which usually means User in this context? 
                // Wait, 'is_from_me' = true means sent by Agent/User(Owner). 
                // 'role'='user' means Client. 
                // If last msg is 'user' AND > 5 min AND < 24h
                if (lastMsg.role === 'user' && diffMin > 5 && diffMin < 1440) {
                    console.log(`🚑 Recovering orphan conversation: ${contact.phone} (silent for ${Math.round(diffMin)}m)`)

                    // Trigger Chat Completion
                    await supabase.functions.invoke('chat-completion', {
                        body: {
                            contactId: contact.id,
                            phone: contact.phone,
                            messages: [{ role: 'user', content: lastMsg.content }] // Reprocess last msg
                        }
                    })
                    recoverCount++
                    // Mark as recovered so we don't loop forever? 
                    // Chat completion will add a new assistant message, so next check won't match 'lastMsg.role === user'.
                }
            }
        }

        // 2. Health Link
        let healthIcon = "🟢"
        const healthIssues = [];

        try {
            const { data: health } = await supabase.functions.invoke('health-check')
            if (health && health.status !== 'ok') {
                healthIcon = "🔴"
                healthIssues.push(`Health Check Failed: ${health.error}`)
            } else if (health) {
                if (health.evolution?.status !== 'connected') {
                    healthIcon = "🟡"
                    healthIssues.push(`Evolution: ${health.evolution?.status}`)
                }
                if (health.database?.latency_ms > 1000) {
                    healthIssues.push(`DB Latency High: ${health.database?.latency_ms}ms`)
                }
            }
        } catch {
            healthIcon = "🔴"
            healthIssues.push("Health Check Unreachable")
        }

        // 3. Admin Alert
        if ((recoverCount > 0 || healthIssues.length > 0) && adminPhone) {
            const report = `🤖 *AUDITORIA AUTOMÁTICA* ${healthIcon}\n\n` +
                `🚑 Respostas Recuperadas: ${recoverCount}\n` +
                (healthIssues.length > 0 ? `⚠️ Alertas Systema:\n${healthIssues.join('\n')}` : "Sistema Estável.")

            await supabase.functions.invoke('evolution-send-v3', {
                body: {
                    action: 'send_message',
                    phone: adminPhone,
                    content: report
                }
            })
        }

        return new Response(JSON.stringify({ recovered: recoverCount, issues: healthIssues }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

    } catch (error: any) {
        console.error("Monitor Error:", error)
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})
