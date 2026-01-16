import React, { useState } from 'react';
import { Book, FileText, Globe, Upload, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { toast } from 'sonner';

interface KnowledgeBaseStepProps {
    onSave: (kb: any) => void;
}

export function KnowledgeBaseStep({ onSave }: KnowledgeBaseStepProps) {
    const [mode, setMode] = useState<'text' | 'file' | 'url'>('text');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!content.trim()) {
            toast.error("Por favor, preencha o conteúdo");
            return;
        }

        setIsSaving(true);
        try {
            const { data: org } = await supabase.from('organizations').select('id').single();
            if (!org?.id) throw new Error("Org não encontrada");

            const { error } = await supabase.from('knowledge_base').insert({
                organization_id: org.id,
                content,
                source_type: mode
            });

            if (error) throw error;

            toast.success("Conhecimento salvo com sucesso!");
            onSave({ type: mode, length: content.length });
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar conhecimento");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-black text-white mb-2 tracking-tighter text-center">Base de Conhecimento</h2>
            <p className="text-zinc-500 text-sm mb-8 text-center font-medium italic">O que o seu Agente deve saber?</p>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 bg-zinc-900/50 p-1 rounded-2xl border border-white/5 w-full">
                <button
                    onClick={() => setMode('text')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${mode === 'text' ? 'bg-primary text-zinc-950' : 'text-zinc-500 hover:text-white'}`}
                >
                    <FileText size={14} /> Texto
                </button>
                <button
                    onClick={() => setMode('file')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${mode === 'file' ? 'bg-primary text-zinc-950' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Upload size={14} /> Arquivo
                </button>
                <button
                    onClick={() => setMode('url')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${mode === 'url' ? 'bg-primary text-zinc-950' : 'text-zinc-500 hover:text-white'}`}
                >
                    <Globe size={14} /> Site
                </button>
            </div>

            <div className="w-full bg-zinc-900/50 border border-white/5 rounded-[2rem] p-6 min-h-[250px] flex flex-col relative group">
                {mode === 'text' && (
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Ex: Somos uma imobiliária que vende apartamentos de alto luxo em São Paulo... Nossos diferenciais são..."
                        className="w-full flex-1 bg-transparent text-white text-sm outline-none resize-none font-medium leading-relaxed placeholder:text-zinc-700"
                    />
                )}

                {mode === 'file' && (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl hover:border-primary/20 transition-all">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="text-zinc-500" />
                        </div>
                        <p className="text-xs font-bold text-white mb-1">Arraste seu PDF ou DOCX</p>
                        <p className="text-[10px] text-zinc-600">Limite de 10MB por arquivo</p>
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                )}

                {mode === 'url' && (
                    <div className="flex-1 flex flex-col justify-center gap-4">
                        <div className="bg-zinc-950 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                            <Globe size={18} className="text-primary" />
                            <input
                                type="url"
                                placeholder="https://seu-site.com.br"
                                className="bg-transparent text-white text-sm font-bold flex-1 outline-none"
                            />
                        </div>
                        <p className="text-[9px] text-zinc-600 font-medium px-2 italic">
                            *O agente irá ler todas as páginas públicas do seu site para aprender.
                        </p>
                    </div>
                )}

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="absolute bottom-4 right-4 bg-primary text-zinc-950 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Salvar Dados
                </button>
            </div>

            <div className="mt-8 flex items-start gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                <Book size={20} className="text-amber-500 shrink-0 mt-1" />
                <p className="text-[10px] text-amber-500 leading-relaxed font-bold">
                    Quanto mais detalhes você fornecer, mais preciso será o seu Agente. Você pode adicionar mais depois nas configurações.
                </p>
            </div>
        </div>
    );
}
