# Bank Statement Upload Feature

## Overview

The Budget Buddy now supports uploading bank statements (images or PDFs) to automatically extract and import multiple transactions at once. This is perfect for bulk importing transactions from bank statements.

## Features

- ✅ Upload bank statement images or PDFs
- ✅ Automatically extract ALL transactions from statements
- ✅ Tag transactions as "Me" or "Wife"
- ✅ Auto-categorize transactions
- ✅ Review and remove transactions before saving
- ✅ Batch save all extracted transactions
- ✅ Support for last 3 months of statements

## How to Use

1. **Go to Budget Buddy** → Click "Upload Bank Statement" button
2. **Select Owner**: Choose "Me" or "Wife" for the statement
3. **Optional**: Enter statement period (e.g., "November 2024") to help AI extract dates
4. **Upload File**: Select a bank statement image or PDF
5. **Extract**: Click "Extract Transactions" to process the statement
6. **Review**: Review all extracted transactions
   - Remove any incorrect transactions by clicking the X button
7. **Save**: Click "Save All" to import all transactions at once

## Deploy the Edge Function

### Via Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"**
3. Function name: `process-bank-statement`
4. Copy the entire code from `supabase/functions/process-bank-statement/index.ts`
5. Paste and click **"Deploy"**

### Via CLI

```bash
npx supabase functions deploy process-bank-statement
```

## Required Environment Variables

Make sure these are set in **Supabase Dashboard** → **Edge Functions** → **Secrets**:

- `SUPABASE_URL` (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY` (automatically set)
- `OPENAI_API_KEY` (recommended - GPT-4 Vision for best accuracy)
- `GEMINI_API_KEY` (free alternative)
- `ANTHROPIC_API_KEY` (optional)

## How It Works

1. **Upload**: User uploads a bank statement (image or PDF)
2. **OCR Processing**: AI vision model (GPT-4 Vision or Gemini) extracts all transactions
3. **Transaction Parsing**: Each transaction is parsed for:
   - Amount (positive for income, negative for expenses)
   - Description/Vendor
   - Date
   - Category (auto-categorized)
   - Type (income/expense)
4. **Review**: User can review and remove transactions
5. **Batch Save**: All transactions are saved to the database at once

## Transaction Format

Extracted transactions include:
- **Type**: "income" or "expense" (based on amount sign)
- **Amount**: Absolute value in Rands
- **Category**: Auto-categorized (groceries, transport, utilities, etc.)
- **Description**: Full transaction description with owner tag
- **Vendor**: First word of description (if available)
- **Date**: Transaction date from statement
- **Source**: "bank_statement"
- **Owner Tag**: "[Wife] " prefix if statement belongs to wife

## Tips for Best Results

1. **Clear Images**: Use high-quality, clear images of statements
2. **Statement Period**: Entering the period (e.g., "November 2024") helps AI extract dates correctly
3. **Review Carefully**: Always review extracted transactions before saving
4. **Remove Duplicates**: If you've already imported some transactions, remove duplicates from the extracted list
5. **Multiple Statements**: Upload each month's statement separately for better organization

## Supported File Formats

- **Images**: JPEG, PNG, GIF, WebP
- **PDFs**: PDF files (converted to images for processing)

## Notes

- Transactions are tagged with "[Wife] " prefix in description if the statement belongs to your wife
- All transactions are saved with the current user's ID (shared account)
- The AI automatically categorizes transactions, but you can edit them after saving
- Large statements may take 30-60 seconds to process

