-- Enable extensions
create extension if not exists vector;

-- Contacts Table
create table if not exists public.contacts (
  id uuid default gen_random_uuid() primary key,
  name text,
  phone text unique not null,
  evolution_id text,
  profile_pic_url text,
  status text default 'lead',
  notes text,
  tags text[],
  sentiment text,
  last_message_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  is_unread boolean default false,
  handling_mode text default 'ai' check (handling_mode in ('ai', 'human')),
  current_flow_id uuid,
  current_node_id uuid,
  organization_id uuid,
  assigned_to uuid,
  summary text,
  lead_score integer default 0
);

-- Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text,
  message_type text default 'text', -- text, image, audio, video, document
  media_url text,
  external_id text, -- ID from Evolution API
  timestamp timestamp with time zone default now(), -- Message timestamp
  created_at timestamp with time zone default now(), -- Record creation
  organization_id uuid,
  whatsapp_message_id text unique,
  status text default 'sent',
  payload jsonb default '{}'::jsonb
);

-- Memories Table (for AI RAG)
create table if not exists public.memories (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  embedding vector(1536), -- OpenAI Embedding Dimension (default)
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Indexes for performance
create index if not exists contacts_phone_idx on public.contacts(phone);
create index if not exists messages_contact_id_idx on public.messages(contact_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);
create index if not exists contacts_last_message_at_idx on public.contacts(last_message_at desc);
create index if not exists contacts_status_idx on public.contacts(status);
create index if not exists idx_contacts_current_flow on public.contacts(current_flow_id);
create index if not exists idx_contacts_current_node on public.contacts(current_node_id);
create index if not exists idx_contacts_org on public.contacts(organization_id);
create index if not exists idx_messages_org on public.messages(organization_id);
create index if not exists idx_messages_whatsapp_id on public.messages(whatsapp_message_id);

-- Row Level Security (RLS)
-- Enabling RLS
alter table public.contacts enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;

-- Policies (Permissive for development/starter, restrict in production if needed)
-- Contacts
create policy "Enable read access for all users" on public.contacts for select using (true);
create policy "Enable insert for all users" on public.contacts for insert with check (true);
create policy "Enable update for all users" on public.contacts for update using (true);

-- Messages
create policy "Enable read access for all users" on public.messages for select using (true);
create policy "Enable insert for all users" on public.messages for insert with check (true);
create policy "Enable update for all users" on public.messages for update using (true);

-- Memories
create policy "Enable read access for all users" on public.memories for select using (true);
create policy "Enable insert for all users" on public.memories for insert with check (true);

-- Function to search memories
create or replace function match_memories (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    memories.id,
    memories.content,
    1 - (memories.embedding <=> query_embedding) as similarity
  from memories
  where 1 - (memories.embedding <=> query_embedding) > match_threshold
  order by memories.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Connections Table (to track WhatsApp instances)
create table if not exists public.connections (
  id uuid default gen_random_uuid() primary key,
  name text,
  instance_name text unique not null,
  status text check (status in ('connected', 'disconnected', 'pairing')),
  phone_number text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for connections" ON public.connections FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_connections_created_at ON public.connections(created_at DESC);

-- AI FEEDBACK LOOP TABLE
CREATE TABLE IF NOT EXISTS public.ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating IN (1, -1)), -- 1 for good, -1 for bad
    corrected_content TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_ai_feedback_agent ON public.ai_feedback(agent_id);

-- Enable RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for feedback" ON public.ai_feedback FOR ALL USING (true);

-- EXTENSIONS & AUTOMATION
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- SCHEDULED MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  message_type TEXT DEFAULT 'text',
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_scheduled_for ON public.scheduled_messages(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_contact_id ON public.scheduled_messages(contact_id);

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'scheduled_messages' 
        AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.scheduled_messages
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- INTERNAL MESSAGES TABLE (Team Chat)
CREATE TABLE IF NOT EXISTS public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL, -- References auth.users or profiles ideally
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_messages_channel ON public.internal_messages(channel);

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'internal_messages' 
        AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.internal_messages
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- HELP CENTER ARTICLES
CREATE TABLE IF NOT EXISTS public.help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tutorial', 'faq', 'concept')),
  content TEXT NOT NULL, -- Markdown
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'help_articles' 
        AND policyname = 'Enable read for all authenticated'
    ) THEN
        CREATE POLICY "Enable read for all authenticated" ON public.help_articles
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'help_articles' 
        AND policyname = 'Enable insert/update for authenticated'
    ) THEN
         CREATE POLICY "Enable insert/update for authenticated" ON public.help_articles
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true); 
    END IF;
END $$;

