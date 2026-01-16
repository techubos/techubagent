import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function cleanJSON(text: string) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : text;
  } catch (e) {
    return text;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { contactId, phone, agentId, messages: recentMessagesInput } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) throw new Error("OPENAI_API_KEY missing")

    // 1. Fetch Agent Config
    // If agentId provided, use it. Else find active agent.
    let agent;
    if (agentId) {
      const { data } = await supabase.from('agents').select('*').eq('id', agentId).single()
      agent = data
    } else {
      // Fallback: Get first active agent
      const { data } = await supabase.from('agents').select('*').eq('is_active', true).limit(1).single()
      agent = data
    }

    if (!agent) throw new Error("No active agent found")

    // 2a. Check for Active Flow [NEW]
    const { data: contact } = await supabase.from('contacts').select('current_flow_id, current_node_id').eq('id', contactId).single()

    if (contact?.current_flow_id) {
      console.log("Delegating to Flow Engine:", contact.current_flow_id)

      // Delegate to Flow Engine
      await supabase.functions.invoke('flow-engine', {
        body: {
          contactId,
          flowId: contact.current_flow_id,
          currentNodeId: contact.current_node_id,
          message: recentMessagesInput
        }
      })

      // Return empty/success immediately as Flow Engine handles response sending
      return new Response(JSON.stringify({ flow_active: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // 2. Fetch History (DB Source of Truth)
    // We prefer DB history over input to ensure we have 'role' correct
    const historyLimit = 40
    const { data: dbHistory } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(historyLimit)

    // Reverse to chronological
    const fullHistory = (dbHistory || []).reverse()

    // 3. Summarize History (OpenAI Light)
    let summary = "Sem histórico anterior."
    if (fullHistory.length > 5) {
      const chatText = fullHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')
      const summaryPrompt = `Resuma a seguinte conversa em até 150 tokens, focando no contexto atual e intenção do usuário: \n\n${chatText}`
      try {
        const sumRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: summaryPrompt }],
            temperature: 0.3
          })
        })
        const sumData = await sumRes.json()
        summary = cleanJSON(sumData.choices[0].message.content)
      } catch (e) {
        console.error("Summary failed:", e)
        summary = "Histórico recente extenso (resumo falhou)."
      }
    }

    // 4. Fetch Customer Insights (Atomic Memory)
    const { data: insights } = await supabase
      .from('customer_insights')
      .select('fact, category')
      .eq('contact_id', contactId)
      .gt('confidence', 0.6)
      .order('created_at', { ascending: false })
      .limit(10)

    const insightText = insights?.map((i: any) => `[${i.category.toUpperCase()}]: ${i.fact}`).join('\n') || "Nenhum fato conhecido."

    // 5. Fetch Last Responses (Anti-Repetition)
    const lastResponses = fullHistory
      .filter((m: any) => m.role === 'assistant')
      .slice(-3)
      .map((m: any) => `"${m.content}"`)
      .join(', ') || "Nenhuma."

    // 5a. Hybrid RAG Implementation
    let kbContext = "";
    const lastUserMsg = fullHistory[fullHistory.length - 1]?.content;
    if (lastUserMsg && lastUserMsg.length > 5) {
      try {
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        const embRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: lastUserMsg, model: 'text-embedding-3-small' })
        });
        const embData = await embRes.json();
        const embedding = embData.data[0].embedding;

        // Call Hybrid Search RPC
        const { data: docs } = await supabase.rpc('search_knowledge_hybrid', {
          query_text: lastUserMsg,
          query_embedding: embedding,
          match_threshold: 0.15,
          match_count: 3,
          filter_doc_ids: agent.document_ids
        });

        if (docs && docs.length > 0) {
          kbContext = docs.map((d: any) =>
            `[DOC: ${d.title} (Confidence: ${(d.similarity * 100).toFixed(0)}%)]\n${d.content}`
          ).join('\n\n');
        }
      } catch (e) {
        console.error("RAG Error:", e);
      }
    }

    // 6. Build PRO System Prompt
    const systemPrompt = `
### REGRAS TÉCNICAS E PERSONA (PRIORIDADE MÁXIMA)
${agent.system_prompt}

### FATOS SOBRE O CLIENTE (MEMÓRIA ATÔMICA)
${insightText}

### CONHECIMENTO DA BASE (RAG)
${kbContext || "Nenhum documento específico encontrado."}

### INSTRUÇÕES DE EXECUÇÃO
1. VOCÊ DEVE RESPEITAR A PERSONA E TODAS AS REGRAS ACIMA.
2. Seja direto e humano.
3. Se o conhecimento base tiver a resposta, use-o mas mantenha seu tone.
4. Se não souber, admita e encaminhe para um atendente humano usando [HANDOFF].
5. NÃO repita informações desnecessárias.
`.trim()

    // 7. Generation
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: agent.model || 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...fullHistory.map(m => ({ role: m.role, content: m.content }))],
        temperature: 0.3
      })
    })
    const aiData = await aiRes.json()
    if (aiData.error) throw new Error(aiData.error.message)
    const responseText = aiData.choices[0].message.content

    // 8. Save Response
    const { data: savedMsg, error: saveErr } = await supabase.from('messages').insert({
      contact_id: contactId,
      role: 'assistant',
      is_from_me: true,
      content: responseText,
      type: 'text',
      status: 'pending_send'
    }).select().single()

    if (saveErr) console.error("Error saving AI response:", saveErr)

    // Robust message splitting logic (Max 300 chars)
    const smartSplit = (text: string, maxLength: number = 300): string[] => {
      const result: string[] = [];
      const segments = text.split('\n');
      for (const segment of segments) {
        let current = segment.trim();
        if (current.length === 0) continue;

        if (agent?.split_messages && current.length > maxLength) {
          while (current.length > maxLength) {
            let splitAt = -1;
            const boundaries = [' ', '.', '!', '?', ',', ';'];
            for (const b of boundaries) {
              const found = current.lastIndexOf(b, maxLength);
              if (found > splitAt) splitAt = found;
            }

            if (splitAt === -1 || splitAt < maxLength * 0.7) {
              splitAt = maxLength;
            } else {
              splitAt += 1;
            }

            result.push(current.substring(0, splitAt).trim());
            current = current.substring(splitAt).trim();
          }
        }
        if (current.length > 0) result.push(current);
      }
      return result;
    }

    // 9. Send via Evolution with Splitting and Humanization
    let targetPhone = phone
    if (!targetPhone) {
      const { data: c } = await supabase.from('contacts').select('phone').eq('id', contactId).single()
      targetPhone = c?.phone
    }

    if (targetPhone && responseText) {
      const shouldSplit = agent ? agent.split_messages : true;
      const splitLimit = 300;

      const sendLoop = async () => {
        const messagesToSend = shouldSplit
          ? smartSplit(responseText, splitLimit)
          : [responseText];

        for (const msg of messagesToSend) {
          // A. Simulate Typing/Recording
          /* Presence simulation handled automatically by V3 Gateway options
          const typingSimulation = agent ? agent.typing_simulation : true;
          if (typingSimulation) {
            // ... skipped explicit presence call ...
          } */

          // B. Send Message
          // B. Send Message via V3 Gateway
          await supabase.functions.invoke('evolution-send-v3', {
            body: {
              action: 'send_message',
              phone: targetPhone,
              content: msg
            }
          })

          // C. Wait delay between fragments
          if (messagesToSend.length > 1) {
            const interDelay = (agent?.message_delay || 3) * 1000;
            await new Promise(resolve => setTimeout(resolve, interDelay));
          }
        }
      };

      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined') {
        // @ts-ignore
        EdgeRuntime.waitUntil(sendLoop());
      } else {
        sendLoop();
      }
    }

    // 10. Trigger AI Intelligence (Fact Extraction)
    supabase.functions.invoke('ai-intelligence', {
      body: {
        action: 'extract_facts',
        payload: {
          contactId,
          chatId: savedMsg?.id,
          conversation: [...fullHistory, { role: 'assistant', content: responseText }].map(m => `${m.role}: ${m.content}`).join('\n')
        }
      }
    })

    return new Response(JSON.stringify({ response: responseText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    console.error("Chat Completion Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
