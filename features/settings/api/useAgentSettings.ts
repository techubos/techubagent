import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAgentSettings, saveAgentSettings } from '../../../services/settingsService';
import { AgentSettings } from '../../../types';
import { useAuth } from '../../../contexts/AuthProvider';

export const useAgentSettings = (initialSettings?: AgentSettings) => {
    const queryClient = useQueryClient();
    const { session } = useAuth();

    const query = useQuery({
        queryKey: ['agentSettings', session?.user?.id],
        queryFn: async () => {
            const settings = await fetchAgentSettings();
            return settings || initialSettings || null;
        },
        enabled: !!session?.user,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const mutation = useMutation({
        mutationFn: async (newSettings: AgentSettings) => {
            await saveAgentSettings(newSettings);
            return newSettings;
        },
        onSuccess: (newSettings) => {
            queryClient.setQueryData(['agentSettings', session?.user?.id], newSettings);
        },
    });

    return {
        settings: query.data,
        isLoading: query.isLoading,
        updateSettings: mutation.mutateAsync,
        isUpdating: mutation.isPending
    };
};
