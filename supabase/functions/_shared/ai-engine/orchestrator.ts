import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { AIContext, AIResponse } from './types.ts';
import { detectIntent } from './intent.ts';
import { checkRules } from './rules.ts';
import { getMemories, extractAndSaveMemory } from './memory.ts';

export async function processAIRequest(
    supabase: SupabaseClient,
    context: AIContext,
    openAiKey: string
): Promise<AIResponse> {

    // 1. Fetch Active Agent (Default for now, or specific if provided in context)
    const { data: agent } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('organization_id', context.organizationId)
        .eq('is_active', true)
        .eq('is_default', true)
        .single();

    if (!agent) {
        console.warn("No active/default agent found for org", context.organizationId);
        return { message: "", action: 'none' };
    }

    const personality = agent.personality || 'friendly';
    const instructions = agent.custom_instructions || '';

    // 2. Intent Detection
    const intent = await detectIntent(context.userMessage, openAiKey);
    console.log("Detected Intent:", intent);

    // 3. Load Memories
    const memories = await getMemories(supabase, context.contactId);

    // 4. Load & Check Rules
    const { data: rules } = await supabase
        .from('ai_rules')
        .select('*')
        .eq('organization_id', context.organizationId)
        .eq('enabled', true);

    const ruleResponse = await checkRules(supabase, context, rules || []);
    if (ruleResponse) {
        return ruleResponse;
    }

    // 5. Workflow Check (Placeholder for now)
    // const workflowResponse = await checkWorkflows(...)

    // 6. Generate LLM Response
    const systemPrompt = `
    You are an AI assistant for a business.
    Personality: ${personality}
    Additional Instructions: ${instructions}
    
    Context Memories:
    ${memories}
    
    Intent Detected: ${intent.name}
    
    Respond helpfully and naturally.
    `;

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o', // Or configured model
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...context.history.slice(-5), // Last 5 messages
                    { role: 'user', content: context.userMessage }
                ],
                temperature: 0.7,
            })
        });

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;

        // 7. Background Memory Extraction (Fire and Forget)
        extractAndSaveMemory(supabase, context.contactId, context.userMessage, openAiKey);

        return {
            message: reply || "Desculpe, não entendi.",
            action: 'respond',
            confidence: 0.9,
            metadata: {
                agent_id: agent.id,
                simulate_typing: agent.simulate_typing,
                typing_wpm: agent.typing_wpm,
                split_messages: agent.split_messages,
                chunks_delay_ms: agent.chunks_delay_ms
            }
        };

    } catch (e) {
        console.error("LLM Error", e);
        return { message: "Erro interno na IA.", action: 'none' };
    }
}
