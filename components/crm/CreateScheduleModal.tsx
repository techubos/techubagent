import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Users, Clock, Search, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { toast } from 'sonner';

interface Contact {
    id: string;
    name: string;
    phone: string;
    tags?: string[];
}

interface CreateScheduleModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [mode, setMode] = useState<'single' | 'bulk'>('single');
    const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
    const [message, setMessage] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');

    // Validations
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState('');

    useEffect(() => {
        fetchContacts();
        fetchTags();
    }, []);

    const fetchContacts = async () => {
        const { data } = await supabase.from('contacts').select('id, name, phone, tags').eq('status', 'lead').limit(100); // Demo limit
        setAvailableContacts(data || []);
    };

    const fetchTags = async () => {
        // Fetch unique tags from contacts (simplified for now as we don't have a tags table yet in this context)
        // Ideally fetch from 'tags' table if it existed
        const { data } = await supabase.from('contacts').select('tags');
        const tags = new Set<string>();
        data?.forEach((c: any) => c.tags?.forEach((t: string) => tags.add(t)));
        setAvailableTags(Array.from(tags));
    };

    const handleBulkSelectByTag = () => {
        if (!selectedTag) return;
        const matching = availableContacts.filter(c => c.tags?.includes(selectedTag));
        setSelectedContacts(prev => {
            const newIds = new Set(prev.map(p => p.id));
            const unique = [...prev];
            matching.forEach(m => {
                if (!newIds.has(m.id)) unique.push(m);
            });
            return unique;
        });
        toast.success(`${matching.length} contatos adicionados da tag "${selectedTag}"`);
    };

    const handleSubmit = async () => {
        if (!scheduledDate || !message || selectedContacts.length === 0) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }

        setIsLoading(true);
        try {
            // Bulk insert logic
            const messagesToInsert = selectedContacts.map(contact => ({
                contact_id: contact.id,
                content: message,
                message_type: 'text',
                scheduled_for: new Date(scheduledDate).toISOString(),
                status: 'pending' as const
            }));

            // In a real bulk scenario, we might want to stagger these times slightly 
            // to avoid instant flooding, but for now we trust the user or the processor logic.
            // Feature idea: "Distribute over X hours" would modify 'scheduled_for' here.

            const { error } = await supabase.from('scheduled_messages').insert(messagesToInsert);

            if (error) throw error;

            toast.success(`${messagesToInsert.length} agendamentos criados com sucesso!`);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error("Erro ao agendar: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredContacts = availableContacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Calendar className="text-primary" /> Novo Agendamento
                        </h2>
                        <p className="text-zinc-500 text-sm">Programe mensagens para um ou múltiplos contatos.</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Step 1: Who */}
                    <div className="space-y-4">
                        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center text-[10px]">1</span>
                            Destinatários
                        </label>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode('single')}
                                className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all ${mode === 'single' ? 'bg-primary/10 border-primary text-primary' : 'bg-black border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                    }`}
                            >
                                <User size={18} /> Individual
                            </button>
                            <button
                                onClick={() => setMode('bulk')}
                                className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all ${mode === 'bulk' ? 'bg-primary/10 border-primary text-primary' : 'bg-black border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                    }`}
                            >
                                <Users size={18} /> Em Massa (Bulk)
                            </button>
                        </div>

                        {mode === 'single' ? (
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                <input
                                    placeholder="Buscar contato..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary text-white"
                                />
                                {searchTerm && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl max-h-40 overflow-y-auto z-10 shadow-xl">
                                        {filteredContacts.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    setSelectedContacts([c]);
                                                    setSearchTerm('');
                                                }}
                                                className="w-full text-left p-3 hover:bg-zinc-800 border-b border-zinc-800 last:border-0 text-sm text-zinc-300 flex justify-between"
                                            >
                                                <span>{c.name}</span>
                                                <span className="text-zinc-600">{c.phone}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-primary text-zinc-300"
                                    value={selectedTag}
                                    onChange={e => setSelectedTag(e.target.value)}
                                >
                                    <option value="">Selecione uma Tag...</option>
                                    {availableTags.map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleBulkSelectByTag}
                                    disabled={!selectedTag}
                                    className="px-4 py-3 bg-zinc-800 rounded-xl font-bold hover:bg-zinc-700 disabled:opacity-50"
                                >
                                    Adicionar
                                </button>
                            </div>
                        )}

                        {/* Selected List */}
                        {selectedContacts.length > 0 && (
                            <div className="flex flex-wrap gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800 max-h-32 overflow-y-auto">
                                {selectedContacts.map(c => (
                                    <span key={c.id} className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg text-xs flex items-center gap-2">
                                        {c.name}
                                        <button onClick={() => setSelectedContacts(selectedContacts.filter(x => x.id !== c.id))} className="hover:text-red-400">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        {selectedContacts.length === 0 && <p className="text-xs text-red-400">* Selecione pelo menos um contato</p>}
                    </div>

                    {/* Step 2: What & When */}
                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center text-[10px]">2</span>
                            Mensagem e Data
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Data e Hora</label>
                                <input
                                    type="datetime-local"
                                    value={scheduledDate}
                                    onChange={e => setScheduledDate(e.target.value)}
                                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-primary"
                                />
                            </div>
                            <div className="flex items-end pb-2">
                                <p className="text-xs text-zinc-500 flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    No modo em massa, as mensagens podem ser enviadas com um pequeno intervalo de segurança.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Conteúdo</label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Olá {nome}, tudo bem?..."
                                className="w-full h-32 bg-black border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-primary resize-none"
                            />
                            <p className="text-[10px] text-zinc-600 mt-1 text-right">Use <strong>&#123;nome&#125;</strong> para personalizar automaticamente.</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 text-zinc-400 font-bold hover:text-white transition-colors">Cancelar</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !scheduledDate || !message || selectedContacts.length === 0}
                        className="px-6 py-2 bg-primary text-black font-black rounded-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                    >
                        {isLoading ? 'Agendando...' : <><Check size={18} /> Confirmar Agendamento</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
