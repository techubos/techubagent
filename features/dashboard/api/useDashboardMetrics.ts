
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';

export interface DashboardMetrics {
    activeChats: number;
    totalLeads: number;
    scheduled: number;
    apiCost: number;
    forecast: number;
    health: {
        evolution: string;
        openai: string;
        webhook: string;
    }
}

export const useDashboardMetrics = (dateRange: string) => {
    return useQuery({
        queryKey: ['dashboard-metrics', dateRange],
        queryFn: async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [
                pendingRes,
                inProgressRes,
                newContactsRes,
                responseTimeRes
            ] = await Promise.all([
                // Pendentes: Unread + Not discarded
                supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('is_unread', true).not('status', 'eq', 'discarded'),
                // Em Andamento: Not lead, not closed, not discarded
                supabase.from('contacts').select('*', { count: 'exact', head: true }).not('status', 'in', '("lead", "closed", "discarded")'),
                // Novos Contatos: Created today
                supabase.from('contacts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
                // Tempo Médio (Simple average of response_time_seconds from today)
                supabase.from('messages').select('response_time_seconds').eq('role', 'assistant').gte('created_at', today.toISOString()).not('response_time_seconds', 'is', null)
            ]);

            const responseTimes = responseTimeRes.data || [];
            const avgTime = responseTimes.length > 0
                ? responseTimes.reduce((acc, curr) => acc + (curr.response_time_seconds || 0), 0) / responseTimes.length
                : 0;

            const formatTime = (seconds: number) => {
                if (seconds < 60) return `${Math.round(seconds)}s`;
                return `${Math.round(seconds / 60)}m`;
            };

            return {
                pending: pendingRes.count || 0,
                inProgress: inProgressRes.count || 0,
                newContacts: newContactsRes.count || 0,
                avgResponseTime: formatTime(avgTime),
                health: { evolution: 'online', openai: 'online', webhook: 'online' }
            };
        },
        staleTime: 1000 * 60 // 1 minute
    });
};
