import React, { useState, useEffect } from 'react';
import {
    Send, Users, Clock, CheckCircle2, AlertCircle, Search, Filter, Plus, Radio, Calendar,
    Image as ImageIcon, FileText, Video, Loader2, Trash2, Mic, Sparkles, RefreshCcw, Link, User
} from 'lucide-react';
import { Broadcast, Connection, Contact } from '../types';
import { supabase } from '../services/supabaseClient';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const Broadcasts: React.FC = () => {
    const [view, setView] = useState<'list' | 'create'>('list');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);

    // Create Form State
    const [formData, setFormData] = useState<Partial<Broadcast>>({
        name: '',
        target_type: 'contacts', // contacts or groups
        tags: [],
        target_contact_ids: [],
        message_template: '',
        message_template_b: '', // New field for Variant B
        is_ab_test: false, // Toggle
        connection_id: '',
        media_type: undefined,
        media_url: '',
        config_batch_size: 50,
        config_batch_delay: 5,
        config_interval_min: 30,
        config_interval_max: 60,
        config_start_time: '08:00',
        config_end_time: '18:00',
        config_days: ['SEG', 'TER', 'QUA', 'QUI', 'SEX']
    });

    const [availableTags, setAvailableTags] = useState<string[]>([]);

    // Estado para busca de contatos individuais
    const [contactSearch, setContactSearch] = useState('');
    const [searchedContacts, setSearchedContacts] = useState<Contact[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (view === 'list') fetchBroadcasts();
        fetchTags();
        fetchConnections();
    }, [view]);

    // Busca contatos no DB quando o usuário digita
    useEffect(() => {
        if (formData.target_type === 'contacts' && contactSearch.length > 2) {
            const delayDebounceFn = setTimeout(async () => {
                const { data } = await supabase
                    .from('contacts')
                    .select('*')
                    .ilike('name', `%${contactSearch}%`)
                    .limit(5);
                setSearchedContacts(data || []);
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setSearchedContacts([]);
        }
    }, [contactSearch, formData.target_type]);

    const fetchConnections = async () => {
        const { data } = await supabase.from('connections').select('*');
        setConnections(data || []);
    };

    const fetchBroadcasts = async () => {
        setLoading(true);
        const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false });
        setBroadcasts(data || []);
        setLoading(false);
    };

    const fetchTags = async () => {
        const { data } = await supabase.from('contacts').select('tags');
        if (data) {
            const allTags = data.flatMap(c => c.tags || []);
            setAvailableTags([...new Set(allTags)]);
        }
    };

    const handleAddContact = (contact: Contact) => {
        if (!selectedContacts.find(c => c.id === contact.id)) {
            const updated = [...selectedContacts, contact];
            setSelectedContacts(updated);
            setFormData({ ...formData, target_contact_ids: updated.map(c => c.id) });
        }
        setContactSearch('');
        setSearchedContacts([]);
    };

    const handleRemoveContact = (id: string) => {
        const updated = selectedContacts.filter(c => c.id !== id);
        setSelectedContacts(updated);
        setFormData({ ...formData, target_contact_ids: updated.map(c => c.id) });
    };

    const generateMessageWithAI = async () => {
        if (!formData.name) return alert("Dê um nome à campanha para dar contexto à IA.");
        setIsGenerating(true);
        try {
            const prompt = `
          Crie uma mensagem curta e persuasiva para WhatsApp.
          Contexto da Campanha: "${formData.name}".
          Público Alvo: "${formData.tags?.join(', ') || 'Clientes Gerais'}".
          Objetivo: Venda ou Engajamento.
          Use variáveis como {name} se possível.
          Não use hashtags. Máximo 3 frases.
          `;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            setFormData({ ...formData, message_template: text?.trim() });
        } catch (e: any) {
            alert("Erro na IA: " + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreateBroadcast = async () => {
        setLoading(true);
        try {
            // 1. If A/B Test, create experiment structure
            if (formData.is_ab_test) {
                // Create Experiment Parent
                const { data: expData, error: expError } = await supabase.from('experiments').insert({
                    name: formData.name,
                    status: 'running', // Starts immediately (engine picks it up)
                    sample_size_percent: (formData as any).config_sample_size || 20,
                    delay_hours: (formData as any).config_delay_hours || 2,
                    target_tags: formData.tags
                }).select('id').single();

                if (expError) throw expError;
                const experimentId = expData.id;

                // Create Variants
                const variants = [
                    { experiment_id: experimentId, content: formData.message_template },
                    { experiment_id: experimentId, content: formData.message_template_b }
                ];
                const { error: varError } = await supabase.from('experiment_variants').insert(variants);
                if (varError) throw varError;

                // Trigger Engine (Optional, or let Cron pick it up)
                await supabase.functions.invoke('experiment-engine', { body: { experimentId } });

                alert('Teste A/B iniciado com sucesso! O sistema enviará as amostras em breve.');
            } else {
                // 2. Normal Broadcast
                const { error } = await supabase.from('broadcasts').insert({
                    ...formData,
                    status: 'scheduled',
                    scheduled_at: new Date().toISOString(),
                    target_tags: formData.tags
                });
                if (error) throw error;
                alert('Campanha agendada com sucesso!');
            }

            setView('list');
        } catch (err: any) {
            alert('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleDay = (day: string) => {
        const currentDays = formData.config_days || [];
        if (currentDays.includes(day)) {
            setFormData({ ...formData, config_days: currentDays.filter(d => d !== day) });
        } else {
            setFormData({ ...formData, config_days: [...currentDays, day] });
        }
    };

    return (
        <div className="space-y-6">
            {view === 'list' ? (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Disparos em Massa</h2>
                            <p className="text-zinc-400">Gerencie campanhas individuais ou em grupos.</p>
                        </div>
                        <button onClick={() => { setView('create'); setStep(1); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-zinc-900 font-bold rounded-lg hover:bg-primaryHover">
                            <Plus size={18} /> Novo Disparo
                        </button>
                    </div>

                    <div className="bg-surface border border-border rounded-xl overflow-hidden">
                        {broadcasts.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500">Nenhum disparo encontrado.</div>
                        ) : (
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="bg-zinc-900/50 uppercase text-xs font-bold text-zinc-500">
                                    <tr>
                                        <th className="p-4">Campanha</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {broadcasts.map(b => (
                                        <tr key={b.id} className="hover:bg-zinc-900/30">
                                            <td className="p-4 font-bold text-white">{b.name}</td>
                                            <td className="p-4">{b.target_type === 'groups' ? 'Grupos' : 'Contatos'}</td>
                                            <td className="p-4"><span className="px-2 py-1 rounded bg-zinc-800 text-xs">{b.status}</span></td>
                                            <td className="p-4 text-right"><button className="text-red-500 hover:text-red-400"><Trash2 size={16} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            ) : (
                <div className="max-w-4xl mx-auto animate-in fade-in">
                    <div className="mb-6 flex items-center gap-4">
                        <button onClick={() => setView('list')} className="text-zinc-400 hover:text-white">← Voltar</button>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white">Novo Disparo</h2>
                            <div className="flex gap-2 mt-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`h-1 flex-1 rounded-full ${step >= i ? 'bg-primary' : 'bg-zinc-800'}`}></div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface border border-border rounded-xl p-8 shadow-xl">

                        {/* STEP 1: CONFIGURAÇÃO */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-white mb-4">1. Configuração do Envio</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nome da Campanha</label>
                                        <input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-white focus:border-primary outline-none"
                                            placeholder="Ex: Promoção Fim de Ano"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Conexão (WhatsApp)</label>
                                        <select
                                            value={formData.connection_id}
                                            onChange={e => setFormData({ ...formData, connection_id: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-white focus:border-primary outline-none"
                                        >
                                            <option value="">Selecione...</option>
                                            {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-3">Tipo de Destino</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setFormData({ ...formData, target_type: 'contacts' })}
                                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.target_type === 'contacts' ? 'bg-primary/10 border-primary text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}
                                        >
                                            <Users size={24} />
                                            <span className="font-bold">Contatos (Individual)</span>
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, target_type: 'groups' })}
                                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.target_type === 'groups' ? 'bg-primary/10 border-primary text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}
                                        >
                                            <Users size={24} className="opacity-50" />
                                            <span className="font-bold">Grupos (Em Massa)</span>
                                        </button>
                                    </div>
                                </div>

                                {/* SELETOR DINÂMICO BASEADO NO TIPO */}
                                {formData.target_type === 'groups' ? (
                                    <div className="animate-in fade-in">
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Filtrar por Tags</label>
                                        <div className="flex flex-wrap gap-2">
                                            {availableTags.map(tag => (
                                                <button
                                                    key={tag}
                                                    onClick={() => {
                                                        const tags = formData.tags || [];
                                                        setFormData({ ...formData, tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] });
                                                    }}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${formData.tags?.includes(tag) ? 'bg-primary/20 border-primary text-primary' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                            {availableTags.length === 0 && <span className="text-zinc-500 text-xs">Nenhuma tag encontrada.</span>}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in">
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Buscar Contatos Individuais</label>
                                        <div className="relative mb-3">
                                            <Search className="absolute left-3 top-3 text-zinc-500" size={16} />
                                            <input
                                                type="text"
                                                value={contactSearch}
                                                onChange={e => setContactSearch(e.target.value)}
                                                placeholder="Digite o nome..."
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 pl-10 text-white text-sm focus:border-primary outline-none"
                                            />
                                            {searchedContacts.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 bg-zinc-800 border border-zinc-700 rounded mt-1 z-10 max-h-40 overflow-y-auto">
                                                    {searchedContacts.map(c => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => handleAddContact(c)}
                                                            className="p-2 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-300 flex justify-between"
                                                        >
                                                            <span>{c.name}</span>
                                                            <span className="text-zinc-500 text-xs">{c.phone}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Lista de Selecionados */}
                                        <div className="space-y-2">
                                            {selectedContacts.map(c => (
                                                <div key={c.id} className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-800 rounded">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                                            {c.name.charAt(0)}
                                                        </div>
                                                        <span className="text-sm text-zinc-300">{c.name}</span>
                                                        <span className="text-xs text-zinc-500">{c.phone}</span>
                                                    </div>
                                                    <button onClick={() => handleRemoveContact(c.id)} className="text-zinc-500 hover:text-red-500">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            {selectedContacts.length === 0 && <p className="text-xs text-zinc-500 italic">Nenhum contato selecionado.</p>}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end mt-6">
                                    <button onClick={() => setStep(2)} className="px-6 py-2 bg-primary text-zinc-900 font-bold rounded-lg hover:bg-primaryHover">Próximo</button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: MENSAGEM & MÍDIA */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-white">2. Mensagem</h3>
                                    <div className="flex items-center gap-4">
                                        {/* A/B Test Toggle */}
                                        <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <span className="text-xs font-bold text-zinc-400 uppercase">Teste A/B</span>
                                                <button
                                                    onClick={() => setFormData(prev => ({ ...prev, is_ab_test: !prev.is_ab_test }))}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${formData.is_ab_test ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                                                >
                                                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${formData.is_ab_test ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </label>

                                            {formData.is_ab_test && (
                                                <>
                                                    <div className="w-px h-4 bg-zinc-700"></div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Amostra</span>
                                                        <input
                                                            type="number"
                                                            className="w-12 bg-zinc-800 border-none rounded text-xs text-white text-center p-1"
                                                            placeholder="20%"
                                                            value={(formData as any).config_sample_size || 20}
                                                            onChange={e => setFormData({ ...formData, config_sample_size: parseInt(e.target.value) } as any)}
                                                        />
                                                        <span className="text-xs text-zinc-500">%</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Delay</span>
                                                        <input
                                                            type="number"
                                                            className="w-12 bg-zinc-800 border-none rounded text-xs text-white text-center p-1"
                                                            placeholder="2h"
                                                            value={(formData as any).config_delay_hours || 2}
                                                            onChange={e => setFormData({ ...formData, config_delay_hours: parseInt(e.target.value) } as any)}
                                                        />
                                                        <span className="text-xs text-zinc-500">h</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="w-px h-4 bg-zinc-700"></div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-zinc-400">IA Inteligente</span>
                                            <button
                                                onClick={() => setFormData(prev => ({ ...prev, is_ai_generated: !prev.is_ai_generated }))}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${formData.is_ai_generated ? 'bg-primary' : 'bg-zinc-700'}`}
                                            >
                                                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${formData.is_ai_generated ? 'left-6' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className={`grid gap-4 transition-all ${formData.is_ab_test ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {/* VARIANT A */}
                                    <div className="space-y-2">
                                        {formData.is_ab_test && <span className="text-xs font-bold text-purple-400 uppercase block">Variante A (Controle)</span>}
                                        <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
                                            {/* Toolbar de Mídia */}
                                            <div className="flex gap-2 p-2 border-b border-zinc-700 bg-zinc-800/50">
                                                <button
                                                    onClick={() => setFormData({ ...formData, media_type: 'image' })}
                                                    className={`p-2 rounded text-zinc-400 hover:text-white ${formData.media_type === 'image' ? 'bg-primary/20 text-primary' : ''}`} title="Imagem"
                                                >
                                                    <ImageIcon size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setFormData({ ...formData, media_type: 'video' })}
                                                    className={`p-2 rounded text-zinc-400 hover:text-white ${formData.media_type === 'video' ? 'bg-primary/20 text-primary' : ''}`} title="Vídeo"
                                                >
                                                    <Video size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setFormData({ ...formData, media_type: 'audio' })}
                                                    className={`p-2 rounded text-zinc-400 hover:text-white ${formData.media_type === 'audio' ? 'bg-primary/20 text-primary' : ''}`} title="Áudio"
                                                >
                                                    <Mic size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setFormData({ ...formData, media_type: 'document' })}
                                                    className={`p-2 rounded text-zinc-400 hover:text-white ${formData.media_type === 'document' ? 'bg-primary/20 text-primary' : ''}`} title="Documento"
                                                >
                                                    <FileText size={18} />
                                                </button>

                                                <div className="w-px h-6 bg-zinc-700 mx-2"></div>

                                                <button
                                                    onClick={generateMessageWithAI}
                                                    disabled={isGenerating}
                                                    className="flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 ml-auto"
                                                >
                                                    {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                                                    Gerar IA
                                                </button>
                                            </div>

                                            <textarea
                                                value={formData.message_template}
                                                onChange={e => setFormData({ ...formData, message_template: e.target.value })}
                                                rows={6}
                                                placeholder="Olá {name}, veja nossa oferta..."
                                                className="w-full bg-transparent p-4 text-white outline-none resize-none font-mono text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* VARIANT B */}
                                    {formData.is_ab_test && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-right-4">
                                            <span className="text-xs font-bold text-amber-400 uppercase block">Variante B (Teste)</span>
                                            <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden h-full">
                                                <div className="flex gap-2 p-2 border-b border-zinc-700 bg-zinc-800/50 h-[45px] items-center">
                                                    <span className="text-xs text-zinc-500 italic ml-2">Mídia compartilhada da Var A</span>
                                                </div>
                                                <textarea
                                                    value={formData.message_template_b}
                                                    onChange={e => setFormData({ ...formData, message_template_b: e.target.value })}
                                                    rows={6}
                                                    placeholder="Olá {name}, experimente nossa nova oferta..."
                                                    className="w-full bg-transparent p-4 text-white outline-none resize-none font-mono text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between mt-6">
                                    <button onClick={() => setStep(1)} className="text-zinc-400 hover:text-white">Voltar</button>
                                    <button onClick={() => setStep(3)} className="px-6 py-2 bg-primary text-zinc-900 font-bold rounded-lg hover:bg-primaryHover">Próximo</button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: AGENDAMENTO AVANÇADO (Mantido igual) */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-white mb-4">3. Agendamento Avançado</h3>

                                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Dias da Semana</label>
                                        <div className="flex gap-2">
                                            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map(day => (
                                                <button
                                                    key={day}
                                                    onClick={() => toggleDay(day)}
                                                    className={`w-10 h-10 rounded-lg text-xs font-bold transition-colors ${formData.config_days?.includes(day) ? 'bg-primary text-zinc-900' : 'bg-zinc-800 text-zinc-500'}`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* ... rest of schedule config ... */}
                                    <div className="pt-4 border-t border-zinc-800">
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-3">Proteção Anti-Bloqueio (Delay)</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-xs text-zinc-400 block mb-1">Intervalo (segundos)</span>
                                                <div className="flex items-center gap-2">
                                                    <input type="number" value={formData.config_interval_min} onChange={e => setFormData({ ...formData, config_interval_min: parseInt(e.target.value) })} className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white text-sm" />
                                                    <span className="text-zinc-500">-</span>
                                                    <input type="number" value={formData.config_interval_max} onChange={e => setFormData({ ...formData, config_interval_max: parseInt(e.target.value) })} className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white text-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between mt-6 pt-4 border-t border-zinc-800">
                                    <button onClick={() => setStep(2)} className="text-zinc-400 hover:text-white">Voltar</button>
                                    <button
                                        onClick={handleCreateBroadcast}
                                        disabled={loading}
                                        className="px-6 py-2 bg-primary text-zinc-900 font-bold rounded-lg hover:bg-primaryHover flex items-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                        Agendar Disparo
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};