-- Create enum for time period
CREATE TYPE public.task_time_period AS ENUM ('morning', 'afternoon', 'evening', 'unscheduled');

-- Add time-related fields to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_duration INTEGER,
  ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS time_period task_time_period DEFAULT 'unscheduled';

-- Create index on scheduled_time for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_time ON public.tasks(scheduled_time);

-- Create index on time_period for filtering
CREATE INDEX IF NOT EXISTS idx_tasks_time_period ON public.tasks(time_period);

