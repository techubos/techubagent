import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Send, Users, Hash, User, Loader2 } from 'lucide-react';

interface InternalMessage {
    id: string;
    content: string;
    sender_id: string;
    channel: string;
    created_at: string;
    sender_email?: string; // We'll try to fetch this
}

export const InternalChat: React.FC = () => {
    const [messages, setMessages] = useState<InternalMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        getUser();
        fetchMessages();

        // Realtime Subscription
        const channel = supabase
            .channel('internal_chat')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, (payload) => {
                const newMsg = payload.new as InternalMessage;
                // Ideally trigger a refetch to get sender info if we joined data, but for now just push it
                // We'll simplisticly push it. In prod, we'd join with profiles.
                setMessages(prev => [...prev, newMsg]);
                scrollToBottom();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchMessages = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('internal_messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) console.error("Error fetching chat:", error);
        else setMessages(data || []);
        setLoading(false);
        scrollToBottom();
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !userId) return;

        const text = newMessage;
        setNewMessage(''); // optimistic clear

        const { error } = await supabase.from('internal_messages').insert({
            content: text,
            sender_id: userId,
            channel: 'general'
        });

        if (error) {
            console.error("Error sending:", error);
            alert("Erro ao enviar mensagem.");
            setNewMessage(text); // restore
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-white/5 bg-zinc-950/50 flex flex-col hidden md:flex">
                <div className="p-4 border-b border-white/5 font-black uppercase tracking-widest text-xs flex items-center gap-2 text-primary">
                    <Users size={14} /> Equipe TecHub
                </div>
                <div className="flex-1 p-4 space-y-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Canais</div>
                    <button className="w-full text-left px-3 py-2 rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-2 text-sm font-medium">
                        <Hash size={14} />
                        geral
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded text-zinc-500 hover:text-white hover:bg-white/5 flex items-center gap-2 text-sm font-medium transition-colors">
                        <Hash size={14} />
                        anúncios
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded text-zinc-500 hover:text-white hover:bg-white/5 flex items-center gap-2 text-sm font-medium transition-colors">
                        <Hash size={14} />
                        vendas
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-14 border-b border-white/5 flex items-center px-6 bg-zinc-950/80 backdrop-blur">
                    <Hash size={16} className="text-zinc-500 mr-2" />
                    <span className="font-bold text-sm">geral</span>
                    <span className="text-zinc-600 text-xs ml-4">Canal principal da equipe</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-zinc-600">
                            <Loader2 className="animate-spin mr-2" /> Carregando mensagens...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center text-zinc-600 text-sm mt-10">
                            Bem-vindo ao chat da equipe! Comece a conversa.
                        </div>
                    ) : (
                        messages.map((msg, i) => {
                            const isMe = msg.sender_id === userId;
                            const showHeader = i === 0 || messages[i - 1].sender_id !== msg.sender_id;

                            return (
                                <div key={msg.id} className={`group flex gap-3 ${showHeader ? 'mt-4' : 'mt-1'}`}>
                                    {showHeader ? (
                                        <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5">
                                            <User size={14} className="text-zinc-500" />
                                        </div>
                                    ) : (
                                        <div className="w-8 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        {showHeader && (
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-xs font-bold text-zinc-300">
                                                    {isMe ? 'Eu' : 'Membro da Equipe'}
                                                </span>
                                                <span className="text-[10px] text-zinc-600">
                                                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        )}
                                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-white/5 bg-zinc-950">
                    <div className="relative">
                        <input
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enviar mensagem para #geral..."
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-4 pr-12 py-3 text-sm text-white focus:border-primary outline-none transition-all placeholder:text-zinc-600"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            className="absolute right-2 top-2 p-1.5 bg-primary text-black rounded hover:bg-primaryHover transition-colors disabled:opacity-50 disabled:bg-transparent disabled:text-zinc-600"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-2 text-center">
                        Pressione Enter para enviar
                    </div>
                </div>
            </div>
        </div>
    );
};
