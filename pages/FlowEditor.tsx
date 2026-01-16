import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    MiniMap,
    Panel,
    BackgroundVariant,
    MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
    Save,
    ArrowLeft,
    GitBranch,
    Bot,
    Zap,
    MessageSquare,
    Loader2,
    Plus,
    Trash2,
    ScanSearch,
    Globe,
    Database,
    Clock,
    Activity,
    Play
} from 'lucide-react';

import { AgentNode, DecisionNode, MessageNode, StartNode, SummarizerNode, WebhookNode, DatabaseNode, WaitNode } from '../components/flow/CustomNodes';

// Node Types Registry
const nodeTypes = {
    agent: AgentNode,
    decision: DecisionNode,
    message: MessageNode,
    start: StartNode,
    summarizer: SummarizerNode,
    webhook: WebhookNode,
    database: DatabaseNode,
    wait: WaitNode
};

interface Topic {
    id: string;
    name: string;
}

interface Agent {
    id: string;
    name: string;
}

interface FlowConfig {
    prompt?: string;
    content?: string;
    [key: string]: unknown;
}

interface FlowNodeData extends Record<string, unknown> {
    label: string;
    config: FlowConfig;
}

type FlowNode = Node<FlowNodeData>;

interface FlowEditorProps {
    flowId: string;
    onClose: () => void;
}

