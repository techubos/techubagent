import React, { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { AlertTriangle, Repeat, CheckCircle2 } from 'lucide-react'

interface RepetitionAnalyticsProps {
    agentId: string
    days?: number
}

interface Pattern {
    full_response: string
    used_count: number
    last_used_at: string
}

export function RepetitionAnalytics({ agentId, days = 7 }: RepetitionAnalyticsProps) {
    const [topPatterns, setTopPatterns] = useState<Pattern[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [agentId, days])

    const loadData = async () => {
        setLoading(true)

        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        // Using a simpler query for now
        const { data, error } = await supabase
            .from('response_patterns')
            .select('full_response, used_count, last_used_at')
            .eq('agent_id', agentId)
            .gte('last_used_at', startDate.toISOString())
            .order('used_count', { ascending: false })
            .limit(10)

        if (!error && data) {
            setTopPatterns(data)
        }

        setLoading(false)
    }

    if (loading) {
        return (
            <div className="p-8 text-center text-zinc-500">
                <div className="animate-spin mb-2 w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full mx-auto"></div>
                Carregando análise...
            </div>
        )
    }

    const highRepetition = topPatterns.filter(p => p.used_count >= 5)
    const totalRepetitions = topPatterns.reduce((acc, curr) => acc + curr.used_count, 0)

    return (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                    <Repeat size={18} className="text-zinc-400" />
                    Análise de Repetições
                    <span className="text-xs font-normal text-zinc-500 ml-2">(últimos {days} dias)</span>
                </h3>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">
                    {totalRepetitions} detecções
                </span>
            </div>

            {highRepetition.length > 0 ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4 flex items-start gap-3">
                    <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-0.5" size={18} />
                    <div className="text-sm text-yellow-200/90">
                        <p className="font-bold text-yellow-500 mb-1">Atenção: {highRepetition.length} frases muito repetidas</p>
                        <p className="text-xs opacity-80 leading-relaxed">O sistema está forçando variações, mas considere adicionar mais exemplos ao prompt do sistema para enriquecer o vocabulário base.</p>
                    </div>
                </div>
            ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 flex items-center gap-3">
                    <CheckCircle2 className="text-emerald-500" size={18} />
                    <p className="text-sm text-emerald-500 font-medium">Nenhum padrão crítico detectado. A IA está variando bem!</p>
                </div>
            )}

            <div className="space-y-2">
                {topPatterns.length === 0 && (
                    <div className="text-center py-8 text-zinc-600 italic text-sm">
                        Nenhuma resposta repetitiva registrada ainda.
                    </div>
                )}

                {topPatterns.map((pattern, idx) => (
                    <div
                        key={idx}
                        className="border border-zinc-800 bg-zinc-950/30 rounded-lg p-3 hover:bg-zinc-800/50 transition group"
                    >
                        <div className="flex justify-between items-start mb-1 gap-4">
                            <p className="text-sm text-zinc-300 flex-1 leading-snug font-mono text-[13px]">
                                "{pattern.full_response.substring(0, 100)}{pattern.full_response.length > 100 ? '...' : ''}"
                            </p>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pattern.used_count >= 10 ? 'bg-red-500/20 text-red-400' :
                                        pattern.used_count >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-zinc-800 text-zinc-500'
                                    }`}>
                                    {pattern.used_count}x
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1">
                            <ClockIcon size={10} />
                            {new Date(pattern.last_used_at).toLocaleString('pt-BR')}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}

function ClockIcon({ size = 12 }: { size?: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    )
}
