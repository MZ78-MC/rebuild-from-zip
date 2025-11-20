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
    // Handle empty body gracefully
    let period = "month";
    let includeTip = true;
    
    try {
      const body = await req.json();
      period = body.period || "month";
      includeTip = body.includeTip !== undefined ? body.includeTip : true;
    } catch (e) {
      // Body might be empty or invalid, use defaults
      console.log("No body provided, using defaults");
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

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);

    if (period === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Calculate previous period dates
    let previousStartDate: Date;
    let previousEndDate: Date;

    if (period === "week") {
      previousEndDate = new Date(startDate);
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 7);
    } else if (period === "month") {
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === "year") {
      previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
      previousEndDate = new Date(now.getFullYear() - 1, 11, 31);
    } else {
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    // Parallelize queries for better performance
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const [currentResult, previousResult, categoryResult, monthlyResult] = await Promise.all([
      // Current period summary
      supabase
        .from("user_finances")
        .select("type, amount", { count: "exact" })
        .eq("user_id", user.id)
        .gte("date", startDate.toISOString())
        .lte("date", endDate.toISOString()),
      
      // Previous period summary
      supabase
        .from("user_finances")
        .select("type, amount")
        .eq("user_id", user.id)
        .gte("date", previousStartDate.toISOString())
        .lte("date", previousEndDate.toISOString()),
      
      // Category breakdown
      supabase
        .from("user_finances")
        .select("category, amount")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("date", startDate.toISOString())
        .lte("date", endDate.toISOString()),
      
      // Monthly trends
      supabase
        .from("user_finances")
        .select("type, amount, date")
        .eq("user_id", user.id)
        .gte("date", sixMonthsAgo.toISOString())
        .lte("date", endDate.toISOString())
        .limit(10000)
    ]);

    const currentSummary = currentResult.data;
    const currentCount = currentResult.count || 0;
    const previousSummary = previousResult.data;
    const categoryData = categoryResult.data;
    const allMonthlyTransactions = monthlyResult.data;

    // Calculate summaries (optimized - process in memory but with minimal data)
    const currentIncome =
      currentSummary
        ?.filter((t) => t.type === "income")
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

    const currentExpenses =
      currentSummary
        ?.filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

    const currentSavings = currentIncome - currentExpenses;

    const previousIncome =
      previousSummary
        ?.filter((t) => t.type === "income")
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

    const previousExpenses =
      previousSummary
        ?.filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

    // Calculate category totals from already-fetched categoryData
    const categoryBreakdown: Record<string, number> = {};
    categoryData?.forEach((t) => {
      const category = t.category || "other";
      categoryBreakdown[category] =
        (categoryBreakdown[category] || 0) + parseFloat(t.amount.toString());
    });

    const topCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    // Group by month efficiently
    const monthlyData: Record<string, { income: number; expenses: number }> = {};
    
    allMonthlyTransactions?.forEach((t) => {
      const txDate = new Date(t.date);
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0 };
      }
      
      const amount = parseFloat(t.amount.toString());
      if (t.type === "income") {
        monthlyData[monthKey].income += amount;
      } else {
        monthlyData[monthKey].expenses += amount;
      }
    });

    // Build trends array for last 6 months
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
      const data = monthlyData[monthKey] || { income: 0, expenses: 0 };

      monthlyTrends.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        income: data.income,
        expenses: data.expenses,
        savings: data.income - data.expenses,
      });
    }

    // Generate AI tip if requested (skip for now to improve performance)
    let aiTip = null;
    if (includeTip) {
      // For now, return a simple tip without AI call to improve performance
      // AI tip generation can be moved to a separate endpoint or done client-side
      if (currentExpenses > currentIncome) {
        aiTip = "Your expenses exceed your income this month. Consider reviewing your spending categories to identify areas where you can cut back.";
      } else if (topCategories.length > 0 && topCategories[0].amount > currentExpenses * 0.3) {
        aiTip = `Your top spending category (${topCategories[0].category}) accounts for over 30% of expenses. Consider setting a budget limit for this category.`;
      } else if (currentSavings < 0) {
        aiTip = "You're spending more than you're earning. Focus on reducing expenses or increasing income to achieve positive savings.";
      } else {
        aiTip = "Review your spending patterns and identify areas where you can reduce expenses to increase your savings rate.";
      }
    }

    // Calculate percentage changes
    const incomeChange =
      previousIncome > 0
        ? ((currentIncome - previousIncome) / previousIncome) * 100
        : 0;
    const expenseChange =
      previousExpenses > 0
        ? ((currentExpenses - previousExpenses) / previousExpenses) * 100
        : 0;

    return new Response(
      JSON.stringify({
        period,
        summary: {
          income: currentIncome,
          expenses: currentExpenses,
          savings: currentSavings,
          incomeChange,
          expenseChange,
        },
        topCategories,
        monthlyTrends,
        aiTip,
        transactionCount: currentCount || 0,
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
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

