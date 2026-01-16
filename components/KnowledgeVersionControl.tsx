import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { generateEmbedding } from '../services/geminiService';
import {
    FileText,
    History,
    Trash2,
    AlertTriangle,
    CheckCircle,
    Clock,
    Plus,
    Search,
    ChevronRight,
    ShieldAlert
} from 'lucide-react';

interface Document {
    id: string;
    title: string;
    content: string;
    category: string;
    priority: number;
    version: number;
    created_at: string;
    is_active: boolean;
    expires_at: string | null;
    replaced_by: string | null;
    tags?: string[];
}

interface Props {
    initialData?: {
        title: string;
        content: string;
        category: string;
        source_audit_id?: string;
    };
    onClearData?: () => void;
}

export const KnowledgeVersionControl: React.FC<Props> = ({ initialData, onClearData }) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // New Version Form State
    const [newContent, setNewContent] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [category, setCategory] = useState('general');
    const [priority, setPriority] = useState(5);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // Default Tags
    const AVAILABLE_TAGS = ['vendas', 'suporte', 'tecnico', 'contratos', 'financeiro'];

    useEffect(() => {
        fetchDocuments();
    }, []);

    useEffect(() => {
        if (initialData) {
            handleCreateNewDocWithData(initialData);
        }
    }, [initialData]);

    const handleCreateNewDocWithData = async (data: any) => {
        const title = prompt("Título do documento (Pode editar):", data.title);
        if (!title) {
            if (onClearData) onClearData();
            return;
        }

        const content = prompt("Conteúdo (Pode editar):", data.content);
        if (!content) {
            if (onClearData) onClearData();
            return;
        }

        try {
            const embedding = await generateEmbedding(content);
            const { error } = await supabase.from('documents').insert({
                title,
                content,
                category: data.category || 'general',
                priority: 5,
                version: 1,
                is_active: true,
                embedding: embedding,
                tags: [] // Default for quick create
            });
            if (error) throw error;

            if (data.source_audit_id) {
                await supabase.from('conversation_audits')
                    .update({ status: 'resolved' })
                    .eq('id', data.source_audit_id);
                alert("Documento criado e auditoria resolvida!");
            } else {
                alert("Documento criado com sucesso!");
            }

            if (onClearData) onClearData();
            fetchDocuments();
        } catch (error: any) {
            alert("Erro ao criar: " + error.message);
        }
    };

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            console.error("Error fetching documents:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleCreateNewDoc = async () => {
        const title = prompt("Título do documento:");
        const content = prompt("Conteúdo inicial:");
        if (!title || !content) return;

        try {
            const embedding = await generateEmbedding(content);
            const { error } = await supabase.from('documents').insert({
                title,
                content,
                category: category || 'general',
                priority: priority || 5,
                version: 1,
                is_active: true,
                embedding: embedding,
                tags: [] // Default empty
            });
            if (error) throw error;
            fetchDocuments();
        } catch (error: any) {
            alert("Erro ao criar: " + error.message);
        }
    };

    const handleDeleteDoc = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este documento?")) return;
        try {
            const { error } = await supabase.from('documents').delete().eq('id', id);
            if (error) throw error;
            setSelectedDoc(null);
            fetchDocuments();
        } catch (error: any) {
            alert("Erro ao excluir: " + error.message);
        }
    };

    const handleCreateVersion = async (originalDoc: Document) => {
        if (!newContent.trim()) return;

        try {
            const embedding = await generateEmbedding(newContent);
            // 1. Insert new document (v+1)
            const { data: newDoc, error: insertError } = await supabase
                .from('documents')
                .insert({
                    title: originalDoc.title,
                    content: newContent,
                    category: category || originalDoc.category,
                    priority: priority || originalDoc.priority,
                    version: originalDoc.version + 1,
                    expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
                    is_active: true,
                    embedding: embedding,
                    tags: selectedTags
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // 2. Mark old document as inactive and replaced
            const { error: updateError } = await supabase
                .from('documents')
                .update({
                    is_active: false,
                    replaced_by: newDoc.id
                })
                .eq('id', originalDoc.id);

            if (updateError) throw updateError;

            alert("Nova versão criada com sucesso!");
            setIsEditing(false);
            fetchDocuments();
            setSelectedDoc(null);

        } catch (error: any) {
            alert("Erro ao criar versão: " + error.message);
        }
    };

    const getStatusBadge = (doc: Document) => {
        if (!doc.is_active) {
            if (doc.replaced_by) return <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1"><History size={10} /> Substituído</span>;
            return <span className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-400 border border-zinc-600">Arquivado</span>;
        }
        if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
            return <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1"><AlertTriangle size={10} /> Expirado</span>;
        }
        return (
            <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><CheckCircle size={10} /> Ativo</span>
                <span className={`px-2 py-0.5 rounded text-xs border ${doc.category === 'promotion' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    doc.category === 'product' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    }`}>
                    {doc.category.toUpperCase()}
                </span>
            </div>
        );
    };

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                        <ShieldAlert className="text-blue-500" size={20} /> Base de Conhecimento
                    </h3>
                    <button
                        onClick={handleCreateNewDoc}
                        className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                    >
                        <Plus size={12} /> Novo Doc
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        placeholder="Buscar documentos..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:border-blue-500 outline-none text-zinc-300 w-64 transition-all"
                    />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Document List */}
                <div className="w-1/3 border-r border-zinc-800 overflow-y-auto p-2 space-y-2 bg-zinc-900/30">
                    {loading ? (
                        <p className="text-zinc-500 text-center py-8">Carregando...</p>
                    ) : filteredDocs.length === 0 ? (
                        <p className="text-zinc-600 text-center py-8 text-xs italic">Nenhum documento encontrado.</p>
                    ) : filteredDocs.map(doc => (
                        <div
                            key={doc.id}
                            onClick={() => { setSelectedDoc(doc); setIsEditing(false); }}
                            className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedDoc?.id === doc.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-800/20 border-transparent hover:bg-zinc-800/50 hover:border-zinc-700'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-medium text-sm text-zinc-200 line-clamp-1">{doc.title}</h4>
                                <span className="text-[10px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-500">v{doc.version}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                {getStatusBadge(doc)}
                                <span className="text-[10px] text-zinc-600">{new Date(doc.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Detail View */}
                <div className="flex-1 bg-zinc-950/50 p-6 overflow-y-auto">
                    {selectedDoc ? (
                        <div className="max-w-2xl mx-auto">
                            {!isEditing ? (
                                <>
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold text-zinc-100 mb-1">{selectedDoc.title}</h2>
                                            <div className="flex items-center gap-3 text-sm text-zinc-500">
                                                <span>Versão {selectedDoc.version}</span>
                                                <span>•</span>
                                                <span>{new Date(selectedDoc.created_at).toLocaleString()}</span>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                {selectedDoc.tags && selectedDoc.tags.map(tag => (
                                                    <span key={tag} className="text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleDeleteDoc(selectedDoc.id)}
                                                className="bg-red-500/10 text-red-500 p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            {selectedDoc.is_active && (
                                                <button
                                                    onClick={() => {
                                                        setNewContent(selectedDoc.content);
                                                        setExpiryDate(selectedDoc.expires_at ? selectedDoc.expires_at.split('T')[0] : '');
                                                        setCategory(selectedDoc.category || 'general');
                                                        setPriority(selectedDoc.priority || 5);
                                                        setSelectedTags(selectedDoc.tags || []);
                                                        setIsEditing(true);
                                                    }}
                                                    className="bg-primary text-zinc-900 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primaryHover transition-colors"
                                                >
                                                    <Plus size={16} /> Nova Versão
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-6">
                                        <div className="prose prose-invert max-w-none text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                                            {selectedDoc.content}
                                        </div>
                                    </div>

                                    {selectedDoc.expires_at && (
                                        <div className="flex items-center gap-2 text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg text-sm border border-yellow-500/20">
                                            <Clock size={16} /> Válido até: {new Date(selectedDoc.expires_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="flex items-center gap-2 mb-6 text-zinc-400 cursor-pointer hover:text-white" onClick={() => setIsEditing(false)}>
                                        <ChevronRight className="rotate-180" size={16} /> Voltar
                                    </div>

                                    <h2 className="text-lg font-bold text-zinc-100 mb-4">Criar Versão {selectedDoc.version + 1}</h2>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1">Conteúdo Atualizado</label>
                                            <textarea
                                                value={newContent}
                                                onChange={e => setNewContent(e.target.value)}
                                                className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 focus:border-primary outline-none resize-none"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">Categoria</label>
                                                <select
                                                    value={category}
                                                    onChange={e => setCategory(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:border-primary outline-none"
                                                >
                                                    <option value="general">Geral</option>
                                                    <option value="product">Produto/Serviço</option>
                                                    <option value="promotion">Promoção</option>
                                                    <option value="internal">Interno</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">Prioridade (Peso: {priority})</label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    value={priority}
                                                    onChange={e => setPriority(parseInt(e.target.value))}
                                                    className="w-full mt-2 accent-primary"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">Validade (Opcional)</label>
                                                <input
                                                    type="date"
                                                    value={expiryDate}
                                                    onChange={e => setExpiryDate(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:border-primary outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Tags Selection */}
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-2">Tags de Conhecimento</label>
                                            <div className="flex flex-wrap gap-2">
                                                {AVAILABLE_TAGS.map(tag => (
                                                    <button
                                                        key={tag}
                                                        onClick={() => {
                                                            if (selectedTags.includes(tag)) {
                                                                setSelectedTags(selectedTags.filter(t => t !== tag));
                                                            } else {
                                                                setSelectedTags([...selectedTags, tag]);
                                                            }
                                                        }}
                                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${selectedTags.includes(tag)
                                                            ? 'bg-primary text-zinc-900 border-primary'
                                                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                                                            }`}
                                                    >
                                                        {tag.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 mt-6">
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={() => handleCreateVersion(selectedDoc)}
                                                className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-zinc-900 hover:bg-primaryHover transition-colors"
                                            >
                                                Publicar Versão
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p>Selecione um documento para ver o histórico</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
