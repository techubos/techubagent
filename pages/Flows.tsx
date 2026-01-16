import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { GitBranch, Plus, Trash2, Calendar, MoreVertical, PlayCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader, CardTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/index';

interface Workflow {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'active' | 'paused';
    trigger_type: string;
    total_executions: number;
    updated_at: string;
}

export const Flows: React.FC = () => {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('workflows')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error(error);
            toast.error("Erro ao carregar fluxos");
        } else {
            setWorkflows(data || []);
        }
        setLoading(false);
    };

    const handleCreateWorkflow = async () => {
        // Create a new draft workflow
        const { data: profile } = await supabase.auth.getUser();
        if (!profile.user) return;

        // Get Org ID (assuming profile join or context, here fetching simplistic)
        const { data: profileData } = await supabase.from('profiles').select('organization_id').eq('id', profile.user.id).single();
        if (!profileData) return toast.error("Erro de perfil");

        const { data, error } = await supabase.from('workflows').insert({
            organization_id: profileData.organization_id,
            name: 'Novo Fluxo de Automação',
            description: 'Descrição do fluxo...',
            status: 'draft',
            nodes: [],
            edges: []
        }).select().single();

        if (error) {
            toast.error("Erro ao criar fluxo");
        } else {
            toast.success("Fluxo criado!");
            navigate(`/workflow/${data.id}`);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir?')) return;

        const { error } = await supabase.from('workflows').delete().eq('id', id);
        if (error) toast.error("Erro ao excluir");
        else {
            toast.success("Excluído com sucesso");
            setWorkflows(workflows.filter(w => w.id !== id));
        }
    };

    return (
        <div className="p-6 h-full bg-black min-h-screen text-white">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <GitBranch className="text-primary" /> Automações
                    </h1>
                    <p className="text-zinc-400 mt-1">Crie fluxos inteligentes para atender seus clientes 24/7</p>
                </div>
                <Button onClick={handleCreateWorkflow} className="bg-primary text-black hover:bg-primary/90 font-bold">
                    <Plus size={18} className="mr-2" /> Novo Fluxo
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workflows.length === 0 && (
                        <div className="col-span-full text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
                            <GitBranch size={48} className="mx-auto text-zinc-700 mb-4" />
                            <h3 className="text-xl font-bold text-zinc-300">Nenhum fluxo encontrado</h3>
                            <p className="text-zinc-500 mb-6">Comece criando sua primeira automação.</p>
                            <Button onClick={handleCreateWorkflow} variant="outline" className="border-zinc-700">Criar Agora</Button>
                        </div>
                    )}

                    {workflows.map(workflow => (
                        <Card
                            key={workflow.id}
                            className="bg-zinc-900 border-zinc-800 hover:border-primary/50 transition-all cursor-pointer group"
                            onClick={() => navigate(`/workflow/${workflow.id}`)}
                        >
                            <CardHeader className="flex flex-row items-start justify-between pb-2">
                                <div className="flex gap-3 items-center">
                                    <div className={`p-2 rounded-lg ${workflow.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-400'}`}>
                                        <GitBranch size={20} />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold text-white">{workflow.name}</CardTitle>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${workflow.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'
                                                }`}>
                                                {workflow.status === 'draft' ? 'Rascunho' : workflow.status}
                                            </span>
                                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                                                <PlayCircle size={10} /> {workflow.total_executions || 0} execuções
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white">
                                            <MoreVertical size={16} />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-zinc-950 border-zinc-800 text-white">
                                        <DropdownMenuItem onClick={(e) => handleDelete(workflow.id, e)} className="text-red-400 focus:text-red-400">
                                            <Trash2 size={14} className="mr-2" /> Excluir
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-zinc-500 line-clamp-2 min-h-[40px]">
                                    {workflow.description || "Sem descrição..."}
                                </p>
                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center text-xs text-zinc-600 gap-1">
                                    <Calendar size={12} />
                                    Atualizado em {new Date(workflow.updated_at).toLocaleDateString()}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

