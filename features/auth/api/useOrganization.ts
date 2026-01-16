import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../contexts/AuthProvider';

export const useOrganization = () => {
    const { session } = useAuth();

    return useQuery({
        queryKey: ['organization', session?.user?.id],
        queryFn: async () => {
            if (!session?.user) return null;

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id, organizations(name)')
                .eq('id', session.user.id)
                .single();

            if (profile?.organizations) {
                return (profile.organizations as any).name as string;
            }
            return 'TecHub';
        },
        enabled: !!session?.user,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};
