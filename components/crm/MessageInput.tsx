
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Palette, TrendingUp, MessageSquare, X, Zap, Hash, CalendarClock, Mic } from 'lucide-react';

import { QuickResponseManager } from './QuickResponseManager';
import { TagSuggestions } from './TagSuggestions';
import { supabase } from '../../services/supabaseClient';
import { AudioRecorder } from './AudioRecorder';

interface MessageInputProps {
    onSendMessage: (text: string) => void;
    onAddTag: (tag: string) => void;
    onAddNote: (note: string) => void;
    onMoveStage: (stageTitle: string) => void;
    onRemoveTag: (tag: string) => void;
    onSaveInternalNote: (note: string) => void;
    tags: string[];
    internalNote: string;
    onInternalNoteChange: (text: string) => void;
    isSaving: boolean;
    availableStages: string[];
    suggestion?: string; // New: AI Whisper
    onDraftChange?: (text: string) => void; // New: To trigger AI
    externalText?: string | null; // New: For Magic Reply injection
    variables?: Record<string, string>; // Context for substitution
    onScheduleMessage?: (text: string, date: Date) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
    onSendMessage,
    onAddTag,
    onAddNote,
    onMoveStage,
    onRemoveTag,
    onSaveInternalNote,
    tags,
    internalNote,
    onInternalNoteChange,
    isSaving,
    availableStages,
    suggestion,
    onDraftChange,
    externalText,
    variables = {},
    onScheduleMessage
}) => {
    const [draftText, setDraftText] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    const [newTag, setNewTag] = useState('');
    const [showQuickResponses, setShowQuickResponses] = useState(false);
    const [isRecordingMode, setIsRecordingMode] = useState(false);

    const quickResponseRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (quickResponseRef.current && !quickResponseRef.current.contains(event.target as Node)) {
                setShowQuickResponses(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync external text (Magic Reply)
    React.useEffect(() => {
        if (externalText) {
            setDraftText(externalText);
            onDraftChange?.(externalText);
        }
    }, [externalText]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const txt = e.target.value;
        setDraftText(txt);
        onDraftChange?.(txt);
    };

    const handleSend = () => {
        if (!draftText.trim()) return;
        onSendMessage(draftText);
        setDraftText('');
        onDraftChange?.('');
    };

    const handleQuickResponseSelect = (response: any) => {
        if (response.message_type === 'text') {
            let content = response.content;
            // Replace variables
            Object.entries(variables).forEach(([key, val]) => {
                content = content.replace(new RegExp(`{${key}}`, 'gi'), val);
            });
            setDraftText(content);
            onDraftChange?.(content);
        } else if (response.message_type === 'audio') {
            // Validate audio sending
            if (confirm("Enviar áudio agora?")) {
                onSendMessage(`[AUDIO_SIMULATED]${response.media_url}`);
            }
        }
        setShowQuickResponses(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSend();
        }
        // Ghost Text Completion
        if (e.key === 'Tab' && suggestion) {
            e.preventDefault();
            setDraftText(suggestion);
            onDraftChange?.(suggestion);
        }
    };

    const handleAudioSend = (url: string, duration: number) => {
        // Here we send a special formatted message that the system will recognize as audio
        // Or we should update onSendMessage to support media types. 
        // For now, simpler to send a "system code" that backend interprets or generic link for MVP.
        // Ideally we refactor onSendMessage to accept (content, type, url)
        // But to avoid breaking changes, let's prefix
        onSendMessage(`[AUDIO_UPLOAD]${url}`);
        setIsRecordingMode(false);
    };

    if (isRecordingMode) {
        return (
            <div className="px-4 py-3 border-t border-border bg-surface shrink-0 flex flex-col gap-1.5 min-h-[60px] justify-center">
                <AudioRecorder onSend={handleAudioSend} onCancel={() => setIsRecordingMode(false)} />
            </div>
        );
    }

    return (
        <div className="px-4 py-1.5 border-t border-border bg-surface shrink-0 flex flex-col gap-1.5">
            {/* Input Area */}
            <div className="flex gap-2 relative">
                {suggestion && draftText && suggestion.startsWith(draftText) && (
                    <div className="absolute left-4 top-1.5 text-sm text-zinc-600 pointer-events-none select-none font-sans">
                        <span className="opacity-0">{draftText}</span>
                        <span>{suggestion.slice(draftText.length)}</span>
                    </div>
                )}

                <button
                    onClick={() => setIsRecordingMode(true)}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                    title="Gravar Áudio (Microfone)"
                >
                    <Mic size={18} />
                </button>

                <input
                    type="text"
                    value={draftText}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Responda aqui..."
                    className="flex-1 bg-zinc-900/50 border border-border rounded-lg px-3 py-1 text-sm focus:border-primary outline-none transition-all placeholder:text-zinc-700 text-zinc-200 z-10"
                />

                {/* Quick Response Button */}
                <div className="relative" ref={quickResponseRef}>
                    <button
                        onClick={() => setShowQuickResponses(!showQuickResponses)}
                        className={`p-1.5 rounded-lg transition-all z-10 ${showQuickResponses ? 'bg-primary text-black' : 'bg-surface text-yellow-500 hover:bg-yellow-500/10'}`}
                        title="Respostas Rápidas"
                    >
                        <Zap size={18} className={showQuickResponses ? 'fill-black' : 'fill-yellow-500'} />
                    </button>

                    {showQuickResponses && (
                        <div className="absolute bottom-full right-0 mb-2 w-[350px] h-[500px] bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col">
                            <QuickResponseManager
                                onClose={() => setShowQuickResponses(false)}
                                onSelect={handleQuickResponseSelect}
                            />
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsScheduling(!isScheduling)}
                        className={`p-1.5 rounded-lg transition-all z-10 ${isScheduling ? 'bg-primary text-black' : 'bg-surface text-zinc-500 hover:text-white'}`}
                        title="Agendar Envio"
                    >
                        <CalendarClock size={18} />
                    </button>

                    {isScheduling && (
                        <div className="absolute bottom-full right-0 mb-2 p-3 bg-zinc-950 border border-white/10 rounded-xl shadow-xl z-50 flex flex-col gap-2 min-w-[200px]">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Data e Hora</label>
                            <input
                                type="datetime-local"
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                className="bg-zinc-900 border border-white/10 rounded p-2 text-white text-xs outline-none focus:border-primary"
                            />
                            <button
                                onClick={() => {
                                    if (scheduledDate && draftText.trim()) {
                                        onScheduleMessage?.(draftText, new Date(scheduledDate));
                                        setIsScheduling(false);
                                        setDraftText('');
                                        setScheduledDate('');
                                    }
                                }}
                                disabled={!scheduledDate || !draftText.trim()}
                                className="bg-primary text-black text-xs font-bold py-1.5 rounded hover:bg-primaryHover disabled:opacity-50"
                            >
                                Agendar
                            </button>
                        </div>
                    )}
                </div>

                <div className="w-px h-5 bg-zinc-800 mx-1" />

                <button
                    onClick={handleSend}
                    disabled={!draftText.trim() || isSaving}
                    className="bg-primary text-zinc-900 p-1.5 rounded-lg hover:bg-primaryHover transition-all disabled:opacity-50 z-10"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
            </div>

            {/* Combined compact actions bar */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 shrink-0">
                    {isAddingTag ? (
                        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-1">
                            <input
                                autoFocus
                                value={newTag}
                                onChange={e => setNewTag(e.target.value)}
                                onBlur={() => {
                                    if (!newTag) setIsAddingTag(false);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        if (newTag.trim()) onAddTag(newTag.trim());
                                        setNewTag('');
                                        setIsAddingTag(false);
                                    }
                                    if (e.key === 'Escape') setIsAddingTag(false);
                                }}
                                placeholder="Nova tag..."
                                className="bg-zinc-900 border border-primary/50 rounded px-1.5 py-0.5 text-[10px] text-white outline-none w-24"
                            />
                            {/* Autocomplete for Tags */}
                            {newTag.length > 0 && (
                                <TagSuggestions
                                    searchTerm={newTag}
                                    onSelect={(tag) => {
                                        onAddTag(tag);
                                        setNewTag('');
                                        setIsAddingTag(false);
                                    }}
                                />
                            )}
                        </div>
                    ) : (
                        <button onClick={() => setIsAddingTag(true)} className="text-[10px] font-bold text-zinc-500 hover:text-white flex items-center gap-1 transition-colors">
                            <Palette size={12} /> TAGS
                        </button>
                    )}
                    <div className="w-px h-2.5 bg-zinc-800" />
                    <button onClick={() => {
                        const s = prompt(`Mover para: ${availableStages.join(', ')}`);
                        if (s) onMoveStage(s);
                    }} className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors">
                        MOVER
                    </button>
                </div>

                <div className="flex-1 min-w-0">
                    <input
                        value={internalNote}
                        onChange={(e) => onInternalNoteChange(e.target.value)}
                        onBlur={() => onSaveInternalNote(internalNote)}
                        placeholder="Nota rápida..."
                        className="w-full bg-transparent border-none text-[10px] text-zinc-500 outline-none truncate italic"
                    />
                </div>

                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                    {tags.slice(0, 2).map((tag, i) => (
                        <span key={i} className="bg-primary/5 text-primary text-[8px] font-bold px-1.5 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                            {tag}
                            <X size={8} className="cursor-pointer" onClick={() => onRemoveTag(tag)} />
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};
