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
    const { original_text, corrected_text, note_id, context } = await req.json();

    if (!original_text || !corrected_text || !note_id) {
      throw new Error("original_text, corrected_text, and note_id are required");
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

    // Save to learning log
    await supabase.from("learning_log").insert({
      user_id: user.id,
      original_text,
      corrected_text,
      context: context || "debtor_note",
      note_type: "debtor_summary",
    });

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

    // Analyze the differences using AI
    const systemPrompt = `You are an expert at analyzing writing style differences. Compare the original AI-generated text with the user's corrected version and extract detailed style preferences:

1. Tone analysis (0-1 scale):
   - tone_formal: How formal vs casual (0=casual, 1=formal)
   - tone_direct: How concise vs elaborate (0=elaborate, 1=direct)
   - tone_empathetic: How empathetic vs factual (0=factual, 1=empathetic)

2. Phrasing patterns: Extract specific phrases, sentence structures, or expressions the user prefers (e.g., "Awaiting payment since..." vs "Payment delayed")

3. Preferred verbs: Extract verbs the user consistently uses (e.g., "awaiting", "following up", "reviewing")

4. Formatting style: Note punctuation preferences (colons vs dashes), list styles, paragraph structure

5. Word choice: Extract preferred terminology (e.g., "balance outstanding" vs "amount due")

Return ONLY a JSON object with this structure:
{
  "tone_formal": 0.0-1.0,
  "tone_direct": 0.0-1.0,
  "tone_empathetic": 0.0-1.0,
  "phrasing_examples": ["phrase1", "phrase2"],
  "preferred_verbs": ["verb1", "verb2"],
  "formatting_style": {"key": "value"},
  "word_choices": ["term1", "term2"]
}`;

    const userMessage = `Original AI text:\n"${original_text}"\n\nUser's corrected version:\n"${corrected_text}"\n\nAnalyze the differences and extract Muzaffar's writing style preferences. Focus on what changed and why it reflects his preferred style.`;

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
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      };
    } else if (useAnthropic) {
      // Anthropic Claude Sonnet 3.5
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
          { role: "user", content: `${systemPrompt}\n\n${userMessage}` },
        ],
      };
    } else if (useGemini) {
      aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      aiHeaders = { "Content-Type": "application/json" };
      aiBody = {
        contents: [{
          parts: [{ text: `${systemPrompt}\n\n${userMessage}` }],
        }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      };
    } else if (useGroq) {
      aiUrl = "https://api.groq.com/openai/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      };
    } else {
      aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      aiHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      aiBody = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
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
      throw new Error(`Failed to analyze edit: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    
    // Handle different response formats
    let analysisText: string;
    if (useGemini) {
      analysisText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (useAnthropic) {
      analysisText = aiData.content?.[0]?.text || "";
    } else {
      analysisText = aiData.choices[0]?.message?.content || "";
    }

    // Parse analysis
    let analysis;
    try {
      const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/) || 
                       analysisText.match(/```\n([\s\S]*?)\n```/) ||
                       [null, analysisText];
      analysis = JSON.parse(jsonMatch[1] || analysisText);
    } catch (e) {
      console.error("Failed to parse analysis:", e);
      analysis = {};
    }

    // Update or create personality profile
    const { data: existingProfile } = await supabase
      .from("personality_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (existingProfile) {
      // Adaptive learning: Use exponential moving average with decay factor
      // More recent edits have higher weight (0.25 = 25% weight for new data)
      const learningRate = 0.25;
      
      const newToneFormal = existingProfile.tone_formal
        ? existingProfile.tone_formal * (1 - learningRate) + (analysis.tone_formal || existingProfile.tone_formal) * learningRate
        : analysis.tone_formal || 0.5;
      
      const newToneDirect = existingProfile.tone_direct
        ? existingProfile.tone_direct * (1 - learningRate) + (analysis.tone_direct || existingProfile.tone_direct) * learningRate
        : analysis.tone_direct || 0.5;
      
      const newToneEmpathetic = existingProfile.tone_empathetic
        ? existingProfile.tone_empathetic * (1 - learningRate) + (analysis.tone_empathetic || existingProfile.tone_empathetic) * learningRate
        : analysis.tone_empathetic || 0.5;

      // Merge phrasing examples (keep unique, most recent preferred)
      const existingPhrasing = (existingProfile.phrasing_examples as string[]) || [];
      const newPhrases = (analysis.phrasing_examples || []) as string[];
      const uniquePhrases = Array.from(new Set([...existingPhrasing, ...newPhrases]));
      const newPhrasing = uniquePhrases.slice(-20); // Keep last 20 unique phrases

      // Merge preferred verbs
      const existingVerbs = (existingProfile.preferred_verbs as string[]) || [];
      const newVerbsList = (analysis.preferred_verbs || []) as string[];
      const uniqueVerbs = Array.from(new Set([...existingVerbs, ...newVerbsList]));
      const newVerbs = uniqueVerbs.slice(-20);

      // Merge word choices if available (handle if column doesn't exist)
      const existingWordChoices = ((existingProfile as any).word_choices as string[]) || [];
      const newWordChoices = (analysis.word_choices || []) as string[];
      const uniqueWords = Array.from(new Set([...existingWordChoices, ...newWordChoices]));
      const finalWordChoices = uniqueWords.slice(-20);

      // Merge formatting style (deep merge)
      const existingFormatting = (existingProfile.formatting_style as Record<string, any>) || {};
      const newFormatting = analysis.formatting_style || {};
      const mergedFormatting = {
        ...existingFormatting,
        ...newFormatting,
        // Preserve recent preferences
        last_updated_patterns: newFormatting,
      };

      await supabase
        .from("personality_profile")
        .update({
          tone_formal: Math.max(0, Math.min(1, newToneFormal)), // Clamp to 0-1
          tone_direct: Math.max(0, Math.min(1, newToneDirect)),
          tone_empathetic: Math.max(0, Math.min(1, newToneEmpathetic)),
          phrasing_examples: newPhrasing,
          preferred_verbs: newVerbs,
          formatting_style: mergedFormatting,
          ...(finalWordChoices.length > 0 ? { word_choices: finalWordChoices } : {}),
        })
        .eq("user_id", user.id);
    } else {
      // Create new profile with initial analysis
      await supabase.from("personality_profile").insert({
        user_id: user.id,
        tone_formal: Math.max(0, Math.min(1, analysis.tone_formal || 0.5)),
        tone_direct: Math.max(0, Math.min(1, analysis.tone_direct || 0.5)),
        tone_empathetic: Math.max(0, Math.min(1, analysis.tone_empathetic || 0.5)),
        phrasing_examples: analysis.phrasing_examples || [],
        preferred_verbs: analysis.preferred_verbs || [],
        formatting_style: analysis.formatting_style || {},
        ...(analysis.word_choices ? { word_choices: analysis.word_choices } : {}),
      });
    }

    // Return success with learning insights
    return new Response(
      JSON.stringify({
        success: true,
        insights: {
          tone_updated: {
            formal: Math.round((analysis.tone_formal || 0.5) * 100),
            direct: Math.round((analysis.tone_direct || 0.5) * 100),
            empathetic: Math.round((analysis.tone_empathetic || 0.5) * 100),
          },
          new_phrases: (analysis.phrasing_examples || []).length,
          new_verbs: (analysis.preferred_verbs || []).length,
        },
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
