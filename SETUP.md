# Muzaffar Assistant - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase account and project
- Lovable AI API key

### Environment Variables

Set these in your Supabase project (Dashboard > Settings > Edge Functions):

1. **LOVABLE_API_KEY** - Your Lovable AI API key
2. **WHATSAPP_API_KEY** (optional) - For WhatsApp automation
3. **WHATSAPP_API_URL** (optional) - Your WhatsApp API endpoint
4. **DEFAULT_WHATSAPP_NUMBER** (optional) - Your WhatsApp number for reports

### Database Setup

1. Run all migrations in order:
   ```bash
   supabase migration up
   ```

2. Create Storage Bucket:
   - Go to Supabase Dashboard > Storage
   - Create a new bucket named `debtors-files`
   - Set it to **Public** (or configure RLS policies)
   - Enable file size limit (recommended: 10MB)

### Storage Bucket Policies

If using private buckets, add these policies:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'debtors-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'debtors-files' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Edge Functions Setup

Deploy all functions:

```bash
supabase functions deploy process-debtor-screenshot
supabase functions deploy learn-from-edit
supabase functions deploy dev-assistant
supabase functions deploy transcribe-voice
supabase functions deploy send-whatsapp
supabase functions deploy generate-pdf-report
supabase functions deploy regenerate-summary
supabase functions deploy daily-automation
supabase functions deploy weekly-automation
```

### Cron Jobs Setup

Set up scheduled tasks in Supabase Dashboard or via pg_cron:

1. **Daily Automation** (runs at 6 PM daily):
   ```sql
   SELECT cron.schedule(
     'daily-debtor-report',
     '0 18 * * *',
     $$
     SELECT net.http_post(
       url:='https://YOUR_PROJECT.supabase.co/functions/v1/daily-automation',
       headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     );
     $$
   );
   ```

2. **Weekly Automation** (runs every Monday at 9 AM):
   ```sql
   SELECT cron.schedule(
     'weekly-debtor-report',
     '0 9 * * 1',
     $$
     SELECT net.http_post(
       url:='https://YOUR_PROJECT.supabase.co/functions/v1/weekly-automation',
       headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     );
     $$
   );
   ```

### Frontend Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

## 📋 Features Implemented

### ✅ Core Modules

1. **Debtors Intelligence**
   - Screenshot upload and OCR
   - AI-powered financial data extraction
   - Tone-aware summary generation
   - Edit and learn from corrections
   - Regenerate summaries in current tone

2. **Dev Assistant**
   - Context-aware coding assistance
   - Personality-matched responses
   - Context memory with embeddings
   - Supabase/React/Tailwind expertise

3. **Notes & Tasks**
   - Voice note transcription
   - Text notes
   - Task management with priorities
   - Reminders system

4. **Personality Learning**
   - Automatic tone extraction from edits
   - Adaptive learning system
   - Phrasing pattern recognition
   - Word choice preferences
   - Formatting style detection

5. **Automation**
   - Daily PDF reports
   - Weekly analytics reports
   - WhatsApp integration (optional)
   - Reminder notifications

## 🎨 Design System

- **Theme**: Dark minimal with cyan-blue accents
- **UI**: Rounded cards, smooth transitions, subtle shadows
- **Components**: shadcn/ui with custom styling

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- User-specific data isolation
- Secure file uploads with user-based folders
- Authentication required for all operations

## 📝 Notes

- Voice transcription requires browser microphone permissions
- WhatsApp automation requires third-party API setup
- PDF reports are generated as HTML (can be converted to PDF client-side)
- Personality learning improves with each edit

## 🐛 Troubleshooting

1. **Storage bucket not found**: Create `debtors-files` bucket in Supabase Dashboard
2. **Edge functions failing**: Check environment variables are set
3. **Voice transcription not working**: Ensure microphone permissions granted
4. **WhatsApp not sending**: Verify API credentials and URL

## 🔄 Next Steps

1. Configure WhatsApp API provider
2. Set up cron jobs for automation
3. Customize personality settings in Settings dialog
4. Start uploading debtor screenshots to train the AI


