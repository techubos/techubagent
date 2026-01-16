import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlow, Controls, Background, MiniMap, BackgroundVariant, addEdge, useNodesState, useEdgesState, Panel, Connection, Edge, MarkerType, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '../services/supabaseClient';
import { Button, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Card, CardContent } from '../components/ui/index';
import { ArrowLeft, Save, Play, Plus, Trash2, MessageSquare, HelpCircle, GitBranch, Zap, MousePointerClick, Clock, Search, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { useParams, useNavigate } from 'react-router-dom';

// --- NODE CATEGORIES & PALETTE ---
const NODE_CATEGORIES = [
    {
        name: 'Gatilhos',
        icon: <Zap size={16} />,
        nodes: [
            { type: 'trigger', label: 'Início / Gatilho', icon: <Play size={16} />, color: 'bg-green-600' },
            { type: 'trigger_schedule', label: 'Agendamento', icon: <Clock size={16} />, color: 'bg-green-600' }
        ]
    },
    {
        name: 'Ações',
        icon: <MessageSquare size={16} />,
        nodes: [
            { type: 'send_message', label: 'Enviar Mensagem', icon: <MessageSquare size={16} />, color: 'bg-blue-600' },
            { type: 'send_media', label: 'Enviar Mídia', icon: <MessageSquare size={16} />, color: 'bg-blue-600' }
        ]
    },
    {
        name: 'Lógica',
        icon: <GitBranch size={16} />,
        nodes: [
            { type: 'condition', label: 'Condição (Se/Senão)', icon: <GitBranch size={16} />, color: 'bg-yellow-600' },
            { type: 'control_delay', label: 'Delay (Esperar)', icon: <Clock size={16} />, color: 'bg-orange-600' }
        ]
    },
    {
        name: 'IA & CRM',
        icon: <Bot size={16} />,
        nodes: [
            { type: 'ai_generate', label: 'Gerar com IA', icon: <Bot size={16} />, color: 'bg-purple-600' },
            { type: 'crm_update', label: 'Atualizar CRM', icon: <Search size={16} />, color: 'bg-indigo-600' }
        ]
    }
];

// --- CUSTOM NODE STYLES ---
const nodeStyle = (color: string) => ({
    background: '#18181b',
    color: 'white',
    border: '1px solid #3f3f46',
    borderRadius: '12px',
    padding: '0',
    minWidth: '200px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
});

export function WorkflowEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // ReactFlow
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // Workflow Meta
    const [workflow, setWorkflow] = useState<any>(null);
    const [workflowName, setWorkflowName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (id) loadWorkflow(id);
    }, [id]);

    const loadWorkflow = async (workflowId: string) => {
        setLoading(true);
        const { data, error } = await supabase.from('workflows').select('*').eq('id', workflowId).single();
        if (error || !data) {
            toast.error("Fluxo não encontrado");
            navigate('/flow');
            return;
        }
        setWorkflow(data);
        setWorkflowName(data.name);

        if (data.nodes && Array.isArray(data.nodes)) setNodes(restoreNodes(data.nodes)); // Restore functionality if needed
        else setNodes([]);

        if (data.edges && Array.isArray(data.edges)) setEdges(data.edges);
        else setEdges([]);

        setLoading(false);
    };

    const restoreNodes = (savedNodes: any[]) => {
        // Map stored JSON to ReactFlow nodes with Styles
        return savedNodes.map(n => {
            const category = NODE_CATEGORIES.flatMap(c => c.nodes).find(x => x.type === n.type);
            return {
                ...n,
                style: nodeStyle('') // We define styles in properties or nodeTypes components ideally
            };
        });
    };

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);

        const payload = {
            name: workflowName,
            nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })), // Strip internal RF props
            edges,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('workflows').update(payload).eq('id', id);

        if (error) toast.error("Erro ao salvar: " + error.message);
        else toast.success("Fluxo salvo com sucesso!");

        setSaving(false);
    };

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    }, [setEdges]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) return;

            // Project coordinates
            // @ts-ignore
            const position = { x: event.clientX - 300, y: event.clientY - 100 }; // Rough approximation, normally use reactFlowInstance.project

            const newNode = {
                id: crypto.randomUUID(),
                type,
                position,
                data: { label: 'Novo Nó' },
                style: nodeStyle('')
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes]
    );

    const onNodeClick = (_: any, node: any) => setSelectedNode(node);

    // Dynamic Property Updater
    const updateNodeData = (key: string, value: any) => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => {
            if (n.id === selectedNode.id) {
                const updated = { ...n, data: { ...n.data, [key]: value } };
                if (key === 'label') { /* visual update logic if needed */ }
                return updated;
            }
            return n;
        }));
        setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, [key]: value } }));
    };

    const deleteNode = () => {
        if (!selectedNode) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setEdges((eds) => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
    };

    if (loading) return <div className="h-screen bg-black flex items-center justify-center"><div className="animate-spin text-primary"><Play size={32} /></div></div>;

    return (
        <div className="h-screen w-screen bg-[#09090b] flex flex-col overflow-hidden text-white font-sans">
            {/* Header */}
            <header className="h-16 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center justify-between z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/flows')} className="text-zinc-400 hover:text-white">
                        <ArrowLeft size={18} />
                    </Button>
                    <div>
                        <Input
                            value={workflowName}
                            onChange={e => setWorkflowName(e.target.value)}
                            className="bg-transparent border-none text-lg font-bold p-0 h-auto focus-visible:ring-0 text-white w-[300px]"
                        />
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <GitBranch size={10} /> Workflow Builder 2.0
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800">
                        <Play size={16} className="mr-2" /> Testar
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-primary text-black hover:bg-primary/90 font-bold from-primary-600">
                        {saving ? <div className="animate-spin mr-2"><Play size={16} /></div> : <Save size={16} className="mr-2" />}
                        Salvar
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex relative">
                {/* Left Sidebar - Palette */}
                <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-10">
                    <div className="p-4 border-b border-zinc-800 font-bold text-sm text-zinc-400">Biblioteca de Nós</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {NODE_CATEGORIES.map((cat, idx) => (
                            <div key={idx}>
                                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                                    {cat.icon} {cat.name}
                                </div>
                                <div className="space-y-2">
                                    {cat.nodes.map(node => (
                                        <div
                                            key={node.type}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/reactflow', node.type);
                                                e.dataTransfer.effectAllowed = 'move';
                                            }}
                                            className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg cursor-grab hover:border-primary/50 hover:bg-zinc-900 transition-all group"
                                        >
                                            <div className={`p-1.5 rounded-md ${node.color} text-white shadow-lg`}>
                                                {node.icon}
                                            </div>
                                            <span className="text-sm font-medium text-zinc-300 group-hover:text-white">{node.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* Main Canvas */}
                <main className="flex-1 relative bg-zinc-950" onDrop={onDrop} onDragOver={onDragOver}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        colorMode="dark"
                        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                        fitView
                    >
                        <Background color="#27272a" variant={BackgroundVariant.Dots} gap={20} size={1} />
                        <Controls className="bg-zinc-800 border-zinc-700 fill-white" />
                        <MiniMap className="bg-zinc-900 border-zinc-800" maskColor="#09090b" nodeColor="#52525b" />
                    </ReactFlow>
                </main>

                {/* Right Sidebar - Properties */}
                {selectedNode && (
                    <aside className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-200">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                            <span className="font-bold text-zinc-100">Propriedades</span>
                            <Button variant="ghost" size="icon" onClick={deleteNode} className="h-8 w-8 text-zinc-500 hover:text-red-500">
                                <Trash2 size={16} />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-2">
                                <Label>Nome do Nó</Label>
                                <Input
                                    value={(selectedNode.data as any).label || ''}
                                    onChange={e => updateNodeData('label', e.target.value)}
                                    className="bg-zinc-950 border-zinc-800"
                                />
                            </div>

                            <div className="h-px bg-zinc-800" />

                            {/* DYNAMIC FORM BASED ON TYPE */}
                            {selectedNode.type === 'send_message' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Mensagem</Label>
                                        <Textarea
                                            value={(selectedNode.data as any).message || ''}
                                            onChange={e => updateNodeData('message', e.target.value)}
                                            className="bg-zinc-950 border-zinc-800 min-h-[150px] font-mono text-xs"
                                            placeholder="Digite sua mensagem. Use {{nome}} para variáveis."
                                        />
                                        <p className="text-[10px] text-zinc-500">Suporta Markdown e Variáveis.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" className="rounded bg-zinc-800 border-zinc-700"
                                            checked={!!(selectedNode.data as any).typing}
                                            onChange={e => updateNodeData('typing', e.target.checked)}
                                        />
                                        <Label>Simular Digitação</Label>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'condition' && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-200">
                                        Adicione lógica de ramificação aqui. Conecte as saídas "True" e "False".
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Variável para testar</Label>
                                        <Input
                                            value={(selectedNode.data as any).variable || ''}
                                            onChange={e => updateNodeData('variable', e.target.value)}
                                            className="bg-zinc-950 border-zinc-800"
                                            placeholder="ex: message.content"
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'ai_generate' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Prompt do Sistema</Label>
                                        <Textarea
                                            value={(selectedNode.data as any).prompt || ''}
                                            onChange={e => updateNodeData('prompt', e.target.value)}
                                            className="bg-zinc-950 border-zinc-800 min-h-[100px]"
                                            placeholder="Instruções para a IA..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Modelo</Label>
                                        <Select value={(selectedNode.data as any).model || 'gpt-4o-mini'} onValueChange={(v: string) => updateNodeData('model', v)}>
                                            <SelectTrigger className="bg-zinc-950 border-zinc-800"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido)</SelectItem>
                                                <SelectItem value="gpt-4o">GPT-4o (Inteligente)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 mt-4 border-t border-zinc-800">
                                <div className="text-[10px] text-zinc-600 font-mono">ID: {selectedNode.id}</div>
                                <div className="text-[10px] text-zinc-600 font-mono">Type: {selectedNode.type}</div>
                            </div>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}
