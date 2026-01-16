import React, { useState, useMemo } from 'react';
import {
    Search,
    Filter,
    Download,
    RefreshCcw,
    AlertCircle,
    Info,
    Terminal,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Code
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';

interface Log {
    id: string;
    level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    component: string;
    message: string;
    metadata: any;
    timestamp: string;
    organization_id?: string;
}

export const LogViewer: React.FC = () => {
    const [page, setPage] = useState(0);
    const [level, setLevel] = useState<string>('all');
    const [component, setComponent] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [organizationId, setOrganizationId] = useState<string>('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const pageSize = 50;

    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['app-logs', page, level, component, search, startDate, endDate, organizationId],
        queryFn: async () => {
            let query = supabase
                .from('app_logs')
                .select('*', { count: 'exact' })
                .order('timestamp', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (level !== 'all') query = query.eq('level', level);
            if (component !== 'all') query = query.eq('component', component);
            if (organizationId) query = query.eq('organization_id', organizationId);
            if (startDate) query = query.gte('timestamp', new Date(startDate).toISOString());
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query = query.lte('timestamp', end.toISOString());
            }
            if (search) query = query.textSearch('message', `'${search}'`, { config: 'portuguese' });

            const { data, count, error } = await query;
            if (error) throw error;
            return { logs: data as Log[], total: count || 0 };
        },
    });

    const exportToCSV = () => {
        if (!data?.logs) return;
        const headers = ['Timestamp', 'Level', 'Component', 'Message', 'Metadata'];
        const rows = data.logs.map(log => [
            log.timestamp,
            log.level,
            log.component,
            log.message,
            JSON.stringify(log.metadata)
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers, ...rows].map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `techub_logs_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'critical': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
            case 'error': return 'text-rose-400 bg-rose-500/10 border-rose-500/10';
            case 'warn': return 'text-amber-400 bg-amber-500/10 border-amber-500/10';
            case 'info': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10';
            default: return 'text-zinc-400 bg-zinc-800 border-zinc-700';
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            {/* Search & Filters */}
            <div className="glass-card p-4 rounded-2xl premium-border flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar nos logs..."
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-2 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    className="bg-zinc-800/50 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-300 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                >
                    <option value="all">Todos os Níveis</option>
                    <option value="critical">Crítico</option>
                    <option value="error">Erro</option>
                    <option value="warn">Aviso</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                </select>

                <select
                    className="bg-zinc-800/50 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-300 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                    value={component}
                    onChange={(e) => setComponent(e.target.value)}
                >
                    <option value="all">Todos os Componentes</option>
                    <option value="webhook">Webhook</option>
                    <option value="processor">Processor</option>
                    <option value="ai">AI / LLM</option>
                    <option value="frontend">Frontend</option>
                </select>

                <div className="flex gap-2 items-center bg-zinc-800/30 p-1 px-2 rounded-xl border border-zinc-700/50">
                    <Calendar size={14} className="text-zinc-500" />
                    <input
                        type="date"
                        className="bg-transparent text-zinc-400 text-xs focus:outline-none"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="text-zinc-600 text-xs">até</span>
                    <input
                        type="date"
                        className="bg-transparent text-zinc-400 text-xs focus:outline-none"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>

                <div className="relative group">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        placeholder="Org ID..."
                        className="bg-zinc-800/50 border border-zinc-700 rounded-xl py-2 pl-9 pr-3 text-zinc-300 text-xs w-24 focus:w-48 focus:outline-none focus:border-emerald-500/50 transition-all"
                        value={organizationId}
                        onChange={(e) => setOrganizationId(e.target.value)}
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => refetch()}
                        className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                    >
                        <RefreshCcw size={20} className={isFetching ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                    >
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="glass-card rounded-2xl premium-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-800/30 text-zinc-500 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-800/50">
                                <th className="px-6 py-4 w-40">Timestamp</th>
                                <th className="px-6 py-4 w-32">Nível</th>
                                <th className="px-6 py-4 w-40">Componente</th>
                                <th className="px-6 py-4">Mensagem</th>
                                <th className="px-6 py-4 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="text-zinc-300 divide-y divide-zinc-800/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center italic text-zinc-500">
                                        <RefreshCcw className="animate-spin inline-block mr-2" size={16} />
                                        Carregando logs...
                                    </td>
                                </tr>
                            ) : data?.logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center italic text-zinc-500">Nenhum log encontrado.</td>
                                </tr>
                            ) : (
                                data?.logs.map((log) => (
                                    <React.Fragment key={log.id}>
                                        <tr
                                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                            className="hover:bg-zinc-800/20 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getLevelColor(log.level)}`}>
                                                    {log.level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold">
                                                    <Terminal size={14} className="text-zinc-600" />
                                                    {log.component}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm line-clamp-1 group-hover:line-clamp-none transition-all">
                                                    {log.message}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-zinc-600">
                                                <Code size={16} className={expandedId === log.id ? 'text-emerald-500' : ''} />
                                            </td>
                                        </tr>
                                        {expandedId === log.id && (
                                            <tr className="bg-zinc-900/40">
                                                <td colSpan={5} className="px-6 py-4">
                                                    <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 font-mono text-xs">
                                                        <span className="text-zinc-500 italic mb-2 block">// Metadata</span>
                                                        <pre className="text-emerald-400 overflow-x-auto">
                                                            {JSON.stringify(log.metadata, null, 2)}
                                                        </pre>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-800/10">
                    <span className="text-xs text-zinc-500">
                        Mostrando logs {page * pageSize + 1} - {Math.min((page + 1) * pageSize, data?.total || 0)} de {data?.total}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className="p-1 px-3 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors flex items-center gap-1 text-xs font-bold uppercase"
                        >
                            <ChevronLeft size={16} /> Anterior
                        </button>
                        <button
                            disabled={(page + 1) * pageSize >= (data?.total || 0)}
                            onClick={() => setPage(page + 1)}
                            className="p-1 px-3 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors flex items-center gap-1 text-xs font-bold uppercase"
                        >
                            Próximo <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
