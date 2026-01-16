import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Button } from '../../components/ui/index';
import { Trash2, AlertTriangle } from 'lucide-react';

export function MemorySettings({ organizationId }: { organizationId: string }) {
    const [memories, setMemories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMemories();
    }, [organizationId]);

    const loadMemories = async () => {
        setLoading(true);
        // This is tricky because memory is by contact, not org directly. 
        // We need to fetch contacts first or join. 
        // For admin overview, let's fetch ALL memories for this org's contacts.

        const { data } = await supabase
            .from('ai_memory')
            .select(`
                *,
                contacts!inner(name, phone, organization_id)
            `)
            .eq('contacts.organization_id', organizationId)
            .limit(50); // Limit for performance in this view

        setMemories(data || []);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        await supabase.from('ai_memory').delete().eq('id', id);
        loadMemories();
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Memória da IA (Últimas 50)</h2>
            <p className="text-sm text-zinc-400">Dados que a IA aprendeu sobre seus contatos.</p>

            {loading ? <div className="text-zinc-500">Carregando...</div> : (
                <div className="grid gap-4">
                    {memories.length === 0 && <div className="text-zinc-500">Nenhuma memória salva ainda.</div>}
                    {memories.map(mem => (
                        <div key={mem.id} className="bg-zinc-900/50 p-4 border border-zinc-800 rounded-lg flex justify-between">
                            <div>
                                <div className="font-bold text-primary">{mem.key}</div>
                                <div className="text-white text-lg">{mem.value}</div>
                                <div className="text-xs text-zinc-500 mt-1">
                                    Contato: {mem.contacts?.name || mem.contacts?.phone} • Confiança: {Math.round(mem.confidence * 100)}%
                                </div>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(mem.id)} className="text-zinc-500 hover:text-red-500">
                                <Trash2 size={16} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
