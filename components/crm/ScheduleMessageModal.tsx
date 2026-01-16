
import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Clock, Send, X, Mic, FileAudio, Variable } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduleMessageModalProps {
    contact: any;
    onClose: () => void;
}

export const ScheduleMessageModal: React.FC<ScheduleMessageModalProps> = ({ contact, onClose }) => {
    const [content, setContent] = useState('');
    const [scheduledFor, setScheduledFor] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [messageType, setMessageType] = useState<'text' | 'audio'>('text');
    const [audioUrl, setAudioUrl] = useState('');

    const handleInsertVariable = (variable: string) => {
        setContent(prev => prev + `{${variable}}`);
    };

    const handleSchedule = async () => {
        if (!scheduledFor) return toast.error("Selecione uma data e hora.");
        if (messageType === 'text' && !content) return toast.error("Digite o conteúdo da mensagem.");
        if (messageType === 'audio' && !audioUrl) return toast.error("Insira a URL do áudio ou faça upload.");

        setIsSaving(true);
        try {
            const { error } = await supabase.from('scheduled_messages').insert({
                contact_id: contact.id,
                organization_id: contact.organization_id,
                content: content,
                message_type: messageType,
                media_url: audioUrl,
                scheduled_for: new Date(scheduledFor).toISOString(),
                status: 'pending'
            });

            if (error) throw error;
            toast.success("Mensagem agendada com sucesso!");
            onClose();
        } catch (e: any) {
            toast.error("Erro ao agendar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="glass-card w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl premium-border relative overflow-hidden flex flex-col gap-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <h3 className="text-2xl font-black text-white flex items-center gap-3">
                            <Clock className="text-primary" size={24} />
                            Programar Mensagem
                        </h3>
                        <p className="text-zinc-500 text-sm font-medium">Agendar envio para {contact.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X className="text-zinc-500" size={24} />
                    </button>
                </div>

                <div className="space-y-6 relative z-10">
                    {/* Message Type Selector */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMessageType('text')}
                            className={`flex-1 py-3 rounded-2xl border transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest ${messageType === 'text' ? 'bg-primary text-zinc-950 border-primary shadow-lg' : 'bg-zinc-900/50 text-zinc-500 border-white/5'}`}
                        >
                            <Send size={14} /> Texto
                        </button>
                        <button
                            onClick={() => setMessageType('audio')}
                            className={`flex-1 py-3 rounded-2xl border transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest ${messageType === 'audio' ? 'bg-primary text-zinc-950 border-primary shadow-lg' : 'bg-zinc-900/50 text-zinc-500 border-white/5'}`}
                        >
                            <Mic size={14} /> Áudio Simulado
                        </button>
                    </div>

                    {/* Content Input */}
                    {messageType === 'text' ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mr-2 flex items-center gap-1">
                                    <Variable size={10} /> Variáveis:
                                </span>
                                {['nome', 'empresa', 'horario'].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => handleInsertVariable(v)}
                                        className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] text-zinc-400 font-bold hover:text-white hover:bg-white/10 transition-all uppercase"
                                    >
                                        {`{${v}}`}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl p-5 text-zinc-300 focus:border-primary outline-none h-40 resize-none font-medium placeholder:text-zinc-700"
                                placeholder="Eescreva sua mensagem... As variáveis serão substituídas automaticamente pelo sistema."
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-8 rounded-[2rem] border-2 border-dashed border-white/5 bg-white/[0.02] flex flex-col items-center justify-center text-center gap-4 group hover:border-primary/30 transition-all">
                                <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-all">
                                    <FileAudio size={40} />
                                </div>
                                <div>
                                    <p className="text-white font-bold">Upload de Áudio</p>
                                    <p className="text-zinc-500 text-xs mt-1">O áudio será enviado como "gravado na hora"</p>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Cole a URL do áudio (ex: bucket Supabase)"
                                    className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-sm text-zinc-300 mt-4 focus:border-primary outline-none"
                                    value={audioUrl}
                                    onChange={e => setAudioUrl(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Date/Time Picker */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Para quando?</label>
                        <input
                            type="datetime-local"
                            className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl p-4 text-zinc-300 focus:border-primary outline-none font-medium color-scheme-dark"
                            value={scheduledFor}
                            onChange={e => setScheduledFor(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-4 relative z-10 pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-zinc-300 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSchedule}
                        disabled={isSaving}
                        className="flex-[2] py-4 bg-primary-gradient text-zinc-950 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest"
                    >
                        {isSaving ? <Clock className="animate-spin" size={16} /> : <Clock size={16} />}
                        Confirmar Agendamento
                    </button>
                </div>
            </div>
        </div>
    );
};
