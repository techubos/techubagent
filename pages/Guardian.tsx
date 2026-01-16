
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    ShieldAlert,
    Shield,
    Smartphone,
    Clock,
    UserCheck,
    Volume2,
    Save,
    Loader2,
    BellRing,
    Users
} from 'lucide-react';

interface GuardianConfig {
    agent_threshold_min: number;
    owner_threshold_min: number;
    escalation_enabled: boolean;
    owner_phone: string;
    owner_email: string;
    telegram_token: string;
    telegram_chat_id: string;
    remind_interval_1: number;
    remind_interval_2: number;
}

interface AgentProfile {
    id: string;
    full_name: string;
    personal_phone: string;
    is_online: boolean;
}

export const Guardian: React.FC = () => {
    const [config, setConfig] = useState<GuardianConfig | null>(null);
    const [agents, setAgents] = useState<AgentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: settingsData } = await supabase.from('settings').select('*').eq('key', 'sla_config').single();
        const { data: agentsData } = await supabase.from('profiles').select('id, full_name, personal_phone, is_online');

        if (settingsData) setConfig(settingsData.value);
        if (agentsData) setAgents(agentsData || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        await supabase.from('settings').upsert({
            key: 'sla_config',
            value: config,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        setSaving(false);
    };

    const testSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => alert('Som bloqueado pelo navegador. Interaja com a página primeiro.'));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Content */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white flex items-center gap-3">
                        <ShieldAlert className="text-primary" size={36} />
                        Painel do Guardião
                    </h1>
                    <p className="text-zinc-500 mt-2 font-medium">Controle total sobre SLAs, escalonamentos e notificações de urgência.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary hover:bg-primaryHover text-zinc-900 px-8 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    Salvar Configurações
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* SLA Configuration */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-surface border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Clock size={120} />
                        </div>

                        <h2 className="text-xl font-black text-white flex items-center gap-3 mb-8">
                            <Clock className="text-primary" size={24} />
                            Configurações de SLA
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">
                                    Aviso de Atraso (Agente)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={config?.agent_threshold_min || 5}
                                        onChange={(e) => setConfig(config ? { ...config, agent_threshold_min: parseInt(e.target.value) } : null)}
                                        className="w-full bg-zinc-900 border border-border rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">MIN</span>
                                </div>
                                <p className="text-[10px] text-zinc-600 px-1 italic">Notificação imediata para o agente via Zap.</p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">
                                    Escalonamento para Dono
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={config?.owner_threshold_min || 15}
                                        onChange={(e) => setConfig(config ? { ...config, owner_threshold_min: parseInt(e.target.value) } : null)}
                                        className="w-full bg-zinc-900 border border-border rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-primary font-bold">MIN</span>
                                </div>
                                <p className="text-[10px] text-zinc-600 px-1 italic">Acima desse tempo, o DONO recebe o alerta direto.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface border border-border rounded-3xl p-8 shadow-2xl relative group">
                        <h2 className="text-xl font-black text-white flex items-center gap-3 mb-8">
                            <BellRing className="text-primary" size={24} />
                            Canais de Alerta (Handoff)
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">
                                    Telegram Bot Token
                                </label>
                                <input
                                    type="password"
                                    placeholder="7841651260:AAFJ..."
                                    value={config?.telegram_token || ''}
                                    onChange={(e) => setConfig(config ? { ...config, telegram_token: e.target.value } : null)}
                                    className="w-full bg-zinc-900 border border-border rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">
                                    Telegram Chat ID
                                </label>
                                <input
                                    type="text"
                                    placeholder="5322277880"
                                    value={config?.telegram_chat_id || ''}
                                    onChange={(e) => setConfig(config ? { ...config, telegram_chat_id: e.target.value } : null)}
                                    className="w-full bg-zinc-900 border border-border rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">
                                    Email de Alerta
                                </label>
                                <input
                                    type="email"
                                    placeholder="techubos7l@gmail.com"
                                    value={config?.owner_email || ''}
                                    onChange={(e) => setConfig(config ? { ...config, owner_email: e.target.value } : null)}
                                    className="w-full bg-zinc-900 border border-border rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">
                                    WhatsApp do Dono
                                </label>
                                <input
                                    type="text"
                                    placeholder="5511999999999"
                                    value={config?.owner_phone || ''}
                                    onChange={(e) => setConfig(config ? { ...config, owner_phone: e.target.value } : null)}
                                    className="w-full bg-zinc-900 border border-border rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">
                                    1º Lembrete Persistente
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={config?.remind_interval_1 || 5}
                                        onChange={(e) => setConfig(config ? { ...config, remind_interval_1: parseInt(e.target.value) } : null)}
                                        className="w-full bg-zinc-900 border border-border rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">MIN</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">
                                    2º Lembrete Persistente
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={config?.remind_interval_2 || 15}
                                        onChange={(e) => setConfig(config ? { ...config, remind_interval_2: parseInt(e.target.value) } : null)}
                                        className="w-full bg-zinc-900 border border-border rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">MIN</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar / Quick Team Check */}
                <div className="space-y-6">
                    <div className="bg-surface border border-border rounded-3xl p-6 shadow-2xl">
                        <h2 className="text-sm font-black text-white flex items-center gap-2 mb-6 uppercase tracking-widest">
                            <Users className="text-primary" size={18} />
                            Status da Equipe
                        </h2>
                        <div className="space-y-4">
                            {agents.map(agent => (
                                <div key={agent.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/50 border border-border/50">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${agent.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                        <p className="text-xs font-bold text-white truncate">{agent.full_name}</p>
                                    </div>
                                    <div className={`p-1.5 rounded-lg border ${agent.personal_phone ? 'text-primary border-primary/20' : 'text-zinc-600 border-border'}`}>
                                        <Smartphone size={14} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 space-y-4">
                        <h2 className="text-sm font-black text-primary flex items-center gap-2 uppercase tracking-widest">
                            <Volume2 size={18} />
                            Alerta Sonoro
                        </h2>
                        <p className="text-[10px] text-zinc-400 font-medium">Teste o som de alerta crítico que tocará no navegador dos agentes.</p>
                        <button
                            onClick={testSound}
                            className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Testar Som de Alerta
                        </button>
                    </div>

                    <div className="bg-zinc-900 border border-border rounded-3xl p-6 space-y-4">
                        <h2 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest">
                            <Shield size={18} className="text-primary" />
                            Conexões Enterprise
                        </h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-emerald-500/20">
                                <span className="text-[10px] font-bold text-zinc-300">Instância Principal</span>
                                <span className="text-[9px] font-black text-emerald-500 uppercase">Online</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border/50 opacity-50">
                                <span className="text-[10px] font-bold text-zinc-300">Load Balancer (Proxy)</span>
                                <span className="text-[9px] font-black text-zinc-500 uppercase">Standby</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


