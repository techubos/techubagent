
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { toast } from 'sonner';

export const useStagnantLeads = () => {
    const queryClient = useQueryClient();

    const { data: stagnantLeads = [], isLoading, refetch } = useQuery({
        queryKey: ['stagnant-leads'],
        queryFn: async () => {
            const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('contacts')
                .select('id, name, phone, last_interaction_at, ai_followup_count')
                .lt('last_interaction_at', fortyEightHoursAgo)
                .in('status', ['lead', 'talking', 'opportunity'])
                .lt('ai_followup_count', 3)
                .limit(5);

            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 10 // 10 minutes
    });

    const recoverLeads = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('proactive-agent', {
                body: { action: 'daily_followup' }
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            const count = data.results?.length || 0;
            toast.success(`Recuperação concluída! ${count} leads abordados.`);
            queryClient.invalidateQueries({ queryKey: ['stagnant-leads'] });
        },
        onError: () => {
            toast.error("Falha ao iniciar recuperação.");
        }
    });

    return { stagnantLeads, isLoading, recoverLeads, refetch };
};
