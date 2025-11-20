-- Enable pgvector extension for vector embeddings (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum for finance type
CREATE TYPE public.finance_type AS ENUM ('income', 'expense');

-- User finances table
CREATE TABLE IF NOT EXISTS public.user_finances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  description TEXT,
  type finance_type NOT NULL,
  source TEXT DEFAULT 'manual',
  vendor TEXT,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget goals table
CREATE TABLE IF NOT EXISTS public.budget_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  target_amount DECIMAL(15, 2) NOT NULL,
  current_amount DECIMAL(15, 2) DEFAULT 0,
  deadline TIMESTAMP WITH TIME ZONE,
  category TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_finances
CREATE POLICY "Users can view their own finances"
  ON public.user_finances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own finances"
  ON public.user_finances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own finances"
  ON public.user_finances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own finances"
  ON public.user_finances FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for budget_goals
CREATE POLICY "Users can view their own budget goals"
  ON public.budget_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget goals"
  ON public.budget_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget goals"
  ON public.budget_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget goals"
  ON public.budget_goals FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for user_finances
CREATE INDEX IF NOT EXISTS idx_user_finances_user_id ON public.user_finances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_finances_date ON public.user_finances(date DESC);
CREATE INDEX IF NOT EXISTS idx_user_finances_category ON public.user_finances(category);
CREATE INDEX IF NOT EXISTS idx_user_finances_type ON public.user_finances(type);
CREATE INDEX IF NOT EXISTS idx_user_finances_user_date ON public.user_finances(user_id, date DESC);

-- Indexes for budget_goals
CREATE INDEX IF NOT EXISTS idx_budget_goals_user_id ON public.budget_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_goals_status ON public.budget_goals(status);
CREATE INDEX IF NOT EXISTS idx_budget_goals_deadline ON public.budget_goals(deadline);

-- Create triggers for updated_at
CREATE TRIGGER update_user_finances_updated_at
  BEFORE UPDATE ON public.user_finances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_goals_updated_at
  BEFORE UPDATE ON public.budget_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

