import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, BookOpen, Video, HelpCircle, FileText, ChevronRight, Loader2 } from 'lucide-react';

interface Article {
    id: string;
    title: string;
    category: 'tutorial' | 'faq' | 'concept';
    content: string;
    video_url?: string;
}

export const HelpCenter: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

    useEffect(() => {
        const fetchArticles = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('help_articles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) console.error("Error fetching articles:", error);
            else setArticles(data || []);
            setLoading(false);
        };

        fetchArticles();
    }, []);

    const filteredArticles = articles.filter(article => {
        const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            article.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getIcon = (category: string) => {
        switch (category) {
            case 'tutorial': return <Video size={16} className="text-blue-400" />;
            case 'faq': return <HelpCircle size={16} className="text-orange-400" />;
            default: return <FileText size={16} className="text-zinc-400" />;
        }
    };

    return (
        <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">
            {/* Sidebar / List */}
            <div className={`${selectedArticle ? 'hidden md:flex' : 'flex'} w-full md:w-96 flex-col border-r border-white/5 bg-zinc-900/30`}>
                <div className="p-6 border-b border-white/5 bg-zinc-950/50">
                    <h1 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                        <BookOpen className="text-primary" /> Central de Ajuda
                    </h1>

                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                        <input
                            placeholder="Buscar tópicos..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-primary outline-none text-white placeholder:text-zinc-600"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {['all', 'tutorial', 'faq', 'concept'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-colors ${selectedCategory === cat
                                        ? 'bg-primary text-black border-primary'
                                        : 'bg-transparent text-zinc-500 border-white/10 hover:border-white/30 hover:text-white'
                                    }`}
                            >
                                {cat === 'all' ? 'Todos' : cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-zinc-600" /></div>
                    ) : filteredArticles.length === 0 ? (
                        <div className="text-center text-zinc-600 text-sm mt-8">Nenhum artigo encontrado.</div>
                    ) : (
                        filteredArticles.map(article => (
                            <button
                                key={article.id}
                                onClick={() => setSelectedArticle(article)}
                                className={`w-full text-left p-4 rounded-xl border transition-all group ${selectedArticle?.id === article.id
                                        ? 'bg-primary/10 border-primary/30'
                                        : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800 hover:border-white/20'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                                        {getIcon(article.category)}
                                        {article.category}
                                    </div>
                                    <ChevronRight size={14} className={`text-zinc-600 transition-transform ${selectedArticle?.id === article.id ? 'translate-x-1 text-primary' : ''}`} />
                                </div>
                                <h3 className={`font-bold text-sm mb-1 ${selectedArticle?.id === article.id ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                                    {article.title}
                                </h3>
                                <p className="text-xs text-zinc-500 line-clamp-2">
                                    {article.content.substring(0, 100)}...
                                </p>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Content Viewer */}
            <div className={`flex-1 flex flex-col bg-zinc-950 ${!selectedArticle ? 'hidden md:flex' : 'flex'}`}>
                {selectedArticle ? (
                    <div className="flex-1 overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-zinc-950/90 backdrop-blur z-10 border-b border-white/5 p-6 flex justify-between items-start">
                            <div>
                                <button
                                    onClick={() => setSelectedArticle(null)}
                                    className="md:hidden mb-4 flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase"
                                >
                                    ← Voltar
                                </button>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                        {selectedArticle.category}
                                    </span>
                                </div>
                                <h1 className="text-3xl font-bold text-white leading-tight">{selectedArticle.title}</h1>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8 max-w-3xl mx-auto space-y-8">
                            {selectedArticle.video_url && (
                                <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl relative group">
                                    <iframe
                                        src={selectedArticle.video_url}
                                        className="w-full h-full"
                                        frameBorder="0"
                                        allowFullScreen
                                    />
                                </div>
                            )}

                            <div className="prose prose-invert prose-sm max-w-none">
                                <div className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                                    {selectedArticle.content}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-6">
                            <BookOpen size={32} />
                        </div>
                        <h2 className="text-lg font-bold text-white mb-2">Selecione um tópico</h2>
                        <p className="max-w-xs">Navegue pelos tutoriais e perguntas frequentes para aprender a usar o sistema.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
