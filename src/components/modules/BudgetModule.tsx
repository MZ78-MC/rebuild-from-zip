import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import { FinancialSummary } from "../budget/FinancialSummary";
import { SpendingCharts } from "../budget/SpendingCharts";
import { CategoryBreakdown } from "../budget/CategoryBreakdown";
import { AITipCard } from "../budget/AITipCard";
import { TransactionList } from "../budget/TransactionList";
import { AddTransactionDialog } from "../budget/AddTransactionDialog";
import { UploadReceiptDialog } from "../budget/UploadReceiptDialog";
import { UploadBankStatementDialog } from "../budget/UploadBankStatementDialog";
import { BudgetGoals } from "../budget/BudgetGoals";
import { FinancialChat } from "../budget/FinancialChat";
import { useIsMobile } from "@/hooks/use-mobile";

export const BudgetModule = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? "space-y-4" : "space-y-6"}>
      {/* Header */}
      <Card className={`${isMobile ? 'p-3' : 'p-6'} bg-card border-border shadow-[var(--shadow-card)]`}>
        <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className={`${isMobile ? 'p-2' : 'p-3'} rounded-full bg-[hsl(142,76%,36%)]/10`}>
              <Wallet className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} text-[hsl(142,76%,36%)]`} />
            </div>
            <div>
              <h2 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-semibold`}>Budget Buddy</h2>
              <p className={`${isMobile ? 'text-sm' : 'text-base'} text-muted-foreground mt-1`}>
                Smart personal finance assistant
              </p>
            </div>
          </div>
          <div className={`flex items-center ${isMobile ? 'flex-wrap gap-2 w-full' : 'gap-2'}`}>
            <AddTransactionDialog defaultType="expense" />
            <UploadReceiptDialog />
            <UploadBankStatementDialog />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`${isMobile ? 'flex overflow-x-auto w-full bg-card border border-border gap-1 p-1 mb-4 scrollbar-hide' : 'grid w-full grid-cols-4 bg-card border border-border gap-1 p-1 mb-6'}`}>
          <TabsTrigger
            value="overview"
            className={`${isMobile ? 'flex-shrink-0 min-w-[90px] text-xs px-2' : ''} data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(142,76%,36%)] data-[state=active]:to-[hsl(48,96%,53%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20 transition-all duration-300 hover:bg-[hsl(142,76%,36%)]/20 data-[state=active]:hover:from-[hsl(142,76%,41%)] data-[state=active]:hover:to-[hsl(48,96%,58%)]`}
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className={`${isMobile ? 'flex-shrink-0 min-w-[90px] text-xs px-2' : ''} data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(142,76%,36%)] data-[state=active]:to-[hsl(48,96%,53%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20 transition-all duration-300 hover:bg-[hsl(142,76%,36%)]/20 data-[state=active]:hover:from-[hsl(142,76%,41%)] data-[state=active]:hover:to-[hsl(48,96%,58%)]`}
          >
            Transactions
          </TabsTrigger>
          <TabsTrigger
            value="goals"
            className={`${isMobile ? 'flex-shrink-0 min-w-[90px] text-xs px-2' : ''} data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(142,76%,36%)] data-[state=active]:to-[hsl(48,96%,53%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20 transition-all duration-300 hover:bg-[hsl(142,76%,36%)]/20 data-[state=active]:hover:from-[hsl(142,76%,41%)] data-[state=active]:hover:to-[hsl(48,96%,58%)]`}
          >
            Goals
          </TabsTrigger>
          <TabsTrigger
            value="insights"
            className={`${isMobile ? 'flex-shrink-0 min-w-[90px] text-xs px-2' : ''} data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(142,76%,36%)] data-[state=active]:to-[hsl(48,96%,53%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20 transition-all duration-300 hover:bg-[hsl(142,76%,36%)]/20 data-[state=active]:hover:from-[hsl(142,76%,41%)] data-[state=active]:hover:to-[hsl(48,96%,58%)]`}
          >
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className={isMobile ? "mt-0 space-y-4" : "mt-0 space-y-6"}>
          <FinancialSummary />
          <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-3'} ${isMobile ? 'gap-4' : 'gap-6'}`}>
            <div className={isMobile ? '' : 'lg:col-span-2'}>
              <SpendingCharts />
            </div>
            <div className={isMobile ? "space-y-4" : "space-y-6"}>
              <CategoryBreakdown />
              <AITipCard />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="mt-0">
          <TransactionList />
        </TabsContent>

        <TabsContent value="goals" className="mt-0">
          <BudgetGoals />
        </TabsContent>

        <TabsContent value="insights" className={isMobile ? "mt-0 space-y-4" : "mt-0 space-y-6"}>
          <FinancialChat />
          <AITipCard />
          <SpendingCharts />
          <CategoryBreakdown />
        </TabsContent>
      </Tabs>
    </div>
  );
};

