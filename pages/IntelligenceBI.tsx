import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    BarChart3,
    TrendingUp,
    Users,
    Target,
    ArrowDownWideNarrow,
    DollarSign,
    Percent,
    Loader2,
    Filter,
    Calendar,
    ChevronDown,
    Zap,
    Briefcase
} from 'lucide-react';

interface FunnelStep {
    node_id: string;
    node_type: string;
    node_name: string;
    enter_count: number;
    exit_count: number;
    drop_off_rate: number;
}

interface ROIMetrics {
    total_leads: number;
    avg_score: number;
    estimated_pipeline: number;
    top_department: string;
}

export const IntelligenceBI: React.FC = () => {
    const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([]);
    const [roi, setRoi] = useState<ROIMetrics | null>(null);
    const [flows, setFlows] = useState<any[]>([]);
    const [selectedFlowId, setSelectedFlowId] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedFlowId) {
            fetchFunnelData(selectedFlowId);
        }
    }, [selectedFlowId]);

    const fetchInitialData = async () => {
        setLoading(true);
        const { data: flowsData } = await supabase.from('flows').select('id, name').limit(10);
        setFlows(flowsData || []);

        if (flowsData?.length) {
            setSelectedFlowId(flowsData[0].id);
        }

        const { data: roiData, error } = await supabase.rpc('get_conversion_roi');
        if (roiData?.[0]) setRoi(roiData[0]);

        setLoading(false);
    };

    const fetchFunnelData = async (flowId: string) => {
        const { data, error } = await supabase.rpc('get_funnel_stats', { target_flow_id: flowId });
        setFunnelSteps(data || []);
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="font-black text-xs uppercase tracking-widest">Calculando Inteligência...</p>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/20 rounded-xl border border-primary/30">
                            <BarChart3 className="text-primary" size={24} />
                        </div>
                        <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Inteligência BI</h1>
                    </div>
                    <p className="text-zinc-500 font-medium">Análise em tempo real de conversão e pipeline financeiro.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-surface border border-border p-1 rounded-2xl flex items-center lg:w-64">
                        <Filter className="ml-3 text-zinc-500" size={16} />
                        <select
                            value={selectedFlowId}
                            onChange={(e) => setSelectedFlowId(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-white px-3 py-2 outline-none w-full"
                        >
                            {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <button className="p-3 bg-surface border border-border rounded-2xl text-zinc-400 hover:text-white transition-all">
                        <Calendar size={20} />
                    </button>
                    <button className="px-6 py-3 bg-primary text-zinc-900 rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
                        <Zap size={18} /> RELATÓRIO PDF
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Pipeline Estimado"
                    value={`R$ ${(roi?.estimated_pipeline || 0).toLocaleString()}`}
                    icon={<DollarSign size={20} />}
                    trend="+12%"
                    color="text-emerald-500"
                    bgColor="bg-emerald-500/10"
                />
                <KPICard
                    title="Lead Score Médio"
                    value={Math.round(roi?.avg_score || 0).toString()}
                    icon={<Target size={20} />}
                    trend="+5.4"
                    color="text-primary"
                    bgColor="bg-primary/10"
                />
                <KPICard
                    title="Leads Qualificados"
                    value={(roi?.total_leads || 0).toString()}
                    icon={<Users size={20} />}
                    trend="+28"
                    color="text-blue-500"
                    bgColor="bg-blue-500/10"
                />
                <KPICard
                    title="Top Departamento"
                    value={roi?.top_department || 'Vendas'}
                    icon={<Briefcase size={20} />}
                    trend="Estável"
                    color="text-purple-500"
                    bgColor="bg-purple-500/10"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Visual Funnel */}
                <div className="lg:col-span-8 bg-surface border border-border rounded-3xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-xl font-black text-white uppercase flex items-center gap-2">
                                <ArrowDownWideNarrow className="text-primary" /> Funil de Conversão
                            </h3>
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Análise de Drop-off por Etapa</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="px-3 py-1 bg-zinc-900 rounded-lg text-[10px] font-black text-zinc-500 border border-border flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> SUCESSO
                            </div>
                            <div className="px-3 py-1 bg-zinc-900 rounded-lg text-[10px] font-black text-zinc-500 border border-border flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div> DROPOFF
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {funnelSteps.length > 0 ? (
                            funnelSteps.map((step, index) => (
                                <FunnelStepRow key={step.node_id} step={step} index={index} totalSteps={funnelSteps.length} />
                            ))
                        ) : (
                            <div className="py-20 text-center opacity-20">
                                <TrendingUp size={48} className="mx-auto mb-4" />
                                <p className="font-black italic">Sem dados suficientes para este fluxo.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Score Distribution */}
                <div className="lg:col-span-4 bg-surface border border-border rounded-3xl p-8 flex flex-col">
                    <h3 className="text-xl font-black text-white uppercase mb-8">Saúde do Funil</h3>

                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        {/* Semi-Circle Chart Mockup */}
                        <div className="w-48 h-24 border-[12px] border-zinc-800 border-b-0 rounded-t-full relative overflow-hidden">
                            <div
                                className="absolute inset-0 border-[12px] border-primary border-b-0 rounded-t-full origin-bottom rotate-[-45deg] transition-all duration-1000"
                                style={{ transform: `rotate(${(roi?.avg_score || 0) * 1.8 - 90}deg)` }}
                            ></div>
                        </div>
                        <div className="text-center mt-4">
                            <span className="text-4xl font-black text-white">{Math.round(roi?.avg_score || 0)}</span>
                            <span className="text-zinc-500 font-bold ml-1 text-xs">SCORE GLOBAL</span>
                        </div>
                    </div>

                    <div className="mt-8 space-y-4">
                        <ScoreTrait label="Qualidade Média" value="EXCELENTE" color="text-emerald-500" />
                        <ScoreTrait label="Engajamento" value="78%" color="text-primary" />
                        <ScoreTrait label="Tempo de Conversão" value="2.4 Dias" color="text-zinc-400" />
                    </div>

                    <div className="mt-auto pt-8">
                        <button className="w-full bg-zinc-900 border border-border py-4 rounded-2xl font-black text-xs text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2">
                            VER DETALHES DE LEADS <ChevronDown size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const KPICard = ({ title, value, icon, trend, color, bgColor }: any) => (
    <div className="bg-surface border border-border p-6 rounded-3xl shadow-xl group hover:border-primary/30 transition-all">
        <div className="flex items-center justify-between mb-6">
            <div className={`p-3 rounded-2xl ${bgColor} ${color}`}>
                {icon}
            </div>
            <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${bgColor} ${color}`}>
                {trend}
            </span>
        </div>
        <h4 className="text-2xl font-black text-white mb-1">{value}</h4>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{title}</p>
    </div>
);

const FunnelStepRow = ({ step, index, totalSteps }: any) => {
    const width = 100 - (index * 8);
    const dropOff = Math.round(step.drop_off_rate);

    return (
        <div className="relative group">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] bg-zinc-800 text-zinc-500 w-5 h-5 flex items-center justify-center rounded-lg font-black">{index + 1}</span>
                    <h5 className="text-sm font-bold text-zinc-200 capitalize">{step.node_name}</h5>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black font-mono">
                    <span className="text-emerald-500">{step.exit_count} OK</span>
                    <span className="text-red-500/50">{step.enter_count - step.exit_count} PERDIDOS</span>
                </div>
            </div>
            <div className="h-6 bg-zinc-900 rounded-lg overflow-hidden flex border border-border/50">
                <div
                    className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    style={{ width: `${width - dropOff}%` }}
                ></div>
                <div
                    className="h-full bg-red-500/10 transition-all duration-1000"
                    style={{ width: `${dropOff}%` }}
                ></div>
            </div>

            {/* Connector */}
            {index < totalSteps - 1 && (
                <div className="absolute left-2.5 top-full h-4 w-px bg-zinc-800 z-0"></div>
            )}
        </div>
    );
};

const ScoreTrait = ({ label, value, color }: any) => (
    <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-border/30">
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">{label}</span>
        <span className={`text-xs font-black ${color}`}>{value}</span>
    </div>
);


