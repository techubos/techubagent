import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Save, Beaker, Play, X } from 'lucide-react';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateExperiment = ({ onClose, onSuccess }: Props) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'prompt' | 'campaign'>('prompt');
    const [variantA, setVariantA] = useState('');
    const [variantB, setVariantB] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.from('ab_experiments').insert({
                name,
                type,
                status: 'running',
                variant_a_content: variantA,
                variant_b_content: variantB,
                started_at: new Date().toISOString()
            });

            if (error) throw error;
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error creating experiment:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                        <Beaker className="text-primary" />
                        Criar Novo Teste A/B
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Nome do Experimento</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                                placeholder="Ex: Copy Agressiva vs Consultiva"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Tipo de Teste</label>
                            <div className="flex gap-4">
                                <label className={`flex-1 cursor-pointer border rounded-lg p-4 flex items-center gap-3 transition-colors ${type === 'prompt' ? 'bg-primary/10 border-primary text-zinc-100' : 'bg-surface border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}>
                                    <input type="radio" name="type" value="prompt" checked={type === 'prompt'} onChange={() => setType('prompt')} className="hidden" />
                                    <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center">
                                        {type === 'prompt' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                    <div>
                                        <div className="font-semibold">Prompt do Sistema</div>
                                        <div className="text-xs opacity-70">Teste personas e instruções da IA</div>
                                    </div>
                                </label>
                                <label className={`flex-1 cursor-pointer border rounded-lg p-4 flex items-center gap-3 transition-colors ${type === 'campaign' ? 'bg-primary/10 border-primary text-zinc-100' : 'bg-surface border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}>
                                    <input type="radio" name="type" value="campaign" checked={type === 'campaign'} onChange={() => setType('campaign')} className="hidden" />
                                    <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center">
                                        {type === 'campaign' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                    <div>
                                        <div className="font-semibold">Campanha (Broadcast)</div>
                                        <div className="text-xs opacity-70">Teste mensagens de disparo em massa</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-purple-400">Variante A (Controle)</label>
                            <textarea
                                required
                                value={variantA}
                                onChange={e => setVariantA(e.target.value)}
                                className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 font-mono resize-none focus:ring-2 focus:ring-purple-500/50 outline-none"
                                placeholder={type === 'prompt' ? "Instruções do sistema para a IA..." : "Texto da campanha..."}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-amber-400">Variante B (Teste)</label>
                            <textarea
                                required
                                value={variantB}
                                onChange={e => setVariantB(e.target.value)}
                                className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 font-mono resize-none focus:ring-2 focus:ring-amber-500/50 outline-none"
                                placeholder={type === 'prompt' ? "Instruções alternativas..." : "Texto alternativo..."}
                            />
                        </div>
                    </div>
                </form>

                <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-zinc-800 text-zinc-400 rounded-lg font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Criando...' : (
                            <>
                                <Play size={18} fill="currentColor" />
                                Iniciar Teste
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
