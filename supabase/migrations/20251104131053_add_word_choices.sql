-- Add word_choices column to personality_profile
ALTER TABLE public.personality_profile
ADD COLUMN IF NOT EXISTS word_choices JSONB DEFAULT '[]';


