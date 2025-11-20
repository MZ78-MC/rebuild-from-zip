import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

export const CategoryBreakdown = () => {
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
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (!summary || !summary.topCategories || summary.topCategories.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <h3 className="text-lg font-semibold mb-4">Top Spending Categories</h3>
        <p className="text-muted-foreground">No spending data available yet</p>
      </Card>
    );
  }

  const topCategories = summary.topCategories.slice(0, 5);
  const totalSpending = topCategories.reduce((sum: number, cat: any) => sum + cat.amount, 0);

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-[hsl(142,76%,36%)]" />
        <h3 className="text-lg font-semibold">Top Spending Categories</h3>
      </div>
      <div className="space-y-4">
        {topCategories.map((category: any, index: number) => {
          const percentage = (category.amount / totalSpending) * 100;
          return (
            <div key={category.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="font-medium capitalize">
                    {category.category}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">R{category.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          );
        })}
      </div>
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <span className="text-lg font-bold">R{totalSpending.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  );
};

