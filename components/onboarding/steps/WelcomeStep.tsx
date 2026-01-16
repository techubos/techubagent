import React from 'react';
import { Rocket, Zap, Shield, Heart } from 'lucide-react';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
    return (
        <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 relative">
                <Rocket size={48} className="text-primary animate-bounce-slow" />
                <div className="absolute -top-2 -right-2 bg-emerald-500 w-6 h-6 rounded-full flex items-center justify-center border-4 border-zinc-900">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter">
                Pronto para <span className="text-primary italic">Decolar?</span>
            </h1>

            <p className="text-zinc-400 text-lg max-w-md leading-relaxed mb-12 font-medium">
                Bem-vindo ao TecHub Agent. Vamos configurar sua operação em <span className="text-white font-bold">menos de 10 minutos.</span> 🚀
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left">
                {[
                    { icon: <Zap size={20} />, title: "Agilidade", desc: "IA configurada em segundos" },
                    { icon: <Shield size={20} />, title: "Seguro", desc: "Dados protegidos ponta-ponta" },
                    { icon: <Heart size={20} />, title: "Amigável", desc: "Interface pensada em você" }
                ].map((item, i) => (
                    <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-2xl hover:bg-white/10 transition-colors">
                        <div className="text-primary mb-3">{item.icon}</div>
                        <h3 className="text-white text-sm font-black uppercase tracking-widest mb-1">{item.title}</h3>
                        <p className="text-zinc-500 text-xs leading-relaxed font-medium">{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
