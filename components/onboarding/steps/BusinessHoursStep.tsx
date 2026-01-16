import React, { useState } from 'react';
import { Clock, Sun, Moon, CheckSquare, Square } from 'lucide-react';

interface BusinessHoursStepProps {
    onSave: (hours: any) => void;
}

export function BusinessHoursStep({ onSave }: BusinessHoursStepProps) {
    const [is247, setIs247] = useState(true);
    const [schedule, setSchedule] = useState({
        mon: { open: '09:00', close: '18:00', active: true },
        tue: { open: '09:00', close: '18:00', active: true },
        wed: { open: '09:00', close: '18:00', active: true },
        thu: { open: '09:00', close: '18:00', active: true },
        fri: { open: '09:00', close: '18:00', active: true },
        sat: { open: '09:00', close: '13:00', active: true },
        sun: { open: '00:00', close: '00:00', active: false },
    });

    const handleToggle = () => setIs247(!is247);

    const handleSubmit = () => {
        onSave({
            enabled: !is247,
            timezone: 'America/Sao_Paulo',
            schedule: is247 ? null : schedule
        });
    };

    return (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-black text-white mb-2 tracking-tighter text-center">Horário de Atendimento</h2>
            <p className="text-zinc-500 text-sm mb-10 text-center font-medium italic">Quando o seu Agente deve responder?</p>

            <div className="w-full space-y-6">
                {/* Toggle 24/7 */}
                <div
                    onClick={handleToggle}
                    className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all cursor-pointer ${is247 ? 'bg-primary border-primary shadow-[0_10px_30px_rgba(16,185,129,0.2)]' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${is247 ? 'bg-zinc-950/20' : 'bg-primary/20'}`}>
                            <Sun className={is247 ? 'text-zinc-900' : 'text-primary'} />
                        </div>
                        <div className="text-left">
                            <h3 className={`font-black uppercase tracking-widest text-xs ${is247 ? 'text-zinc-950' : 'text-white'}`}>Atendimento 24/7</h3>
                            <p className={`text-[10px] font-bold ${is247 ? 'text-zinc-900/60' : 'text-zinc-500'}`}>O agente nunca dorme, responde a qualquer hora.</p>
                        </div>
                    </div>
                    {is247 ? <CheckSquare className="text-zinc-900" /> : <Square className="text-zinc-500" />}
                </div>

                {/* Custom Hours (Only if not 24/7) */}
                {!is247 && (
                    <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-6 space-y-4 animate-in zoom-in duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={16} className="text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Horários de Segunda a Sexta</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-950 p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
                                <label className="text-[9px] uppercase font-black text-zinc-500 tracking-tighter">Início</label>
                                <input type="time" defaultValue="09:00" className="bg-transparent text-white font-bold outline-none" />
                            </div>
                            <div className="bg-zinc-950 p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
                                <label className="text-[9px] uppercase font-black text-zinc-500 tracking-tighter">Fim</label>
                                <input type="time" defaultValue="18:00" className="bg-transparent text-white font-bold outline-none" />
                            </div>
                        </div>

                        <p className="text-[10px] text-zinc-600 text-center font-medium italic pt-2">
                            *Fora destes horários, o Agente ficará em espera.
                        </p>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    className="w-full mt-8 bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all text-xs"
                >
                    Confirmar Configuração
                </button>
            </div>
        </div>
    );
}
