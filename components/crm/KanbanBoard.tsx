
import React from 'react';
import { Contact, CRMColumn } from '../../types';
import { KanbanColumn } from './KanbanColumn';
import { Plus } from 'lucide-react';

interface KanbanBoardProps {
    columns: CRMColumn[];
    contacts: Contact[];
    selectedContactId: string | undefined;
    onContactSelect: (contact: Contact) => void;
    onDragStart: (e: React.DragEvent, contactId: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, columnId: string) => void;
    onAddCard: (columnId: string) => void;
    onAddColumn: () => void;
    draggedContactId: string | null;
    onMagicReply?: (contact: Contact) => void;
}

export const KanbanBoardBase: React.FC<KanbanBoardProps> = ({
    columns,
    contacts,
    selectedContactId,
    onContactSelect,
    onDragStart,
    onDragOver,
    onDrop,
    onAddCard,
    onAddColumn,
    draggedContactId,
    onMagicReply
}) => {
    return (
        <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar scroll-smooth snap-x snap-mandatory">
            {columns.map(col => (
                <div key={col.id} className="snap-center h-full">
                    <KanbanColumn
                        column={col}
                        contacts={contacts.filter(c => (c.status === col.id) || (!c.status && col.id === 'lead'))}
                        selectedContactId={selectedContactId}

                        onContactClick={onContactSelect}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onAddCard={onAddCard}
                        isDraggingOver={false} // Can be improved later for visual feedback
                        onMagicReply={onMagicReply}
                    />
                </div>
            ))}

            {/* Add Column Button */}
            <div className="min-w-[280px] w-[280px] flex items-start justify-center pt-10 h-full snap-center">
                <button
                    onClick={onAddColumn}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg border border-dashed border-zinc-600 hover:text-white hover:border-zinc-400 transition-all"
                >
                    <Plus size={18} /> Novo Quadro
                </button>
            </div>
        </div>
    );
};

export const KanbanBoard = React.memo(KanbanBoardBase);
