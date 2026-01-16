import React, { useState, useEffect } from 'react';
import { Save, Trash2, Clock, Tag, Globe, MoreHorizontal, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { toast } from 'sonner';

interface Document {
    id?: string;
    title: string;
    content: string;
    category: string;
    priority: number;
    version: number;
    is_active: boolean;
    expires_at?: string;
    tags?: string[];
}

interface DocumentEditorProps {
    initialDoc?: Document;
    onSave: (doc: Document) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
    initialDoc,
    onSave,
    onDelete,
    onCancel,
    isSaving
}) => {
    const [doc, setDoc] = useState<Document>({
        title: '',
        content: '',
        category: 'general',
        priority: 5,
        version: 1,
        is_active: true,
        tags: []
    });

    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        if (initialDoc) {
            setDoc(initialDoc);
        } else {
            // Reset for new doc
            setDoc({
                title: '',
                content: '',
                category: 'general',
                priority: 5,
                version: 1,
                is_active: true,
                tags: []
            });
        }
    }, [initialDoc]);

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!doc.tags?.includes(tagInput.trim())) {
                setDoc({ ...doc, tags: [...(doc.tags || []), tagInput.trim()] });
            }
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setDoc({ ...doc, tags: doc.tags?.filter(tag => tag !== tagToRemove) });
    };

    return (
        <div className="flex-1 bg-zinc-950 flex flex-col h-full overflow-hidden">
            {/* Editor Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="md:hidden text-zinc-400">
                        <ArrowLeft />
                    </button>
                    <div>
                        <input
                            type="text"
                            value={doc.title}
                            onChange={(e) => setDoc({ ...doc, title: e.target.value })}
                            placeholder="Título do Documento"
                            className="bg-transparent text-xl font-bold text-zinc-100 placeholder-zinc-600 outline-none w-full"
                        />
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                            <span className="bg-zinc-800 px-2 py-0.5 rounded">v{doc.version}</span>
                            <span>•</span>
                            <span className={doc.is_active ? 'text-emerald-500' : 'text-zinc-500'}>
                                {doc.is_active ? 'Ativo' : 'Rascunho/Inativo'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {initialDoc?.id && onDelete && (
                        <button
                            onClick={() => onDelete(initialDoc.id!)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <button
                        onClick={() => onSave(doc)}
                        disabled={isSaving || !doc.title.trim() || !doc.content.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-zinc-900 font-bold rounded-lg hover:bg-primaryHover disabled:opacity-50 transition-all"
                    >
                        {isSaving ? <MoreHorizontal className="animate-pulse" /> : <Save size={18} />}
                        <span>Salvar</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Main Content Area */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <textarea
                        value={doc.content}
                        onChange={(e) => setDoc({ ...doc, content: e.target.value })}
                        placeholder="Escreva o conteúdo aqui..."
                        className="w-full h-full bg-transparent text-zinc-300 resize-none outline-none leading-relaxed text-sm font-mono scrollbar-thin scrollbar-thumb-zinc-800"
                    />
                </div>

                {/* Right Sidebar for Metadata */}
                <div className="w-full md:w-72 border-l border-zinc-800 bg-zinc-900/50 p-4 overflow-y-auto">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Configurações</h3>

                    <div className="space-y-6">
                        {/* Category */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                                <Globe size={14} /> Categoria
                            </label>
                            <select
                                value={doc.category}
                                onChange={(e) => setDoc({ ...doc, category: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 outline-none focus:border-primary"
                            >
                                <option value="general">Geral</option>
                                <option value="sales">Vendas</option>
                                <option value="support">Suporte</option>
                                <option value="technical">Técnico</option>
                                <option value="contracts">Contratos</option>
                                <option value="finance">Financeiro</option>
                            </select>
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                                <Tag size={14} /> Tags
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {doc.tags?.map(tag => (
                                    <span key={tag} className="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-1 rounded flex items-center gap-1 group">
                                        {tag}
                                        <button onClick={() => removeTag(tag)} className="hover:text-red-400"><Trash2 size={10} /></button>
                                    </span>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                placeholder="Add tag + Enter"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 outline-none focus:border-primary"
                            />
                        </div>

                        {/* Priority */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                                <AlertTriangle size={14} /> Prioridade (1-10)
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={doc.priority}
                                onChange={(e) => setDoc({ ...doc, priority: parseInt(e.target.value) })}
                                className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-[10px] text-zinc-600">
                                <span>Baixa</span>
                                <span>{doc.priority}</span>
                                <span>Alta</span>
                            </div>
                        </div>

                        {/* Expiry */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                                <Clock size={14} /> Validade (Opcional)
                            </label>
                            <input
                                type="date"
                                value={doc.expires_at ? doc.expires_at.split('T')[0] : ''}
                                onChange={(e) => setDoc({ ...doc, expires_at: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 outline-none focus:border-primary"
                            />
                        </div>

                        {/* Status Toggle */}
                        <div className="flex items-center justify-between p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                            <span className="text-xs font-medium text-zinc-400">Ativo</span>
                            <button
                                onClick={() => setDoc({ ...doc, is_active: !doc.is_active })}
                                className={`w-10 h-5 rounded-full relative transition-colors ${doc.is_active ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                            >
                                <span className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${doc.is_active ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
