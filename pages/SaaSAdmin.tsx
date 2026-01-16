import React, { useState, useEffect } from 'react';
import { Users, Building2, CreditCard, ShieldCheck, Search, Plus, Loader2, BarChart3, TrendingUp, AlertCircle, Settings, Bug, RefreshCcw, History, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export const SaaSAdmin: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [orgSettings, setOrgSettings] = useState<any>({});
    const [showModal, setShowModal] = useState(false);
    const [showConfigs, setShowConfigs] = useState<any>(null);
    const [showQueue, setShowQueue] = useState<any>(null);
    const [queueData, setQueueData] = useState<any[]>([]);
    const [newOrg, setNewOrg] = useState({ name: '', plan: 'standard' });
    const [isSaving, setIsSaving] = useState(false);
    const [stats, setStats] = useState({
        totalOrgs: 0,
        totalRevenue: 0,
        activeInstances: 0,
        totalMessages: 0
    });

    useEffect(() => {
        fetchSaaSData();
    }, []);

    const fetchSaaSData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Organizations with Settings
            const { data: orgs, error: orgError } = await supabase
                .from('organizations')
                .select('*, organization_settings(*)')
                .order('created_at', { ascending: false });

            if (orgError) throw orgError;
            setOrganizations(orgs || []);

            // 2. Fetch Global Stats (Simplified)
            const { count: orgCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
            const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
            const { data: usage } = await supabase.from('usage_logs').select('cost');

            const totalRevenue = usage?.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0) || 0;

            setStats({
                totalOrgs: orgCount || 0,
                totalRevenue: totalRevenue,
                activeInstances: 0,
                totalMessages: msgCount || 0
            });

        } catch (error) {
            console.error("Error loading SaaS data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrg = async () => {
        if (!newOrg.name) return;
        try {
            setIsSaving(true);
            const slug = newOrg.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

            const { data, error } = await supabase
                .from('organizations')
                .insert([{ name: newOrg.name, slug, plan: newOrg.plan }])
                .select();

            if (error) throw error;

            // Auto-create settings
            await supabase.from('organization_settings').insert([{ organization_id: data[0].id }]);

            setShowModal(false);
            setNewOrg({ name: '', plan: 'standard' });
            fetchSaaSData();
        } catch (error: any) {
            alert("Erro ao criar organização: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const fetchQueue = async (orgId: string) => {
        const { data } = await supabase
            .from('webhook_queue')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10);
        setQueueData(data || []);
    };

    const handleUpdateSettings = async (settings: any) => {
        try {
            setIsSaving(true);
            const { error } = await supabase
                .from('organization_settings')
                .upsert({ organization_id: showConfigs.id, ...settings });

            if (error) throw error;
            setShowConfigs(null);
            fetchSaaSData();
        } catch (error: any) {
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return (
        <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
        </div>
    );

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto">
            <div className="flex justify-between items-center bg-zinc-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-xl">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <ShieldCheck className="text-primary" /> Maestro SaaS Console
                    </h1>
                    <p className="text-zinc-500 text-sm">Gerenciamento global de parceiros e infraestrutura.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-primary text-black px-4 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                >
                    <Plus size={16} /> Novo Cliente
                </button>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Dinheiro', value: `R$ ${stats.totalRevenue.toLocaleString()}`, sub: '+12% este mês', icon: CreditCard, color: 'text-emerald-500' },
                    { label: 'Organizações', value: stats.totalOrgs, sub: 'Clientes Ativos', icon: Building2, color: 'text-primary' },
                    { label: 'Total Mensagens', value: stats.totalMessages.toLocaleString(), sub: 'Volume Global', icon: BarChart3, color: 'text-blue-500' },
                    { label: 'SLA Global', value: '99.9%', sub: 'Operação Estável', icon: TrendingUp, color: 'text-zinc-500' },
                ].map((stat, i) => (
                    <div key={i} className="bg-surface p-5 rounded-2xl border border-border group hover:border-primary/30 transition-all">
                        <div className="flex justify-between items-start mb-3">
                            <stat.icon className={stat.color} size={20} />
                            <span className="text-[10px] font-black uppercase text-zinc-600">Stats</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{stat.value}</h3>
                        <p className="text-xs text-zinc-500">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* ORGS TABLE */}
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex justify-between items-center bg-zinc-900/20">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Building2 size={16} /> Clientes Cadastrados
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                        <input
                            placeholder="Buscar empresa..."
                            className="bg-zinc-950 border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-primary/50"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border bg-zinc-900/10">
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase">Empresa / ID</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase">Plano / Status</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase">Criado em</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {organizations.map((org) => (
                                <tr key={org.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-xs font-bold text-primary border border-white/5">
                                                {org.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-zinc-200">{org.name}</p>
                                                <p className="text-[10px] text-zinc-600 font-mono">{org.id.split('-')[0]}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full uppercase border border-blue-500/20">
                                                {org.plan}
                                            </span>
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        </div>
                                    </td>
                                    <td className="p-4 text-xs text-zinc-500">
                                        {new Date(org.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-xs">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setShowConfigs(org)}
                                                className="text-zinc-500 hover:text-primary transition-colors flex items-center gap-1 font-bold"
                                            >
                                                <Settings size={14} /> Configs
                                            </button>
                                            <button
                                                onClick={() => { setShowQueue(org); fetchQueue(org.id); }}
                                                className="text-zinc-500 hover:text-blue-400 transition-colors flex items-center gap-1 font-bold"
                                            >
                                                <History size={14} /> Fila
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ALERTS / SYSTEM HEALTH */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                    <h4 className="text-xs font-black text-zinc-500 uppercase mb-4 flex items-center gap-2">
                        <AlertCircle className="text-orange-500" size={14} /> Alertas Críticos (Cross-Tenant)
                    </h4>
                    <div className="space-y-3">
                        <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-[10px] text-zinc-400">
                            Simulação: Nenhuma anomalia detectada em 15 instâncias ativas.
                        </div>
                    </div>
                </div>
                <div className="bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                    <h4 className="text-xs font-black text-zinc-500 uppercase mb-4 flex items-center gap-2">
                        💸 Top Consumption (Last 24h)
                    </h4>
                    <p className="text-[10px] text-zinc-600 italic">Módulo de billing sendo populado via usage_logs...</p>
                </div>
            </div>

            {/* CREATE ORG MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b border-border bg-zinc-900/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Building2 className="text-primary" size={20} /> Cadastrar Nova Empresa
                            </h3>
                            <p className="text-zinc-500 text-xs mt-1">Isolamento total e ambiente fresh para o novo parceiro.</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase mb-1.5 block">Nome da Empresa</label>
                                <input
                                    autoFocus
                                    className="w-full bg-zinc-950 border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                                    placeholder="Ex: TecHub Solutions"
                                    value={newOrg.name}
                                    onChange={e => setNewOrg({ ...newOrg, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase mb-1.5 block">Plano Inicial</label>
                                <select
                                    className="w-full bg-zinc-950 border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                                    value={newOrg.plan}
                                    onChange={e => setNewOrg({ ...newOrg, plan: e.target.value })}
                                >
                                    <option value="standard">Standard (Básico)</option>
                                    <option value="pro">Pro (Intermediário)</option>
                                    <option value="enterprise">Enterprise (Ilimitado)</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-6 pt-0 flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-2.5 bg-zinc-900 text-zinc-400 font-bold rounded-xl hover:bg-zinc-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateOrg}
                                disabled={isSaving || !newOrg.name}
                                className="flex-1 px-4 py-2.5 bg-primary text-black font-black rounded-xl hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Criar Empresa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIGS MODAL */}
            {showConfigs && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-border bg-zinc-900/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Settings className="text-primary" size={20} /> Ajustes Administrativos
                                </h3>
                                <p className="text-zinc-500 text-xs mt-1">{showConfigs.name}</p>
                            </div>
                            <button onClick={() => setShowConfigs(null)} className="text-zinc-500 hover:text-white p-2">×</button>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-1.5 block">Modelo de IA Preferencial</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-border rounded-xl px-4 py-2 text-sm text-white"
                                        value={showConfigs.organization_settings?.[0]?.ai_model || 'gpt-4o-mini'}
                                        onChange={(e) => setOrgSettings({ ...orgSettings, ai_model: e.target.value })}
                                    >
                                        <option value="gpt-4o-mini">GPT-4o Mini (Custo-Benefício)</option>
                                        <option value="gpt-4o">GPT-4o (Alta Complexidade)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-1.5 block">Limite de Retentativas</label>
                                    <input
                                        type="number"
                                        className="w-full bg-zinc-950 border border-border rounded-xl px-4 py-2 text-sm text-white"
                                        defaultValue={showConfigs.organization_settings?.[0]?.webhook_retry_limit || 3}
                                        onChange={(e) => setOrgSettings({ ...orgSettings, webhook_retry_limit: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                    <h4 className="text-[10px] font-black text-primary uppercase mb-2">Plano & Cotas</h4>
                                    <p className="text-xs text-zinc-400">Status do Plano: <span className="text-white font-bold uppercase">{showConfigs.plan}</span></p>
                                    <div className="w-full h-1 bg-zinc-800 rounded-full mt-2">
                                        <div className="w-[100%] h-full bg-primary rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border flex gap-3">
                            <button
                                onClick={() => handleUpdateSettings(orgSettings)}
                                disabled={isSaving}
                                className="flex-1 px-4 py-2 bg-primary text-black font-black rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar Configurações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QUEUE MONITOR MODAL */}
            {showQueue && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-border bg-zinc-900/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Bug className="text-blue-400" size={20} /> Monitor de Estabilidade (Fila)
                                </h3>
                                <p className="text-zinc-500 text-xs mt-1">Status em tempo real do processamento de webhooks.</p>
                            </div>
                            <button onClick={() => setShowQueue(null)} className="text-zinc-500 hover:text-white p-2">×</button>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto">
                            <table className="w-full text-left text-[11px]">
                                <thead>
                                    <tr className="text-zinc-500 border-b border-border font-black uppercase">
                                        <th className="p-2">Status</th>
                                        <th className="p-2">Data</th>
                                        <th className="p-2">Retry</th>
                                        <th className="p-2">Erro</th>
                                        <th className="p-2">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queueData.map(item => (
                                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="p-2">
                                                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    item.status === 'error' ? 'bg-red-500/10 text-red-500' :
                                                        'bg-blue-500/10 text-blue-500'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="p-2 text-zinc-500 font-mono">{new Date(item.created_at).toLocaleTimeString()}</td>
                                            <td className="p-2 font-bold text-zinc-300">{item.retry_count || 0}</td>
                                            <td className="p-2 text-zinc-400 truncate max-w-[150px]">{item.last_error || '-'}</td>
                                            <td className="p-2">
                                                <button className="p-1 hover:text-primary transition-colors">
                                                    <RefreshCcw size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
