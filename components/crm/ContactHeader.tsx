
import React, { useState, useEffect } from 'react';
import { Contact } from '../../types';
import { User, Sparkles, Brain, X, Archive, Phone, Calendar, LayoutGrid, ClipboardCheck, ChevronLeft, Workflow } from 'lucide-react';

interface ContactHeaderProps {
    contact: Contact;
    onClose: () => void;
    onSyncHistory: () => void;
    onExtractMemories: () => void;
    onNameChange: (newName: string) => void;
    onToggleMemory: () => void;
    onAudit: () => void;
    onStartFlow: () => void;
    onSchedule: () => void;
    isMemoryOpen: boolean;
}

export const ContactHeader: React.FC<ContactHeaderProps> = ({
    contact,
    onClose,
    onSyncHistory,
    onExtractMemories,
    onNameChange,
    onToggleMemory,
    onAudit,
    onStartFlow,
    onSchedule,
    isMemoryOpen
}) => {
    const [name, setName] = useState(contact.name || '');

    useEffect(() => {
        setName(contact.name || '');
    }, [contact.id]);

    return (
        <div className="px-4 py-1 border-b border-white/5 bg-zinc-950/40 flex justify-between items-center shrink-0 h-12 translate-y-0 transition-all duration-300">
            <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Back Button for Mobile */}
                <button
                    onClick={onClose}
                    className="md:hidden p-1.5 -ml-1 text-zinc-400 hover:text-white"
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden border border-white/5 shrink-0">
                    {contact.profile_pic_url ? (
                        <img src={contact.profile_pic_url} className="w-full h-full object-cover" alt={contact.name} />
                    ) : (
                        <User className="text-zinc-600" size={16} />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-white text-sm leading-tight truncate">{contact.name || 'Sem Nome'}</h3>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-zinc-500 font-medium">{contact.phone}</p>
                        {contact.lead_score !== undefined && (
                            <span className="text-[10px] font-black text-primary px-1 bg-primary/10 rounded border border-primary/20">
                                {contact.lead_score}%
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1 ml-2 flex-wrap justify-end">
                {[
                    { icon: Sparkles, color: 'hover:text-primary', action: onSyncHistory, label: 'Sincronizar' },
                    { icon: Brain, color: 'hover:text-purple-400', action: onExtractMemories, label: 'Memória' },
                    { icon: ClipboardCheck, color: 'hover:text-orange-400', action: onAudit, label: 'Auditoria' },
                    { icon: Workflow, color: 'hover:text-green-400', action: onStartFlow, label: 'Fluxo' },
                    { icon: Calendar, color: 'hover:text-blue-400', action: onSchedule, label: 'Agendar' },
                ].map((item, idx) => (
                    <button
                        key={idx}
                        onClick={item.action}
                        className={`w-7 h-7 rounded flex items-center justify-center text-zinc-500 transition-all ${item.color} hover:bg-white/5`}
                        title={item.label}
                    >
                        <item.icon size={14} />
                    </button>
                ))}

                <div className="w-px h-3 bg-white/10 mx-1 hidden md:block" />

                <button
                    onClick={onToggleMemory}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-all ${isMemoryOpen ? 'bg-primary text-zinc-950' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                    <LayoutGrid size={14} />
                </button>

                <button
                    onClick={onClose}
                    className="w-7 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 ml-1"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};
