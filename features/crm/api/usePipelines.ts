import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CRMColumn } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { toast } from 'sonner';

const DEFAULT_COLUMNS: CRMColumn[] = [
    { id: 'lead', title: 'Novos Leads', color: 'border-l-blue-500' },
    { id: 'talking', title: 'Em Negociação', color: 'border-l-yellow-500' },
    { id: 'scheduled', title: 'Agendados', color: 'border-l-purple-500' },
    { id: 'client', title: 'Fechados (Won)', color: 'border-l-green-500' },
    { id: 'closed', title: 'Perdidos (Lost)', color: 'border-l-red-500' }
];

export const usePipelines = () => {
    const queryClient = useQueryClient();

    const { data: columns = DEFAULT_COLUMNS, isLoading } = useQuery({
        queryKey: ['crm-pipelines'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('crm_settings')
                .select('kanban_columns')
                .maybeSingle();

            if (error) {
                console.error('Error fetching pipeline settings:', error);
                throw error;
            }
            return (data?.kanban_columns as CRMColumn[]) || DEFAULT_COLUMNS;
        },
        staleTime: 1000 * 60 * 60, // 1 hour stale time (config rarely changes)
        gcTime: 1000 * 60 * 60 * 24 // 24 hours garbage collection
    });

    const mutation = useMutation({
        mutationFn: async (newColumns: CRMColumn[]) => {
            const { data: profile } = await supabase.from('profiles').select('organization_id').single();
            if (!profile) throw new Error("Profile not found");

            const { error } = await supabase.from('crm_settings').upsert({
                organization_id: profile.organization_id,
                kanban_columns: newColumns
            }, { onConflict: 'organization_id' });

            if (error) throw error;
        },
        onMutate: async (newColumns) => {
            // Optimistic Update
            await queryClient.cancelQueries({ queryKey: ['crm-pipelines'] });
            const previousColumns = queryClient.getQueryData(['crm-pipelines']);
            queryClient.setQueryData(['crm-pipelines'], newColumns);
            return { previousColumns };
        },
        onError: (err, newColumns, context) => {
            queryClient.setQueryData(['crm-pipelines'], context?.previousColumns);
            toast.error("Erro ao salvar colunas");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
        }
    });

    return {
        columns,
        setColumns: mutation.mutate,
        isLoading
    };
};
