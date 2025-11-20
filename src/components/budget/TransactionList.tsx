import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TransactionCard } from "./TransactionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { useIsMobile } from "@/hooks/use-mobile";

type Transaction = Database["public"]["Tables"]["user_finances"]["Row"];

export const TransactionList = () => {
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const isMobile = useIsMobile();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["user_finances", filterType, sortBy],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("user_finances")
        .select("*")
        .eq("user_id", user.id);

      if (filterType !== "all") {
        query = query.eq("type", filterType as "income" | "expense");
      }

      if (sortBy === "date_desc") {
        query = query.order("date", { ascending: false });
      } else if (sortBy === "date_asc") {
        query = query.order("date", { ascending: true });
      } else if (sortBy === "amount_desc") {
        query = query.order("amount", { ascending: false });
      } else {
        query = query.order("amount", { ascending: true });
      }

      // Limit to 100 transactions for performance
      query = query.limit(100);

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Transaction[];
    },
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* Filters */}
      <Card className={`${isMobile ? 'p-3' : 'p-4'} bg-card border-border`}>
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center gap-4'}`}>
          <div className={`flex items-center ${isMobile ? 'w-full' : 'gap-2'}`}>
            <ArrowUpDown className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground ${isMobile ? 'mr-2' : ''}`} />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className={isMobile ? "w-full" : "w-[140px]"}>
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className={isMobile ? "w-full" : "w-[160px]"}>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Date (Newest)</SelectItem>
              <SelectItem value="date_asc">Date (Oldest)</SelectItem>
              <SelectItem value="amount_desc">Amount (High)</SelectItem>
              <SelectItem value="amount_asc">Amount (Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Transaction List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : transactions && transactions.length > 0 ? (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <TransactionCard key={transaction.id} transaction={transaction} />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No transactions yet. Add your first transaction to get started!</p>
        </Card>
      )}
    </div>
  );
};

