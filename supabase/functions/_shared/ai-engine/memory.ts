import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { AIContext, AIMemory } from './types.ts';

/**
 * Retrieves valid memories for a contact
 */
export async function getMemories(
    supabase: SupabaseClient,
    contactId: string
): Promise<string> {
    const { data } = await supabase
        .from('ai_memory')
        .select('key, value')
        .eq('contact_id', contactId);

    if (!data || data.length === 0) return "";

    // Format for LLM Context
    return data.map(m => `- ${m.key}: ${m.value}`).join('\n');
}

/**
 * Extracts and saves new memories from the interaction
 * This is usually run separately or after the main response to avoid latency.
 */
export async function extractAndSaveMemory(
    supabase: SupabaseClient,
    contactId: string,
    message: string,
    apiKey: string
) {
    const prompt = `
     Extract important facts about the user from this message to save in long-term memory.
     Message: "${message}"
     
     Return JSON only: [{ "key": "...", "value": "..." }]
     If nothing important, return [].
     Keys should be snake_case (e.g., user_name, preferred_product, budget).
     `;

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
            })
        });

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim(); // Need to parse JSON safely

        // Simple heuristic parsing. In production, use structured outputs or strict JSON mode.
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '');
        const memories = JSON.parse(cleaned);

        if (Array.isArray(memories) && memories.length > 0) {
            for (const m of memories) {
                // Upsert logic likely needed if key exists? 
                // For now, simple insert or naive update.
                // We'll delete old key if exists to keep it fresh
                await supabase.from('ai_memory').delete().eq('contact_id', contactId).eq('key', m.key);
                await supabase.from('ai_memory').insert({
                    contact_id: contactId,
                    key: m.key,
                    value: m.value
                });
            }
        }

    } catch (e) {
        // Silently fail is okay for background memory extraction
        console.error("Memory Extraction Error", e);
    }
}
