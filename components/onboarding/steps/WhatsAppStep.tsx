import React, { useState, useEffect } from 'react';
import { fetchQRCode, checkInstanceStatus, EvolutionSettings } from '../../../services/evolutionService';
import { QrCode, RefreshCw, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export function WhatsAppStep({ onConnect }: { onConnect: (status: boolean) => void }) {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<'loading' | 'qr' | 'connected' | 'error'>('loading');
    const [instanceName] = useState(`org_${Math.random().toString(36).substring(7)}`);

    const config: EvolutionSettings = {
        instanceName,
        serverUrl: '', // Handled by gateway
        apiKey: ''     // Handled by gateway
    };

    const loadQR = async () => {
        setStatus('loading');
        try {
            const data = await fetchQRCode(config);
            if (data?.base64) {
                setQrCode(data.base64);
                setStatus('qr');
            } else {
                throw new Error("QR Code não recebido");
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            toast.error("Falha ao gerar QR Code");
        }
    };

    useEffect(() => {
        loadQR();
    }, []);

    useEffect(() => {
        let interval: any;
        if (status === 'qr') {
            interval = setInterval(async () => {
                try {
                    const res = await checkInstanceStatus(config);
                    if (res?.status === 'open') {
                        setStatus('connected');
                        onConnect(true);
                        clearInterval(interval);
                        toast.success("WhatsApp conectado com sucesso!");
                    }
                } catch (e) {
                    console.error("Polling error:", e);
                }
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [status]);

    return (
        <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">Conectar WhatsApp</h2>
            <p className="text-zinc-500 text-sm mb-8 font-medium italic">Abra o WhatsApp > Configurações > Dispositivos Conectados</p>

            <div className="relative w-64 h-64 bg-zinc-900 border border-white/5 rounded-[2rem] flex items-center justify-center p-4 shadow-2xl overflow-hidden group">
                {status === 'loading' && (
                    <div className="flex flex-col items-center gap-4">
                        <RefreshCw size={48} className="text-primary animate-spin" />
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Iniciando Instância...</span>
                    </div>
                )}

                {status === 'qr' && qrCode && (
                    <div className="relative w-full h-full flex flex-col items-center gap-2">
                        <img src={qrCode} alt="WhatsApp QR Code" className="w-full h-full rounded-2xl grayscale hover:grayscale-0 transition-all duration-500" />
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <QrCode size={48} className="text-primary" />
                        </div>
                    </div>
                )}

                {status === 'connected' && (
                    <div className="flex flex-col items-center gap-4 text-primary animate-in zoom-in duration-500">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                            <CheckCircle2 size={48} />
                        </div>
                        <span className="text-sm font-black uppercase tracking-widest">Conectado!</span>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center gap-4 text-red-500">
                        <AlertCircle size={48} />
                        <button onClick={loadQR} className="text-[10px] font-black uppercase tracking-widest border border-red-500/20 px-4 py-2 rounded-full hover:bg-red-500/10 transition-all">
                            Tentar Novamente
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-12 flex items-center gap-6 bg-white/5 p-4 rounded-3xl border border-white/5">
                <Smartphone size={32} className="text-zinc-600" />
                <div className="text-left">
                    <p className="text-white text-xs font-bold mb-1">Dica de Segurança</p>
                    <p className="text-zinc-500 text-[10px] leading-relaxed max-w-[200px]">Sua conexão é criptografada. Recomendamos desativar o modo de economia de energia no celular.</p>
                </div>
            </div>
        </div>
    );
}
