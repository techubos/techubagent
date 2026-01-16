
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { Clock, Loader2, CheckCircle } from 'lucide-react';

export const CampaignSyncCenter = ({ syncCampaign, syncing }: any) => {
    const [campaigns, setCampaigns] = useState<any[]>([]);

    useEffect(() => {
        fetchCampaigns();
        const sub = supabase.channel('campaign_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'prospecting_campaigns' }, fetchCampaigns).subscribe();
        return () => { supabase.removeChannel(sub); };
    }, []);

    const fetchCampaigns = async () => {
        const { data } = await supabase.from('prospecting_campaigns').select('*').order('created_at', { ascending: false }).limit(5);
        setCampaigns(data || []);
    };

    if (campaigns.length === 0) return null;

    return (
        <div className="glass-card border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-transparent opacity-50" />
            <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2 relative z-10">
                <Clock size={14} /> Histórico de Buscas (Sincronização)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                {campaigns.map(c => (
                    <div key={c.id} className="bg-zinc-950/40 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-purple-500/30 transition-all hover:bg-purple-500/5 hover:-translate-y-1 shadow-lg">
                        <div className="truncate pr-4">
                            <p className="text-xs font-black text-white truncate group-hover:text-purple-300 transition-colors">{c.name}</p>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5 map">{c.status} • <span className="text-white">{c.valid_leads}</span>/{c.total_leads} leads</p>
                        </div>
                        {c.status === 'running' && (
                            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl animate-pulse border border-purple-500/20">
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                        )}
                        {c.status === 'completed' && (
                            <button
                                onClick={() => syncCampaign(c.id, c.apify_run_id)}
                                disabled={syncing === c.id}
                                className={`p-2 rounded-xl transition-all ${syncing === c.id ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white hover:scale-110 shadow-lg'}`}
                            >
                                {syncing === c.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
