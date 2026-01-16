import { supabase } from './supabaseClient';
import { AgentSettings } from '../types';

const SETTINGS_KEY = 'agent_config';

export const fetchAgentSettings = async (): Promise<AgentSettings | null> => {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', SETTINGS_KEY)
            .maybeSingle(); // Better than .single() for optional rows

        if (error) {
            console.error('Error fetching settings from DB:', error);
            return null;
        }

        if (!data) return null;

        return data.value as AgentSettings;
    } catch (err) {
        console.error('Settings fetch failed:', err);
        return null;
    }
};

export const saveAgentSettings = async (settings: AgentSettings): Promise<boolean> => {
    try {
        // 1. Save to DB (Persistent)
        const { error } = await supabase
            .from('settings')
            .upsert({
                key: SETTINGS_KEY,
                value: settings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) {
            console.error('DB Save failed, keeping localStorage as fallback:', error);
            // We DON'T clear localStorage if the database rejected it
            localStorage.setItem('techub_agent_settings', JSON.stringify(settings));
            return false;
        }

        // 2. Clear LocalStorage ONLY IF DB SAVE SUCCESS
        localStorage.removeItem('techub_agent_settings');

        // 3. Also update ai_config for the proxy if keys are present
        if (settings.apiKeys?.openai) {
            await supabase
                .from('settings')
                .upsert({
                    key: 'ai_config',
                    value: { openai_api_key: settings.apiKeys.openai },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
        }

        return true;
    } catch (err) {
        console.error('Error saving settings:', err);
        return false;
    }
};
