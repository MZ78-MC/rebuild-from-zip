-- Fix function search path security issue with CASCADE
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate all triggers
CREATE TRIGGER update_debtors_notes_updated_at
  BEFORE UPDATE ON public.debtors_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_personality_profile_updated_at
  BEFORE UPDATE ON public.personality_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_personal_notes_updated_at
  BEFORE UPDATE ON public.personal_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();