import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday } from "date-fns";
import { Sparkles, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DailyHighlight = {
  id: string;
  date: string;
  highlights: string[];
  achievements: string[];
  reflection: string | null;
  completed: boolean;
};

export const DailyShutdown = () => {
  const [highlightInput, setHighlightInput] = useState("");
  const [achievementInput, setAchievementInput] = useState("");
  const [reflectionInput, setReflectionInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayHighlight, isLoading } = useQuery({
    queryKey: ["daily-highlight", today],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("daily_highlights")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as DailyHighlight | null;
    },
  });

  const saveHighlight = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const highlights = todayHighlight?.highlights || [];
      const achievements = todayHighlight?.achievements || [];

      if (highlightInput.trim()) {
        highlights.push(highlightInput.trim());
      }
      if (achievementInput.trim()) {
        achievements.push(achievementInput.trim());
      }

      const { error } = await supabase
        .from("daily_highlights")
        .upsert({
          user_id: user.id,
          date: today,
          highlights,
          achievements,
          reflection: reflectionInput.trim() || todayHighlight?.reflection || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,date",
        });

      if (error) throw error;

      setHighlightInput("");
      setAchievementInput("");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-highlight", today] });
      toast.success("Saved!");
    },
  });

  const completeShutdown = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("daily_highlights")
        .upsert({
          user_id: user.id,
          date: today,
          highlights: todayHighlight?.highlights || [],
          achievements: todayHighlight?.achievements || [],
          reflection: reflectionInput.trim() || todayHighlight?.reflection || null,
          completed: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,date",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-highlight", today] });
      setDialogOpen(false);
      toast.success("Daily shutdown completed! 🎉");
    },
  });

  const removeHighlight = useMutation({
    mutationFn: async (index: number, type: "highlights" | "achievements") => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updated = [...(todayHighlight?.[type] || [])];
      updated.splice(index, 1);

      const { error } = await supabase
        .from("daily_highlights")
        .upsert({
          user_id: user.id,
          date: today,
          highlights: type === "highlights" ? updated : (todayHighlight?.highlights || []),
          achievements: type === "achievements" ? updated : (todayHighlight?.achievements || []),
          reflection: todayHighlight?.reflection || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,date",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-highlight", today] });
    },
  });

  if (isLoading) {
    return <Card className="p-4">Loading...</Card>;
  }

  const isCompleted = todayHighlight?.completed || false;

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-amber-500/10 dark:from-purple-500/20 dark:to-amber-500/20 border-border">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              Daily Shutdown
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Reflect on your day and celebrate your wins
            </p>
          </div>
          {isCompleted && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Completed</span>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full bg-background/50 border-border/50"
              disabled={isCompleted}
            >
              {isCompleted ? "Already completed today" : "Start Daily Shutdown"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Daily Shutdown - {format(new Date(), "MMMM dd, yyyy")}</DialogTitle>
              <DialogDescription>
                Take a moment to reflect on your day and celebrate your achievements
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Highlights */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Today's Highlights</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="What went well today?"
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && highlightInput.trim()) {
                        saveHighlight.mutate();
                      }
                    }}
                  />
                  <Button
                    onClick={() => saveHighlight.mutate()}
                    disabled={!highlightInput.trim() || saveHighlight.isPending}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {(todayHighlight?.highlights || []).map((highlight, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                    >
                      <span className="text-sm">{highlight}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHighlight.mutate(index, "highlights")}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Achievements */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Achievements</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="What did you accomplish?"
                    value={achievementInput}
                    onChange={(e) => setAchievementInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && achievementInput.trim()) {
                        saveHighlight.mutate();
                      }
                    }}
                  />
                  <Button
                    onClick={() => saveHighlight.mutate()}
                    disabled={!achievementInput.trim() || saveHighlight.isPending}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {(todayHighlight?.achievements || []).map((achievement, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                    >
                      <span className="text-sm">{achievement}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHighlight.mutate(index, "achievements")}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reflection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Reflection</Label>
                <Textarea
                  placeholder="What did you learn today? What would you do differently?"
                  value={reflectionInput || todayHighlight?.reflection || ""}
                  onChange={(e) => setReflectionInput(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => completeShutdown.mutate()}
                  disabled={completeShutdown.isPending}
                  className="flex-1 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white"
                >
                  Complete Shutdown
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Save for Later
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {todayHighlight && (
          <div className="space-y-3 pt-2">
            {(todayHighlight.highlights || []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Highlights</p>
                <div className="flex flex-wrap gap-2">
                  {todayHighlight.highlights.map((h, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-purple-500/20 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300 rounded-md border border-purple-500/30 dark:border-purple-500/50 font-medium"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(todayHighlight.achievements || []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Achievements</p>
                <div className="flex flex-wrap gap-2">
                  {todayHighlight.achievements.map((a, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-amber-500/20 dark:bg-amber-500/30 text-amber-700 dark:text-amber-300 rounded-md border border-amber-500/30 dark:border-amber-500/50 font-medium"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

