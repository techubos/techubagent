
import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseClient';
// Hooks
import { useLeads } from '../features/prospecting/api/useLeads';
// Components
import { LeadRow } from '../features/prospecting/components/LeadRow';
import { CampaignSyncCenter } from '../features/prospecting/components/CampaignSyncCenter';
// Virtualization
// Virtualization Imports (Namespace workaround for ESM/CJS)
import * as ReactWindow from 'react-window';
import * as AutoSizerModule from 'react-virtualized-auto-sizer';

const List = (ReactWindow as any).FixedSizeList || (ReactWindow as any).default?.FixedSizeList || (ReactWindow as any).default;
const AutoSizer = (AutoSizerModule as any).default || AutoSizerModule;
// Icons
import {
    Target,
    Loader2,
    Building2,
    AlertCircle,
    Zap
} from 'lucide-react';

const BRAZIL_STATES = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const Prospecting = () => {
    // 1. Core Data Hook
    const { leads, isLoading: loadingLeads, error: leadsError, refetch, importLead, discardLead } = useLeads();

    // 2. Local View State (Filters & Form)
    const [searchType, setSearchType] = useState<'maps' | 'instagram'>('instagram');
    const [segment, setSegment] = useState('');
    const [state, setState] = useState('MG');
    const [city, setCity] = useState('');
    const [enrichSocial, setEnrichSocial] = useState(false);
    const [aiFilter, setAiFilter] = useState('');
    const [minRating, setMinRating] = useState(0);
    const [onlyWithPhone, setOnlyWithPhone] = useState(true);
    const [limit, setLimit] = useState(10);
    const [hashtag, setHashtag] = useState('');

    // 3. UI Action State
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

    // 4. Actions
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        setSearching(true);
        setError(null);
        try {
            if (searchType === 'maps') {
                if (!segment.trim()) return;
                const { data, error: invokeError } = await supabase.functions.invoke('outscraper-search', {
                    body: {
                        segment,
                        state,
                        city,
                        limit,
                        enrich_social: enrichSocial,
                        ai_filter: aiFilter,
                        min_rating: minRating,
                        only_with_phone: onlyWithPhone
                    }
                });

                if (invokeError) throw invokeError;
                if (data?.error) {
                    let cleanError = data.error;
                    if (cleanError.includes('Outscraper Error:')) {
                        try {
                            const jsonPart = cleanError.split('Outscraper Error:')[1];
                            const parsed = JSON.parse(jsonPart);
                            if (parsed.errorMessage) {
                                cleanError = `Outscraper: ${parsed.errorMessage}`;
                            }
                        } catch (e) {
                            // If parsing fails, keep original
                        }
                    }
                    setError(cleanError);
                    return;
                }

                await refetch();
            } else {
                if (!hashtag.trim() && !city.trim()) {
                    setError("Informe uma Hashtag ou Cidade para buscar no Instagram.");
                    return;
                }

                // 1. Create Campaign
                const { data: campaign, error: campError } = await supabase
                    .from('prospecting_campaigns')
                    .insert({
                        name: `Busca Instagram: ${hashtag || city}`,
                        type: 'instagram',
                        criteria: { hashtag, city, limit }
                    })
                    .select()
                    .single();

                if (campError) throw campError;

                // 2. Trigger Orchestrator
                const { data: trigger, error: triggerError } = await supabase.functions.invoke('prospecting-orchestrator', {
                    body: {
                        action: 'start_instagram',
                        payload: { hashtag, location: city, limit, campaignId: campaign.id }
                    }
                });

                if (triggerError) throw triggerError;
                if (trigger?.error) {
                    setError(`Erro do Orquestrador: ${trigger.error}`);
                    return;
                }

                // Show success feedback
                setError(null);
            }
        } catch (e: any) {
            console.error("Search failed:", e);
            setError(e.message || "Ocorreu um erro inesperado na busca.");
        } finally {
            setSearching(false);
        }
    };

    const syncCampaign = async (campaignId: string, runId: string) => {
        setSyncing(campaignId);
        setError(null);
        try {
            const { data, error: invokeError } = await supabase.functions.invoke('prospecting-orchestrator', {
                body: {
                    action: 'sync_results',
                    payload: { campaignId, runId }
                }
            });

            if (invokeError) throw invokeError;
            if (data?.error) throw new Error(data.error);

            await refetch();
            toast.success("Sincronização concluída!");
        } catch (e: any) {
            console.error("Sync failed:", e);
            toast.error(`Erro na sincronização: ${e.message}`);
        } finally {
            setSyncing(null);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="relative">
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
                <h1 className="text-4xl font-black text-white flex items-center gap-4 tracking-tighter relative z-10">
                    <div className="p-3 bg-zinc-900/50 rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                        <Zap className="text-yellow-500 fill-yellow-500" size={32} />
                    </div>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
                        Prospecção <span className="text-primary-gradient">Turbo</span>
                    </span>
                </h1>
                <p className="text-zinc-500 mt-2 font-medium text-lg ml-[4.5rem] relative z-10">Extração de dados em alta performance com enriquecimento via IA.</p>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 gap-6">

                {/* Search Form Panel */}
                <div className="glass-card p-8 border border-white/5 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

                    <form onSubmit={handleSearch} className="relative z-10">
                        <div className="flex gap-4 mb-6 p-1 bg-zinc-900/50 rounded-2xl w-fit border border-white/5">
                            <button
                                type="button"
                                onClick={() => setSearchType('maps')}
                                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${searchType === 'maps' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <Target size={16} /> Google Maps
                            </button>
                            <button
                                type="button"
                                onClick={() => setSearchType('instagram')}
                                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${searchType === 'instagram' ? 'bg-zinc-800 text-pink-500 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <div className="p-1 bg-pink-500 rounded-lg"><Target size={12} className="text-white" /></div> Instagram
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {searchType === 'maps' ? (
                                <>
                                    <input
                                        type="text"
                                        value={segment}
                                        onChange={(e) => setSegment(e.target.value)}
                                        placeholder="Segmento (ex: Hamburgueria, Dentista)"
                                        className="bg-zinc-900/50 border border-border rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold placeholder:text-zinc-600 md:col-span-2"
                                    />
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="Cidade"
                                        className="bg-zinc-900/50 border border-border rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold placeholder:text-zinc-600"
                                    />
                                    <select
                                        value={state}
                                        onChange={(e) => setState(e.target.value)}
                                        className="bg-zinc-900/50 border border-border rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold cursor-pointer"
                                    >
                                        {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        value={hashtag}
                                        onChange={(e) => setHashtag(e.target.value)}
                                        placeholder="#Hashtag (ex: #marketingdigital)"
                                        className="bg-zinc-900/50 border border-border rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all font-bold placeholder:text-zinc-600 md:col-span-2"
                                    />
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="Cidade (Opcional)"
                                        className="bg-zinc-900/50 border border-border rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all font-bold placeholder:text-zinc-600 md:col-span-2"
                                    />
                                </>
                            )}
                        </div>

                        {/* Advanced Filters */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="flex items-center gap-3 bg-zinc-900/30 p-4 rounded-xl border border-white/5 cursor-pointer hover:bg-zinc-900/50 transition-colors" onClick={() => setEnrichSocial(!enrichSocial)}>
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${enrichSocial ? 'bg-primary text-black' : 'bg-zinc-800 text-zinc-600'}`}>
                                    {enrichSocial && <Target size={14} />}
                                </div>
                                <span className="text-sm font-medium text-zinc-400">Enriquecer Social (+Lento)</span>
                            </div>

                            <div className="flex items-center gap-3 bg-zinc-900/30 p-4 rounded-xl border border-white/5 cursor-pointer hover:bg-zinc-900/50 transition-colors" onClick={() => setOnlyWithPhone(!onlyWithPhone)}>
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${onlyWithPhone ? 'bg-primary text-black' : 'bg-zinc-800 text-zinc-600'}`}>
                                    {onlyWithPhone && <Target size={14} />}
                                </div>
                                <span className="text-sm font-medium text-zinc-400">Apenas com Telefone</span>
                            </div>

                            <textarea
                                value={aiFilter}
                                onChange={(e) => setAiFilter(e.target.value)}
                                placeholder="Filtro IA (ex: 'Apenas empresas B2B')"
                                className="md:col-span-2 bg-zinc-900/50 border border-border rounded-2xl p-4 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium h-[60px] resize-none"
                            />
                        </div>

                        <div className="pt-4 flex flex-col sm:flex-row items-center gap-4 mt-4">
                            <button
                                disabled={searching || (searchType === 'maps' ? !segment : !hashtag)}
                                className={`w-full sm:w-auto px-12 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-xl ${searching || (searchType === 'maps' ? !segment : !hashtag)
                                    ? 'bg-zinc-800 text-zinc-500 grayscale'
                                    : 'bg-primary hover:bg-primaryHover text-zinc-900 shadow-primary/20'
                                    }`}
                            >
                                {searching ? <Loader2 className="animate-spin" size={20} /> : <Target size={20} />}
                                {searching ? 'Minerando Dados...' : 'Iniciar Prospecção'}
                            </button>

                            <div className="flex items-center gap-3 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                                <span>Qtd:</span>
                                <select
                                    value={limit}
                                    onChange={(e) => setLimit(Number(e.target.value))}
                                    className="bg-zinc-800 border-none rounded-lg px-3 py-1 text-zinc-300 focus:ring-0 cursor-pointer"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                </select>
                            </div>
                        </div>
                    </form>

                    {error && (
                        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                            <AlertCircle size={20} />
                            <span className="text-sm font-medium">{error}</span>
                            <button onClick={() => setError(null)} className="ml-auto text-xs hover:underline">Fechar</button>
                        </div>
                    )}
                </div>

                {/* Active Campaigns (Sync Center) */}
                <CampaignSyncCenter syncCampaign={syncCampaign} syncing={syncing} />

                {/* Leads Display - Virtualized */}
                {/* Fixed height container for virtualization */}
                <div className="h-[800px] w-full bg-zinc-900/20 rounded-3xl border border-white/5 overflow-hidden relative">
                    {loadingLeads ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4 absolute inset-0">
                            <Loader2 className="animate-spin text-primary" size={60} />
                            <span className="font-bold tracking-widest uppercase text-sm">Carregando Lista de Ouro...</span>
                        </div>
                    ) : leads.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-6 absolute inset-0">
                            <div className="p-4 bg-zinc-800/50 rounded-full text-zinc-600">
                                <Building2 size={48} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-zinc-300">Nenhum lead encontrado</h3>
                                <p className="max-w-xs mx-auto mt-2">Faça uma busca acima para começar a minerar dados.</p>
                            </div>
                        </div>
                    ) : (
                        <AutoSizer>
                            {({ height, width }: { height: number; width: number }) => (
                                <List
                                    height={height}
                                    width={width}
                                    itemCount={leads.length}
                                    itemSize={420} // Adjusted height for cards
                                >
                                    {({ index, style }: any) => (
                                        <LeadRow
                                            lead={leads[index]}
                                            style={style}
                                            selectedLeads={selectedLeads}
                                            toggleSelect={toggleSelect}
                                            importLead={(l) => importLead.mutate(l)}
                                            discardLead={(id) => discardLead.mutate(id)}
                                        />
                                    )}
                                </List>
                            )}
                        </AutoSizer>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Prospecting;
