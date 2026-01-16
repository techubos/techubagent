import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { AlertTriangle, Check, X, BookPlus, Loader2, RefreshCw } from 'lucide-react';

interface AuditIssue {
    id: string;
    chat_id: string;
    issue_type: 'knowledge_gap' | 'negative_sentiment' | 'repetition';
    description: string;
    suggested_fix: string;
    status: 'pending' | 'resolved' | 'ignored';
    created_at: string;
}

interface AuditDashboardProps {
    onNavigate?: (data: any) => void;
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({ onNavigate }) => {
    const [issues, setIssues] = useState<AuditIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    const fetchIssues = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('conversation_audits')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setIssues(data as AuditIssue[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchIssues();
    }, []);

    const handleAction = async (id: string, status: 'resolved' | 'ignored') => {
        setResolvingId(id);
        const { error } = await supabase
            .from('conversation_audits')
            .update({ status })
            .eq('id', id);

        if (!error) {
            setIssues(prev => prev.filter(i => i.id !== id));
        }
        setResolvingId(null);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'knowledge_gap': return <BookPlus className="text-orange-400" size={20} />;
            case 'negative_sentiment': return <AlertTriangle className="text-red-400" size={20} />;
            case 'repetition': return <RefreshCw className="text-yellow-400" size={20} />;
            default: return <AlertTriangle className="text-gray-400" size={20} />;
        }
    };

    const getLabel = (type: string) => {
        switch (type) {
            case 'knowledge_gap': return 'Lacuna de Conhecimento';
            case 'negative_sentiment': return 'Sentimento Negativo';
            case 'repetition': return 'Repetição / Loop';
            default: return type;
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 p-6 overflow-hidden">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Auditoria de Inteligência</h1>
                    <p className="text-zinc-400">Identifique e corrija falhas na comunicação da IA.</p>
                </div>
                <button
                    onClick={fetchIssues}
                    className="p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                    title="Atualizar lista"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-zinc-500 gap-2">
                    <Loader2 className="animate-spin" /> Carregando auditorias...
                </div>
            ) : issues.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                    <Check size={48} className="text-green-500 mb-4 opacity-20" />
                    <p>Nenhuma pendência encontrada.</p>
                    <p className="text-sm">A IA está operando normalmente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto pb-4">
                    {issues.map(issue => (
                        <div key={issue.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                                        {getIcon(issue.issue_type)}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-zinc-200">{getLabel(issue.issue_type)}</h3>
                                        <span className="text-xs text-zinc-500">
                                            {new Date(issue.created_at).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleAction(issue.id, 'ignored')}
                                        disabled={!!resolvingId}
                                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition"
                                        title="Ignorar"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleAction(issue.id, 'resolved')}
                                        disabled={!!resolvingId}
                                        className="p-2 hover:bg-green-900/30 rounded-lg text-green-600 hover:text-green-500 transition"
                                        title="Marcar como resolvido"
                                    >
                                        {resolvingId === issue.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Problema</span>
                                    <p className="text-sm text-zinc-300 mt-1">{issue.description}</p>
                                </div>

                                {issue.suggested_fix && (
                                    <div className="bg-blue-900/10 border border-blue-900/30 rounded-lg p-3">
                                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <BookPlus size={12} /> Sugestão de Correção
                                        </span>
                                        <p className="text-sm text-blue-200 mt-1 mb-2">{issue.suggested_fix}</p>

                                        <button
                                            onClick={() => {
                                                if (onNavigate) {
                                                    onNavigate({
                                                        title: `Correção: ${getLabel(issue.issue_type)} - Ref: ${issue.chat_id.slice(0, 4)}`,
                                                        content: issue.suggested_fix,
                                                        category: 'technical',
                                                        source_audit_id: issue.id
                                                    });
                                                }
                                            }}
                                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1 transition"
                                        >
                                            <BookPlus size={12} /> Criar Documento & Resolver
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
