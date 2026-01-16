
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import { Zap, Plus, Trash2, Edit2, Play, FileAudio, Search, X, Check } from 'lucide-react';
import { toast } from 'sonner';

interface QuickResponse {
    id: string;
    title: string;
    content: string;
    message_type: 'text' | 'audio';
    media_url?: string;
    shortcut?: string;
}

interface QuickResponseManagerProps {
    onClose?: () => void;
    onSelect?: (response: QuickResponse) => void;
}

export const QuickResponseManager: React.FC<QuickResponseManagerProps> = ({ onClose, onSelect }) => {
    const isPageMode = !onClose;
    const queryClient = useQueryClient();
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Editor State
    const [formData, setFormData] = useState<Partial<QuickResponse>>({
        title: '',
        content: '',
        message_type: 'text',
        shortcut: ''
    });

    const { data: responses = [], isLoading } = useQuery({
        queryKey: ['quick-responses'],
        queryFn: async () => {
            const { data } = await supabase.from('quick_responses').select('*').order('created_at', { ascending: false });
            return data as QuickResponse[] || [];
        }
    });

    const filteredResponses = responses.filter(r =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.shortcut?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<QuickResponse>) => {
            if (editingId) {
                return supabase.from('quick_responses').update(data).eq('id', editingId);
            }
            return supabase.from('quick_responses').insert(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quick-responses'] });
            toast.success("Modelo salvo com sucesso!");
            setView('list');
            setEditingId(null);
            setFormData({ title: '', content: '', message_type: 'text', shortcut: '' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => supabase.from('quick_responses').delete().eq('id', id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quick-responses'] });
            toast.success("Modelo excluído.");
        }
    });

    const handleEdit = (response: QuickResponse) => {
        setFormData(response);
        setEditingId(response.id);
        setView('editor');
    };

    const handleSelect = (response: QuickResponse) => {
        if (onSelect) {
            onSelect(response);
            if (onClose) onClose();
        }
    };

    if (view === 'editor') {
        return (
            <div className="flex flex-col h-full bg-zinc-950/50 backdrop-blur-md">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white">{editingId ? 'Editar Modelo' : 'Novo Modelo'}</h3>
                    {onClose && <button onClick={() => setView('list')} className="p-2 hover:bg-white/5 rounded-full"><X size={20} className="text-zinc-500" /></button>}
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    <input
                        placeholder="Título (ex: Boas vindas)"
                        className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white font-bold outline-none focus:border-primary/50"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />

                    <div className="flex gap-2">
                        <button
                            onClick={() => setFormData({ ...formData, message_type: 'text' })}
                            className={`flex-1 py-3 rounded-xl border transition-all text-xs font-black uppercase tracking-widest ${formData.message_type === 'text' ? 'bg-primary text-black border-primary' : 'bg-transparent text-zinc-500 border-white/5'}`}
                        >
                            Texto
                        </button>
                        <button
                            onClick={() => setFormData({ ...formData, message_type: 'audio' })}
                            className={`flex-1 py-3 rounded-xl border transition-all text-xs font-black uppercase tracking-widest ${formData.message_type === 'audio' ? 'bg-primary text-black border-primary' : 'bg-transparent text-zinc-500 border-white/5'}`}
                        >
                            Áudio
                        </button>
                    </div>

                    {formData.message_type === 'text' ? (
                        <textarea
                            placeholder="Conteúdo da mensagem... Use {nome} para personalizar."
                            className="w-full h-40 bg-zinc-900 border border-white/5 rounded-xl p-4 text-zinc-300 outline-none focus:border-primary/50 resize-none"
                            value={formData.content}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                        />
                    ) : (
                        <input
                            placeholder="URL do arquivo de áudio (ex: bucket)"
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-zinc-300 outline-none focus:border-primary/50"
                            value={formData.media_url || ''}
                            onChange={e => setFormData({ ...formData, media_url: e.target.value })}
                        />
                    )}

                    <input
                        placeholder="Atalho (opcional, ex: /ola)"
                        className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-zinc-300 outline-none focus:border-primary/50 font-mono text-sm"
                        value={formData.shortcut || ''}
                        onChange={e => setFormData({ ...formData, shortcut: e.target.value })}
                    />

                    <button
                        onClick={() => saveMutation.mutate(formData)}
                        disabled={saveMutation.isPending}
                        className="w-full py-4 bg-primary text-black font-black rounded-xl uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                    >
                        {saveMutation.isPending ? 'Salvando...' : <><Check size={18} /> Salvar Modelo</>}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950 relative overflow-hidden">
            <div className="p-4 border-b border-white/5 flex gap-4 items-center shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar respostas rápidas..."
                        className="w-full bg-zinc-900/50 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-primary/30"
                    />
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ title: '', content: '', message_type: 'text', shortcut: '' });
                        setView('editor');
                    }}
                    className="p-2.5 bg-primary text-black rounded-xl hover:bg-primary/90 transition-all"
                >
                    <Plus size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {isLoading ? (
                    <div className="text-zinc-500 text-center py-10">Carregando...</div>
                ) : filteredResponses.length === 0 ? (
                    <div className="text-center py-10">
                        <Zap className="mx-auto text-zinc-700 mb-4" size={32} />
                        <p className="text-zinc-500 font-medium">Nenhum modelo encontrado.</p>
                    </div>
                ) : (
                    filteredResponses.map(response => (
                        <div
                            key={response.id}
                            onClick={() => handleSelect(response)}
                            className="bg-white/5 border border-white/5 p-4 rounded-xl hover:bg-white/10 transition-all cursor-pointer group relative"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white flex items-center gap-2">
                                    {response.message_type === 'audio' && <FileAudio size={14} className="text-primary" />}
                                    {response.title}
                                </h4>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEdit(response); }}
                                        className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(response.id); }}
                                        className="p-1.5 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-zinc-400 line-clamp-2">
                                {response.message_type === 'text' ? response.content : "Mensagem de áudio pré-gravada."}
                            </p>
                            {response.shortcut && (
                                <span className="inline-block mt-2 px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-500 font-mono">
                                    {response.shortcut}
                                </span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
