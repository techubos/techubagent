import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Brain, Zap, Clock, Activity } from 'lucide-react';

interface PlaybookStats {
    name: string;
    count: number;
}

interface Activation {
    id: string;
    playbook_name: string;
    contact_id: string;
    confidence_score: number;
    activated_at: string;
    contacts: {
        phone: string;
        name: string;
    }
}

export const PlaybookAnalytics = () => {
    const [stats, setStats] = useState<PlaybookStats[]>([]);
    const [recentActivations, setRecentActivations] = useState<Activation[]>([]);
    const [loading, setLoading] = useState(true);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch Stats
            const { data: activations, error } = await supabase
                .from('playbook_activations')
                .select('playbook_name');

            if (error) throw error;

            const counts: { [key: string]: number } = {};
            activations?.forEach(a => {
                counts[a.playbook_name] = (counts[a.playbook_name] || 0) + 1;
            });

            const statsData = Object.keys(counts).map(key => ({
                name: key,
                count: counts[key]
            }));
            setStats(statsData);

            // Fetch Recent
            const { data: recent, error: recentError } = await supabase
                .from('playbook_activations')
                .select('*, contacts(name, phone)')
                .order('activated_at', { ascending: false })
                .limit(10);

            if (recentError) throw recentError;
            setRecentActivations(recent as any);

        } catch (error) {
            console.error('Error fetching playbook analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="p-8 text-center text-zinc-500 animate-pulse flex flex-col items-center">
            <Activity className="w-8 h-8 mb-2 animate-spin text-primary" />
            <p>Carregando inteligência...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 gap-6">
                {/* Chart */}
                <div className="glass-card p-8 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden group premium-border">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <div className="w-full flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                                <Brain size={16} />
                            </div>
                            Distribuição de Estratégias
                        </h3>
                    </div>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats as any}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="count"
                                    stroke="none"
                                >
                                    {stats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '0.5rem' }}
                                    itemStyle={{ color: '#e4e4e7' }}
                                />
                                {/* @ts-ignore */}
                                <Legend payload={
                                    stats.map((item, index) => ({
                                        id: item.name,
                                        type: 'circle',
                                        value: item.name,
                                        color: COLORS[index % COLORS.length]
                                    }))
                                } />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {stats.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-sm">
                            <p className="text-zinc-500 text-sm">Sem dados de playbooks ainda</p>
                        </div>
                    )}
                </div>

                {/* Recent Activations */}
                <div className="glass-card p-8 rounded-[2.5rem] flex flex-col relative overflow-hidden group premium-border">
                    <div className="absolute inset-0 bg-gradient-to-bl from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <h3 className="text-xs font-black text-zinc-400 mb-8 flex items-center gap-3 uppercase tracking-[0.3em]">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                            <Zap size={16} />
                        </div>
                        Ativações em Tempo Real
                    </h3>

                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {recentActivations.map((activation) => (
                            <div key={activation.id} className="bg-zinc-950/40 hover:bg-zinc-950 p-4 rounded-2xl border border-white/5 flex items-center justify-between transition-all group/item hover:border-primary/20 backdrop-blur-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                    <div>
                                        <div className="text-xs font-black text-white uppercase tracking-tight group-hover/item:text-primary transition-colors">
                                            {activation.playbook_name.replace('_', ' ')}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                                            {activation.contacts?.name || activation.contacts?.phone || 'Desconhecido'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] font-black text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20 uppercase tracking-widest mb-2 inline-block">
                                        {(activation.confidence_score * 100).toFixed(0)}% Match
                                    </div>
                                    <div className="text-[10px] text-zinc-600 flex items-center gap-1.5 justify-end font-medium">
                                        <Clock className="w-3 h-3" />
                                        {new Date(activation.activated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {recentActivations.length === 0 && (
                            <div className="text-center text-zinc-500 py-12 flex flex-col items-center">
                                <Brain className="w-8 h-8 opacity-20 mb-2" />
                                <p>Aguardando primeira detecção...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