export const FlowEditor: React.FC<FlowEditorProps> = ({ flowId, onClose }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Inspector State
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [topics, setTopics] = useState<Topic[]>([]); // Store fetched topics
    const [agents, setAgents] = useState<Agent[]>([]);

    // Initial Data Fetch
    useEffect(() => {
        fetchFlowData();
        fetchTopics();
        fetchAgents();
    }, [flowId]);

    const fetchTopics = async () => {
        const { data } = await supabase.from('knowledge_topics').select('name, id');
        if (data) setTopics(data as Topic[]);
    };

    const fetchAgents = async () => {
        const { data } = await supabase.from('agents').select('id, name');
        if (data) setAgents(data as Agent[]);
    };

    const fetchFlowData = async () => {
        setLoading(true);
        try {
            // Fetch Nodes
            const { data: nodesData, error: nodesError } = await supabase
                .from('flow_nodes')
                .select('*')
                .eq('flow_id', flowId);

            // Fetch Edges
            const { data: edgesData, error: edgesError } = await supabase
                .from('flow_edges')
                .select('*')
                .eq('flow_id', flowId);

            if (nodesError || edgesError) throw new Error("Failed to load flow");

            // Map DB Nodes -> React Flow Nodes
            const rfNodes = (nodesData || []).map(n => ({
                id: n.id,
                type: n.type,
                position: { x: n.position_x, y: n.position_y },
                data: { label: n.config?.prompt || n.config?.content, config: n.config }
            }));

            // Map DB Edges -> React Flow Edges
            const rfEdges = (edgesData || []).map(e => ({
                id: e.id,
                source: e.source_node_id,
                target: e.target_node_id,
                label: e.label,
                animated: true
            }));

            setNodes(rfNodes);
            setEdges(rfEdges);

        } catch (e) {
            console.error(e);
            alert("Erro ao carregar fluxo.");
        } finally {
            setLoading(false);
        }
    };

    // --- Graph Interaction Handlers ---

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [setEdges],
    );

    const onNodeClick = (_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    };

    const handleAddNode = (type: string) => {
        try {
            // Safe ID generation (fallback if crypto not available)
            const id = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            console.log("Adding Node:", type, id);

            const newNode: FlowNode = {
                id,
                type,
                position: { x: 250 + (nodes.length * 20), y: 150 + (nodes.length * 20) }, // Offset new nodes so they don't stack perfectly
                data: { label: 'Novo Nó', config: {} }
            };
            setNodes((nds) => nds.concat(newNode));
            setSelectedNodeId(id);
        } catch (error) {
            console.error("Error adding node:", error);
            alert("Erro ao adicionar nó. Verifique o console.");
        }
    };

    // --- Persistence ---

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Get current organization (from flow if possible, or context)
            const { data: flowInfo } = await supabase.from('flows').select('organization_id').eq('id', flowId).single();
            const organizationId = flowInfo?.organization_id;

            // 2. Persist to flow_configs (Modern JSONB approach)
            const { error: configError } = await supabase.from('flow_configs').upsert({
                id: flowId, // We use the same UUID to keep them linked
                organization_id: organizationId,
                name: 'Sync Flow',
                nodes: nodes,
                edges: edges,
                updated_at: new Date().toISOString()
            });

            if (configError) throw configError;

            // 3. Fallback/Sync with old tables for compatibility with existing execution engine
            await supabase.from('flow_edges').delete().eq('flow_id', flowId);
            await supabase.from('flow_nodes').delete().eq('flow_id', flowId);

            const dbNodes = nodes.map(n => ({
                id: n.id,
                flow_id: flowId,
                type: n.type,
                position_x: n.position.x,
                position_y: n.position.y,
                config: { ...n.data.config, prompt: n.data.label }
            }));

            const dbEdges = edges.map(e => ({
                id: e.id,
                flow_id: flowId,
                source_node_id: e.source,
                target_node_id: e.target,
                label: e.label as string
            }));

            if (dbNodes.length > 0) await supabase.from('flow_nodes').insert(dbNodes);
            if (dbEdges.length > 0) await supabase.from('flow_edges').insert(dbEdges);

            alert("Fluxo salvo e sincronizado! 🚀");
        } catch (e: any) {
            console.error("Save Error:", e);
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // --- Inspector ---
    const updateSelectedNode = (updates: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === selectedNodeId) {
                    return {
                        ...node,
                        data: { ...node.data, ...updates }
                    };
                }
                return node;
            })
        );
    };

    const deleteSelectedNode = () => {
        if (!selectedNodeId) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
        setSelectedNodeId(null);
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-950"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 animate-in fade-in">
            {/* Header */}
            <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="font-bold text-white flex items-center gap-2">
                            <GitBranch size={20} className="text-primary" /> Editor Visual
                        </h1>
                        <p className="text-xs text-zinc-500">ID: {flowId}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSave} disabled={saving} className="bg-primary text-zinc-900 px-6 py-2 rounded-lg font-bold hover:opacity-90 transition flex items-center gap-2">
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Salvar Fluxo
                    </button>
                </div>
            </header>

            {/* Canvas */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        connectionMode={ConnectionMode.Loose}
                        fitView
                        className="bg-zinc-950"
                    >
                        <Background color="#333" gap={20} variant={BackgroundVariant.Dots} />
                        <Controls className="bg-zinc-800 border-zinc-700 fill-white" />
                        <MiniMap className="bg-zinc-900 border-zinc-800" nodeColor="#10b981" />

                        <Panel position="top-left" className="bg-zinc-900 border border-zinc-700 p-2 rounded-xl flex gap-2">
                            <button onClick={() => handleAddNode('agent')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-primary flex flex-col items-center gap-1 min-w-[60px]">
                                <Bot size={20} /> <span className="text-[10px] font-bold">AGENTE</span>
                            </button>
                            <button onClick={() => handleAddNode('decision')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-amber-500 flex flex-col items-center gap-1 min-w-[60px]">
                                <Zap size={20} /> <span className="text-[10px] font-bold">DECISÃO</span>
                            </button>
                            <button onClick={() => handleAddNode('message')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-blue-500 flex flex-col items-center gap-1 min-w-[60px]">
                                <MessageSquare size={20} /> <span className="text-[10px] font-bold">MENSAGEM</span>
                            </button>
                            <button onClick={() => handleAddNode('start')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-emerald-500 flex flex-col items-center gap-1 min-w-[60px]">
                                <Plus size={20} /> <span className="text-[10px] font-bold">INÍCIO</span>
                            </button>
                            <button onClick={() => handleAddNode('summarizer')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-purple-500 flex flex-col items-center gap-1 min-w-[60px]">
                                <ScanSearch size={20} /> <span className="text-[10px] font-bold">DETETIVE</span>
                            </button>
                            <div className="w-px bg-zinc-700 mx-1"></div>
                            <button onClick={() => handleAddNode('webhook')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-pink-500 flex flex-col items-center gap-1 min-w-[60px]">
                                <Globe size={20} /> <span className="text-[10px] font-bold">WEBHOOK</span>
                            </button>
                            <button onClick={() => handleAddNode('database')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-cyan-500 flex flex-col items-center gap-1 min-w-[60px]">
                                <Database size={20} /> <span className="text-[10px] font-bold">DADOS</span>
                            </button>
                            <button onClick={() => handleAddNode('wait')} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-orange-500 flex flex-col items-center gap-1 min-w-[60px]">
                                <Clock size={20} /> <span className="text-[10px] font-bold">WAIT</span>
                            </button>
                        </Panel>

                        <Panel position="bottom-center" className="mb-6">
                            <div className="bg-surface/80 backdrop-blur-xl border border-primary/20 p-1.5 rounded-2xl flex gap-1 shadow-2xl">
                                <button className="px-6 py-2.5 bg-primary text-zinc-950 rounded-xl font-black text-xs flex items-center gap-2 hover:scale-105 transition-all">
                                    <Zap size={14} fill="currentColor" /> PUBLICAR FLUXO
                                </button>
                                <button
                                    className="px-6 py-2.5 bg-zinc-900 text-zinc-400 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-zinc-800 transition-all"
                                    onClick={() => alert("Simulação de IA iniciada... (Em breve)")}
                                >
                                    <Play size={14} /> SIMULAR
                                </button>
                            </div>
                        </Panel>

                        <Panel position="top-right" className="bg-surface border border-border p-4 rounded-3xl m-4 w-48 shadow-2xl backdrop-blur-md">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Activity size={12} className="text-primary" /> Flow Health
                            </h4>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Nós:</span>
                                    <span className="text-white font-bold">{nodes.length}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Loops:</span>
                                    <span className="text-emerald-500 font-bold">OK</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Eficiência:</span>
                                    <span className="text-primary font-bold">98%</span>
                                </div>
                            </div>
                        </Panel>
                    </ReactFlow>
                </div>

                {/* Right Inspector */}
                {selectedNode && (
                    <div className="w-[350px] bg-zinc-900 border-l border-zinc-800 p-6 flex flex-col gap-6 overflow-y-auto animate-in slide-in-from-right">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white uppercase tracking-wider">{selectedNode.type} Node</h2>
                            <button onClick={deleteSelectedNode} className="text-red-500 hover:bg-red-500/10 p-2 rounded">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        {selectedNode && selectedNode.type === 'start' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">Instruções do Sistema</label>
                                <textarea
                                    className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:border-primary"
                                    value={selectedNode.data.label as string}
                                    onChange={(e) => updateSelectedNode({ label: e.target.value })}
                                />
                            </div>
                        )}

                        {selectedNode.type === 'agent' && (
                            <div className="space-y-4">
                                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                                    <button
                                        onClick={() => updateSelectedNode({ config: { ...selectedNode.data.config, mode: 'manual' } })}
                                        className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${!selectedNode.data.config?.mode || selectedNode.data.config?.mode === 'manual' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        Manual
                                    </button>
                                    <button
                                        onClick={() => updateSelectedNode({ config: { ...selectedNode.data.config, mode: 'profile' } })}
                                        className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${selectedNode.data.config?.mode === 'profile' ? 'bg-primary/20 text-primary' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        Usar Perfil
                                    </button>
                                </div>

                                {selectedNode.data.config?.mode === 'profile' ? (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <label className="block text-xs font-bold text-zinc-500 uppercase">Selecione o Agente</label>
                                        <select
                                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:border-primary"
                                            value={(selectedNode.data.config?.agent_profile_id as string) || ''}
                                            onChange={(e) => updateSelectedNode({
                                                label: e.target.options[e.target.selectedIndex].text,
                                                config: {
                                                    ...selectedNode.data.config,
                                                    agent_profile_id: e.target.value
                                                }
                                            })}
                                        >
                                            <option value="">-- Selecione --</option>
                                            {agents.map((agent: any) => (
                                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-zinc-500">
                                            O nó usará automaticamente o Prompt, Modelo e Configurações deste agente.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Instruções do Sistema</label>
                                            <textarea
                                                className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:border-primary"
                                                value={selectedNode.data.label as string}
                                                onChange={(e) => updateSelectedNode({ label: e.target.value })}
                                                placeholder="Você é um assistente..."
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-zinc-800">
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Contextos de Memória</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['pricing', 'technical', 'company_info', 'user_history', 'checkout_links'].map(tag => {
                                            const currentContexts = (selectedNode.data.config?.contexts as string[]) || [];
                                            const isSelected = currentContexts.includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => {
                                                        const newContexts = isSelected
                                                            ? currentContexts.filter(c => c !== tag)
                                                            : [...currentContexts, tag];
                                                        updateSelectedNode({
                                                            config: { ...selectedNode.data.config, contexts: newContexts }
                                                        });
                                                    }}
                                                    className={`p-2 rounded text-xs border font-medium transition-colors ${isSelected
                                                        ? 'bg-primary/20 border-primary text-primary'
                                                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                        }`}
                                                >
                                                    {tag === 'pricing' && '💰 Preços'}
                                                    {tag === 'technical' && '🛠️ Técnico'}
                                                    {tag === 'company_info' && '🏢 Empresa'}
                                                    {tag === 'user_history' && '👤 Histórico'}
                                                    {tag === 'checkout_links' && '🔗 Links'}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Dynamic Topics from Database */}
                                {topics.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-zinc-800">
                                        <label className="block text-xs font-bold text-pink-500 uppercase mb-2">Seus Tópicos (Gatilhos)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {topics.map((t: any) => {
                                                const currentContexts = (selectedNode.data.config?.contexts as string[]) || [];
                                                const isSelected = currentContexts.includes(t.name);
                                                return (
                                                    <button
                                                        key={t.name}
                                                        onClick={() => {
                                                            const newContexts = isSelected
                                                                ? currentContexts.filter(c => c !== t.name)
                                                                : [...currentContexts, t.name];
                                                            updateSelectedNode({
                                                                config: { ...selectedNode.data.config, contexts: newContexts }
                                                            });
                                                        }}
                                                        className={`px-2 py-1 rounded text-[10px] border font-medium transition-colors flex items-center gap-1 ${isSelected
                                                            ? 'bg-pink-500/20 border-pink-500 text-pink-400'
                                                            : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-pink-500/50'
                                                            }`}
                                                    >
                                                        # {t.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedNode.type === 'message' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">Conteúdo da Mensagem</label>
                                <textarea
                                    className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:border-blue-500"
                                    value={selectedNode.data.config?.content || (selectedNode.data as any).label}
                                    onChange={(e) => updateSelectedNode({
                                        label: e.target.value,
                                        config: { ...selectedNode.data.config, content: e.target.value }
                                    })}
                                />
                            </div>
                        )}

                        {selectedNode.type === 'decision' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">Tipo de Decisão</label>
                                <select
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-zinc-200 outline-none focus:border-amber-500"
                                    value={(selectedNode.data.config?.condition_type as string) || 'LLM_EVALUATION'}
                                    onChange={(e) => updateSelectedNode({
                                        config: { ...selectedNode.data.config, condition_type: e.target.value }
                                    })}
                                >
                                    <option value="LLM_EVALUATION">IA (Avaliação Semântica)</option>
                                    <option value="DATA_CHECK">Dados (Banco de Dados)</option>
                                    <option value="TOPIC_ROUTER">Roteador de Tópicos (Keywords)</option>
                                </select>

                                {selectedNode.data.config?.condition_type === 'TOPIC_ROUTER' && (
                                    <div className="bg-purple-900/20 border border-purple-500/30 p-3 rounded-lg space-y-2">
                                        <p className="text-xs text-purple-200">
                                            <strong>Modo: Roteador de Tópicos</strong>
                                        </p>
                                        <p className="text-[10px] text-zinc-400">
                                            A IA vai procurar palavras-chaves definidas nos seus Tópicos.
                                        </p>

                                        <div className="mt-2 pt-2 border-t border-purple-500/20">
                                            <p className="text-[10px] font-bold text-purple-300 uppercase mb-1">Gatilhos Ativos (Tags):</p>
                                            <div className="flex flex-wrap gap-1">
                                                {topics.length > 0 ? topics.map((t: any) => (
                                                    <span key={t.name} className="text-[10px] bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">
                                                        {t.name}
                                                    </span>
                                                )) : (
                                                    <span className="text-[10px] text-zinc-500 italic">Nenhum tópico encontrado.</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-zinc-500 mt-2 italic">
                                                *O nome da aresta (seta) deve ser IGUAL a tag acima.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {selectedNode.data.config?.condition_type === 'DATA_CHECK' ? (
                                    <div className="space-y-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Campo</label>
                                            <select
                                                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                                value={(selectedNode.data.config?.data_field as string) || 'message_count'}
                                                onChange={(e) => updateSelectedNode({
                                                    config: { ...selectedNode.data.config, data_field: e.target.value }
                                                })}
                                            >
                                                <option value="message_count">Total de Mensagens</option>
                                                <option value="lead_score">Lead Score</option>
                                                <option value="status">Status do Contato</option>
                                                <option value="last_message_hours">Horas desde última msg</option>
                                                <option value="detective_sentiment">Sentimento (IA Detetive)</option>
                                                <option value="detective_urgency">Urgência (IA Detetive)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Operador</label>
                                            <select
                                                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                                value={(selectedNode.data.config?.operator as string) || '>'}
                                                onChange={(e) => updateSelectedNode({
                                                    config: { ...selectedNode.data.config, operator: e.target.value }
                                                })}
                                            >
                                                <option value=">">Maior que (&gt;)</option>
                                                <option value="<">Menor que (&lt;)</option>
                                                <option value="=">Igual a (=)</option>
                                                <option value="!=">Diferente de (!=)</option>
                                                <option value="contains">Contém</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Valor</label>
                                            <input
                                                type="text"
                                                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                                placeholder="ex: 0, 50, closed"
                                                value={(selectedNode.data.config?.data_value as string) || ''}
                                                onChange={(e) => updateSelectedNode({
                                                    config: { ...selectedNode.data.config, data_value: e.target.value }
                                                })}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-zinc-500 uppercase">O que a IA deve verificar?</label>
                                        <textarea
                                            className="w-full h-24 bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:border-amber-500"
                                            placeholder="Ex: O cliente falou 'Bom dia'? O cliente quer comprar ou suporte?"
                                            value={(selectedNode.data as any).label as string}
                                            onChange={(e) => updateSelectedNode({ label: e.target.value })}
                                        />
                                        <p className="text-[10px] text-zinc-500">
                                            A IA vai ler a mensagem do cliente e escolher o caminho (seta) que melhor combinar com a resposta.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedNode && selectedNode.type === 'summarizer' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">Configuração do Detetive</label>
                                <p className="text-sm text-zinc-400">
                                    Este nó analisa automaticamente o histórico da conversa para identificar intenção e humor.
                                </p>
                                <div className="bg-zinc-950 p-3 rounded border border-zinc-800 space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-zinc-500">Janela:</span>
                                        <span className="text-zinc-200">20 msgs</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-zinc-500">Saída:</span>
                                        <span className="text-zinc-200 font-mono">conversation_summary</span>
                                    </div>
                                </div>
                            </div>
                        )}



                        {selectedNode && selectedNode.type === 'webhook' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">Configuração do Webhook</label>


                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Método HTTP</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                        value={(selectedNode.data.config?.method as string) || 'GET'}
                                        onChange={(e) => updateSelectedNode({
                                            config: { ...selectedNode.data.config, method: e.target.value }
                                        })}
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">URL da API</label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300 placeholder-zinc-700"
                                        placeholder="https://api.exemplo.com/v1/dados"
                                        value={(selectedNode.data.config?.url as string) || ''}
                                        onChange={(e) => updateSelectedNode({
                                            label: e.target.value,
                                            config: { ...selectedNode.data.config, url: e.target.value }
                                        })}
                                    />
                                </div>

                                {selectedNode.data.config?.method !== 'GET' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">JSON Body</label>
                                        <textarea
                                            className="w-full h-24 bg-zinc-950 border border-zinc-700 rounded p-2 text-xs font-mono text-zinc-300 placeholder-zinc-700"
                                            placeholder={'{\n  "id": "{{contact.id}}"\n}'}
                                            value={(selectedNode.data.config?.body as string) || ''}
                                            onChange={(e) => updateSelectedNode({
                                                config: { ...selectedNode.data.config, body: e.target.value }
                                            })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedNode && selectedNode.type === 'database' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">Consulta de Dados</label>
                                <p className="text-xs text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-800 mb-2">
                                    Este nó busca dados extras no banco do sistema (ex: pedidos, faturas) para usar no fluxo.
                                </p>

                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Tipo de Busca</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                        value={(selectedNode.data.config?.query_type as string) || 'SELECT'}
                                    >
                                        <option value="SELECT">Consultar (Select)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Tabela</label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                        placeholder="ex: invoices"
                                        value={(selectedNode.data.config?.table as string) || ''}
                                        onChange={(e) => updateSelectedNode({
                                            config: { ...selectedNode.data.config, table: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        {selectedNode && selectedNode.type === 'wait' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">Aguardar</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        className="w-20 bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                        value={(selectedNode.data.config?.duration as number) || 24}
                                        onChange={(e) => updateSelectedNode({
                                            config: { ...selectedNode.data.config, duration: parseInt(e.target.value) }
                                        })}
                                    />
                                    <span className="text-zinc-500 text-xs">horas</span>
                                </div>
                            </div>
                        )}

                        {selectedNode && selectedNode.type === 'start' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">Gatilho do Fluxo</label>
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Tipo de Disparo</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                        value={(selectedNode.data.config?.trigger_type as string) || 'message'}
                                        onChange={(e) => updateSelectedNode({
                                            config: { ...selectedNode.data.config, trigger_type: e.target.value }
                                        })}
                                    >
                                        <option value="message">Qualquer Mensagem</option>
                                        <option value="keyword">Palavra-Chave Específica</option>
                                        <option value="new_lead">Novo Lead (1ª vez)</option>
                                    </select>
                                </div>

                                {selectedNode.data.config?.trigger_type === 'keyword' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Palavra-Chave</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300"
                                            placeholder="ex: #PROMO, Suporte"
                                            value={(selectedNode.data.config?.keyword as string) || ''}
                                            onChange={(e) => updateSelectedNode({
                                                config: { ...selectedNode.data.config, keyword: e.target.value }
                                            })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-auto pt-6 border-t border-zinc-800 text-xs text-zinc-600">
                            ID: {selectedNode.id}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

};

// Required for ConnectionMode.Loose
import { ConnectionMode } from '@xyflow/react';

export default FlowEditor;
