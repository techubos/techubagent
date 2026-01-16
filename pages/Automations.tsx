import React, { useState, useEffect } from 'react';
import {
    Clock,
    MessageCircle,
    CheckCircle2,
    AlertOctagon,
    CalendarCheck,
    Zap,
    PauseCircle,
    PlayCircle,
    ShieldCheck,
    Loader2,
    RefreshCcw,
    Plus,
    Trash2,
    Save,
    X,
    ArrowRight,
    MoreHorizontal
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { AutomationWorkflow, AutomationStep } from '../types';

export const Automations: React.FC = () => {
    const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Builder State
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [editingWorkflow, setEditingWorkflow] = useState<Partial<AutomationWorkflow>>({
        title: '',
        description: '',
        trigger_type: 'no_reply',
        trigger_condition: '24h',
        active: false,
        steps: []
    });

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('workflows')
                .select('*')
                .order('title', { ascending: true });

            if (error) throw error;
            setWorkflows(data || []);
        } catch (error) {
            console.error("Error fetching workflows:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleWorkflow = async (id: string, currentStatus: boolean) => {
        setUpdatingId(id);
        try {
            const { error } = await supabase
                .from('workflows')
                .update({ active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            // Optimistic Update
            setWorkflows(prev => prev.map(w =>
                w.id === id ? { ...w, active: !currentStatus } : w
            ));
        } catch (error) {
            console.error("Error toggling workflow:", error);
            alert("Erro ao atualizar status.");
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDeleteWorkflow = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta automação?")) return;
        try {
            const { error } = await supabase.from('workflows').delete().eq('id', id);
            if (error) throw error;
            setWorkflows(prev => prev.filter(w => w.id !== id));
        } catch (error) {
            console.error("Error deleting workflow:", error);
            alert("Erro ao excluir.");
        }
    };

    const handleSaveWorkflow = async () => {
        if (!editingWorkflow.title || !editingWorkflow.trigger_type) return alert("Preencha título e gatilho.");

        setLoading(true);
        try {
            if (editingWorkflow.id) {
                // Update
                const { error } = await supabase
                    .from('workflows')
                    .update({
                        title: editingWorkflow.title,
                        description: editingWorkflow.description,
                        trigger_type: editingWorkflow.trigger_type,
                        trigger_condition: editingWorkflow.trigger_condition,
                        steps: editingWorkflow.steps
                    })
                    .eq('id', editingWorkflow.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase.from('workflows').insert([{
                    title: editingWorkflow.title,
                    description: editingWorkflow.description,
                    trigger_type: editingWorkflow.trigger_type,
                    trigger_condition: editingWorkflow.trigger_condition,
                    steps: editingWorkflow.steps,
                    active: true
                }]);
                if (error) throw error;
            }

            setIsBuilderOpen(false);
            setEditingWorkflow({ title: '', description: '', trigger_type: 'no_reply', trigger_condition: '24h', active: false, steps: [] });
            fetchWorkflows();
        } catch (error: any) {
            console.error("Error saving workflow:", error);
            alert("Erro ao salvar: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const addStep = (type: 'message' | 'wait' | 'check_condition') => {
        const newStep: AutomationStep = {
            order: (editingWorkflow.steps?.length || 0) + 1,
            type,
            content: type === 'message' ? 'Olá, tudo bem?' : undefined,
            delay: type === 'wait' ? 1 : undefined
        };
        setEditingWorkflow(prev => ({ ...prev, steps: [...(prev.steps || []), newStep] }));
    };

    const updateStep = (index: number, field: keyof AutomationStep, value: any) => {
        const newSteps = [...(editingWorkflow.steps || [])];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setEditingWorkflow(prev => ({ ...prev, steps: newSteps }));
    };

    const removeStep = (index: number) => {
        const newSteps = [...(editingWorkflow.steps || [])];
        newSteps.splice(index, 1);
        // Reorder
        newSteps.forEach((s, i) => s.order = i + 1);
        setEditingWorkflow(prev => ({ ...prev, steps: newSteps }));
    };

    const openBuilder = (workflow?: AutomationWorkflow) => {
        if (workflow) {
            setEditingWorkflow(workflow);
        } else {
            setEditingWorkflow({ title: '', description: '', trigger_type: 'no_reply', trigger_condition: '24h', active: false, steps: [] });
        }
        setIsBuilderOpen(true);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Automações Inteligentes</h1>
                    <p className="text-gray-600">Crie fluxos de conversa e tarefas automáticas.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchWorkflows}
                        className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Recarregar"
                    >
                        <RefreshCcw size={20} />
                    </button>
                    <button
                        onClick={() => openBuilder()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <Plus size={18} />
                        <span>Nova Automação</span>
                    </button>
                </div>
            </div>

            {/* Workflow Grid */}
            {loading && !isBuilderOpen ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                </div>
            ) : workflows.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">Nenhuma automação encontrada.</p>
                    <button onClick={() => openBuilder()} className="text-blue-600 font-bold hover:underline mt-2">Criar minha primeira automação</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {workflows.map((workflow) => (
                        <div key={workflow.id} className={`bg-white rounded-xl border transition-all ${workflow.active ? 'border-blue-200 shadow-sm' : 'border-gray-200 opacity-75'}`}>
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-lg ${workflow.active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {workflow.trigger_type === 'schedule_approaching' ? <CalendarCheck size={24} /> :
                                                workflow.trigger_type === 'no_reply' ? <Clock size={24} /> : <CheckCircle2 size={24} />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{workflow.title}</h3>
                                            <p className="text-sm text-gray-500">{workflow.description || 'Sem descrição'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => toggleWorkflow(workflow.id, workflow.active)}
                                            disabled={updatingId === workflow.id}
                                            className={`p-2 rounded-full transition-colors ${workflow.active ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                            title={workflow.active ? "Pausar" : "Ativar"}
                                        >
                                            {updatingId === workflow.id ? <Loader2 className="animate-spin" size={20} /> :
                                                workflow.active ? <PauseCircle size={24} /> : <PlayCircle size={24} />}
                                        </button>
                                        <button onClick={() => openBuilder(workflow)} className="text-gray-400 hover:text-blue-600"><MoreHorizontal /></button>
                                        <button onClick={() => handleDeleteWorkflow(workflow.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
                                    </div>
                                </div>

                                {/* Mini Visualization */}
                                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                                    <Zap size={12} className="text-yellow-600" />
                                    <span className="font-mono">{workflow.trigger_type}</span>
                                    <ArrowRight size={12} />
                                    <span>{workflow.steps?.length || 0} passos</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Builder Modal */}
            {isBuilderOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">

                        {/* Modal Header */}
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <input
                                    value={editingWorkflow.title}
                                    onChange={e => setEditingWorkflow({ ...editingWorkflow, title: e.target.value })}
                                    placeholder="Título da Automação"
                                    className="bg-transparent text-xl font-bold text-gray-900 outline-none placeholder:text-gray-400 w-full"
                                />
                                <input
                                    value={editingWorkflow.description}
                                    onChange={e => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                                    placeholder="Descrição breve..."
                                    className="bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400 w-full"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsBuilderOpen(false)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
                            </div>
                        </div>

                        {/* Builder Content */}
                        <div className="flex-1 overflow-hidden flex">
                            {/* Sidebar (Trigger Config) */}
                            <div className="w-1/3 border-r bg-gray-50 p-6 overflow-y-auto">
                                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Zap size={18} /> Gatilho Inicial</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">TIPO DO GATILHO</label>
                                        <select
                                            value={editingWorkflow.trigger_type}
                                            onChange={e => setEditingWorkflow({ ...editingWorkflow, trigger_type: e.target.value as any })}
                                            className="w-full p-2 rounded border border-gray-300 bg-white"
                                        >
                                            <option value="no_reply">Ausência de Resposta (No Reply)</option>
                                            <option value="status_change">Mudança de Status (CRM)</option>
                                            <option value="schedule_approaching">Agendamento Próximo</option>
                                        </select>
                                    </div>

                                    {editingWorkflow.trigger_type === 'no_reply' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">TEMPO DE ESPERA (HORAS)</label>
                                            <input
                                                type="number"
                                                value={editingWorkflow.trigger_condition?.replace(/\D/g, '')}
                                                onChange={e => setEditingWorkflow({ ...editingWorkflow, trigger_condition: `${e.target.value}h` })}
                                                className="w-full p-2 rounded border border-gray-300"
                                            />
                                        </div>
                                    )}

                                    {editingWorkflow.trigger_type === 'status_change' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">STATUS ALVO</label>
                                            <select
                                                value={editingWorkflow.trigger_condition}
                                                onChange={e => setEditingWorkflow({ ...editingWorkflow, trigger_condition: e.target.value })}
                                                className="w-full p-2 rounded border border-gray-300 bg-white"
                                            >
                                                <option value="lead">Lead</option>
                                                <option value="talking">Talking</option>
                                                <option value="closed">Closed</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 border-t pt-4">
                                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Plus size={18} /> Adicionar Ação</h3>
                                    <div className="space-y-2">
                                        <button onClick={() => addStep('message')} className="w-full text-left p-3 bg-white border hover:border-blue-500 rounded flex items-center gap-2 transition-colors">
                                            <MessageCircle size={16} className="text-blue-500" /> Enviar Mensagem
                                        </button>
                                        <button onClick={() => addStep('wait')} className="w-full text-left p-3 bg-white border hover:border-purple-500 rounded flex items-center gap-2 transition-colors">
                                            <Clock size={16} className="text-purple-500" /> Esperar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Main Flow (Steps) */}
                            <div className="flex-1 bg-gray-100 p-8 overflow-y-auto">
                                {editingWorkflow.steps?.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-xl">
                                        <Zap size={40} className="mb-2 opacity-50" />
                                        <p>O fluxo está vazio.</p>
                                        <p className="text-sm">Adicione ações na barra lateral.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6 max-w-xl mx-auto pb-20">
                                        {editingWorkflow.steps?.map((step, idx) => (
                                            <div key={idx} className="relative group">
                                                {/* Connecting Line */}
                                                {idx > 0 && <div className="absolute -top-6 left-1/2 w-0.5 h-6 bg-gray-300 -translate-x-1/2"></div>}

                                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 group-hover:border-blue-300 transition-all relative">

                                                    {/* Remove Button */}
                                                    <button onClick={() => removeStep(idx)} className="absolute -right-2 -top-2 bg-red-100 text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X size={14} /></button>

                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className={`p-2 rounded-lg ${step.type === 'message' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                            {step.type === 'message' ? <MessageCircle size={18} /> : <Clock size={18} />}
                                                        </div>
                                                        <h4 className="font-bold text-gray-700 capitalize">{step.type === 'message' ? 'Enviar Mensagem' : 'Esperar'}</h4>
                                                    </div>

                                                    {step.type === 'message' && (
                                                        <textarea
                                                            value={step.content}
                                                            onChange={e => updateStep(idx, 'content', e.target.value)}
                                                            className="w-full text-sm p-3 bg-gray-50 border rounded-lg focus:outline-none focus:border-blue-400 resize-none h-24"
                                                            placeholder="Digite a mensagem..."
                                                        />
                                                    )}

                                                    {step.type === 'wait' && (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={step.delay}
                                                                onChange={e => updateStep(idx, 'delay', parseInt(e.target.value))}
                                                                className="w-20 p-2 border rounded text-center font-bold"
                                                            />
                                                            <span className="text-gray-500">horas</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t bg-white flex justify-end gap-2">
                            <button onClick={() => setIsBuilderOpen(false)} className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancelar</button>
                            <button
                                onClick={handleSaveWorkflow}
                                disabled={loading}
                                className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Salvar Automação
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};