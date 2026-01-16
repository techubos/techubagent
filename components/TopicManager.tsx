import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, Tag, Save, X, Hash, Info, FileText, Loader2 } from 'lucide-react';
import { generateEmbedding } from '../services/geminiService';

interface Topic {
    id: string;
    name: string;
    description: string;
    keywords: string[];
}

export const TopicManager: React.FC = () => {
    const [topics, setTopics] = useState<Topic[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // New Topic State
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newKeywords, setNewKeywords] = useState('');

    // Add Content State
    const [isAddingContent, setIsAddingContent] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [contentLoading, setContentLoading] = useState(false);
    const [newContentText, setNewContentText] = useState('');

    useEffect(() => {
        fetchTopics();
    }, []);

    const fetchTopics = async () => {
        setLoading(true);
        const { data } = await supabase.from('knowledge_topics').select('*').order('created_at', { ascending: false });
        if (data) setTopics(data);
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newName) return;

        const keywordsArray = newKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

        const { error } = await supabase.from('knowledge_topics').insert({
            name: newName,
            description: newDesc,
            keywords: keywordsArray
        });

        if (error) {
            alert("Erro ao criar tópico: " + error.message);
        } else {
            setIsCreating(false);
            setNewName('');
            setNewDesc('');
            setNewKeywords('');
            fetchTopics();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este tópico?")) return;
        await supabase.from('knowledge_topics').delete().eq('id', id);
        fetchTopics();
    };

    const handleUpdateKeywords = async (id: string, currentKeywords: string[]) => {
        const newKws = prompt("Editar Palavras-Chaves (separadas por vírgula):", currentKeywords.join(', '));
        if (newKws === null) return;

        const keywordsArray = newKws.split(',').map(k => k.trim()).filter(k => k.length > 0);
        await supabase.from('knowledge_topics').update({ keywords: keywordsArray }).eq('id', id);
        fetchTopics();
    };

    const handleAddKnowledge = async () => {
        if (!selectedTopic || !newContentText.trim()) return;
        setContentLoading(true);
        try {
            // 1. Generate Embedding
            const embedding = await generateEmbedding(newContentText);

            // 2. Insert into documents
            const { error } = await supabase.from('documents').insert({
                title: `Contexto: ${selectedTopic.name}`,
                content: newContentText,
                category: 'topic_context',
                priority: 10, // High priority
                version: 1,
                is_active: true,
                embedding: embedding,
                tags: [selectedTopic.name] // Critical for routing
            });

            if (error) throw error;

            alert("Conhecimento adicionado com sucesso ao tópico " + selectedTopic.name);
            setIsAddingContent(false);
            setNewContentText('');
            setSelectedTopic(null);
        } catch (e: any) {
            alert("Erro ao adicionar conhecimento: " + e.message);
        } finally {
            setContentLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        <Tag className="text-pink-500" size={28} />
                        Gerenciador de Tópicos
                    </h2>
                    <p className="text-zinc-500 mt-1">Crie "gavetas" de conhecimento. A IA usará essas palavras-chaves para rotear o cliente para o agente correto.</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-pink-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-700 transition-colors shadow-lg shadow-pink-600/20"
                    >
                        <Plus size={18} /> Novo Tópico
                    </button>
                )}
            </div>

            {/* Create Form */}
            {isCreating && (
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6 shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                        <h3 className="font-bold text-white text-lg">Criar Novo Tópico</h3>
                        <button onClick={() => setIsCreating(false)}><X className="text-zinc-500 hover:text-white" /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Nome do Tópico (Tag Interna)</label>
                            <input
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-pink-500 outline-none transition-colors"
                                placeholder="Ex: Financeiro"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                            />
                            <p className="text-[10px] text-zinc-600 mt-1">Use letras minúsculas e sem espaços se possível (ex: vendas, suporte).</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Palavras-Chaves (Gatilhos)</label>
                            <input
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-pink-500 outline-none transition-colors"
                                placeholder="boleto, fatura, pix, pagar"
                                value={newKeywords}
                                onChange={e => setNewKeywords(e.target.value)}
                            />
                            <p className="text-[10px] text-zinc-600 mt-1">Separe por vírgulas (ex: <code>erro, não funciona</code>).</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Descrição (Contexto para IA)</label>
                        <input
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-pink-500 outline-none transition-colors"
                            placeholder="Dúvidas sobre pagamentos e notas fiscais."
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setIsCreating(false)} className="px-6 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-800 transition-colors">Cancelar</button>
                        <button onClick={handleCreate} className="px-6 py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 flex items-center gap-2">
                            <Save size={18} /> Salvar Tópico
                        </button>
                    </div>
                </div>
            )}

            {/* Add Knowledge Modal */}
            {isAddingContent && selectedTopic && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-700 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <FileText className="text-pink-500" />
                                Adicionar Conhecimento: <span className="text-pink-400">{selectedTopic.name}</span>
                            </h3>
                            <button onClick={() => setIsAddingContent(false)}><X className="text-zinc-500 hover:text-white" /></button>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-zinc-500 uppercase">Texto / Conteúdo (Contexto)</label>
                            <textarea
                                value={newContentText}
                                onChange={(e) => setNewContentText(e.target.value)}
                                placeholder={`Ex: Para casos de ${selectedTopic.name}, o procedimento é X, Y e Z. O prazo é de 2 dias...`}
                                className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:border-pink-500 outline-none resize-none"
                            />
                            <p className="text-xs text-zinc-600">Este texto será usado pela IA sempre que este tópico for acionado.</p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsAddingContent(false)}
                                className="px-6 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddKnowledge}
                                disabled={contentLoading || !newContentText.trim()}
                                className="px-6 py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 flex items-center gap-2 disabled:grayscale disabled:opacity-50"
                            >
                                {contentLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                {contentLoading ? 'Gerando Vetores...' : 'Salvar Conhecimento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-zinc-500"><Info className="inline mb-2 animate-bounce" /><br />Carregando gavetas...</div>
                ) : topics.length === 0 ? (
                    <div className="col-span-full py-20 bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-500 text-center space-y-4">
                        <Tag size={48} className="opacity-20" />
                        <div>
                            <p className="font-bold text-white text-lg">Nenhum tópico criado</p>
                            <p className="text-sm">Comece criando categorias para organizar o cérebro da IA.</p>
                        </div>
                    </div>
                ) : (
                    topics.map(topic => (
                        <div key={topic.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-pink-500/30 transition-all group relative">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-black text-white text-xl flex items-center gap-2">
                                        {topic.name}
                                    </h3>
                                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{topic.description}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => { setSelectedTopic(topic); setIsAddingContent(true); }}
                                        className="p-2 text-zinc-600 hover:text-pink-500 hover:bg-pink-500/10 rounded-lg transition-colors"
                                        title="Adicionar Conteúdo/Texto"
                                    >
                                        <FileText size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(topic.id)}
                                        className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Excluir Tópico"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs font-bold text-zinc-600 uppercase">Palavras-Chaves ({topic.keywords?.length || 0})</span>
                                <div className="flex flex-wrap gap-2">
                                    {topic.keywords?.slice(0, 5).map((k, i) => (
                                        <span key={i} className="text-[10px] bg-zinc-950 text-pink-400 px-2 py-1 rounded border border-zinc-800 flex items-center gap-1">
                                            <Hash size={10} /> {k}
                                        </span>
                                    ))}
                                    {(topic.keywords?.length || 0) > 5 && (
                                        <span className="text-[10px] text-zinc-600 px-1 py-1">+{topic.keywords!.length - 5}</span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleUpdateKeywords(topic.id, topic.keywords)}
                                className="mt-6 w-full py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs font-bold hover:text-pink-400 hover:border-pink-500/30 transition-colors"
                            >
                                Editar Palavras-Chaves
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 p-6 rounded-3xl flex items-start gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                    <Info size={24} />
                </div>
                <div>
                    <h4 className="font-bold text-blue-400 text-lg">Como funciona a Mágica?</h4>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                        <li>1. Você cria o tópico (Ex: <strong>"Financeiro"</strong>) e coloca palavras como <strong>"boleto, conta"</strong>.</li>
                        <li>2. No <strong>Fluxo Mestre</strong>, o "Roteador" identifica essas palavras na fala do cliente.</li>
                        <li>3. Se ele disser "quero boleto", o Roteador manda ele direto para o <strong>Agente Financeiro</strong>.</li>
                        <li>4. <strong>Novo:</strong> Use o botão de Texto (<FileText className="inline" size={12} />) para ensinar a IA o que responder nesse tópico!</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
