
import React from 'react';
import { Message } from '../../types';
import { CheckCircle2, AlertTriangle, ThumbsUp, ThumbsDown, Edit2, Play } from 'lucide-react';
import { AudioMessage } from './AudioMessage';
import { LazyImage } from './LazyImage';
import { VideoThumbnail } from './VideoThumbnail';

interface MessageBubbleProps {
    message: Message;
    onFeedback?: (messageId: string, rating: 1 | -1, correction?: string) => void;
}

const MessageBubbleBase: React.FC<MessageBubbleProps> = ({ message, onFeedback }) => {
    if (!message) return null;

    const isMe = message.is_from_me || message.role === 'assistant' || message.role === 'model';
    const isSystem = message.role === 'system' || message.content?.includes('[Nota Interna]');

    if (isSystem) {
        return (
            <div className="flex justify-center my-2">
                <div className="bg-amber-500/5 backdrop-blur-md border border-amber-500/20 text-amber-500 text-[9px] uppercase tracking-tighter font-black py-1 px-4 rounded-full flex items-center gap-2">
                    <AlertTriangle size={10} className="shrink-0" />
                    <span>{message.content?.replace('[Nota Interna]:', '').trim()}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1.5 px-2`}>
            <div className={`
                max-w-[85%] md:max-w-[70%] rounded-[1.5rem] p-4 shadow-xl relative group transition-all duration-300
                ${isMe
                    ? 'bg-primary text-zinc-950 rounded-br-none border border-primary/20 shadow-[0_10px_30px_rgba(16,185,129,0.2)]'
                    : 'bg-zinc-900/50 border border-white/[0.03] text-zinc-100 rounded-bl-none backdrop-blur-2xl'}
            `}>
                {/* Text Message */}
                {message.message_type === 'text' && (
                    <p className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${isMe ? 'text-white' : 'text-zinc-200'}`}>
                        {message.content}
                    </p>
                )}

                {/* Audio Message */}
                {message.message_type === 'audio' && (message.mediaUrl || message.audioUrl) && (
                    <div className="min-w-[240px] md:min-w-[280px]">
                        <AudioMessage
                            audioUrl={message.mediaUrl || message.audioUrl || ''}
                            transcription={message.transcription}
                        />
                    </div>
                )}

                {/* Image */}
                {message.message_type === 'image' && (message.mediaUrl || message.audioUrl) && (
                    <LazyImage
                        src={message.mediaUrl || message.audioUrl || ''}
                        alt="Media"
                        className="rounded-xl w-full h-[200px] md:h-[300px] mt-3 border border-white/10 shadow-lg"
                    />
                )}

                {/* Video (with Thumbnail) */}
                {message.message_type === 'video' && (message.mediaUrl || message.audioUrl) && (
                    <VideoThumbnail
                        videoUrl={message.mediaUrl || message.audioUrl || ''}
                        thumbnailUrl={message.payload?.thumbnailUrl}
                        className="w-full h-[200px] md:h-[300px] mt-3"
                    />
                )}

                {/* Timestamp */}
                <div className={`text-[9px] mt-2 flex justify-end gap-1.5 font-bold uppercase tracking-widest ${isMe ? 'text-emerald-100/70' : 'text-zinc-500'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && <CheckCircle2 size={10} />}
                </div>

                {/* Feedback Controls (Only for AI messages, when hovered, and if not me/human) */}
                {message.role === 'assistant' && !message.is_from_me && (
                    <div className="absolute -right-14 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0">
                        <button
                            onClick={() => onFeedback?.(message.id, 1)}
                            className="w-8 h-8 flex items-center justify-center bg-zinc-900/80 hover:bg-emerald-500/20 text-zinc-500 hover:text-emerald-500 rounded-full border border-white/5 backdrop-blur-sm transition-all hover:scale-110 shadow-lg"
                            title="Resposta Boa"
                        >
                            <ThumbsUp size={14} />
                        </button>
                        <button
                            onClick={() => onFeedback?.(message.id, -1)}
                            className="w-8 h-8 flex items-center justify-center bg-zinc-900/80 hover:bg-red-500/20 text-zinc-500 hover:text-red-500 rounded-full border border-white/5 backdrop-blur-sm transition-all hover:scale-110 shadow-lg"
                            title="Corrigir Resposta"
                        >
                            <ThumbsDown size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const MessageBubble = React.memo(MessageBubbleBase);
