-- 🛠️ DATABASE REMEDIATION SCRIPT
-- Purpose: Add missing columns identified during Total System Audit
-- Target Tables: contacts, connections

-- 1. Fix 'contacts' table (Adding missing columns from TypeScript interface)
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS lead_temperature text CHECK (lead_temperature IN ('cold', 'warm', 'hot')),
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS lead_category text,
ADD COLUMN IF NOT EXISTS active_workflow_id uuid,
ADD COLUMN IF NOT EXISTS last_workflow_step integer,
ADD COLUMN IF NOT EXISTS human_intervention boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_unread boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS handling_mode text DEFAULT 'ai' CHECK (handling_mode IN ('ai', 'human')),
ADD COLUMN IF NOT EXISTS summary text;

-- 2. Fix 'connections' table
ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 3. Create Index for new critical columns
CREATE INDEX IF NOT EXISTS idx_contacts_priority ON public.contacts(priority);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON public.contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_is_unread ON public.contacts(is_unread);

-- 4. Fix CamelCase in 'messages' (Optional: For now ensuring column exists)
-- We keep 'message_type' as snake_case. TypeScript must adapt to IT, not the DB.

-- Confirmation
SELECT 'Migration Applied Successfully' as status;
