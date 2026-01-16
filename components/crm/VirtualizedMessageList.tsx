import React, { useRef, useEffect } from 'react';
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';

interface VirtualizedMessageListProps {
    messages: Message[];
    fetchNextPage: () => void;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
}

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
}) => {
    const endRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    // Simple scroll handler for pagination (top sentinel)
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop === 0 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    return (
        <div
            ref={containerRef}
            className="flex-1 w-full h-full overflow-y-auto px-4 py-4 custom-scrollbar flex flex-col gap-2"
            onScroll={handleScroll}
        >
            {/* Loading Indicator for History */}
            {isFetchingNextPage && (
                <div className="text-center py-2 relative z-10">
                    <span className="text-xs text-zinc-500 animate-pulse">Carregando histórico...</span>
                </div>
            )}

            {messages.filter(m => !!m).map((msg, index) => (
                <MessageBubble key={msg.id || index} message={msg} />
            ))}

            <div ref={endRef} />
        </div>
    );
};
