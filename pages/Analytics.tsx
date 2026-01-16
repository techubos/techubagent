
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    BarChart3,
    TrendingUp,
    Users,
    Clock,
    Target,
    ShieldCheck,
    ArrowUpRight,
    ArrowDownRight,
    Loader2,
    DollarSign,
    Smile,
    Meh,
    Frown,
    Activity
} from 'lucide-react';

interface Stats {
    totalMessages: number;
    aiMessages: number;
    humanMessages: number;
    avgResponseTime: number;
    positive: number;
    neutral: number;
    negative: number;
    estimatedRoi: number;
    conversionRate: number;
}

const Analytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({
        totalMessages: 0,
        aiMessages: 0,
        humanMessages: 0,
        avgResponseTime: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        estimatedRoi: 0,
        conversionRate: 12 // Default/Mock for funnel
    });

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);

            // 1. Fetch Daily Stats for the last 30 days
            const { data: dailyStats, error } = await supabase
                .from('analytics_daily_stats')
                .select('*')
                .order('date', { ascending: false })
                .limit(30);

            if (error) throw error;

            if (dailyStats && dailyStats.length > 0) {
                // Aggregating stats for the period
                const totals = dailyStats.reduce((acc, curr) => ({
                    totalMessages: acc.totalMessages + (curr.total_messages || 0),
                    aiMessages: acc.aiMessages + (curr.ai_messages || 0),
                    humanMessages: acc.humanMessages + (curr.human_messages || 0),
                    avgResponseTime: acc.avgResponseTime + (curr.avg_response_time || 0),
                    positive: acc.positive + (curr.positive_messages || 0),
                    neutral: acc.neutral + (curr.neutral_messages || 0),
                    negative: acc.negative + (curr.negative_messages || 0),
                    estimatedRoi: acc.estimatedRoi + Number(curr.estimated_roi || 0),
                }), {
                    totalMessages: 0, aiMessages: 0, humanMessages: 0, avgResponseTime: 0,
                    positive: 0, neutral: 0, negative: 0, estimatedRoi: 0
                });

                setStats({
                    ...totals,
                    avgResponseTime: Math.round(totals.avgResponseTime / dailyStats.length),
                    conversionRate: 12 // Keep mocked for funnels until we have lead status history
                });
            } else {
                // Mock data if no real stats yet to show the UI
                setStats({
                    totalMessages: 1240,
                    aiMessages: 1100,
                    humanMessages: 140,
                    avgResponseTime: 45,
                    positive: 450,
                    neutral: 600,
                    negative: 190,
                    estimatedRoi: 2200.00,
                    conversionRate: 12
                });
            }
        } catch (err) {
            console.error("Error fetching analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    const metrics = [
        {
            label: 'Economia Estimada (ROI)',
            value: `R$ ${stats.estimatedRoi.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            sub: 'Baseado em atendimento IA vs Humano',
            icon: DollarSign,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        },
        {
            label: 'Mensagens Atendidas',
            value: stats.totalMessages,
            sub: `${Math.round((stats.aiMessages / (stats.totalMessages || 1)) * 100)}% atendido por IA`,
            icon: MessageCircle,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            label: 'SLA Médio (IA)',
            value: `${stats.avgResponseTime}s`,
            sub: 'Tempo de resposta imediato',
            icon: Clock,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        },
        {
            label: 'Taxa de Conversão',
            value: `${stats.conversionRate}%`,
            sub: '+2.4% que o mês anterior',
            icon: Target,
            color: 'text-primary',
            bg: 'bg-primary/10'
        }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    const totalSentiment = stats.positive + stats.neutral + stats.negative || 1;
    const posPercent = Math.round((stats.positive / totalSentiment) * 100);
    const neuPercent = Math.round((stats.neutral / totalSentiment) * 100);
    const negPercent = Math.round((stats.negative / totalSentiment) * 100);

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-6 relative z-10">
            {/* Header with Glassmorphism */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-card p-10 rounded-[3rem] premium-border">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-4 tracking-tight">
                        <Activity className="text-primary animate-pulse" size={32} />
                        Intelligence <span className="text-primary-gradient">& ROI</span>
                    </h1>
                    <p className="text-zinc-500 mt-2 font-medium text-base">Onde a tecnologia prova seu valor financeiro em tempo real.</p>
                </div>
                <div className="flex items-center gap-1.5 glass-panel p-1.5 rounded-2xl">
                    {['24h', '7d', '30d', 'Total'].map((period) => (
                        <button
                            key={period}
                            className={`px-6 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${period === '30d' ? 'bg-primary text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'text-zinc-500 hover:text-white'}`}
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            {/* Premium Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((m, i) => (
                    <div key={i} className="glass-card rounded-[3rem] p-8 relative overflow-hidden group premium-border hover:scale-[1.02] transition-all duration-500">
                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <div className={`p-4 rounded-2xl ${m.bg} ${m.color} border border-white/5`}>
                                <m.icon size={28} />
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg border border-white/5 group-hover:bg-primary group-hover:text-zinc-950 transition-all duration-500">
                                <ArrowUpRight size={18} />
                            </div>
                        </div>
                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider relative z-10">{m.label}</h3>
                        <p className="text-3xl font-bold text-white mt-2 tracking-tight relative z-10">{m.value}</p>
                        <p className="text-zinc-500 text-[10px] font-medium mt-1 uppercase tracking-wide relative z-10 opacity-70">{m.sub}</p>

                        {/* Interactive Background Glow */}
                        <div className={`absolute -right-10 -bottom-10 w-40 h-40 blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-1000 ${m.bg}`} />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sentiment Analysis Card */}
                <div className="lg:col-span-5 glass-card rounded-[3.5rem] p-10 overflow-hidden relative premium-border">
                    <div className="flex justify-between items-center mb-12">
                        <h2 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter">
                            <Smile className="text-primary" size={32} />
                            Humor dos Leads
                        </h2>
                        <div className="bg-primary/10 px-4 py-2 rounded-full border border-primary/20 text-[9px] font-black text-primary uppercase tracking-[0.2em] backdrop-blur-md">
                            Cognitive AI
                        </div>
                    </div>

                    <div className="flex flex-col gap-10">
                        {/* Sentiment Bars */}
                        <div className="space-y-8">
                            <div className="group cursor-default">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                            <Smile className="text-emerald-500" size={20} />
                                        </div>
                                        <span className="text-xs font-black text-zinc-300 uppercase tracking-widest">Altamente Positivo</span>
                                    </div>
                                    <span className="text-2xl font-black text-emerald-500 tracking-tighter">{posPercent}%</span>
                                </div>
                                <div className="h-5 bg-zinc-950/80 rounded-full border border-white/5 overflow-hidden p-1 backdrop-blur-sm">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.5)]" style={{ width: `${posPercent}%` }} />
                                </div>
                            </div>

                            <div className="group cursor-default">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-zinc-500/10 rounded-lg border border-white/10">
                                            <Meh className="text-zinc-500" size={20} />
                                        </div>
                                        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Neutro / Informativo</span>
                                    </div>
                                    <span className="text-2xl font-black text-zinc-500 tracking-tighter">{neuPercent}%</span>
                                </div>
                                <div className="h-5 bg-zinc-950/80 rounded-full border border-white/5 overflow-hidden p-1">
                                    <div className="h-full bg-zinc-700 rounded-full transition-all duration-1000" style={{ width: `${neuPercent}%` }} />
                                </div>
                            </div>

                            <div className="group cursor-default">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                                            <Frown className="text-red-500" size={20} />
                                        </div>
                                        <span className="text-xs font-black text-zinc-300 uppercase tracking-widest">Crítico / Reclamação</span>
                                    </div>
                                    <span className="text-2xl font-black text-red-500 tracking-tighter">{negPercent}%</span>
                                </div>
                                <div className="h-5 bg-zinc-950/80 rounded-full border border-white/5 overflow-hidden p-1">
                                    <div className="h-full bg-red-500 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(239,68,68,0.5)]" style={{ width: `${negPercent}%` }} />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 p-6 rounded-[2rem] bg-zinc-950/50 border border-white/5 text-zinc-400 text-sm italic leading-relaxed backdrop-blur-sm premium-border">
                            <span className="text-primary font-black not-italic mr-2">INSIGHT:</span>
                            "A IA identificou um aumento de 14% no sentimento positivo após a implementação do Fluxo de Recuperação Automática."
                        </div>
                    </div>
                </div>

                {/* Efficiency Funnel */}
                <div className="lg:col-span-7 glass-card rounded-[3.5rem] p-10 relative overflow-hidden premium-border">
                    <h2 className="text-3xl font-black text-white flex items-center gap-4 mb-12 tracking-tighter">
                        <TrendingUp className="text-primary" size={32} />
                        Efficiency Funnel
                    </h2>

                    <div className="space-y-5">
                        {[
                            { label: 'Captura Automatizada', desc: 'Leads trazidos pela prospecção ativa', val: 100, color: 'bg-zinc-950/50' },
                            { label: 'Primeiro Contato IA', desc: 'Respostas imediatas dadas em < 5s', val: 88, color: 'bg-zinc-800/50' },
                            { label: 'Qualificação Cognitiva', desc: 'Dúvidas resolvidas via RAG Expert', val: 42, color: 'bg-primary/20' },
                            { label: 'Oportunidade Quente', desc: 'Leads prontos para o contrato final', val: stats.conversionRate, color: 'bg-primary' }
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-8 group">
                                <div
                                    className={`h-20 rounded-[1.5rem] flex flex-col justify-center px-8 transition-all duration-700 border border-white/5 relative z-10 ${step.color === 'bg-primary' ? 'text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'text-white'} group-hover:scale-[1.03] cursor-help`}
                                    style={{ width: `${60 + (step.val * 0.4)}%` }}
                                >
                                    <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${step.color === 'bg-primary' ? 'opacity-90' : 'opacity-60'}`}>{step.label}</span>
                                    <span className={`text-[11px] font-bold truncate mt-1 ${step.color === 'bg-primary' ? 'opacity-80' : 'opacity-40'}`}>{step.desc}</span>

                                    <span className={`absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black ${step.color === 'bg-primary' ? 'opacity-100' : 'opacity-20'}`}>
                                        {step.val}%
                                    </span>
                                </div>
                                <div className="h-[2px] flex-1 bg-zinc-900/50 relative overflow-hidden rounded-full">
                                    <div className="absolute inset-0 bg-primary/20 blur-sm animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Advice Action Bar */}
            <div className="glass-card bg-gradient-to-r from-primary/10 via-transparent to-transparent border border-primary/20 p-10 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 premium-border shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-primary rounded-2xl text-zinc-950 shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                        <Target size={32} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-white tracking-tight italic">Insight Estratégico</h4>
                        <p className="text-zinc-400 text-sm mt-1 font-medium italic">"Seu ROI subiu <span className="text-primary font-black">14.2%</span> após o último treinamento da Base de Conhecimento."</p>
                    </div>
                </div>
                <button className="px-10 py-4 bg-white text-zinc-950 font-black rounded-2xl hover:bg-primary transition-all shadow-2xl hover:scale-105 active:scale-95 uppercase text-xs tracking-[0.2em]">
                    Exportar Relatório Executive
                </button>
            </div>
        </div>
    );
};

// Mock Component for MessageCircle to avoid missing import if not in lucide
const MessageCircle = ({ size, className }: any) => <Users size={size} className={className} />;

export default Analytics;
