import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import { Contact, CRMColumn } from '../../types';
import { KanbanCard } from './KanbanCard';
import { Plus, Edit2 } from 'lucide-react';

interface KanbanColumnProps {
    column: CRMColumn;
    contacts: Contact[];
    selectedContactId?: string;
    onContactClick?: (contact: Contact) => void;
    onDragStart?: (e: React.DragEvent, contactId: string) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent, columnId: string) => void;
    onAddCard?: (columnId: string) => void;
    isDraggingOver?: boolean;
    onMagicReply?: (contact: Contact) => void;
    onRename?: (columnId: string, newTitle: string) => void;
    provided?: any; // DroppableProvided from @hello-pangea/dnd
}

export const KanbanColumnBase: React.FC<KanbanColumnProps> = ({
    column,
    contacts,
    selectedContactId,
    onContactClick,
    onAddCard,
    isDraggingOver,
    onMagicReply,
    onRename,
    provided
}) => {
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [tempTitle, setTempTitle] = React.useState(column.title);
    return (
        <div
            className={`
                flex flex-col h-full bg-zinc-950/20 backdrop-blur-3xl rounded-[2.5rem] border border-white/[0.03] transition-all duration-100
                ${isDraggingOver ? 'bg-primary/5 border-primary/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : ''}
            `}
        >
            {/* Premium Header */}
            <div className="p-6 pb-4 flex justify-between items-center bg-gradient-to-b from-white/[0.02] to-transparent select-none group/column">
                <div className="flex items-center gap-4 flex-1 mr-2">
                    <div className={`w-1 h-6 rounded-full ${column.color?.replace('border-l-', 'bg-') || 'bg-zinc-700'} shadow-[0_0_15px_currentColor] opacity-80`} />
                    <div className="flex flex-col flex-1 min-w-0">
                        {isEditingTitle ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    className="bg-zinc-900 border border-primary/50 rounded-lg px-2 py-1 text-[10px] font-black tracking-widest text-white w-full outline-none"
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    onBlur={() => setIsEditingTitle(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            onRename && onRename(column.id, tempTitle);
                                            setIsEditingTitle(false);
                                        }
                                        if (e.key === 'Escape') setIsEditingTitle(false);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="uppercase text-[10px] font-black tracking-[0.2em] text-white/90 truncate">{column.title}</span>
                                <button
                                    onClick={() => {
                                        setTempTitle(column.title);
                                        setIsEditingTitle(true);
                                    }}
                                    className="opacity-0 group-hover/column:opacity-100 transition-opacity p-1 hover:text-primary"
                                >
                                    <Edit2 size={10} />
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{contacts.length} Leads</span>
                        </div>
                    </div>
                </div>
                <div className="w-9 h-9 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center group/add cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-all"
                    onClick={() => onAddCard && onAddCard(column.id)}>
                    <Plus size={16} className="text-zinc-500 group-hover/add:text-primary transition-colors" />
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div
                className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar min-h-0"
                ref={provided?.innerRef}
                {...provided?.droppableProps}
            >
                {contacts.map((contact, index) => (
                    <Draggable key={contact.id} draggableId={contact.id} index={index}>
                        {(provided, snapshot) => {
                            const child = (
                                <KanbanCard
                                    contact={contact}
                                    selected={selectedContactId === contact.id}
                                    onClick={onContactClick || (() => { })}
                                    onMagicReply={onMagicReply}
                                    innerRef={provided.innerRef}
                                    draggableProps={provided.draggableProps}
                                    dragHandleProps={provided.dragHandleProps}
                                    isDragging={snapshot.isDragging}
                                />
                            );

                            if (snapshot.isDragging) {
                                return createPortal(child, document.body);
                            }
                            return child;
                        }}
                    </Draggable>
                ))}
                {provided?.placeholder}

                {contacts.length === 0 && !isDraggingOver && (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-white/[0.02] rounded-[2rem]">
                        <div className="w-12 h-12 rounded-full bg-zinc-900/50 flex items-center justify-center mb-4 text-zinc-700">
                            <Plus size={20} />
                        </div>
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.1em]">Coluna Vazia</p>
                    </div>
                )}
            </div>

            {/* Quick Add Bottom Button */}
            <button
                onClick={() => onAddCard && onAddCard(column.id)}
                className="mx-6 mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-zinc-500 hover:text-primary hover:bg-primary/5 hover:border-primary/20 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            >
                <Plus size={14} /> Novo Lead no Funil
            </button>
        </div>
    );
};

export const KanbanColumn = React.memo(KanbanColumnBase);
