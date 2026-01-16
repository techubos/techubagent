import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    BookOpen,
    Plus,
    FileText,
    Search,
    Trash2,
    Upload,
    Loader2,
    ChevronRight,
    BrainCircuit,
    Layers
} from 'lucide-react';

interface Playbook {
    id: string;
    name: string;
    description: string;
    created_at: string;
}

interface PlaybookDocument {
    id: string;
    playbook_id: string;
    title: string;
    content: string;
    created_at: string;
}

const PlaybookManager: React.FC = () => {
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
    const [documents, setDocuments] = useState<PlaybookDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [newPlaybookName, setNewPlaybookName] = useState('');

    useEffect(() => {
        fetchPlaybooks();
    }, []);

    useEffect(() => {
        if (selectedPlaybook) {
            fetchDocuments(selectedPlaybook.id);
        }
    }, [selectedPlaybook]);

    const fetchPlaybooks = async () => {
        setLoading(true);
        const { data } = await supabase.from('playbooks').select('*').order('created_at', { ascending: false });
        setPlaybooks(data || []);
        setLoading(false);
    };

    const fetchDocuments = async (playbookId: string) => {
        const { data } = await supabase.from('playbook_documents').select('*').eq('playbook_id', playbookId);
        setDocuments(data || []);
    };

    const handleCreatePlaybook = async () => {
        if (!newPlaybookName) return;
        const { data, error } = await supabase.from('playbooks').insert({ name: newPlaybookName }).select();
        if (data) {
            setPlaybooks([data[0], ...playbooks]);
            setNewPlaybookName('');
            setSelectedPlaybook(data[0]);
        }
    };

    const handleUploadDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedPlaybook || !e.target.files) return;
        setUploading(true);

        // Simulating text processing for now
        // In a real scenario, we'd use an Edge Function for OCR/PDF extraction
        for (const fileObj of Array.from(e.target.files)) {
            const file = fileObj as File;
            const content = `[Simulação de conteúdo extraído de ${file.name}]`;
            await supabase.from('playbook_documents').insert({
                playbook_id: selectedPlaybook.id,
                title: file.name,
                content: content
            });
        }

        fetchDocuments(selectedPlaybook.id);
        setUploading(false);
    };

    const deletePlaybook = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Excluir este Playbook? Todos os documentos serão perdidos.')) return;
        await supabase.from('playbooks').delete().eq('id', id);
        if (selectedPlaybook?.id === id) setSelectedPlaybook(null);
        fetchPlaybooks();
    };

    const deleteDocument = async (id: string) => {
        if (!confirm('Excluir este documento?')) return;
        await supabase.from('playbook_documents').delete().eq('id', id);
        if (selectedPlaybook) fetchDocuments(selectedPlaybook.id);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="mb-12 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-white flex items-center gap-3">
                        <BookOpen className="text-primary" size={40} />
                        Playbooks de Inteligência
                    </h1>
                    <p className="text-zinc-500 mt-2 font-medium">Gerencie o conhecimento especializado do seu time.</p>
                </div>
                <div className="flex items-center gap-4 bg-surface p-2 rounded-2xl border border-border">
                    <input
                        type="text"
                        placeholder="Novo Playbook..."
                        value={newPlaybookName}
                        onChange={e => setNewPlaybookName(e.target.value)}
                        className="bg-zinc-900 border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 ring-primary outline-none"
                    />
                    <button
                        onClick={handleCreatePlaybook}
                        className="bg-primary text-zinc-900 px-4 py-2 rounded-xl font-black text-xs hover:opacity-90 transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> CRIAR
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* Playbook List */}
                <div className="col-span-4 space-y-4">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-2">Coleções Ativas</h3>
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-zinc-700" /></div>
                    ) : (
                        playbooks.map(pb => (
                            <div
                                key={pb.id}
                                onClick={() => setSelectedPlaybook(pb)}
                                className={`group p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedPlaybook?.id === pb.id ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' : 'bg-surface border-border hover:border-zinc-700'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${selectedPlaybook?.id === pb.id ? 'bg-primary text-zinc-900' : 'bg-zinc-900 text-zinc-400 group-hover:text-white'}`}>
                                            <Layers size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white">{pb.name}</h4>
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase">{new Date(pb.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button onClick={(e) => deletePlaybook(pb.id, e)} className="p-2 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Document Area */}
                <div className="col-span-8">
                    {selectedPlaybook ? (
                        <div className="bg-surface border border-border rounded-3xl overflow-hidden min-h-[600px] flex flex-col">
                            <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
                                <div>
                                    <h2 className="text-2xl font-black text-white">{selectedPlaybook.name}</h2>
                                    <p className="text-sm text-zinc-500">Documentos indexados para este playbook.</p>
                                </div>
                                <label className="cursor-pointer bg-white text-zinc-900 px-6 py-3 rounded-2xl font-black text-sm hover:bg-zinc-200 transition-all flex items-center gap-2">
                                    {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                    UPAR DOCUMENTOS
                                    <input type="file" multiple className="hidden" onChange={handleUploadDocuments} disabled={uploading} />
                                </label>
                            </div>

                            <div className="p-8 flex-1">
                                {documents.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        {documents.map(doc => (
                                            <div key={doc.id} className="bg-zinc-900 border border-border p-4 rounded-2xl group hover:border-primary/30 transition-all">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-500">
                                                            <FileText size={18} />
                                                        </div>
                                                        <div className="max-w-[180px]">
                                                            <h5 className="text-sm font-bold text-white truncate">{doc.title}</h5>
                                                            <span className="text-[10px] text-zinc-500">Indexado</span>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => deleteDocument(doc.id)} className="p-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale py-20">
                                        <BrainCircuit size={80} />
                                        <p className="mt-4 font-black">Nenhum documento indexado</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-zinc-900/50 border-t border-border mt-auto">
                                <div className="flex items-center gap-3 text-primary">
                                    <Search size={16} />
                                    <span className="text-xs font-black uppercase tracking-widest">Busca Híbrida Ativada</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-zinc-900/20 border-2 border-dashed border-border rounded-3xl opacity-30">
                            <BookOpen size={60} />
                            <p className="mt-4 font-black">Selecione um Playbook para gerenciar</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlaybookManager;
