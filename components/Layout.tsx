import React from 'react';
import { ViewState } from '../types';
import { supabase } from '../services/supabaseClient';
import { AppErrorBoundary } from './AppErrorBoundary';
import {
  LayoutDashboard,
  MessageSquareText,
  Database,
  Settings,
  BookOpen,
  Bot,
  Menu,
  Users,
  Rocket,
  GitGraph,
  Workflow,
  Radio,
  Code2,
  LogOut,
  Brain,
  Beaker,
  Target,
  Check,
  Zap,
  MessageCircle,
  Shield,
  ShieldAlert,
  Bell,
  AlertTriangle,
  BarChart3,
  GitBranch,
  TrendingUp,
  ClipboardCheck,
  X,
  Calendar,
  PenTool
} from 'lucide-react';

interface LayoutProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  children: React.ReactNode;
  isCollapsed?: boolean;
  userRole?: string;
}

import { ChevronDown, ChevronRight } from 'lucide-react';
import { NotificationContainer } from './NotificationContainer';

const NavItem = ({
  active,
  onClick,
  icon: Icon,
  label,
  collapsed,
  nested = false
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  collapsed?: boolean;
  nested?: boolean;
}) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors rounded-lg mb-1 group relative ${active
      ? 'bg-primary/10 text-primary'
      : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
      } ${collapsed ? 'justify-center px-1' : ''} ${nested && !collapsed ? 'pl-9' : ''}`}
  >
    {/* Active Indicator Removed for cleaner look, or kept subtle */}
    {active && <div className="absolute left-1 top-2 bottom-2 w-0.5 bg-primary rounded-full hidden" />}
    <Icon size={nested ? 18 : 20} className={`${active ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
    {!collapsed && <span className="tracking-tight">{label}</span>}
  </button>
);

