import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ViewState, AgentSettings } from './types';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { useAuth } from './contexts/AuthProvider';
import { Loader2, AlertTriangle, FileJson, Copy, Check, ShieldCheck } from 'lucide-react';
import { fetchAgentSettings, saveAgentSettings } from './services/settingsService';
import { useAgentSettings } from './features/settings/api/useAgentSettings';
import { AppErrorBoundary } from './components/AppErrorBoundary';
// Query Client moved to index.tsx

// Lazy Imports para Performance (Code Splitting)
const ErrorFallback = () => <div className="p-8 text-center text-red-500 bg-background h-full flex flex-col items-center justify-center">
    <AlertTriangle size={48} className="mb-4" />
    <h2 className="text-xl font-bold">Erro ao carregar módulo</h2>
    <p className="text-sm text-zinc-400 mt-2">Tente recarregar a página.</p>
</div>;

// Lazy Imports com Proteção contra Falhas (Explicit & Typed)
// Lazy Imports com Proteção contra Falhas (Explicit & Typed)
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard }))); // Typed import
const ChatConsole = lazy(() => import('./pages/ChatConsole').then(module => ({ default: module.ChatConsole })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings }))); // Typed

const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase').then(module => ({ default: module.KnowledgeBase })));
const IntegrationGuide = lazy(() => import('./pages/IntegrationGuide').then(module => ({ default: module.IntegrationGuide })));
const AuditDashboard = lazy(() => import('./pages/AuditDashboard').then(module => ({ default: module.AuditDashboard })));
const SaaSAdmin = lazy(() => import('./pages/SaaSAdmin').then(module => ({ default: module.SaaSAdmin })));
const AgentManager = lazy(() => import('./pages/AgentManager').then(module => ({ default: module.AgentManager })));
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditor').then(module => ({ default: module.WorkflowEditor })));
const ArchitectureGuide = lazy(() => import('@/pages/ArchitectureGuide').then(module => ({ default: (module as any).default || (module as any).ArchitectureGuide })).catch(err => { console.error("Error loading ArchitectureGuide", err); return { default: ErrorFallback }; }));
const CRM = lazy(() => import('./pages/CRM').then(module => ({ default: module.CRM }))); // Typed
const PlaybookManager = lazy(() => import('@/pages/PlaybookManager').then(module => ({ default: (module as any).default || (module as any).PlaybookManager })).catch(err => { console.error("Error loading PlaybookManager", err); return { default: ErrorFallback }; }));
const Automations = lazy(() => import('@/pages/Automations').then(module => ({ default: (module as any).default || (module as any).Automations })).catch(err => { console.error("Error loading Automations", err); return { default: ErrorFallback }; }));
const Broadcasts = lazy(() => import('@/pages/Broadcasts').then(module => ({ default: (module as any).default || (module as any).Broadcasts })).catch(err => { console.error("Error loading Broadcasts", err); return { default: ErrorFallback }; }));
const Login = lazy(() => import('@/pages/Login').then(module => ({ default: (module as any).default || (module as any).Login })).catch(err => { console.error("Error loading Login", err); return { default: ErrorFallback }; }));
const Agents = lazy(() => import('@/pages/Agents').then(module => ({ default: (module as any).default || (module as any).Agents })).catch(err => { console.error("Error loading Agents", err); return { default: ErrorFallback }; }));
const Experiments = lazy(() => import('@/pages/Experiments').then(module => ({ default: (module as any).default || (module as any).Experiments })).catch(err => { console.error("Error loading Experiments", err); return { default: ErrorFallback }; }));
const Prospecting = lazy(() => import('@/pages/Prospecting').then(module => ({ default: (module as any).default || (module as any).Prospecting })).catch(err => { console.error("Error loading Prospecting", err); return { default: ErrorFallback }; }));
const ProspectingCampaigns = lazy(() => import('@/pages/ProspectingCampaigns').then(module => ({ default: (module as any).default || (module as any).ProspectingCampaigns })).catch(err => { console.error("Error loading ProspectingCampaigns", err); return { default: ErrorFallback }; }));
const LiveChat = lazy(() => import('@/pages/LiveChat').then(module => ({ default: (module as any).default || (module as any).LiveChat })).catch(err => { console.error("Error loading LiveChat", err); return { default: ErrorFallback }; }));
const TeamManagement = lazy(() => import('@/pages/TeamManagement').then(module => ({ default: (module as any).default || (module as any).TeamManagement })).catch(err => { console.error("Error loading TeamManagement", err); return { default: ErrorFallback }; }));
const Guardian = lazy(() => import('@/pages/Guardian').then(module => ({ default: (module as any).default || (module as any).Guardian })).catch(err => { console.error("Error loading Guardian", err); return { default: ErrorFallback }; }));
const Analytics = lazy(() => import('@/pages/Analytics').then(module => ({ default: (module as any).default || (module as any).Analytics })).catch(err => { console.error("Error loading Analytics", err); return { default: ErrorFallback }; }));
const InternalChat = lazy(() => import('./pages/InternalChat').then(module => ({ default: module.InternalChat })));
const HelpCenter = lazy(() => import('./pages/HelpCenter').then(module => ({ default: module.HelpCenter })));
const DatabaseManager = lazy(() => import('./pages/DatabaseManager').then(module => ({ default: module.DatabaseManager })));
const CalendarPage = lazy(() => import('./pages/Calendar').then(module => ({ default: module.CalendarPage })));
const AIConfigAdvanced = lazy(() => import('./pages/AIConfigAdvanced').then(module => ({ default: module.AIConfigAdvanced })));
const QuickResponses = lazy(() => import('./pages/QuickResponses').then(module => ({ default: module.QuickResponses })));
const IntelligenceBI = lazy(() => import('@/pages/IntelligenceBI').then(module => ({ default: (module as any).default || (module as any).IntelligenceBI })).catch(err => { console.error("Error loading IntelligenceBI", err); return { default: ErrorFallback }; }));
const Sequences = lazy(() => import('@/pages/Sequences').then(module => ({ default: (module as any).default || (module as any).Sequences })).catch(err => { console.error("Error loading Sequences", err); return { default: ErrorFallback }; }));
const Flows = lazy(() => import('@/pages/Flows').then(module => ({ default: (module as any).default || (module as any).Flows })).catch(err => { console.error("Error loading Flows", err); return { default: ErrorFallback }; }));

