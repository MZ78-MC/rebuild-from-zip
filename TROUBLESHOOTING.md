# Troubleshooting 500 Errors

## Quick Fix Steps

### 1. Check if Function is Deployed

The `dev-assistant` function must be deployed to Supabase:

```bash
supabase functions deploy dev-assistant
```

Or deploy via Supabase Dashboard:
1. Go to **Edge Functions** in your Supabase Dashboard
2. Check if `dev-assistant` appears in the list
3. If not, deploy it using the CLI or Dashboard

### 2. Set Environment Variables

**CRITICAL**: The function requires these environment variables:

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions**
2. Add these secrets:
   - `LOVABLE_API_KEY` - Your Lovable AI API key
   - `SUPABASE_URL` - Usually auto-populated
   - `SUPABASE_SERVICE_ROLE_KEY` - Usually auto-populated

### 3. Check Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **dev-assistant**
2. Click **"Logs"** tab
3. Look for error messages - they will tell you exactly what's wrong

### 4. Verify Authentication

The function requires authentication. Make sure:
- You're logged in to the app
- The Supabase client is properly configured
- Auth is working in your app

### 5. Test Function Manually

You can test the function directly:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/dev-assistant \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

### 6. Common Errors

**Error: "LOVABLE_API_KEY environment variable is not set"**
- Solution: Add `LOVABLE_API_KEY` in Edge Functions settings

**Error: "User not authenticated"**
- Solution: Make sure you're logged in to the app

**Error: "AI gateway error: 401"**
- Solution: Check that `LOVABLE_API_KEY` is correct

**Error: "Failed to load resource: 500"**
- Solution: Check function logs in Supabase Dashboard

### 7. Temporary Workaround

If you need to use the app without the dev assistant:
1. The app will still work for Debtors and Notes modules
2. The Dev Assistant tab will show an error, but you can continue using other features
3. Once the function is deployed and configured, it will work automatically


