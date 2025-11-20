-- Create stacks table first (no dependencies)
CREATE TABLE IF NOT EXISTS public.stacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notebooks table (depends on stacks)
CREATE TABLE IF NOT EXISTS public.notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  parent_stack_id UUID REFERENCES public.stacks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhance personal_notes table with Evernote Advanced features (depends on notebooks)
ALTER TABLE public.personal_notes
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS notebook_id UUID REFERENCES public.notebooks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create note_attachments table
CREATE TABLE IF NOT EXISTS public.note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.personal_notes(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create note_versions table
CREATE TABLE IF NOT EXISTS public.note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.personal_notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT,
  tags TEXT[],
  version INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create note_templates table
CREATE TABLE IF NOT EXISTS public.note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create note_shares table
CREATE TABLE IF NOT EXISTS public.note_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.personal_notes(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(note_id, shared_with_user_id)
);

-- Create note_links table for note linking
CREATE TABLE IF NOT EXISTS public.note_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_note_id UUID NOT NULL REFERENCES public.personal_notes(id) ON DELETE CASCADE,
  to_note_id UUID NOT NULL REFERENCES public.personal_notes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_note_id, to_note_id)
);

-- Enable Row Level Security
ALTER TABLE public.stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stacks
CREATE POLICY "Users can view their own stacks"
  ON public.stacks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stacks"
  ON public.stacks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stacks"
  ON public.stacks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stacks"
  ON public.stacks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for notebooks
CREATE POLICY "Users can view their own notebooks"
  ON public.notebooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notebooks"
  ON public.notebooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notebooks"
  ON public.notebooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notebooks"
  ON public.notebooks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for note_attachments
CREATE POLICY "Users can view attachments of their notes"
  ON public.note_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_attachments.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments to their notes"
  ON public.note_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_attachments.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments of their notes"
  ON public.note_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_attachments.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

-- RLS Policies for note_versions
CREATE POLICY "Users can view versions of their notes"
  ON public.note_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_versions.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert versions of their notes"
  ON public.note_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_versions.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

-- RLS Policies for note_templates
CREATE POLICY "Users can view their own templates"
  ON public.note_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
  ON public.note_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.note_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON public.note_templates FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for note_shares
CREATE POLICY "Users can view notes shared with them or by them"
  ON public.note_shares FOR SELECT
  USING (
    auth.uid() = shared_with_user_id
    OR EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_shares.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can share their own notes"
  ON public.note_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_shares.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update shares of their notes"
  ON public.note_shares FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_shares.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete shares of their notes or shares with them"
  ON public.note_shares FOR DELETE
  USING (
    auth.uid() = shared_with_user_id
    OR EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_shares.note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

-- RLS Policies for note_links
CREATE POLICY "Users can view links of their notes"
  ON public.note_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_links.from_note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create links from their notes"
  ON public.note_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_links.from_note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete links from their notes"
  ON public.note_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.personal_notes
      WHERE personal_notes.id = note_links.from_note_id
      AND personal_notes.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_personal_notes_user_id ON public.personal_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_notes_notebook_id ON public.personal_notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_personal_notes_is_pinned ON public.personal_notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_personal_notes_is_favorite ON public.personal_notes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_personal_notes_tags ON public.personal_notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_personal_notes_created_at ON public.personal_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_notes_updated_at ON public.personal_notes(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_parent_stack_id ON public.notebooks(parent_stack_id);
CREATE INDEX IF NOT EXISTS idx_stacks_user_id ON public.stacks(user_id);
CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON public.note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON public.note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_version ON public.note_versions(version DESC);
CREATE INDEX IF NOT EXISTS idx_note_templates_user_id ON public.note_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON public.note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_shared_with_user_id ON public.note_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_note_links_from_note_id ON public.note_links(from_note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_to_note_id ON public.note_links(to_note_id);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_personal_notes_content_search ON public.personal_notes USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '')));
CREATE INDEX IF NOT EXISTS idx_personal_notes_title_search ON public.personal_notes USING GIN(to_tsvector('english', COALESCE(title, '')));

-- Create trigger to update updated_at for stacks
CREATE OR REPLACE FUNCTION update_stacks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stacks_updated_at
  BEFORE UPDATE ON public.stacks
  FOR EACH ROW
  EXECUTE FUNCTION update_stacks_updated_at();

-- Create trigger to update updated_at for notebooks
CREATE OR REPLACE FUNCTION update_notebooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notebooks_updated_at
  BEFORE UPDATE ON public.notebooks
  FOR EACH ROW
  EXECUTE FUNCTION update_notebooks_updated_at();

-- Create trigger to update updated_at for note_templates
CREATE OR REPLACE FUNCTION update_note_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_note_templates_updated_at
  BEFORE UPDATE ON public.note_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_note_templates_updated_at();

