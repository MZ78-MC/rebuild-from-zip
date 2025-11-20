-- Migration: Add attachments column to tasks table
-- This adds a JSONB column to store task attachments

-- Add attachments column to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Create index on attachments for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_attachments ON public.tasks USING GIN (attachments);

-- Add comment to column
COMMENT ON COLUMN public.tasks.attachments IS 'Array of attachment objects with id, name, url, and size fields';

