import React, { useState, useEffect } from 'react';
import { Plus, Bot, Settings, Trash2, Save, X, BrainCircuit, MessageSquare, Mic, Image as ImageIcon, Database, HelpCircle, CheckCircle2, Sparkles, Wand2, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Agent, Connection, KnowledgeItem } from '../types';
import { supabase } from '../services/supabaseClient';
import { generateSystemPromptAI } from '../services/geminiService';
import { RepetitionAnalytics } from '../components/RepetitionAnalytics';

// AI Service initialized in geminiService via Settings

const DEFAULT_PROMPT = `Você é um assistente virtual útil e profissional.
Seu objetivo é qualificar leads e agendar reuniões.
Seja conciso.`;

export const Agents: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [documents, setDocuments] = useState<KnowledgeItem[]>([]);
    const [flows, setFlows] = useState<any[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Get default provider from settings
    const defaultModel = 'gpt-4o-mini';


    // Prompt Generator State
    const [isPromptGeneratorOpen, setIsPromptGeneratorOpen] = useState(false);
    const [promptGenStep, setPromptGenStep] = useState(1);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const [promptGenData, setPromptGenData] = useState({
        businessName: '',
        niche: '',
        goal: 'vendas', // vendas, suporte, agendamento
        tone: 'profissional', // profissional, amigavel, energetico
        keyInfo: ''
    });

    const [activeTab, setActiveTab] = useState<'instructions' | 'knowledge' | 'settings' | 'crm' | 'analytics'>('instructions'); // analytics added
    const [formData, setFormData] = useState<Partial<Agent>>({
        name: '',
        model: defaultModel,
        system_prompt: DEFAULT_PROMPT,
        temperature: 0.3,
        supports_audio: false,
        supports_image: false,
        transcribe_audio: true,
        typing_simulation: true,
        pause_on_human: true,
        group_messages: false,
        history_limit: 20,
        split_messages: true,
        message_delay: 2,
        document_ids: [],
        flow_id: undefined,

        crm_default_value: 0,
        is_active: true,
        ignore_groups: true,
        human_pause_hours: 24,
        audience_type: 'all',
        unreplied_timeout_hours: 2,
        auto_learn: false,
        anti_repetition_enabled: true // Default true
    });



    useEffect(() => {
        fetchAgents();
        fetchConnections();
        fetchDocuments();
        fetchFlows();
    }, []);

    const fetchAgents = async () => {
        setLoading(true);
        const { data } = await supabase.from('agents').select('*').order('created_at', { ascending: false });
        setAgents(data || []);
        setLoading(false);
    };

    const fetchFlows = async () => {
        const { data } = await supabase.from('flows').select('id, name');
        setFlows(data || []);
    };

    const fetchDocuments = async () => {
        const { data } = await supabase.from('documents').select('*');
        setDocuments(data || []);
    };

    const fetchConnections = async () => {
        const { data } = await supabase.from('connections').select('*');
        if (data && data.length > 0) {
            setConnections(data);
        } else {
            setConnections([]);
        }
    };

    const handleSave = async () => {
        if (!formData.name) return alert("Nome é obrigatório");
        setLoading(true);

        try {
            let error;
            if (formData.id) {
                // UPDATE
                const { error: updateError } = await supabase
                    .from('agents')
                    .update(formData)
                    .eq('id', formData.id);
                error = updateError;
            } else {
                // CREATE
                const { error: insertError } = await supabase
                    .from('agents')
                    .insert(formData);
                error = insertError;
            }

            if (error) throw error;

            await fetchAgents();
            setIsModalOpen(false);
            setFormData({
                name: '',
                model: defaultModel,
                system_prompt: DEFAULT_PROMPT,
                temperature: 0.3,
                supports_audio: false,
                supports_image: false,
                transcribe_audio: true,
                typing_simulation: true,
                pause_on_human: true,
                split_messages: true,
                message_delay: 2,
                document_ids: [],
                flow_id: undefined,
                auto_learn: false,
                human_pause_hours: 24,
                audience_type: 'all',
                unreplied_timeout_hours: 2,
                anti_repetition_enabled: true
            });

        } catch (err: any) {
            alert('Erro ao salvar agente: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (agent: Agent) => {
        setFormData(agent);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este agente?')) return;

        // Optimistic UI update
        const previousAgents = [...agents];
        setAgents(agents.filter(a => a.id !== id));

        try {
            const { error } = await supabase.from('agents').delete().eq('id', id);
            if (error) throw error;
            toast.success("Agente excluído com sucesso!");
        } catch (e: any) {
            console.error("Delete failed:", e);
            toast.error("Erro ao excluir agente: " + e.message);
            setAgents(previousAgents); // Rollback
        }
    };

    const handleToggleActive = async (agent: Agent) => {
        try {
            const { error } = await supabase
                .from('agents')
                .update({ is_active: !agent.is_active })
                .eq('id', agent.id);
            if (error) throw error;
            fetchAgents();
        } catch (e: any) {
            alert("Erro ao alterar status: " + e.message);
        }
    };


    const toggleDocument = (docId: string) => {
        const current = formData.document_ids || [];
        if (current.includes(docId)) {
            setFormData({ ...formData, document_ids: current.filter(id => id !== docId) });
        } else {
            setFormData({ ...formData, document_ids: [...current, docId] });
        }
    };

    const handleGenerateSystemPrompt = async () => {
        setIsGeneratingPrompt(true);
        try {
            const generatedText = await generateSystemPromptAI(
                promptGenData.businessName,
                promptGenData.niche,
                promptGenData.goal,
                promptGenData.tone,
                promptGenData.keyInfo
            );

            if (generatedText && !generatedText.startsWith("Erro")) {
                setFormData(prev => ({ ...prev, system_prompt: generatedText }));
                setIsPromptGeneratorOpen(false);
                setPromptGenStep(1);
            } else {
                throw new Error(generatedText || "Falha na geração");
            }

        } catch (e: any) {
            console.error(e);
            alert("Erro ao gerar prompt: " + (e.message || e));
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    // Componente de Toggle Switch
    const Toggle = ({ label, checked, onChange, badge }: any) => (
        <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="flex flex-col">
                <span className="text-sm text-white font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-3">
                {badge && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">{badge}</span>}
                <div
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-primary' : 'bg-zinc-700'}`}
                    onClick={() => onChange(!checked)}
                >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${checked ? 'left-6' : 'left-1'}`}></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Agentes IA</h2>
                    <p className="text-zinc-400">Gerencie seus assistentes de inteligência artificial.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary-gradient text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:opacity-90 shadow-lg shadow-emerald-900/20"
                >
                    <Plus size={20} />
                    Criar Novo Agente
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-800 rounded-xl">
                        <Bot size={48} className="mx-auto text-zinc-600 mb-4" />
                        <p className="text-zinc-500">Nenhum agente criado.</p>
                    </div>
                )}

                {agents.map(agent => (
                    <div key={agent.id} className="bg-surface border border-border rounded-xl p-6 hover:border-primary/50 transition-colors group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Bot size={24} />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleToggleActive(agent)}
                                    className={`p-2 rounded transition-colors ${agent.is_active ? 'text-primary hover:bg-primary/10' : 'text-zinc-500 hover:bg-zinc-800'}`}
                                    title={agent.is_active ? "Desativar Agente" : "Ativar Agente"}
                                >
                                    {agent.is_active ? <CheckCircle2 size={16} /> : <X size={16} />}
                                </button>
                                <button onClick={() => handleEdit(agent)} className="p-2 hover:bg-zinc-800 rounded text-zinc-400"><Settings size={16} /></button>
                                <button onClick={() => handleDelete(agent.id)} className="p-2 hover:bg-red-900/20 rounded text-red-500"><Trash2 size={16} /></button>
                            </div>

                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{agent.name}</h3>
                        <p className="text-xs text-zinc-500 mb-4 truncate">{agent.model}</p>

                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                            <span className={`w-2 h-2 rounded-full ${agent.connection_id ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            <span className="text-xs text-zinc-400">
                                {agent.connection_id ? 'Conectado' : 'Sem WhatsApp'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL PRINCIPAL DO AGENTE */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-surface w-full max-w-4xl h-[90vh] rounded-xl border border-zinc-800 flex flex-col shadow-2xl animate-in fade-in zoom-in-95 relative">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Criar Novo Agente</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
                        </div>

                        <div className="flex border-b border-zinc-800 px-6">
                            {['instructions', 'knowledge', 'settings', 'crm', 'analytics'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    {tab === 'instructions' ? 'Instruções' : tab === 'knowledge' ? 'Conhecimento' : tab === 'settings' ? 'Configurações' : tab === 'crm' ? 'CRM' : 'Análise'}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {/* ABA INSTRUÇÕES */}
                            {activeTab === 'instructions' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-300 mb-2">Nome do Agente *</label>
                                        <input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                                            placeholder="Ex: Ana (Vendas)"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-300 mb-2">WhatsApp vinculado *</label>
                                        <select
                                            value={formData.connection_id || ''}
                                            onChange={e => setFormData({ ...formData, connection_id: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                                        >
                                            <option value="">Nenhuma conexão disponível</option>
                                            {connections.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.phone_number})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-medium text-zinc-300">Instruções do Sistema</label>
                                            <button
                                                onClick={() => setIsPromptGeneratorOpen(true)}
                                                className="text-xs text-primary hover:text-white font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                                            >
                                                <Wand2 size={12} />
                                                Criar com IA Mágica
                                            </button>
                                        </div>
                                        <textarea
                                            value={formData.system_prompt}
                                            onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
                                            className="w-full h-64 bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-300 focus:border-primary outline-none font-mono resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ABA CONHECIMENTO */}
                            {activeTab === 'knowledge' && (
                                <div className="space-y-6">
                                    {/* SEÇÃO: CÉREBRO (FLUXO) */}
                                    <div className="p-4 bg-purple-500/5 rounded-xl border border-purple-500/20">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                                                <BrainCircuit size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white uppercase tracking-tight">Cérebro do Agente (Fluxo)</p>
                                                <p className="text-[10px] text-zinc-500">O fluxo define a inteligência lógica do atendimento.</p>
                                            </div>
                                        </div>

                                        <select
                                            value={formData.flow_id || ''}
                                            onChange={e => setFormData({ ...formData, flow_id: e.target.value || undefined })}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                                        >
                                            <option value="">Sem Fluxo (Usa apenas as Instruções)</option>
                                            {flows.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-4 pt-6 mt-6 border-t border-zinc-800">
                                        <div className="bg-zinc-900/50 p-4 rounded-lg border border-dashed border-zinc-700 text-center">
                                            <div className="flex justify-center mb-2 text-primary"><Database size={24} /></div>
                                            <p className="text-sm text-white font-medium">Bases de Conhecimento (RAG)</p>
                                            <p className="text-xs text-zinc-500 mb-3">Selecione os documentos que a IA deve consultar.</p>
                                        </div>

                                        {documents.length === 0 ? (
                                            <div className="text-center py-8">
                                                <p className="text-zinc-500 text-sm">Nenhum documento disponível.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {documents.map(doc => {
                                                    const isSelected = formData.document_ids?.includes(doc.id);
                                                    return (
                                                        <div
                                                            key={doc.id}
                                                            onClick={() => toggleDocument(doc.id)}
                                                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${isSelected ? 'bg-primary/10 border-primary' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                                                        >
                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-black' : 'border-zinc-600 bg-transparent'}`}>
                                                                {isSelected && <CheckCircle2 size={14} />}
                                                            </div>
                                                            <div>
                                                                <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{doc.title}</p>
                                                                <p className="text-xs text-zinc-500 uppercase">{doc.category}</p>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ABA CONFIGURAÇÕES */}
                            {activeTab === 'settings' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-300 mb-2">Modelo de IA *</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={formData.model?.startsWith('custom-') ? 'custom' : formData.model}
                                                onChange={e => {
                                                    if (e.target.value === 'custom') {
                                                        setFormData({ ...formData, model: 'custom-' });
                                                    } else {
                                                        setFormData({ ...formData, model: e.target.value });
                                                    }
                                                }}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                                            >
                                                <optgroup label="Modelos OpenAI (Recomendados) ⚡">
                                                    <option value="gpt-4o-mini">GPT-4o Mini (Ótimo Custo-Ben.) $</option>
                                                    <option value="gpt-4o">GPT-4o (O Melhor Atual) $$$</option>
                                                    <option value="gpt-4-turbo">GPT-4 Turbo $$$</option>
                                                </optgroup>
                                                <option value="custom">Outro (Digitar Nome do Modelo)...</option>
                                            </select>
                                        </div>
                                        {formData.model?.startsWith('custom-') && (
                                            <input
                                                type="text"
                                                placeholder="Digite o ID do modelo (ex: gpt-4-32k)"
                                                value={formData.model?.replace('custom-', '')}
                                                onChange={e => setFormData({ ...formData, model: `custom-${e.target.value}` })}
                                                className="w-full mt-2 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-primary outline-none animate-in slide-in-from-top-2"
                                            />
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-zinc-800 space-y-4">
                                        <h4 className="text-sm font-bold text-white mb-2">Opções do Agente</h4>

                                        <Toggle
                                            label="Agente Ativo (Responder mensagens)"
                                            checked={formData.is_active}
                                            onChange={(v: boolean) => setFormData({ ...formData, is_active: v })}
                                        />

                                        <Toggle
                                            label="Ouvir áudio"
                                            checked={formData.supports_audio}
                                            onChange={(v: boolean) => setFormData({ ...formData, supports_audio: v })}
                                            badge="Consome 1 crédito por áudio"
                                        />

                                        <Toggle
                                            label="Analisar imagens"
                                            checked={formData.supports_image}
                                            onChange={(v: boolean) => setFormData({ ...formData, supports_image: v })}
                                            badge="Consome 1 crédito por imagem"
                                        />

                                        <Toggle
                                            label='Aparecer "Digitando..." / "Gravando..."'
                                            checked={formData.typing_simulation}
                                            onChange={(v: boolean) => setFormData({ ...formData, typing_simulation: v })}
                                        />

                                        <Toggle
                                            label="Pausar agente no atendimento humano"
                                            checked={formData.pause_on_human}
                                            onChange={(v: boolean) => setFormData({ ...formData, pause_on_human: v })}
                                        />

                                        {formData.pause_on_human && (
                                            <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-sm font-medium text-zinc-300">Tempo de pausa após humano intervir</label>
                                                    <span className="text-primary font-bold text-xs">{formData.human_pause_hours || 24}h</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="48"
                                                    step="1"
                                                    value={formData.human_pause_hours || 24}
                                                    onChange={(e) => setFormData({ ...formData, human_pause_hours: parseInt(e.target.value) })}
                                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                                />
                                                <p className="text-[10px] text-zinc-500 mt-2">
                                                    O agente ficará em silêncio por este período após um humano enviar uma mensagem manual.
                                                </p>
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <label className="text-sm font-medium text-zinc-300 mb-2 block">Público do Agente</label>
                                            <select
                                                value={formData.audience_type || 'all'}
                                                onChange={(e) => setFormData({ ...formData, audience_type: e.target.value as any })}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-300 focus:outline-none focus:border-primary"
                                            >
                                                <option value="all">Responder a todos (Padrão)</option>
                                                <option value="new_leads">Apenas novos leads (Status: Lead)</option>
                                                <option value="unreplied">Leads ignorados por humanos</option>
                                            </select>
                                        </div>

                                        {formData.audience_type === 'unreplied' && (
                                            <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-sm font-medium text-zinc-300">Aguardar silêncio humano por</label>
                                                    <span className="text-primary font-bold text-xs">{formData.unreplied_timeout_hours || 2}h</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="24"
                                                    step="1"
                                                    value={formData.unreplied_timeout_hours || 2}
                                                    onChange={(e) => setFormData({ ...formData, unreplied_timeout_hours: parseInt(e.target.value) })}
                                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                                />
                                                <p className="text-[10px] text-zinc-500 mt-2">
                                                    O agente assumirá a conversa se o humano não responder em até {formData.unreplied_timeout_hours} horas.
                                                </p>
                                            </div>
                                        )}

                                        <Toggle
                                            label="Agrupar mensagens curtas (Recebimento)"
                                            checked={formData.group_messages}
                                            onChange={(v: boolean) => setFormData({ ...formData, group_messages: v })}
                                        />

                                        <div className="pt-2 pb-2">
                                            <h5 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">Humanização de Respostas</h5>
                                            <div className="space-y-3">
                                                <Toggle
                                                    label="Dividir mensagens (Humanizar)"
                                                    checked={formData.split_messages}
                                                    onChange={(v: boolean) => setFormData({ ...formData, split_messages: v })}
                                                />

                                                {formData.split_messages && (
                                                    <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <label className="text-sm font-medium text-zinc-300">Tempo de digitação entre mensagens</label>
                                                            <span className="text-primary font-bold text-xs">{formData.message_delay}s</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="1"
                                                            max="10"
                                                            step="1"
                                                            value={formData.message_delay || 2}
                                                            onChange={(e) => setFormData({ ...formData, message_delay: parseInt(e.target.value) })}
                                                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                                        />
                                                        <p className="text-[10px] text-zinc-500 mt-2 italic">A IA dividirá o texto por quebras de linha e enviará sequencialmente.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>


                                        <div>
                                            <label className="block text-sm font-medium text-zinc-300 mb-2">Quantidade de mensagens de histórico</label>
                                            <input
                                                type="number"
                                                value={formData.history_limit}
                                                onChange={e => setFormData({ ...formData, history_limit: parseInt(e.target.value) })}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                                            />
                                            <p className="text-xs text-zinc-500 mt-1">O agente irá inserir essa quantidade de mensagens no histórico da conversa, quanto maior quantidade, mais gasta créditos</p>
                                        </div>

                                        <div className="pt-4 border-t border-zinc-800">
                                            <Toggle
                                                label="Anti-Repetição Inteligente (Variação Linguística)"
                                                checked={formData.anti_repetition_enabled !== false} // Default true
                                                onChange={(v: boolean) => setFormData({ ...formData, anti_repetition_enabled: v })}
                                                badge="Novo 🎭"
                                            />
                                            <p className="text-xs text-zinc-500 px-3 mt-1">
                                                Evita que a IA repita frases idênticas, forçando variações mais naturais.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ABA CRM */}
                            {activeTab === 'crm' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-300 mb-2">Quadro CRM *</label>
                                        <select
                                            value={formData.crm_board_id}
                                            onChange={e => setFormData({ ...formData, crm_board_id: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                                        >
                                            <option value="default">Pipeline de Vendas (Padrão)</option>
                                            <option value="support">Suporte Técnico</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-300 mb-2">Etapa *</label>
                                        <select
                                            value={formData.crm_stage_id}
                                            onChange={e => setFormData({ ...formData, crm_stage_id: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                                        >
                                            <option value="lead">Novos Leads</option>
                                            <option value="talking">Em Negociação</option>
                                            <option value="scheduled">Agendados</option>
                                            <option value="closed">Perdidos</option>
                                        </select>
                                        <p className="text-xs text-zinc-500 mt-1">Todo contato que iniciar conversa com este agente cairá nesta etapa.</p>
                                    </div>
                                    {/* ... resto dos campos CRM mantidos ... */}
                                </div>
                            )}

                            {/* ABA ANALYTICS */}
                            {activeTab === 'analytics' && (
                                <div className="space-y-6">
                                    {!formData.id ? (
                                        <div className="p-8 text-center border-2 border-dashed border-zinc-800 rounded-xl">
                                            <p className="text-zinc-500">Salve o agente primeiro para ver a análise.</p>
                                        </div>
                                    ) : (
                                        <RepetitionAnalytics agentId={formData.id} />
                                    )}
                                </div>
                            )}

                            {/* ABA ANALYTICS */}
                            {activeTab === 'analytics' && (
                                <div className="space-y-6">
                                    {!formData.id ? (
                                        <div className="p-8 text-center border-2 border-dashed border-zinc-800 rounded-xl">
                                            <p className="text-zinc-500">Salve o agente primeiro para ver a análise.</p>
                                        </div>
                                    ) : (
                                        <RepetitionAnalytics agentId={formData.id} />
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900/50">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors">Cancelar</button>
                            <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-primary-gradient text-white font-bold rounded-lg hover:opacity-90 flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                                {loading ? <HelpCircle className="animate-spin" size={18} /> : <Save size={18} />}
                                Salvar Agente
                            </button>
                        </div>

                        {/* --- SUB-MODAL: PROMPT GENERATOR WIZARD --- */}
                        {isPromptGeneratorOpen && (
                            <div className="absolute inset-0 bg-surface z-50 flex flex-col animate-in fade-in">
                                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Wand2 className="text-primary" /> Criador de Agente Mágico
                                    </h3>
                                    <button onClick={() => setIsPromptGeneratorOpen(false)} className="text-zinc-500 hover:text-white"><X /></button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
                                    <div className="w-full max-w-lg space-y-6">

                                        <div className="flex items-center justify-between mb-8">
                                            {[1, 2, 3].map(step => (
                                                <div key={step} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === promptGenStep ? 'bg-primary text-black scale-110' : step < promptGenStep ? 'bg-green-900 text-green-400' : 'bg-zinc-800 text-zinc-600'}`}>
                                                    {step < promptGenStep ? <CheckCircle2 size={14} /> : step}
                                                </div>
                                            ))}
                                            <div className="absolute h-0.5 bg-zinc-800 w-full max-w-xs -z-10 top-1/2 left-1/2 -translate-x-1/2 translate-y-1"></div>
                                        </div>

                                        {promptGenStep === 1 && (
                                            <div className="space-y-4 animate-in slide-in-from-right-8">
                                                <h4 className="text-xl font-bold text-white text-center">Sobre o Negócio</h4>
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nome da Empresa</label>
                                                    <input
                                                        autoFocus
                                                        value={promptGenData.businessName}
                                                        onChange={e => setPromptGenData({ ...promptGenData, businessName: e.target.value })}
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-white focus:border-primary outline-none"
                                                        placeholder="Ex: Pizzaria Bella Napoli"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Ramo de Atuação</label>
                                                    <input
                                                        value={promptGenData.niche}
                                                        onChange={e => setPromptGenData({ ...promptGenData, niche: e.target.value })}
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-white focus:border-primary outline-none"
                                                        placeholder="Ex: Delivery de Pizza, Clínica Odontológica..."
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => setPromptGenStep(2)}
                                                    disabled={!promptGenData.businessName || !promptGenData.niche}
                                                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold mt-2 disabled:opacity-50"
                                                >
                                                    Próximo
                                                </button>
                                            </div>
                                        )}

                                        {promptGenStep === 2 && (
                                            <div className="space-y-4 animate-in slide-in-from-right-8">
                                                <h4 className="text-xl font-bold text-white text-center">Comportamento</h4>
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Objetivo Principal</label>
                                                    <select
                                                        value={promptGenData.goal}
                                                        onChange={e => setPromptGenData({ ...promptGenData, goal: e.target.value })}
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-white focus:border-primary outline-none"
                                                    >
                                                        <option value="vendas">Vender Produtos/Serviços</option>
                                                        <option value="agendamento">Agendar Reuniões/Consultas</option>
                                                        <option value="suporte">Suporte Técnico / Tira-Dúvidas</option>
                                                        <option value="qualificacao">Qualificar Leads (Triagem)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Tom de Voz</label>
                                                    <select
                                                        value={promptGenData.tone}
                                                        onChange={e => setPromptGenData({ ...promptGenData, tone: e.target.value })}
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-white focus:border-primary outline-none"
                                                    >
                                                        <option value="profissional">Profissional e Sério</option>
                                                        <option value="amigavel">Amigável e Empático</option>
                                                        <option value="energetico">Energético e Vendedor</option>
                                                        <option value="descontraido">Descontraído (Gírias leves)</option>
                                                    </select>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setPromptGenStep(1)} className="flex-1 py-3 text-zinc-400 hover:text-white">Voltar</button>
                                                    <button onClick={() => setPromptGenStep(3)} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold">Próximo</button>
                                                </div>
                                            </div>
                                        )}

                                        {promptGenStep === 3 && (
                                            <div className="space-y-4 animate-in slide-in-from-right-8">
                                                <h4 className="text-xl font-bold text-white text-center">Detalhes Finais</h4>
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Informações Chave (Opcional)</label>
                                                    <textarea
                                                        value={promptGenData.keyInfo}
                                                        onChange={e => setPromptGenData({ ...promptGenData, keyInfo: e.target.value })}
                                                        className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-lg p-4 text-white focus:border-primary outline-none resize-none"
                                                        placeholder="Ex: Não abrimos aos domingos. O rodízio custa R$49,90. Aceitamos Pix."
                                                    />
                                                </div>

                                                <button
                                                    onClick={handleGenerateSystemPrompt}
                                                    disabled={isGeneratingPrompt}
                                                    className="w-full py-4 bg-gradient-to-r from-primary to-emerald-600 hover:from-primaryHover hover:to-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                                                >
                                                    {isGeneratingPrompt ? <Loader2 className="animate-spin" /> : <Sparkles fill="currentColor" />}
                                                    {isGeneratingPrompt ? 'A IA está escrevendo...' : 'Gerar Prompt Mágico'}
                                                </button>
                                                <button onClick={() => setPromptGenStep(2)} className="w-full py-2 text-zinc-400 hover:text-white text-sm">Voltar</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )
            }
        </div >
    );
};