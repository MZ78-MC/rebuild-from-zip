# Edge Function Deployment Guide

## Quick Check: Is the Function Deployed?

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Look for `process-debtor-screenshot` in the list
3. If it's **not there**, you need to deploy it

## Deploy via Supabase Dashboard (Easiest)

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"** (or use the existing one)
3. Function name: `process-debtor-screenshot`
4. Copy the code from `supabase/functions/process-debtor-screenshot/index.ts`
5. Paste it into the editor
6. Click **"Deploy"**

## Deploy via CLI (Alternative)

If you have Supabase CLI installed:

```bash
# Make sure you're in the project root
cd C:\muzaffar-my-voice

# Link to your project (if not already linked)
npx supabase link --project-ref vgrthktymsarxgcftaej

# Deploy the function
npx supabase functions deploy process-debtor-screenshot
```

## Required Environment Variables

Make sure these are set in **Supabase Dashboard** → **Edge Functions** → **Secrets**:

- `SUPABASE_URL` (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY` (automatically set)
- `GEMINI_API_KEY` (your free Gemini API key from https://aistudio.google.com/apikey)
- `GROQ_API_KEY` (optional, free from https://console.groq.com/keys)

## Test the Function

After deployment, test it:

1. Go to **Edge Functions** → `process-debtor-screenshot`
2. Click **"Invoke"** tab
3. Use this test payload:
   ```json
   {
     "file_url": "https://example.com/test.jpg",
     "file_id": "test-id"
   }
   ```
4. Check the logs for errors

## Common Issues

### "Function not found"
- The function isn't deployed
- Deploy it via Dashboard or CLI

### "No authorization header"
- The auth token isn't being passed
- Make sure you're logged in
- Check browser console for auth errors

### "Missing Supabase configuration"
- Environment variables aren't set
- Check Edge Functions secrets in Dashboard

### "Failed to download file"
- The file URL is invalid
- Check that the storage bucket is accessible
- Verify the file was uploaded successfully


