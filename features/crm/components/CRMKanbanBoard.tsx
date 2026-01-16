
import React, { useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { KanbanColumn } from '../../../components/crm/KanbanColumn';
import { KanbanColumnVirtualized } from '../../../components/crm/KanbanColumnVirtualized';
import { KanbanCard } from '../../../components/crm/KanbanCard';
import { useContacts } from '../api/useContacts';
import { Contact, CRMColumn } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface CRMKanbanBoardProps {
    columns: CRMColumn[];
    contacts: Contact[];
    onContactClick: (contact: Contact) => void;
    onAddLead: (columnId: string) => void;
    onRename?: (columnId: string, newTitle: string) => void;
    isSidebar?: boolean;
}

export const CRMKanbanBoard: React.FC<CRMKanbanBoardProps> = ({ columns, contacts, onContactClick, onAddLead, onRename, isSidebar }) => {
    const queryClient = useQueryClient();

    // Group contacts by column (Memoized for performance)
    const contactsByColumn = useMemo(() => {
        const grouped: Record<string, Contact[]> = {};
        columns.forEach(col => grouped[col.id] = []);

        const seenIds = new Set<string>();

        contacts.forEach(c => {
            if (!c?.id || seenIds.has(c.id)) return;
            seenIds.add(c.id);

            const status = c.status || 'lead';
            if (grouped[status]) {
                grouped[status].push(c);
            } else {
                if (!grouped['lead']) grouped['lead'] = [];
                grouped['lead'].push(c);
            }
        });
        return grouped;
    }, [contacts, columns]);

    const handleDragEnd = useCallback(async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId as Contact['status'];
        const previousContacts = queryClient.getQueryData(['contacts']);

        // 1. Optimistic Update
        queryClient.setQueryData(['contacts'], (oldData: any) => {
            if (!oldData || !oldData.pages) return oldData;

            return {
                ...oldData,
                pages: oldData.pages.map((page: Contact[]) =>
                    page.map(c => c.id === draggableId ? { ...c, status: newStatus } : c)
                )
            };
        });

        // 2. Database Sync
        try {
            const { error } = await supabase
                .from('contacts')
                .update({ status: newStatus })
                .eq('id', draggableId);

            if (error) {
                // Rollback on error
                queryClient.setQueryData(['contacts'], previousContacts);
                console.error('Supabase update error:', error);
                toast.error('Erro ao salvar movimentação');
            }
        } catch (err) {
            queryClient.setQueryData(['contacts'], previousContacts);
            console.error('Error moving card:', err);
            toast.error('Erro ao conectar com servidor');
        }
    }, [queryClient]);

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className={`h-full ${isSidebar ? 'flex flex-col overflow-y-auto w-full p-2 gap-4' : 'flex overflow-x-auto p-4 gap-6 pb-12'}`}>
                {columns.map(column => (
                    <div key={column.id} className={`${isSidebar ? 'w-full' : 'h-full min-w-[340px] w-[340px]'} flex flex-col`}>
                        <Droppable droppableId={column.id}>
                            {(provided, snapshot) => (
                                <KanbanColumn
                                    column={column}
                                    contacts={contactsByColumn[column.id] || []}
                                    provided={provided}
                                    isDraggingOver={snapshot.isDraggingOver}
                                    onContactClick={onContactClick}
                                    onAddCard={onAddLead}
                                    onRename={onRename}
                                />
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
};
