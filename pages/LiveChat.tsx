import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    Send,
    User,
    Bot,
    CheckCircle2,
    Clock,
    Search,
    Filter,
    MessageCircle,
    MoreVertical,
    Check,
    Loader2,
    ShieldAlert,
    Smartphone,
    Brain,
    Zap,
    FileText,
    StickyNote
} from 'lucide-react';
import { sendWhatsAppMessage } from '../services/evolutionService';

interface Contact {
    id: string;
    name: string;
    phone: string;
    handling_mode: 'ai' | 'human';
    is_unread: boolean;
    last_message_at: string;
    status: string;
    lead_score?: number;
    memory_summary?: string;
    department?: string;
    notes?: string;
    assigned_to?: string | null;
    last_human_interaction_at?: string;
}

interface Message {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
}

interface Profile {
    id: string;
    full_name: string;
    avatar_url?: string;
}

export const LiveChat = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [agents, setAgents] = useState<Profile[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [selectedContact, setSelectedContact] = useState<Contact | any>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [filter, setFilter] = useState<'all' | 'unassigned' | 'mine'>('all');
    const [deptFilter, setDeptFilter] = useState<'all' | 'sales' | 'support' | 'finance'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [coaching, setCoaching] = useState(false);
    const [summarizing, setSummarizing] = useState(false);
    const [currentSummary, setCurrentSummary] = useState<string | null>(null);
    const [showNotes, setShowNotes] = useState(false);
    const [contactNotes, setContactNotes] = useState('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const prevCriticalCount = useRef(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUserId(user.id);
            await fetchAgents();
            await fetchContacts();
        };
        init();
    }, []);

    useEffect(() => {
        const sub = supabase.channel('live_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchContacts())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const newMsg = payload.new as Message;
                if (selectedContact && (payload.new as any).phone === selectedContact.phone) {
                    setMessages(prev => [...prev, newMsg]);
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [selectedContact]);

    const criticalLeads = contacts.filter(c => c.handling_mode === 'human' && c.is_unread && (!c.last_human_interaction_at || new Date(c.last_message_at) > new Date(c.last_human_interaction_at)));

    useEffect(() => {
        const criticalCount = criticalLeads.length;
        if (notificationsEnabled && criticalCount > prevCriticalCount.current) {
            audioRef.current?.play().catch(e => console.log('Sound blocked by browser'));
        }
        prevCriticalCount.current = criticalCount;
    }, [criticalLeads, notificationsEnabled]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const fetchAgents = async () => {
        const { data } = await supabase.from('profiles').select('id, full_name, avatar_url');
        if (data) setAgents(data);
    };

    const fetchContacts = async () => {
        setLoading(true);
        let query = supabase
            .from('contacts')
            .select('*')
            .order('last_message_at', { ascending: false });

        if (filter === 'unassigned') query = query.is('assigned_to', null);
        else if (filter === 'mine') query = query.eq('assigned_to', currentUserId);

        if (deptFilter !== 'all') query = query.eq('department', deptFilter);

        const { data, error } = await query;
        if (data) setContacts(data);
        if (error) console.error("Error fetching contacts:", error);
        setLoading(false);
    };

    useEffect(() => {
        fetchContacts();
    }, [filter, deptFilter, currentUserId]);

    const assignContact = async (contactId: string, userId: string | null) => {
        const { error } = await supabase
            .from('contacts')
            .update({ assigned_to: userId })
            .eq('id', contactId);

        if (!error) {
            if (selectedContact?.id === contactId) {
                setSelectedContact({ ...selectedContact, assigned_to: userId });
            }
            if (userId && userId !== currentUserId) {
                await supabase.functions.invoke('notification-processor', {
                    body: { action: 'notify_transfer', payload: { contactId, userId } }
                });
            }
            fetchContacts();
        }
    };

    const filteredContacts = contacts.filter(c => {
        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            if (!(c.name?.toLowerCase().includes(lowerCaseQuery) || c.phone.includes(lowerCaseQuery))) {
                return false;
            }
        }
        return true;
    });

    const selectChat = async (contact: Contact) => {
        setSelectedContact(contact);
        setLoading(true);
        const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('phone', contact.phone)
            .order('created_at', { ascending: true });

        if (data) setMessages(data);

        await supabase.from('contacts').update({ is_unread: false }).eq('id', contact.id);
        setContactNotes(contact.notes || '');
        setCurrentSummary(null);
        setLoading(false);
    };

    const toggleMode = async (contact: Contact) => {
        const newMode = contact.handling_mode === 'ai' ? 'human' : 'ai';
        const { error } = await supabase.from('contacts').update({ handling_mode: newMode }).eq('id', contact.id);
        if (!error) {
            setSelectedContact({ ...contact, handling_mode: newMode });
            fetchContacts();
        }
    };

    const handleGetSuggestion = async () => {
        if (!selectedContact) return;
        setCoaching(true);
        try {
            const { data, error } = await supabase.functions.invoke('coach-suggestion', {
                body: {
                    contactId: selectedContact.id,
                    history: messages.slice(-5),
                    memorySummary: selectedContact.memory_summary
                }
            });
            if (data?.suggestion) {
                setNewMessage(data.suggestion);
            }
        } catch (e) {
            console.error("Coach fail", e);
        } finally {
            setCoaching(false);
        }
    };

    const handleGetSummary = async () => {
        if (!selectedContact || messages.length === 0) return;
        setSummarizing(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-helper', {
                body: {
                    action: 'summarize',
                    contactId: selectedContact.id,
                    messages: messages.slice(-20)
                }
            });
            if (data?.summary) {
                setCurrentSummary(data.summary);
            }
        } catch (e) {
            console.error("Summary fail", e);
        } finally {
            setSummarizing(false);
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedContact) return;
        try {
            const { error } = await supabase
                .from('contacts')
                .update({ notes: contactNotes })
                .eq('id', selectedContact.id);

            if (error) throw error;
            setSelectedContact({ ...selectedContact, notes: contactNotes });
            alert("Notas salvas com sucesso!");
        } catch (err: any) {
            alert("Erro ao salvar notas: " + err.message);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedContact || sending) return;

        setSending(true);
        try {
            // Use the centralized service (Edge Function) to avoid CORS and Auth issues
            await sendWhatsAppMessage(selectedContact.phone, newMessage);

            // Optimistic update commented out to prevent duplicates with Realtime subscription
            /*
            const optimisticMsg: Message = {
                id: 'temp-' + Date.now(),
                content: newMessage,
                role: 'assistant',
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, optimisticMsg]);
            */

            await supabase.from('contacts').update({
                last_human_interaction_at: new Date().toISOString(),
                is_unread: false
            }).eq('id', selectedContact.id);

            setNewMessage('');
        } catch (e: any) {
            console.error("Failed to send:", e);
            alert(`Erro ao enviar: ${e.message || 'Falha de conexão com a API'}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-4 animate-in fade-in duration-500">
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />

            {criticalLeads.length > 0 && (
                <div className="bg-red-500 border border-red-400 p-3 rounded-2xl flex items-center justify-between animate-pulse shadow-lg shadow-red-500/20">
                    <div className="flex items-center gap-3 text-white">
                        <ShieldAlert size={20} />
                        <span className="text-sm font-black uppercase tracking-widest">
                            ATENÇÃO: {criticalLeads.length} LEAD(S) AGUARDANDO RESPOSTA HUMANA!
                        </span>
                    </div>
                    <button
                        onClick={() => setFilter('unassigned')}
                        className="bg-white/20 hover:bg-white/30 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all"
                    >
                        VER FILA DE ATENDIMENTO
                    </button>
                </div>
            )}

            <div className="flex-1 flex bg-surface border border-border rounded-3xl overflow-hidden shadow-2xl relative">
                <div className="w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-zinc-900/50">
                    <div className="p-6 border-b border-border space-y-4">
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <MessageCircle className="text-primary" />
                            Inbox Central
                        </h2>
                        <div className="flex bg-zinc-800/50 p-1 rounded-xl border border-border/50">
                            {(['all', 'mine', 'unassigned'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${filter === f ? 'bg-primary text-zinc-900' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {f === 'all' ? 'Tudo' : f === 'mine' ? 'Meus' : 'Fila'}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-2xl border border-border/50">
                            {['all', 'sales', 'support', 'finance'].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDeptFilter(d as any)}
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${deptFilter === d ? 'bg-zinc-800 text-primary' : 'text-zinc-600 hover:text-zinc-400'}`}
                                >
                                    {d === 'all' ? 'Geral' : d === 'sales' ? 'Vendas' : d === 'support' ? 'Suporte' : 'Finan'}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar contato..."
                                className="w-full bg-surface border border-border rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading && contacts.length === 0 ? (
                            <div className="p-10 flex flex-col items-center justify-center gap-4 text-zinc-600">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-[10px] font-bold uppercase">Carregando...</span>
                            </div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="p-10 text-center opacity-30">
                                <Clock className="mx-auto mb-2" size={24} />
                                <p className="text-xs font-bold uppercase tracking-widest">Vazio</p>
                            </div>
                        ) : (
                            filteredContacts.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => selectChat(c)}
                                    className={`w-full p-4 flex items-center gap-4 transition-all border-b border-border/50 hover:bg-zinc-800/50 ${selectedContact?.id === c.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                                >
                                    <div className="relative">
                                        <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 border border-border group-hover:border-primary/30">
                                            <User size={24} />
                                        </div>
                                        {c.is_unread && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-zinc-900 animate-pulse" />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-white truncate text-sm">{c.name || c.phone}</p>
                                            <span className="text-[10px] text-zinc-500 font-medium">
                                                {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {c.handling_mode === 'ai' ? (
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-1.5 rounded">
                                                    <Bot size={10} /> Robô
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-orange-500 uppercase tracking-widest bg-orange-500/10 px-1.5 rounded">
                                                    <User size={10} /> Humano
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-surface relative">
                    {selectedContact ? (
                        <>
                            <div className="p-4 border-b border-border flex items-center justify-between bg-zinc-900/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-black text-white leading-none">{selectedContact.name}</h3>
                                            {selectedContact.lead_score && (
                                                <span className="bg-primary/20 text-primary text-[9px] font-black px-1.5 py-0.5 rounded border border-primary/30 uppercase tracking-widest">
                                                    Score: {selectedContact.lead_score}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs text-zinc-500 font-mono">{selectedContact.phone}</p>
                                            {selectedContact.memory_summary && (
                                                <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] bg-zinc-800/50 px-2 py-0.5 rounded-lg border border-border/50">
                                                    <Brain size={12} className="text-primary" />
                                                    <span className="truncate max-w-[200px]">{selectedContact.memory_summary}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        className="bg-zinc-900 border border-border rounded-xl px-3 py-2 text-[10px] font-bold text-zinc-400 outline-none focus:ring-1 focus:ring-primary/30"
                                        value={selectedContact.assigned_to || ''}
                                        onChange={(e) => assignContact(selectedContact.id, e.target.value || null)}
                                    >
                                        <option value="">Aguardando Atendente</option>
                                        {agents.map(a => (
                                            <option key={a.id} value={a.id}>👤 {a.full_name || 'Agente'}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => toggleMode(selectedContact)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${selectedContact.handling_mode === 'human'
                                            ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                                            }`}
                                    >
                                        {selectedContact.handling_mode === 'human' ? <Smartphone size={14} /> : <Bot size={14} />}
                                        {selectedContact.handling_mode === 'human' ? 'ASSUMIR' : 'ATIVAR IA'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                                {messages.map((m, idx) => (
                                    <div key={m.id || idx} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[70%] p-4 rounded-2xl shadow-xl space-y-1 relative group ${m.role === 'user'
                                            ? 'bg-zinc-800 text-zinc-100 rounded-tl-none'
                                            : 'bg-primary text-zinc-900 rounded-tr-none font-medium'
                                            }`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                            <div className={`flex items-center gap-1 text-[9px] uppercase font-bold opacity-50 ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {m.role === 'assistant' && <Check size={10} />}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {currentSummary && (
                                    <div className="flex justify-center my-6 animate-in zoom-in-95 duration-300">
                                        <div className="bg-blue-600/20 border border-blue-500/30 p-6 rounded-3xl max-w-lg shadow-xl shadow-blue-500/5 backdrop-blur-md relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <Zap size={60} className="text-blue-400" />
                                            </div>
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="bg-blue-500 p-1.5 rounded-lg">
                                                    <Zap size={14} className="text-white fill-white" />
                                                </div>
                                                <h4 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em]">Contexto Inteligente (IA)</h4>
                                                <button onClick={() => setCurrentSummary(null)} className="ml-auto text-blue-400/50 hover:text-blue-400 transition-colors">×</button>
                                            </div>
                                            <p className="text-sm text-blue-100/90 leading-relaxed font-medium italic">
                                                "{currentSummary}"
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-6 bg-zinc-900/50 border-t border-border">
                                {selectedContact.handling_mode === 'ai' && (
                                    <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                                        <ShieldAlert className="text-blue-500" size={18} />
                                        <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">
                                            Modo IA Ativo: As respostas manuais serão desativadas para evitar conflitos.
                                        </p>
                                    </div>
                                )}
                                <form onSubmit={handleSendMessage} className="flex gap-4">
                                    <div className="flex-1 relative">
                                        <input
                                            disabled={selectedContact.handling_mode === 'ai' || sending}
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder={selectedContact.handling_mode === 'ai' ? "Ative o modo humano para digitar..." : "Digite sua mensagem..."}
                                            className="w-full bg-surface border border-border rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed pr-40"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleGetSummary}
                                                disabled={summarizing || messages.length === 0}
                                                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-all flex items-center gap-2 group disabled:opacity-30"
                                                title="Resumo da Conversa"
                                            >
                                                {summarizing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                                <span className="text-[10px] font-black uppercase hidden group-hover:inline">Resumo</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleGetSuggestion}
                                                disabled={coaching || selectedContact.handling_mode === 'ai'}
                                                className="p-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all flex items-center gap-2 group disabled:opacity-30"
                                                title="Sugestão IA"
                                            >
                                                {coaching ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                                                <span className="text-[10px] font-black uppercase hidden group-hover:inline">Treinador</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowNotes(!showNotes)}
                                                className={`p-2 border rounded-xl transition-all flex items-center gap-2 group ${showNotes ? 'bg-amber-500 text-zinc-900 border-amber-600' : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/20'}`}
                                                title="Notas do Cliente"
                                            >
                                                <StickyNote size={16} />
                                                <span className="text-[10px] font-black uppercase hidden group-hover:inline">Notas</span>
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        disabled={selectedContact.handling_mode === 'ai' || sending || !newMessage.trim()}
                                        type="submit"
                                        className="bg-primary hover:bg-primaryHover text-zinc-900 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 transition-all transform active:scale-95 disabled:grayscale shrink-0"
                                    >
                                        {sending ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                                    </button>
                                </form>

                                {showNotes && (
                                    <div className="mt-6 p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl animate-in slide-in-from-top-4 duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-2">
                                                <StickyNote size={14} /> Dossier do Cliente (Privado)
                                            </h4>
                                            <div className="flex gap-2">
                                                <button onClick={() => setShowNotes(false)} className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 px-2 py-1 uppercase transition-colors">Fechar</button>
                                                <button onClick={handleSaveNotes} className="text-[10px] font-black bg-amber-500 text-zinc-900 px-4 py-1.5 rounded-lg uppercase hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">Salvar Notas</button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={contactNotes}
                                            onChange={e => setContactNotes(e.target.value)}
                                            placeholder="Escreva segredos, detalhes de negociação ou informações cruciais sobre este cliente que apenas humanos devem ver..."
                                            className="w-full h-32 bg-zinc-900/50 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-100 focus:outline-none focus:border-amber-500 transition-all placeholder:text-amber-500/20 resize-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-4">
                            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-800 border-2 border-dashed border-zinc-800">
                                <MessageCircle size={40} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black text-zinc-300">Selecione uma conversa</h3>
                                <p className="text-sm font-medium">Suas conversas que precisam de atenção aparecerão aqui.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveChat;
