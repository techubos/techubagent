
import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { useAutoScroll } from '../../features/crm/api/useMessages';

interface MessageListProps {
    messages: Message[];
    isLoading?: boolean;
    onFeedback?: (messageId: string, rating: 1 | -1, correction?: string) => void;
    // New Props for Pagination
    hasMore?: boolean;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    isLoading,
    onFeedback,
    hasMore,
    onLoadMore,
    isLoadingMore
}) => {
    // Refs
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);

    // State
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [prevScrollHeight, setPrevScrollHeight] = useState(0);

    // 1. SCROLL MANAGEMENT LOGIC
    // We use a LayoutEffect to handle scroll BEFORE paint to avoid flicker
    useLayoutEffect(() => {
        if (!containerRef.current) return;

        // Scenario A: New messages added at the bottom (Realtime or User sent)
        // Check if we should autoscroll (user was near bottom)
        if (shouldAutoScroll) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }

        // Scenario B: Messages added at top (Pagination)
        // Restore scroll position
        if (isLoadingMore && prevScrollHeight > 0) {
            const newHeight = containerRef.current.scrollHeight;
            const diff = newHeight - prevScrollHeight;
            containerRef.current.scrollTop += diff;
        }
    }, [messages, shouldAutoScroll, isLoadingMore, prevScrollHeight]);

    // Track scroll height for pagination restoration
    useEffect(() => {
        if (containerRef.current) {
            setPrevScrollHeight(containerRef.current.scrollHeight);
        }
    }, [messages]);

    // 2. DETECT USER SCROLL INTENT
    const handleScroll = () => {
        if (!containerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150; // 150px threshold
        setShouldAutoScroll(isNearBottom);

        // Detect Top (Trigger Load More)
        if (scrollTop < 50 && hasMore && !isLoadingMore && onLoadMore) {
            onLoadMore();
        }
    };

    // 3. IMAGE LOADING HANDLER
    // When an image loads, it changes scrollHeight. We need to re-adjust.
    const handleImageLoad = () => {
        if (shouldAutoScroll) {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' }); // Instant jump if near bottom
        }
    };

    if (isLoading && messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-50">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
                    Recuperando histórico...
                </p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar bg-transparent min-h-0 scroll-smooth relative"
        >
            {/* Loading Spinner for Pagination */}
            {isLoadingMore && (
                <div className="flex justify-center py-2 h-10 w-full overflow-hidden">
                    <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            )}

            {!hasMore && messages.length > 20 && (
                <div className="text-center text-[10px] uppercase tracking-widest text-zinc-400 py-4 opacity-50">
                    Início da conversa
                </div>
            )}

            {/* Empty State */}
            {messages.length === 0 && !isLoading && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-50 space-y-2">
                    <p>Nenhuma mensagem ainda.</p>
                </div>
            )}

            {/* List */}
            {messages.map((msg, idx) => {
                // Determine grouping (same user, < 1 min diff)
                const prevMsg = messages[idx - 1];
                const isGrouped = prevMsg
                    && prevMsg.role === msg.role
                    && (msg.timestamp - prevMsg.timestamp < 60000);

                return (
                    <div key={msg.id || idx} className={isGrouped ? "mt-1" : "mt-3"}>
                        <MessageBubble
                            message={msg}
                            onFeedback={onFeedback}
                            onImageLoad={handleImageLoad} // Pass callback down
                        />
                    </div>
                );
            })}

            {/* Scroll Anchor */}
            <div ref={bottomRef} className="h-px w-full" />
        </div>
    );
};
