
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    Zap,
    ShieldCheck,
    Clock,
    Users,
    MessageSquare,
    Play,
    AlertCircle,
    CheckCircle,
    Loader2,
    Settings,
    Eye,
    Trash2,
    Brain,
    Calendar,
    ArrowRight,
    Globe
} from 'lucide-react';

interface ProspectingConfig {
    daily_limit: number;
    current_day_count: number;
    start_time: string;
    end_time: string;
}

interface QueueItem {
    id: string;
    contact: {
        name: string;
        phone: string;
    };
    message: string;
    status: 'pending' | 'processing' | 'sent' | 'failed';
    scheduled_at: string;
    error_log?: string;
}

export const ProspectingCampaigns = () => {
    const [config, setConfig] = useState<ProspectingConfig | null>(null);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [baseScript, setBaseScript] = useState('');
    const [deepEnrich, setDeepEnrich] = useState(false);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Safety Settings State
    const [showSafetyModal, setShowSafetyModal] = useState(false);
    const [safetyConfig, setSafetyConfig] = useState({
        daily_limit: 50,
        min_delay_seconds: 180,
        jitter_seconds: 120
    });

    // New state for sequences
    const [sequences, setSequences] = useState<any[]>([]);
    const [radarCampaigns, setRadarCampaigns] = useState<any[]>([]);
    const [isPulsing, setIsPulsing] = useState(false);

    useEffect(() => {
        fetchData();
        const subscription = supabase
            .channel('prospecting_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prospecting_queue' }, () => {
                fetchQueue();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prospecting_config' }, (payload) => {
                setConfig(payload.new as ProspectingConfig);
            })
            .subscribe();

        // Simulated Cron (Tick Every 1 min while open)
        const tickInterval = setInterval(() => {
            supabase.functions.invoke('prospecting-dispatcher', { body: { action: 'tick' } });
        }, 60000);

        return () => {
            supabase.removeChannel(subscription);
            clearInterval(tickInterval);
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchConfig(),
                fetchQueue(),
                fetchLeadsByTag(),
                fetchSequencesList(),
                fetchMetrics(),
                fetchRadarCampaigns()
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fetchRadarCampaigns = async () => {
        const { data } = await supabase
            .from('prospecting_campaigns')
            .select('*')
            .eq('is_radar', true)
            .order('last_run_at', { ascending: false });
        if (data) setRadarCampaigns(data);
    };

    const handleTriggerPulse = async () => {
        setIsPulsing(true);
        try {
            await supabase.functions.invoke('prospecting-orchestrator', { body: { action: 'pulse' } });
            await fetchRadarCampaigns();
        } finally {
            setIsPulsing(false);
        }
    };

    const fetchConfig = async () => {
        const { data } = await supabase.from('prospecting_config').select('*').single();
        if (data) setConfig(data);
    };

    const fetchQueue = async () => {
        const { data } = await supabase
            .from('prospecting_queue')
            .select(`
                *,
                contact:contacts(name, phone)
            `)
            .order('scheduled_at', { ascending: true })
            .limit(50);
        if (data) setQueue(data);
    };

    const [metrics, setMetrics] = useState({
        totalLeads: 0,
        activeSequences: 0,
        completedSequences: 0
    });

    const fetchMetrics = async () => {
        const { count: leadsCount } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .contains('tags', ['prospeccao']);

        const { count: activeCount } = await supabase
            .from('contact_sequences')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        const { count: completedCount } = await supabase
            .from('contact_sequences')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed');

        setMetrics({
            totalLeads: leadsCount || 0,
            activeSequences: activeCount || 0,
            completedSequences: completedCount || 0
        });
    };

    const fetchLeadsByTag = async () => {
        const { data } = await supabase
            .from('contacts')
            .select('*')
            .contains('tags', ['prospeccao'])
            .order('created_at', { ascending: false });
        if (data) setLeads(data || []);
    };

    const fetchSequencesList = async () => {
        const { data } = await supabase.from('sequences').select('*').eq('is_active', true);
        if (data) setSequences(data);
    };

    const handleCreateCampaign = async () => {
        if (selectedLeads.length === 0 || !baseScript) {
            setError("Selecione os contatos e escreva o script base.");
            return;
        }

        setGenerating(true);
        setError(null);
        try {
            const { data, error: invError } = await supabase.functions.invoke('prospecting-dispatcher', {
                body: {
                    action: 'start_sequence', // Changed from 'generate'
                    payload: {
                        contactIds: selectedLeads,
                        sequenceId: baseScript, // reusing baseScript state which now holds the ID
                        deepEnrich
                    }
                }
            });

            if (invError) throw invError;
            if (data.error) throw new Error(data.error);

            setSelectedLeads([]);
            setBaseScript('');
            fetchQueue();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveSafetyConfig = async () => {
        try {
            const { error: saveError } = await supabase
                .from('prospecting_config')
                .update(safetyConfig)
                .eq('id', (config as any)?.id || 'default');

            if (saveError) throw saveError;
            setConfig({ ...config, ...safetyConfig } as any);
            setShowSafetyModal(false);
            alert("Configurações de segurança salvas com sucesso!");
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        }
    };

    const clearQueue = async () => {
        if (!confirm("Isso removerá todas as mensagens agendadas. Continuar?")) return;
        await supabase.from('prospecting_queue').delete().eq('status', 'pending');
        fetchQueue();
    };

    const toggleLead = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header with Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-border p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Zap size={60} className="text-primary" />
                    </div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Limite Diário</p>
                    <div className="flex items-end gap-3">
                        <h2 className="text-4xl font-black text-white">{config?.current_day_count || 0} <span className="text-zinc-500 text-lg font-medium">/ {config?.daily_limit || 50}</span></h2>
                        <div className="mb-2 h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex-1">
                            <div
                                className="h-full bg-primary"
                                style={{ width: `${((config?.current_day_count || 0) / (config?.daily_limit || 50)) * 100}%` }}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-3 font-bold flex items-center gap-1">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        PROTEÇÃO ANTI-BAN ATIVA
                    </p>
                </div>

                <div className="bg-surface border border-border p-6 rounded-3xl relative overflow-hidden">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Aguardando Envio</p>
                    <div className="flex items-center gap-3">
                        <h2 className="text-4xl font-black text-white">{queue.filter(i => i.status === 'pending').length}</h2>
                        <p className="text-zinc-500 text-sm font-medium">Contatos na fila</p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-3xl relative overflow-hidden">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Intervalo de Segurança</p>
                    <div className="flex items-center gap-2">
                        <Clock size={20} className="text-primary" />
                        <h2 className="text-xl font-black text-white">3 a 5 MINUTOS</h2>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Aleatório para simular comportamento humano</p>
                </div>
            </div>

            {/* Funnel Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-border p-6 rounded-3xl flex items-center gap-4">
                    <div className="p-4 bg-blue-500/10 text-blue-500 rounded-2xl">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Leads em Prospecção</p>
                        <p className="text-3xl font-black text-white">{metrics.totalLeads}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border p-6 rounded-3xl flex items-center gap-4">
                    <div className="p-4 bg-primary/10 text-primary rounded-2xl">
                        <Zap size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Sequências Ativas</p>
                        <p className="text-3xl font-black text-white">{metrics.activeSequences}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border p-6 rounded-3xl flex items-center gap-4">
                    <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Concluídos</p>
                        <p className="text-3xl font-black text-white">{metrics.completedSequences}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Campaign Creation */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-surface border border-border p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Zap size={100} />
                        </div>

                        <div className="relative z-10 space-y-6">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                    <Play size={20} className="text-primary" />
                                    Iniciar Nova Campanha
                                </h3>
                                <p className="text-zinc-400 text-sm">Selecione os leads importados e a sequência para iniciar.</p>
                            </div>

                            {/* Lead Selector Info */}
                            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                                <p className="text-sm font-bold text-zinc-300 flex justify-between">
                                    <span>Leads Selecionados (via Mineração):</span>
                                    <span className="text-primary">{metrics.totalLeads} disponíveis</span>
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">Para selecionar leads específicos, vá na aba "Mineração".</p>
                            </div>

                            {/* Sequence Selector */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Sequência de Abordagem</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {sequences.map(seq => (
                                        <div
                                            key={seq.id}
                                            onClick={() => setBaseScript(seq.id)}
                                            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${baseScript === seq.id
                                                ? 'bg-primary/10 border-primary text-white ring-1 ring-primary'
                                                : 'bg-zinc-900 border-border text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800'
                                                }`}
                                        >
                                            <div className={`w-3 h-3 rounded-full ${baseScript === seq.id ? 'bg-primary' : 'bg-zinc-700'}`} />
                                            <div>
                                                <p className="font-bold text-sm">{seq.name}</p>
                                                <p className="text-[10px] opacity-70">{seq.steps?.length || 0} etapas</p>
                                            </div>
                                        </div>
                                    ))}
                                    {sequences.length === 0 && (
                                        <div className="col-span-full p-4 text-center text-zinc-500 text-xs italic">
                                            Nenhuma sequência ativa. Crie uma na aba "Sequências".
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Deep Enrich Toggle */}
                            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-border cursor-pointer group hover:border-zinc-700 transition-all"
                                onClick={() => setDeepEnrich(!deepEnrich)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl transition-colors ${deepEnrich ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                                        <Brain size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">Personalização Profunda (Web Scraping)</p>
                                        <p className="text-[10px] text-zinc-500">A IA visitará o site do lead para personalizar a mensagem.</p>
                                    </div>
                                </div>
                                <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${deepEnrich ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${deepEnrich ? 'left-7' : 'left-1'}`} />
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3 text-sm">
                                    <AlertCircle size={18} />
                                    {error}
                                </div>
                            )}

                            <button
                                disabled={generating || metrics.totalLeads === 0}
                                onClick={handleCreateCampaign}
                                className="w-full py-5 bg-primary-gradient text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all transform active:scale-95 disabled:grayscale hover:opacity-90"
                            >
                                {generating ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />}
                                {generating ? 'INICIANDO CAMPANHA...' : 'LANÇAR CAMPANHA SEGURA'}
                            </button>
                        </div>
                    </div>

                    {/* Left: Dispatch Monitor */}
                    <div className="bg-surface border border-border rounded-3xl shadow-xl overflow-hidden flex flex-col h-[500px]">
                        <div className="p-6 bg-zinc-900/50 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Calendar size={20} className="text-primary" />
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">Fila de Disparo</h2>
                            </div>
                            <button
                                onClick={clearQueue}
                                className="text-zinc-500 hover:text-red-500 transition-colors p-2"
                                title="Limpar Fila"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {queue.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-30">
                                    <MessageSquare size={60} />
                                    <p className="text-xs font-bold uppercase tracking-widest">Nenhuma mensagem na fila</p>
                                </div>
                            ) : (
                                queue.map(item => (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-2xl border transition-all ${item.status === 'sent' ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' :
                                            item.status === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                                                'bg-zinc-900 border-border shadow-sm'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${item.status === 'sent' ? 'bg-emerald-500' :
                                                    item.status === 'failed' ? 'bg-red-500' :
                                                        item.status === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-primary'
                                                    }`} />
                                                <span className="text-white font-bold text-xs">{item.contact?.name || 'Lead'}</span>
                                            </div>
                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                                                {new Date(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-zinc-400 line-clamp-2 italic">"{item.message}"</p>

                                        {item.status === 'failed' && item.error_log && (
                                            <p className="text-[9px] text-red-500 mt-2 font-mono truncate">{item.error_log}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 bg-zinc-900/80 border-t border-border mt-auto">
                            <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Monitoramento Ativo
                                </div>
                                <button
                                    onClick={handleTriggerPulse}
                                    disabled={isPulsing}
                                    className="hover:text-primary transition-colors flex items-center gap-1"
                                >
                                    {isPulsing ? <Loader2 className="animate-spin" size={10} /> : <Zap size={10} />}
                                    FORÇAR PULSO RADAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Radar Monitor */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-surface border border-border rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Globe size={18} className="text-primary" />
                                Radar de Prospecção (IA)
                            </h3>
                            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">RECORRENTE</span>
                        </div>

                        <div className="space-y-4">
                            {radarCampaigns.length === 0 ? (
                                <div className="p-8 text-center bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
                                    <p className="text-xs text-zinc-500">Nenhum radar configurado. Transforme uma campanha em radar para buscar leads diariamente.</p>
                                </div>
                            ) : (
                                radarCampaigns.map(radar => (
                                    <div key={radar.id} className="p-4 bg-zinc-900/50 rounded-2xl border border-border group hover:border-primary/30 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-sm font-bold text-zinc-200">{radar.name}</p>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${radar.status === 'running' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-emerald-500/10 text-emerald-500'
                                                }`}>
                                                {radar.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                            <span className="flex items-center gap-1"><Clock size={10} /> 24h</span>
                                            <span>Última: {radar.last_run_at ? new Date(radar.last_run_at).toLocaleDateString() : 'Nunca'}</span>
                                            <span className="text-primary">+{radar.valid_leads || 0} leads</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 p-8 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-20 text-primary">
                            <ShieldCheck size={120} />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-4">Modo Seguro 3.0</h3>
                        <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                            Seu sistema agora conta com <strong>Blindagem Anti-Ban</strong>. As mensagens serão enviadas com intervalos humanizados e respeitando o limite diário que você configurar.
                        </p>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <CheckCircle size={16} className="text-emerald-500" />
                                Limite Diário Ativo
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <CheckCircle size={16} className="text-emerald-500" />
                                Variância de Tempo (Jitter)
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <CheckCircle size={16} className="text-emerald-500" />
                                Smart Queueing
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Safety Settings Modal */}
            {showSafetyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-surface w-full max-w-lg rounded-3xl border border-zinc-800 p-8 shadow-2xl relative">
                        <button
                            onClick={() => setShowSafetyModal(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                        >
                            <Trash2 className="rotate-45" size={24} />
                        </button>

                        <div className="mb-8 text-center">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-white">Configuração de Blindagem</h2>
                            <p className="text-zinc-400 text-sm mt-2">Defina os limites de segurança para evitar bloqueios do WhatsApp.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="flex justify-between text-sm font-bold text-zinc-300">
                                    <span>Limite Diário de Envios</span>
                                    <span className="text-primary">{safetyConfig.daily_limit} msgs/dia</span>
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="500"
                                    step="10"
                                    value={safetyConfig.daily_limit}
                                    onChange={(e) => setSafetyConfig({ ...safetyConfig, daily_limit: parseInt(e.target.value) })}
                                    className="w-full accent-primary h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <p className="text-[10px] text-zinc-500">Recomendado: 50-100 para contas novas.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex justify-between text-sm font-bold text-zinc-300">
                                    <span>Intervalo Mínimo (Delay)</span>
                                    <span className="text-emerald-400">{safetyConfig.min_delay_seconds} segundos</span>
                                </label>
                                <input
                                    type="range"
                                    min="30"
                                    max="600"
                                    step="30"
                                    value={safetyConfig.min_delay_seconds}
                                    onChange={(e) => setSafetyConfig({ ...safetyConfig, min_delay_seconds: parseInt(e.target.value) })}
                                    className="w-full accent-emerald-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <p className="text-[10px] text-zinc-500">Tempo mínimo de espera entre uma mensagem e outra.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex justify-between text-sm font-bold text-zinc-300">
                                    <span>Variância Humana (Jitter)</span>
                                    <span className="text-purple-400">+/- {safetyConfig.jitter_seconds} segundos</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="300"
                                    step="10"
                                    value={safetyConfig.jitter_seconds}
                                    onChange={(e) => setSafetyConfig({ ...safetyConfig, jitter_seconds: parseInt(e.target.value) })}
                                    className="w-full accent-purple-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <p className="text-[10px] text-zinc-500">Adiciona aleatoriedade para evitar padrões de robô.</p>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-zinc-800 flex gap-4">
                            <button
                                onClick={() => setShowSafetyModal(false)}
                                className="flex-1 py-3 text-zinc-400 font-bold hover:bg-zinc-800 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveSafetyConfig}
                                className="flex-1 py-3 bg-emerald-500 text-black font-black rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                <ShieldCheck size={18} />
                                Salvar Blindagem
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>

    );
};

