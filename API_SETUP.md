# AI API Setup Guide

Since Lovable doesn't expose a direct API key, you have **3 options** for AI functionality:

## Option 1: OpenAI API (Recommended - Easiest)

1. **Get OpenAI API Key:**
   - Go to https://platform.openai.com/api-keys
   - Sign up or log in
   - Create a new API key
   - Copy the key (starts with `sk-`)

2. **Add to Supabase:**
   - Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions**
   - Click **"Secrets"** tab
   - Add new secret:
     - **Name:** `OPENAI_API_KEY`
     - **Value:** Your OpenAI API key
   - Save

3. **Redeploy functions:**
   ```bash
   supabase functions deploy dev-assistant
   supabase functions deploy process-debtor-screenshot
   supabase functions deploy transcribe-voice
   supabase functions deploy learn-from-edit
   supabase functions deploy regenerate-summary
   supabase functions deploy generate-pdf-report
   ```

## Option 2: Anthropic Claude API

1. **Get Anthropic API Key:**
   - Go to https://console.anthropic.com/
   - Sign up or log in
   - Go to API Keys section
   - Create a new key
   - Copy the key

2. **Add to Supabase:**
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key

3. **Redeploy functions** (same as above)

## Option 3: Lovable Gateway (If Available)

If you have access to Lovable's AI gateway:
- Name: `LOVABLE_API_KEY`
- Value: Your Lovable API key (if you can find it)

## Priority Order

The system will automatically use APIs in this order:
1. **OPENAI_API_KEY** (if set)
2. **ANTHROPIC_API_KEY** (if set, and OpenAI not set)
3. **LOVABLE_API_KEY** (if set, and others not set)

## Recommended: OpenAI

**I recommend using OpenAI** because:
- ✅ Easy to get API key
- ✅ Reliable and fast
- ✅ Good pricing for GPT-4o-mini
- ✅ Well-documented

## Cost Estimate

- **OpenAI GPT-4o-mini:** ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Anthropic Claude:** ~$3 per 1M input tokens, ~$15 per 1M output tokens
- **Lovable Gateway:** Depends on their pricing

For personal use, OpenAI GPT-4o-mini is very affordable.

## Quick Start

1. Get OpenAI API key from https://platform.openai.com/api-keys
2. Add `OPENAI_API_KEY` secret in Supabase
3. Redeploy functions
4. Test the Dev Assistant!


