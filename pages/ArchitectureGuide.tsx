import React, { useState } from 'react';
import { Copy, Database, Server, CheckCircle, ArrowRight, Layers, Network, Zap, ShieldAlert, Cpu, BrainCircuit, Mic, Volume2, Workflow, Clock, Terminal, AlertTriangle, Lock, ShieldCheck, Users } from 'lucide-react';

const CodeBlock = ({ title, code }: { title: string, code: string }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden bg-gray-900 text-gray-100 shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs font-mono text-gray-400">{title}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
          <Copy size={12} />
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const SQL_V6_AGENTS = `
/*
  SCRIPT V6.1 - MIGRAÇÃO & CORREÇÃO (RODE ESTE!)
  Adiciona colunas faltantes e ajusta permissões.
*/

-- 1. Garante colunas de Dono (Multi-Tenant)
alter table contacts add column if not exists user_id uuid references auth.users default auth.uid();
alter table messages add column if not exists user_id uuid references auth.users default auth.uid();
alter table documents add column if not exists user_id uuid references auth.users default auth.uid();
alter table broadcasts add column if not exists user_id uuid references auth.users default auth.uid();

-- 2. Tabela de Conexões
create table if not exists connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(),
  name text,
  instance_name text, 
  status text default 'disconnected', 
  phone_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabela de Agentes e MIGRAÇÃO DE COLUNAS (Correção do Erro)
create table if not exists agents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Adiciona colunas se não existirem (Safe Migration)
alter table agents add column if not exists connection_id uuid references connections(id);
alter table agents add column if not exists model text default 'gemini-3-flash-preview';
alter table agents add column if not exists temperature float default 0.3;
alter table agents add column if not exists system_prompt text;
alter table agents add column if not exists supports_audio boolean default false;
alter table agents add column if not exists supports_image boolean default false;
alter table agents add column if not exists transcribe_audio boolean default true;

-- Colunas de CRM (Onde ocorreu o erro)
alter table agents add column if not exists crm_board_id text default 'default';
alter table agents add column if not exists crm_stage_id text default 'lead';
alter table agents add column if not exists crm_default_value numeric default 0;
alter table agents add column if not exists crm_default_note text;

-- Outras configs
alter table agents add column if not exists typing_simulation boolean default true;
alter table agents add column if not exists pause_on_human boolean default true;
alter table agents add column if not exists group_messages boolean default false;
alter table agents add column if not exists history_limit int default 20;
alter table agents add column if not exists document_ids text[] default array[]::text[];


-- 4. Tabela de Workflows
create table if not exists workflows (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users default auth.uid(),
    title text not null,
    description text,
    active boolean default false,
    trigger_type text, 
    trigger_condition text,
    steps jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Inserir Workflows Padrão (Sem duplicar)
insert into workflows (title, description, active, trigger_type, trigger_condition, steps)
select 'Reativação de Lead Frio', 'Envia mensagem se o lead não responder por 24h', false, 'no_reply', '24h sem resposta', 
'[{"type": "wait", "delay": 24}, {"type": "message", "content": "Olá! Ficou alguma dúvida sobre o que conversamos?"}]'::jsonb
where not exists (select 1 from workflows where title = 'Reativação de Lead Frio');

insert into workflows (title, description, active, trigger_type, trigger_condition, steps)
select 'Confirmação de Agendamento', 'Lembra o cliente 2h antes da reunião', true, 'schedule_approaching', '2h antes', 
'[{"type": "message", "content": "Oi! Passando para confirmar nossa reunião daqui a pouco."}]'::jsonb
where not exists (select 1 from workflows where title = 'Confirmação de Agendamento');


-- 6. SEGURANÇA (RLS STRICT - IDEMPOTENTE)
-- Deleta policies antigas e recria para evitar conflitos

-- Contacts
drop policy if exists "Auth users can view contacts" on contacts;
drop policy if exists "Users see own contacts" on contacts;
create policy "Users see own contacts" on contacts for all to authenticated using (auth.uid() = user_id);

-- Messages
drop policy if exists "Auth users can view messages" on messages;
drop policy if exists "Users see own messages" on messages;
create policy "Users see own messages" on messages for all to authenticated using (auth.uid() = user_id);

-- Documents
drop policy if exists "Auth users can view docs" on documents;
drop policy if exists "Users see own docs" on documents;
create policy "Users see own docs" on documents for all to authenticated using (auth.uid() = user_id);

-- Agents
alter table agents enable row level security;
drop policy if exists "Users manage own agents" on agents;
create policy "Users manage own agents" on agents for all to authenticated using (auth.uid() = user_id);

-- Connections
alter table connections enable row level security;
drop policy if exists "Users manage own connections" on connections;
create policy "Users manage own connections" on connections for all to authenticated using (auth.uid() = user_id);

-- Workflows
alter table workflows enable row level security;
drop policy if exists "Users manage own workflows" on workflows;
create policy "Users manage own workflows" on workflows for all to authenticated using (auth.uid() = user_id);
`;

export const ArchitectureGuide: React.FC = () => {
  const [tab, setTab] = useState<'sql_v6'>('sql_v6');

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Central de Engenharia</h1>
            <p className="text-gray-600">Scripts de atualização do banco de dados.</p>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                  <Users className="text-emerald-400" />
                  <h2 className="text-xl font-bold">Script V6.1 - Correção de Tabelas (Definitivo)</h2>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg mb-6 flex gap-3 items-start">
                  <CheckCircle className="text-emerald-500 shrink-0 mt-1" size={18}/>
                  <div className="text-emerald-200 text-sm">
                      <p className="font-bold">O QUE ESTE SCRIPT FAZ:</p>
                      <ul className="list-disc ml-4 mt-1 space-y-1">
                          <li>Usa <code>ALTER TABLE</code> para forçar a criação das colunas <code>crm_board_id</code> e outras na tabela <code>agents</code>.</li>
                          <li>Resolve o erro "column not found in schema cache".</li>
                          <li>Recria as políticas de segurança (RLS) sem dar erro de duplicidade.</li>
                      </ul>
                  </div>
              </div>
              <CodeBlock title="setup_v6_1_fix.sql" code={SQL_V6_AGENTS} />
          </div>
      </div>
    </div>
  );
};