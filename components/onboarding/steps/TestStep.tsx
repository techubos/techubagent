import React, { useState, useEffect } from 'react';
import { Smartphone, MessageSquare, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';

export function TestStep({ onPass }: { onPass: () => void }) {
    const [waiting, setWaiting] = useState(true);
    const [testNumber] = useState("+55 11 99999-9999"); // Placeholder
    const [orgId, setOrgId] = useState<string | null>(null);

    useEffect(() => {
        supabase.from('organizations').select('id').single().then(({ data }) => setOrgId(data?.id));
    }, []);

    useEffect(() => {
        if (!orgId) return;

        // Real-time subscription to detect the first incoming message
        const channel = supabase
            .channel('onboarding-test')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `organization_id=eq.${orgId}` },
                (payload) => {
                    console.log("Onboarding Test Message Received!", payload);
                    setWaiting(false);
                    onPass();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orgId, onPass]);

    return (
        <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">Hora do Teste!</h2>
            <p className="text-zinc-500 text-sm mb-12 font-medium italic">Vamos ver a magia acontecer.</p>

            <div className="w-full max-w-sm space-y-6">
                <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                    <div className="flex flex-col items-center gap-6">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${waiting ? 'bg-primary/10 text-primary' : 'bg-primary text-zinc-950 scale-110 shadow-3xl shadow-primary/50'}`}>
                            {waiting ? <RefreshCw size={40} className="animate-spin-slow" /> : <CheckCircle2 size={40} />}
                        </div>

                        <div className="space-y-2">
                            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                {waiting ? "Aguardando Mensagem..." : "Sistema 100% Funcional!"}
                            </p>
                            <h3 className="text-white text-3xl font-black tracking-tighter">Sua Vez.</h3>
                        </div>

                        <div className="w-full bg-zinc-950 p-6 rounded-3xl border border-white/5 group-hover:border-primary/20 transition-all">
                            <p className="text-[10px] text-zinc-600 font-bold uppercase mb-2">Envie um "Oi" para:</p>
                            <div className="flex items-center justify-center gap-3">
                                <Smartphone size={18} className="text-primary" />
                                <span className="text-xl font-black text-white tracking-widest">{testNumber}</span>
                            </div>
                        </div>
                    </div>

                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <MessageSquare size={120} />
                    </div>
                </div>

                {!waiting && (
                    <div className="animate-in slide-in-from-top-4 duration-500">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold animate-bounce">
                                <ArrowRight size={20} />
                            </div>
                            <div className="text-left">
                                <p className="text-emerald-500 text-xs font-black uppercase">Excelente!</p>
                                <p className="text-zinc-500 text-[10px] font-medium leading-relaxed">Detectamos sua mensagem. Seu Agente já está respondendo.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <p className="mt-12 text-[10px] text-zinc-600 max-w-xs font-medium leading-relaxed">
                Não recebeu? Verifique se escaneou o QR Code corretamente no passo anterior ou tente novamente.
            </p>
        </div>
    );
}
