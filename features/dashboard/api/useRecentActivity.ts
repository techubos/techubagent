
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';

export const useRecentActivity = () => {
    const queryClient = useQueryClient();

    const result = useQuery({
        queryKey: ['recent-activity'],
        queryFn: async () => {
            // We can re-use get_dashboard_summary or fetch raw
            // Original code used summary.recent_activity from get_dashboard_summary
            // But let's fetch strictly the latest messages to be accurate
            const { data, error } = await supabase
                .from('messages')
                .select('*, contacts!contact_id(name)')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 // 1 minute
    });

    // Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel('dashboard_activity_realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            }, (payload) => {
                // Invalidate query to refetch latest
                queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
                // Also invalidate metrics as count changes
                queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return result;
};
