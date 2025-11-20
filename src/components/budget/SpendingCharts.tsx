import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#22c55e", // green
  "#ef4444", // red
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export const SpendingCharts = () => {
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="p-3 lg:p-6">
          <Skeleton className="h-48 lg:h-64 w-full" />
        </Card>
        <Card className="p-3 lg:p-6">
          <Skeleton className="h-48 lg:h-64 w-full" />
        </Card>
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No data available for charts</p>
      </Card>
    );
  }

  const { monthlyTrends, topCategories } = summary;

  // Prepare data for Income vs Expenses bar chart
  const incomeExpenseData = monthlyTrends?.map((month: any) => ({
    month: month.month,
    Income: month.income,
    Expenses: month.expenses,
  })) || [];

  // Prepare data for pie chart
  const pieData = topCategories?.map((cat: any) => ({
    name: cat.category.charAt(0).toUpperCase() + cat.category.slice(1),
    value: cat.amount,
  })) || [];

  // Prepare data for savings trend line chart
  const savingsTrendData = monthlyTrends?.map((month: any) => ({
    month: month.month,
    Savings: month.savings,
  })) || [];

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Income vs Expenses Bar Chart */}
      <Card className="p-3 lg:p-6 bg-card border-border">
        <h3 className="text-base lg:text-lg font-semibold mb-3 lg:mb-4">Monthly Income vs Expenses</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={incomeExpenseData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `R${value.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="Income" fill="#22c55e" />
            <Bar dataKey="Expenses" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Spending by Category Pie Chart */}
        <Card className="p-3 lg:p-6 bg-card border-border">
          <h3 className="text-base lg:text-lg font-semibold mb-3 lg:mb-4">Spending by Category</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px]">
              <p className="text-muted-foreground text-sm">No spending data available</p>
            </div>
          )}
        </Card>

        {/* Savings Trend Line Chart */}
        <Card className="p-3 lg:p-6 bg-card border-border">
          <h3 className="text-base lg:text-lg font-semibold mb-3 lg:mb-4">Savings Trend</h3>
          {savingsTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={savingsTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `R${value.toFixed(2)}`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Savings"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px]">
              <p className="text-muted-foreground text-sm">No savings data available</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

