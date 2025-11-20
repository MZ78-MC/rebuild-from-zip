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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users
    const { data: users } = await supabase.auth.admin.listUsers();

    for (const user of users.users) {
      // Generate weekly report
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data: notes } = await supabase
        .from("debtors_notes")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      // Get learning statistics
      const { data: learningLogs } = await supabase
        .from("learning_log")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString());

      const { data: profile } = await supabase
        .from("personality_profile")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Get API keys (free APIs first)
      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
      const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
      const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

      // Priority: Lovable AI (auto-configured) → Gemini (free) → OpenAI (best accuracy)
      const apiKey = lovableApiKey || geminiApiKey || openaiApiKey;
      const useLovable = !!lovableApiKey;
      const useGemini = !!geminiApiKey && !lovableApiKey;
      const useOpenAI = !!openaiApiKey && !lovableApiKey && !geminiApiKey;

      // Generate analytics report using AI
      const systemPrompt = "You are an AI learning analytics assistant. Generate concise weekly reports with metrics and insights.";
      const analyticsPrompt = `Generate a weekly learning report for Muzaffar Assistant:

Total Notes This Week: ${notes?.length || 0}
Total Learning Edits: ${learningLogs?.length || 0}
Personality Profile: ${profile ? "Active" : "Not configured"}

Analyze:
1. Accuracy improvement trends
2. Tone similarity percentage
3. Most common debtor actions
4. Weekly overdue summary
5. AI learning progress

Format as a concise weekly report.`;

      let aiUrl: string;
      let aiHeaders: Record<string, string>;
      let aiBody: any;

      if (useLovable) {
        aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        aiHeaders = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: analyticsPrompt },
          ],
        };
      } else if (useGemini) {
        aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
        aiHeaders = { "Content-Type": "application/json" };
        aiBody = {
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${analyticsPrompt}` }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        };
      } else if (useOpenAI) {
        aiUrl = "https://api.openai.com/v1/chat/completions";
        aiHeaders = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        };
        aiBody = {
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: analyticsPrompt },
          ],
        };
      } else {
        throw new Error("No AI API key configured");
      }

      let analyticsReport = "";
      if (apiKey && aiUrl) {
        const aiResponse = await fetch(aiUrl, {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify(aiBody),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error("Failed to generate analytics:", aiResponse.status, errorText);
          analyticsReport = "Analytics generation failed - check AI API configuration.";
        } else {
          const aiData = await aiResponse.json();
          
          // Handle different response formats
          if (useGemini) {
            analyticsReport = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } else {
            analyticsReport = aiData.choices[0]?.message?.content || "";
          }
        }
      }

      // Generate PDF
      const { data: reportData, error: reportError } = await supabase.functions.invoke(
        "generate-pdf-report",
        {
          body: {
            report_type: "weekly",
            start_date: start.toISOString(),
            end_date: end.toISOString(),
          },
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      // Combine weekly report with analytics
      const fullReport = `${reportData?.content || ""}\n\n--- AI Learning Report ---\n\n${analyticsReport}`;

      // Save report
      await supabase.from("reports").insert({
        user_id: user.id,
        title: `Weekly Report - ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
        content: fullReport,
        pdf_url: null,
      });

      // Send via WhatsApp
      const whatsappNumber = Deno.env.get(`WHATSAPP_NUMBER_${user.id}`) || 
                             Deno.env.get("DEFAULT_WHATSAPP_NUMBER");

      if (whatsappNumber) {
        await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone_number: whatsappNumber,
            message: `Weekly Summary - ${start.toLocaleDateString()} to ${end.toLocaleDateString()}\n\nNotes: ${notes?.length || 0}\nLearning Edits: ${learningLogs?.length || 0}\n\nSee attached PDF for full report.`,
            pdf_url: reportData?.pdf_html,
          },
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
          },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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

