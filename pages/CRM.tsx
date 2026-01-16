import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Contact, CRMColumn } from '../types';
import { CRMKanbanBoard } from '../features/crm/components/CRMKanbanBoard';
import { CRMErrorBoundary } from '../components/CRMErrorBoundary';
import { ChatPanel } from '../components/crm/ChatPanel';
import { CampaignsPanel } from '../components/crm/CampaignsPanel';
import { Loader2, LayoutGrid, List as ListIcon, X, Megaphone, Zap, Bell, User, Users, Search } from 'lucide-react';
import { useContacts } from '../features/crm/api/useContacts';
import { usePipelines } from '../features/crm/api/usePipelines';
import { useMessages } from '../features/crm/api/useMessages';
import { CRMGuard } from '../components/crm/CRMGuard';
import { toast } from 'sonner';
import { Edit2, Check } from 'lucide-react';
import { sendWhatsAppMessage, syncContactHistory } from '../services/evolutionService';
import { ScheduleMessageModal } from '../components/crm/ScheduleMessageModal';
import { SyncHistoryModal } from '../components/crm/SyncHistoryModal';
import { CreateLeadModal } from '../components/crm/CreateLeadModal';
import { TagsManager } from '../components/crm/TagsManager';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeMessage, sanitizePhone } from '../utils/sanitize';
import { ContactSchema, MessageSchema } from '../utils/validation-schemas';
import { SystemHealth } from '../components/crm/SystemHealth';
import { crmService } from '../services/crmService';

