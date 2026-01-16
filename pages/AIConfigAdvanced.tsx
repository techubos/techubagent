import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    MessageSquare,
    BrainCircuit,
    GitFork,
    Database,
    Settings,
    Save,
    Play,
    Loader2,
    ChevronRight,
    Bot
} from 'lucide-react';
import { Button } from '../components/ui/index';
import { toast } from 'sonner';

// Config Components
import { PersonalityConfig } from './components/PersonalityConfig';
import { RulesBuilder } from './components/RulesBuilder';
import { MemorySettings } from './components/MemorySettings';
import { WorkflowBuilder } from './components/WorkflowBuilder';
import { AgentPreview } from './components/AgentPreview';
import { BehaviorConfig } from './components/BehaviorConfig';

// Breadcrumb simple component
const Breadcrumb = ({ children }: any) => <div className="flex items-center text-sm text-zinc-500 mb-1">{children}</div>;
const BreadcrumbItem = ({ children }: any) => <span className="flex items-center hover:text-zinc-300 transition-colors after:content-['/'] after:mx-2 after:text-zinc-700 last:after:content-none">{children}</span>;

export function AIConfigAdvanced({ organizationId, agentId }: { organizationId: string, agentId: string }) {
    const [activeSection, setActiveSection] = useState('personality');
    const [showPreview, setShowPreview] = useState(true);
    const [saving, setSaving] = useState(false);

    const sections = [
        { id: 'personality', title: 'Personalidade', icon: <Bot size={18} />, description: 'Tom de voz e instruções' },
        { id: 'behavior', title: 'Comportamento', icon: <Settings size={18} />, description: 'Velocidade, modelo e respostas' },
        { id: 'rules', title: 'Regras de Negócio', icon: <BrainCircuit size={18} />, description: 'Gatilhos e automações' },
        { id: 'workflows', title: 'Fluxos de Conversa', icon: <GitFork size={18} />, description: 'Sequências passo-a-passo' },
        { id: 'memory', title: 'Memória & Contexto', icon: <Database size={18} />, description: 'O que a IA sabe' },
    ];

    const renderSection = () => {
        switch (activeSection) {
            case 'personality': return <PersonalityConfig organizationId={organizationId} agentId={agentId} />;
            case 'behavior': return <BehaviorConfig organizationId={organizationId} agentId={agentId} />; // New Component
            case 'rules': return <RulesBuilder organizationId={organizationId} agentId={agentId} />;
            case 'workflows': return <WorkflowBuilder organizationId={organizationId} agentId={agentId} />;
            case 'memory': return <MemorySettings organizationId={organizationId} agentId={agentId} />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-50">
            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <Breadcrumb>
                            <BreadcrumbItem>Configurações</BreadcrumbItem>
                            <BreadcrumbItem>Agente de IA</BreadcrumbItem>
                        </Breadcrumb>
                        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                            <Bot className="text-primary" />
                            Configurar Agente
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                            onClick={() => setShowPreview(!showPreview)}
                        >
                            {showPreview ? 'Ocultar Preview' : 'Mostrar Preview'}
                        </Button>

                        {/* Generic Save Button (Ideally triggers save in children, using Context effectively in real app) */}
                        {/* For visual layout purpose, acts as primary action */}
                        <Button disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Alterações
                        </Button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-12 gap-8">
                    {/* Sidebar */}
                    <nav className="col-span-12 md:col-span-3">
                        <div className="sticky top-28 space-y-1">
                            {sections.map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 border
                                        ${activeSection === section.id
                                            ? 'bg-zinc-900 border-primary/20 text-white shadow-lg shadow-black/20'
                                            : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'}
                                    `}
                                >
                                    <div className={`${activeSection === section.id ? 'text-primary' : 'text-zinc-500'}`}>
                                        {section.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{section.title}</div>
                                        <div className="text-xs text-zinc-500 line-clamp-1">{section.description}</div>
                                    </div>
                                    {activeSection === section.id && (
                                        <motion.div layoutId="active-indicator" className="w-1 h-8 bg-primary absolute left-0 rounded-r-full" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </nav>

                    {/* Main Content */}
                    <main className={`col-span-12 ${showPreview ? 'md:col-span-6' : 'md:col-span-9'}`}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeSection}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                                className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-6 min-h-[500px]"
                            >
                                {renderSection()}
                            </motion.div>
                        </AnimatePresence>
                    </main>

                    {/* Preview Panel - Conditional */}
                    <AnimatePresence>
                        {showPreview && (
                            <motion.aside
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="col-span-12 md:col-span-3 relative"
                            >
                                <div className="sticky top-28">
                                    <div className="text-sm font-medium text-zinc-400 mb-3 flex items-center justify-between">
                                        <span>Preview Ao Vivo</span>
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        </div>
                                    </div>
                                    <div className="h-[600px] w-full">
                                        <AgentPreview config={{}} />
                                    </div>
                                </div>
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