// PROMPT GENÉRICO (Fallback de Segurança)
const DEFAULT_SYSTEM_PROMPT = `
Você é um assistente da TecHub. 
Seu objetivo é ajudar o cliente de forma profissional e concisa.
Aguarde as instruções de personalidade do servidor.
`;


const App: React.FC = () => {
    const { session, profile, loading: authLoading } = useAuth();
    const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [navData, setNavData] = useState<any>(null);

    // Auto-expand sidebar when leaving CRM
    useEffect(() => {
        if (currentView !== ViewState.CRM) {
            setIsSidebarCollapsed(false);
        }
    }, [currentView]);

    // Lifted state for settings (Persistent) via React Query
    const { settings, isLoading: settingsLoading, updateSettings } = useAgentSettings({
        name: 'Ana (TecHub)',
        model: 'gpt-4o-mini',
        temperature: 0.3,
        systemPrompt: DEFAULT_SYSTEM_PROMPT.trim(),
        apiKeys: {}
    });

    const agentSettings = settings || {
        name: 'Ana (TecHub)',
        model: 'gpt-4o-mini',
        temperature: 0.3,
        systemPrompt: DEFAULT_SYSTEM_PROMPT.trim(),
        apiKeys: {}
    };

    const handleSaveSettings = async (newSettings: AgentSettings) => {
        await updateSettings(newSettings);
    };



    // 0. Verifica configuração crítica (Renderização Condicional Segura)
    if (!isSupabaseConfigured) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-white">
                <div className="max-w-xl w-full bg-surface border border-border rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center gap-3 text-red-500 mb-6">
                        <AlertTriangle size={32} />
                        <h1 className="text-2xl font-bold">Configuração Necessária</h1>
                    </div>

                    <p className="text-zinc-400 mb-6">
                        O aplicativo não encontrou as chaves de conexão com o Supabase.
                        Sem isso, o sistema não pode funcionar.
                    </p>

                    <div className="space-y-4">
                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                            <div className="flex items-center gap-2 mb-2 text-emerald-400 text-sm font-bold">
                                <FileJson size={16} />
                                <span>Passo 1: Crie o arquivo .env.local</span>
                            </div>
                            <p className="text-xs text-zinc-500 mb-2">Na pasta raiz do projeto, crie um arquivo chamado <code>.env.local</code></p>
                        </div>

                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                            <div className="flex items-center gap-2 mb-2 text-blue-400 text-sm font-bold">
                                <Copy size={16} />
                                <span>Passo 2: Adicione as Chaves</span>
                            </div>
                            <code className="block bg-black p-3 rounded text-xs font-mono text-zinc-300 overflow-x-auto">
                                VITE_SUPABASE_URL=sua_url_aqui<br />
                                VITE_SUPABASE_ANON_KEY=sua_chave_aqui
                            </code>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-primary text-zinc-900 font-bold rounded-lg hover:bg-primaryHover transition-colors"
                        >
                            Já configurei, recarregar página
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Preload critical views for snappier transitions
    useEffect(() => {
        const preload = async () => {
            // Lazy imports are functions that return a promise of the module
            // We can call them to start the download early
            const dashboard = import('./pages/Dashboard');
            const crm = import('./pages/CRM');
            await Promise.allSettled([dashboard, crm]);
        };
        if (session) preload();
    }, [session]);

    // Fast Auth Check: If we have a session, we can start rendering the layout
    // We only show the splash screen if we have NO session AND auth is still loading.
    // If we have a session, we want to show the app layout immediately.
    const isActuallyLoading = authLoading && !session;

    // Se estiver carregando auth e não tivermos sessão (Splash de Inicialização)
    if (isActuallyLoading) {
        return (
            <div className="h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center gap-6">
                <div className="mesh-bg opacity-30" />
                <div className="blob" style={{ top: '-10%', left: '-10%' }} />
                <div className="blob" style={{ bottom: '-10%', right: '-10%', animationDelay: '-10s' }} />

                <div className="relative">
                    <img src="/techub_robot_logo.png" className="w-20 h-20 relative z-10" alt="Logo" />
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                </div>

                <div className="flex flex-col items-center gap-2 relative z-10">
                    <div className="text-white font-black text-xl tracking-widest uppercase">TecHub<span className="text-primary italic">Agent</span></div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-surface/40 backdrop-blur-xl border border-white/5 rounded-full shadow-2xl">
                        <Loader2 className="animate-spin text-primary" size={16} />
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                            Iniciando Turbinas...
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // Se não estiver logado, mostra Login
    if (!session) {
        return (
            <Suspense fallback={<div className="h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
                <Login />
            </Suspense>
        );
    }

    const renderView = () => {
        switch (currentView) {
            case ViewState.DASHBOARD:
                return <Dashboard />;
            case ViewState.CRM:
                return <CRM onSidebarToggle={setIsSidebarCollapsed} />;
            case ViewState.BROADCASTS:
                return <Broadcasts />;
            case ViewState.CHAT_SIMULATOR:
                return <ChatConsole settings={agentSettings} />;
            case ViewState.PLAYBOOKS:
                return <PlaybookManager />;
            case ViewState.AGENTS:
                return <AgentManager organizationId={profile?.organization_id || ''} />;
            case ViewState.AUTOMATIONS:
                return <Automations />;
            case ViewState.SETTINGS:
                return <Settings settings={agentSettings} onSave={handleSaveSettings} />;
            case ViewState.KNOWLEDGE:
                return <KnowledgeBase initialData={navData} onClearData={() => setNavData(null)} />;
            // Roadmap removed
            case ViewState.INTEGRATION:
                return <IntegrationGuide settings={agentSettings} />;
            case ViewState.EXPERIMENTS:
                return <Experiments />;
            case ViewState.LIVE_CHAT:
                return <LiveChat />;
            case ViewState.INTERNAL_CHAT:
                return <InternalChat />;
            case ViewState.HELP_CENTER:
                return <HelpCenter />;
            case ViewState.DATABASE_MANAGER:
                return <DatabaseManager />;
            case ViewState.SCHEDULING:
                return <CalendarPage />;
            case ViewState.QUICK_RESPONSES:
                return <QuickResponses />;
            case ViewState.TEAM:
                return <TeamManagement />;
            case ViewState.GUARDIAN:
                return <Guardian />;
            case ViewState.ANALYTICS:
                return <Analytics />;
            case ViewState.INTELLIGENCE_BI:
                return <IntelligenceBI />;
            case ViewState.SEQUENCES:
                return <Sequences />;
            case ViewState.FLOWS:
                return <Flows />;
            case ViewState.WORKFLOW_EDITOR: // Added WorkflowEditor case
                return <WorkflowEditor />;
            case ViewState.AUDIT:
                return <AuditDashboard onNavigate={(data) => {
                    setNavData(data);
                    setCurrentView(ViewState.KNOWLEDGE);
                }} />;
            case ViewState.SAAS_ADMIN:
                return <SaaSAdmin />;
            case ViewState.GUIDE:
                return <ArchitectureGuide />;
            case ViewState.PROSPECTING:
                return <Prospecting />;
            case ViewState.PROSPECTING_CAMPAIGNS:
                return <ProspectingCampaigns />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <AppErrorBoundary>
            <Toaster position="top-right" richColors />
            <Routes>
                {/* Full Screen Workflow Editor Route */}
                <Route path="/workflow/:id" element={
                    <Suspense fallback={<div className="h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
                        <WorkflowEditor />
                    </Suspense>
                } />

                {/* Main Application Route */}
                <Route path="/*" element={
                    <Layout currentView={currentView} setView={setCurrentView} isCollapsed={isSidebarCollapsed} userRole={profile?.role}>
                        <Suspense fallback={<div className="h-full flex items-center justify-center p-10"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
                            {renderView()}
                        </Suspense>
                    </Layout>
                } />
            </Routes>
        </AppErrorBoundary>
    );
};

export default App;