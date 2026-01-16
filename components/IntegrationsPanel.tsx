
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    Calendar,
    CheckCircle2,
    AlertCircle,
    RefreshCcw,
    ExternalLink,
    ShieldCheck,
    Activity,
    Trash2,
    MessageSquare,
    Power
} from 'lucide-react';

interface Integration {
    id: string;
    provider: string;
    active: boolean;
    metadata: any;
    created_at: string;
}

interface SyncLog {
    id: string;
    action: string;
    status: 'success' | 'error';
    details: any;
    created_at: string;
}

export const IntegrationsPanel: React.FC = () => {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [chatwootEnabled, setChatwootEnabled] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);

    useEffect(() => {
        fetchIntegrations();
        fetchLogs();
        fetchOrgSettings();
    }, []);

    const fetchOrgSettings = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Org via Profile (Corrected)
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if (profile?.organization_id) {
            setOrgId(profile.organization_id);
            const { data: org } = await supabase.from('organizations').select('chatwoot_enabled').eq('id', profile.organization_id).single();
            setChatwootEnabled(org?.chatwoot_enabled ?? true);
        }
    };

    const toggleChatwoot = async () => {
        if (!orgId) return;
        const newState = !chatwootEnabled;
        setLoading(true);
        try {
            const { error } = await supabase.from('organizations').update({ chatwoot_enabled: newState }).eq('id', orgId);
            if (error) throw error;
            setChatwootEnabled(newState);
        } catch (err: any) {
            alert('Erro ao atualizar Chatwoot: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchIntegrations = async () => {
        const { data } = await supabase.from('integrations').select('*');
        setIntegrations(data || []);
    };

    const fetchLogs = async () => {
        const { data } = await supabase
            .from('sync_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        setLogs(data || []);
    };

    const handleConnectGoogle = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('integrations-auth', {
                body: {},
                headers: {
                    // workaround for URL param routing in function
                    'x-route': 'connect'
                }
            });
            // Currently my function uses URL route, but invoke sends POST to root usually.
            // Let's adjust the function call to match the Edge Function routing.
            // Actually, standard invoke calls URL/v1/function-name. 
            // I implemented: `const route = url.pathname.split('/').pop()`
            // So I need to call `invoke('integrations-auth/connect')` ? No, invoke takes function name.
            // I will fix the Edge Function to read from a body param or header if the URL path isn't easy to change via invoke.
            // BUT, supabase.functions.invoke does NOT support changing the path suffix easily without custom fetch.
            // Let's assume I'll refactor the Edge Function to use `req.json().action` OR 
            // I'll leave it as is -> `return new Response(JSON.stringify({ url: authUrl ...` but I need to reach `/connect`.
            // Actually, simply:
            const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/integrations-auth/connect`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const resData = await response.json();
            if (resData.url) {
                window.location.href = resData.url;
            } else {
                alert('Erro ao gerar link de autenticação.');
            }

        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza? Isso desconectará a integração.')) return;
        await supabase.from('integrations').delete().eq('id', id);
        fetchIntegrations();
    }

    const googleIntegration = integrations.find(i => i.provider === 'google');
    const pipedriveIntegration = integrations.find(i => i.provider === 'pipedrive');

    const handleConnectPipedrive = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/integrations-auth/connect`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ provider: 'pipedrive' })
            });
            const resData = await response.json();
            if (resData.url) {
                window.location.href = resData.url;
            } else {
                alert('Erro ao gerar link de autenticação Pipedrive.');
            }
        } catch (e: any) {
            alert("Erro: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center gap-3 mb-6">
                <Activity className="text-primary" size={24} />
                <h2 className="text-2xl font-bold text-white">Integrações Nativas</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* GOOGLE CALENDAR CARD */}
                <div className="p-6 bg-surface border border-border rounded-xl flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 rounded-lg">
                                <Calendar className="text-blue-400" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">Google Calendar</h3>
                                <p className="text-sm text-zinc-400">Agendamento automático de reuniões.</p>
                            </div>
                        </div>
                        {googleIntegration ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold px-2 py-1 bg-emerald-400/10 rounded-full">
                                <CheckCircle2 size={12} /> CONECTADO
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-zinc-500 text-xs font-bold px-2 py-1 bg-zinc-800 rounded-full">
                                OFFLINE
                            </span>
                        )}
                    </div>

                    <div className="flex-1">
                        {googleIntegration && (
                            <div className="text-xs text-zinc-500 bg-zinc-900 p-3 rounded border border-zinc-800">
                                <p>ID: {googleIntegration.id}</p>
                                <p>Expira em: {new Date(googleIntegration.metadata?.expires_at || Date.now()).toLocaleDateString()}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-zinc-800 flex justify-between items-center">
                        {googleIntegration ? (
                            <button
                                onClick={() => handleDelete(googleIntegration.id)}
                                className="text-red-400 text-sm hover:underline flex items-center gap-1"
                            >
                                <Trash2 size={14} /> Desconectar
                            </button>
                        ) : (
                            <button
                                onClick={handleConnectGoogle}
                                disabled={loading}
                                className="px-4 py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 flex items-center gap-2 text-sm w-full justify-center"
                            >
                                {loading ? <RefreshCcw className="animate-spin" size={16} /> : <ExternalLink size={16} />}
                                Conectar Google
                            </button>
                        )}
                    </div>
                </div>

                {/* PIPEDRIVE CARD */}
                <div className="p-6 bg-surface border border-border rounded-xl flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 rounded-lg">
                                <ShieldCheck className="text-green-400" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">Pipedrive</h3>
                                <p className="text-sm text-zinc-400">Sincronização bidirecional de Leads.</p>
                            </div>
                        </div>
                        {pipedriveIntegration ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold px-2 py-1 bg-emerald-400/10 rounded-full">
                                <CheckCircle2 size={12} /> CONECTADO
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-zinc-500 text-xs font-bold px-2 py-1 bg-zinc-800 rounded-full">
                                OFFLINE
                            </span>
                        )}
                    </div>

                    <div className="flex-1">
                        {pipedriveIntegration && (
                            <div className="text-xs text-zinc-500 bg-zinc-900 p-3 rounded border border-zinc-800">
                                <p>ID: {pipedriveIntegration.id}</p>
                                <p>Expira em: {new Date(pipedriveIntegration.metadata?.expires_at || Date.now()).toLocaleDateString()}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-zinc-800 flex justify-between items-center">
                        {pipedriveIntegration ? (
                            <button
                                onClick={() => handleDelete(pipedriveIntegration.id)}
                                className="text-red-400 text-sm hover:underline flex items-center gap-1"
                            >
                                <Trash2 size={14} /> Desconectar
                            </button>
                        ) : (
                            <button
                                onClick={handleConnectPipedrive}
                                disabled={loading}
                                className="px-4 py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 flex items-center gap-2 text-sm w-full justify-center"
                            >
                                {loading ? <RefreshCcw className="animate-spin" size={16} /> : <ExternalLink size={16} />}
                                Conectar Pipedrive
                            </button>
                        )}
                    </div>
                </div>

                {/* CHATWOOT SYNC CARD (NEW) */}
                <div className="p-6 bg-surface border border-border rounded-xl flex flex-col gap-4 relative overflow-hidden">
                    {/* Glow effect for active state */}
                    {chatwootEnabled && <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -z-10 rounded-full" />}

                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-lg ${chatwootEnabled ? 'bg-blue-500/20' : 'bg-white/10'}`}>
                                <MessageSquare className={chatwootEnabled ? 'text-blue-400' : 'text-zinc-500'} size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">Sincronização Chatwoot</h3>
                                <p className="text-sm text-zinc-400">Espelhar mensagens para atendimento humano.</p>
                            </div>
                        </div>
                        {chatwootEnabled ? (
                            <span className="flex items-center gap-1 text-blue-400 text-xs font-bold px-2 py-1 bg-blue-400/10 rounded-full">
                                <CheckCircle2 size={12} /> ATIVO
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-zinc-500 text-xs font-bold px-2 py-1 bg-zinc-800 rounded-full">
                                PAUSADO
                            </span>
                        )}
                    </div>

                    <div className="flex-1">
                        <div className="text-xs text-zinc-500 bg-zinc-900 p-3 rounded border border-zinc-800">
                            {chatwootEnabled
                                ? "O sistema está enviando todas as mensagens para o Chatwoot. Desative se estiver enfrentando lentidão ou duplicidade."
                                : "A sincronização está desligada. As mensagens serão salvas apenas no CRM local."
                            }
                        </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-zinc-800 flex justify-between items-center">
                        <button
                            onClick={toggleChatwoot}
                            disabled={loading}
                            className={`px-4 py-2 font-bold rounded-lg flex items-center gap-2 text-sm w-full justify-center transition-all ${chatwootEnabled
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'bg-emerald-500 text-black hover:bg-emerald-400'
                                }`}
                        >
                            <Power size={16} />
                            {chatwootEnabled ? 'Desativar Sincronização' : 'Ativar Sincronização'}
                        </button>
                    </div>
                </div>
            </div>

            {/* SYNC LOGS */}
            <div className="mt-8">
                <h3 className="text-lg font-bold text-white mb-4">Histórico de Sincronização</h3>
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-zinc-400">
                        <thead className="bg-zinc-900 text-xs font-bold uppercase">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">Ação</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td className="p-4">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="p-4 font-medium text-white">{log.action}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs ${log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="p-4 max-w-xs truncate" title={JSON.stringify(log.details)}>
                                        {JSON.stringify(log.details)}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Nenhum registro encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
