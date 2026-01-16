
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { toast } from 'sonner';

export interface Lead {
    id: string;
    name: string;
    phone: string;
    address: string;
    site: string;
    rating: number;
    reviewsCount: number;
    category: string;
    status: 'pending' | 'imported' | 'discarded';
    created_at: string;
    instagram?: string;
    facebook?: string;
    email?: string;
    state?: string;
    city?: string;
    website_summary?: string;
    ice_breaker?: string;
}

export const useLeads = () => {
    const queryClient = useQueryClient();

    const { data: leads = [], isLoading, error, refetch } = useQuery({
        queryKey: ['leads'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Lead[];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const importLead = useMutation({
        mutationFn: async (lead: Lead) => {
            // 1. Add to Contacts
            // Sanitized Category Tag
            const categoryTag = lead.category ? `niche:${lead.category.toLowerCase().replace(/\s+/g, '_')}` : 'niche:general';

            const { error: contactError } = await supabase.from('contacts').upsert({
                name: lead.name,
                phone: lead.phone?.replace(/\D/g, ''),
                notes: `Origem: Prospecção (Google Maps)\nEndereço: ${lead.address}\nInstagram: ${lead.instagram || 'N/A'}\nEmail: ${lead.email || 'N/A'}`,
                website: lead.site,
                status: 'lead',
                tags: ['prospeccao', categoryTag]
            }, { onConflict: 'phone' });

            if (contactError) throw contactError;

            // 2. Update Lead Status
            const { error } = await supabase
                .from('leads')
                .update({ status: 'imported' })
                .eq('id', lead.id);

            if (error) throw error;

            return lead;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            toast.success('Lead importado com sucesso!');
        },
        onError: (error: any) => {
            toast.error('Erro ao importar lead: ' + error.message);
        }
    });

    const discardLead = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('leads')
                .update({ status: 'discarded' })
                .eq('id', id);

            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            toast.success('Lead descartado.');
        },
        onError: (error: any) => {
            toast.error('Erro ao descartar lead: ' + error.message);
        }
    });

    return {
        leads,
        isLoading,
        error,
        importLead,
        discardLead,
        refetch
    };
};
