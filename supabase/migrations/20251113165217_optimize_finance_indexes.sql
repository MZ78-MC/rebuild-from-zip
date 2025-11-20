-- Add composite index for common query pattern: user_id + date + type
CREATE INDEX IF NOT EXISTS idx_user_finances_user_date_type 
  ON public.user_finances(user_id, date DESC, type);

-- Add index for category aggregation queries
CREATE INDEX IF NOT EXISTS idx_user_finances_user_type_category 
  ON public.user_finances(user_id, type, category) 
  WHERE type = 'expense';

