# Create Storage Bucket for Screenshots

## Quick Fix: Create the Bucket

The screenshot upload requires a Supabase Storage bucket named `debtors-files`. Here's how to create it:

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Configure:
   - **Name**: `debtors-files` (must be exactly this name)
   - **Public**: ✅ **Check this box** (or keep private if you prefer RLS)
   - **File size limit**: `10` MB (recommended)
   - **Allowed MIME types**: Leave empty or add `image/*`
5. Click **"Create bucket"**

### Option 2: Via SQL (if you have admin access)

Run this SQL in the Supabase SQL Editor:

```sql
-- Note: You may need to use the Supabase Management API or Dashboard
-- as CREATE BUCKET is not available in standard SQL
```

### After Creating the Bucket

1. Run the migration to set up policies:
   ```sql
   -- Run MIGRATION_5_CREATE_STORAGE_BUCKET.sql
   ```

2. Test the upload:
   - Go to the Debtors module
   - Click "Upload Screenshot"
   - Upload an image file

### Bucket Configuration

- **Name**: `debtors-files` (exact match required)
- **Public**: Recommended for easier access (or use RLS policies)
- **Size limit**: 10MB per file
- **File structure**: Files are stored as `debtors/{user_id}/{timestamp}.{ext}`

### Troubleshooting

If you still get "bucket not found" after creating it:
1. Check the bucket name matches exactly: `debtors-files` (with hyphen)
2. Refresh your browser
3. Check that you're logged in as an authenticated user
4. Verify the bucket is visible in the Storage dashboard


