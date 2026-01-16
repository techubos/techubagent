import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Beaker, TrendingUp, Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Experiment {
    id: string;
    name: string;
    type: 'prompt' | 'campaign';
    status: 'running' | 'completed' | 'draft';
    variant_a_content: string;
    variant_b_content: string;
    winner: 'A' | 'B' | null;
    start_at: string;
}

interface ExperimentStats {
    variant: 'A' | 'B';
    assignments: number;
    conversions: number; // Placeholder for now, could be 'messages sent back' or 'scheduled'
    conversionRate: number;
}

export const ABTestDashboard = () => {
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
    const [stats, setStats] = useState<ExperimentStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchExperiments();
    }, []);

    useEffect(() => {
        if (selectedExperiment) {
            fetchStats(selectedExperiment.id);
        }
    }, [selectedExperiment]);

    const fetchExperiments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('ab_experiments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching experiments:', error);
        else {
            setExperiments(data || []);
            if (data && data.length > 0) setSelectedExperiment(data[0]);
        }
        setLoading(false);
    };

    const fetchStats = async (experimentId: string) => {
        // In a real scenario, we would join with messages/events to calculate conversion.
        // For now, we'll just count assignments.
        const { data, error } = await supabase
            .from('ab_assignments')
            .select('variant');

        if (error) {
            console.error('Error fetching stats:', error);
            return;
        }

        const assignmentsA = data?.filter(a => a.variant === 'A').length || 0;
        const assignmentsB = data?.filter(a => a.variant === 'B').length || 0;

        // Mock conversion data for demo (randomized based on assignments)
        // In reality, this should come from a join with 'messages' or 'contacts' status changes
        const convA = Math.floor(assignmentsA * (0.1 + Math.random() * 0.1));
        const convB = Math.floor(assignmentsB * (0.1 + Math.random() * 0.15));

        setStats([
            { variant: 'A', assignments: assignmentsA, conversions: convA, conversionRate: assignmentsA > 0 ? (convA / assignmentsA) * 100 : 0 },
            { variant: 'B', assignments: assignmentsB, conversions: convB, conversionRate: assignmentsB > 0 ? (convB / assignmentsB) * 100 : 0 }
        ]);
    };

    const declareWinner = async (variant: 'A' | 'B') => {
        if (!selectedExperiment) return;

        const { error } = await supabase
            .from('ab_experiments')
            .update({ status: 'completed', winner: variant, ended_at: new Date().toISOString() })
            .eq('id', selectedExperiment.id);

        if (error) console.error('Error declaring winner:', error);
        else {
            fetchExperiments(); // Refresh
        }
    };

    if (loading && experiments.length === 0) return <div className="p-8 text-center text-zinc-500">Carregando experimentos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <Beaker className="text-primary" />
                    Experimentação (A/B)
                </h2>
                <div className="flex gap-2">
                    {/* Add Experiment Button would go here (handled by parent or CreateExperiment) */}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* LIST */}
                <div className="lg:col-span-1 border-r border-border pr-6 space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase">Experimentos</h3>
                    <div className="space-y-2">
                        {experiments.map(exp => (
                            <button
                                key={exp.id}
                                onClick={() => setSelectedExperiment(exp)}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${selectedExperiment?.id === exp.id
                                        ? 'bg-primary/10 border-primary/50 text-zinc-100'
                                        : 'bg-surface hover:bg-zinc-800 border-border text-zinc-400'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium truncate">{exp.name}</span>
                                    {exp.status === 'running' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                    {exp.status === 'completed' && <CheckCircle size={12} className="text-zinc-500" />}
                                </div>
                                <div className="text-xs opacity-60 flex gap-2">
                                    <span className="uppercase border px-1 rounded text-[10px]">{exp.type}</span>
                                    <span>{new Date(exp.start_at || Date.now()).toLocaleDateString()}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* DETAILS */}
                <div className="lg:col-span-3">
                    {selectedExperiment ? (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-zinc-100">{selectedExperiment.name}</h1>
                                    <p className="text-zinc-500 text-sm">ID: {selectedExperiment.id}</p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedExperiment.status === 'running' && (
                                        <>
                                            <button
                                                onClick={() => declareWinner('A')}
                                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm transition-colors border border-zinc-700"
                                            >
                                                Declarar A Vencedor
                                            </button>
                                            <button
                                                onClick={() => declareWinner('B')}
                                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm transition-colors border border-zinc-700"
                                            >
                                                Declarar B Vencedor
                                            </button>
                                        </>
                                    )}
                                    {selectedExperiment.status === 'completed' && (
                                        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg flex items-center gap-2">
                                            <CheckCircle size={16} />
                                            Vencedor Declarado: Variante {selectedExperiment.winner}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* METRICS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-surface p-6 rounded-xl border border-border flex flex-col items-center justify-center">
                                    <h4 className="text-zinc-400 text-sm font-medium mb-4">Taxa de Conversão</h4>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                                <XAxis dataKey="variant" stroke="#71717a" />
                                                <YAxis stroke="#71717a" unit="%" />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                                                    cursor={{ fill: '#27272a' }}
                                                />
                                                <Bar dataKey="conversionRate" name="Taxa Conv." fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {stats.map(stat => (
                                        <div key={stat.variant} className={`p-4 rounded-xl border ${selectedExperiment.winner === stat.variant ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border bg-surface'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <h5 className="font-bold text-lg text-zinc-100">Variante {stat.variant}</h5>
                                                {selectedExperiment.winner === stat.variant && <TrendingUp className="text-emerald-500" size={20} />}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-zinc-500">Total Usuários</p>
                                                    <p className="text-xl font-mono text-zinc-300">{stat.assignments}</p>
                                                </div>
                                                <div>
                                                    <p className="text-zinc-500">Conversões</p>
                                                    <p className="text-xl font-mono text-emerald-400">{stat.conversions}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-dashed border-zinc-700/50">
                                                <p className="text-xs text-zinc-500 mb-1">Conteúdo (Preview)</p>
                                                <p className="text-xs text-zinc-400 italic line-clamp-3">
                                                    {stat.variant === 'A' ? selectedExperiment.variant_a_content : selectedExperiment.variant_b_content}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 min-h-[400px]">
                            <Beaker className="w-16 h-16 opacity-20 mb-4" />
                            <p>Selecione um experimento para ver os detalhes</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
