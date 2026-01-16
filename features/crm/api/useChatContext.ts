import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { Contact, Message } from '../../../types';

export const useChatContext = (contact: Contact, messages: Message[]) => {
    const [contextSummary, setContextSummary] = useState<string | null>(contact.summary || null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    const fetchSummary = useCallback(async () => {
        if (!contact || messages.length === 0) return;
        setLoadingSummary(true);
        try {
            const { data, error } = await supabase.functions.invoke('summarize-conversation', {
                body: { contact_id: contact.id }
            });
            if (!error && data?.summary) {
                setContextSummary(data.summary);
            }
        } catch (e) {
            console.error("Summary error", e);
        } finally {
            setLoadingSummary(false);
        }
    }, [contact, messages.length]);

    const scheduleMessage = async (text: string, date: Date) => {
        const { error } = await supabase.from('scheduled_messages').insert({
            contact_id: contact.id,
            content: text,
            scheduled_for: date.toISOString(),
            status: 'pending',
            message_type: 'text'
        });
        if (error) throw error;
    };

    return {
        contextSummary,
        setContextSummary,
        loadingSummary,
        fetchSummary,
        scheduleMessage
    };
};
