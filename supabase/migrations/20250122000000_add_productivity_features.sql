-- Add focus sessions table for Pomodoro tracking
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add daily highlights/shutdown table
CREATE TABLE IF NOT EXISTS public.daily_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  highlights JSONB DEFAULT '[]',
  achievements JSONB DEFAULT '[]',
  reflection TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Add calendar integrations table
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'outlook', 'ical', 'caldav'
  access_token TEXT,
  refresh_token TEXT,
  calendar_id TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add external calendar events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  attendees JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, integration_id, external_id)
);

-- Add planning rituals table
CREATE TABLE IF NOT EXISTS public.planning_rituals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ritual_type TEXT NOT NULL, -- 'morning', 'evening', 'weekly'
  template JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add meeting links table
CREATE TABLE IF NOT EXISTS public.meeting_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'calendly', 'cal.com', 'custom'
  link_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add task analytics tracking
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS actual_duration INTEGER,
  ADD COLUMN IF NOT EXISTS focus_sessions_count INTEGER DEFAULT 0;

-- Fix unique constraint for planning_rituals
ALTER TABLE public.planning_rituals
  DROP CONSTRAINT IF EXISTS planning_rituals_user_id_ritual_type_key,
  ADD CONSTRAINT planning_rituals_user_id_ritual_type_key UNIQUE(user_id, ritual_type);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON public.focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON public.focus_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON public.focus_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_daily_highlights_user_date ON public.daily_highlights(user_id, date);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user_id ON public.calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON public.calendar_events(start_time);

CREATE INDEX IF NOT EXISTS idx_planning_rituals_user_id ON public.planning_rituals(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_links_user_id ON public.meeting_links(user_id);

-- Enable RLS
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_rituals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own focus sessions"
  ON public.focus_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own daily highlights"
  ON public.daily_highlights FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own calendar integrations"
  ON public.calendar_integrations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own calendar events"
  ON public.calendar_events FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own planning rituals"
  ON public.planning_rituals FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own meeting links"
  ON public.meeting_links FOR ALL
  USING (auth.uid() = user_id);

-- Function to increment task focus sessions count
CREATE OR REPLACE FUNCTION increment_task_focus_sessions(task_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.tasks
  SET focus_sessions_count = COALESCE(focus_sessions_count, 0) + 1
  WHERE id = task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

