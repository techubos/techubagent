
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class CRMErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error in CRM:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-zinc-900/50 rounded-xl border border-red-900/50">
                    <div className="bg-red-500/10 p-4 rounded-full mb-4">
                        <AlertTriangle className="text-red-500" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Algo deu errado no CRM</h2>
                    <p className="text-zinc-400 mb-6 max-w-md">
                        Um erro inesperado ocorreu. Tente recarregar o componente.
                    </p>

                    {this.state.error && (
                        <pre className="bg-black/50 p-4 rounded text-xs text-red-300 font-mono mb-6 max-w-lg overflow-auto text-left w-full border border-red-900/30">
                            {this.state.error.message}
                        </pre>
                    )}

                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="flex items-center gap-2 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700"
                    >
                        <RefreshCcw size={16} />
                        Tentar Novamente
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
