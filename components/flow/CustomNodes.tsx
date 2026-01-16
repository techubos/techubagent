import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot, Zap, Globe, Code2, Play, MessageSquare, AlertTriangle, ScanSearch, Database, Clock } from 'lucide-react';

// --- START NODE ---
export const StartNode = memo(({ data }: NodeProps) => {
    return (
        <div className="bg-emerald-500/10 border-2 border-emerald-500 rounded-full w-16 h-16 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Play size={24} className="text-emerald-500 fill-current" />
            <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-3 !h-3" />
        </div>
    );
});

// --- AGENT NODE ---
export const AgentNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`w-72 bg-zinc-900 border-2 rounded-2xl p-4 shadow-xl transition-all ${selected ? 'border-primary ring-4 ring-primary/10' : 'border-zinc-700 hover:border-zinc-500'}`}>
            <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-3 !h-3" />

            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                    <Bot size={20} className="text-primary" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide">Agente IA</h3>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{data.label as string || 'Instruções do agente...'}</p>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
        </div>
    );
});

// --- DECISION NODE ---
export const DecisionNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`w-72 bg-zinc-900 border-2 rounded-2xl p-4 shadow-xl transition-all ${selected ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}>
            <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-3 !h-3" />

            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                    <Zap size={20} className="text-amber-500" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide">Decisão IA</h3>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{data.label as string || 'Analisar intenção...'}</p>
                </div>
            </div>

            {/* Decision nodes usually have multiple dynamic handles, but for simplicity we start with one output that splits in logic */}
            <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-3 !h-3" />
        </div>
    );
});

// --- MESSAGE NODE ---
export const MessageNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`w-64 bg-zinc-900 border-2 rounded-2xl p-4 shadow-xl transition-all ${selected ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}>
            <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-3 !h-3" />

            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                    <MessageSquare size={16} className="text-blue-500" />
                </div>
                <span className="font-bold text-white text-xs uppercase">Enviar Mensagem</span>
            </div>

            <div className="mt-3 bg-black/40 p-2 rounded text-xs text-zinc-400 font-mono border border-zinc-800">
                "{data.content as string || '...'}"
            </div>

            <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3" />
        </div>
    );
});

// --- SUMMARIZER NODE ---
export const SummarizerNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`w-64 bg-zinc-900 border-2 rounded-2xl p-4 shadow-xl transition-all ${selected ? 'border-purple-500 ring-4 ring-purple-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}>
            <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-3 !h-3" />

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shrink-0">
                    <ScanSearch size={22} className="text-purple-500" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide">Detetive IA</h3>
                    <p className="text-xs text-zinc-500 mt-1">Resumir contexto</p>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-500/20">
                    24h de Histórico
                </span>
                <span className="text-[10px] text-zinc-500">
                    → output.summary
                </span>
            </div>

            <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3" />
        </div>
    );
});

// --- WEBHOOK NODE ---
export const WebhookNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`w-72 bg-zinc-900 border-2 rounded-2xl p-4 shadow-xl transition-all ${selected ? 'border-pink-500 ring-4 ring-pink-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}>
            <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-3 !h-3" />

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 shrink-0">
                    <Globe size={22} className="text-pink-500" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide">Webhook</h3>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{data.label as string || 'Integração HTTP'}</p>
                </div>
            </div>

            <div className="mt-3 bg-black/40 p-2 rounded text-xs text-zinc-400 font-mono border border-zinc-800 flex justify-between items-center">
                <span>{(data.config as any)?.method || 'GET'}</span>
                <span className="opacity-50">{(data.config as any)?.url ? 'Configurado' : 'Sem URL'}</span>
            </div>

            <Handle type="source" position={Position.Right} className="!bg-pink-500 !w-3 !h-3" />
        </div>
    );
});

// --- DATABASE NODE ---
export const DatabaseNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`w-72 bg-zinc-900 border-2 rounded-2xl p-4 shadow-xl transition-all ${selected ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}>
            <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-3 !h-3" />

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shrink-0">
                    <Database size={22} className="text-cyan-500" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide">Banco de Dados</h3>
                    <p className="text-xs text-zinc-500 mt-1">Consultar Dados</p>
                </div>
            </div>

            <div className="mt-3 bg-black/40 p-2 rounded text-xs text-zinc-400 font-mono border border-zinc-800">
                {(data.config as any)?.query_type || 'SELECT'}
            </div>

            <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-3 !h-3" />
        </div>
    );
});

// --- WAIT NODE ---
export const WaitNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`w-40 bg-zinc-900 border-2 rounded-2xl p-3 shadow-xl transition-all ${selected ? 'border-orange-500 ring-4 ring-orange-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}>
            <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-3 !h-3" />

            <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shrink-0">
                    <Clock size={16} className="text-orange-500" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-xs uppercase tracking-wide">Aguardar</h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {(data.config as any)?.duration || '0'} {(data.config as any)?.unit || 'min'}
                    </p>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!bg-orange-500 !w-3 !h-3" />
        </div>
    );
});
