import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const AITipCard = () => {
  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ["finance-summary", "month", "tip"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const response = await supabase.functions.invoke("finance-summary", {
        body: { period: "month", includeTip: true },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success("Tip refreshed!");
  };

  if (isLoading) {
    return (
      <Card className="p-6 bg-card border-border">
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  const tip = summary?.aiTip || "Review your spending patterns and identify areas where you can reduce expenses.";

  return (
    <Card className="p-6 bg-gradient-to-br from-[hsl(142,76%,36%)]/10 to-[hsl(48,96%,53%)]/10 border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-[hsl(142,76%,36%)]/20">
            <Sparkles className="h-5 w-5 text-[hsl(142,76%,36%)]" />
          </div>
          <h3 className="text-lg font-semibold">AI Tip of the Day</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-base leading-relaxed text-foreground">{tip}</p>
    </Card>
  );
};

