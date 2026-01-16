import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { Contact, Message } from '../../../types';

export const useAICopilot = (contact: Contact, messages: Message[], autoDraft?: boolean, onClearAutoDraft?: () => void) => {
    const [suggestion, setSuggestion] = useState('');
    const [magicDraft, setMagicDraft] = useState<string | null>(null);
    const [smartReplies, setSmartReplies] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [typingTimeout, setTypingTimeout] = useState<any>(null);

    const handleDraftChange = useCallback((text: string) => {
        if (suggestion && !suggestion.startsWith(text)) {
            setSuggestion('');
        }

        if (typingTimeout) clearTimeout(typingTimeout);

        if (text.length > 5) {
            setTypingTimeout(setTimeout(async () => {
                const { getWhisperSuggestion } = await import('../../../services/geminiService');
                const result = await getWhisperSuggestion(text, messages);
                if (result && result.length > text.length) {
                    setSuggestion(result);
                }
            }, 800));
        }
    }, [suggestion, typingTimeout, messages]);

    const generateMagicReply = useCallback(async () => {
        setSuggestion("Gerando resposta mágica...");
        try {
            const { generateCRMDraft } = await import('../../../services/geminiService');
            const result = await generateCRMDraft(contact, messages);
            if (result && result.draft) {
                setMagicDraft(result.draft);
                setSuggestion("");
            }
        } catch (e) {
            console.error("Magic Reply Failed", e);
            setSuggestion("Falha ao gerar resposta.");
        }
    }, [contact, messages]);

    const generateSuggestions = useCallback(async () => {
        setLoadingSuggestions(true);
        try {
            const { data, error } = await supabase.functions.invoke('smart-reply', {
                body: { contact_id: contact.id }
            });
            if (error) throw error;
            if (data?.suggestions) {
                setSmartReplies(data.suggestions);
            }
        } catch (e) {
            console.error("Suggestions error:", e);
        } finally {
            setLoadingSuggestions(false);
        }
    }, [contact.id]);

    useEffect(() => {
        if (autoDraft) {
            generateMagicReply();
            onClearAutoDraft?.();
        }
    }, [autoDraft, generateMagicReply, onClearAutoDraft]);

    useEffect(() => {
        setSmartReplies([]);
    }, [contact.id]);

    return {
        suggestion,
        magicDraft,
        setMagicDraft,
        smartReplies,
        setSmartReplies,
        loadingSuggestions,
        handleDraftChange,
        generateMagicReply,
        generateSuggestions
    };
};
