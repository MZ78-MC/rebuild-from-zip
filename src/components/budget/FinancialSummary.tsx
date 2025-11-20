import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const FinancialSummary = () => {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["finance-summary", "month"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const response = await supabase.functions.invoke("finance-summary", {
        body: { period: "month", includeTip: false },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-20 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-card border-border">
          <p className="text-muted-foreground">No data available</p>
        </Card>
      </div>
    );
  }

  const { income, expenses, savings, incomeChange, expenseChange } = summary.summary || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Income Card */}
      <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Total Income</p>
          <ArrowUpCircle className="h-5 w-5 text-green-500" />
        </div>
        <p className="text-3xl font-bold text-green-500">R{income?.toFixed(2) || "0.00"}</p>
        {incomeChange !== undefined && incomeChange !== 0 && (
          <p className={`text-xs mt-2 ${incomeChange > 0 ? "text-green-500" : "text-red-500"}`}>
            {incomeChange > 0 ? "+" : ""}{incomeChange.toFixed(1)}% vs last month
          </p>
        )}
      </Card>

      {/* Expenses Card */}
      <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
          <ArrowDownCircle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-3xl font-bold text-red-500">R{expenses?.toFixed(2) || "0.00"}</p>
        {expenseChange !== undefined && expenseChange !== 0 && (
          <p className={`text-xs mt-2 ${expenseChange < 0 ? "text-green-500" : "text-red-500"}`}>
            {expenseChange > 0 ? "+" : ""}{expenseChange.toFixed(1)}% vs last month
          </p>
        )}
      </Card>

      {/* Savings Card */}
      <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Savings</p>
          <TrendingUp className="h-5 w-5 text-blue-500" />
        </div>
        <p className={`text-3xl font-bold ${(savings || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
          R{savings?.toFixed(2) || "0.00"}
        </p>
        {income && expenses && (
          <p className="text-xs mt-2 text-muted-foreground">
            {((savings / income) * 100).toFixed(1)}% of income
          </p>
        )}
      </Card>

      {/* Balance Card */}
      <Card className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Remaining Balance</p>
          <Wallet className="h-5 w-5 text-blue-500" />
        </div>
        <p className={`text-3xl font-bold ${(savings || 0) >= 0 ? "text-blue-500" : "text-red-500"}`}>
          R{savings?.toFixed(2) || "0.00"}
        </p>
        <p className="text-xs mt-2 text-muted-foreground">
          {summary.transactionCount || 0} transactions this month
        </p>
      </Card>
    </div>
  );
};

