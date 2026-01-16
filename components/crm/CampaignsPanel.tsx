import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Play, Plus, Clock, Users, MessageSquare } from 'lucide-react';

interface Campaign {
    id: string;
    name: string;
    target_tags: string[];
    message_template: string;
    status: 'draft' | 'running' | 'completed' | 'scheduled';
    stats?: { sent: number; failed: number };
    created_at: string;
}

export const CampaignsPanel: React.FC = () => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // New Campaign State
    const [newName, setNewName] = useState('');
    const [newTags, setNewTags] = useState('');
    const [newTemplate, setNewTemplate] = useState('Olá {{name}}! Vi que você tem interesse em...');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
        setCampaigns(data || []);
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newName || !newTemplate) return alert("Preencha nome e template");
        setSaving(true);
        try {
            const tagsArray = newTags.split(',').map(t => t.trim()).filter(t => t);
            const { error } = await supabase.from('campaigns').insert({
                name: newName,
                target_tags: tagsArray,
                message_template: newTemplate,
                status: 'draft'
            }); // .select() is ideal but insert works

            if (error) throw error;
            setIsCreateOpen(false);
            setNewName('');
            setNewTags('');
            fetchCampaigns();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRun = async (id: string) => {
        if (!confirm("Iniciar disparo agora?")) return;
        try {
            await supabase.from('campaigns').update({ status: 'running' }).eq('id', id);
            fetchCampaigns(); // Optimistic update

            // Trigger Edge Function
            const { data, error } = await supabase.functions.invoke('send-campaign', {
                body: { campaignId: id }
            });

            if (error) throw error;
            alert(`Disparo iniciado! Enviados: ${data?.sent || '?'} Falhas: ${data?.failed || '?'}`);
            fetchCampaigns();
        } catch (e: any) {
            alert("Erro ao disparar: " + e.message);
            fetchCampaigns(); // Revert/Refresh
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#18181b] rounded-2xl overflow-hidden border border-zinc-800">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white">Campanhas</h2>
                    <p className="text-zinc-400 text-sm">Gerencie disparos em massa.</p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 bg-primary text-zinc-900 px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-all"
                >
                    <Plus size={18} /> Nova Campanha
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-zinc-500" /></div>
                ) : campaigns.length === 0 ? (
                    <div className="text-center text-zinc-500 py-10">Nenhuma campanha criada.</div>
                ) : (
                    campaigns.map(c => (
                        <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">{c.name}</h3>
                                    <div className="flex gap-2 text-xs text-zinc-400">
                                        <span className="bg-zinc-800 px-2 py-1 rounded flex items-center gap-1"><Users size={12} /> {c.target_tags?.join(', ') || 'Todos'}</span>
                                        <span className="bg-zinc-800 px-2 py-1 rounded flex items-center gap-1"><Clock size={12} /> {new Date(c.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${c.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                        c.status === 'running' ? 'bg-yellow-500/10 text-yellow-500 animate-pulse' :
                                            'bg-zinc-700 text-zinc-300'
                                    }`}>
                                    {c.status}
                                </div>
                            </div>

                            <div className="bg-black/30 p-3 rounded-lg text-sm text-zinc-300 mb-4 font-mono whitespace-pre-wrap border border-zinc-800/50">
                                {c.message_template}
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="text-zinc-500 text-xs">
                                    {c.stats && (
                                        <span>Enviados: {c.stats.sent} | Falhas: {c.stats.failed}</span>
                                    )}
                                </div>

                                {c.status === 'draft' && (
                                    <button
                                        onClick={() => handleRun(c.id)}
                                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all border border-zinc-700"
                                    >
                                        <Play size={14} /> Disparar Agora
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#18181b] w-full max-w-lg rounded-xl border border-zinc-800 p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Criar Campanha</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Nome da Campanha</label>
                                <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white outline-none" placeholder="Ex: Promoção Janeiro" />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Tags (separadas por vírgula)</label>
                                <input value={newTags} onChange={e => setNewTags(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white outline-none" placeholder="vip, ex-cliente..." />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Mensagem (Use {'{{name}}'} e [memories])</label>
                                <textarea value={newTemplate} onChange={e => setNewTemplate(e.target.value)} className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white outline-none resize-none font-mono text-sm" />
                                <p className="text-[10px] text-zinc-500 mt-1">Variáveis: {'{{name}}'} (Nome), [memories] (Fato relevante)</p>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-zinc-400">Cancelar</button>
                                <button onClick={handleCreate} disabled={saving} className="px-6 py-2 bg-primary text-zinc-900 font-bold rounded-lg flex items-center gap-2">
                                    {saving && <Loader2 className="animate-spin" size={14} />} Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
