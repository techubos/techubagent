import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Button, Card, CardHeader, CardTitle, CardContent } from '../components/ui/index';
import { Plus, Bot, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AIConfigAdvanced } from './AIConfigAdvanced';

export function AgentManager({ organizationId }: { organizationId: string }) {
    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

    useEffect(() => {
        fetchAgents();
    }, [organizationId]);

    const fetchAgents = async () => {
        if (!organizationId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('ai_agents')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: true });

        if (error) {
            toast.error('Erro ao carregar agentes');
            console.error(error);
        } else {
            setAgents(data || []);
        }
        setLoading(false);
    };

    const handleCreateAgent = async () => {
        const { data, error } = await supabase
            .from('ai_agents')
            .insert({
                organization_id: organizationId,
                name: 'Novo Agente',
                model: 'gpt-4o-mini',
                personality: 'friendly'
            })
            .select()
            .single();

        if (error) {
            toast.error('Erro ao criar agente');
        } else {
            toast.success('Agente criado!');
            setAgents([...agents, data]);
            setSelectedAgentId(data.id);
        }
    };

    const handleDeleteAgent = async (id: string, e: any) => {
        e.stopPropagation();
        if (!confirm('Tem certeza? Isso apagará todas as regras deste agente.')) return;

        const { error } = await supabase.from('ai_agents').delete().eq('id', id);
        if (error) {
            toast.error('Erro ao excluir');
        } else {
            toast.success('Agente excluído');
            setAgents(agents.filter(a => a.id !== id));
            if (selectedAgentId === id) setSelectedAgentId(null);
        }
    };

    if (selectedAgentId) {
        return (
            <div>
                <Button variant="ghost" onClick={() => setSelectedAgentId(null)} className="mb-4 text-zinc-400 hover:text-white">
                    ← Voltar para Lista de Agentes
                </Button>
                <AIConfigAdvanced organizationId={organizationId} agentId={selectedAgentId} />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen bg-[#09090b] text-white">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bot className="text-primary" /> Meus Agentes
                    </h1>
                    <p className="text-zinc-400">Gerencie múltiplos assistentes de IA para diferentes propósitos.</p>
                </div>
                <Button onClick={handleCreateAgent} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" /> Novo Agente
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map(agent => (
                    <div
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-all group relative"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <Bot size={24} />
                            </div>
                            <button
                                onClick={(e) => handleDeleteAgent(agent.id, e)}
                                className="text-zinc-500 hover:text-red-500 p-2"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <h3 className="font-semibold text-lg mb-1">{agent.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
                            <span className="bg-zinc-800 px-2 py-1 rounded">{agent.model}</span>
                            <span>•</span>
                            <span>{agent.personality}</span>
                        </div>

                        <div className="text-sm text-zinc-400 line-clamp-2">
                            {agent.custom_instructions || "Sem instruções personalizadas..."}
                        </div>

                        {agent.is_default && (
                            <div className="absolute top-4 right-12 bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30">
                                Padrão
                            </div>
                        )}
                    </div>
                ))}

                {agents.length === 0 && !loading && (
                    <div className="col-span-full text-center py-20 text-zinc-500 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800">
                        Nenhum agente encontrado. Crie o primeiro!
                    </div>
                )}
            </div>
        </div>
    );
}
