import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek, subDays, subWeeks } from "date-fns";
import { TrendingUp, Clock, CheckCircle2, Target, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const ProductivityAnalytics = () => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["productivity-analytics"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const now = new Date();
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);
      const lastWeekStart = startOfWeek(subWeeks(now, 1));
      const lastWeekEnd = endOfWeek(subWeeks(now, 1));

      // Get tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id);

      // Get focus sessions
      const { data: focusSessions } = await supabase
        .from("focus_sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("started_at", lastWeekStart.toISOString());

      // Calculate metrics
      const allTasks = tasks || [];
      const completedTasks = allTasks.filter((t) => t.completed);
      const completionRate = allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0;

      // This week's tasks
      const thisWeekTasks = allTasks.filter((t) => {
        if (!t.created_at) return false;
        const created = new Date(t.created_at);
        return created >= weekStart && created <= weekEnd;
      });
      const thisWeekCompleted = thisWeekTasks.filter((t) => t.completed);
      const thisWeekRate = thisWeekTasks.length > 0
        ? (thisWeekCompleted.length / thisWeekTasks.length) * 100
        : 0;

      // Last week's tasks
      const lastWeekTasks = allTasks.filter((t) => {
        if (!t.created_at) return false;
        const created = new Date(t.created_at);
        return created >= lastWeekStart && created <= lastWeekEnd;
      });
      const lastWeekCompleted = lastWeekTasks.filter((t) => t.completed);
      const lastWeekRate = lastWeekTasks.length > 0
        ? (lastWeekCompleted.length / lastWeekTasks.length) * 100
        : 0;

      // Focus sessions
      const totalFocusTime = (focusSessions || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const thisWeekSessions = (focusSessions || []).filter((s) => {
        if (!s.started_at) return false;
        const started = new Date(s.started_at);
        return started >= weekStart && started <= weekEnd;
      });
      const thisWeekFocusTime = thisWeekSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      // Daily completion trends (last 7 days)
      const dailyTrends = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(now, i);
        const dayTasks = allTasks.filter((t) => {
          if (!t.updated_at) return false;
          const updated = new Date(t.updated_at);
          return format(updated, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
        });
        const dayCompleted = dayTasks.filter((t) => t.completed);
        dailyTrends.push({
          date: format(date, "MMM dd"),
          completed: dayCompleted.length,
          total: dayTasks.length,
        });
      }

      // Task completion by priority
      const priorityStats = {
        urgent: { total: 0, completed: 0 },
        high: { total: 0, completed: 0 },
        medium: { total: 0, completed: 0 },
        low: { total: 0, completed: 0 },
      };

      allTasks.forEach((task) => {
        const priority = (task.priority || "medium") as keyof typeof priorityStats;
        if (priorityStats[priority]) {
          priorityStats[priority].total++;
          if (task.completed) {
            priorityStats[priority].completed++;
          }
        }
      });

      return {
        completionRate,
        thisWeekRate,
        lastWeekRate,
        totalTasks: allTasks.length,
        completedTasks: completedTasks.length,
        totalFocusTime,
        thisWeekFocusTime,
        dailyTrends,
        priorityStats,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-24 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return <Card className="p-6">No data available</Card>;
  }

  const priorityData = Object.entries(analytics.priorityStats).map(([priority, stats]) => ({
    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
    completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
    total: stats.total,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-amber-500/10 dark:from-purple-500/20 dark:to-amber-500/20 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{analytics.completionRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.completedTasks} of {analytics.totalTasks} tasks
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-purple-500 dark:text-purple-400" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-amber-500/10 dark:from-purple-500/20 dark:to-amber-500/20 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{analytics.thisWeekRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.lastWeekRate > 0 && (
                  <span className={analytics.thisWeekRate >= analytics.lastWeekRate ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                    {analytics.thisWeekRate >= analytics.lastWeekRate ? "↑" : "↓"} {Math.abs(analytics.thisWeekRate - analytics.lastWeekRate).toFixed(1)}%
                  </span>
                )}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-amber-500 dark:text-amber-400" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-amber-500/10 dark:from-purple-500/20 dark:to-amber-500/20 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Focus Time</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{Math.round(analytics.totalFocusTime / 60)}h</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.thisWeekFocusTime} min this week
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-500 dark:text-purple-400" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-amber-500/10 dark:from-purple-500/20 dark:to-amber-500/20 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{analytics.totalTasks}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.completedTasks} completed
              </p>
            </div>
            <Target className="h-8 w-8 text-amber-500 dark:text-amber-400" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Daily Completion Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed" fill="hsl(262,83%,58%)" name="Completed" />
              <Bar dataKey="total" fill="hsl(43,96%,56%)" name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Completion by Priority
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="priority" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="completionRate" fill="hsl(262,83%,58%)" name="Completion Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

