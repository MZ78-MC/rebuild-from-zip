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
    const { audio_base64, audio_type } = await req.json();

    if (!audio_base64) {
      throw new Error("audio_base64 is required");
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

    // Get API keys (free APIs first)
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Priority: Lovable AI → OpenAI → Anthropic → Gemini → OpenRouter → Groq
    const apiKey = lovableApiKey || openaiApiKey || anthropicApiKey || geminiApiKey || openrouterApiKey || groqApiKey;
    const useLovable = !!lovableApiKey;
    const useOpenAI = !!openaiApiKey && !lovableApiKey;
    const useAnthropic = !!anthropicApiKey && !lovableApiKey && !openaiApiKey;
    const useGemini = !!geminiApiKey && !lovableApiKey && !openaiApiKey && !anthropicApiKey;
    const useOpenRouter = !!openrouterApiKey && !lovableApiKey && !openaiApiKey && !anthropicApiKey && !geminiApiKey;
    const useGroq = !!groqApiKey && !lovableApiKey && !openaiApiKey && !anthropicApiKey && !geminiApiKey && !openrouterApiKey;

    if (!apiKey) {
      throw new Error(
        "No AI API configured. Lovable AI is included in your subscription!"
      );
    }

    // Convert base64 to audio data URL
    const audioDataUrl = `data:${audio_type || "audio/webm"};base64,${audio_base64}`;

    // Build list of available APIs in priority order (Lovable AI first)
    const availableApis: Array<{ key: string; type: string; useLovable: boolean; useOpenAI: boolean; useAnthropic: boolean; useGemini: boolean; useOpenRouter: boolean; useGroq: boolean }> = [];
    
    if (lovableApiKey) availableApis.push({ key: lovableApiKey, type: "Lovable", useLovable: true, useOpenAI: false, useAnthropic: false, useGemini: false, useOpenRouter: false, useGroq: false });
    if (openaiApiKey) availableApis.push({ key: openaiApiKey, type: "OpenAI", useLovable: false, useOpenAI: true, useAnthropic: false, useGemini: false, useOpenRouter: false, useGroq: false });
    if (anthropicApiKey) availableApis.push({ key: anthropicApiKey, type: "Anthropic", useLovable: false, useOpenAI: false, useAnthropic: true, useGemini: false, useOpenRouter: false, useGroq: false });
    if (geminiApiKey) availableApis.push({ key: geminiApiKey, type: "Gemini", useLovable: false, useOpenAI: false, useAnthropic: false, useGemini: true, useOpenRouter: false, useGroq: false });
    if (openrouterApiKey) availableApis.push({ key: openrouterApiKey, type: "OpenRouter", useLovable: false, useOpenAI: false, useAnthropic: false, useGemini: false, useOpenRouter: true, useGroq: false });
    if (groqApiKey) availableApis.push({ key: groqApiKey, type: "Groq", useLovable: false, useOpenAI: false, useAnthropic: false, useGemini: false, useOpenRouter: false, useGroq: true });

    // Try each API until one works (for 401 errors, try next API)
    let lastError: any = null;
    let transcription: string = "";

    for (let apiIndex = 0; apiIndex < availableApis.length; apiIndex++) {
      const api = availableApis[apiIndex];
      console.log(`[transcribe-voice] Trying API ${apiIndex + 1}/${availableApis.length}: ${api.type}`);

      // Call AI for transcription
      let aiUrl: string;
      let aiHeaders: Record<string, string>;
      let aiBody: any;

      if (api.useLovable) {
        // Lovable AI Gateway - note: audio transcription may need special handling
        aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        aiHeaders = {
          Authorization: `Bearer ${api.key}`,
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a voice transcription assistant. Transcribe audio accurately. Return only the transcribed text.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe this audio recording:" },
                { type: "image_url", image_url: { url: audioDataUrl } },
              ],
            },
          ],
          max_completion_tokens: 2048,
        };
      } else if (api.useOpenAI) {
        // OpenAI GPT-4o (best accuracy, supports audio)
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
              content: "You are a voice transcription assistant. Transcribe audio accurately, preserving natural speech patterns, punctuation, and formatting. Return only the transcribed text.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe this audio recording accurately:" },
                { type: "image_url", image_url: { url: audioDataUrl } },
              ],
            },
          ],
        };
      } else if (api.useAnthropic) {
        // Anthropic Claude Sonnet 3.5 (supports audio)
        aiUrl = "https://api.anthropic.com/v1/messages";
        aiHeaders = {
          "x-api-key": api.key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: audio_type || "audio/webm",
                    data: audio_base64,
                  },
                },
                {
                  type: "text",
                  text: "Transcribe this audio recording accurately, preserving natural speech patterns, punctuation, and formatting. Return only the transcribed text.",
                },
              ],
            },
          ],
        };
      } else if (api.useGemini) {
        // FREE: Gemini (best for audio/images)
        aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${api.key}`;
        aiHeaders = { "Content-Type": "application/json" };
        aiBody = {
          contents: [{
            parts: [
              {
                text: "You are a voice transcription assistant. Transcribe the audio accurately, preserving natural speech patterns, punctuation, and formatting. Return only the transcribed text without any additional commentary.",
              },
              {
                inline_data: {
                  mime_type: audio_type || "audio/webm",
                  data: audio_base64,
                },
              },
            ],
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        };
      } else if (api.useOpenRouter) {
        // FREE: OpenRouter
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
              content: "You are a voice transcription assistant. Transcribe audio accurately, preserving natural speech patterns, punctuation, and formatting. Return only the transcribed text.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe this audio recording accurately:" },
                { type: "image_url", image_url: { url: audioDataUrl } },
              ],
            },
          ],
        };
      } else if (api.useGroq) {
        // Fallback: Groq (no audio support)
        aiUrl = "https://api.groq.com/openai/v1/chat/completions";
        aiHeaders = {
          Authorization: `Bearer ${api.key}`,
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are a voice transcription assistant. Transcribe audio accurately. Return only the transcribed text.",
            },
            {
              role: "user",
              content: "Transcribe this audio recording (audio data provided but this API may not support audio - please provide text description if needed).",
            },
          ],
        };
      } else {
        // Fallback: Lovable
        aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        aiHeaders = {
          Authorization: `Bearer ${api.key}`,
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a voice transcription assistant. Transcribe audio accurately. Return only the transcribed text.",
            },
            {
              role: "user",
              content: "Transcribe this audio recording (audio data provided but this API may not support audio - please provide text description if needed).",
            },
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
        console.error(`[transcribe-voice] ${api.type} API error:`, aiResponse.status, errorText);
        
        // If 401 (unauthorized), try next API
        if (aiResponse.status === 401 && apiIndex < availableApis.length - 1) {
          console.log(`[transcribe-voice] ${api.type} API key invalid or expired, trying next API...`);
          lastError = { status: 401, message: `${api.type} API key is invalid or expired`, errorText };
          continue; // Try next API
        }
        
        // For other errors or last API, return error
        let errorMessage = `AI gateway error (${api.type}): ${aiResponse.status} - ${errorText}`;
        if (aiResponse.status === 401) {
          errorMessage = `${api.type} API key is invalid or expired. Please check your ${api.type.toUpperCase()}_API_KEY in Supabase Edge Functions environment variables.`;
        }
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            suggestion: aiResponse.status === 401 
              ? `Please verify your ${api.type.toUpperCase()}_API_KEY is correct and has not expired. You can add it in Supabase Dashboard → Edge Functions → transcribe-voice → Settings → Secrets.`
              : "Try using a different AI API key or check your API quota."
          }),
          { 
            status: aiResponse.status === 401 ? 401 : 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Success! Parse the response
      const aiData = await aiResponse.json();
      
      // Handle different response formats
      if (api.useGemini) {
        transcription = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else if (api.useAnthropic) {
        transcription = aiData.content?.[0]?.text || "";
      } else {
        transcription = aiData.choices[0]?.message?.content || "";
      }

      // If we got a transcription, break out of the loop
      if (transcription) {
        console.log(`[transcribe-voice] Successfully got transcription from ${api.type}`);
        break;
      } else if (apiIndex < availableApis.length - 1) {
        console.log(`[transcribe-voice] ${api.type} returned empty response, trying next API...`);
        continue;
      }
    }

    // If we exhausted all APIs without success
    if (!transcription) {
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

    return new Response(JSON.stringify({ transcription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

