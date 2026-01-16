
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import { MessageSquare, Clock, Phone } from 'lucide-react';

export const AtendimentoHoje: React.FC = () => {
    const { data: contacts = [] } = useQuery({
        queryKey: ['contacts-today'],
        queryFn: async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data } = await supabase
                .from('contacts')
                .select('*')
                .gte('last_message_at', today.toISOString())
                .order('last_message_at', { ascending: false });
            return data || [];
        }
    });

    return (
        <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        <MessageSquare className="text-primary" size={28} />
                        Atendimento Hoje
                    </h3>
                    <p className="text-zinc-500 text-sm font-medium mt-1">
                        {contacts.length} {contacts.length === 1 ? 'atendimento realizado' : 'atendimentos realizados'}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-3">
                {contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30">
                        <MessageSquare size={48} className="mb-4" />
                        <p className="font-bold">Nenhum atendimento ainda hoje</p>
                    </div>
                ) : (
                    contacts.map((contact: any) => (
                        <div key={contact.id} className="flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary-gradient flex items-center justify-center text-white font-black shadow-lg shadow-emerald-900/20">
                                    {(contact.name?.[0] || '?').toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-white group-hover:text-primary transition-colors">{contact.name}</h4>
                                    <div className="flex items-center gap-3 mt-1 text-zinc-500 text-xs font-medium">
                                        <span className="flex items-center gap-1.5">
                                            <Phone size={12} />
                                            {contact.phone}
                                        </span>
                                        <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${contact.status === 'closed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                                            }`}>
                                            {contact.status || 'lead'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center gap-1.5 text-zinc-400 justify-end">
                                    <Clock size={12} />
                                    <span className="text-xs font-bold">
                                        {new Date(contact.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">
                                    Última msg
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
