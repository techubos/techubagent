
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { LayoutGrid, ShieldAlert, Loader2, Database, Key } from 'lucide-react';

interface CRMGuardProps {
    children: React.ReactNode;
}

export const CRMGuard: React.FC<CRMGuardProps> = ({ children }) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorDetail, setErrorDetail] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<'auth' | 'database' | 'network' | null>(null);

    useEffect(() => {
        const validateEnvironment = async () => {
            try {
                // 1. Verificar Autenticação
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    setErrorType('auth');
                    setErrorDetail('Usuário não autenticado ou sessão expirada.');
                    setStatus('error');
                    return;
                }

                // 2. Verificar Perfil e Organização
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();

                if (profileError || !profile?.organization_id) {
                    setErrorType('database');
                    setErrorDetail('Seu perfil não possui uma organização vinculada ou o acesso foi negado (RLS).');
                    setStatus('error');
                    return;
                }

                // 3. Teste de Voo (Sanity Check nas tabelas principais)
                const { error: contactsError } = await supabase
                    .from('contacts')
                    .select('id')
                    .limit(1);

                if (contactsError) {
                    setErrorType('database');
                    setErrorDetail(`Falha ao acessar os dados: ${contactsError.message}`);
                    setStatus('error');
                    return;
                }

                setStatus('ready');
            } catch (err: any) {
                console.error('CRM Guard Error:', err);
                setErrorType('network');
                setErrorDetail(err.message || 'Erro inesperado na validação do ambiente.');
                setStatus('error');
            }
        };

        validateEnvironment();
    }, []);

    if (status === 'loading') {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-950 p-8">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                    <Loader2 className="animate-spin text-primary relative z-10" size={48} />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">PROTEÇÃO CRM</h2>
                <p className="text-zinc-500 text-sm mt-2 uppercase tracking-widest font-bold opacity-60">Validando integridade do ambiente...</p>
            </div>
        );
    }

    if (status === 'error') {
        const icons = {
            auth: Key,
            database: Database,
            network: ShieldAlert
        };
        const Icon = icons[errorType || 'network'];

        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-950 p-8 text-center">
                <div className="bg-red-500/10 p-6 rounded-3xl border border-red-500/20 mb-6 group">
                    <Icon className="text-red-500 group-hover:scale-110 transition-transform" size={40} />
                </div>
                <h2 className="text-2xl font-black text-white mb-2 tracking-tighter uppercase">
                    Cerca de Proteção <span className="text-red-500">Ativada</span>
                </h2>
                <p className="text-zinc-400 mb-8 max-w-md font-medium">
                    O CRM foi isolado para evitar o carregamento em um ambiente instável.
                </p>

                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl w-full max-w-lg mb-8 text-left">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Detalhes do Bloqueio</span>
                    </div>
                    <p className="text-sm text-zinc-300 font-mono leading-relaxed">
                        {errorDetail}
                    </p>
                </div>

                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-white text-zinc-950 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all active:scale-95"
                    >
                        Tentar Reconectar
                    </button>
                    <button
                        onClick={() => setStatus('loading')}
                        className="px-6 py-3 bg-zinc-900 text-zinc-400 rounded-xl font-black uppercase text-xs tracking-widest border border-white/5 hover:text-white transition-all"
                    >
                        Re-validar Acesso
                    </button>
                </div>

                <p className="mt-8 text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em]">TecHub Agent Security Guard</p>
            </div>
        );
    }

    return <>{children}</>;
};
