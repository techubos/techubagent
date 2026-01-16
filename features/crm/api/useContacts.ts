
// hook: useContacts v3 (Infinite Scroll + Optimized Realtime)
import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../../../services/supabaseClient';
import { Contact } from '../../../types';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 50;
const STALE_TIME = 1000 * 60 * 5; // 5 minutos sem refetch

export const useContacts = (searchTerm?: string) => {
    const queryClient = useQueryClient();

    // 1. Fetching Logic with Pagination
    const fetchContacts = async ({ pageParam = 0 }): Promise<Contact[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        let orgId = user?.user_metadata?.organization_id;

        // Fallback: Fetch from profiles if metadata is missing
        if (!orgId && user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();
            orgId = profile?.organization_id;
        }

        if (!orgId) return [];

        let query = supabase
            .from('contacts') // Switched to Real-Time Table (Bypassed MV)
            .select('*')
            .eq('organization_id', orgId);

        if (searchTerm) {
            query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .range(pageParam * ITEMS_PER_PAGE, (pageParam + 1) * ITEMS_PER_PAGE - 1);

        if (error) throw error;

        return data as unknown as Contact[];
    };

    // 2. Infinite Query
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useInfiniteQuery({
        queryKey: ['contacts', searchTerm || 'all'],
        queryFn: fetchContacts,
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === ITEMS_PER_PAGE ? allPages.length : undefined;
        },
        staleTime: STALE_TIME,
        gcTime: STALE_TIME * 2,
        refetchOnWindowFocus: false, // Performance Critical
        retry: 2,
    });

    // 3. Flatten Data (Memoized)
    // Transforma as páginas em uma lista única
    const flatContacts = useMemo(() => {
        if (!data) return [];
        return data.pages.flatMap(page => page);
    }, [data]);

    // 4. Optimized Realtime (INSERT/UPDATE ONLY)
    // Otimização: Não ouvimos DELETE se não precisarmos.
    // Otimização: Batch updates para não travar a UI com múltiplos inserts rápidos.
    useEffect(() => {
        let updateBatch: Contact[] = [];
        let batchTimeout: NodeJS.Timeout;
        let channel: any;

        const processBatch = () => {
            if (updateBatch.length === 0) return;

            queryClient.setQueryData(['contacts'], (oldData: any) => {
                if (!oldData) return oldData;

                const newPages = oldData.pages.map((page: Contact[]) => [...page]);

                updateBatch.forEach((updatedContact) => {
                    // Tenta achar e atualizar nas páginas existentes
                    let found = false;

                    for (const page of newPages) {
                        const idx = page.findIndex((c) => c.id === updatedContact.id);
                        if (idx !== -1) {
                            page[idx] = { ...page[idx], ...updatedContact };
                            found = true;
                            break;
                        }
                    }

                    // Se não achou (novo contato) e é um INSERT, adiciona no topo da primeira página
                    if (!found) {
                        if (newPages.length > 0) {
                            newPages[0].unshift(updatedContact);
                        } else {
                            // Se não tinha nada, cria primeira página
                            newPages[0] = [updatedContact];
                        }
                    }
                });

                // Re-ordenar primeira página por segurança (opcional, mas bom pra UX)
                if (newPages.length > 0) {
                    newPages[0].sort((a: Contact, b: Contact) => {
                        const tA = new Date(a.last_message_at || 0).getTime();
                        const tB = new Date(b.last_message_at || 0).getTime();
                        return tB - tA;
                    });
                }

                return { ...oldData, pages: newPages };
            });

            updateBatch = [];
        };

        const initRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            let orgId = user?.user_metadata?.organization_id;

            if (!orgId && user) {
                const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
                orgId = profile?.organization_id;
            }

            if (!orgId) return;

            channel = supabase.channel('contacts_feed_optimized')
                .on(
                    'postgres_changes',
                    {
                        event: '*', // Ouvimos tudo mas filtramos na lógica
                        schema: 'public',
                        table: 'contacts',
                        filter: `organization_id=eq.${orgId}`
                    },
                    (payload: RealtimePostgresChangesPayload<Contact>) => {
                        // Ignora DELETEs para evitar flash na tela, deixa stale até refresh manual se preferir
                        // Ou implemente lógica de remoção se crítico. 
                        // Aqui focamos em performance de chat (Insert/Update são 99% dos casos)
                        if (payload.eventType === 'DELETE') return;

                        const newContact = payload.new as Contact;
                        updateBatch.push(newContact);

                        clearTimeout(batchTimeout);
                        batchTimeout = setTimeout(processBatch, 1000); // 1s debounce para batching agressivo
                    }
                )
                .subscribe();
        };

        initRealtime();

        return () => {
            if (channel) supabase.removeChannel(channel);
            clearTimeout(batchTimeout);
        };
    }, [queryClient]);

    return {
        contacts: flatContacts,
        isLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    };
};
