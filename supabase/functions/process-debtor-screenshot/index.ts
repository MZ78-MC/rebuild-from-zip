import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PersonalityProfile {
  tone_formal: number;
  tone_direct: number;
  tone_empathetic: number;
  phrasing_examples: string[];
  preferred_verbs: string[];
  formatting_style: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[process-debtor-screenshot] Starting request processing");
    const { file_url, file_id } = await req.json();
    console.log("[process-debtor-screenshot] Received file_id:", file_id);

    if (!file_url || !file_id) {
      throw new Error("file_url and file_id are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Download image from Supabase Storage
    console.log("[process-debtor-screenshot] Downloading file from:", file_url.substring(0, 50) + "...");
    let fileResponse;
    try {
      fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
        console.error("[process-debtor-screenshot] File download failed:", fileResponse.status, fileResponse.statusText);
        return new Response(
          JSON.stringify({ error: `Failed to download file: ${fileResponse.status} ${fileResponse.statusText}` }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (fetchError) {
      console.error("[process-debtor-screenshot] File fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: `Failed to download file: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}` }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("[process-debtor-screenshot] Converting blob to base64");
    const imageBlob = await fileResponse.blob();
    const imageBase64 = await blobToBase64(imageBlob);
    console.log("[process-debtor-screenshot] Base64 conversion complete, length:", imageBase64.length);

    // Get personality profile for tone-aware generation
    const { data: profile } = await supabase
      .from("personality_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const personalityProfile: PersonalityProfile = profile || {
      tone_formal: 0.5,
      tone_direct: 0.5,
      tone_empathetic: 0.5,
      phrasing_examples: [],
      preferred_verbs: [],
      formatting_style: {},
    };

    // Build tone instruction
    const toneInstruction = buildToneInstruction(personalityProfile);

    // Get API keys - collect all available keys
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Build list of available API keys in priority order
    // Lovable AI Gateway supports image analysis and is included in subscription
    const availableApis: Array<{ key: string; type: string; useLovable: boolean; useGemini: boolean; useOpenRouter: boolean; useOpenAI: boolean; useAnthropic: boolean }> = [];
    
    // Lovable AI Gateway - excellent for image analysis, included in subscription
    if (lovableApiKey) availableApis.push({ key: lovableApiKey, type: "Lovable AI", useLovable: true, useGemini: false, useOpenRouter: false, useOpenAI: false, useAnthropic: false });
    
    // External image-capable APIs - in priority order for accuracy
    if (openaiApiKey) availableApis.push({ key: openaiApiKey, type: "OpenAI", useLovable: false, useGemini: false, useOpenRouter: false, useOpenAI: true, useAnthropic: false });
    if (anthropicApiKey) availableApis.push({ key: anthropicApiKey, type: "Anthropic", useLovable: false, useGemini: false, useOpenRouter: false, useOpenAI: false, useAnthropic: true });
    if (geminiApiKey) availableApis.push({ key: geminiApiKey, type: "Gemini", useLovable: false, useGemini: true, useOpenRouter: false, useOpenAI: false, useAnthropic: false });
    if (openrouterApiKey) availableApis.push({ key: openrouterApiKey, type: "OpenRouter", useLovable: false, useGemini: false, useOpenRouter: true, useOpenAI: false, useAnthropic: false });

    if (availableApis.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No AI API key configured. Lovable AI is included in your subscription and supports image analysis!"
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[process-debtor-screenshot] Found ${availableApis.length} API key(s) available. Will try in order.`);

    // Try each API key until one works (for quota errors, try next key)
    let lastError: any = null;
    let aiData: any = null;
    let responseText: string = "";

    for (let apiIndex = 0; apiIndex < availableApis.length; apiIndex++) {
      const api = availableApis[apiIndex];
      console.log(`[process-debtor-screenshot] Trying API ${apiIndex + 1}/${availableApis.length}: ${api.type}`);

      // Build request based on API type
    let aiUrl: string;
    let aiHeaders: Record<string, string>;
    let aiBody: any;

      if (api.useLovable) {
        // Lovable AI Gateway - supports image analysis with google/gemini-2.5-pro
        aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        aiHeaders = {
          Authorization: `Bearer ${api.key}`,
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `You are Muzaffar's personal debtors clerk assistant. Analyze debtor account screenshots with maximum accuracy. ${toneInstruction}

Extract: client_name, credit_limit, overdue, balance, summary, urgency (low/medium/high/critical), sentiment (positive/neutral/negative/concerning/urgent).

CRITICAL: All numeric values must be plain numbers without currency symbols or commas. Example: 50000 not R 50,000.00`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this debtor screenshot. Extract all financial data. Return ONLY valid JSON with numeric values as plain numbers.",
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${imageBlob.type};base64,${imageBase64}` },
                },
              ],
            },
          ],
          max_completion_tokens: 2048,
        };
      } else if (api.useOpenAI) {
        // OpenAI GPT-4o (best accuracy for screenshots)
        aiUrl = "https://api.openai.com/v1/chat/completions";
        aiHeaders = {
          Authorization: `Bearer ${api.key}`,
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are Muzaffar's personal debtors clerk assistant. Analyze debtor account screenshots with maximum accuracy and extract all financial information precisely. ${toneInstruction}

CRITICAL EXTRACTION REQUIREMENTS:

1. CLIENT/COMPANY NAME:
   - Extract the exact company/client name as displayed
   - Look for labels: "Client", "Company", "Account Name", "Customer", "Debtor"
   - Example: "ABC Trading Company" or "XYZ Manufacturing Ltd"

2. CREDIT LIMIT:
   - Find credit limit (labeled as: "Credit Limit", "Limit", "CL", "Credit", "Max Credit")
   - Extract as plain decimal number (e.g., 50000.00)
   - Remove ALL currency symbols (R, $, €, £, ¥) and commas
   - Example: "R 50,000.00" → 50000.00

3. OVERDUE AMOUNT:
   - Find overdue amount (labeled as: "Overdue", "Outstanding", "Past Due", "Amount Due", "OD")
   - Extract as plain decimal number (e.g., 12500.50)
   - Remove ALL currency symbols and commas
   - Example: "R 12,500.50" → 12500.50

4. CURRENT BALANCE:
   - Find current balance (labeled as: "Balance", "Current Balance", "Outstanding Balance", "Amount Owing")
   - Extract as plain decimal number (e.g., 35000.00)
   - Remove ALL currency symbols and commas
   - Example: "R 35,000.00" → 35000.00

5. SUMMARY: Generate professional summary in Muzaffar's writing style
6. URGENCY: "low", "medium", "high", or "urgent" based on overdue vs credit limit
7. SENTIMENT: "positive", "neutral", or "negative" based on account status

Return ONLY valid JSON with these exact fields: client_name, credit_limit, overdue, balance, summary, urgency, sentiment.
CRITICAL: All numeric values MUST be plain decimal numbers without currency symbols, commas, or formatting.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this debtor account screenshot with extreme care. Extract all visible financial information including client name, credit limit, overdue amount, and current balance. Return ONLY valid JSON. All numbers must be plain decimals without currency symbols or formatting. Double-check your extraction for accuracy.",
                },
                {
                  type: "image_url",
                  image_url: { 
                    url: `data:${imageBlob.type};base64,${imageBase64}`,
                    detail: "high"
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 2048,
          temperature: 0.2,
        };
      } else if (api.useAnthropic) {
        // Anthropic Claude Sonnet 3.5 (excellent accuracy)
        aiUrl = "https://api.anthropic.com/v1/messages";
        aiHeaders = {
          "x-api-key": api.key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          system: `You are Muzaffar's personal debtors clerk assistant. Analyze debtor account screenshots with maximum accuracy. ${toneInstruction}

Extract: client_name (exact), credit_limit (plain decimal, no currency symbols), overdue (plain decimal), balance (plain decimal), summary (professional), urgency (low/medium/high/urgent), sentiment (positive/neutral/negative).

Return ONLY valid JSON. All numbers must be plain decimals without currency symbols or commas.`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageBlob.type || "image/jpeg",
                    data: imageBase64,
                  },
                },
                {
                  type: "text",
                  text: "Analyze this debtor account screenshot carefully. Extract all financial information. Return ONLY valid JSON with: client_name, credit_limit, overdue, balance, summary, urgency, sentiment. All numbers must be plain decimals without currency symbols or formatting.",
                },
              ],
            },
          ],
        };
      } else if (api.useGemini) {
        // FREE: Gemini (excellent for images)
        aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${api.key}`;
        aiHeaders = { "Content-Type": "application/json" };
        aiBody = {
          contents: [{
            parts: [
              {
                text: `You are Muzaffar's personal debtors clerk assistant. Analyze this debtor account screenshot carefully and extract all financial information with maximum accuracy.

CRITICAL EXTRACTION REQUIREMENTS:

1. CLIENT/COMPANY NAME:
   - Extract the exact company/client name as displayed in the screenshot
   - Look for labels like: "Client", "Company", "Account Name", "Customer", "Debtor"
   - Example: "ABC Trading Company" or "XYZ Manufacturing Ltd"

2. CREDIT LIMIT:
   - Find the credit limit amount (may be labeled as: "Credit Limit", "Limit", "CL", "Credit", "Max Credit")
   - Extract as a plain decimal number (e.g., 50000.00)
   - Remove ALL currency symbols (R, $, €, £, ¥) and commas
   - Example: If screenshot shows "R 50,000.00" → extract as 50000.00
   - If screenshot shows "R50,000" → extract as 50000.00

3. OVERDUE AMOUNT:
   - Find the overdue/outstanding amount (may be labeled as: "Overdue", "Outstanding", "Past Due", "Amount Due", "OD")
   - Extract as a plain decimal number (e.g., 12500.50)
   - Remove ALL currency symbols and commas
   - Example: If screenshot shows "R 12,500.50" → extract as 12500.50

4. CURRENT BALANCE:
   - Find the current/outstanding balance (may be labeled as: "Balance", "Current Balance", "Outstanding Balance", "Amount Owing")
   - Extract as a plain decimal number (e.g., 35000.00)
   - Remove ALL currency symbols and commas
   - Example: If screenshot shows "R 35,000.00" → extract as 35000.00

5. SUMMARY:
   - Generate a professional summary in Muzaffar's personal writing style
   - Include key financial details and account status
   ${toneInstruction}

6. URGENCY:
   - Assess as: "low", "medium", "high", or "urgent"
   - Consider: overdue amount relative to credit limit, payment history, account age

7. SENTIMENT:
   - Assess as: "positive", "neutral", or "negative"
   - Based on account status, payment behavior, and relationship

${toneInstruction}

RETURN FORMAT - Valid JSON only:
{
  "client_name": "Exact Company Name",
  "credit_limit": 50000.00,
  "overdue": 12500.50,
  "balance": 35000.00,
  "summary": "Professional summary text",
  "urgency": "medium",
  "sentiment": "neutral"
}

CRITICAL: All numeric values MUST be plain decimal numbers without currency symbols, commas, or formatting. Double-check your extraction accuracy.`,
              },
              {
                inline_data: {
                  mime_type: imageBlob.type || "image/jpeg",
                  data: imageBase64,
                },
              },
            ],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        };
      } else if (api.useOpenRouter) {
        // OpenRouter (uses free Gemini model)
        aiUrl = "https://openrouter.ai/api/v1/chat/completions";
        aiHeaders = {
          Authorization: `Bearer ${api.key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://muzaffar-assistant.app",
        };
        aiBody = {
          model: "google/gemini-2.0-flash-exp:free",
          messages: [
            {
              role: "system",
              content: `Extract financial data from screenshots accurately. ${toneInstruction} Return JSON: client_name, credit_limit, overdue, balance, summary, urgency, sentiment. IMPORTANT: All numbers must be plain decimals without currency symbols or commas.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this debtor account screenshot. Extract all financial information. Return ONLY valid JSON. All numbers must be plain decimals without currency symbols or formatting.",
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${imageBlob.type};base64,${imageBase64}` },
                },
              ],
            },
          ],
          max_tokens: 2048,
        };
      } else {
        // Fallback - shouldn't reach here but ensure variables are initialized
        throw new Error(`Unknown API type configuration for ${api.type}`);
      }

      console.log("[process-debtor-screenshot] Calling AI API:", aiUrl.substring(0, 50) + "...");
    const aiResponse = await fetch(aiUrl, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify(aiBody),
    });

      console.log("[process-debtor-screenshot] AI API response status:", aiResponse.status);
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
        console.error(`[process-debtor-screenshot] ${api.type} API error:`, aiResponse.status, errorText);
        
        // Try next API for any error (quota, auth, rate limit, etc.)
        if (apiIndex < availableApis.length - 1) {
          console.log(`[process-debtor-screenshot] ${api.type} failed, trying next API...`);
          lastError = { status: aiResponse.status, message: `${api.type} error`, errorText };
          continue; // Try next API
        }
        
        // Last API failed - return error
        let errorMessage = `All AI APIs failed. Last error from ${api.type}: ${aiResponse.status} - ${errorText.substring(0, 200)}`;
        if (aiResponse.status === 429) {
          errorMessage = `All AI APIs hit quota limits. Lovable AI is included in your subscription - it should be working. Check logs for details.`;
        } else if (aiResponse.status === 401 || aiResponse.status === 403) {
          errorMessage = `All AI APIs have authentication issues. Lovable AI should work automatically. Check Edge Functions logs.`;
        } else if (aiResponse.status === 402) {
          errorMessage = `Lovable AI requires credits. Please add credits to your Lovable workspace at Settings → Workspace → Usage.`;
        }
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            details: lastError
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Success! Parse the response
      try {
        aiData = await aiResponse.json();
      } catch (jsonError) {
        if (apiIndex < availableApis.length - 1) {
          console.log(`[process-debtor-screenshot] ${api.type} response parse error, trying next API...`);
          lastError = { status: 500, message: "Failed to parse AI response", error: jsonError };
          continue;
        }
        return new Response(
          JSON.stringify({ error: `Failed to parse AI response: ${jsonError instanceof Error ? jsonError.message : "Unknown error"}` }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    
    // Handle different response formats
    if (api.useGemini) {
      responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (api.useAnthropic) {
      responseText = aiData.content?.[0]?.text || "";
    } else {
      responseText = aiData.choices[0]?.message?.content || "";
    }
      // If we got a response, break out of the loop
      if (responseText) {
        console.log(`[process-debtor-screenshot] Successfully got response from ${api.type}`);
        break;
      } else if (apiIndex < availableApis.length - 1) {
        console.log(`[process-debtor-screenshot] ${api.type} returned empty response, trying next API...`);
        continue;
      }
    }

    // If we exhausted all APIs without success
    if (!responseText) {
      return new Response(
        JSON.stringify({ 
          error: "All AI APIs failed or returned empty responses. Please check your API keys and try again.",
          lastError: lastError
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validation function
    function validateExtractedData(data: any): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      
      // Check for critical fields
      if (!data.client_name || typeof data.client_name !== 'string' || data.client_name.trim() === '') {
        errors.push("Missing or invalid client_name");
      }
      
      // Validate numeric fields (should be numbers or null, not strings with currency)
      const creditLimit = parseCurrency(data.credit_limit);
      const overdue = parseCurrency(data.overdue);
      const balance = parseCurrency(data.balance);
      
      if (creditLimit === null && data.credit_limit !== null && data.credit_limit !== undefined) {
        errors.push("Invalid credit_limit format (contains currency symbols or invalid format)");
      }
      if (overdue === null && data.overdue !== null && data.overdue !== undefined) {
        errors.push("Invalid overdue format (contains currency symbols or invalid format)");
      }
      if (balance === null && data.balance !== null && data.balance !== undefined) {
        errors.push("Invalid balance format (contains currency symbols or invalid format)");
      }
      
      // Validate ranges (reasonable bounds)
      if (creditLimit !== null && (creditLimit < 0 || creditLimit > 1000000000)) {
        errors.push(`Credit limit out of reasonable range: ${creditLimit}`);
      }
      if (overdue !== null && (overdue < 0 || overdue > 1000000000)) {
        errors.push(`Overdue amount out of reasonable range: ${overdue}`);
      }
      if (balance !== null && (balance < 0 || balance > 1000000000)) {
        errors.push(`Balance out of reasonable range: ${balance}`);
      }
      
      // Validate urgency and sentiment
      const validUrgency = ["low", "medium", "high", "urgent"];
      if (data.urgency && !validUrgency.includes(data.urgency.toLowerCase())) {
        errors.push(`Invalid urgency value: ${data.urgency}`);
      }
      
      const validSentiment = ["positive", "neutral", "negative"];
      if (data.sentiment && !validSentiment.includes(data.sentiment.toLowerCase())) {
        errors.push(`Invalid sentiment value: ${data.sentiment}`);
      }
      
      return { valid: errors.length === 0, errors };
    }

    // Clean and parse currency values - remove currency symbols, commas, and convert to numbers
    function parseCurrency(value: any): number | null {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') return value;
      
      // Convert to string and clean
      let cleaned = String(value)
        .replace(/[R$€£¥,\s]/g, '') // Remove currency symbols and commas
        .trim();
      
      // Try to parse as float
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    // Parse JSON response
    let parsedData: any;
    let validationResult: { valid: boolean; errors: string[] } | null = null;
    
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                       responseText.match(/```\n([\s\S]*?)\n```/) ||
                       [null, responseText];
      parsedData = JSON.parse(jsonMatch[1] || responseText);
      
      // Validate extracted data
      validationResult = validateExtractedData(parsedData);
      
      if (!validationResult.valid) {
        console.warn("[process-debtor-screenshot] Data validation failed:", validationResult.errors);
        // Log warnings but continue - we'll use what we have
      } else {
        console.log("[process-debtor-screenshot] Data validation passed");
      }
    } catch (e) {
      console.error("[process-debtor-screenshot] JSON parse error:", e);
      // Fallback parsing
      parsedData = {
        client_name: "Unknown Client",
        credit_limit: 0,
        overdue: 0,
        balance: 0,
        summary: responseText,
        urgency: "medium",
        sentiment: "neutral",
      };
      validationResult = { valid: false, errors: ["Failed to parse JSON response"] };
    }

    // Clean the numeric fields before inserting
    const creditLimit = parseCurrency(parsedData.credit_limit);
    const overdue = parseCurrency(parsedData.overdue);
    const balance = parseCurrency(parsedData.balance);

    console.log("[process-debtor-screenshot] Final parsed values - credit_limit:", creditLimit, "overdue:", overdue, "balance:", balance);
    if (validationResult && !validationResult.valid) {
      console.warn("[process-debtor-screenshot] Validation warnings:", validationResult.errors);
    }

    // Create debtor note
    const { data: note, error: noteError } = await supabase
      .from("debtors_notes")
      .insert({
        file_id,
        user_id: user.id,
        client_name: parsedData.client_name || null,
        credit_limit: creditLimit,
        overdue: overdue,
        balance: balance,
        summary: parsedData.summary || null,
        ai_generated: parsedData.summary || null,
        urgency: parsedData.urgency || "medium",
        sentiment: parsedData.sentiment || "neutral",
      })
      .select()
      .single();

    if (noteError) {
      console.error("Error creating note:", noteError);
      return new Response(
        JSON.stringify({ error: `Failed to create note: ${noteError.message || "Unknown error"}` }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ note }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in process-debtor-screenshot:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        ...(errorStack && { details: errorStack }),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function blobToBase64(blob: Blob): Promise<string> {
  // Convert Blob to ArrayBuffer, then to base64
  // This works in Deno Edge Functions (FileReader doesn't)
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Manual base64 encoding (works in Deno)
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < uint8Array.length) {
    const a = uint8Array[i++];
    const b = i < uint8Array.length ? uint8Array[i++] : 0;
    const c = i < uint8Array.length ? uint8Array[i++] : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += base64Chars.charAt((bitmap >> 18) & 63);
    result += base64Chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < uint8Array.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < uint8Array.length ? base64Chars.charAt(bitmap & 63) : '=';
  }
  
  return result;
}

function buildToneInstruction(profile: PersonalityProfile): string {
  const formality = profile.tone_formal || 0.5;
  const directness = profile.tone_direct || 0.5;
  const empathy = profile.tone_empathetic || 0.5;

  let instruction = "Write with:\n";
  
  if (formality > 0.7) {
    instruction += "- Professional, formal tone\n";
  } else if (formality < 0.3) {
    instruction += "- Casual, conversational tone\n";
  } else {
    instruction += "- Balanced professional tone\n";
  }

  if (directness > 0.7) {
    instruction += "- Concise, direct statements\n";
  } else if (directness < 0.3) {
    instruction += "- Detailed, explanatory style\n";
  }

  if (empathy > 0.7) {
    instruction += "- Empathetic, understanding tone\n";
  }

  if (profile.phrasing_examples && profile.phrasing_examples.length > 0) {
    instruction += `\nExample phrases to match:\n${profile.phrasing_examples.slice(0, 3).join("\n")}\n`;
  }

  if (profile.preferred_verbs && profile.preferred_verbs.length > 0) {
    instruction += `\nPreferred verbs: ${profile.preferred_verbs.slice(0, 5).join(", ")}\n`;
  }

  return instruction;
}
