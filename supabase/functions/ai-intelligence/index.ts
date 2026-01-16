import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { OpenAI } from "https://esm.sh/openai@4.24.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

function cleanJSON(text: string) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : text;
    } catch (e) {
        return text;
    }
}

Deno.serve(async (req) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    try {
        const { action, payload } = await req.json();

        if (action === "extract_facts") {
            const { conversation, contactId, chatId } = payload;

            // 1. Analyze conversation for facts and strategic intelligence
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Você é um Estrategista de Vendas e CRM de alta performance.
                        Sua tarefa é analisar a conversa e extrair:
                        1. FATOS: (technical, preferences, history, needs, objections)
                        2. SCORE: (0-100) baseado no bicho/interesse de compra e urgência.
                        3. CATEGORIA: (marketing, sales, support, finance, noise)
                        4. PRÓXIMO PASSO: Uma sugestão acionável curta para o vendedor (ex: "Oferecer teste grátis", "Agendar call técnica").

                        Retorne um JSON:
                        {
                          "facts": [{ "fact": string, "category": string, "confidence": number }],
                          "score": number,
                          "lead_category": string,
                          "next_best_action": string
                        }`
                    },
                    {
                        role: "user",
                        content: `Conversa recente:\n${conversation}`
                    }
                ],
                response_format: { type: "json_object" }
            });

            const response = JSON.parse(cleanJSON(completion.choices[0].message.content || '{"facts": [], "score": 0}'));
            const facts = response.facts || [];

            // A. Save Facts
            for (const item of facts) {
                const { data: existing } = await supabase
                    .from("customer_insights")
                    .select("id")
                    .eq("contact_id", contactId)
                    .ilike("fact", item.fact)
                    .maybeSingle();

                if (!existing && item.confidence > 0.7) {
                    await supabase.from("customer_insights").insert({
                        contact_id: contactId,
                        fact: item.fact,
                        category: item.category,
                        confidence: item.confidence,
                        source_chat_id: chatId
                    });
                }
            }

            // B. Update Contact Intelligence
            await supabase.from("contacts").update({
                lead_score: response.score,
                lead_category: response.lead_category,
                next_best_action: response.next_best_action
            }).eq("id", contactId);

            return new Response(JSON.stringify({ success: true, extractedCount: facts.length, score: response.score }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        if (action === "audit_conversation") {
            const { conversation, chatId } = payload; // conversation is text or array

            // Analyze for issues
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Você é um Auditor de Qualidade de IA.
                        Seu objetivo é encontrar FALHAS / LACUNAS na conversa entre a IA e o Cliente.
                        
                        Tipos de problemas para identificar:
                        1. knowledge_gap: O usuário perguntou algo e a IA não soube responder, deu uma resposta genérica ("não tenho certeza", "vou verificar") ou alucinou.
                        2. negative_sentiment: O usuário demonstrou irritação, sarcasmo ou insatisfação.
                        3. repetition: A IA entrou em loop ou repetiu a mesma resposta inútil.
                        
                        Formato de Saída (JSON):
                        {
                          "issues": [
                             {
                               "type": "knowledge_gap" | "negative_sentiment" | "repetition",
                               "description": "Explicação breve do problema",
                               "suggested_fix": "O que deve ser feito (ex: Adicionar informação sobre preços no KB)"
                             }
                          ]
                        }
                        Se a conversa foi boa, retorne "issues": []`
                    },
                    {
                        role: "user",
                        content: `Conversa:\n${conversation}`
                    }
                ],
                response_format: { type: "json_object" }
            });

            const response = JSON.parse(completion.choices[0].message.content || '{"issues": []}');
            const issues = response.issues || [];

            for (const issue of issues) {
                await supabase.from("conversation_audits").insert({
                    chat_id: chatId,
                    issue_type: issue.type,
                    description: issue.description,
                    suggested_fix: issue.suggested_fix,
                    status: 'pending'
                });
            }

            return new Response(JSON.stringify({ success: true, issuesCount: issues.length }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
