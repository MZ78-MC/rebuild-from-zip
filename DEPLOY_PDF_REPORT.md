# How to Redeploy generate-pdf-report Function

## Quick Steps (Takes 2 minutes)

### 1. Go to Supabase Dashboard

1. Visit: **https://supabase.com/dashboard**
2. Select your project

### 2. Navigate to Edge Functions

1. Click **"Edge Functions"** in the left sidebar
2. Find **`generate-pdf-report`** in the list
3. Click on it to open the editor

### 3. Update the Function Code

1. Open the file: `supabase/functions/generate-pdf-report/index.ts` in your code editor
2. **Copy ALL the code** from that file (Ctrl+A, Ctrl+C)
3. Go back to Supabase Dashboard
4. **Select all** in the Dashboard editor (Ctrl+A)
5. **Paste** the new code (Ctrl+V)

### 4. Deploy

1. Click **"Deploy"** or **"Save"** button
2. Wait for deployment to complete (usually 10-30 seconds)
3. You'll see a success message

### 5. Test It

1. Go back to your app
2. Click **"Daily PDF"** or **"Weekly PDF"** button
3. The new professional formatting should appear!

## If Function Doesn't Exist

If you don't see `generate-pdf-report` in the list:

1. Click **"+ New Function"** or **"Create a new function"**
2. Function name: `generate-pdf-report`
3. Copy ALL code from `supabase/functions/generate-pdf-report/index.ts`
4. Paste it into the editor
5. Click **"Deploy"**

## That's It!

After redeploying, the PDF will have:
- ✅ Professional styling with gradients and shadows
- ✅ Screenshots included in each debtor entry
- ✅ Better page breaks
- ✅ Improved typography and colors

