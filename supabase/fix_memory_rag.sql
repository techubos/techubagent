-- 1. Add organization_id to memories table
ALTER TABLE public.memories 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_memories_org ON public.memories(organization_id);

-- 3. Update the match_memories function to filter by organization
CREATE OR REPLACE FUNCTION match_memories (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    memories.id,
    memories.content,
    1 - (memories.embedding <=> query_embedding) AS similarity
  FROM memories
  WHERE 1 - (memories.embedding <=> query_embedding) > match_threshold
  AND (filter_organization_id IS NULL OR memories.organization_id = filter_organization_id)
  ORDER BY memories.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
