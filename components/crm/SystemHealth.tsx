
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Activity, AlertTriangle, MessageSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface HealthStats {
    pending_queue: number;
    dead_letter: number;
    ai_buffer: number;
    last_update: string;
}

export const SystemHealth: React.FC = () => {
    const [stats, setStats] = useState<HealthStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStats = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const orgId = user?.user_metadata?.organization_id;
            if (!orgId) return;

            const { data, error } = await supabase.rpc('get_system_stats', { org_uuid: orgId });
            if (error) throw error;
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch health stats:', err);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Pulse every 30s
        return () => clearInterval(interval);
    }, []);

    const handleRetryDLQ = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const orgId = user?.user_metadata?.organization_id;

            // Move items from DLQ back to Webhook Queue
            const { data: dlqItems } = await supabase.from('dead_letter_queue').select('*').eq('organization_id', orgId);

            if (!dlqItems || dlqItems.length === 0) {
                toast.info("Nenhuma mensagem na UTI para recuperar.");
                return;
            }

            for (const item of dlqItems) {
                await supabase.from('webhook_queue').insert({
                    payload: item.payload,
                    organization_id: orgId,
                    status: 'pending',
                    next_retry_at: new Date().toISOString()
                });
                await supabase.from('dead_letter_queue').delete().eq('id', item.id);
            }

            toast.success(`${dlqItems.length} mensagens movidas de volta para a fila!`);
            fetchStats();
        } catch (err) {
            toast.error("Erro ao recuperar mensagens.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!stats) return null;

    const hasErrors = stats.dead_letter > 0;

    return (
        <div className="flex items-center gap-4 bg-zinc-900/40 border border-white/5 rounded-2xl px-4 py-2 backdrop-blur-xl">
            {/* Queue Pulse */}
            <div className="flex items-center gap-2" title="Fila de Processamento">
                <Activity size={14} className={stats.pending_queue > 0 ? "text-primary animate-pulse" : "text-zinc-600"} />
                <span className="text-[10px] font-black text-zinc-400">{stats.pending_queue}</span>
            </div>

            {/* AI Buffer Status */}
            <div className="flex items-center gap-2" title="Mensagens em espera (IA Debounce)">
                <MessageSquare size={14} className={stats.ai_buffer > 0 ? "text-amber-500" : "text-zinc-600"} />
                <span className="text-[10px] font-black text-zinc-400">{stats.ai_buffer}</span>
            </div>

            {/* DLQ Status */}
            <div
                className={`flex items-center gap-2 cursor-pointer transition-all ${hasErrors ? "text-red-500 hover:scale-110" : "text-zinc-600 opacity-50"}`}
                onClick={hasErrors ? handleRetryDLQ : undefined}
                title={hasErrors ? "Clique para reprocessar mensagens na UTI" : "UTI Limpa"}
            >
                {isLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                ) : (
                    <AlertTriangle size={14} className={hasErrors ? "animate-bounce" : ""} />
                )}
                <span className="text-[10px] font-black">{stats.dead_letter}</span>
            </div>
        </div>
    );
};
