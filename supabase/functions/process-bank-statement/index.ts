import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { file_base64, file_url, owner, statement_date, file_type, image_base64, image_url } = requestBody;

    // Support both old parameter names (for backward compatibility) and new ones
    const fileBase64 = file_base64 || image_base64;
    const fileUrl = file_url || image_url;
    const detectedFileType = file_type || "image";

    if (!fileBase64 && !fileUrl) {
      throw new Error("file_base64 or file_url is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get API keys - Prioritize Lovable AI (included in subscription, supports vision)
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");

    // Build API list in priority order (Lovable → OpenAI → Anthropic → Gemini → OpenRouter)
    const availableApis: Array<{
      type: string;
      key: string;
      useLovable: boolean;
      useOpenAI: boolean;
      useAnthropic: boolean;
      useGemini: boolean;
      useOpenRouter: boolean;
    }> = [];

    if (lovableApiKey) {
      availableApis.push({ type: "Lovable", key: lovableApiKey, useLovable: true, useOpenAI: false, useAnthropic: false, useGemini: false, useOpenRouter: false });
    }
    if (openaiApiKey) {
      availableApis.push({ type: "OpenAI", key: openaiApiKey, useLovable: false, useOpenAI: true, useAnthropic: false, useGemini: false, useOpenRouter: false });
    }
    if (anthropicApiKey) {
      availableApis.push({ type: "Anthropic", key: anthropicApiKey, useLovable: false, useOpenAI: false, useAnthropic: true, useGemini: false, useOpenRouter: false });
    }
    if (geminiApiKey) {
      availableApis.push({ type: "Gemini", key: geminiApiKey, useLovable: false, useOpenAI: false, useAnthropic: false, useGemini: true, useOpenRouter: false });
    }
    if (openrouterApiKey) {
      availableApis.push({ type: "OpenRouter", key: openrouterApiKey, useLovable: false, useOpenAI: false, useAnthropic: false, useGemini: false, useOpenRouter: true });
    }

    if (availableApis.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          requiresManualEntry: true,
          error: "No AI API configured. Lovable AI is included in your subscription!",
          transactions: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle Excel files first
    if (detectedFileType === "excel" || (fileBase64 && fileBase64.includes("PK")) || (fileUrl && fileUrl.toLowerCase().endsWith('.xlsx'))) {
      // Parse Excel file
      let excelBuffer: Uint8Array;
      
      if (fileBase64) {
        // Remove data URL prefix if present
        let base64Data = fileBase64;
        if (fileBase64.startsWith("data:")) {
          const parts = fileBase64.split(",");
          base64Data = parts[1];
        }
        // Convert base64 to Uint8Array
        const binaryString = atob(base64Data);
        excelBuffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          excelBuffer[i] = binaryString.charCodeAt(i);
        }
      } else if (fileUrl) {
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        excelBuffer = new Uint8Array(arrayBuffer);
      } else {
        throw new Error("No file data provided");
      }

      // Parse Excel workbook
      const workbook = XLSX.read(excelBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON array
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
      
      // Find header row (look for Date, Description, Debit, Credit with flexible matching)
      let headerRowIndex = -1;
      let dateColIndex = -1;
      let descriptionColIndex = -1;
      let debitColIndex = -1;
      let creditColIndex = -1;
      
      // Try to find header row in first 20 rows
      for (let i = 0; i < Math.min(20, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        // Check if this row contains headers (more flexible matching)
        const rowLower = row.map((cell: any) => String(cell || "").toLowerCase().trim());
        
        // Try various date column names
        const dateIdx = rowLower.findIndex((cell: string) => 
          cell.includes("date") || cell.includes("datum") || cell === "dt" || cell === "d"
        );
        
        // Try various description column names
        const descIdx = rowLower.findIndex((cell: string) => 
          cell.includes("description") || cell.includes("desc") || cell.includes("details") || 
          cell.includes("transaction") || cell.includes("narration") || cell.includes("particulars") ||
          cell.includes("merchant") || cell.includes("vendor") || cell === "desc"
        );
        
        // Try various debit column names
        const debitIdx = rowLower.findIndex((cell: string) => 
          cell.includes("debit") || cell.includes("withdrawal") || cell.includes("out") ||
          cell.includes("paid") || cell.includes("expense") || cell === "dr" || cell === "db"
        );
        
        // Try various credit column names
        const creditIdx = rowLower.findIndex((cell: string) => 
          cell.includes("credit") || cell.includes("deposit") || cell.includes("in") ||
          cell.includes("received") || cell.includes("income") || cell === "cr"
        );
        
        // We need at least Date and Description, and either Debit or Credit
        if (dateIdx >= 0 && descIdx >= 0 && (debitIdx >= 0 || creditIdx >= 0)) {
          headerRowIndex = i;
          dateColIndex = dateIdx;
          descriptionColIndex = descIdx;
          debitColIndex = debitIdx >= 0 ? debitIdx : -1;
          creditColIndex = creditIdx >= 0 ? creditIdx : -1;
          break;
        }
      }
      
      // If still not found, try to detect by data patterns (first row with date-like values)
      if (headerRowIndex === -1) {
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row || row.length < 3) continue;
          
          // Check if first column looks like a date
          const firstCell = String(row[0] || "").trim();
          const dateMatch = firstCell.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/) || 
                           firstCell.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/);
          
          if (dateMatch && row.length >= 4) {
            // Assume standard format: Date, Description, Debit, Credit
            headerRowIndex = i - 1; // Previous row is likely header
            dateColIndex = 0;
            descriptionColIndex = 1;
            debitColIndex = 2;
            creditColIndex = 3;
            
            // Verify by checking if previous row has text headers
            if (i > 0) {
              const prevRow = jsonData[i - 1];
              if (prevRow && prevRow.length > 0) {
                const prevRowLower = prevRow.map((cell: any) => String(cell || "").toLowerCase().trim());
                // If previous row has text that looks like headers, use it
                if (prevRowLower.some(cell => cell.length > 0 && cell.length < 20)) {
                  headerRowIndex = i - 1;
                  // Try to map columns
                  const dateHdr = prevRowLower.findIndex(c => c.includes("date") || c.includes("datum"));
                  const descHdr = prevRowLower.findIndex(c => c.includes("desc") || c.includes("transaction") || c.includes("details"));
                  const debitHdr = prevRowLower.findIndex(c => c.includes("debit") || c.includes("withdrawal") || c.includes("out"));
                  const creditHdr = prevRowLower.findIndex(c => c.includes("credit") || c.includes("deposit") || c.includes("in"));
                  
                  if (dateHdr >= 0) dateColIndex = dateHdr;
                  if (descHdr >= 0) descriptionColIndex = descHdr;
                  if (debitHdr >= 0) debitColIndex = debitHdr;
                  if (creditHdr >= 0) creditColIndex = creditHdr;
                }
              }
            }
            break;
          }
        }
      }
      
      if (headerRowIndex === -1 || dateColIndex === -1 || descriptionColIndex === -1) {
        // Provide helpful error with sample of what we found
        const sampleRows = jsonData.slice(0, 5).map((row, idx) => 
          `Row ${idx}: ${row?.slice(0, 4).map((c: any) => String(c || "").substring(0, 20)).join(" | ")}`
        ).join("\n");
        
        throw new Error(
          `Could not find header row in Excel file.\n` +
          `Expected columns: Date, Description, Debit, Credit\n` +
          `Found in first 5 rows:\n${sampleRows}\n` +
          `Please ensure your Excel file has a header row with Date, Description, Debit, and Credit columns.`
        );
      }
      
      // Extract transactions
      const extractedTransactions: any[] = [];
      
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        const dateStr = String(row[dateColIndex] || "").trim();
        const description = String(row[descriptionColIndex] || "").trim();
        const debitStr = debitColIndex >= 0 ? String(row[debitColIndex] || "").trim() : "";
        const creditStr = creditColIndex >= 0 ? String(row[creditColIndex] || "").trim() : "";
        
        // Skip empty rows
        if (!dateStr && !description && !debitStr && !creditStr) continue;
        
        // Parse date
        let date: Date;
        try {
          // Try parsing as Excel date number first
          const excelDateNum = parseFloat(dateStr);
          if (!isNaN(excelDateNum) && excelDateNum > 25569) {
            // Excel date (days since 1900-01-01)
            date = new Date((excelDateNum - 25569) * 86400 * 1000);
          } else {
            date = new Date(dateStr);
          }
          
          if (isNaN(date.getTime())) {
            continue; // Skip invalid dates
          }
        } catch {
          continue; // Skip rows with invalid dates
        }
        
        // Parse amounts (remove "R" prefix and whitespace)
        const debitAmount = parseFloat(debitStr.replace(/[R\s,]/g, "")) || 0;
        const creditAmount = parseFloat(creditStr.replace(/[R\s,]/g, "")) || 0;
        
        // Determine transaction type and amount
        let amount = 0;
        let type: "income" | "expense" = "expense";
        
        if (debitAmount > 0) {
          amount = debitAmount;
          type = "expense";
        } else if (creditAmount > 0) {
          amount = creditAmount;
          type = "income";
        } else {
          continue; // Skip rows with no amount
        }
        
        // Auto-categorize based on description
        const descLower = description.toLowerCase();
        let category = "other";
        
        if (descLower.includes("grocery") || descLower.includes("pick n pay") || descLower.includes("checkers") || descLower.includes("woolworths") || descLower.includes("spar")) {
          category = "groceries";
        } else if (descLower.includes("petrol") || descLower.includes("shell") || descLower.includes("engen") || descLower.includes("bp") || descLower.includes("fuel")) {
          category = "transport";
        } else if (descLower.includes("pharmacy") || descLower.includes("medical") || descLower.includes("health")) {
          category = "healthcare";
        } else if (descLower.includes("restaurant") || descLower.includes("kfc") || descLower.includes("mcdonald") || descLower.includes("dining") || descLower.includes("food")) {
          category = "dining";
        } else if (descLower.includes("salary") || descLower.includes("income") || descLower.includes("interest") || descLower.includes("deposit")) {
          category = type === "income" ? "salary" : category;
        } else if (descLower.includes("electricity") || descLower.includes("water") || descLower.includes("utility")) {
          category = "utilities";
        } else if (descLower.includes("rent") || descLower.includes("housing")) {
          category = "rent";
        } else if (descLower.includes("entertainment") || descLower.includes("movie") || descLower.includes("netflix")) {
          category = "entertainment";
        } else if (descLower.includes("shopping") || descLower.includes("mall")) {
          category = "shopping";
        }
        
        extractedTransactions.push({
          type: type,
          amount: amount,
          category: category,
          description: description,
          vendor: description.split(" ")[0] || null,
          date: date.toISOString().split("T")[0],
          owner: owner || "me",
          source: "bank_statement",
        });
      }
      
      // Normalize and return transactions
      const normalizedTransactions = extractedTransactions
        .filter((tx) => tx.amount > 0 && tx.description && tx.date);
      
      if (normalizedTransactions.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            requiresManualEntry: true,
            error: "No valid transactions found in Excel file. Please check the file format.",
            transactions: [],
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          transactions: normalizedTransactions,
          count: normalizedTransactions.length,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Original image/PDF processing code
    // Prepare image data
    let imageData: string;
    let mimeType = "image/jpeg";

    if (fileBase64) {
      // Remove data URL prefix if present
      if (fileBase64.startsWith("data:")) {
        const parts = fileBase64.split(",");
        mimeType = parts[0].split(";")[0].split(":")[1];
        imageData = parts[1];
      } else {
        // Raw base64 provided. Detect PDF magic header (JVBER...)
        imageData = fileBase64;
        if (fileBase64.startsWith("JVBER")) {
          mimeType = "application/pdf";
        }
      }
    } else if (fileUrl) {
      // Fetch image and convert to base64
      const imageResponse = await fetch(fileUrl);
      const imageBlob = await imageResponse.blob();
      const arrayBuffer = await imageBlob.arrayBuffer();
      imageData = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      mimeType = imageBlob.type || (fileUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    } else {
      throw new Error("No file data provided");
    }

    // Call AI with vision to extract bank statement transactions
    // Try each API in sequence until one succeeds
    let extractedTransactions: any[] = [];
    let lastError: Error | null = null;
    const systemPrompt = `You are a bank statement OCR assistant. Extract ALL transactions from this bank statement image. 

For each transaction, extract:
- amount: The transaction amount (positive for deposits/income, negative for withdrawals/expenses, as a number in Rands)
- description: The transaction description/vendor name
- date: The transaction date (YYYY-MM-DD format)
- category: One of: groceries, transport, utilities, rent, entertainment, dining, shopping, healthcare, education, salary, freelance, other
- type: "income" if amount is positive (deposits, salary, etc.), "expense" if negative (withdrawals, purchases, etc.)

Respond ONLY with valid JSON array in this format:
[
  {
    "amount": number,
    "description": "string",
    "date": "YYYY-MM-DD",
    "category": "string",
    "type": "income" | "expense"
  },
  ...
]

If you cannot find any transactions, return an empty array [].`;

    const userPrompt = `Extract all transactions from this bank statement. ${statement_date ? `The statement period is around ${statement_date}.` : ""}`;

    // Try each API in priority order
    for (let apiIndex = 0; apiIndex < availableApis.length; apiIndex++) {
      const api = availableApis[apiIndex];
      console.log(`[process-bank-statement] Trying ${api.type} API (${apiIndex + 1}/${availableApis.length})`);

      try {
        let aiResponse: Response;
        let responseData: any;

        if (api.useLovable) {
          // Lovable AI Gateway with vision support
          aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${api.key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: userPrompt },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageData}` } },
                  ],
                },
              ],
              max_completion_tokens: 4096,
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            if (aiResponse.status === 429) {
              throw new Error("Lovable AI rate limit exceeded");
            } else if (aiResponse.status === 402) {
              throw new Error("Lovable AI requires credits. Please add credits at Settings → Workspace → Usage.");
            }
            throw new Error(`Lovable AI error (${aiResponse.status}): ${errorText}`);
          }

          responseData = await aiResponse.json();
          const content = responseData.choices[0]?.message?.content || "[]";

          try {
            extractedTransactions = JSON.parse(content);
            if (!Array.isArray(extractedTransactions)) {
              extractedTransactions = [];
            }
          } catch (e) {
            console.error(`[process-bank-statement] Failed to parse Lovable response:`, e);
            throw new Error("Failed to parse Lovable response");
          }
        } else if (api.useOpenAI) {
          // OpenAI GPT-4 Vision
          aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${api.key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: userPrompt },
                    {
                      type: "image_url",
                      image_url: { url: `data:${mimeType};base64,${imageData}` },
                    },
                  ],
                },
              ],
              max_tokens: 4000,
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`OpenAI API error: ${aiResponse.status} - ${errorText}`);
          }

          responseData = await aiResponse.json();
          const content = responseData.choices?.[0]?.message?.content || "[]";
          
          try {
            extractedTransactions = JSON.parse(content);
            if (!Array.isArray(extractedTransactions)) {
              extractedTransactions = [];
            }
          } catch (e) {
            console.error(`[process-bank-statement] Failed to parse OpenAI response:`, e);
            throw new Error("Failed to parse OpenAI response");
          }
        } else if (api.useAnthropic) {
          // Anthropic Claude with vision
          aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": api.key,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 4000,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: mimeType,
                        data: imageData,
                      },
                    },
                    { type: "text", text: `${systemPrompt}\n\n${userPrompt}` },
                  ],
                },
              ],
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`Anthropic API error: ${aiResponse.status} - ${errorText}`);
          }

          responseData = await aiResponse.json();
          const content = responseData.content?.[0]?.text || "[]";
          
          try {
            extractedTransactions = JSON.parse(content);
            if (!Array.isArray(extractedTransactions)) {
              extractedTransactions = [];
            }
          } catch (e) {
            console.error(`[process-bank-statement] Failed to parse Anthropic response:`, e);
            throw new Error("Failed to parse Anthropic response");
          }
        } else if (api.useGemini) {
          // Google Gemini Vision
          aiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${api.key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: `${systemPrompt}\n\n${userPrompt}` },
                      {
                        inline_data: {
                          mime_type: mimeType,
                          data: imageData,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 4000,
                },
              }),
            }
          );

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`Gemini API error: ${aiResponse.status} - ${errorText}`);
          }

          responseData = await aiResponse.json();
          const content = responseData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
          
          try {
            extractedTransactions = JSON.parse(content);
            if (!Array.isArray(extractedTransactions)) {
              extractedTransactions = [];
            }
          } catch (e) {
            console.error(`[process-bank-statement] Failed to parse Gemini response:`, e);
            throw new Error("Failed to parse Gemini response");
          }
        } else if (api.useOpenRouter) {
          // OpenRouter - use Gemini model with vision support
          aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${api.key}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://muzaffar-assistant.app",
            },
            body: JSON.stringify({
              model: "google/gemini-2.0-flash-exp:free",
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: userPrompt },
                    {
                      type: "image_url",
                      image_url: { url: `data:${mimeType};base64,${imageData}` },
                    },
                  ],
                },
              ],
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`OpenRouter API error: ${aiResponse.status} - ${errorText}`);
          }

          responseData = await aiResponse.json();
          const content = responseData.choices?.[0]?.message?.content || "[]";
          
          try {
            extractedTransactions = JSON.parse(content);
            if (!Array.isArray(extractedTransactions)) {
              extractedTransactions = [];
            }
          } catch (e) {
            console.error(`[process-bank-statement] Failed to parse OpenRouter response:`, e);
            throw new Error("Failed to parse OpenRouter response");
          }
        } else {
          // Lovable AI gateway (uses Gemini)
          aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${api.key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: userPrompt },
                    {
                      type: "image_url",
                      image_url: { url: `data:${mimeType};base64,${imageData}` },
                    },
                  ],
                },
              ],
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`Lovable API error: ${aiResponse.status} - ${errorText}`);
          }

          responseData = await aiResponse.json();
          const content = responseData.choices?.[0]?.message?.content || "[]";
          
          try {
            extractedTransactions = JSON.parse(content);
            if (!Array.isArray(extractedTransactions)) {
              extractedTransactions = [];
            }
          } catch (e) {
            console.error(`[process-bank-statement] Failed to parse Lovable response:`, e);
            throw new Error("Failed to parse Lovable response");
          }
        }

        // If we got transactions, break out of the loop
        if (extractedTransactions.length > 0) {
          console.log(`[process-bank-statement] Successfully extracted ${extractedTransactions.length} transactions using ${api.type}`);
          break;
        } else {
          console.log(`[process-bank-statement] ${api.type} returned empty transactions, trying next API...`);
          // Continue to next API if this one returned empty
          if (apiIndex < availableApis.length - 1) {
            continue;
          }
        }
      } catch (error) {
        console.error(`[process-bank-statement] ${api.type} API failed:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If this is the last API, we'll handle it after the loop
        if (apiIndex < availableApis.length - 1) {
          console.log(`[process-bank-statement] Trying next API...`);
          continue;
        }
      }
    }

    // Check if we got any transactions
    if (extractedTransactions.length === 0) {
      // All APIs failed or returned empty - require manual entry
      const errorMessage = lastError 
        ? `All vision APIs failed. Last error: ${lastError.message}`
        : "No transactions could be extracted from the bank statement. The image may be unclear or the statement format is not recognized.";
      
      return new Response(
        JSON.stringify({
          success: false,
          requiresManualEntry: true,
          error: errorMessage,
          transactions: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Process and normalize transactions
    const normalizedTransactions = extractedTransactions
      .filter((tx) => tx.amount && tx.description && tx.date)
      .map((tx) => {
        const amount = Math.abs(parseFloat(tx.amount));
        const type = tx.type || (parseFloat(tx.amount) >= 0 ? "income" : "expense");
        
        return {
          type: type as "income" | "expense",
          amount: amount,
          category: (tx.category || "other").toLowerCase(),
          description: tx.description,
          vendor: tx.description.split(" ")[0] || null,
          date: tx.date || new Date().toISOString().split("T")[0],
          owner: owner || "me",
          source: "bank_statement",
        };
      });

    // If after normalization we have no valid transactions, require manual entry
    if (normalizedTransactions.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          requiresManualEntry: true,
          error: "Extracted transactions were invalid or incomplete. Please use manual entry.",
          transactions: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactions: normalizedTransactions,
        count: normalizedTransactions.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    // For non-auth/config errors, return requiresManualEntry so user can use CSV
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isConfigError = errorMessage.includes("Missing Supabase") || 
                         errorMessage.includes("No authorization") ||
                         errorMessage.includes("User not authenticated");
    
    return new Response(
      JSON.stringify({
        success: false,
        requiresManualEntry: !isConfigError,
        error: errorMessage,
        transactions: [],
      }),
      {
        status: isConfigError ? 500 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

