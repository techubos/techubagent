import { supabase } from './supabaseClient';

export interface EvolutionSettings {
    [key: string]: unknown;
    instanceName: string;
    serverUrl: string;
    apiKey: string;
}

// Configuration Constants
const EDGE_FUNCTIONS = {
    GATEWAY: 'evolution-send-v3',
    SYNC_HISTORY: "evolution-sync-history",
};

// Gateway wrapper for Evolution operations to avoid CORS and hide logic
export const invokeGateway = async <T extends Record<string, unknown>>(action: string, payload: T | Record<string, unknown> = {}) => {
    try {
        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.GATEWAY, {
            body: { action, ...payload }
        });

        if (error) {
            console.error(`Gateway Error (${action}):`, error);
            throw new Error(`Erro no Servidor (${action}): ${error.message}`);
        }

        // Handle "Soft Errors" from Gateway (Status 200 but error inside)
        if (data && data.success === false) {
            throw new Error(data.error || `Erro desconhecido no Gateway (${action})`);
        }

        return data;
    } catch (e: unknown) {
        console.error(`Gateway Invocation Error (${action}):`, e);
        // Clean up the error message if it's already structured
        const msg = (e instanceof Error ? e.message : String(e)).replace(`Erro ao invocar o Gateway (${action}): `, '');
        throw new Error(msg);
    }
}

// ... existing code ...

export const syncContactHistory = async (contactId: string, phone: string, instanceName: string) => {
    try {
        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.SYNC_HISTORY, {
            body: {
                contactId,
                phone,
                instanceName
            }
        });

        if (error) throw new Error(error.message);

        if (data && data.success === false) {
            throw new Error(data.error || "Erro ao sincronizar histórico.");
        }

        return data;
    } catch (e: unknown) {
        console.error("Sync History Error:", e);
        throw new Error(`Erro ao sincronizar: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const createInstance = async (config: EvolutionSettings) => {
    return await invokeGateway('create_instance', config);
};

export const logoutInstance = async (config: EvolutionSettings) => {
    // Use gateway for hard delete
    return await invokeGateway('delete_instance', config);
};

export const fetchQRCode = async (config: EvolutionSettings) => {
    return await invokeGateway('fetch_qr', config);
};

export const checkInstanceStatus = async (config: EvolutionSettings) => {
    try {
        return await invokeGateway('connection_status', config);
    } catch (e) {
        return null;
    }
};

export const sendWhatsAppMessage = async (phone: string, content: string, contactId?: string) => {
    // 1. Check if we should use Chatwoot (Chatwoot-First Architecture)
    // We can check if the contact has a chatwoot_conversation_id in their last message
    if (contactId) {
        const { data: lastMsg } = await supabase
            .from('messages')
            .select('payload')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const chatwootToken = import.meta.env.VITE_CHATWOOT_API_TOKEN;
        const chatwootUrl = import.meta.env.VITE_CHATWOOT_API_URL;
        const convId = lastMsg?.payload?.chatwoot_conversation_id;
        const accId = lastMsg?.payload?.chatwoot_account_id || '1';

        if (convId && chatwootUrl && chatwootToken) {
            console.log("[evolutionService] Sending via Chatwoot...");
            const res = await fetch(`${chatwootUrl}/api/v1/accounts/${accId}/conversations/${convId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api_access_token': chatwootToken },
                body: JSON.stringify({ content, message_type: 'outgoing' })
            });
            if (res.ok) return await res.json();
            console.warn("[evolutionService] Chatwoot send failed, falling back to Evolution...");
        }
    }

    // Fallback: Direct Evolution Send
    // 1. Get Active Connection
    const { data: connections, error: connError } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('status', 'connected')
        .order('created_at', { ascending: false });

    let instanceName = connections?.[0]?.instance_name;

    if (!instanceName) {
        console.error("Connection Error DB:", connError || "No rows found");
        throw new Error("Nenhuma conexão de WhatsApp ativa. Vá em Configurações > Conectar WhatsApp.");
    }

    // Use gateway wrapper (V3)
    return await invokeGateway('send_message', {
        phone,
        content,
        instanceName
    });
};

// Legacy/Direct functions (Refactored to Gateway to fix CORS)
export const setWebhook = async (config: EvolutionSettings) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;

    console.log("Setting webhook via Gateway to:", webhookUrl);

    try {
        return await invokeGateway('set_webhook', {
            ...config,
            webhookUrl,
            enabled: true,
            events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "CONTACTS_UPSERT"],
            webhookByEvents: false, // Global webhook
            webhookBase64: true // FORCE Base64 for media
        });
    } catch (e: unknown) {
        console.error("Error setting webhook via Gateway:", e);
        return null;
    }
};

export const fetchWebhookSettings = async (config: EvolutionSettings) => {
    if (!config.serverUrl || !config.apiKey) return null;
    try {
        return await invokeGateway('fetch_webhook', config);
    } catch (e) { return null; }
};

export const fetchHistory = async (config: EvolutionSettings, phone: string, limit = 20) => {
    if (!config.serverUrl || !config.apiKey) return [];
    try {
        const data = await invokeGateway('fetch_history', { ...config, phone, limit });
        return data;
    } catch (e) { return []; }
};

export const saveConnection = async (config: EvolutionSettings, phone?: string) => {
    try {
        const { data, error } = await supabase.from('connections').upsert({
            name: config.instanceName,
            instance_name: config.instanceName,
            status: 'connected',
            phone_number: phone || '',
        }, { onConflict: 'instance_name' }).select();

        if (error) throw error;

        console.log("Auto-configuring webhook for:", config.instanceName);
        await setWebhook(config); // Auto config

        return data[0];
    } catch (error) {
        console.error("Error saving connection:", error);
        return null;
    }
};
