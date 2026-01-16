import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { AIContext, AIRule, AIResponse } from './types.ts';

export async function checkRules(
    supabase: SupabaseClient,
    context: AIContext,
    rules: AIRule[]
): Promise<AIResponse | null> {

    // Sort rules by priority (higher first)
    // Assuming backend returns them sorted or we sort here. 
    // Let's assume passed rules are relevant.

    const sortedRules = rules.sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
        let isTriggered = false;

        // Check Keyword Triggers
        if (rule.trigger_keywords && rule.trigger_keywords.length > 0) {
            const lowerMsg = context.userMessage.toLowerCase();
            if (rule.trigger_keywords.some(k => lowerMsg.includes(k.toLowerCase()))) {
                isTriggered = true;
            }
        } else {
            // No keywords implies check condition directly? Or maybe it's "always" rule?
            // If condition_type is 'always', treat as triggered if precedence ensures it.
            if (rule.condition_type === 'always') isTriggered = true;
        }

        if (!isTriggered) continue;

        // Check Conditions
        let conditionMet = false;

        switch (rule.condition_type) {
            case 'always':
                conditionMet = true;
                break;
            case 'if_contains':
                // Already checked via trigger_keywords mostly, but can be explicit
                conditionMet = true;
                break;
            case 'if_time':
                // TODO: Check business hours / time logic
                // For now, assume true or implement simplified check
                conditionMet = true;
                break;
            case 'if_contact_tag':
                // Need to fetch contact tags. 
                // Assuming we can skip this fetch for performance if not needed, 
                // or we need to pass contact tags in context.
                // For this MVP, let's skip complex tag checks or assume passed.
                conditionMet = true;
                break;
            default:
                conditionMet = true;
        }

        if (conditionMet) {
            // Execute Action
            if (rule.action_type === 'respond') {
                return {
                    message: rule.action_value,
                    action: 'respond',
                    confidence: 1.0,
                    metadata: { rule_id: rule.id }
                };
            } else if (rule.action_type === 'transfer_human') {
                return {
                    message: rule.action_value || "Transferindo para um atendente...",
                    action: 'transfer_human',
                    confidence: 1.0,
                    metadata: { rule_id: rule.id }
                };
            }
            // Other actions like 'execute_function' would be handled here
        }
    }

    return null;
}
