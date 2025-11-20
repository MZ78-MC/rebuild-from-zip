# 🆓 Google Gemini API Setup (FREE)

## Quick Steps (2 minutes)

### 1. Get Your FREE Gemini API Key

1. Go to: **https://aistudio.google.com/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"** button
4. Select "Create API key in new project" (or use existing)
5. **Copy the API key** (it will look like: `AIzaSy...`)

### 2. Add to Supabase

1. Open **Supabase Dashboard**
2. Go to **Project Settings** → **Edge Functions**
3. Click **"Secrets"** tab
4. Click **"Add new secret"**
5. Enter:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Paste your Gemini API key
6. Click **"Save"**

### 3. Redeploy Function

Run this command:
```bash
supabase functions deploy dev-assistant
```

Or use Supabase Dashboard:
1. Go to **Edge Functions**
2. Click on `dev-assistant`
3. Click **"Redeploy"**

### 4. Test It!

1. Refresh your app
2. Go to **Dev Assistant** tab
3. Ask a question
4. It should work! ✅

## Free Tier Limits

- **Completely FREE** for personal use
- Generous rate limits
- No credit card required
- Perfect for your personal assistant!

## Troubleshooting

**If you get errors:**
- Make sure the API key is correct (starts with `AIzaSy`)
- Check Supabase function logs for detailed error messages
- Ensure you've redeployed the function after adding the secret

## That's It!

Gemini is now your AI provider. It's fast, reliable, and completely free!


