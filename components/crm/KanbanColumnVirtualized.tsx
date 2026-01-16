import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Contact, CRMColumn } from '../../types';
import { KanbanCard } from './KanbanCard';
import { Plus } from 'lucide-react';
import * as ReactWindow from 'react-window';
import * as AutoSizerModule from 'react-virtualized-auto-sizer';

const List = (ReactWindow as any).FixedSizeList || (ReactWindow as any).default?.FixedSizeList || (ReactWindow as any).default;
const AutoSizer = (AutoSizerModule as any).default || AutoSizerModule;

interface KanbanColumnVirtualizedProps {
    column: CRMColumn;
    contacts: Contact[];
    selectedContactId?: string;
    onContactClick?: (contact: Contact) => void;
    onAddCard?: (columnId: string) => void;
    isDraggingOver?: boolean;
    onMagicReply?: (contact: Contact) => void;
    provided?: any; // DroppableProvided
}

// Row Component
const Row = ({ index, style, data }: any) => {
    const { contacts, selectedContactId, onContactClick, onMagicReply } = data;
    const contact = contacts[index];

    // Card Height + Margin calculation
    const CARD_MARGIN = 12;
    // We adjust style to create gaps
    const patchedStyle = {
        ...style,
        left: Number(style.left) + 16, // Padding X
        top: Number(style.top) + 16,   // Padding Y
        width: `calc(${style.width} - 32px)`, // Padding X * 2
        height: Number(style.height) - CARD_MARGIN,
    };

    return (
        <Draggable draggableId={contact.id} index={index} key={contact.id}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                        ...patchedStyle,
                        ...provided.draggableProps.style, // Apply DnD transform over our position
                    }}
                >
                    <KanbanCard
                        contact={contact}
                        selected={selectedContactId === contact.id}
                        onClick={onContactClick}
                        onMagicReply={onMagicReply}
                    />
                </div>
            )}
        </Draggable>
    );
};

export const KanbanColumnVirtualized: React.FC<KanbanColumnVirtualizedProps> = ({
    column,
    contacts,
    selectedContactId,
    onContactClick,
    onAddCard,
    isDraggingOver,
    onMagicReply,
    provided
}) => {
    return (
        <div
            className={`
                min-w-[340px] w-[340px] bg-zinc-950/20 backdrop-blur-3xl rounded-[2rem] border border-white/[0.03] flex flex-col h-full transition-all duration-500
                ${isDraggingOver ? 'bg-primary/5 border-primary/20 shadow-[0_0_40px_rgba(16,185,129,0.05)]' : ''}
            `}
            ref={provided?.innerRef}
            {...provided?.droppableProps}
        >
            {/* High-End Header */}
            <div className={`p-6 flex justify-between items-center border-b border-white/[0.03] select-none`}>
                <div className="flex items-center gap-4">
                    <div className={`w-1 h-6 rounded-full ${column.color.replace('border-l-', 'bg-')} shadow-[0_0_15px_currentColor] opacity-80`} />
                    <div className="flex flex-col">
                        <span className="uppercase text-[10px] font-black tracking-[0.2em] text-white/90">{column.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{contacts.length} Leads</span>
                        </div>
                    </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                </div>
            </div>

            {/* Virtual List */}
            <div className="flex-1 min-h-0">
                <AutoSizer>
                    {({ height, width }: any) => (
                        <List
                            height={height}
                            width={width}
                            itemCount={contacts.length}
                            itemSize={160} // Fixed height for cards approx
                            itemData={{ contacts, selectedContactId, onContactClick, onMagicReply }}
                        // We attach the scroll container ref to nothing specific here for dnd, 
                        // because dnd "virtual" mode handles scroll via window or parent usually,
                        // but react-window handles internal scroll.
                        // For complex virtual dnd, we might need outerRef={provided.innerRef} IF provided was for the list.
                        // Here provided is for the COLUMN container.
                        >
                            {Row}
                        </List>
                    )}
                </AutoSizer>
            </div>

            {/* Placeholder - Hidden/Handled by Virtual Mode usually, but required for types */}
            <div className="hidden">{provided?.placeholder}</div>

            <button
                onClick={() => onAddCard && onAddCard(column.id)}
                className="p-4 text-zinc-500 hover:text-primary hover:bg-primary/5 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border-t border-white/5 transition-all"
            >
                <Plus size={14} /> Novo Lead no Funil
            </button>
        </div>
    );
};
