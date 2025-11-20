# Deploy Budget Buddy Edge Functions

## Quick Deploy via Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Deploy each function:

### 1. finance-summary
- Click **"Create a new function"** or find existing `finance-summary`
- Function name: `finance-summary`
- Copy code from `supabase/functions/finance-summary/index.ts`
- Paste and click **"Deploy"**

### 2. finance-assistant
- Click **"Create a new function"**
- Function name: `finance-assistant`
- Copy code from `supabase/functions/finance-assistant/index.ts`
- Paste and click **"Deploy"**

### 3. process-receipt
- Click **"Create a new function"**
- Function name: `process-receipt`
- Copy code from `supabase/functions/process-receipt/index.ts`
- Paste and click **"Deploy"**

## Deploy via CLI (Alternative)

```bash
# Make sure you're in the project root
cd C:\muzaffar-my-voice

# Link to your project (if not already linked)
npx supabase link --project-ref vgrthktymsarxgcftaej

# Deploy all three functions
npx supabase functions deploy finance-summary
npx supabase functions deploy finance-assistant
npx supabase functions deploy process-receipt
```

## Required Environment Variables

Make sure these are set in **Supabase Dashboard** → **Edge Functions** → **Secrets**:

- `SUPABASE_URL` (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY` (automatically set)
- `OPENAI_API_KEY` (for best accuracy - GPT-4 Vision for receipts)
- `GEMINI_API_KEY` (optional, free alternative)
- `GROQ_API_KEY` (optional, free alternative)

## Verify Deployment

After deployment:
1. Go to **Edge Functions** in Supabase Dashboard
2. You should see all three functions: `finance-summary`, `finance-assistant`, `process-receipt`
3. Each should show "Active" status

## Test the Functions

1. Go to **Edge Functions** → Select a function → **"Invoke"** tab
2. Test `finance-summary` with:
   ```json
   {
     "period": "month",
     "includeTip": false
   }
   ```
3. Check the logs for any errors

## Common Issues

### CORS Errors (406, ERR_FAILED)
**This means the functions are NOT deployed yet!**

1. **Deploy the functions first** - The CORS errors will disappear once functions are deployed
2. After deployment, functions return status 204 for OPTIONS requests
3. All responses include `Access-Control-Allow-Origin: *` header

### "Function not found" or 406 errors
- The function isn't deployed yet
- **Solution:** Deploy via Dashboard or CLI (see instructions above)
- After deployment, wait 10-30 seconds for propagation

### "No authorization header"
- Make sure you're logged in to the app
- Check browser console for auth errors
- Verify your Supabase auth session is active

### Still seeing CORS errors after deployment?
1. Clear browser cache and hard refresh (Ctrl+Shift+R)
2. Check Supabase Dashboard → Edge Functions → Logs for errors
3. Verify the function shows "Active" status
4. Try deploying again - sometimes it takes a moment to propagate

