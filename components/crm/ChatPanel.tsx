import React from 'react';
import { Contact, Message } from '../../types';
import { ContactHeader } from './ContactHeader';
import { VirtualizedMessageList } from './VirtualizedMessageList';
import { MessageInput } from './MessageInput';
import { MemoryPanel } from '../MemoryPanel';
import { AICopilot } from './AICopilot';
import { ScheduledMessagesCalendar } from './ScheduledMessagesCalendar';
import { Brain, X, CheckCircle2, History, Sparkles, CalendarClock } from 'lucide-react';
import { useAICopilot } from '../../features/crm/api/useAICopilot';
import { useChatContext } from '../../features/crm/api/useChatContext';

interface ChatPanelProps {
    contact: Contact;
    messages: Message[];
    availableStages: string[];
    onClose: () => void;
    onSendMessage: (text: string) => void;
    onSyncHistory: () => void;
    onExtractMemories: () => void;
    onAudit: () => void;
    onStartFlow: () => void;
    onSchedule: () => void;
    onUpdateContact: (updates: Partial<Contact>) => void;
    onAddNote: (note: string) => void;
    isSaving: boolean;
    isLoadingHistory?: boolean;
    fetchNextPage?: () => void;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    autoDraft?: boolean;
    onClearAutoDraft: () => void;
    onSaveFeedback?: (messageId: string, rating: 1 | -1, correction?: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = (props) => {
    const {
        contact, messages, availableStages, onClose, onSendMessage, onSyncHistory,
        onExtractMemories, onAudit, onUpdateContact, onAddNote, onSchedule, isSaving,
        isLoadingHistory, fetchNextPage, hasNextPage, isFetchingNextPage, onStartFlow,
        autoDraft, onClearAutoDraft, onSaveFeedback
    } = props;

    if (!contact) return null;

    const [isMemoryOpen, setIsMemoryOpen] = React.useState(false);
    const [intelligenceTab, setIntelligenceTab] = React.useState<'copilot' | 'memory' | 'schedule'>('copilot');

    // 1. Hook de IA (Blindagem Logic)
    const ai = useAICopilot(contact, messages, autoDraft, onClearAutoDraft);

    // 2. Hook de Contexto e Agendamento
    const ctx = useChatContext(contact, messages);

    // Responsive State
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 1024);
    React.useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (mobile) setIsMemoryOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Feedback State
    const [feedbackModal, setFeedbackModal] = React.useState<{ messageId: string, rating: 1 | -1 } | null>(null);
    const [correction, setCorrection] = React.useState('');

    return (
        <div className={`flex flex-col bg-zinc-950/30 backdrop-blur-xl border-l border-white/5 overflow-hidden relative h-full flex-1`}>
            {/* Banner de Resumo da IA */}
            {(ctx.contextSummary || ctx.loadingSummary) && (
                <div className="bg-primary/5 border-b border-primary/10 px-6 py-3 flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <Brain size={16} className={ctx.loadingSummary ? 'animate-pulse' : ''} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-0.5">Resumo IA</h5>
                        <p className="text-xs text-zinc-300 font-medium leading-relaxed truncate">
                            {ctx.loadingSummary ? "Gerando insights..." : ctx.contextSummary}
                        </p>
                    </div>
                    <button onClick={() => ctx.setContextSummary(null)} className="p-1 text-zinc-600 hover:text-zinc-400"><X size={14} /></button>
                </div>
            )}

            <div className={`flex w-full flex-1 overflow-hidden relative`}>
                <div className={`flex flex-col min-w-0 h-full flex-1 bg-[#0b141a] relative`}>
                    <ContactHeader
                        contact={contact}
                        onClose={onClose}
                        onSyncHistory={onSyncHistory}
                        onExtractMemories={onExtractMemories}
                        onAudit={onAudit}
                        onStartFlow={onStartFlow}
                        onSchedule={() => { setIsMemoryOpen(true); setIntelligenceTab('schedule'); }}
                        onNameChange={(name) => onUpdateContact({ name })}
                        onToggleMemory={() => setIsMemoryOpen(!isMemoryOpen)}
                        isMemoryOpen={isMemoryOpen}
                    />

                    <div className="flex-1 overflow-hidden z-10">
                        <VirtualizedMessageList
                            messages={messages}
                            fetchNextPage={fetchNextPage || (() => { })}
                            hasNextPage={hasNextPage || false}
                            isFetchingNextPage={isFetchingNextPage || false}
                        />
                    </div>

                    {/* AI Smart Replies Area */}
                    <div className="px-4 pt-2 z-10 bg-[#0b141a]">
                        {!ai.loadingSuggestions && (
                            <button onClick={ai.generateSuggestions} className="flex items-center gap-2 text-xs text-primary/80 hover:text-primary mb-2 ml-1">
                                <Sparkles size={12} />
                                <span>{ai.smartReplies.length > 0 ? 'Regerar' : 'Sugerir respostas'}</span>
                            </button>
                        )}
                        {ai.loadingSuggestions && <div className="text-xs text-zinc-500 mb-2 ml-1 animate-pulse italic">Gerando sugestões...</div>}
                        {ai.smartReplies.length > 0 && (
                            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1">
                                {ai.smartReplies.map((reply, idx) => (
                                    <button key={idx} onClick={() => ai.setMagicDraft(reply)} className="shrink-0 px-3 py-1.5 bg-[#1f2c34] border border-[#2a3942] rounded-full text-[11px] text-zinc-300 hover:bg-[#2a3942] truncate max-w-[200px]">
                                        {reply}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="z-10 bg-[#0b141a]">
                        <MessageInput
                            onSendMessage={onSendMessage}
                            onAddTag={(tag) => onUpdateContact({ tags: [...(contact.tags || []), tag] })}
                            onRemoveTag={(tag) => onUpdateContact({ tags: (contact.tags || []).filter(t => t !== tag) })}
                            onAddNote={onAddNote}
                            onMoveStage={(stage) => onUpdateContact({ status: stage })}
                            availableStages={availableStages}
                            internalNote={contact.notes || ''}
                            onInternalNoteChange={(notes) => onUpdateContact({ notes })}
                            onSaveInternalNote={(notes) => onUpdateContact({ notes })}
                            isSaving={isSaving}
                            tags={contact.tags || []}
                            suggestion={ai.suggestion}
                            onDraftChange={ai.handleDraftChange}
                            externalText={ai.magicDraft}
                            onScheduleMessage={ctx.scheduleMessage}
                            variables={{
                                nome: contact.name || 'Cliente',
                                empresa: contact.company || 'TecHub',
                                telefone: contact.phone || '',
                                horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            }}
                        />
                    </div>
                </div>

                {isMemoryOpen && (
                    <div className="w-full md:w-[350px] bg-zinc-950/40 backdrop-blur-2xl border-l border-white/5 overflow-hidden h-full flex flex-col absolute md:relative right-0 z-20 shadow-2xl">
                        <div className="p-6 border-b border-white/5 font-black text-white/60 flex items-center justify-between uppercase tracking-widest text-[10px]">
                            <div className="flex items-center gap-3">
                                <Brain size={14} /> Intelligence Center
                            </div>
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                                <button onClick={() => setIntelligenceTab('copilot')} className={`p-2 rounded-lg ${intelligenceTab === 'copilot' ? 'bg-primary text-zinc-950 shadow-lg' : 'text-zinc-600'}`}><Sparkles size={14} /></button>
                                <button onClick={() => setIntelligenceTab('memory')} className={`p-2 rounded-lg ${intelligenceTab === 'memory' ? 'bg-primary text-zinc-950 shadow-lg' : 'text-zinc-600'}`}><History size={14} /></button>
                                <button onClick={() => setIntelligenceTab('schedule')} className={`p-2 rounded-lg ${intelligenceTab === 'schedule' ? 'bg-primary text-zinc-950 shadow-lg' : 'text-zinc-600'}`}><CalendarClock size={14} /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                            {intelligenceTab === 'copilot' ? <AICopilot contact={contact} messages={messages} onApplyDraft={ai.setMagicDraft} />
                                : intelligenceTab === 'memory' ? <MemoryPanel contactId={contact.id} />
                                    : <ScheduledMessagesCalendar contact={contact} onClose={() => setIsMemoryOpen(false)} />}
                        </div>
                    </div>
                )}
            </div>

            {feedbackModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-xl p-4 animate-in fade-in">
                    <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl premium-border relative">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-white">Refinar <span className="text-primary italic">IA</span></h3>
                            <button onClick={() => setFeedbackModal(null)} className="text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <textarea
                            value={correction}
                            onChange={(e) => setCorrection(e.target.value)}
                            className="w-full h-40 bg-zinc-950/50 border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all resize-none text-sm"
                            placeholder="Qual seria a resposta correta?"
                        />
                        <button
                            onClick={async () => {
                                await onSaveFeedback?.(feedbackModal.messageId, feedbackModal.rating, correction);
                                setFeedbackModal(null);
                                setCorrection('');
                                alert("Obrigado pela correção!");
                            }}
                            className="w-full py-4 bg-primary text-zinc-950 font-black rounded-xl mt-6 uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Injetar Correção
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
