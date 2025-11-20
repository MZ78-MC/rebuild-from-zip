import { Card } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Transaction = Database["public"]["Tables"]["user_finances"]["Row"];

interface TransactionCardProps {
  transaction: Transaction;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
}

export const TransactionCard = ({ transaction, onEdit, onDelete }: TransactionCardProps) => {
  const isIncome = transaction.type === "income";
  const amount = parseFloat(transaction.amount.toString());
  
  return (
    <Card className="p-4 bg-card border-border hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 rounded-full ${isIncome ? "bg-green-500/10" : "bg-red-500/10"}`}>
            {isIncome ? (
              <ArrowUpCircle className={`h-5 w-5 ${isIncome ? "text-green-500" : "text-red-500"}`} />
            ) : (
              <ArrowDownCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{transaction.category}</p>
              {transaction.vendor && (
                <span className="text-sm text-muted-foreground">• {transaction.vendor}</span>
              )}
            </div>
            {transaction.description && (
              <p className="text-sm text-muted-foreground truncate">{transaction.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(transaction.date), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className={`font-semibold text-lg ${isIncome ? "text-green-500" : "text-red-500"}`}>
            {isIncome ? "+" : "-"}R{amount.toFixed(2)}
          </p>
        </div>
      </div>
    </Card>
  );
};

