import React, { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { Brain, Trash2, CheckCircle, AlertCircle } from 'lucide-react'

interface Memory {
    id: string
    category: string
    fact: string
    confidence: number
    created_at: string
}

interface MemoryPanelProps {
    contactId: string | null
}

export function MemoryPanel({ contactId }: MemoryPanelProps) {
    const [memories, setMemories] = useState<Memory[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (contactId) {
            loadMemories()
        } else {
            setMemories([])
        }
    }, [contactId])

    const loadMemories = async () => {
        if (!contactId) return
        setLoading(true)
        const { data, error } = await supabase
            .from('customer_insights')
            .select('*')
            .eq('contact_id', contactId)
            .order('confidence', { ascending: false })

        if (!error && data) {
            setMemories(data)
        }
        setLoading(false)
    }

    const deleteMemory = async (memoryId: string) => {
        const { error } = await supabase
            .from('customer_insights')
            .delete()
            .eq('id', memoryId)

        if (!error) loadMemories()
    }

    const categoryLabels: Record<string, { label: string, color: string, icon: string }> = {
        preferences: { label: 'Preferência', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: '⭐' },
        technical: { label: 'Técnico', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: '⚙️' },
        history: { label: 'Histórico', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20', icon: '📜' },
        needs: { label: 'Necessidade', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: '🎯' },
        objections: { label: 'Objeção', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: '🚫' },
        general: { label: 'Geral', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20', icon: '👤' }
    }

    const getConfidenceColor = (score: number) => {
        if (score >= 0.9) return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20'
        if (score >= 0.7) return 'bg-amber-500/20 text-amber-500 border-amber-500/20'
        return 'bg-zinc-500/20 text-zinc-500 border-zinc-500/20'
    }

    if (!contactId) {
        return (
            <div className="p-4 text-center text-zinc-500 h-full flex flex-col items-center justify-center">
                <Brain className="mx-auto mb-2 opacity-20" size={24} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Selecione um contato</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="p-4 text-center text-zinc-500 h-full flex flex-col items-center justify-center">
                <div className="animate-spin mb-2">
                    <Brain size={16} className="opacity-50" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-tighter">Minerando...</p>
            </div>
        )
    }

    if (memories.length === 0) {
        return (
            <div className="p-4 text-center text-zinc-600 h-full flex flex-col items-center justify-center">
                <Brain className="mx-auto mb-2 opacity-10" size={24} />
                <p className="text-[10px] font-black uppercase tracking-widest">Sem memórias</p>
                <p className="text-[8px] mt-1 opacity-50">A IA aprenderá com o tempo.</p>
            </div>
        )
    }

    return (
        <div className="space-y-2 p-2 h-full overflow-y-auto custom-scrollbar">
            {memories.map(memory => {
                const cat = categoryLabels[memory.category] || categoryLabels.general;
                return (
                    <div
                        key={memory.id}
                        className="bg-zinc-950/40 border border-white/5 rounded-lg p-2.5 transition group relative hover:bg-zinc-900/40"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className={`text-[8px] uppercase font-black px-1 py-0.5 rounded border flex items-center gap-1 border-white/5 ${cat.color}`}>
                                        {cat.label}
                                    </span>
                                    <span className={`text-[8px] px-1 py-0.5 rounded font-black border border-white/5 ${getConfidenceColor(memory.confidence)}`}>
                                        {Math.round(memory.confidence * 100)}%
                                    </span>
                                </div>
                                <p className="text-[11px] text-zinc-300 leading-tight font-medium">{memory.fact}</p>
                            </div>

                            <button
                                onClick={() => deleteMemory(memory.id)}
                                className="text-zinc-600 hover:text-red-500 transition p-1 opacity-0 group-hover:opacity-100 shrink-0"
                            >
                                <Trash2 size={10} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    )
}
