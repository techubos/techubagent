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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { contactId, message, agentId } = await req.json()

        if (!contactId || !message || !agentId) {
            throw new Error("Missing required parameters: contactId, message, or agentId")
        }

        // 1. Get Agent to check settings
        const { data: agent } = await supabase
            .from('agents')
            .select('model, document_ids')
            .eq('id', agentId)
            .single()

        if (!agent || !agent.auto_learn) {
            return new Response(JSON.stringify({ message: "Auto-learn disabled or agent not found" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 2. Extract Fact using LLM
        // We use a small model for efficiency if possible
        const systemPrompt = `Você é um extrator de fatos especializado. 
Analise a mensagem do usuário abaixo e determine se ela contém uma informação NOVA e RELEVANTE sobre ele (nome, empresa, preferência, dor, problema específico).
Se encontrar algo, retorne APENAS um objeto JSON com:
{
  "fact": "Descrição curta do fato (ex: O cliente prefere reuniões às quintas)",
  "category": "preferencia|dor|perfil|outro",
  "priority": 1-5
}
Se não encontrar nada relevante, retorne o texto: "NONE"`

        const { data: extraction, error: aiError } = await supabase.functions.invoke('chat-completion', {
            body: {
                messages: [{ role: 'user', content: message }],
                settings: { model: agent.model || 'gemini-1.5-flash', temperature: 0.1 },
                systemPrompt: systemPrompt
            }
        })

        if (aiError) throw aiError

        if (extraction && extraction.text && extraction.text.trim() !== 'NONE') {
            try {
                // Parse the response
                const factData = JSON.parse(extraction.text.replace(/```json|```/g, '').trim())

                // 3. Save to documents/knowledge_base
                // We'll create a special document or append it to one of the agent's docs
                // For now, let's create a dynamic record in 'documents' table
                const { data: newDoc, error: docError } = await supabase
                    .from('documents')
                    .insert({
                        title: `Aprendizado: Contato ${contactId}`,
                        content: factData.fact,
                        category: 'text',
                        active: true,
                        // metadata: { contact_id: contactId, extracted_at: new Date().toISOString() }
                    })
                    .select('id')
                    .single()

                if (docError) throw docError

                // 4. Link to Agent
                const updatedDocIds = [...(agent.document_ids || []), newDoc.id]
                await supabase.from('agents').update({
                    document_ids: updatedDocIds
                }).eq('id', agentId)

                console.log(`[LEARN] Fact learned for contact ${contactId}: ${factData.fact}`);

                return new Response(JSON.stringify({ success: true, learned: factData.fact }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })

            } catch (e) {
                console.warn("[LEARN] Failed to parse or save fact:", extraction.text);
            }
        }

        return new Response(JSON.stringify({ success: true, learned: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("[LEARN-ERR]", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
