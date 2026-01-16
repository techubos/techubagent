import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Calendar, Trash2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Contact } from '../../types';

interface ScheduledMessage {
    id: string;
    content: string;
    scheduled_for: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    created_at: string;
}

interface ScheduledMessagesCalendarProps {
    contact?: Contact;
    onClose: () => void;
}

export const ScheduledMessagesCalendar: React.FC<ScheduledMessagesCalendarProps> = ({ contact, onClose }) => {
    const [messages, setMessages] = useState<ScheduledMessage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMessages();
    }, [contact]);

    const fetchMessages = async () => {
        if (!contact) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('scheduled_messages')
            .select('*')
            .eq('contact_id', contact.id)
            .order('scheduled_for', { ascending: true });

        if (error) console.error("Error fetching scheduled messages:", error);
        else setMessages(data || []);
        setLoading(false);
    };

    const handleCancel = async (id: string) => {
        if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
        const { error } = await supabase
            .from('scheduled_messages')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) alert("Erro ao cancelar.");
        else fetchMessages();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir agendamento permanentemente?")) return;
        const { error } = await supabase
            .from('scheduled_messages')
            .delete()
            .eq('id', id);

        if (error) alert("Erro ao excluir.");
        else fetchMessages();
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Group by Date for "Calendar" feel
    const groupedMessages: Record<string, ScheduledMessage[]> = {};
    messages.forEach(msg => {
        const dateKey = new Date(msg.scheduled_for).toLocaleDateString('pt-BR');
        if (!groupedMessages[dateKey]) groupedMessages[dateKey] = [];
        groupedMessages[dateKey].push(msg);
    });

    return (
        <div className="flex flex-col h-full bg-zinc-950/50 backdrop-blur-xl border-l border-white/5">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-950/80">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />
                    Agendamentos
                </h3>
                <button onClick={onClose} className="text-zinc-500 hover:text-white">
                    Fechar
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="text-center text-zinc-500 text-xs py-8">Carregando agendamentos...</div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-zinc-600 text-xs py-10 flex flex-col items-center gap-2">
                        <Calendar size={24} className="opacity-20" />
                        Nenhum agendamento futuro.
                    </div>
                ) : (
                    Object.entries(groupedMessages).map(([date, msgs]) => (
                        <div key={date} className="animate-in fade-in slide-in-from-bottom-2">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 sticky top-0 bg-zinc-950/90 py-1 z-10 backdrop-blur">
                                {date}
                            </h4>
                            <div className="space-y-2">
                                {msgs.map(msg => (
                                    <div key={msg.id} className="bg-zinc-900/50 border border-white/5 rounded-lg p-3 relative group hover:border-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2 text-xs font-bold text-white">
                                                <Clock size={12} className="text-primary" />
                                                {new Date(msg.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="flex gap-1">
                                                {msg.status === 'pending' && (
                                                    <button onClick={() => handleCancel(msg.id)} className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Cancelar">
                                                        <AlertCircle size={14} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(msg.id)} className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Excluir">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-zinc-300 line-clamp-2">{msg.content}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${msg.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                    msg.status === 'sent' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                        'bg-red-500/10 text-red-500 border-red-500/20'
                                                } uppercase font-bold tracking-wider`}>
                                                {msg.status === 'pending' ? 'Pendente' : msg.status === 'sent' ? 'Enviado' : msg.status === 'cancelled' ? 'Cancelado' : 'Falha'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
