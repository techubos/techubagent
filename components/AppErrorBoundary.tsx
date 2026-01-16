import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class AppErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };


    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('CRITICAL APP ERROR:', error, errorInfo);
    }

    private handleReset = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-screen bg-background flex items-center justify-center p-6 text-zinc-100 font-sans">
                    <div className="max-w-md w-full bg-[#18181b] rounded-2xl border border-zinc-800 p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                            <AlertTriangle size={32} />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold">Algo não deu certo</h2>
                            <p className="text-sm text-zinc-400">
                                Ocorreu uma falha inesperada na interface. Mas não se preocupe, seus dados estão seguros no servidor.
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="p-3 bg-black/40 rounded-lg text-xs font-mono text-zinc-500 border border-zinc-800 text-left overflow-x-auto max-h-32">
                                {this.state.error.message}
                            </div>
                        )}

                        <div className="flex flex-col gap-2 pt-4">
                            <button
                                onClick={this.handleReset}
                                className="w-full bg-primary text-zinc-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primaryHover transition-all active:scale-95"
                            >
                                <RefreshCw size={18} />
                                Reiniciar Dashboard
                            </button>

                            <a
                                href="/"
                                className="text-zinc-500 text-xs hover:text-zinc-300 flex items-center justify-center gap-1 transition-colors"
                            >
                                <Home size={12} />
                                Voltar ao Início
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
