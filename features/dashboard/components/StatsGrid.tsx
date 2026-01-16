
import React from 'react';
import { Users, MessageCircle, Calendar, Zap, HelpCircle, AlertCircle } from 'lucide-react';

interface StatsGridProps {
    stats: {
        activeChats: number;
        totalLeads: number;
        scheduled: number;
        apiCost: number;
        forecast: number;
    }
}

const StatCard = ({ title, value, sub, icon: Icon, color, description, className }: any) => (
    <div className={`glass-card p-6 rounded-3xl flex items-start justify-between group relative overflow-hidden premium-border ${className}`}>
        <div className="relative z-10">
            <p className="text-[10px] font-black text-zinc-500 mb-1 flex items-center gap-1 uppercase tracking-widest">
                {title}
                {description && (
                    <span className="cursor-help opacity-40 hover:opacity-100 transition-opacity" title={description}>
                        <HelpCircle size={10} />
                    </span>
                )}
            </p>
            <h3 className="text-3xl font-black text-white tracking-tighter">{value}</h3>
            <p className={`text-[10px] font-bold mt-1 uppercase tracking-tight ${sub.includes('+') ? 'text-primary' : sub.includes('$') ? 'text-zinc-400' : 'text-zinc-500'} `}>{sub}</p>
        </div>
        <div className={`p-4 rounded-2xl ${color} bg-opacity-10 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 relative z-10`}>
            <Icon className={color.replace('bg-', 'text-')} size={24} />
        </div>

        {/* Decorative Glow */}
        <div className={`absolute -right-4 -bottom-4 w-24 h-24 blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${color}`} />
    </div>
);

export const StatsGrid = ({ stats }: any) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
                title="Atendimentos Pendentes"
                value={stats.pending}
                sub="Aguardando resposta"
                icon={AlertCircle}
                color="bg-red-500"
                description="Contatos com mensagens não lidas ou aguardando ação humana."
            />
            <StatCard
                title="Em Andamento"
                value={stats.inProgress}
                sub="Fluxo ativo"
                icon={MessageCircle}
                color="bg-emerald-500"
                description="Atendimentos em negociação ativa e não descartados."
            />
            <StatCard
                title="Novos Hoje"
                value={stats.newContacts}
                sub="Últimas 24 horas"
                icon={Users}
                color="bg-blue-500"
                description="Contatos que entraram no sistema hoje."
            />
            <StatCard
                title="T.M.A."
                value={stats.avgResponseTime}
                sub="Média de hoje"
                icon={Zap}
                color="bg-yellow-500"
                description="Tempo Médio de Atendimento (Primeira resposta interna)."
            />
        </div>
    );
};
