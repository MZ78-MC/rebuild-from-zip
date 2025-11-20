-- Migration 5: Create Storage Bucket for Debtor Files
-- This creates the storage bucket and policies needed for screenshot uploads

-- Create the storage bucket (if it doesn't exist)
-- Note: Supabase doesn't support CREATE BUCKET via SQL directly
-- You need to create it via the Dashboard or API
-- This migration sets up the policies after bucket creation

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload debtor files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own debtor files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own debtor files" ON storage.objects;

-- Policy: Allow authenticated users to upload files to their own folder
-- File path structure: debtors/{user_id}/{filename}
-- So foldername(name)[1] = 'debtors', foldername(name)[2] = user_id
CREATE POLICY "Users can upload debtor files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'debtors-files' 
  AND (storage.foldername(name))[1] = 'debtors'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Allow users to read their own files
CREATE POLICY "Users can read own debtor files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'debtors-files' 
  AND (storage.foldername(name))[1] = 'debtors'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Allow users to delete their own files
CREATE POLICY "Users can delete own debtor files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'debtors-files' 
  AND (storage.foldername(name))[1] = 'debtors'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Note: After running this migration, you MUST create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: "debtors-files"
-- 4. Make it PUBLIC (or keep private if you want RLS only)
-- 5. File size limit: 10MB (recommended)

