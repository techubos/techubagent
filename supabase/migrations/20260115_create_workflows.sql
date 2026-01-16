-- Create workflows table for JSON-based storage (React Flow friendly)
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT false,
    trigger_type TEXT DEFAULT 'manual', -- 'manual', 'keyword', 'event'
    trigger_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add workflow execution columns to contacts if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'current_workflow_id') THEN
        ALTER TABLE contacts ADD COLUMN current_workflow_id UUID REFERENCES workflows(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'current_node_id') THEN
        ALTER TABLE contacts ADD COLUMN current_node_id TEXT;
    END IF;
END $$;
