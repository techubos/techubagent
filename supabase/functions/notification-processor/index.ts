
// NOTIFICATION PROCESSOR (THE GUARDIAN)
// Handles immediate WhatsApp alerts and SLA escalations.

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { action, payload } = await req.json()
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
        const notifyInstance = Deno.env.get('NOTIFY_INSTANCE_NAME') || Deno.env.get('EVOLUTION_INSTANCE_NAME')

        // ACTION: NOTIFY AGENT ON TRANSFER
        if (action === 'notify_transfer') {
            const { contactId, userId } = payload
            console.log(`🔔 Notifying transfer for contact ${contactId} to user ${userId}`)

            // 1. Fetch Agent Profile (to get personal_phone)
            const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=full_name,personal_phone`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            })
            const profile = (await profileRes.json())[0]

            // 2. Fetch Contact Info
            const contactRes = await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${contactId}&select=name,phone`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            })
            const contact = (await contactRes.json())[0]

            if (profile?.personal_phone && contact) {
                const message = `🚀 *NOVO LEAD ATRIBUÍDO!*\n\nOlá ${profile.full_name}, o lead *${contact.name || contact.phone}* foi transferido para você agora.\n\nAtenda o quanto antes no painel do TecHub Agent!`

                await fetch(`${evolutionUrl}/message/sendText/${notifyInstance}`, {
                    method: 'POST',
                    headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        number: profile.personal_phone,
                        text: message,
                        delay: 1000
                    })
                })

                // 3. Create Internal Notification Record
                await fetch(`${supabaseUrl}/rest/v1/notifications`, {
                    method: 'POST',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        type: 'transfer',
                        title: 'Novo Lead Atribuído',
                        message: `Você recebeu o lead ${contact.name || contact.phone}`,
                        contact_id: contactId
                    })
                })
            }
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
        }

        // ACTION: NOTIFY HANDOFF (Immediate Enterprise Alert)
        if (action === 'notify_handoff') {
            const { contactId } = payload

            // 1. Fetch Config
            const configRes = await fetch(`${supabaseUrl}/rest/v1/settings?key=eq.sla_config&select=value`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            })
            const settings = await configRes.json()
            const slaConfig = settings[0]?.value

            // 2. Fetch Contact
            const contactRes = await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${contactId}&select=name,phone`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            })
            const contact = (await contactRes.json())[0]

            if (!contact) return new Response('Contact not found', { status: 404 })

            const message = `🤖 *ALERTA DE HANDOFF (HUMANO)*\n\nO robô transferiu um atendimento!\n\nLead: *${contact.name || contact.phone}*\nTelefone: ${contact.phone}\n\nVerifique o painel imediatamente.`

            // A. Telegram Alert
            if (slaConfig?.telegram_token && slaConfig?.telegram_chat_id) {
                await fetch(`https://api.telegram.org/bot${slaConfig.telegram_token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: slaConfig.telegram_chat_id,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                }).catch(e => console.error("Telegram Fail", e))
            }

            // B. Email Alert (Placeholder until provider is set)
            if (slaConfig?.owner_email) {
                console.log(`📧 Email Notification would be sent to: ${slaConfig.owner_email}`)
            }

            // C. WhatsApp Alert (Existing logic)
            if (slaConfig?.owner_phone) {
                await fetch(`${evolutionUrl}/message/sendText/${notifyInstance}`, {
                    method: 'POST',
                    headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: slaConfig.owner_phone, text: message })
                })
            }

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
        }

        // ACTION: CHECK SLA (Escalation & Persistent Reminders)
        if (action === 'check_sla') {
            // 1. Fetch Config from Settings
            const configRes = await fetch(`${supabaseUrl}/rest/v1/settings?key=eq.sla_config&select=value`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            })
            const settings = await configRes.json()
            const slaConfig = settings[0]?.value

            // const agentThreshold = slaConfig?.agent_threshold_min || 5
            const ownerThreshold = slaConfig?.owner_threshold_min || 15
            const ownerPhone = slaConfig?.owner_phone
            const escalationEnabled = slaConfig?.escalation_enabled ?? true
            const remind1 = slaConfig?.remind_interval_1 || 5
            const remind2 = slaConfig?.remind_interval_2 || 15

            if (!escalationEnabled) return new Response(JSON.stringify({ success: true, message: 'Escalation disabled' }), { headers: corsHeaders })

            const now = Date.now()

            // 2. Find leads in human mode and unread
            const res = await fetch(`${supabaseUrl}/rest/v1/contacts?handling_mode=eq.human&is_unread=eq.true&select=id,name,phone,assigned_to,last_message_at,notification_count,last_notification_sent_at`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            })
            const waitingLeads = await res.json()

            if (waitingLeads?.length) {
                for (const lead of waitingLeads) {
                    const waitTimeMins = (now - new Date(lead.last_message_at).getTime()) / 60000
                    const lastNotifyMins = lead.last_notification_sent_at ? (now - new Date(lead.last_notification_sent_at).getTime()) / 60000 : 999

                    if (shouldNotify) {
                        // const alertType = waitTimeMins >= ownerThreshold ? "CRITICAL_ESCALATION" : (waitTimeMins >= remind2 ? "REMEMBER_15" : "REMEMBER_5")
                        const message = `🚨 *LEMBRETE DE ATENDIMENTO (${Math.round(waitTimeMins)}m)*\n\nLead: *${lead.name || lead.phone}*\nStatus: Aguardando Humano\n\nPor favor, responda o cliente em todos os canais!`
                        const message = `🚨 *LEMBRETE DE ATENDIMENTO (${Math.round(waitTimeMins)}m)*\n\nLead: *${lead.name || lead.phone}*\nStatus: Aguardando Humano\n\nPor favor, responda o cliente em todos os canais!`

                        // A. Telegram
                        if (slaConfig?.telegram_token && slaConfig?.telegram_chat_id) {
                            await fetch(`https://api.telegram.org/bot${slaConfig.telegram_token}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chat_id: slaConfig.telegram_chat_id,
                                    text: message,
                                    parse_mode: 'Markdown'
                                })
                            }).catch(e => console.error("Telegram Alert Fail", e))
                        }

                        // B. WhatsApp
                        if (ownerPhone) {
                            await fetch(`${evolutionUrl}/message/sendText/${notifyInstance}`, {
                                method: 'POST',
                                headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ number: ownerPhone, text: message })
                            })
                        }

                        // Update Notification Stats
                        await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${lead.id}`, {
                            method: 'PATCH',
                            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                notification_count: (lead.notification_count || 0) + 1,
                                last_notification_sent_at: new Date().toISOString()
                            })
                        })
                    }
                }
            }
            return new Response(JSON.stringify({ success: true, checked: waitingLeads?.length || 0 }), { headers: corsHeaders })
        }

        throw new Error('Invalid Action')
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
    }
})
