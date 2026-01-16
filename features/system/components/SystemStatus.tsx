
import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw, Server } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Type Definition (Local for now to avoid conflicts)
export interface SystemHealth {
    id: string;
    organization_id: string;
    component: 'evolution' | 'chatwoot' | 'webhook' | 'processor' | 'ai';
    status: 'healthy' | 'degraded' | 'down';
    last_success?: string;
    last_error?: string;
    error_count: number;
    updated_at: string;
}

const COMPONENT_NAMES: Record<string, string> = {
    evolution: 'Evolution API (WhatsApp)',
    chatwoot: 'Chatwoot (Atendimento)',
    webhook: 'Recepção (Webhook)',
    processor: 'Processamento (Core)',
    ai: 'Inteligência Artificial'
};

export const SystemStatus: React.FC = () => {
    const queryClient = useQueryClient();

    // 1. Fetch Health Data
    const fetchHealth = async (): Promise<SystemHealth[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('system_health')
            .select('*')
            .order('component');

        if (error) throw error;
        return data as SystemHealth[];
    };

    const { data: components = [], refetch, isLoading, isRefetching } = useQuery({
        queryKey: ['system_health'],
        queryFn: fetchHealth,
        refetchInterval: 10000, // 10s polling fallback
    });

    // 2. Realtime Updates
    useEffect(() => {
        const channel = supabase.channel('health_monitor')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'system_health' },
                () => { queryClient.invalidateQueries({ queryKey: ['system_health'] }); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    // 3. Logic: Status Calculation (Time-based override)
    const getStatusDisplay = (comp: SystemHealth) => {
        const lastUpdate = new Date(comp.updated_at).getTime();
        const now = Date.now();
        const minutesSince = (now - lastUpdate) / 1000 / 60;

        // Force 'down' if too old, regardless of DB status (Catch-22 detection)
        let effectiveStatus = comp.status;
        if (minutesSince > 15) effectiveStatus = 'down';
        else if (minutesSince > 5 && effectiveStatus === 'healthy') effectiveStatus = 'degraded';

        switch (effectiveStatus) {
            case 'healthy':
                return { color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500', icon: CheckCircle, label: 'Operacional' };
            case 'degraded':
                return { color: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500', icon: AlertTriangle, label: 'Instável' };
            case 'down':
                return { color: 'bg-red-500/10 border-red-500/20 text-red-500', icon: XCircle, label: 'Fora do Ar' };
            default:
                return { color: 'bg-slate-500/10 border-slate-500/20 text-slate-500', icon: Activity, label: 'Desconhecido' };
        }
    };

    const handleManualCheck = async () => {
        // Trigger recovery job as a "Ping" to check stuck queues, which updates health
        await supabase.functions.invoke('webhook-recovery');
        await refetch();
    };

    if (isLoading && components.length === 0) return <div className="p-4 text-center">Carregando status...</div>;

    return (
        <div className="w-full max-w-4xl mx-auto space-y-4 p-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Activity className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Status do Sistema</h2>
                </div>
                <button
                    onClick={handleManualCheck}
                    disabled={isRefetching}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-secondary/20 hover:bg-secondary/40 rounded-lg transition-colors text-secondary-foreground disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
                    {isRefetching ? 'Testando...' : 'Testar Agora'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {components.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                        Nenhum dado de saúde coletado ainda. O sistema irá gerar dados na primeira mensagem recebida.
                    </div>
                )}

                {components.map((comp) => {
                    const style = getStatusDisplay(comp);
                    const Icon = style.icon;

                    return (
                        <div key={comp.id} className={`p-4 rounded-xl border ${style.color} flex flex-col gap-3 transition-all hover:scale-[1.02] cursor-default`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-background/50 backdrop-blur-sm">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className="font-semibold text-foreground">{COMPONENT_NAMES[comp.component] || comp.component}</span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full bg-background/50 uppercase tracking-wide`}>
                                    {style.label}
                                </span>
                            </div>

                            <div className="space-y-1 mt-2">
                                <div className="flex justify-between text-xs opacity-80">
                                    <span>Última atualização:</span>
                                    <span className="font-mono">
                                        {formatDistanceToNow(new Date(comp.updated_at), { addSuffix: true, locale: ptBR })}
                                    </span>
                                </div>

                                {comp.last_success && (
                                    <div className="flex justify-between text-xs text-emerald-600/80">
                                        <span>Último sucesso:</span>
                                        <span className="font-mono">
                                            {formatDistanceToNow(new Date(comp.last_success), { addSuffix: true, locale: ptBR })}
                                        </span>
                                    </div>
                                )}

                                {comp.last_error && comp.status !== 'healthy' && (
                                    <div className="mt-2 text-xs bg-red-500/10 p-2 rounded text-red-600 border border-red-500/20">
                                        <strong>Erro:</strong> {comp.last_error}
                                        <div className="mt-1">Falhas seguidas: {comp.error_count}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
