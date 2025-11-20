# Deploy Dev Assistant via Supabase Dashboard

Since CLI linking has permission issues, here's how to deploy via the web interface:

## Method 1: Create New Function in Dashboard

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions:**
   - Click **"Edge Functions"** in the left sidebar
   - Click **"Create a new function"** or **"+ New Function"**

3. **Create the function:**
   - **Function name:** `dev-assistant`
   - **Template:** Start from scratch (or blank)

4. **Copy the function code:**
   - Open `supabase/functions/dev-assistant/index.ts` in your editor
   - Copy ALL the code
   - Paste it into the Dashboard editor

5. **Save and Deploy:**
   - Click **"Deploy"** or **"Save"**

## Method 2: If Function Already Exists

1. **Go to Edge Functions**
2. **Find `dev-assistant`** in the list
3. **Click on it** to open the editor
4. **Copy the latest code** from `supabase/functions/dev-assistant/index.ts`
5. **Replace the code** in the Dashboard
6. **Click "Save"** or **"Redeploy"**

## After Deploying

1. **Set the GEMINI_API_KEY secret:**
   - Go to **Project Settings** → **Edge Functions** → **Secrets**
   - Add: `GEMINI_API_KEY` = your Gemini API key
   - Save

2. **Test it:**
   - Refresh your app
   - Try the Dev Assistant

## Quick Copy-Paste

The function code is in: `supabase/functions/dev-assistant/index.ts`

Just copy that entire file and paste it into the Supabase Dashboard editor!