export const CRM: React.FC<{ onSidebarToggle?: (collapsed: boolean) => void }> = ({ onSidebarToggle }) => {
    // --- State ---
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    // Debounce search term for server query
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { contacts, isLoading: loadingContacts } = useContacts(debouncedSearch);

    const [viewMode, setViewMode] = useState<'list' | 'board' | 'marketing' | 'tags'>('board');
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const selectedContact = useMemo(() => contacts.find(c => c.id === selectedContactId) || null, [contacts, selectedContactId]);
    const { columns, setColumns } = usePipelines();

    // Messages Hook
    const { messages, isLoading: loadingMessages } = useMessages(selectedContact?.id);

    // Optimized Handlers
    const handleContactClick = React.useCallback((contact: Contact) => {
        setSelectedContactId(contact.id);
    }, []);

    // UI State
    const [isSaving, setIsSaving] = useState(false);

    // Modal States
    const [isBoardModalOpen, setIsBoardModalOpen] = useState(false);
    const [newColumnTitle, setNewColumnTitle] = useState('');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [targetColumnId, setTargetColumnId] = useState<string>('lead');

    // Flow Modal
    const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
    const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
    const [loadingFlows, setLoadingFlows] = useState(false);
    const [autoDraft, setAutoDraft] = useState<boolean>(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    // Sidebar Toggle Effect
    useEffect(() => {
        onSidebarToggle?.(!!selectedContact);
    }, [selectedContact, onSidebarToggle]);

    // Responsive Detection
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth < 1024;
    const [mobileStageFilter, setMobileStageFilter] = useState<string | null>(null);

    // --- Column Editing ---
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [tempColumnTitle, setTempColumnTitle] = useState('');

    const handleRenameColumn = async (columnId: string, newTitle: string) => {
        if (!newTitle.trim()) return;
        const newColumns = columns.map(c => c.id === columnId ? { ...c, title: newTitle } : c);
        setColumns(newColumns); // This now calls the dynamic update from usePipelines
        setEditingColumnId(null);
        toast.success('Fase renomeada');
    };

    // Summarization Logic
    const [isSummarizing, setIsSummarizing] = useState(false);

    const handleSummarize = useCallback(async (contactId: string) => {
        setIsSummarizing(true);
        try {
            const { data, error } = await supabase.functions.invoke('summarize-conversation', {
                body: { contact_id: contactId }
            });
            if (error) throw error;
            toast.success('Resumo gerado');
        } catch (err) {
            console.error('Summarize error:', err);
        } finally {
            setIsSummarizing(false);
        }
    }, []);

    // --- Summarization ---
    // Auto-summarization disabled to prevent loops
    // useEffect(() => {
    //     if (selectedContact && !selectedContact.summary && !isSummarizing) {
    //         handleSummarize(selectedContact.id);
    //     }
    // }, [selectedContact?.id, handleSummarize, isSummarizing]);

    // Filter Logic
    const [showOnlyActionNeeded, setShowOnlyActionNeeded] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active');

    const filteredContacts = React.useMemo(() => {
        let result = contacts;

        // Status Filter (Tab)
        if (activeTab === 'active') {
            result = result.filter(c => c.status !== 'closed' && c.status !== 'archived');
        } else {
            result = result.filter(c => c.status === 'closed');
        }

        if (showOnlyActionNeeded) {
            result = result.filter(c => c.is_unread === true);
        }

        // Local filters for things server doesn't catch easily OR refinement
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.notes?.toLowerCase().includes(lowSearch) ||
                c.tags?.some(tag => tag.toLowerCase().includes(lowSearch)) ||
                // We still check name/phone locally to avoid flash of disappearing content while server fetches
                c.name?.toLowerCase().includes(lowSearch) ||
                c.phone?.includes(searchTerm)
            );
        }
        return result;
    }, [contacts, showOnlyActionNeeded, searchTerm, activeTab]);

    // --- Actions ---

    // Message Sending
    // Message Sending
    const handleSendMessage = useCallback(async (text: string) => {
        if (!selectedContact) return;

        try {
            const cleanText = sanitizeMessage(text);
            if (!cleanText) return;

            setIsSaving(true);
            await crmService.sendMessage(selectedContact.phone, cleanText, selectedContact.id);
            toast.success("Mensagem enviada!");
        } catch (e: any) {
            console.error("Send Error:", e);
            toast.error("Erro ao enviar: " + (e.message || "Erro desconhecido"));
        } finally {
            setIsSaving(false);
        }
    }, [selectedContact]);

    // Contact Updates
    const handleUpdateContact = useCallback(async (updates: Partial<Contact>) => {
        if (!selectedContact) return;
        try {
            const { error } = await supabase.from('contacts').update(updates).eq('id', selectedContact.id);
            if (error) throw error;
        } catch (e: unknown) {
            console.error("Update error:", e);
        }
    }, [selectedContact]);

    // Create Logic

    const handleCreateColumn = () => {
        if (!newColumnTitle) return;
        const id = newColumnTitle.toLowerCase().replace(/\s/g, '_');
        setColumns([...columns, { id, title: newColumnTitle, color: 'border-l-gray-500' }]);
        setNewColumnTitle('');
        setIsBoardModalOpen(false);
    };

    const handleCreateContact = async () => {
        setIsContactModalOpen(true);
    };

    // Sync & Memory
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

    const handleSyncClick = useCallback(() => {
        setIsSyncModalOpen(true);
    }, []);

    const handleConfirmSync = useCallback(async (instanceName: string) => {
        if (!selectedContact) return;
        setIsSaving(true);
        try {
            // Call Service Wrapper (Centralized)
            const data = await syncContactHistory(selectedContact.id, selectedContact.phone, instanceName);

            if (data.success) {
                toast.success(`Histórico sincronizado: ${data.total_found} msgs`);
                // Force reload messages logic here if needed
                queryClient.invalidateQueries({ queryKey: ['messages', selectedContact.id] });
            } else {
                toast.success(`${data.total_found} mensagens sincronizadas.`);
            }

        } catch (e: any) {
            console.error(e);
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    }, [selectedContact, queryClient]);

    const handleExtractMemories = useCallback(async () => {
        if (!selectedContact) return;
        setIsSaving(true);
        try {
            const { data: msgs } = await supabase.from('messages').select('id, role, content, created_at').eq('contact_id', selectedContact.id).order('created_at', { ascending: false }).limit(20);
            if (!msgs) return;

            await supabase.functions.invoke('extract-memory', {
                body: { contactId: selectedContact.id, messageId: msgs[0].id, conversationHistory: msgs.reverse() }
            });
            toast.success("Memória atualizada.");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    }, [selectedContact]);

    const handleAddInternalNote = useCallback(async (note: string) => {
        if (!selectedContact) return;
        await crmService.sendMessage(selectedContact.phone, `[Nota Interna]: ${note}`, selectedContact.id);
    }, [selectedContact]);

    const handleRunAudit = useCallback(async () => {
        toast.info("Auditoria iniciada...");
    }, []);

    const fetchFlows = useCallback(async () => {
        setLoadingFlows(true);
        try {
            const { data } = await supabase.from('flows').select('id, name').eq('is_active', true).order('name');
            setFlows(data || []);
        } finally {
            setLoadingFlows(false);
        }
    }, []);

    const handleStartFlow = useCallback(() => {
        setIsFlowModalOpen(true);
        fetchFlows();
    }, [fetchFlows]);

    const handleConfirmStartFlow = useCallback(async (flowId: string) => {
        if (!selectedContact) return;
        setIsSaving(true);
        try {
            await supabase.from('contacts').update({ current_flow_id: flowId, current_node_id: null }).eq('id', selectedContact.id);
            toast.success("Fluxo iniciado! A IA irá processar em breve.");
            setIsFlowModalOpen(false);
            await supabase.functions.invoke('flow-engine', {
                body: { contactId: selectedContact.id, flowId, currentNodeId: null, message: '' }
            });
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setIsSaving(false);
        }
    }, [selectedContact]);

    const handleSaveFeedback = useCallback(async (messageId: string, rating: 1 | -1, correction?: string) => {
        if (!selectedContact) return;
        try {
            await supabase.from('ai_feedback').insert({
                message_id: messageId,
                contact_id: selectedContact.id,
                rating,
                corrected_content: correction,
                user_id: (await supabase.auth.getUser()).data.user?.id
            });
            toast.success("Feedback enviado!");
        } catch (e: unknown) {
            console.error("Feedback error:", e);
        }
    }, [selectedContact]);

    const handleOpenSchedule = useCallback(() => {
        setIsScheduleModalOpen(true);
    }, []);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background selection:bg-primary/30 selection:text-white">
            {/* --- High-End Transparent Header --- */}
            <header className="shrink-0 z-30 relative px-6 py-4 flex items-center justify-between border-b border-white/[0.03] bg-zinc-950/20 backdrop-blur-md">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black tracking-tighter text-white">
                                CRM<span className="text-primary ml-1">WORKSTATION</span> <span className="text-xs text-zinc-600 ml-1">v2.1</span>
                            </h2>
                            <div className="px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest">PRO</div>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Gestão de Leads de Alta Performance</p>
                    </div>

                    {/* Integrated Premium Search */}
                    {!selectedContact && (
                        <div className="relative group hidden lg:block select-none">
                            <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-primary transition-colors" size={16} />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Filtrar por nome, fone ou tag..."
                                className="relative bg-zinc-900/40 border border-white/5 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:border-primary/50 outline-none w-[320px] backdrop-blur-xl transition-all font-medium placeholder:text-zinc-600 shadow-2xl"
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* System Pulse & Health */}
                    <div className="hidden md:block">
                        <SystemHealth />
                    </div>

                    {/* Mode Switcher */}
                    <nav className="flex bg-zinc-900/50 p-1 rounded-2xl border border-white/5 backdrop-blur-xl">
                        {[
                            { id: 'board', icon: LayoutGrid, label: 'Quadro' },
                            { id: 'list', icon: ListIcon, label: 'Lista' },
                            { id: 'marketing', icon: Megaphone, label: 'Campanhas' },
                            { id: 'tags', icon: Zap, label: 'Tags' }
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setViewMode(mode.id as 'board' | 'list' | 'marketing' | 'tags')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === mode.id
                                    ? 'bg-primary text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <mode.icon size={14} />
                                <span className="hidden xl:inline">{mode.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="h-8 w-px bg-white/5 mx-2 hidden md:block" />

                    <div className="flex items-center gap-3">
                        {/* Quick View Filter */}
                        <button
                            onClick={() => setShowOnlyActionNeeded(!showOnlyActionNeeded)}
                            className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${showOnlyActionNeeded
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                                : 'bg-transparent text-zinc-500 border-white/5 hover:border-zinc-700 hover:text-zinc-300'
                                }`}
                        >
                            <Zap size={14} className={showOnlyActionNeeded ? 'fill-amber-500' : ''} />
                            Ação Pendente
                        </button>


                        {/* User Profile */}
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-white text-sm font-black shadow-lg">
                            <User size={20} className="text-zinc-500" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Stage Selector */}
            {isMobile && !selectedContact && (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-4">
                    <button
                        onClick={() => setMobileStageFilter(null)}
                        className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 border transition-all ${!mobileStageFilter ? 'bg-primary text-black border-primary' : 'bg-surface text-zinc-400 border-border'}`}
                    >
                        TUDO
                    </button>
                    {columns.map(col => (
                        <button
                            key={col.id}
                            onClick={() => setMobileStageFilter(col.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 border transition-all ${mobileStageFilter === col.id ? 'bg-primary text-black border-primary' : 'bg-surface text-zinc-400 border-border'}`}
                        >
                            {col.title.toUpperCase()}
                        </button>
                    ))}
                </div>
            )
            }

            {/* Main Content Area - Absolute Grid for Perfect Fit */}
            <div className="flex-1 w-full h-full relative bg-background flex overflow-hidden">
                <CRMGuard>
                    <CRMErrorBoundary>
                        {viewMode === 'marketing' ? (
                            <div className="w-full h-full p-4">
                                <CampaignsPanel />
                            </div>
                        ) : (
                            <>
                                {/* Left Side: Board/List - Fixed Width or Full Width */}
                                <div className={`h-full border-r border-border bg-background flex flex-col ${selectedContact && !isMobile ? 'w-[320px] lg:w-[380px] shrink-0' : 'flex-1 min-w-0'} ${selectedContact && isMobile ? 'hidden' : 'flex'}`}>
                                    {/* Tabs Ativos / Resolvidos */}
                                    <div className="flex px-4 pt-4 shrink-0">
                                        <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl w-full">
                                            {[
                                                { id: 'active', label: 'Ativos', count: contacts.filter(c => c.status !== 'closed').length },
                                                { id: 'resolved', label: 'Finalizados', count: contacts.filter(c => c.status === 'closed').length }
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTab(tab.id as 'active' | 'resolved')}
                                                    className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                                        ? tab.id === 'active' ? 'bg-primary text-zinc-950 shadow-lg shadow-emerald-900/20' : 'bg-zinc-700 text-white'
                                                        : 'text-zinc-500 hover:text-zinc-300'
                                                        }`}
                                                >
                                                    {tab.label}
                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black ${activeTab === tab.id ? 'bg-black/10' : 'bg-white/5 text-zinc-600'}`}>
                                                        {tab.count}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {loadingContacts ? (
                                        <div className="flex h-full items-center justify-center">
                                            <Loader2 className="animate-spin text-primary" size={32} />
                                        </div>
                                    ) : (contacts.length === 0) ? (
                                        <div className="flex flex-col h-full items-center justify-center p-10 text-center">
                                            <Users className="text-zinc-700 mb-4" size={48} />
                                            <h3 className="text-xl font-bold text-white">Nenhum lead encontrado</h3>
                                            <p className="text-zinc-500 mt-2">Sua base de dados parece estar vazia ou o banco está lento.</p>
                                            <button
                                                onClick={() => window.location.reload()}
                                                className="mt-6 px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-all font-bold text-sm"
                                            >
                                                Forçar Atualização
                                            </button>
                                        </div>
                                    ) : viewMode === 'board' ? (
                                        <CRMKanbanBoard
                                            columns={columns}
                                            contacts={filteredContacts}
                                            onContactClick={handleContactClick}
                                            onAddLead={(columnId) => {
                                                setTargetColumnId(columnId);
                                                setIsContactModalOpen(true);
                                            }}
                                            onRename={handleRenameColumn}
                                            isSidebar={!!selectedContact && !isMobile}
                                        />
                                    ) : (
                                        // List View (Compact)
                                        <div className="h-full overflow-y-auto custom-scrollbar p-2">
                                            <table className="w-full text-left">
                                                <thead className="text-zinc-500 border-b border-zinc-800">
                                                    <tr>
                                                        <th className="p-3">Nome</th>
                                                        <th className="p-3">Status</th>
                                                        <th className="p-3">Score</th>
                                                        <th className="p-3">Telefone</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredContacts.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="p-10 text-center text-zinc-500 font-medium">
                                                                Nenhum lead corresponde aos filtros atuais.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredContacts.map(c => (
                                                            <tr key={c.id} onClick={() => handleContactClick(c)} className="hover:bg-zinc-800 cursor-pointer text-zinc-300 transition-colors">
                                                                <td className="p-3 font-medium text-white">{c.name}</td>
                                                                <td className="p-3 capitalize">{columns.find(col => col.id === c.status)?.title || c.status}</td>
                                                                <td className="p-3 text-primary font-bold">{c.lead_score || 0}</td>
                                                                <td className="p-3">{c.phone}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Chat Panel */}
                                {selectedContact && (
                                    <ChatPanel
                                        contact={selectedContact}
                                        messages={messages}
                                        availableStages={columns.map(c => c.title)}
                                        onClose={() => setSelectedContactId(null)}
                                        onSendMessage={handleSendMessage}

                                        onSyncHistory={handleSyncClick}
                                        onExtractMemories={handleExtractMemories}
                                        onAudit={handleRunAudit}
                                        onUpdateContact={handleUpdateContact}
                                        onAddNote={handleAddInternalNote}
                                        isSaving={isSaving}
                                        isLoadingHistory={loadingMessages}
                                        onStartFlow={handleStartFlow}
                                        autoDraft={autoDraft}
                                        onClearAutoDraft={() => setAutoDraft(false)}
                                        onSaveFeedback={handleSaveFeedback}
                                        onSchedule={handleOpenSchedule}
                                    />
                                )}
                            </>
                        )}
                        {viewMode === 'tags' && (
                            <div className="w-full h-full p-6 bg-zinc-950 overflow-hidden">
                                <TagsManager />
                            </div>
                        )}
                    </CRMErrorBoundary>
                </CRMGuard>
            </div>

            {
                isScheduleModalOpen && selectedContact && (
                    <ScheduleMessageModal
                        contact={selectedContact}
                        onClose={() => setIsScheduleModalOpen(false)}
                    />
                )
            }

            {/* --- Modals (Kept Simplistic for now) --- */}
            {
                isBoardModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-xl p-4">
                        <div className="glass-card w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl premium-border relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                            <h3 className="text-2xl font-black text-white mb-6">Nova Coluna</h3>
                            <input
                                value={newColumnTitle}
                                onChange={e => setNewColumnTitle(e.target.value)}
                                className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all placeholder:text-zinc-600 font-medium"
                                placeholder="Ex: Qualificação IA"
                            />
                            <div className="flex justify-end gap-3 mt-8">
                                <button onClick={() => setIsBoardModalOpen(false)} className="px-6 py-2 text-zinc-500 font-bold hover:text-zinc-300 transition-colors uppercase text-[10px] tracking-widest">Cancelar</button>
                                <button onClick={handleCreateColumn} className="px-8 py-3 bg-primary text-zinc-950 font-black rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all uppercase text-[10px] tracking-widest">Criar Coluna</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modals */}
            <CreateLeadModal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['contacts'] });
                }}
                targetColumnId={targetColumnId}
            />

            <SyncHistoryModal
                isOpen={isSyncModalOpen}
                onClose={() => setIsSyncModalOpen(false)}
                onConfirm={handleConfirmSync}
            />
        </div >
    );
};