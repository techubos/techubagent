
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useRecentActivity } from '../api/useRecentActivity';

export const ActivityFeed = () => {
    const { data: recentActivity = [], isLoading } = useRecentActivity();

    if (isLoading) {
        return <div className="p-8 text-center text-zinc-500 text-xs uppercase tracking-widest animate-pulse">Carregando feed...</div>;
    }

    if (recentActivity.length === 0) {
        return (
            <div className="p-8 text-center text-zinc-500 text-xs uppercase tracking-widest">
                Nenhuma atividade recente
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {recentActivity.map((msg: any) => (
                <div key={msg.id} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group will-change-transform">
                    <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'ai' ? 'bg-primary/20 text-primary' : 'bg-zinc-800 text-zinc-400'}`}>
                        <MessageCircle size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-bold text-white text-sm truncate">
                                {msg.contacts?.name || msg.remote_jid || 'Desconhecido'}
                            </h4>
                            <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed group-hover:text-zinc-300 transition-colors">
                            {msg.content}
                        </p>
                        {msg.sentiment && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${msg.sentiment === 'positive' ? 'bg-emerald-500' :
                                    msg.sentiment === 'negative' ? 'bg-red-500' : 'bg-zinc-500'
                                    }`} />
                                <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-600">
                                    {msg.sentiment === 'positive' ? 'Positivo' : msg.sentiment === 'negative' ? 'Negativo' : 'Neutro'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
