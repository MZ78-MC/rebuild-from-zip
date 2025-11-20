import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { image_base64, image_url } = await req.json();

    if (!image_base64 && !image_url) {
      throw new Error("image_base64 or image_url is required");
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

    // Get API keys - Prioritize Lovable AI (included in subscription)
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    // For receipt OCR with vision, prefer Lovable AI → OpenAI → Gemini → Anthropic
    const apiKey = lovableApiKey || openaiApiKey || geminiApiKey || anthropicApiKey;
    const useLovable = !!lovableApiKey;
    const useOpenAI = !!openaiApiKey && !lovableApiKey;
    const useGemini = !!geminiApiKey && !lovableApiKey && !openaiApiKey;
    const useAnthropic = !!anthropicApiKey && !lovableApiKey && !openaiApiKey && !geminiApiKey;

    if (!apiKey) {
      throw new Error(
        "No AI API key configured. Lovable AI is included in your subscription and supports image analysis!"
      );
    }

    // Prepare image data
    let imageData: string;
    let mimeType = "image/jpeg";

    if (image_base64) {
      // Remove data URL prefix if present
      if (image_base64.startsWith("data:")) {
        const parts = image_base64.split(",");
        mimeType = parts[0].split(";")[0].split(":")[1];
        imageData = parts[1];
      } else {
        imageData = image_base64;
      }
    } else if (image_url) {
      // Fetch image and convert to base64
      const imageResponse = await fetch(image_url);
      const imageBlob = await imageResponse.blob();
      const arrayBuffer = await imageBlob.arrayBuffer();
      imageData = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      mimeType = imageBlob.type || "image/jpeg";
    } else {
      throw new Error("No image data provided");
    }

    // Call AI with vision to extract receipt data
    let extractedData: any = null;

    if (useLovable) {
      // Lovable AI Gateway with vision support
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `Extract receipt data: total_amount (number in Rands), vendor (string), date (YYYY-MM-DD), category (groceries/transport/utilities/rent/entertainment/dining/shopping/healthcare/education/other), items (optional array). Return ONLY valid JSON.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all information from this receipt image. Return valid JSON only." },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageData}` } },
              ],
            },
          ],
          max_completion_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          throw new Error("Lovable AI rate limit exceeded. Please try again in a moment.");
        } else if (response.status === 402) {
          throw new Error("Lovable AI requires credits. Please add credits at Settings → Workspace → Usage.");
        }
        throw new Error(`Lovable AI error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";
      extractedData = JSON.parse(content);
    } else if (useOpenAI) {
      // OpenAI GPT-4 Vision
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a receipt OCR assistant. Extract the following information from the receipt image:
- total_amount: The total amount paid (as a number, in Rands)
- vendor: The store/vendor name
- date: The date on the receipt (YYYY-MM-DD format)
- category: One of: groceries, transport, utilities, rent, entertainment, dining, shopping, healthcare, education, other
- items: Array of items purchased (optional, if visible)

Respond ONLY with valid JSON in this format:
{
  "total_amount": number,
  "vendor": "string",
  "date": "YYYY-MM-DD",
  "category": "string",
  "items": ["item1", "item2"]
}`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all information from this receipt.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageData}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "{}";
      extractedData = JSON.parse(content);
    } else if (useGemini) {
      // Google Gemini Vision
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Extract receipt information. Respond ONLY with valid JSON:
{
  "total_amount": number,
  "vendor": "string",
  "date": "YYYY-MM-DD",
  "category": "string",
  "items": ["item1", "item2"]
}`,
                  },
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
              maxOutputTokens: 500,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content =
        data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      extractedData = JSON.parse(content);
    } else if (useAnthropic) {
      // Anthropic Claude with vision
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 500,
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
                {
                  type: "text",
                  text: `Extract receipt information. Respond ONLY with valid JSON:
{
  "total_amount": number,
  "vendor": "string",
  "date": "YYYY-MM-DD",
  "category": "string",
  "items": ["item1", "item2"]
}`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || "{}";
      extractedData = JSON.parse(content);
    }

    if (!extractedData || !extractedData.total_amount) {
      throw new Error("Failed to extract receipt data from image");
    }

    // Create transaction entry (but don't save yet - let user confirm)
    const transactionData = {
      type: "expense" as const,
      amount: parseFloat(extractedData.total_amount),
      category: extractedData.category || "other",
      vendor: extractedData.vendor || null,
      description: extractedData.items
        ? `Items: ${extractedData.items.join(", ")}`
        : `Receipt from ${extractedData.vendor || "vendor"}`,
      date: extractedData.date
        ? new Date(extractedData.date).toISOString()
        : new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({
        success: true,
        extracted: extractedData,
        transaction: transactionData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

