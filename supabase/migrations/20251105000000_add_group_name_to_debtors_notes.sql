-- Add group_name field to debtors_notes table
ALTER TABLE public.debtors_notes
ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Create index for faster queries by group
CREATE INDEX IF NOT EXISTS idx_debtors_notes_group_name 
ON public.debtors_notes(user_id, group_name);

-- Update RLS policies (no change needed, existing policies cover this field)

