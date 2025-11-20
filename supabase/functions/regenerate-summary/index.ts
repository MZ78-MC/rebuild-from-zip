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
    const { note_id } = await req.json();

    if (!note_id) {
      throw new Error("note_id is required");
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

    // Get the note
    const { data: note, error: noteError } = await supabase
      .from("debtors_notes")
      .select("*")
      .eq("id", note_id)
      .eq("user_id", user.id)
      .single();

    if (noteError || !note) {
      throw new Error("Note not found");
    }

    // Get current personality profile
    const { data: profile } = await supabase
      .from("personality_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const personalityProfile = profile || {
      tone_formal: 0.5,
      tone_direct: 0.5,
      tone_empathetic: 0.5,
      phrasing_examples: [],
      preferred_verbs: [],
      formatting_style: {},
    };

    // Build tone instruction
    const toneInstruction = buildToneInstruction(personalityProfile);

    // Get original file if available
    let imageUrl = null;
    if (note.file_id) {
      const { data: file } = await supabase
        .from("debtors_files")
        .select("file_url")
        .eq("id", note.file_id)
        .single();

      if (file) {
        imageUrl = file.file_url;
      }
    }

    // Regenerate summary using current personality profile
    const prompt = `Regenerate a debtor summary in Muzaffar's current writing style:

Client: ${note.client_name || "Unknown"}
Credit Limit: R ${note.credit_limit?.toLocaleString() || "0"}
Overdue: R ${note.overdue?.toLocaleString() || "0"}
Balance: R ${note.balance?.toLocaleString() || "0"}
Urgency: ${note.urgency || "medium"}
Sentiment: ${note.sentiment || "neutral"}

${toneInstruction}

Generate a summary that matches Muzaffar's current writing style and preferences.`;

    const messages: any[] = [
      {
        role: "system",
        content: `You are Muzaffar's personal debtors clerk assistant. Generate debtor summaries in Muzaffar's personal writing style. ${toneInstruction}`,
      },
      { role: "user", content: prompt },
    ];

    // If image is available, include it
    if (imageUrl) {
      try {
        const imageResponse = await fetch(imageUrl);
        if (imageResponse.ok) {
          const imageBlob = await imageResponse.blob();
          const imageBase64 = await blobToBase64(imageBlob);

          messages[1] = {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${imageBlob.type};base64,${imageBase64}`,
                },
              },
            ],
          };
        }
      } catch (e) {
        console.error("Failed to load image:", e);
      }
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

    // Convert messages format for different APIs
    let aiUrl: string;
    let aiHeaders: Record<string, string>;
    let aiBody: any;

    if (useOpenAI) {
      // OpenAI GPT-4o (best accuracy)
      aiUrl = "https://api.openai.com/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "gpt-4o",
        messages,
      };
    } else if (useAnthropic) {
      // Anthropic Claude Sonnet 3.5
      aiUrl = "https://api.anthropic.com/v1/messages";
      aiHeaders = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
      const systemMsg = messages.find(m => m.role === "system")?.content || "";
      const userMsg = messages.find(m => m.role === "user");
      aiBody = {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: systemMsg,
        messages: userMsg ? [{ role: "user", content: typeof userMsg.content === "string" ? userMsg.content : JSON.stringify(userMsg.content) }] : [],
      };
    } else if (useGemini) {
      // Handle Gemini format (supports images)
      const systemMsg = messages.find(m => m.role === "system")?.content || "";
      const userMsg = messages.find(m => m.role === "user");
      const hasImage = userMsg?.content && Array.isArray(userMsg.content) && userMsg.content.some((c: any) => c.type === "image_url");
      
      if (hasImage && userMsg?.content) {
        const imagePart = (userMsg.content as any[]).find((c: any) => c.type === "image_url");
        const textPart = (userMsg.content as any[]).find((c: any) => c.type === "text");
        
        // Extract base64 from data URL
        const imageUrl = imagePart?.image_url?.url || "";
        const base64Match = imageUrl.match(/base64,(.+)/);
        
        aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
        aiHeaders = { "Content-Type": "application/json" };
        aiBody = {
          contents: [{
            parts: [
              { text: `${systemMsg}\n\n${textPart?.text || prompt}` },
              ...(base64Match ? [{
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Match[1],
                },
              }] : []),
            ].filter(p => p.text || p.inline_data),
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        };
      } else {
        aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
        aiHeaders = { "Content-Type": "application/json" };
        aiBody = {
          contents: [{
            parts: [{ text: `${systemMsg}\n\n${prompt}` }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        };
      }
    } else if (useGroq) {
      aiUrl = "https://api.groq.com/openai/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "llama-3.3-70b-versatile",
        messages: messages.filter(m => m.role !== "user" || !Array.isArray(m.content) || !m.content.some((c: any) => c.type === "image_url")),
      };
    } else if (useOpenRouter) {
      aiUrl = "https://openrouter.ai/api/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://muzaffar-assistant.app",
      };
      aiBody = {
        model: "google/gemini-2.0-flash-exp:free",
        messages,
      };
    } else {
      aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "google/gemini-2.5-flash",
        messages,
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
      throw new Error(`AI gateway error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    
    // Handle different response formats
    let regeneratedSummary: string;
    if (useGemini) {
      regeneratedSummary = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (useAnthropic) {
      regeneratedSummary = aiData.content?.[0]?.text || "";
    } else {
      regeneratedSummary = aiData.choices[0]?.message?.content || "";
    }

    // Update the note with regenerated summary
    const { error: updateError } = await supabase
      .from("debtors_notes")
      .update({
        ai_generated: regeneratedSummary,
        summary: regeneratedSummary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", note_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ summary: regeneratedSummary, note_id }),
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function buildToneInstruction(profile: any): string {
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

