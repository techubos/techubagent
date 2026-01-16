import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface SyncHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (instanceName: string) => Promise<void>;
}

export const SyncHistoryModal: React.FC<SyncHistoryModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [connections, setConnections] = useState<{ id: string; instance_name: string; phone_number: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchConnections();
        }
    }, [isOpen]);

    const fetchConnections = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('connections')
            .select('id, instance_name, phone_number')
            .eq('status', 'connected');
        setConnections(data || []);
        setLoading(false);
    };

    const handleSync = async (instanceName: string) => {
        setSyncing(true);
        try {
            await onConfirm(instanceName);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setSyncing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-zinc-900 w-full max-w-md rounded-2xl border border-zinc-800 p-6 shadow-2xl relative">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <RefreshCw size={20} className="text-primary" /> Sincronizar Histórico
                </h3>
                <p className="text-zinc-400 text-sm mb-6">
                    Selecione de qual conexão do WhatsApp você deseja puxar as mensagens antigas deste contato.
                </p>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="animate-spin text-zinc-500" />
                    </div>
                ) : connections.length === 0 ? (
                    <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm">
                        Nenhuma conexão ativa encontrada. Conecte um WhatsApp primeiro.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {connections.map((conn) => (
                            <button
                                key={conn.id}
                                onClick={() => handleSync(conn.instance_name)}
                                disabled={syncing}
                                className="w-full flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-primary/50 hover:bg-zinc-900 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Smartphone size={18} className="text-zinc-400 group-hover:text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-white font-medium text-sm">{conn.instance_name}</div>
                                        <div className="text-zinc-500 text-xs">{conn.phone_number || 'Sem número'}</div>
                                    </div>
                                </div>
                                {syncing ? <Loader2 size={16} className="animate-spin text-primary" /> : <div className="text-xs font-bold text-zinc-600 group-hover:text-primary uppercase tracking-wider">Selecionar</div>}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        disabled={syncing}
                        className="px-4 py-2 text-zinc-500 hover:text-white text-sm font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
