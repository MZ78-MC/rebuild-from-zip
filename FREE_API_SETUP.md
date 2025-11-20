# 🆓 FREE AI API Setup Guide

## Best FREE Options (No Credit Card Required)

### Option 1: Groq API (RECOMMENDED - Best Free Tier) ⭐

**Why:** 14,000 requests per day FREE, super fast!

1. **Get API Key:**
   - Go to https://console.groq.com/
   - Sign up (free, no credit card)
   - Go to "API Keys" section
   - Click "Create API Key"
   - Copy the key

2. **Add to Supabase:**
   - Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Name: `GROQ_API_KEY`
   - Value: Your Groq API key
   - Save

3. **Redeploy:**
   ```bash
   supabase functions deploy dev-assistant
   ```

**Free Tier:** 14,000 requests/day, no credit card needed!

---

### Option 2: Google Gemini API (100% Free)

**Why:** Completely free, no limits on basic usage

1. **Get API Key:**
   - Go to https://aistudio.google.com/apikey
   - Sign in with Google account
   - Click "Create API Key"
   - Copy the key

2. **Add to Supabase:**
   - Name: `GEMINI_API_KEY`
   - Value: Your Gemini API key
   - Save

3. **Redeploy** (same command as above)

**Free Tier:** Generous free tier, perfect for personal use!

---

### Option 3: OpenRouter (1000 Free Credits)

**Why:** Access to multiple models, 1000 free credits

1. **Get API Key:**
   - Go to https://openrouter.ai/
   - Sign up (free)
   - Go to "Keys" section
   - Create API key
   - Copy it

2. **Add to Supabase:**
   - Name: `OPENROUTER_API_KEY`
   - Value: Your OpenRouter API key
   - Save

3. **Redeploy** (same command)

**Free Tier:** 1000 credits to start, great for testing!

---

## Priority Order

The system automatically uses APIs in this order:
1. **GROQ_API_KEY** (14k/day free) ⭐ RECOMMENDED
2. **GEMINI_API_KEY** (free)
3. **OPENROUTER_API_KEY** (1000 free credits)
4. Paid options (OpenAI, Anthropic, etc.)

## Quick Start (2 minutes)

**Easiest option - Groq:**

1. Visit https://console.groq.com/keys
2. Sign up (free, no credit card)
3. Create API key
4. Add `GROQ_API_KEY` to Supabase Edge Functions secrets
5. Deploy: `supabase functions deploy dev-assistant`
6. Done! ✅

## Which Should You Use?

- **Groq**: Best for speed and volume (14k/day)
- **Gemini**: Best for reliability (Google's infrastructure)
- **OpenRouter**: Best for trying different models

**My recommendation:** Start with **Groq** - it's the most generous free tier!


