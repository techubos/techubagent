import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox, Switch } from '../ui/index';
import { supabase } from '../../services/supabaseClient';
import { toast } from 'sonner';
import { addHours, addMinutes } from 'date-fns';

interface EventModalProps {
    event: any | null;
    onClose: () => void;
    onSave: () => void;
    organizationId: string;
    userId: string;
}

export function EventModal({ event, onClose, onSave, organizationId, userId }: EventModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_time: new Date().toISOString().slice(0, 16),
        end_time: addHours(new Date(), 1).toISOString().slice(0, 16),
        type: 'meeting',
        reminder_minutes: [15] as number[],
        whatsapp_notification: true
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title || '',
                description: event.resource?.description || '',
                start_time: event.start ? new Date(event.start).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
                end_time: event.end ? new Date(event.end).toISOString().slice(0, 16) : addHours(new Date(), 1).toISOString().slice(0, 16),
                type: event.type || 'meeting',
                reminder_minutes: event.resource?.reminder_minutes || [15],
                whatsapp_notification: event.resource?.whatsapp_notification ?? true
            });
        }
    }, [event]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        const payload = {
            title: formData.title,
            description: formData.description,
            start_time: new Date(formData.start_time).toISOString(),
            end_time: new Date(formData.end_time).toISOString(),
            type: formData.type,
            reminder_minutes: formData.reminder_minutes,
            whatsapp_notification: formData.whatsapp_notification,
            organization_id: organizationId,
            user_id: userId
        };

        try {
            if (event?.id === 'new') {
                const { error } = await supabase.from('calendar_events').insert(payload);
                if (error) throw error;
                toast.success("Evento criado com sucesso!");
            } else {
                const { error } = await supabase
                    .from('calendar_events')
                    .update(payload)
                    .eq('id', event.id);
                if (error) throw error;
                toast.success("Evento atualizado!");
            }

            onSave();
        } catch (err: any) {
            toast.error("Erro ao salvar evento: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleReminderToggle = (min: number) => {
        if (formData.reminder_minutes.includes(min)) {
            setFormData({
                ...formData,
                reminder_minutes: formData.reminder_minutes.filter(m => m !== min)
            });
        } else {
            setFormData({
                ...formData,
                reminder_minutes: [...formData.reminder_minutes, min]
            });
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle className="text-white">
                        {event?.id === 'new' ? 'Novo Evento' : 'Editar Evento'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-zinc-400">Título *</Label>
                        <Input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ex: Reunião com cliente"
                            required
                            className="bg-zinc-800 border-zinc-700 text-white"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-zinc-400">Descrição</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Detalhes do evento..."
                            rows={3}
                            className="bg-zinc-800 border-zinc-700 text-white"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-zinc-400">Início *</Label>
                            <Input
                                type="datetime-local"
                                value={formData.start_time}
                                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                className="bg-zinc-800 border-zinc-700 text-white"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-zinc-400">Fim *</Label>
                            <Input
                                type="datetime-local"
                                value={formData.end_time}
                                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                className="bg-zinc-800 border-zinc-700 text-white"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-zinc-400">Tipo</Label>
                        <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                                <SelectItem value="meeting">🤝 Reunião</SelectItem>
                                <SelectItem value="follow_up">📞 Follow-up</SelectItem>
                                <SelectItem value="call">☎️ Ligação</SelectItem>
                                <SelectItem value="task">✅ Tarefa</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-zinc-400">Lembretes</Label>
                        <div className="flex gap-4 mt-2">
                            {[5, 15, 30, 60].map(min => (
                                <div key={min} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`rem-${min}`}
                                        checked={formData.reminder_minutes.includes(min)}
                                        onCheckedChange={() => handleReminderToggle(min)}
                                        className="border-zinc-500 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                                    />
                                    <label htmlFor={`rem-${min}`} className="text-sm text-zinc-300 cursor-pointer">
                                        {min} min
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <Switch
                            checked={formData.whatsapp_notification}
                            onCheckedChange={(checked) =>
                                setFormData({ ...formData, whatsapp_notification: checked })
                            }
                            className="data-[state=checked]:bg-emerald-500"
                        />
                        <Label className="text-white cursor-pointer" onClick={() => setFormData({ ...formData, whatsapp_notification: !formData.whatsapp_notification })}>
                            Enviar lembrete por WhatsApp
                        </Label>
                    </div>

                    <DialogFooter className="mt-6 gap-2">
                        {event?.id !== 'new' && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={async () => {
                                    if (!confirm("Tem certeza que deseja cancelar este evento?")) return;
                                    setLoading(true);
                                    try {
                                        const { error } = await supabase
                                            .from('calendar_events')
                                            .update({ status: 'cancelled' })
                                            .eq('id', event.id);
                                        if (error) throw error;
                                        toast.success("Evento cancelado.");
                                        onSave();
                                    } catch (e) {
                                        toast.error("Erro ao cancelar.");
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="bg-red-500/20 text-red-500 hover:bg-red-500/30 border-none"
                            >
                                Cancelar Evento
                            </Button>
                        )}

                        <Button type="button" variant="outline" onClick={onClose} className="bg-transparent border-zinc-700 text-white hover:bg-zinc-800">
                            Fechar
                        </Button>

                        <Button type="submit" disabled={loading} className="bg-primary text-black hover:bg-primary/90 font-bold">
                            {loading ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
