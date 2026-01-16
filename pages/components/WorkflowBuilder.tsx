import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/index';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, GitFork, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function WorkflowBuilder({ organizationId, agentId }: { organizationId: string, agentId?: string }) {
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadWorkflows();
    }, [organizationId, agentId]);

    const loadWorkflows = async () => {
        setLoading(true);
        let query = supabase.from('ai_workflows').select('*').eq('organization_id', organizationId);

        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        const { data, error } = await query;
        if (error) {
            toast.error("Erro ao carregar fluxos");
        } else {
            setWorkflows(data || []);
        }
        setLoading(false);
    };

    const handleCreateWrapper = async () => {
        const { data, error } = await supabase
            .from('ai_workflows')
            .insert({
                organization_id: organizationId,
                agent_id: agentId,
                name: 'Novo Fluxo',
                description: 'Fluxo criado via editor',
                steps: [], // Deprecated in favor of nodes/edges
                nodes: [
                    { id: 'start', type: 'input', position: { x: 250, y: 50 }, data: { label: '▶️ Início', type: 'start' }, style: { background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', minWidth: '150px', fontWeight: 'bold', textAlign: 'center' } }
                ],
                edges: [],
                enabled: true
            })
            .select()
            .single();

        if (error) {
            toast.error("Erro ao criar fluxo");
        } else {
            toast.success("Fluxo criado!");
            navigate(`/workflow/${data.id}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza?")) return;
        await supabase.from('ai_workflows').delete().eq('id', id);
        loadWorkflows();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Fluxos de Conversa</h2>
                <Button onClick={handleCreateWrapper} className="bg-primary hover:bg-primary/90">
                    <Plus size={16} className="mr-2" /> Novo Fluxo
                </Button>
            </div>

            {loading ? <div className="text-zinc-500">Carregando...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workflows.length === 0 && <div className="col-span-full text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">Nenhum fluxo encontrado.</div>}

                    {workflows.map(wf => (
                        <div key={wf.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-primary/50 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <GitFork size={20} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => navigate(`/workflow/${wf.id}`)}>
                                        <Edit size={16} />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-red-500" onClick={() => handleDelete(wf.id)}>
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>

                            <h3 className="font-semibold text-white mb-1">{wf.name}</h3>
                            <p className="text-sm text-zinc-400 line-clamp-2 mb-4">{wf.description || "Sem descrição"}</p>

                            <Button
                                variant="outline"
                                className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                                onClick={() => navigate(`/workflow/${wf.id}`)}
                            >
                                <Play size={14} className="mr-2" /> Abrir Editor Visual
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
