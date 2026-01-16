import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { ComponentStatus, IncidentLog } from '../types';

export const useSystemHealth = () => {
    const queryClient = useQueryClient();

    const fetchHealthData = async () => {
        // 1. Get current status
        const { data: current, error: e1 } = await supabase
            .from('system_health')
            .select('*')
            .order('component', { ascending: true });

        if (e1) throw e1;

        // 2. Get last 24h logs for uptime calc
        const { data: logs, error: e2 } = await supabase
            .from('system_health_log')
            .select('component, status, response_time_ms, checked_at')
            .gte('checked_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (e2) throw e2;

        // 3. Get recent incidents (last 50 logs with error)
        const { data: incidents, error: e3 } = await supabase
            .from('system_health_log')
            .select('*')
            .not('status', 'eq', 'healthy')
            .order('checked_at', { ascending: false })
            .limit(20);

        if (e3) throw e3;


        // Calculate Uptime per component
        const statusWithUptime = (current || []).map((c: any) => {
            const compLogs = logs?.filter(l => l.component === c.component) || [];
            const healthyLogs = compLogs.filter(l => l.status === 'healthy').length;
            const uptime = compLogs.length > 0 ? (healthyLogs / compLogs.length) * 100 : 100;

            const lastLog = compLogs.sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];

            return {
                ...c,
                response_time_ms: lastLog?.response_time_ms || 0,
                uptime_24h: Number(uptime.toFixed(1))
            };
        });

        // 4. Get Job Queue Stats
        const { data: { user } } = await supabase.auth.getUser();
        const orgId = user?.app_metadata?.organization_id || user?.user_metadata?.organization_id;

        let jobStats = { pending: 0, completed: 0, failed: 0 };
        if (orgId) {
            const { data: stats } = await supabase.rpc('get_job_queue_stats', { p_org_id: orgId });
            if (stats) jobStats = stats;
        }

        return {
            components: statusWithUptime as ComponentStatus[],
            incidents: incidents as IncidentLog[],
            jobStats,
            lastUpdated: new Date().toISOString()
        };
    };

    const query = useQuery({
        queryKey: ['system-health'],
        queryFn: fetchHealthData,
        refetchInterval: 30000, // Fallback every 30s
    });

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel('system_health_changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'system_health' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['system-health'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return query;
};
