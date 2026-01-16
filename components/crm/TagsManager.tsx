
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import { Tag, Plus, Trash2, Edit2, Search, X, Check, Palette } from 'lucide-react';
import { toast } from 'sonner';

interface TagData {
    id: string;
    name: string;
    color: string;
    created_at?: string;
}

const PRESET_COLORS = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#06B6D4', // Cyan
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#64748B'  // Slate
];

export const TagsManager: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const queryClient = useQueryClient();
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState<Partial<TagData>>({
        name: '',
        color: PRESET_COLORS[3]
    });

    const { data: tags = [], isLoading } = useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const { data } = await supabase.from('tags').select('*').order('name');
            return data as TagData[] || [];
        }
    });

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<TagData>) => {
            if (editingId) {
                return supabase.from('tags').update(data).eq('id', editingId);
            }
            return supabase.from('tags').insert(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            toast.success("Tag salva com sucesso!");
            setView('list');
            setEditingId(null);
            setFormData({ name: '', color: PRESET_COLORS[3] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => supabase.from('tags').delete().eq('id', id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            toast.success("Tag removida.");
        }
    });

    const handleEdit = (tag: TagData) => {
        setFormData(tag);
        setEditingId(tag.id);
        setView('editor');
    };

    if (view === 'editor') {
        return (
            <div className="flex flex-col h-full bg-zinc-950/50 backdrop-blur-md">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white">{editingId ? 'Editar Tag' : 'Nova Tag'}</h3>
                    <button onClick={() => setView('list')} className="p-2 hover:bg-white/5 rounded-full"><X size={20} className="text-zinc-500" /></button>
                </div>
                <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nome da Tag</label>
                        <input
                            placeholder="Ex: Cliente VIP"
                            className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white font-bold outline-none focus:border-primary/50"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Palette size={14} /> Cor
                        </label>
                        <div className="grid grid-cols-5 gap-3">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setFormData({ ...formData, color })}
                                    className={`h-12 rounded-xl transition-all border-2 ${formData.color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-4 bg-zinc-900 p-3 rounded-xl border border-white/5">
                            <div className="w-8 h-8 rounded-full border border-white/20" style={{ backgroundColor: formData.color }} />
                            <input
                                type="text"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                className="bg-transparent border-none text-sm text-zinc-400 font-mono outline-none flex-1 uppercase"
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center justify-center">
                        <span
                            className="px-4 py-1.5 rounded-full text-xs font-black shadow-lg"
                            style={{ backgroundColor: `${formData.color}20`, color: formData.color, border: `1px solid ${formData.color}40` }}
                        >
                            {formData.name || 'Preview da Tag'}
                        </span>
                    </div>

                    <button
                        onClick={() => saveMutation.mutate(formData)}
                        disabled={saveMutation.isPending || !formData.name}
                        className="w-full py-4 bg-primary text-black font-black rounded-xl uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saveMutation.isPending ? 'Salvando...' : <><Check size={18} /> Salvar Tag</>}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950/30 relative overflow-hidden">
            <div className="p-4 border-b border-white/5 flex gap-4 items-center shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar tags..."
                        className="w-full bg-zinc-900/50 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-primary/30"
                    />
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ name: '', color: PRESET_COLORS[3] });
                        setView('editor');
                    }}
                    className="p-2.5 bg-primary text-black rounded-xl hover:bg-primary/90 transition-all font-bold flex items-center gap-2 text-xs uppercase tracking-wider"
                >
                    <Plus size={16} /> Nova Tag
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isLoading ? (
                    <div className="text-zinc-500 text-center py-10">Carregando tags...</div>
                ) : filteredTags.length === 0 ? (
                    <div className="text-center py-10">
                        <Tag className="mx-auto text-zinc-700 mb-4" size={32} />
                        <p className="text-zinc-500 font-medium">Nenhuma tag encontrada.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredTags.map(tag => (
                            <div
                                key={tag.id}
                                className="bg-white/5 border border-white/5 p-4 rounded-xl hover:bg-white/10 transition-all group relative flex flex-col justify-between min-h-[100px]"
                            >
                                <div className="flex justify-between items-start">
                                    <span
                                        className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border shadow-sm"
                                        style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}30` }}
                                    >
                                        {tag.name}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(tag)}
                                            className="p-1.5 hover:bg-black/20 rounded text-zinc-400 hover:text-white"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm("Excluir esta tag? Contatos com ela perderão a associação visual no futuro."))
                                                    deleteMutation.mutate(tag.id)
                                            }}
                                            className="p-1.5 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-500"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-end justify-between mt-auto pt-4">
                                    <span className="text-[10px] text-zinc-600 font-mono">ID: {tag.id.slice(0, 4)}</span>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
