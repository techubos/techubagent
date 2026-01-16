import React, { useState } from 'react';
import { Brain, MessageSquare, Zap, Smile, Meh, Frown, Compass, ArrowRight, Loader2 } from 'lucide-react';
import { Contact, Message } from '../../types';
import { supabase } from '../../services/supabaseClient';

interface AICopilotProps {
    contact: Contact;
    messages: Message[];
    onApplyDraft: (text: string) => void;
}

export const AICopilot: React.FC<AICopilotProps> = ({ contact, messages, onApplyDraft }) => {
    if (!contact) return null;
    const [isConsulting, setIsConsulting] = useState(false);
    const [consultationQuery, setConsultationQuery] = useState('');
    const [consultationResult, setConsultationResult] = useState<{ advice: string; suggestions: string[] } | null>(null);

    const handleConsultAI = async () => {
        if (!consultationQuery.trim()) return;
        setIsConsulting(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-assist', {
                body: {
                    contact_id: contact.id,
                    query: consultationQuery,
                    history: messages.slice(-10)
                }
            });
            if (!error && data) {
                setConsultationResult(data);
            }
        } catch (err) {
            console.error("Copilot error:", err);
        } finally {
            setIsConsulting(false);
        }
    };

    const sentiment = contact.sentiment || 'neutral';
    const SentimentIcon = sentiment === 'positive' ? Smile : sentiment === 'angry' ? Frown : Meh;
    const sentimentColor = sentiment === 'positive' ? 'text-green-400' : sentiment === 'angry' ? 'text-red-400' : 'text-zinc-400';

    return (
        <div className="flex flex-col gap-6 py-4">
            {/* Quick Status & Sentiment */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-zinc-950/50 border border-white/10 ${sentimentColor}`}>
                        <SentimentIcon size={18} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Humor do Cliente</h4>
                        <p className={`text-xs font-bold capitalize ${sentimentColor}`}>{sentiment}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Conversão</h4>
                    <p className="text-xs font-black text-white">{contact.lead_score || 0}%</p>
                </div>
            </div>

            {/* AI Sales Strategy Space */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Compass size={14} className="text-primary" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/60">Consultoria de Vendas</h4>
                </div>

                <div className="relative group">
                    <textarea
                        value={consultationQuery}
                        onChange={e => setConsultationQuery(e.target.value)}
                        placeholder="Ex: Como respondo se ele disser que está caro?"
                        className="w-full h-32 bg-zinc-950/50 border border-white/5 rounded-2xl p-4 text-xs text-white focus:border-primary/50 outline-none transition-all placeholder:text-zinc-700 resize-none font-medium leading-relaxed"
                    />
                    <button
                        onClick={handleConsultAI}
                        disabled={isConsulting || !consultationQuery.trim()}
                        className="absolute bottom-3 right-3 p-2 bg-primary text-zinc-950 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isConsulting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    </button>
                </div>

                {consultationResult && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        {/* The AI Advice */}
                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <Zap size={40} className="text-primary" />
                            </div>
                            <h5 className="text-[8px] font-black uppercase tracking-[0.2em] text-primary mb-2">Estratégia Recomendada</h5>
                            <p className="text-[11px] text-zinc-300 leading-relaxed font-medium">
                                {consultationResult.advice}
                            </p>
                        </div>

                        {/* Direct Suggestions */}
                        <div className="space-y-2">
                            <h5 className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Sugestões de Resposta</h5>
                            <div className="flex flex-col gap-2">
                                {consultationResult.suggestions.map((s, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onApplyDraft(s)}
                                        className="text-left p-3 bg-white/[0.03] border border-white/5 rounded-xl text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-between group"
                                    >
                                        <span className="truncate pr-4">{s}</span>
                                        <Zap size={10} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {!consultationResult && !isConsulting && (
                <div className="p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-[2rem]">
                    <Brain size={24} className="text-zinc-800 mx-auto mb-3" />
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-relaxed">
                        Pergunte algo para obter<br />insights estratégicos
                    </p>
                </div>
            )}
        </div>
    );
};
