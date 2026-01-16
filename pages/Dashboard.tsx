
import React, { useState, useEffect } from 'react';
import { Loader2, GitBranch, BarChart3, AlertCircle, Zap, GitGraph } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useOrganization } from '../features/auth/api/useOrganization';

// Features
import { useDashboardMetrics } from '../features/dashboard/api/useDashboardMetrics';
// import { useRecentActivity } from '../features/dashboard/api/useRecentActivity'; // Used inside ActivityFeed
import { useStagnantLeads } from '../features/dashboard/api/useStagnantLeads';

// Components
import { StatsGrid } from '../features/dashboard/components/StatsGrid';
import { ActivityFeed } from '../features/dashboard/components/ActivityFeed';
import { ConversionMetrics } from '../components/ConversionMetrics';
import { PlaybookAnalytics } from '../components/PlaybookAnalytics';
import { Shield } from 'lucide-react';

import { AtendimentoHoje } from '../components/dashboard/AtendimentoHoje';
import { AtendentesOnline } from '../components/dashboard/AtendentesOnline';

export const Dashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState('7');
  const { data: stats, isLoading: loadingStats } = useDashboardMetrics(dateRange);
  const { data: orgName = 'Carregando...' } = useOrganization();

  if (loadingStats && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const displayStats = stats || {
    pending: 0,
    inProgress: 0,
    newContacts: 0,
    avgResponseTime: '0s'
  };

  return (
    <div className="space-y-8 pb-12 max-w-[1700px] mx-auto overflow-hidden">
      {/* 1. Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest border border-primary/20 backdrop-blur-md">
              {orgName} • OPERACIONAL
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">
            Dashboard de <span className="text-primary-gradient">Performance</span>
          </h1>
          <p className="text-zinc-500 font-medium text-lg">
            Gestão estratégica e monitoramento em tempo real.
          </p>
        </div>

        <div className="flex gap-1.5 glass-panel p-1.5 rounded-2xl">
          {['7', '30', '90'].map((d) => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`px-8 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${dateRange === d
                ? 'bg-primary-gradient text-white shadow-lg'
                : 'text-zinc-500 hover:text-zinc-300'
                } `}
            >
              {d === '7' ? 'Semana' : d === '30' ? 'Mês' : 'Trimestre'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top Stats Grid */}
      <StatsGrid stats={displayStats} />

      {/* 3. Main Operational View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Atendimento Hoje (3/4 width on desktop) */}
        <div className="lg:col-span-3 h-[600px]">
          <AtendimentoHoje />
        </div>

        {/* Atendentes Online (1/4 width on desktop) */}
        <div className="lg:col-span-1 h-[600px]">
          <AtendentesOnline />
        </div>
      </div>

      {/* 4. Secondary Insights Area */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-8 border-t border-white/5">
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Zap size={20} />
            </div>
            <h3 className="text-xl font-black text-white">Velocidade de Conversão</h3>
          </div>
          <ConversionMetrics dateRange={{
            start: new Date(new Date().setDate(new Date().getDate() - parseInt(dateRange))),
            end: new Date()
          }} />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <GitGraph size={20} />
            </div>
            <h3 className="text-xl font-black text-white">Engajamento de Playbooks</h3>
          </div>
          <PlaybookAnalytics />
        </div>
      </div>
    </div>
  );
};