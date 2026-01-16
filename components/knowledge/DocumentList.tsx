import React, { useState } from 'react';
import { Search, Plus, Filter, SortAsc, FileText, Clock, ChevronRight } from 'lucide-react';

interface Document {
    id: string;
    title: string;
    content: string;
    category: string;
    updated_at: string;
    created_at: string;
    version: number;
    is_active: boolean;
    tags?: string[];
}

interface DocumentListProps {
    documents: Document[];
    selectedDocId?: string;
    onSelectDoc: (doc: Document) => void;
    onNewDoc: () => void;
    isLoading: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
    documents,
    selectedDocId,
    onSelectDoc,
    onNewDoc,
    isLoading
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex-1 flex flex-col bg-zinc-900 border-r border-zinc-800 min-w-[300px] max-w-[400px]">
            {/* Search & Utility Bar */}
            <div className="p-4 border-b border-zinc-800 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        placeholder="Buscar documentos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 outline-none focus:border-primary transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onNewDoc}
                        className="flex-1 bg-primary text-zinc-900 text-sm font-bold py-2 rounded-lg hover:bg-primaryHover transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Novo
                    </button>
                    <button className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors" title="Filtrar">
                        <Filter size={16} />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Carregando...</span>
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500">
                        <p className="text-sm">Nenhum documento encontrado.</p>
                    </div>
                ) : (
                    filteredDocs.map(doc => (
                        <div
                            key={doc.id}
                            onClick={() => onSelectDoc(doc)}
                            className={`p-3 rounded-lg cursor-pointer border transition-all group ${selectedDocId === doc.id
                                    ? 'bg-zinc-800 border-zinc-700 shadow-sm'
                                    : 'border-transparent hover:bg-zinc-800/50 hover:border-zinc-700/50'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-medium text-sm line-clamp-2 ${selectedDocId === doc.id ? 'text-white' : 'text-zinc-300 group-hover:text-zinc-100'}`}>
                                    {doc.title || 'Sem Título'}
                                </h4>
                                {!doc.is_active && (
                                    <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">Arq.</span>
                                )}
                            </div>

                            <p className="text-[11px] text-zinc-500 line-clamp-2 mb-2">
                                {doc.content || 'Sem conteúdo...'}
                            </p>

                            <div className="flex justify-between items-center text-[10px] text-zinc-600">
                                <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded border ${doc.category === 'sales' ? 'border-emerald-500/20 text-emerald-500' :
                                            doc.category === 'support' ? 'border-blue-500/20 text-blue-500' :
                                                'border-zinc-700 text-zinc-500'
                                        }`}>
                                        {doc.category || 'Geral'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        v{doc.version}
                                    </span>
                                </div>
                                <span className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {new Date(doc.updated_at || doc.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
