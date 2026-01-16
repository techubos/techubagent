
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    Zap,
    Plus,
    MessageSquare,
    Clock,
    Trash2,
    Play,
    Pause,
    Users,
    ChevronRight,
    Loader2,
    Save,
    Sparkles
} from 'lucide-react';
import { critiqueMessage } from '../services/geminiService';

interface Step {
    type: 'message' | 'wait' | 'audio';
    content?: string;
    value?: string;
    messageType?: 'static' | 'ai_prompt';
}

interface Sequence {
    id: string;
    name: string;
    steps: Step[];
    is_active: boolean;
    participant_count?: number;
}

export const Sequences: React.FC = () => {
    const [sequences, setSequences] = useState<Sequence[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSeq, setSelectedSeq] = useState<Sequence | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSequences();
    }, []);

    const fetchSequences = async () => {
        setLoading(true);
        const { data } = await supabase.from('sequences').select('*').order('created_at', { ascending: false });

        // Mocking participant counts for UI
        const enriched = (data || []).map(s => ({ ...s, participant_count: Math.floor(Math.random() * 50) }));
        setSequences(enriched);
        setLoading(false);
    };

    const handleCreate = () => {
        const newSeq: Sequence = {
            id: 'temp-' + Date.now(),
            name: 'Nova Sequência de Follow-up',
            steps: [
                { type: 'message', content: 'Olá {{name}}! Estou passando para...' },
                { type: 'wait', value: '24h' },
                { type: 'message', content: 'Ainda não tivemos retorno...' }
            ],
            is_active: true
        };
        setSelectedSeq(newSeq);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!selectedSeq) return;
        setSaving(true);
        try {
            const isNew = selectedSeq.id.startsWith('temp-');
            const dataToSave = {
                name: selectedSeq.name,
                steps: selectedSeq.steps,
                is_active: selectedSeq.is_active
            };

            if (isNew) {
                await supabase.from('sequences').insert(dataToSave);
            } else {
                await supabase.from('sequences').update(dataToSave).eq('id', selectedSeq.id);
            }

            setIsEditing(false);
            fetchSequences();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const addStep = (type: 'message' | 'wait') => {
        if (!selectedSeq) return;
        const newStep: Step = type === 'message' ? { type: 'message', content: '' } : { type: 'wait', value: '1h' };
        setSelectedSeq({ ...selectedSeq, steps: [...selectedSeq.steps, newStep] });
    };

    const removeStep = (index: number) => {
        if (!selectedSeq) return;
        const newSteps = [...selectedSeq.steps];
        newSteps.splice(index, 1);
        setSelectedSeq({ ...selectedSeq, steps: newSteps });
    };

    const updateStep = (index: number, field: string, value: string) => {
        if (!selectedSeq) return;
        const newSteps = [...selectedSeq.steps];
        (newSteps[index] as any)[field] = value;
        setSelectedSeq({ ...selectedSeq, steps: newSteps });
    };

    if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-white flex items-center gap-3">
                        <Zap className="text-primary fill-primary" size={36} />
                        Orquestrador de Sequências
                    </h1>
                    <p className="text-zinc-500 mt-2 font-medium">Automações multi-etapas para nutrição e recuperação de leads.</p>
                </div>
                {!isEditing && (
                    <button
                        onClick={handleCreate}
                        className="bg-primary text-zinc-900 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus size={20} /> Criar Sequência
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden flex gap-8">
                {/* List */}
                <div className={`flex-1 space-y-4 overflow-y-auto pr-4 custom-scrollbar ${isEditing ? 'hidden lg:block max-w-sm' : ''}`}>
                    {sequences.map(seq => (
                        <div
                            key={seq.id}
                            onClick={() => { setSelectedSeq(seq); setIsEditing(true); }}
                            className={`p-6 rounded-3xl border cursor-pointer transition-all ${selectedSeq?.id === seq.id ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5' : 'bg-surface border-border hover:border-zinc-700'}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-black text-white text-lg">{seq.name}</h3>
                                {seq.is_active ? <Play size={16} className="text-emerald-500" /> : <Pause size={16} className="text-zinc-500" />}
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold text-zinc-500">
                                <span className="flex items-center gap-1"><ChevronRight size={14} /> {seq.steps.length} Etapas</span>
                                <span className="flex items-center gap-1"><Users size={14} /> {seq.participant_count} Leads</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Editor */}
                {isEditing && selectedSeq && (
                    <div className="flex-[2] bg-surface border border-border rounded-4xl p-8 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex justify-between items-center mb-8">
                            <input
                                value={selectedSeq.name}
                                onChange={e => setSelectedSeq({ ...selectedSeq, name: e.target.value })}
                                className="bg-transparent text-2xl font-black text-white border-none outline-none w-full"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setIsEditing(false)} className="px-6 py-3 text-zinc-500 font-bold">Cancelar</button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-white transition-all"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    Salvar
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar pb-20">
                            {selectedSeq.steps.map((step, idx) => (
                                <div key={idx} className="relative">
                                    {/* Connection Line */}
                                    {idx < selectedSeq.steps.length - 1 && (
                                        <div className="absolute left-[23px] top-12 bottom-[-32px] w-[2px] bg-gradient-to-b from-zinc-800 to-transparent" />
                                    )}

                                    <div className="flex gap-6 group">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all group-hover:scale-110 ${step.type === 'message' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                                            {step.type === 'message' ? <MessageSquare size={20} /> : <Clock size={20} />}
                                        </div>

                                        <div className="flex-1 bg-zinc-900/50 border border-border/50 rounded-3xl p-6 group-hover:border-zinc-700 transition-all">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Etapa {idx + 1}: {step.type === 'message' ? 'Mensagem' : 'Espera'}</span>
                                                <button onClick={() => removeStep(idx)} className="text-zinc-600 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                            </div>

                                            {step.type === 'message' ? (
                                                <div className="space-y-4">
                                                    {/* Toggle Type */}
                                                    <div className="flex bg-zinc-800 rounded-xl p-1 w-fit border border-zinc-700">
                                                        <button
                                                            onClick={() => updateStep(idx, 'messageType', 'static')}
                                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!step.messageType || step.messageType === 'static' ? 'bg-zinc-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                        >
                                                            Texto Fixo
                                                        </button>
                                                        <button
                                                            onClick={() => updateStep(idx, 'messageType', 'ai_prompt')}
                                                            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${step.messageType === 'ai_prompt' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                        >
                                                            <Sparkles size={12} />
                                                            Gerado por IA
                                                        </button>
                                                    </div>

                                                    <textarea
                                                        value={step.content}
                                                        onChange={(e) => updateStep(idx, 'content', e.target.value)}
                                                        className={`w-full bg-zinc-800 border rounded-2xl p-4 text-white focus:outline-none focus:ring-2 transition-all font-medium h-[100px] resize-none ${step.messageType === 'ai_prompt' ? 'border-purple-500/50 focus:ring-purple-500/50' : 'border-border focus:ring-primary/50'}`}
                                                        placeholder={step.messageType === 'ai_prompt' ? "Ex: Pergunte se ele viu a proposta, mas seja casual e mencione que a oferta expira amanhã..." : "Digite sua mensagem fixa..."}
                                                    />

                                                    {step.messageType === 'ai_prompt' && (
                                                        <div className="flex items-center gap-2 text-[10px] text-purple-300 bg-purple-500/10 px-3 py-2 rounded-lg border border-purple-500/20">
                                                            <Sparkles size={12} />
                                                            <span>Esta instrução será usada pela IA para gerar uma mensagem única para cada lead.</span>
                                                        </div>
                                                    )}

                                                    {(!step.messageType || step.messageType === 'static') && (
                                                        <div className="flex justify-end">
                                                            <button
                                                                onClick={async () => {
                                                                    if (!step.content) return;
                                                                    const btn = document.getElementById(`critique-btn-${idx}`);
                                                                    const resultDiv = document.getElementById(`critique-result-${idx}`);
                                                                    if (btn) btn.innerHTML = '<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

                                                                    const critique = await critiqueMessage(step.content);

                                                                    if (btn) btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Criticar com IA';
                                                                    if (resultDiv) {
                                                                        resultDiv.innerText = critique;
                                                                        resultDiv.classList.remove('hidden');
                                                                    }
                                                                }}
                                                                id={`critique-btn-${idx}`}
                                                                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                                                            >
                                                                <Sparkles size={14} /> Criticar com IA
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div id={`critique-result-${idx}`} className="hidden p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-200 mt-2 italic animate-in slide-in-from-top-2">
                                                    </div>
                                                </div>

                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        value={step.value}
                                                        onChange={e => updateStep(idx, 'value', e.target.value)}
                                                        className="bg-zinc-800 rounded-xl px-4 py-2 text-white font-bold w-24 outline-none border border-border focus:border-amber-500"
                                                        placeholder="24h"
                                                    />
                                                    <span className="text-sm text-zinc-500">Aguardar antes da próxima etapa</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add Buttons */}
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => addStep('message')} className="flex-1 py-4 rounded-3xl border-2 border-dashed border-border text-zinc-500 font-bold flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-all">
                                    <MessageSquare size={18} /> + Mensagem
                                </button>
                                <button onClick={() => addStep('wait')} className="flex-1 py-4 rounded-3xl border-2 border-dashed border-border text-zinc-500 font-bold flex items-center justify-center gap-2 hover:border-amber-500/50 hover:text-amber-500 transition-all">
                                    <Clock size={18} /> + Espera
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


