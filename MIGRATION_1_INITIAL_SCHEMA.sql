-- Create enum for task priority (if not exists)
DO $$ BEGIN
    CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for task status (if not exists)
DO $$ BEGIN
    CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Debtors files table
CREATE TABLE IF NOT EXISTS public.debtors_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Debtors notes table
CREATE TABLE IF NOT EXISTS public.debtors_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.debtors_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT,
  credit_limit DECIMAL(15, 2),
  overdue DECIMAL(15, 2),
  balance DECIMAL(15, 2),
  summary TEXT,
  ai_generated TEXT,
  user_edited TEXT,
  urgency TEXT,
  sentiment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning log table
CREATE TABLE IF NOT EXISTS public.learning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  context TEXT,
  note_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personality profile table
CREATE TABLE IF NOT EXISTS public.personality_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tone_formal DECIMAL(3, 2) DEFAULT 0.5,
  tone_direct DECIMAL(3, 2) DEFAULT 0.5,
  tone_empathetic DECIMAL(3, 2) DEFAULT 0.5,
  phrasing_examples JSONB DEFAULT '[]',
  preferred_verbs JSONB DEFAULT '[]',
  formatting_style JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dev memory table
CREATE TABLE IF NOT EXISTS public.dev_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  priority task_priority DEFAULT 'medium',
  status task_status DEFAULT 'pending',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personal notes table
CREATE TABLE IF NOT EXISTS public.personal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reminders table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.debtors_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debtors_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for debtors_files
DROP POLICY IF EXISTS "Users can view their own files" ON public.debtors_files;
CREATE POLICY "Users can view their own files"
  ON public.debtors_files FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own files" ON public.debtors_files;
CREATE POLICY "Users can insert their own files"
  ON public.debtors_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own files" ON public.debtors_files;
CREATE POLICY "Users can delete their own files"
  ON public.debtors_files FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for debtors_notes
DROP POLICY IF EXISTS "Users can view their own notes" ON public.debtors_notes;
CREATE POLICY "Users can view their own notes"
  ON public.debtors_notes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.debtors_notes;
CREATE POLICY "Users can insert their own notes"
  ON public.debtors_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON public.debtors_notes;
CREATE POLICY "Users can update their own notes"
  ON public.debtors_notes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.debtors_notes;
CREATE POLICY "Users can delete their own notes"
  ON public.debtors_notes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for learning_log
DROP POLICY IF EXISTS "Users can view their own learning logs" ON public.learning_log;
CREATE POLICY "Users can view their own learning logs"
  ON public.learning_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own learning logs" ON public.learning_log;
CREATE POLICY "Users can insert their own learning logs"
  ON public.learning_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for personality_profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.personality_profile;
CREATE POLICY "Users can view their own profile"
  ON public.personality_profile FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.personality_profile;
CREATE POLICY "Users can insert their own profile"
  ON public.personality_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.personality_profile;
CREATE POLICY "Users can update their own profile"
  ON public.personality_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for dev_memory
DROP POLICY IF EXISTS "Users can view their own dev memory" ON public.dev_memory;
CREATE POLICY "Users can view their own dev memory"
  ON public.dev_memory FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own dev memory" ON public.dev_memory;
CREATE POLICY "Users can insert their own dev memory"
  ON public.dev_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
CREATE POLICY "Users can insert their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for personal_notes
DROP POLICY IF EXISTS "Users can view their own notes" ON public.personal_notes;
CREATE POLICY "Users can view their own notes"
  ON public.personal_notes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.personal_notes;
CREATE POLICY "Users can insert their own notes"
  ON public.personal_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON public.personal_notes;
CREATE POLICY "Users can update their own notes"
  ON public.personal_notes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.personal_notes;
CREATE POLICY "Users can delete their own notes"
  ON public.personal_notes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for reminders
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
CREATE POLICY "Users can view their own reminders"
  ON public.reminders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reminders" ON public.reminders;
CREATE POLICY "Users can insert their own reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;
CREATE POLICY "Users can update their own reminders"
  ON public.reminders FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.reminders;
CREATE POLICY "Users can delete their own reminders"
  ON public.reminders FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for reports
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_debtors_notes_updated_at ON public.debtors_notes;
CREATE TRIGGER update_debtors_notes_updated_at
  BEFORE UPDATE ON public.debtors_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_personality_profile_updated_at ON public.personality_profile;
CREATE TRIGGER update_personality_profile_updated_at
  BEFORE UPDATE ON public.personality_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_personal_notes_updated_at ON public.personal_notes;
CREATE TRIGGER update_personal_notes_updated_at
  BEFORE UPDATE ON public.personal_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

