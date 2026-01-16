
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface TagSuggestionProps {
    searchTerm: string;
    onSelect: (tag: string) => void;
}

export const TagSuggestions: React.FC<TagSuggestionProps> = ({ searchTerm, onSelect }) => {
    const [suggestions, setSuggestions] = useState<any[]>([]);

    useEffect(() => {
        const fetchTags = async () => {
            // Basic fetch, could be optimized with React Query but simple effect is enough for this widget
            const { data } = await supabase
                .from('tags')
                .select('name, color')
                .ilike('name', `%${searchTerm}%`)
                .limit(5);

            if (data) setSuggestions(data);
        };

        if (searchTerm.length > 1) {
            const timer = setTimeout(fetchTags, 300);
            return () => clearTimeout(timer);
        } else {
            setSuggestions([]);
        }
    }, [searchTerm]);

    if (suggestions.length === 0) return null;

    return (
        <div className="absolute bottom-full mb-1 left-0 bg-zinc-900 border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px] z-50 animate-in fade-in slide-in-from-bottom-2">
            <div className="px-2 py-1 text-[8px] font-black uppercase tracking-widest text-zinc-600 border-b border-white/5 bg-black/20">Sugestões</div>
            {suggestions.map((s, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(s.name)}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 text-[10px] text-zinc-300 flex items-center gap-2 transition-colors group"
                >
                    <div className="w-2.5 h-2.5 rounded-full border border-white/10 group-hover:scale-110 transition-transform" style={{ backgroundColor: s.color }} />
                    <span className="font-medium">{s.name}</span>
                </button>
            ))}
        </div>
    );
};
