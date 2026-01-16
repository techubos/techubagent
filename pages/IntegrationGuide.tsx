import React, { useState, useEffect } from 'react';
import { Phone, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Cpu, MonitorPlay, Zap, Plus, Trash2 } from 'lucide-react';
import { AgentSettings } from '../types';
import { supabase } from '../services/supabaseClient';
import { checkInstanceStatus, fetchQRCode, createInstance, logoutInstance, saveConnection } from '../services/evolutionService';

interface IntegrationProps {
    settings: AgentSettings;
}

export const IntegrationGuide: React.FC<IntegrationProps> = ({ settings }) => {
    const [loading, setLoading] = useState(false);
    const [evolutionConfig, setEvolutionConfig] = useState({
        instanceName: 'teclab', // Default fallback
        serverUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'https://evolution.gamacreativedesign.com.br',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11'
    });
    const [isInstanceConnected, setIsInstanceConnected] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);

    // Load existing connection on mount
    useEffect(() => {
        const loadConnection = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
            if (!profile?.organization_id) return;

            const { data: conn } = await supabase
                .from('connections')
                .select('instance_name, status')
                .eq('organization_id', profile.organization_id)
                .maybeSingle();

            if (conn && conn.instance_name) {
                console.log('Found saved connection:', conn.instance_name);
                setEvolutionConfig(prev => ({ ...prev, instanceName: conn.instance_name }));
                if (conn.status === 'open') setIsInstanceConnected(true);
            }
        };
        loadConnection();
    }, []);

    useEffect(() => {
        if (evolutionConfig.apiKey && evolutionConfig.serverUrl) {
            checkConnection(); // Check live status
        }
    }, [evolutionConfig.serverUrl, evolutionConfig.instanceName]); // Re-check when instance name changes (e.g. loaded from DB)

    const checkConnection = async () => {
        const status = await checkInstanceStatus({
            instanceName: evolutionConfig.instanceName,
            serverUrl: evolutionConfig.serverUrl,
            apiKey: evolutionConfig.apiKey
        });
        if (status && status.instance) {
            const isConnected = status.instance.state === 'open';
            setIsInstanceConnected(isConnected);
            // Self-healing: If connected but not in DB (or just to be sure), save it.
            if (isConnected) {
                saveConnection(evolutionConfig);
            }
        }
    };

    const fetchQR = async () => {
        setLoading(true);
        const data = await fetchQRCode({
            instanceName: evolutionConfig.instanceName,
            serverUrl: evolutionConfig.serverUrl,
            apiKey: evolutionConfig.apiKey
        });
        setLoading(false);
        if (data && data.base64) {
            setQrCode(data.base64);
        } else {
            console.error("Failed to fetch QR");
            // Don't alert immediately, user might need to create instance first
        }
    };

    const handleCreateInstance = async () => {
        setLoading(true);
        try {
            const res = await createInstance(evolutionConfig);
            if (res && (res.instance || res.status === 201 || res.hash)) {
                alert(`Instância ${evolutionConfig.instanceName} criada com sucesso!`);
                saveConnection(evolutionConfig);
                fetchQR();
            } else {
                // If it fails, it might be because it already exists, so try fetching QR anyway
                const qr = await fetchQRCode({
                    instanceName: evolutionConfig.instanceName,
                    serverUrl: evolutionConfig.serverUrl,
                    apiKey: evolutionConfig.apiKey
                });
                if (qr && qr.base64) {
                    setQrCode(qr.base64);
                } else {
                    throw new Error(res?.message || "Falha ao criar instância.");
                }
            }
        } catch (e: any) {
            alert("Erro: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (!confirm("Tem certeza? Isso irá desconectar o WhatsApp desta instância.")) return;
        setLoading(true);
        try {
            await logoutInstance(evolutionConfig);
            setIsInstanceConnected(false);
            setQrCode(null);
            alert("Instância desconectada.");
        } catch (e: any) {
            alert("Erro ao desconectar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-12 animate-in fade-in">
            <div className="mb-8 border-b border-white/10 pb-6">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <Zap className="text-yellow-500 fill-yellow-500" />
                    Conectar WhatsApp
                </h1>
                <p className="text-zinc-400">
                    Conecte seu número para permitir que o Agente IA responda automaticamente e gerencie o CRM.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left Panel: Connection UI */}
                <div className="space-y-6">
                    <div className="bg-surface border border-border rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                        {/* Status Header */}
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isInstanceConnected ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                    <Phone className={isInstanceConnected ? 'text-emerald-500' : 'text-red-500'} size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Status da Conexão</h3>
                                    <p className="text-xs text-zinc-500 font-mono">
                                        Instância: <span className="text-zinc-300">{evolutionConfig.instanceName}</span>
                                    </p>
                                </div>
                            </div>
                            <div className={`px-4 py-1.5 rounded-full border ${isInstanceConnected ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'} text-xs font-bold`}>
                                {isInstanceConnected ? 'ONLINE' : 'OFFLINE'}
                            </div>
                        </div>

                        {/* Main Interaction Area */}
                        {!isInstanceConnected ? (
                            <div className="relative z-10">
                                {qrCode ? (
                                    <div className="flex flex-col items-center animate-in zoom-in duration-300">
                                        <div className="bg-white p-3 rounded-xl shadow-xl mb-6">
                                            <img src={qrCode} alt="QR Code" className="w-64 h-64 object-contain" />
                                        </div>
                                        <div className="text-center space-y-2">
                                            <p className="text-zinc-300 font-medium">Escaneie com seu WhatsApp</p>
                                            <p className="text-xs text-zinc-500">Configurações {'>'} Aparelhos Conectados</p>
                                        </div>
                                        <button
                                            onClick={fetchQR}
                                            className="mt-6 flex items-center gap-2 text-primary hover:text-white transition-colors text-sm"
                                        >
                                            <RefreshCw size={14} /> Atualizar Código
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-12 flex flex-col items-center text-center">
                                        <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-zinc-700">
                                            <MonitorPlay size={40} className="text-zinc-500" />
                                        </div>
                                        <h4 className="text-xl font-bold text-white mb-2">Pronto para Conectar</h4>
                                        <p className="text-zinc-400 text-sm max-w-xs mb-8">
                                            Clique no botão abaixo para gerar o código de pareamento com a Evolution API.
                                        </p>

                                        <div className="flex flex-col gap-3 w-full max-w-xs">
                                            <button
                                                onClick={handleCreateInstance}
                                                disabled={loading}
                                                className="w-full py-3.5 bg-primary hover:bg-primaryHover text-zinc-900 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> Gerar Conexão</>}
                                            </button>
                                            <div className="text-center">
                                                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">OU</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Nome da Instância (Opcional)"
                                                value={evolutionConfig.instanceName}
                                                onChange={e => setEvolutionConfig({ ...evolutionConfig, instanceName: e.target.value })}
                                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg py-2 px-4 text-sm text-center text-zinc-300 focus:border-primary focus:bg-zinc-900/80 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-16 text-center relative z-10">
                                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/20">
                                    <CheckCircle2 size={48} className="text-emerald-500" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">WhatsApp Sincronizado!</h2>
                                <p className="text-emerald-200/60 max-w-sm mx-auto">
                                    O sistema está recebendo mensagens e o Agente IA está ativo para responder.
                                </p>
                                <button
                                    onClick={handleLogout}
                                    className="mt-6 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white border border-red-500 rounded-lg transition-colors text-sm font-bold flex items-center gap-2 mx-auto shadow-lg shadow-red-900/50"
                                >
                                    <Trash2 size={16} /> Desconectar Instância
                                </button>
                            </div>
                        )}

                        {/* Background Decoration */}
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
                    </div>

                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 flex gap-3 items-start">
                        <Cpu className="text-primary mt-1" size={18} />
                        <div>
                            <h4 className="text-sm font-bold text-zinc-300">Automação de Webhook</h4>
                            <p className="text-xs text-zinc-500 mt-1">
                                Ao conectar, o sistema configura automaticamente o Webhook para: <br />
                                <code className="bg-black/40 px-1 rounded text-zinc-400">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook</code>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Information / Instructions */}
                <div className="space-y-6">
                    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/50">
                        <h3 className="text-lg font-bold text-white mb-4">Como funciona?</h3>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-400">1</div>
                                <p className="text-sm text-zinc-400">Ao clicar em <strong>Gerar Conexão</strong>, criamos uma "instância" dedicada na Evolution API.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-400">2</div>
                                <p className="text-sm text-zinc-400">Um QR Code do WhatsApp Web é gerado para você escanear com seu celular.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-400">3</div>
                                <p className="text-sm text-zinc-400">Uma vez conectado, todas as mensagens são enviadas para o Supabase e processadas pela IA.</p>
                            </li>
                        </ul>
                    </div>

                    {settings.model && (
                        <div className="p-6 rounded-2xl border border-purple-900/30 bg-purple-900/5">
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                <Zap size={18} className="text-purple-400" /> Cérebro Ativo
                            </h3>
                            <p className="text-sm text-zinc-400 mb-4">
                                O agente está configurado para responder usando o modelo <strong>{settings.model}</strong>.
                            </p>
                            <div className="flex gap-2 text-xs">
                                <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">Respostas Rápidas</span>
                                <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">Contexto do CRM</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
