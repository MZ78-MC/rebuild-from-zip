// Shared AI helper for all Edge Functions
// Supports free APIs: Groq, Gemini, OpenRouter

export interface AIRequest {
  systemPrompt: string;
  userMessage: string;
  imageUrl?: string;
  imageBase64?: string;
}

export async function callAI(request: AIRequest): Promise<string> {
  // Get API keys (priority: free APIs first)
  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  // Priority: OpenAI (best accuracy) → Anthropic → Gemini → OpenRouter → Groq → Lovable
  const apiKey = openaiApiKey || anthropicApiKey || geminiApiKey || openrouterApiKey || groqApiKey || lovableApiKey;
  const useOpenAI = !!openaiApiKey;
  const useAnthropic = !!anthropicApiKey && !openaiApiKey;
  const useGemini = !!geminiApiKey && !openaiApiKey && !anthropicApiKey;
  const useOpenRouter = !!openrouterApiKey && !openaiApiKey && !anthropicApiKey && !geminiApiKey;
  const useGroq = !!groqApiKey && !openaiApiKey && !anthropicApiKey && !geminiApiKey && !openrouterApiKey;

  if (!apiKey) {
    throw new Error(
      "No AI API key found. Recommended: OPENAI_API_KEY for best accuracy. FREE options: GEMINI_API_KEY from https://aistudio.google.com/apikey or GROQ_API_KEY from https://console.groq.com/keys"
    );
  }

  let aiUrl: string;
  let aiHeaders: Record<string, string>;
  let aiBody: any;
  const hasImage = !!(request.imageUrl || request.imageBase64);

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
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
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
        { role: "user", content: `${request.systemPrompt}\n\n${request.userMessage}` },
      ],
    };
  } else if (useGemini) {
    // FREE: Google Gemini API (supports images)
    if (hasImage) {
      const imageData = request.imageBase64 || request.imageUrl;
      aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      aiHeaders = { "Content-Type": "application/json" };
      aiBody = {
        contents: [{
          parts: [
            { text: `${request.systemPrompt}\n\n${request.userMessage}` },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: request.imageBase64 || (request.imageUrl?.startsWith("data:") ? request.imageUrl.split(",")[1] : null),
              },
            },
          ].filter(p => p.text || (p.inline_data && p.inline_data.data)),
        }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      };
    } else {
      aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
      aiHeaders = { "Content-Type": "application/json" };
      aiBody = {
        contents: [{
          parts: [{ text: `${request.systemPrompt}\n\n${request.userMessage}` }],
        }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      };
    }
  } else if (useOpenRouter) {
    // FREE: OpenRouter
    aiUrl = "https://openrouter.ai/api/v1/chat/completions";
    aiHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://muzaffar-assistant.app",
    };
    aiBody = {
      model: "google/gemini-2.0-flash-exp:free",
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
    };
  } else if (useGroq) {
    // FREE: Groq API
    aiUrl = "https://api.groq.com/openai/v1/chat/completions";
    aiHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (hasImage) {
      // Groq doesn't support images, fallback message
      aiBody = {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: `${request.userMessage}\n\nNote: Image analysis requested but Groq doesn't support images. Please provide text description.` },
        ],
      };
    } else {
      aiBody = {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userMessage },
        ],
      };
    }
  } else {
    // Fallback: Lovable gateway
    aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    aiHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    aiBody = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
    };
  }

  const response = await fetch(aiUrl, {
    method: "POST",
    headers: aiHeaders,
    body: JSON.stringify(aiBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Handle different response formats
  if (useGemini) {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
  } else if (useAnthropic) {
    return data.content?.[0]?.text || "No response generated";
  } else {
    return data.choices[0]?.message?.content || "No response generated";
  }
}


