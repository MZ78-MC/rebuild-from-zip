import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";

type Goal = Database["public"]["Tables"]["budget_goals"]["Row"];

export const BudgetGoals = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [goalType, setGoalType] = useState("savings");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState("");

  const queryClient = useQueryClient();

  const { data: goals, isLoading } = useQuery({
    queryKey: ["budget_goals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("budget_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Goal[];
    },
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  const createGoal = useMutation({
    mutationFn: async (goal: Database["public"]["Tables"]["budget_goals"]["Insert"]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("budget_goals")
        .insert({
          ...goal,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget_goals"] });
      toast.success("Goal created successfully");
      setShowDialog(false);
      setTargetAmount("");
      setDeadline("");
      setCategory("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create goal: ${error.message}`);
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("budget_goals")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget_goals"] });
      toast.success("Goal deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete goal: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAmount) {
      toast.error("Please enter a target amount");
      return;
    }

    createGoal.mutate({
      goal_type: goalType,
      target_amount: parseFloat(targetAmount),
      current_amount: 0,
      deadline: deadline ? new Date(deadline).toISOString() : "",
      category: category || "",
      status: "active",
    } as Database["public"]["Tables"]["budget_goals"]["Insert"]);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Budget Goals</h3>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(48,96%,53%)] hover:from-[hsl(142,76%,41%)] hover:to-[hsl(48,96%,58%)] text-white shadow-lg shadow-green-500/20 transition-all duration-300">
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Budget Goal</DialogTitle>
              <DialogDescription>
                Set a financial goal to track your progress
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="goalType">Goal Type</Label>
                  <Select value={goalType} onValueChange={setGoalType}>
                    <SelectTrigger id="goalType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings Goal</SelectItem>
                      <SelectItem value="spending_limit">Spending Limit</SelectItem>
                      <SelectItem value="category_limit">Category Limit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetAmount">Target Amount (R)</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    step="0.01"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                {goalType === "category_limit" && (
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., groceries"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline (optional)</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createGoal.isPending}
                  className="bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(48,96%,53%)] hover:from-[hsl(142,76%,41%)] hover:to-[hsl(48,96%,58%)] text-white"
                >
                  {createGoal.isPending ? "Creating..." : "Create Goal"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {goals && goals.length > 0 ? (
        <div className="space-y-4">
          {goals.map((goal) => {
            const progress = goal.target_amount > 0
              ? ((goal.current_amount || 0) / goal.target_amount) * 100
              : 0;
            const isCompleted = progress >= 100;
            const isOverdue = goal.deadline && new Date(goal.deadline) < new Date() && !isCompleted;

            return (
              <Card key={goal.id} className="p-6 bg-card border-border">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-[hsl(142,76%,36%)]/10">
                      <Target className="h-5 w-5 text-[hsl(142,76%,36%)]" />
                    </div>
                    <div>
                      <h4 className="font-semibold capitalize">{goal.goal_type.replace("_", " ")}</h4>
                      {goal.category && (
                        <p className="text-sm text-muted-foreground capitalize">{goal.category}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteGoal.mutate(goal.id)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Progress</span>
                    <span className="text-sm font-medium">
                      R{goal.current_amount?.toFixed(2) || "0.00"} / R{goal.target_amount.toFixed(2)}
                    </span>
                  </div>
                  <Progress value={Math.min(progress, 100)} className="h-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className={isCompleted ? "text-green-500 font-medium" : "text-muted-foreground"}>
                      {isCompleted ? "Completed!" : `${progress.toFixed(1)}%`}
                    </span>
                    {goal.deadline && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span className={isOverdue ? "text-red-500" : ""}>
                          {format(new Date(goal.deadline), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No goals yet. Create your first budget goal!</p>
        </Card>
      )}
    </div>
  );
};

