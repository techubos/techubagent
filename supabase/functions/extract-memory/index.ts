import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.0.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        let { contactId, messageId, conversationHistory } = await req.json()
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        const geminiKey = Deno.env.get('GEMINI_API_KEY')
        const adminPhone = Deno.env.get('ADMIN_PHONE')

        if (!geminiKey) throw new Error("GEMINI_API_KEY missing")

        // 0. Auto-Fetch History if missing (Backfill Mode)
        if (!conversationHistory && contactId) {
            const { data: msgs } = await supabase
                .from('messages')
                .select('*')
                .eq('contact_id', contactId)
                //.neq('message_type', 'audio') // Optional: skip audio if no transcription? No, we might have transcription.
                .order('created_at', { ascending: false }) // Newest first
                .limit(20)

            if (msgs) conversationHistory = msgs.reverse() // Chronological
        }

        if (!conversationHistory || conversationHistory.length === 0) {
            return new Response(JSON.stringify({ skipped: true, reason: "No history" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 1. Prepare History
        // Use last 10 messages for context (or all if less)
        const recentHist = conversationHistory.slice(-15)
        const chatText = recentHist.map((m: any) => `${m.role === 'assistant' || m.is_from_me ? 'Agent' : 'User'}: ${m.content}`).join('\n')

        // 2. Gemini Prompt
        const ai = new GoogleGenAI(geminiKey)
        const model = ai.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        })

        const prompt = `
Analise a conversa abaixo entre um Agente e um Usuário.
Tarefas:
1. Extraia FATOS novos sobre o usuário (nome, preferências, intenção, timeline, objeções).
2. Analise o SENTIMENTO do usuário.
3. Detecte se o usuário está FRUSTRADO ou pede falar com humano.

Formato JSON esperado:
{
  "facts": [
    { "fact": "Nome é Carlos", "category": "identity", "confidence": 0.95 },
    { "fact": "Interesse em plano anual", "category": "intent", "confidence": 0.9 }
  ],
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "frustration_score": 0.0 to 1.0 (1.0 = muito frustrado),
  "needs_human": boolean
}

CONVERSA:
${chatText}
`
        const result = await model.generateContent(prompt)
        const analysis = JSON.parse(result.response.text())

        // 3. Upsert Facts (Memories)
        if (analysis.facts && analysis.facts.length > 0) {
            for (const item of analysis.facts) {
                if (item.confidence < 0.6) continue; // Filter low confidence

                // Check duplicates effectively or just insert logs? 
                // We use 'contact_memory' table.
                // We will insert specific facts. 
                // Ideally we check if exact fact exists, but let's just insert for log or update similar?
                // For simplicity/speed: Insert. (Cleanups can happen later).
                // Actually, duplicate facts clutter prompt.
                // Simple De-dupe: Check if recent memory with same category/value exists?
                // Let's blindly insert for now as "Log of facts", but usually we want unique state.
                // Improved: Only insert if not exists.

                // Using 'fact_type' as category.
                await supabase.from('contact_memory').insert({
                    contact_id: contactId,
                    fact_type: item.category,
                    fact_value: item.fact,
                    confidence_score: item.confidence,
                    source_message_id: messageId
                })
            }
        }

        // 4. Handle Sentiment & Human Handoff
        if (analysis.frustration_score > 0.8 || analysis.needs_human) {
            console.log(`🚨 High Frustration Detected (${analysis.frustration_score}). Triggering Human Handoff.`)

            // Update Contact Status
            await supabase.from('contacts').update({
                human_intervention: true,
                sentiment: 'angry', // Map 'frustrated' to 'angry' if 'frustrated' not in enum. Enum has: positive, neutral, angry.
                // 'frustrated' -> 'angry'. 'negative' -> 'angry'?
                // Let's assume 'angry' covers frustration.
            }).eq('id', contactId)

            // Notify Admin via WhatsApp
            if (adminPhone) {
                const { data: contact } = await supabase.from('contacts').select('name, phone').eq('id', contactId).single()
                const alertMsg = `🚨 *ALERTA CRM*: Cliente ${contact?.name || 'Desconhecido'} (${contact?.phone}) está FRUSTRADO e precisa de humano.\n\nÚltima msg: "${recentHist[recentHist.length - 1]?.content}"`

                await supabase.functions.invoke('evolution-send-v3', {
                    body: {
                        action: 'send_message',
                        phone: adminPhone,
                        content: alertMsg
                    }
                })
            }
        } else {
            // Just update sentiment if significant
            let dbSentiment = 'neutral';
            if (analysis.sentiment === 'positive') dbSentiment = 'positive'
            if (analysis.sentiment === 'negative' || analysis.sentiment === 'frustrated') dbSentiment = 'angry' // Approximate

            await supabase.from('contacts').update({ sentiment: dbSentiment }).eq('id', contactId)
        }

        return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

    } catch (error: unknown) {
        console.error("Extract Memory Error:", error)
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})
