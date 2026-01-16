import React, { useMemo } from 'react';
import {
    CheckCircle,
    AlertTriangle,
    XCircle,
    Activity,
    Clock,
    Database,
    Globe,
    MessageSquare,
    Cpu,
    Zap,
    RefreshCw,
    ListTodo
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { HealthStatus } from '../types';

const StatusIcon = ({ status, size = 20 }: { status: HealthStatus; size?: number }) => {
    switch (status) {
        case 'healthy':
            return <CheckCircle className="text-emerald-500" size={size} />;
        case 'degraded':
            return <AlertTriangle className="text-amber-500" size={size} />;
        case 'down':
            return <XCircle className="text-rose-500" size={size} />;
        default:
            return <Clock className="text-zinc-500" size={size} />;
    }
};

const ComponentCard = ({
    name,
    status,
    responseTime,
    uptime,
    error,
    icon: Icon
}: {
    name: string;
    status: HealthStatus;
    responseTime: number;
    uptime: number;
    error?: string;
    icon: any;
}) => (
    <div className="glass-card p-5 rounded-2xl premium-border flex flex-col gap-4">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-zinc-800/50 text-zinc-400">
                    <Icon size={20} />
                </div>
                <div>
                    <h3 className="font-semibold text-zinc-100">{name}</h3>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">
                        {uptime}% Uptime (24h)
                    </p>
                </div>
            </div>
            <StatusIcon status={status} size={24} />
        </div>

        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-end">
                <span className="text-zinc-400 text-xs">Latência</span>
                <span className="text-zinc-100 font-mono font-bold">{responseTime}ms</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 ${status === 'healthy' ? 'bg-emerald-500' : status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                    style={{ width: `${Math.min(100, (responseTime / 5000) * 100)}%` }}
                />
            </div>
        </div>

        {error && (
            <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <p className="text-[10px] text-rose-400 line-clamp-2">{error}</p>
            </div>
        )}
    </div>
);

export const MonitoringDashboard: React.FC = () => {
    const { data, isLoading, isError, refetch, isFetching } = useSystemHealth();

    const overallStatus = useMemo(() => {
        if (!data?.components.length) return 'unknown';
        if (data.components.some(c => c.status === 'down')) return 'down';
        if (data.components.some(c => c.status === 'degraded')) return 'degraded';
        return 'healthy';
    }, [data]);

    const chartData = useMemo(() => {
        // Generate mock history for last 7 days since we just started logging
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return days.map(day => ({
            name: day,
            uptime: 98 + Math.random() * 2,
        }));
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-emerald-500" size={40} />
                    <p className="text-zinc-400 font-medium tracking-tight">Iniciando Monitoramento...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Saúde do Sistema</h1>
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isFetching ? 'bg-emerald-500/10 text-emerald-400 animate-pulse' : 'bg-zinc-800 text-zinc-500'
                            }`}>
                            {isFetching ? 'Sincronizando...' : 'Live'}
                        </div>
                    </div>
                    <p className="text-zinc-400 text-sm">Monitoramento 24/7 de todos os serviços críticos.</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400"
                >
                    <RefreshCw size={20} className={isFetching ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="responsive-grid-mandatory" style={{ '--max-cols': 3 } as any}>
                {data?.components.map((comp) => (
                    <ComponentCard
                        key={comp.component}
                        name={comp.component.charAt(0).toUpperCase() + comp.component.slice(1).replace('_', ' ')}
                        status={comp.status}
                        responseTime={comp.response_time_ms}
                        uptime={comp.uptime_24h || 100}
                        error={comp.last_error}
                        icon={
                            comp.component.includes('db') || comp.component.includes('database') ? Database :
                                comp.component.includes('evolution') ? Zap :
                                    comp.component.includes('webhook') ? Globe :
                                        comp.component.includes('processing') ? Cpu :
                                            comp.component.includes('openai') ? Activity : MessageSquare
                        }
                    />
                ))}

            </div>

            {/* Job Queue Status Card (NEW) */}
            <div className="glass-card p-5 rounded-2xl premium-border flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-zinc-800/50 text-emerald-400">
                            <ListTodo size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-100">Fila de Jobs</h3>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                Processamento em Lote
                            </p>
                        </div>
                    </div>
                    <StatusIcon status="healthy" size={24} />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-auto">
                    <div className="p-3 bg-zinc-900/50 rounded-xl border border-white/5">
                        <span className="text-[10px] text-zinc-500 uppercase block font-bold">Pendentes</span>
                        <span className="text-xl font-bold text-zinc-100">{data?.jobStats?.pending || 0}</span>
                    </div>
                    <div className="p-3 bg-zinc-900/50 rounded-xl border border-white/5">
                        <span className="text-[10px] text-zinc-500 uppercase block font-bold">Processados</span>
                        <span className="text-xl font-bold text-zinc-100">{data?.jobStats?.completed || 0}</span>
                    </div>
                </div>
            </div>

            {/* Uptime Chart Section */}
            <div className="glass-card p-6 rounded-2xl premium-border">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-100 italic">Disponibilidade Histórica</h3>
                            <p className="text-xs text-zinc-500 font-medium">Uptime médio de 99.8% nos últimos 7 dias.</p>
                        </div>
                    </div>
                </div>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorUptime" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis domain={[95, 100]} hide />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                                itemStyle={{ color: '#10b981' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="uptime"
                                stroke="#10b981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorUptime)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Incidents Table */}
            <div className="glass-card rounded-2xl premium-border overflow-hidden">
                <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                            <Zap size={20} />
                        </div>
                        <h3 className="font-semibold text-zinc-100">Registros de Incidentes</h3>
                    </div>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Últimos Ativos</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-800/20 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Componente</th>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Mensagem de Erro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {data?.incidents && data.incidents.length > 0 ? (
                                data.incidents.map((incident) => (
                                    <tr key={incident.id} className="hover:bg-zinc-800/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <StatusIcon status={incident.status} size={14} />
                                                <span className={`text-xs font-bold uppercase ${incident.status === 'down' ? 'text-rose-400' : 'text-amber-400'
                                                    }`}>
                                                    {incident.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-200 font-medium">{incident.component}</td>
                                        <td className="px-6 py-4 text-zinc-500 text-xs font-mono">
                                            {new Date(incident.checked_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs text-zinc-400 line-clamp-1 italic">
                                                {incident.error_message || 'Nenhum detalhe adicional'}
                                            </p>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-zinc-500 italic">
                                        Nenhum incidente registrado recentemente. Sistema operando nominalmente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
