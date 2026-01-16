import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Users,
    Clock,
    AlertTriangle,
    Activity,
    MessageCircleOff,
    Wallet
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface ConversionMetricsProps {
    dateRange: {
        start: Date;
        end: Date;
    };
}

interface MetricsData {
    total_leads: number;
    replied: number;
    scheduled: number;
    closed: number;
    revenue: number;
    cost: number;
    total_messages: number;
}

export const ConversionMetrics: React.FC<ConversionMetricsProps> = ({ dateRange }) => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<MetricsData | null>(null);
    const [prevMetrics, setPrevMetrics] = useState<MetricsData | null>(null);
    const [evolutionStatus, setEvolutionStatus] = useState<boolean>(true); // Placeholder for actual check

    useEffect(() => {
        fetchMetrics();
    }, [dateRange]);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            // 1. Fetch Current Period
            const { data: current, error: errCurrent } = await supabase.rpc('get_conversion_metrics', {
                p_start_date: dateRange.start.toISOString(),
                p_end_date: dateRange.end.toISOString()
            });

            if (errCurrent) throw errCurrent;

            // 2. Fetch Previous Period (same duration)
            const duration = dateRange.end.getTime() - dateRange.start.getTime();
            const prevStart = new Date(dateRange.start.getTime() - duration);
            const prevEnd = new Date(dateRange.start);

            const { data: prev, error: errPrev } = await supabase.rpc('get_conversion_metrics', {
                p_start_date: prevStart.toISOString(),
                p_end_date: prevEnd.toISOString()
            });

            if (errPrev) throw errPrev;

            setMetrics(current);
            setPrevMetrics(prev);

            // Check Evolution Status (Mock check or simple fetch)
            // In a real scenario, we'd ping the instance status
            setEvolutionStatus(true);

        } catch (error) {
            console.error("Error fetching metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-zinc-800/50 rounded-xl"></div>
                ))}
            </div>
        );
    }

    if (!metrics) return null;

    // Calculations
    const conversionRate = metrics.total_leads > 0 ? ((metrics.closed / metrics.total_leads) * 100).toFixed(1) : '0.0';
    const prevConversionRate = prevMetrics && prevMetrics.total_leads > 0 ? ((prevMetrics.closed / prevMetrics.total_leads) * 100).toFixed(1) : '0.0';
    const conversionDiff = parseFloat(conversionRate) - parseFloat(prevConversionRate);

    const costPerLead = metrics.total_leads > 0 ? (metrics.cost / metrics.total_leads).toFixed(2) : '0.00';
    const roi = metrics.cost > 0 ? ((metrics.revenue - metrics.cost) / metrics.cost).toFixed(1) : '0.0'; // ROI multiplier (e.g. 5x)

    // Funnel Data
    const funnelData = [
        { name: 'Leads', value: metrics.total_leads, fill: '#60A5FA' }, // Blue
        { name: 'Responderam', value: metrics.replied, fill: '#818CF8' }, // Indigo
        { name: 'Agendaram', value: metrics.scheduled, fill: '#A78BFA' }, // Purple
        { name: 'Fecharam', value: metrics.closed, fill: '#34D399' }  // Emerald
    ];

    // Budget Alert (Mock threshold R$ 1000)
    const budgetThreshold = 1000;
    const isBudgetWarning = metrics.cost > budgetThreshold * 0.8;

    return (
        <div className="space-y-6">
            {/* ALERTS SECTION */}
            <div className="flex flex-wrap gap-4">
                {!evolutionStatus && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                        <MessageCircleOff size={14} /> WhatsApp Desconectado
                    </div>
                )}

                {isBudgetWarning && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                        <Wallet size={14} /> Atenção: Budget {((metrics.cost / budgetThreshold) * 100).toFixed(0)}% Utilizado
                    </div>
                )}

                {conversionDiff < -20 && (
                    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-500 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                        <TrendingDown size={14} /> Alerta: Conversão em Queda (-{Math.abs(conversionDiff).toFixed(1)}%)
                    </div>
                )}
            </div>

            {/* KPIS GRID */}
            <div className="grid grid-cols-2 gap-6">

                {/* CARD 1: Taxa de Conversão */}
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group premium-border hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                            <Activity size={20} />
                        </div>
                        {conversionDiff >= 0 ? (
                            <span className="flex items-center text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20">
                                <TrendingUp size={12} className="mr-1" /> +{conversionDiff.toFixed(1)}%
                            </span>
                        ) : (
                            <span className="flex items-center text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-1 rounded-full border border-red-500/20">
                                <TrendingDown size={12} className="mr-1" /> {conversionDiff.toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <div>
                        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1.5 opacity-70">Taxa de Conversão</p>
                        <h3 className="text-3xl font-black text-white tracking-tighter">{conversionRate}%</h3>
                        <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-tight">Vendas Diretas</p>
                    </div>
                </div>

                {/* CARD 2: Custo por Lead */}
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between group premium-border hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500 border border-purple-500/20">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1.5 opacity-70">Custo per Lead</p>
                        <h3 className="text-3xl font-black text-white tracking-tighter">R$ {costPerLead}</h3>
                        <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-tight">API Optimization</p>
                    </div>
                </div>

                {/* CARD 3: ROI */}
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between group premium-border hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/20">
                            <Wallet size={20} />
                        </div>
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Receita: R$ {metrics.revenue.toLocaleString()}</span>
                    </div>
                    <div>
                        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1.5 opacity-70">ROI Multiplier</p>
                        <h3 className="text-3xl font-black text-white tracking-tighter">{roi}x</h3>
                        <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-tight">Performance Líquida</p>
                    </div>
                </div>

                {/* CARD 4: Tempo Médio */}
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between group premium-border hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500 border border-orange-500/20">
                            <Clock size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1.5 opacity-70">Closing Time</p>
                        <h3 className="text-3xl font-black text-white tracking-tighter">4.2 dias</h3>
                        <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-tight">Velocity Score</p>
                    </div>
                </div>
            </div>

            {/* FUNIL VISUAL */}
            <div className="glass-card p-8 rounded-[2.5rem] premium-border">
                <h4 className="text-xs font-black text-zinc-400 mb-10 flex items-center gap-3 uppercase tracking-[0.3em]">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <Users size={16} />
                    </div>
                    Pipeline de Conversão Real
                </h4>

                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={funnelData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            barSize={32}
                        >
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#A1A1AA', fontSize: 12 }}
                                width={100}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#18181B', borderColor: '#27272A', color: '#F4F4F5' }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {funnelData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Stats row below funnel */}
                <div className="flex justify-between mt-4 px-4 pt-4 border-t border-zinc-800/50">
                    <div className="text-center">
                        <p className="text-zinc-500 text-xs">Taxa Resposta</p>
                        <p className="text-zinc-300 font-bold">{metrics.total_leads > 0 ? ((metrics.replied / metrics.total_leads) * 100).toFixed(0) : 0}%</p>
                    </div>
                    <div className="text-center">
                        <p className="text-zinc-500 text-xs">Agendamento</p>
                        <p className="text-zinc-300 font-bold">{metrics.replied > 0 ? ((metrics.scheduled / metrics.replied) * 100).toFixed(0) : 0}%</p>
                    </div>
                    <div className="text-center">
                        <p className="text-zinc-500 text-xs">Fechamento</p>
                        <p className="text-zinc-300 font-bold">{metrics.scheduled > 0 ? ((metrics.closed / metrics.scheduled) * 100).toFixed(0) : 0}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
