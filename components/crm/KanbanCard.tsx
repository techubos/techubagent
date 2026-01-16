import React from 'react';
import { Contact } from '../../types';
import { User, Flame, Zap, AlertTriangle } from 'lucide-react';

interface KanbanCardProps {
    contact: Contact;
    selected: boolean;
    onClick: (contact: Contact) => void;
    onMagicReply?: (contact: Contact) => void;
    innerRef?: (element: HTMLElement | null) => void;
    draggableProps?: any;
    dragHandleProps?: any;
    isDragging?: boolean;
}

const KanbanCardBase: React.FC<KanbanCardProps> = ({ contact, selected, onClick, onMagicReply, innerRef, draggableProps, dragHandleProps, isDragging }) => {
    const isHot = (contact.lead_score || 0) > 70;
    const isWarm = (contact.lead_score || 0) > 40 && (contact.lead_score || 0) <= 70;

    const getLastInteractionTime = () => {
        if (contact.last_interaction_at) return new Date(contact.last_interaction_at).getTime();
        if (contact.last_message_at) return new Date(contact.last_message_at).getTime();
        return 0;
    };

    const lastInteraction = getLastInteractionTime();
    const hoursSinceInteraction = lastInteraction ? (Date.now() - lastInteraction) / (1000 * 60 * 60) : 0;
    const isStagnant = hoursSinceInteraction > 24; // 24h is more aggressive for premium feel
    const isCritical = isStagnant && contact.is_unread;

    return (
        <div
            ref={innerRef}
            {...draggableProps}
            {...dragHandleProps}
            onClick={() => onClick(contact)}
            className={`
                group relative mb-4 p-4 rounded-[1.5rem] border transition-colors duration-200 cursor-pointer overflow-hidden
                ${selected
                    ? 'bg-primary/10 border-primary/40 shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-primary/50'
                    : 'bg-zinc-900/40 border-white/[0.03] hover:bg-zinc-900/60 hover:border-white/10 hover:shadow-2xl'
                }
                ${isHot ? 'shadow-[0_0_40px_rgba(245,158,11,0.05)]' : ''}
                ${isCritical ? 'border-l-4 border-l-red-500' : ''}
                ${isDragging ? 'rotate-3 scale-[1.02] shadow-2xl ring-2 ring-primary z-[9999] opacity-90' : ''}
            `}
            style={{
                ...draggableProps?.style,
                zIndex: isDragging ? 99999 : undefined,
                pointerEvents: isDragging ? 'none' : 'auto'
            }}
        >
            {/* Ambient Glow for Hot Leads */}
            {isHot && (
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[60px] pointer-events-none rounded-full" />
            )}

            <div className="flex items-start gap-4 relative z-10">
                <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border-2 transition-all ${isHot ? 'border-amber-500/30' : 'border-white/5'}`}>
                        {contact.profile_pic_url ? (
                            <img src={contact.profile_pic_url} className="w-full h-full object-cover" alt={contact.name} />
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center ${isHot ? 'bg-amber-500/10' : 'bg-zinc-800'}`}>
                                <User className={isHot ? "text-amber-500" : "text-zinc-500"} size={20} />
                            </div>
                        )}
                    </div>
                    {isHot && (
                        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-zinc-950 rounded-lg p-1 shadow-2xl scale-90">
                            <Flame size={12} fill="currentColor" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className={`font-black text-sm uppercase tracking-tight truncate transition-colors ${selected ? 'text-primary' : isHot ? 'text-amber-100' : 'text-zinc-100'} group-hover:text-primary`}>
                            {contact.name || 'Anonymous Lead'}
                        </h4>
                        {isCritical && (
                            <div className="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse border border-red-500/20">
                                Crítico
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.map((tag, idx) => (
                                <span key={idx} className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md text-[8px] text-zinc-400 font-black uppercase tracking-tighter">
                                    {tag}
                                </span>
                            ))
                        ) : (
                            <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-wider">Novo Lead</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Micro Stats & Actions */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/[0.03] relative z-10">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Score</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${isHot ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : isWarm ? 'bg-blue-500' : 'bg-zinc-600'}`}
                                    style={{ width: `${contact.lead_score || 0}%` }}
                                />
                            </div>
                            <span className={`text-[10px] font-black ${isHot ? 'text-amber-400' : isWarm ? 'text-blue-400' : 'text-zinc-500'}`}>
                                {contact.lead_score || 0}%
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onMagicReply && (
                        <button
                            className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-zinc-950 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-2xl"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMagicReply(contact);
                            }}
                        >
                            <Zap size={14} fill="currentColor" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export const KanbanCard = React.memo(KanbanCardBase);
