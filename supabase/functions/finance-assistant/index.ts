import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inline AI helper function (to avoid shared module dependency)
async function callAI(request: { systemPrompt: string; userMessage: string }): Promise<string> {
  // Get API keys (priority: Lovable AI → free APIs → paid APIs)
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  // Priority: Lovable AI (auto-configured) → Gemini (free) → OpenAI (best accuracy)
  const apiKey = lovableApiKey || geminiApiKey || openaiApiKey;
  const useLovable = !!lovableApiKey;
  const useGemini = !!geminiApiKey && !lovableApiKey;
  const useOpenAI = !!openaiApiKey && !lovableApiKey && !geminiApiKey;

  if (!apiKey) {
    throw new Error(
      "No AI API key found. Recommended: OPENAI_API_KEY for best accuracy. FREE options: GEMINI_API_KEY from https://aistudio.google.com/apikey or GROQ_API_KEY from https://console.groq.com/keys"
    );
  }

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
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
    };
  } else if (useGemini) {
    aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    aiHeaders = { "Content-Type": "application/json" };
    aiBody = {
      contents: [{
        parts: [{ text: `${request.systemPrompt}\n\n${request.userMessage}` }],
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
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
    };
  } else {
    throw new Error("No AI API key configured");
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
  } else {
    return data.choices[0]?.message?.content || "No response generated";
  }
}

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
    const { query, action } = await req.json();

    if (!query) {
      throw new Error("Query is required");
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

    // Get recent financial transactions for context
    const { data: recentTransactions } = await supabase
      .from("user_finances")
      .select("category, amount, type, description, date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(10);

    // Get active budget goals
    const { data: activeGoals } = await supabase
      .from("budget_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active");

    // Build financial context
    let financialContext = "";
    if (recentTransactions && recentTransactions.length > 0) {
      financialContext += "\n\nRecent transactions:\n";
      recentTransactions.forEach((tx, idx) => {
        financialContext += `${idx + 1}. ${tx.type === "income" ? "+" : "-"}R${tx.amount} - ${tx.category}${tx.description ? ` (${tx.description})` : ""} - ${new Date(tx.date).toLocaleDateString()}\n`;
      });
    }

    if (activeGoals && activeGoals.length > 0) {
      financialContext += "\n\nActive budget goals:\n";
      activeGoals.forEach((goal, idx) => {
        const progress = goal.current_amount / goal.target_amount * 100;
        financialContext += `${idx + 1}. ${goal.goal_type}: R${goal.current_amount}/${goal.target_amount} (${progress.toFixed(0)}%)${goal.deadline ? ` - Deadline: ${new Date(goal.deadline).toLocaleDateString()}` : ""}\n`;
      });
    }

    // Detect intent and process query
    const systemPrompt = `You are a financial assistant helping manage personal finances. Your role is to:
1. Detect if the user wants to ADD a transaction, QUERY financial data, SET a goal, or ANALYZE spending
2. For transaction entries: Extract amount (in Rands), category, date, description, and type (income/expense)
3. For queries: Provide clear, helpful answers about spending, income, trends, or budgets
4. For goal setting: Extract goal type, target amount, deadline, and category (if applicable)
5. For analysis: Provide insights, trends, and recommendations

Categories should be: groceries, transport, utilities, rent, entertainment, dining, shopping, healthcare, education, salary, freelance, other

${financialContext}

Respond in JSON format when adding transactions or setting goals:
- For transactions: {"action": "add_transaction", "type": "income|expense", "amount": number, "category": "string", "description": "string", "date": "YYYY-MM-DD"}
- For goals: {"action": "set_goal", "goal_type": "savings|spending_limit|category_limit", "target_amount": number, "deadline": "YYYY-MM-DD", "category": "string|null"}
- For queries/analysis: Provide a natural language response with specific numbers and insights`;

    const aiResponse = await callAI({
      systemPrompt,
      userMessage: query,
    });

    // Try to parse JSON response (for transaction/goal actions)
    let parsedResponse: any = null;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch {
      // Not JSON, treat as natural language response
    }

    let finalResponse = aiResponse;
    let transactionId: string | null = null;
    let goalId: string | null = null;

    // Handle transaction addition
    if (parsedResponse?.action === "add_transaction") {
      const { type, amount, category, description, date } = parsedResponse;
      
      if (!type || !amount || !category) {
        throw new Error("Missing required transaction fields");
      }

      const transactionDate = date ? new Date(date) : new Date();
      
      const { data: transaction, error: txError } = await supabase
        .from("user_finances")
        .insert({
          user_id: user.id,
          type: type,
          amount: parseFloat(amount),
          category: category.toLowerCase(),
          description: description || null,
          date: transactionDate.toISOString(),
          source: "chat",
        })
        .select()
        .single();

      if (txError) {
        throw new Error(`Failed to save transaction: ${txError.message}`);
      }

      transactionId = transaction.id;

      // Generate embedding for the transaction description (optional)
      const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiApiKey && description) {
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
                input: `${category} ${description}`,
              }),
            }
          );

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.data[0]?.embedding;
            if (embedding) {
              await supabase
                .from("user_finances")
                .update({
                  embedding: `[${embedding.join(",")}]`,
                })
                .eq("id", transaction.id);
            }
          }
        } catch (e) {
          console.error("Embedding generation failed:", e);
        }
      }

      // Update budget goals if applicable
      if (activeGoals && activeGoals.length > 0) {
        for (const goal of activeGoals) {
          if (goal.goal_type === "savings" && type === "income") {
            await supabase
              .from("budget_goals")
              .update({
                current_amount: (goal.current_amount || 0) + parseFloat(amount),
              })
              .eq("id", goal.id);
          } else if (goal.goal_type === "category_limit" && goal.category === category && type === "expense") {
            await supabase
              .from("budget_goals")
              .update({
                current_amount: (goal.current_amount || 0) + parseFloat(amount),
              })
              .eq("id", goal.id);
          }
        }
      }

      finalResponse = `✅ Transaction added: ${type === "income" ? "+" : "-"}R${amount} for ${category}${description ? ` (${description})` : ""}`;
    }

    // Handle goal setting
    if (parsedResponse?.action === "set_goal") {
      const { goal_type, target_amount, deadline, category } = parsedResponse;
      
      if (!goal_type || !target_amount) {
        throw new Error("Missing required goal fields");
      }

      const { data: goal, error: goalError } = await supabase
        .from("budget_goals")
        .insert({
          user_id: user.id,
          goal_type: goal_type,
          target_amount: parseFloat(target_amount),
          current_amount: 0,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          category: category || null,
          status: "active",
        })
        .select()
        .single();

      if (goalError) {
        throw new Error(`Failed to create goal: ${goalError.message}`);
      }

      goalId = goal.id;
      finalResponse = `✅ Budget goal created: ${goal_type} of R${target_amount}${deadline ? ` by ${new Date(deadline).toLocaleDateString()}` : ""}${category ? ` for ${category}` : ""}`;
    }

    // For queries/analysis, enhance response with actual data
    if (!parsedResponse || (!parsedResponse.action || parsedResponse.action === "query")) {
      // Get monthly summary for better context
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const { data: monthlyData } = await supabase
        .from("user_finances")
        .select("type, amount")
        .eq("user_id", user.id)
        .gte("date", startOfMonth.toISOString());

      if (monthlyData) {
        const income = monthlyData.filter(t => t.type === "income").reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
        const expenses = monthlyData.filter(t => t.type === "expense").reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
        const savings = income - expenses;

        finalResponse += `\n\n📊 This month so far:\n- Income: R${income.toFixed(2)}\n- Expenses: R${expenses.toFixed(2)}\n- Savings: R${savings.toFixed(2)}`;
      }
    }

    return new Response(
      JSON.stringify({
        response: finalResponse,
        transactionId,
        goalId,
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

