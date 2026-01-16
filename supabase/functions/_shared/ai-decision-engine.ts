
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export interface DecisionResult {
    shouldRespond: boolean;
    reason: string;
}

export interface DecisionConfig {
    businessHours?: {
        enabled: boolean;
        startHour: number; // 0-23
        endHour: number;   // 0-23
        timezone: string;  // e.g. 'America/Sao_Paulo'
    };
    cooldownSeconds: number; // e.g. 120 (2 mins)
}

export const DEFAULT_CONFIG: DecisionConfig = {
    businessHours: { enabled: true, startHour: 9, endHour: 18, timezone: 'America/Sao_Paulo' },
    cooldownSeconds: 120
};

export async function shouldAiRespond(
    supabase: SupabaseClient,
    contactId: string,
    orgId: string,
    userMessage: string,
    config: DecisionConfig = DEFAULT_CONFIG
): Promise<DecisionResult> {

    // 1. CHECK HUMAN INTENT
    // Explicit keywords to stop AI immediately
    const stopKeywords = ['falar com humano', 'falar com atendente', 'humano', 'suporte'];
    const lowerMsg = userMessage.toLowerCase();
    if (stopKeywords.some(kw => lowerMsg.includes(kw))) {
        // Optionally update contact mode to 'human' here? 
        // For pure decision logic, just return false.
        return { shouldRespond: false, reason: 'user_requested_human' };
    }

    // 2. CHECK CONTACT STATE (Chatwoot/Human Mode)
    const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('handling_mode, status')
        .eq('id', contactId)
        .single();

    if (contactError || !contact) {
        return { shouldRespond: false, reason: 'contact_not_found_or_error' };
    }

    if (contact.handling_mode === 'human') {
        return { shouldRespond: false, reason: 'handling_mode_is_human' };
    }

    // 3. CHECK BUSINESS HOURS
    if (config.businessHours?.enabled) {
        // Get current time in target timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: config.businessHours.timezone,
            hour: 'numeric',
            hour12: false
        });
        const currentHour = parseInt(formatter.format(new Date()));

        if (currentHour < config.businessHours.startHour || currentHour >= config.businessHours.endHour) {
            return { shouldRespond: false, reason: 'outside_business_hours' };
        }
    }

    // 4. CHECK COOLDOWN (Last AI Message)
    // Prevent loops if AI just replied
    const { data: lastMsgs } = await supabase
        .from('messages')
        .select('created_at, role')
        .eq('contact_id', contactId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

    if (lastMsgs && lastMsgs.length > 0) {
        const lastAiTime = new Date(lastMsgs[0].created_at).getTime();
        const now = Date.now();
        const diffSeconds = (now - lastAiTime) / 1000;

        if (diffSeconds < config.cooldownSeconds) {
            return { shouldRespond: false, reason: `cooldown_active_(${Math.floor(diffSeconds)}s)` };
        }
    }

    // 5. ALL CHECKS PASSED
    return { shouldRespond: true, reason: 'eligible' };
}
