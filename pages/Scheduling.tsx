import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Calendar as CalendarIcon, Trash2, XCircle, Search, Clock, User, MessageSquare, Plus, List, Grid } from 'lucide-react';
import { toast } from 'sonner';
import { CreateScheduleModal } from '../components/crm/CreateScheduleModal';

interface ScheduledMessage {
    id: string;
    contact_id: string;
    content: string;
    media_url?: string;
    message_type: 'text' | 'image' | 'audio';
    scheduled_for: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    contacts?: {
        name: string;
        phone: string;
    }
}

export const Scheduling: React.FC = () => {
    const [messages, setMessages] = useState<ScheduledMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'history'>('pending');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        fetchMessages();
    }, [filter]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('scheduled_messages')
                .select(`
                    *,
                    contacts (name, phone)
                `)
                .order('scheduled_for', { ascending: true });

            if (filter === 'pending') {
                query = query.eq('status', 'pending');
            } else {
                query = query.neq('status', 'pending');
            }

            const { data, error } = await query;
            if (error) throw error;
            setMessages(data || []);
        } catch (error: any) {
            toast.error("Erro ao carregar agendamentos: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm("Cancelar este envio?")) return;
        try {
            const { error } = await supabase
                .from('scheduled_messages')
                .update({ status: 'cancelled' })
                .eq('id', id);

            if (error) throw error;
            toast.success("Agendamento cancelado.");
            fetchMessages();
        } catch (error: any) {
            toast.error("Erro ao cancelar: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir permanentemente?")) return;
        try {
            const { error } = await supabase
                .from('scheduled_messages')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success("Agendamento excluído.");
            fetchMessages();
        } catch (error: any) {
            toast.error("Erro ao excluir: " + error.message);
        }
    };

    // Group by Date for List View
    const groupedMessages: Record<string, ScheduledMessage[]> = {};
    messages.forEach(msg => {
        const date = new Date(msg.scheduled_for).toLocaleDateString();
        if (!groupedMessages[date]) groupedMessages[date] = [];
        groupedMessages[date].push(msg);
    });

    // Calendar Helper
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const renderCalendar = () => {
        const { days, firstDay } = getDaysInMonth(currentMonth);
        const calendarDays = [];

        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            calendarDays.push(<div key={`empty-${i}`} className="bg-zinc-950/20 border border-zinc-800/50 p-2 min-h-[100px] opacity-50"></div>);
        }

        // Days
        for (let i = 1; i <= days; i++) {
            const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
            const dateStr = currentDate.toLocaleDateString();
            const dayMessages = groupedMessages[dateStr] || [];

            calendarDays.push(
                <div key={i} className={`bg-zinc-900/50 border border-zinc-800 p-2 min-h-[100px] relative hover:bg-zinc-800/50 transition-colors ${dayMessages.length > 0 ? 'border-primary/20' : ''}`}>
                    <span className={`text-sm font-bold ${dayMessages.length > 0 ? 'text-white' : 'text-zinc-500'}`}>{i}</span>
                    <div className="mt-2 space-y-1">
                        {dayMessages.slice(0, 3).map(msg => (
                            <div key={msg.id} className="bg-zinc-800 rounded px-1.5 py-0.5 text-[10px] truncate text-zinc-300 border-l-2 border-primary">
                                {new Date(msg.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {msg.contacts?.name}
                            </div>
                        ))}
                        {dayMessages.length > 3 && (
                            <div className="text-[9px] text-zinc-500 pl-1">
                                +{dayMessages.length - 3} mais
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return calendarDays;
    };

    return (
        <div className="h-[calc(100vh-6rem)] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-2xl">
            {/* Creates Schedule Modal */}
            {isCreateModalOpen && (
                <CreateScheduleModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={fetchMessages}
                />
            )}

            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
                        <CalendarIcon className="text-primary" />
                        Central de Agendamentos (v2.0)
                    </h2>
                    <p className="text-zinc-500 text-sm">Visualize e gerencie mensagens programadas para todos os contatos.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* View Toggles */}
                    <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                            title="Lista"
                        >
                            <List size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                            title="Calendário"
                        >
                            <Grid size={18} />
                        </button>
                    </div>

                    <div className="w-px h-8 bg-zinc-800" />

                    {/* Filter Toggles */}
                    <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        <button
                            onClick={() => setFilter('pending')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'pending' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                        >
                            Pendentes
                        </button>
                        <button
                            onClick={() => setFilter('history')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'history' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                        >
                            Histórico
                        </button>
                    </div>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 bg-primary text-black px-4 py-2.5 rounded-xl font-bold hover:bg-primaryHover transition-transform active:scale-95 shadow-lg shadow-primary/20"
                    >
                        <Plus size={18} />
                        Novo Agendamento
                    </button>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-zinc-950/50">
                    {loading ? (
                        <p className="text-center text-zinc-500 py-10">Carregando agendamentos...</p>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-20 text-zinc-500 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
                            <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Nenhum agendamento encontrado.</p>
                        </div>
                    ) : (
                        Object.entries(groupedMessages).map(([date, msgs]) => (
                            <div key={date}>
                                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 sticky top-0 bg-zinc-950 py-2 z-10 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary" />
                                    {date}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {msgs.map(msg => (
                                        <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all group relative">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                                                        <User size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-zinc-200 text-sm">{msg.contacts?.name || 'Desconhecido'}</h4>
                                                        <p className="text-[10px] text-zinc-500">{msg.contacts?.phone}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${msg.status === 'pending' ? 'bg-blue-500/10 text-blue-400' :
                                                    msg.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        msg.status === 'cancelled' ? 'bg-zinc-500/10 text-zinc-400' :
                                                            'bg-red-500/10 text-red-400'
                                                    }`}>
                                                    {msg.status === 'pending' ? 'Pendente' :
                                                        msg.status === 'sent' ? 'Enviado' :
                                                            msg.status === 'cancelled' ? 'Cancelado' : 'Falha'}
                                                </span>
                                            </div>

                                            <div className="bg-black/20 p-3 rounded-lg mb-3 border border-white/5">
                                                <div className="flex items-start gap-2">
                                                    <MessageSquare size={14} className="text-zinc-600 mt-1 shrink-0" />
                                                    <p className="text-xs text-zinc-300 line-clamp-3">
                                                        {msg.content}
                                                    </p>
                                                </div>
                                                {msg.media_url && (
                                                    <div className="mt-2 text-[10px] text-primary flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Mídia anexada
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex justify-between items-center text-[11px] text-zinc-500">
                                                <div className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(msg.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>

                                                {filter === 'pending' && (
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleCancel(msg.id)}
                                                            className="hover:text-amber-400 flex items-center gap-1 transition-colors"
                                                            title="Cancelar envio"
                                                        >
                                                            <XCircle size={14} /> Cancelar
                                                        </button>
                                                    </div>
                                                )}
                                                {filter !== 'pending' && (
                                                    <button
                                                        onClick={() => handleDelete(msg.id)}
                                                        className="hover:text-red-400 flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Excluir histórico"
                                                    >
                                                        <Trash2 size={14} /> Excluir
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && (
                <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/50">
                    <div className="mb-4 flex justify-between items-center bg-zinc-900 border border-zinc-800 p-2 rounded-lg">
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-2 hover:bg-zinc-800 rounded">{'<'}</button>
                        <h3 className="font-bold text-lg text-white capitalize">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-2 hover:bg-zinc-800 rounded">{'>'}</button>
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-zinc-800 text-center text-xs font-bold text-zinc-500 p-2 border border-zinc-800 mb-2 rounded-t-lg">
                        <div>DOM</div><div>SEG</div><div>TER</div><div>QUA</div><div>QUI</div><div>SEX</div><div>SÁB</div>
                    </div>
                    <div className="grid grid-cols-7 h-full auto-rows-fr">
                        {renderCalendar()}
                    </div>
                </div>
            )}
        </div>
    );
};
