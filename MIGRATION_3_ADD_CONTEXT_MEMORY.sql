-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Context memory table for Dev Assistant
CREATE TABLE IF NOT EXISTS public.context_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  context TEXT,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.context_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for context_memory
DROP POLICY IF EXISTS "Users can view their own context memory" ON public.context_memory;
CREATE POLICY "Users can view their own context memory"
  ON public.context_memory FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own context memory" ON public.context_memory;
CREATE POLICY "Users can insert their own context memory"
  ON public.context_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own context memory" ON public.context_memory;
CREATE POLICY "Users can delete their own context memory"
  ON public.context_memory FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_context_memory_user_id ON public.context_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_context_memory_created_at ON public.context_memory(created_at DESC);