const NavGroup = ({
  label,
  icon: Icon,
  children,
  collapsed,
  active = false
}: {
  label: string;
  icon: any;
  children: React.ReactNode;
  collapsed?: boolean;
  active?: boolean;
}) => {
  const [isOpen, setIsOpen] = React.useState(active); // Maintain state if active within

  // Auto-expand if active becomes true externally
  React.useEffect(() => {
    if (active) setIsOpen(true);
  }, [active]);

  if (collapsed) {
    // In collapsed mode, we can either show nothing or just the icon with a tooltip.
    // For now, simpler to just show the icon as a trigger (or maybe just the top level items).
    // A better approach for collapsed submenus is hover-menus, but let's keep it simple: 
    // Just show the Icon which expands effectively via the main sidebar expansion logic? 
    // Or just Hide sub-menus in collapsed mode? 
    // Let's hide the group wrapper visual but show children? No, that messes up structure.
    // Let's render a simple button that re-expands the sidebar if clicked, or just do nothing.
    // Actually, user requested cleanup. Let's make it a simple icon that tooltips the Group Name.
    return (
      <div className="mb-2 flex flex-col items-center gap-1">
        <div className={`p-2 rounded-lg text-zinc-600 hover:text-white transition-colors cursor-pointer relative group/tooltip`} title={label}>
          <Icon size={20} />
        </div>
        {/* We don't render children in fully collapsed mode to keep it clean, unless we want popovers. 
                 But wait, if we hide children, user can't access them. 
                 Standard pattern: Hovering sidebar expands it. 
                 Our sidebar expands on Hover. So this 'collapsed' prop is only true when mouse is OUT.
                 So we don't need to worry about interaction here. Just show the icon.
             */}
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors rounded-lg group ${active ? 'text-zinc-200' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className="stroke-[2.5px] opacity-70 group-hover:opacity-100" />
          <span>{label}</span>
        </div>
        {isOpen ? <ChevronDown size={12} className="opacity-50" /> : <ChevronRight size={12} className="opacity-50" />}
      </button>

      {isOpen && (
        <div className="mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

const LayoutBase: React.FC<LayoutProps> = ({ currentView, setView, children, isCollapsed, userRole }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [hasCriticalLeads, setHasCriticalLeads] = React.useState(false);

  React.useEffect(() => {
    fetchNotificationStatus();
    fetchNotifications();

    // Debounce the fetch to avoid spamming on bulk updates
    let timeout: NodeJS.Timeout;
    const debouncedFetch = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        fetchNotificationStatus();
        fetchNotifications();
      }, 5000); // 5 second throttle for better performance
    };

    const sub = supabase.channel('global_notifications')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'contacts',
        // Only listen for unread or handling mode changes to minimize noise
        filter: 'is_unread=eq.true'
      }, debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, debouncedFetch)
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      clearTimeout(timeout);
    };
  }, []);

  const fetchNotificationStatus = async () => {
    try {
      // 1. Check for critical leads safely
      const { data: critical, error: criticalError } = await supabase
        .from('contacts')
        .select('id')
        .eq('handling_mode', 'human')
        .eq('is_unread', true);

      if (!criticalError) {
        setHasCriticalLeads((critical?.length || 0) > 0);
      }

      // 2. Count unread notifications safely
      const { count, error: notifyError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .is('read_at', null);

      if (!notifyError) {
        setUnreadNotifications(count || 0);
      }
    } catch (err) {
      console.warn("Notification sync failed:", err);
    }
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setNotifications(data || []);
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    fetchNotificationStatus();
    fetchNotifications();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="h-screen w-screen bg-background text-zinc-100 overflow-hidden relative flex">
      <NotificationContainer />
      {/* Background Effects Removed */}

      {/* Sidebar Desktop */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden md:flex flex-col glass-panel border-r border-white/5 z-30 ${isCollapsed && !isHovered ? 'w-20' : 'w-60'
          } ${isCollapsed && isHovered ? 'shadow-[0_0_50px_rgba(0,0,0,0.5)]' : ''}`}
      >
        <div className={`p-4 flex items-center gap-3 border-b border-border ${isCollapsed && !isHovered ? 'justify-center px-2' : ''}`}>
          <div className="p-1.5 rounded-lg shrink-0">
            <img src="/techub_robot_logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          {(!isCollapsed || isHovered) && (
            <div>
              <h1 className="font-bold text-zinc-100 text-lg leading-tight tracking-tight">TecHub Agent</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Workspace</p>
            </div>
          )}
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
          {/* --- GESTÃO (Sempre Aberto / Principal) --- */}
          <div>
            {(!isCollapsed || isHovered) && (
              <div className="flex items-center justify-between px-2 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                {/* Adding dummy spacer or icon for perfect alignment if needed, or just text */}
                <span>Gestão</span>
              </div>
            )}
            <NavItem
              active={currentView === ViewState.DASHBOARD}
              onClick={() => setView(ViewState.DASHBOARD)}
              icon={LayoutDashboard}
              label="Dashboard"
              collapsed={isCollapsed && !isHovered}
            />
            <NavItem
              active={currentView === ViewState.CRM}
              onClick={() => setView(ViewState.CRM)}
              icon={Users}
              label="CRM Board"
              collapsed={isCollapsed && !isHovered}
            />
            <NavItem
              active={currentView === ViewState.ANALYTICS}
              onClick={() => setView(ViewState.ANALYTICS)}
              icon={BarChart3}
              label="Comandante BI"
              collapsed={isCollapsed && !isHovered}
            />
            <NavItem
              active={currentView === ViewState.INTELLIGENCE_BI}
              onClick={() => setView(ViewState.INTELLIGENCE_BI)}
              icon={TrendingUp}
              label="Inteligência de Funil"
              collapsed={isCollapsed && !isHovered}
            />
          </div>

          {/* --- ATENDIMENTO (Expansível) --- */}
          <NavGroup
            label="Atendimento"
            icon={MessageCircle}
            collapsed={isCollapsed && !isHovered}
            active={['CHAT_SIMULATOR', 'LIVE_CHAT', 'QUICK_RESPONSES', 'SCHEDULING'].includes(ViewState[currentView] as string)}
          >
            <NavItem
              active={currentView === ViewState.CHAT_SIMULATOR}
              onClick={() => setView(ViewState.CHAT_SIMULATOR)}
              icon={MessageSquareText}
              label="Chat Ao Vivo"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <div className="relative">
              <NavItem
                active={currentView === ViewState.LIVE_CHAT}
                onClick={() => setView(ViewState.LIVE_CHAT)}
                icon={MessageCircle}
                label="Atendimento Web"
                collapsed={isCollapsed && !isHovered}
                nested
              />
              {hasCriticalLeads && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full pointer-events-none" />
              )}
            </div>
            <NavItem
              active={currentView === ViewState.QUICK_RESPONSES}
              onClick={() => setView(ViewState.QUICK_RESPONSES)}
              icon={PenTool}
              label="Respostas Rápidas"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.SCHEDULING}
              onClick={() => setView(ViewState.SCHEDULING)}
              icon={Calendar}
              label="Agendamentos"
              collapsed={isCollapsed && !isHovered}
              nested
            />
          </NavGroup>

          {/* --- AUTOMAÇÃO (Expansível) --- */}
          <NavGroup
            label="Automações & IA"
            icon={Bot}
            collapsed={isCollapsed && !isHovered}
            active={['AGENTS', 'FLOWS', 'PLAYBOOKS', 'AUTOMATIONS', 'KNOWLEDGE'].includes(ViewState[currentView] as string)}
          >
            <NavItem
              active={currentView === ViewState.AGENTS}
              onClick={() => setView(ViewState.AGENTS)}
              icon={Brain}
              label="Agentes IA"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.FLOWS}
              onClick={() => setView(ViewState.FLOWS)}
              icon={GitBranch}
              label="Arquiteto de Fluxos"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.PLAYBOOKS}
              onClick={() => setView(ViewState.PLAYBOOKS)}
              icon={GitGraph}
              label="Playbooks"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.AUTOMATIONS}
              onClick={() => setView(ViewState.AUTOMATIONS)}
              icon={Workflow}
              label="Automações"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.KNOWLEDGE}
              onClick={() => setView(ViewState.KNOWLEDGE)}
              icon={Database}
              label="Base de Conhecimento"
              collapsed={isCollapsed && !isHovered}
              nested
            />
          </NavGroup>


          {/* --- GROWTH (Expansível) --- */}
          <NavGroup
            label="Growth & Vendas"
            icon={Rocket}
            collapsed={isCollapsed && !isHovered}
            active={['PROSPECTING', 'PROSPECTING_CAMPAIGNS', 'BROADCASTS', 'SEQUENCES'].includes(ViewState[currentView] as string)}
          >
            <NavItem
              active={currentView === ViewState.PROSPECTING}
              onClick={() => setView(ViewState.PROSPECTING)}
              icon={Target}
              label="Prospecção"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.PROSPECTING_CAMPAIGNS}
              onClick={() => setView(ViewState.PROSPECTING_CAMPAIGNS)}
              icon={Target}
              label="Campanhas"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.BROADCASTS}
              onClick={() => setView(ViewState.BROADCASTS)}
              icon={Radio}
              label="Disparos em Massa"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.SEQUENCES}
              onClick={() => setView(ViewState.SEQUENCES)}
              icon={Zap}
              label="Sequências"
              collapsed={isCollapsed && !isHovered}
              nested
            />
          </NavGroup>

          {/* --- SISTEMA (Expansível) --- */}
          <NavGroup
            label="Sistema"
            icon={Settings}
            collapsed={isCollapsed && !isHovered}
            active={['SETTINGS', 'DATABASE_MANAGER', 'INTEGRATION', 'TEAM', 'AUDIT', 'SAAS_ADMIN'].includes(ViewState[currentView] as string)}
          >
            <NavItem
              active={currentView === ViewState.SETTINGS}
              onClick={() => setView(ViewState.SETTINGS)}
              icon={Settings}
              label="Configurações (API)"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            {userRole === 'owner' && (
              <NavItem
                active={currentView === ViewState.SAAS_ADMIN}
                onClick={() => setView(ViewState.SAAS_ADMIN)}
                icon={Shield}
                label="SaaS Maestro"
                collapsed={isCollapsed && !isHovered}
                nested
              />
            )}
            <NavItem
              active={currentView === ViewState.DATABASE_MANAGER}
              onClick={() => setView(ViewState.DATABASE_MANAGER)}
              icon={Database}
              label="Banco de Dados"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.INTEGRATION}
              onClick={() => setView(ViewState.INTEGRATION)}
              icon={Code2}
              label="Integração WhatsApp"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.TEAM}
              onClick={() => setView(ViewState.TEAM)}
              icon={Users}
              label="Equipe"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.AUDIT}
              onClick={() => setView(ViewState.AUDIT)}
              icon={ClipboardCheck}
              label="Auditoria"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.GUARDIAN}
              onClick={() => setView(ViewState.GUARDIAN)}
              icon={ShieldAlert}
              label="Painel do Guardião"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.GUIDE}
              onClick={() => setView(ViewState.GUIDE)}
              icon={BookOpen}
              label="Documentação"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.HELP_CENTER}
              onClick={() => setView(ViewState.HELP_CENTER)}
              icon={BookOpen}
              label="Central de Ajuda"
              collapsed={isCollapsed && !isHovered}
              nested
            />
            <NavItem
              active={currentView === ViewState.INTERNAL_CHAT}
              onClick={() => setView(ViewState.INTERNAL_CHAT)}
              icon={MessageSquareText}
              label="Chat Interno"
              collapsed={isCollapsed && !isHovered}
              nested
            />
          </NavGroup>

        </div>

        <div className={`p-4 border-t border-border bg-zinc-900/50 ${isCollapsed && !isHovered ? 'flex justify-center' : ''}`}>
          <button
            onClick={handleLogout}
            title={isCollapsed && !isHovered ? "Sair do Sistema" : undefined}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors ${isCollapsed && !isHovered ? 'justify-center p-2' : ''}`}
          >
            <LogOut size={18} />
            {(!isCollapsed || isHovered) && <span>Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative bg-background border-l border-white/5">
        {currentView !== ViewState.CRM && (
          <>
            <header className="hidden md:flex items-center justify-end py-3 px-8 border-b border-border bg-background sticky top-0 z-20 shrink-0 h-[72px]">
              {/* ... existing header content ... */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <button
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className={`relative p-2 transition-colors rounded-lg overflow-hidden hover:bg-surface ${isNotificationsOpen ? 'bg-surface text-white' : 'text-zinc-500 hover:text-white'}`}
                  >
                    <Bell size={20} strokeWidth={1.5} />
                    {unreadNotifications > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center border-2 border-background">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {isNotificationsOpen && (
                    <div className="absolute right-0 mt-4 w-96 glass-card border border-border rounded-xl shadow-2xl z-50">
                      <div className="p-4 border-b border-white/5 flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white tracking-tight">Notificações</h4>
                        <button onClick={markAllRead} className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-primary-hover">Marcar lidas</button>
                      </div>
                      <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-zinc-500 text-center py-8">Nenhuma notificação nova.</p>
                        ) : (
                          notifications.map(notif => (
                            <div key={notif.id} className={`p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group ${!notif.read_at ? 'bg-primary/5' : ''}`}>
                              <p className="text-sm text-zinc-200 font-medium group-hover:text-white">{notif.title}</p>
                              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-zinc-600 mt-2 font-mono uppercase opacity-70">{new Date(notif.created_at).toLocaleTimeString()}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-px h-8 bg-border" />
                <div className="flex items-center gap-3 pl-2">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white leading-none tracking-tight">Minha Agência</p>
                    <p className="text-[10px] text-zinc-500 font-medium mt-1.5 uppercase tracking-widest">Admin Workspace</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-primary font-bold shadow-sm">
                    A
                  </div>
                </div>
              </div>
            </header>

            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-border z-20">
              <div className="flex items-center gap-3">
                <img src="/techub_robot_logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                <span className="font-bold text-zinc-100 text-lg">TecHub</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                <Menu className="text-zinc-400" />
              </button>
            </header>
          </>
        )}

        {/* Padding Control: Standard Pages vs Full Width Pages */}
        <div className={`flex-1 w-full h-full overflow-hidden relative ${currentView !== ViewState.CRM ? 'p-6 lg:p-10 overflow-y-auto custom-scrollbar' : ''}`}>
          <div className={currentView !== ViewState.CRM ? 'w-full max-w-[98%] 2xl:max-w-[1800px] mx-auto' : 'h-full w-full'}>
            <AppErrorBoundary>
              {children}
            </AppErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
};

export const Layout = React.memo(LayoutBase);