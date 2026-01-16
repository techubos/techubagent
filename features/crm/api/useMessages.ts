
import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { Message } from '../../../types';

const PAGE_SIZE = 50;

export const useMessages = (contactId: string | undefined) => {
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. DATA FETCHING (Infinite Scroll)
    const fetchMessages = async ({ pageParam = 0 }): Promise<Message[]> => {
        if (!contactId) return [];

        const { data: { user } } = await supabase.auth.getUser();
        let orgId = user?.user_metadata?.organization_id;

        // Fallback: Fetch from profiles if metadata is missing (Matches useContacts logic)
        if (!orgId && user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();
            orgId = profile?.organization_id;
        }

        if (!orgId) {
            console.warn("Organization ID not found for messages");
            return [];
        }

        // Query strictamente pelo contact_id
        let query = supabase
            .from('messages')
            .select(`
                id, role, content, created_at, message_type, from_me, 
                organization_id, media_url, whatsapp_message_id, payload, transcription, status
            `)
            .eq('contact_id', contactId)
            .eq('organization_id', orgId) // Segurança extra
            .order('created_at', { ascending: false }) // Trazemos do mais novo para o mais antigo (paginação)
            .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

        const { data, error } = await query;

        if (error) {
            console.error('Fetch error:', error);
            throw error;
        }

        return (data || []).map(msg => ({
            id: msg.id,
            role: msg.role as any,
            content: msg.content,
            timestamp: new Date(msg.created_at).getTime(),
            message_type: msg.message_type || 'text',
            is_from_me: msg.from_me ?? false,
            mediaUrl: msg.media_url,
            whatsapp_message_id: msg.whatsapp_message_id,
            transcription: msg.transcription,
            status: msg.status,
            payload: msg.payload
        }));
    };

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useInfiniteQuery({
        queryKey: ['messages', contactId],
        queryFn: fetchMessages,
        enabled: !!contactId,
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.length < PAGE_SIZE) return undefined;
            return allPages.length;
        },
        staleTime: 10 * 1000, // 10 seconds (reduced for better responsiveness during sync)
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        select: (data) => ({
            pages: [...data.pages].reverse(), // Inverter ordem das pÃ¡ginas para o layout do chat
            pageParams: data.pageParams
        })
    });

    // 2. DATA ACCESS
    const messages = useMemo(() => {
        if (!data) return [];
        return data.pages.flatMap(page => [...page].reverse());
    }, [data]);

    // 3. REALTIME SUBSCRIPTION (Resilient)
    useEffect(() => {
        if (!contactId) return;

        const channel = supabase.channel(`messages_room:${contactId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `contact_id=eq.${contactId}`
                },
                (payload) => {
                    const newRecord = payload.new;
                    const newMsg: Message = {
                        id: newRecord.id,
                        role: newRecord.role as any,
                        content: newRecord.content,
                        timestamp: new Date(newRecord.created_at).getTime(),
                        message_type: newRecord.message_type || 'text',
                        is_from_me: newRecord.from_me ?? false,
                        whatsapp_message_id: newRecord.whatsapp_message_id,
                        transcription: newRecord.transcription,
                        mediaUrl: newRecord.media_url,
                        status: newRecord.status
                    };

                    queryClient.setQueryData(['messages', contactId], (oldData: any) => {
                        if (!oldData) return { pages: [[newMsg]], pageParams: [0] };

                        // Check for duplicates
                        const isDuplicate = oldData.pages.some((page: Message[]) =>
                            page.some(m => m.id === newMsg.id || (m.whatsapp_message_id && m.whatsapp_message_id === newMsg.whatsapp_message_id))
                        );
                        if (isDuplicate) return oldData;

                        // Add to the FIRST page (newest in original order)
                        const newPages = [...oldData.pages];
                        newPages[0] = [newMsg, ...newPages[0]];

                        return {
                            ...oldData,
                            pages: newPages
                        };
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [contactId, queryClient]);

    return {
        messages,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    };
};

// 4. AUTO-SCROLL HOOK (Bônus)
// Use isso dentro do seu Componente
export const useAutoScroll = (dependencies: any[]) => {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [dependencies]); // Pass messages here

    return endRef;
};
