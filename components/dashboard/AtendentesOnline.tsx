
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import { User, Circle } from 'lucide-react';

export const AtendentesOnline: React.FC = () => {
    const { data: team = [] } = useQuery({
        queryKey: ['team-presence'],
        queryFn: async () => {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .order('last_seen_at', { ascending: false });
            return data || [];
        },
        refetchInterval: 30000 // Update every 30s
    });

    const isOnline = (lastSeen: string) => {
        if (!lastSeen) return false;
        const last = new Date(lastSeen).getTime();
        const now = new Date().getTime();
        return (now - last) < 1000 * 60 * 5; // Online if active in last 5 mins
    };

    return (
        <div className="glass-panel p-6 rounded-[2rem] border border-white/5 h-full flex flex-col">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                <User className="text-primary" size={24} />
                Equipe Online
            </h3>

            <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
                {team.map((member: any) => {
                    const online = isOnline(member.last_seen_at);
                    return (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <img
                                        src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.full_name}&background=random`}
                                        className="w-10 h-10 rounded-xl object-cover"
                                        alt={member.full_name}
                                    />
                                    <div className={`absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full border-2 border-[#09090b] ${online ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-zinc-600'}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white leading-tight">{member.full_name}</p>
                                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mt-0.5">
                                        {member.role || 'Atendente'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${online ? 'text-emerald-500' : 'text-zinc-500'}`}>
                                    {online ? 'Ativo agora' : 'Offline'}
                                </p>
                                {!online && member.last_seen_at && (
                                    <p className="text-[9px] text-zinc-600 mt-0.5 font-bold">
                                        {new Date(member.last_seen_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
