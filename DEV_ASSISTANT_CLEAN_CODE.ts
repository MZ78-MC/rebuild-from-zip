import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      throw new Error("Query is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // Free AI APIs (priority order)
    const groqApiKey = Deno.env.get("GROQ_API_KEY"); // FREE: 14k requests/day
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY"); // FREE: Google AI Studio
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY"); // FREE: 1000 credits
    
    // Paid options (fallback)
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Priority: Free APIs first, then paid
    const apiKey = groqApiKey || geminiApiKey || openrouterApiKey || openaiApiKey || anthropicApiKey || lovableApiKey;
    const useGroq = !!groqApiKey;
    const useGemini = !!geminiApiKey && !groqApiKey;
    const useOpenRouter = !!openrouterApiKey && !groqApiKey && !geminiApiKey;
    const useOpenAI = !!openaiApiKey && !groqApiKey && !geminiApiKey && !openrouterApiKey;
    const useAnthropic = !!anthropicApiKey && !groqApiKey && !geminiApiKey && !openrouterApiKey && !openaiApiKey;

    if (!apiKey) {
      throw new Error(
        "No AI API key found. FREE options: Get GROQ_API_KEY (14k/day free) from https://console.groq.com/keys or GEMINI_API_KEY (free) from https://aistudio.google.com/apikey"
      );
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

    // Get personality profile for tone matching
    const { data: profile } = await supabase
      .from("personality_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Get relevant context from past queries
    const { data: recentContext } = await supabase
      .from("context_memory")
      .select("query, response, context")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Build context from recent queries
    let contextMessages = "";
    if (recentContext && recentContext.length > 0) {
      contextMessages = "\n\nRecent relevant context:\n";
      recentContext.forEach((ctx, idx) => {
        contextMessages += `${idx + 1}. Q: ${ctx.query}\n   A: ${ctx.response}\n\n`;
      });
    }

    // Build tone instruction from personality profile
    let toneInstruction = "";
    if (profile) {
      const formality = profile.tone_formal || 0.5;
      const directness = profile.tone_direct || 0.5;

      if (formality > 0.7) {
        toneInstruction += "Use a professional, formal tone. ";
      } else if (formality < 0.3) {
        toneInstruction += "Use a casual, conversational tone. ";
      }

      if (directness > 0.7) {
        toneInstruction += "Be concise and direct. ";
      }

      if (profile.phrasing_examples && Array.isArray(profile.phrasing_examples) && profile.phrasing_examples.length > 0) {
        toneInstruction += `Example phrases to match: ${profile.phrasing_examples.slice(0, 3).join(", ")}. `;
      }
    }

    // Call AI with context
    const systemPrompt = `You are Muzaffar's personal dev assistant. You help with Supabase, React, TypeScript, Tailwind CSS, and Lovable development. ${toneInstruction}Be concise, technical, and match Muzaffar's coding style.${contextMessages}`;

    let aiUrl: string;
    let aiHeaders: Record<string, string>;
    let aiBody: any;

    if (useGroq) {
      // FREE: Groq API (14k requests/day free)
      aiUrl = "https://api.groq.com/openai/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "llama-3.1-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      };
    } else if (useGemini) {
      // FREE: Google Gemini API
      aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      aiHeaders = {
        "Content-Type": "application/json",
      };
      aiBody = {
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nUser question: ${query}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      };
    } else if (useOpenRouter) {
      // FREE: OpenRouter (1000 free credits)
      aiUrl = "https://openrouter.ai/api/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://muzaffar-assistant.app",
      };
      aiBody = {
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      };
    } else if (useOpenAI) {
      // Paid: OpenAI API
      aiUrl = "https://api.openai.com/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      };
    } else if (useAnthropic) {
      // Paid: Anthropic API
      aiUrl = "https://api.anthropic.com/v1/messages";
      aiHeaders = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [
          { role: "user", content: `${systemPrompt}\n\nUser question: ${query}` },
        ],
      };
    } else {
      // Fallback to Lovable gateway
      aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      };
    }

    const aiResponse = await fetch(aiUrl, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify(aiBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 401) {
        throw new Error(
          "API key is invalid or missing. Please check your Supabase Edge Functions environment variables (GEMINI_API_KEY, GROQ_API_KEY, etc.)."
        );
      }
      
      throw new Error(`AI gateway error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    
    // Handle different API response formats
    let response: string;
    if (useGemini) {
      response = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
    } else if (useAnthropic) {
      response = aiData.content?.[0]?.text || "No response generated";
    } else {
      response = aiData.choices[0]?.message?.content || "No response generated";
    }

    // Generate embedding for the query (optional - only if OpenAI key is available)
    let embedding: number[] | null = null;
    if (useOpenAI && openaiApiKey) {
      try {
        const embeddingResponse = await fetch(
          "https://api.openai.com/v1/embeddings",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "text-embedding-3-small",
              input: query,
            }),
          }
        );

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          embedding = embeddingData.data[0]?.embedding || null;
        }
      } catch (e) {
        console.error("Embedding generation failed:", e);
      }
    }

    // Save to dev_memory (don't fail if this errors)
    try {
      await supabase.from("dev_memory").insert({
        user_id: user.id,
        query,
        response,
        context: "dev-assistant",
      });
    } catch (memoryError) {
      console.error("Failed to save to dev_memory (non-critical):", memoryError);
    }

    // Save to context_memory with embedding (optional, don't fail if it errors)
    try {
      const embeddingData = embedding ? `[${embedding.join(",")}]` : null;
      await supabase.from("context_memory").insert({
        user_id: user.id,
        query,
        response,
        context: "dev-assistant",
        embedding: embeddingData,
      } as any);
    } catch (contextError) {
      console.error("Failed to save to context_memory (non-critical):", contextError);
    }

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});


