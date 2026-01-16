import React from 'react';
import {
    Library,
    Tag,
    FileText,
    Settings,
    Sparkles,
    Archive,
    History
} from 'lucide-react';

interface KnowledgeSidebarProps {
    activeCategory: string;
    onSelectCategory: (category: string) => void;
    stats?: {
        total: number;
        active: number;
        archived: number;
    };
}

export const KnowledgeSidebar: React.FC<KnowledgeSidebarProps> = ({
    activeCategory,
    onSelectCategory,
    stats
}) => {
    const categories = [
        { id: 'all', label: 'Todos os Documentos', icon: Library },
        { id: 'favorite', label: 'Favoritos / Importantes', icon: Sparkles },
        { id: 'general', label: 'Geral', icon: FileText },
        { id: 'sales', label: 'Vendas', icon: Tag },
        { id: 'support', label: 'Suporte', icon: Tag },
        { id: 'technical', label: 'Técnico', icon: Settings },
        { id: 'archived', label: 'Arquivados', icon: Archive },
    ];

    return (
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
            <div className="p-4 border-b border-zinc-800">
                <h2 className="text-zinc-100 font-bold flex items-center gap-2">
                    <Library className="text-primary" size={20} />
                    Base de Conhecimento
                </h2>
                <p className="text-zinc-500 text-xs mt-1">Gerencie a sabedoria da sua IA</p>
            </div>

            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-3 py-2 mt-2">
                    Navegação
                </div>

                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => onSelectCategory(cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${activeCategory === cat.id
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <cat.icon size={16} className={activeCategory === cat.id ? 'text-primary' : 'text-zinc-500'} />
                            <span>{cat.label}</span>
                        </div>
                        {stats && cat.id === 'all' && (
                            <span className="text-xs bg-zinc-800 px-1.5 rounded-full text-zinc-400">{stats.total}</span>
                        )}
                        {stats && cat.id === 'archived' && (
                            <span className="text-xs bg-zinc-800 px-1.5 rounded-full text-zinc-400">{stats.archived}</span>
                        )}
                    </button>
                ))}

                {/* Placeholder for future expansion */}
                <div className="pt-4 border-t border-zinc-800 mt-4">
                    {/* Add specific tags or dynamic categories here if needed */}
                </div>
            </nav>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Sparkles size={14} className="text-primary" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-zinc-200">IA Status</p>
                        <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Sincronizado
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
