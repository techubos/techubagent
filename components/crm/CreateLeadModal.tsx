import React, { useState } from 'react';
import { Loader2, User, Phone, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { crmService } from '../../services/crmService';
import { sanitizeMessage } from '../../utils/sanitize';

interface CreateLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    targetColumnId?: string;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({ isOpen, onClose, onSuccess, targetColumnId = 'lead' }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', phone: '', notes: '' });

    const handleCreate = async () => {
        if (!newContact.name || !newContact.phone) {
            return toast.error("Nome e Telefone são obrigatórios");
        }

        setIsSaving(true);
        try {
            await crmService.createContact({
                name: newContact.name,
                phone: newContact.phone,
                notes: sanitizeMessage(newContact.notes),
                status: targetColumnId
            });

            toast.success("Lead criado com sucesso!");
            setNewContact({ name: '', phone: '', notes: '' });
            onSuccess();
            onClose();
        } catch (e: any) {
            toast.error(e.message || "Erro ao criar lead");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-zinc-900 w-full max-w-lg rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[100px] rounded-full group-hover:bg-primary/20 transition-all duration-500" />

                <h3 className="text-2xl font-black text-white mb-6 uppercase tracking-tighter flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <User size={24} />
                    </div>
                    Novo <span className="text-primary text-3xl italic">Lead</span>
                </h3>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nome Completo</label>
                        <div className="relative group/field">
                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-hover/field:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Ex: João da Silva"
                                className="w-full bg-zinc-950 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary/50 transition-all text-sm font-medium"
                                value={newContact.name}
                                onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">WhatsApp (com DDD)</label>
                        <div className="relative group/field">
                            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-hover/field:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="5511999999999"
                                className="w-full bg-zinc-950 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary/50 transition-all text-sm font-medium"
                                value={newContact.phone}
                                onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Observações Internas</label>
                        <div className="relative group/field">
                            <FileText size={18} className="absolute left-4 top-6 text-zinc-500 group-hover/field:text-primary transition-colors" />
                            <textarea
                                placeholder="Detalhes importantes sobre o lead..."
                                className="w-full bg-zinc-950 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary/50 transition-all text-sm font-medium min-h-[100px] resize-none"
                                value={newContact.notes}
                                onChange={e => setNewContact({ ...newContact, notes: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 mt-10">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-zinc-700 hover:text-white transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isSaving}
                        className="flex-[2] px-6 py-4 bg-primary text-zinc-950 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group/btn"
                    >
                        {isSaving ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                SALVAR LEAD
                                <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
