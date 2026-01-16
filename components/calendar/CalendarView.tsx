'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/pt-br';
import { supabase } from '../../services/supabaseClient';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/index';
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { EventModal } from './EventModal';
import { startOfMonth, endOfMonth, addMonths, subMonths, format, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

moment.locale('pt-br');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

interface CalendarViewProps {
    organizationId: string;
    userId: string;
}

interface Event {
    id: string;
    title: string;
    start: Date;
    end: Date;
    contact?: { name: string };
    type: 'meeting' | 'follow_up' | 'call' | 'task';
    resource?: any;
}

export function CalendarView({ organizationId, userId }: CalendarViewProps) {
    const [view, setView] = useState<any>('month');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const start = startOfMonth(selectedDate).toISOString();
            const end = endOfMonth(selectedDate).toISOString();

            const { data, error } = await supabase
                .from('calendar_events')
                .select('*, contacts(name, phone)')
                .eq('organization_id', organizationId)
                // .gte('start_time', start) // Filtering locally or fetch wider range? Let's filter wider for now or fix query
                // .lte('end_time', end) // Supabase filters might be tricky with TZ, let's grab all active for the month
                .neq('status', 'cancelled');

            if (error) throw error;

            const formattedEvents = (data || []).map((e: any) => ({
                id: e.id,
                title: e.title,
                start: new Date(e.start_time),
                end: new Date(e.end_time),
                contact: e.contacts,
                type: e.type,
                resource: e
            }));

            setEvents(formattedEvents);
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (organizationId) fetchEvents();
    }, [organizationId, selectedDate]); // Refetch when org or date changes (if we apply range filters)

    // Cores por tipo
    const eventStyleGetter = (event: Event) => {
        const colors: any = {
            meeting: { backgroundColor: '#3B82F6' }, // Blue
            follow_up: { backgroundColor: '#10B981' }, // Emerald
            call: { backgroundColor: '#F59E0B' }, // Amber
            task: { backgroundColor: '#8B5CF6' } // Violet
        };

        return { style: colors[event.type] || {} };
    };

    const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
        setSelectedEvent({
            id: 'new',
            title: '',
            start,
            end,
            type: 'meeting'
        });
        setShowEventModal(true);
    };

    const handleSelectEvent = (event: Event) => {
        setSelectedEvent(event);
        setShowEventModal(true);
    };

    const handleEventDrop = async ({ event, start, end }: any) => {
        // Optimistic update
        const updatedEvents = events.map(e => e.id === event.id ? { ...e, start, end } : e);
        setEvents(updatedEvents);

        const { error } = await supabase
            .from('calendar_events')
            .update({
                start_time: start.toISOString(),
                end_time: end.toISOString()
            })
            .eq('id', event.id);

        if (error) {
            console.error("Failed to move event", error);
            fetchEvents(); // Revert on error
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950/50 rounded-3xl border border-white/5 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-zinc-900/50">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        className="border-white/10 text-white hover:bg-zinc-800"
                        onClick={() => setSelectedDate(new Date())}
                    >
                        Hoje
                    </Button>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-zinc-800"
                            onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <h2 className="text-xl font-black text-white px-4 capitalize tracking-tight min-w-[200px] text-center">
                            {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-zinc-800"
                            onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* View Select manually styled since libraries might conflict with standard UI kit */}
                    <div className="flex bg-zinc-900 rounded-lg p-1 border border-white/5">
                        {['month', 'week', 'day', 'agenda'].map((v: any) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${view === v ? 'bg-primary text-black' : 'text-zinc-500 hover:text-white'}`}
                            >
                                {v === 'agenda' ? 'Agenda' : v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
                            </button>
                        ))}
                    </div>

                    <Button
                        className="bg-primary text-black hover:bg-primary/90 font-bold"
                        onClick={() => {
                            setSelectedEvent({
                                id: 'new',
                                title: '',
                                start: new Date(),
                                end: addHours(new Date(), 1),
                                type: 'meeting'
                            });
                            setShowEventModal(true);
                        }}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Evento
                    </Button>
                </div>
            </div>

            {/* Calendar */}
            <div className="flex-1 p-6 bg-zinc-950 text-white calendar-dark-theme">
                {loading && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>}
                {/* @ts-ignore */}
                <DnDCalendar
                    localizer={localizer}
                    events={events}
                    view={view}
                    onView={setView}
                    date={selectedDate}
                    onNavigate={setSelectedDate}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    onEventDrop={handleEventDrop}
                    eventPropGetter={eventStyleGetter}
                    selectable
                    resizable
                    style={{ height: 'calc(100vh - 250px)' }} // Adjust height
                    messages={{
                        today: 'Hoje',
                        previous: 'Anterior',
                        next: 'Próximo',
                        month: 'Mês',
                        week: 'Semana',
                        day: 'Dia',
                        agenda: 'Agenda',
                        noEventsInRange: 'Nenhum evento neste período'
                    }}
                    formats={{
                        timeGutterFormat: 'HH:mm',
                    }}
                />
            </div>

            {/* CSS Overrides for Dark Mode */}
            <style jsx global>{`
        .calendar-dark-theme .rbc-calendar { color: #e4e4e7; }
        .calendar-dark-theme .rbc-header { border-bottom: 1px solid #27272a; padding: 12px; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; color: #a1a1aa; }
        .calendar-dark-theme .rbc-month-view { border: 1px solid #27272a; border-radius: 12px; }
        .calendar-dark-theme .rbc-day-bg { border-left: 1px solid #27272a; }
        .calendar-dark-theme .rbc-off-range-bg { bg-color: #0f0f10; }
        .calendar-dark-theme .rbc-today { background-color: rgba(34, 197, 94, 0.05); }
        .calendar-dark-theme .rbc-event { border-radius: 6px; }
        .calendar-dark-theme .rbc-time-view { border: 1px solid #27272a; border-radius: 12px; }
        .calendar-dark-theme .rbc-time-header { border-bottom: 1px solid #27272a; }
        .calendar-dark-theme .rbc-time-content { border-top: 1px solid #27272a; }
        .calendar-dark-theme .rbc-timeslot-group { border-bottom: 1px solid #27272a; }
        .calendar-dark-theme .rbc-time-slot { border-top: 1px solid #27272a; }
        .calendar-dark-theme .rbc-day-slot .rbc-time-slot { border-top: 1px solid #27272a; }
      `}</style>

            {/* Modal de Evento */}
            {showEventModal && (
                <EventModal
                    event={selectedEvent}
                    onClose={() => {
                        setShowEventModal(false);
                        setSelectedEvent(null);
                    }}
                    onSave={() => {
                        fetchEvents();
                        setShowEventModal(false);
                    }}
                    organizationId={organizationId}
                    userId={userId}
                />
            )}
        </div>
    );
}
