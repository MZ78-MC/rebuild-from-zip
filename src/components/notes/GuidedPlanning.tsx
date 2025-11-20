import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Sun, Calendar, Target, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PlanningRitual = {
  id: string;
  ritual_type: string;
  template: any;
  enabled: boolean;
};

const MORNING_PLANNING_TEMPLATE = {
  prompts: [
    "What are my top 3 priorities for today?",
    "What would make today a great day?",
    "What obstacles might I face, and how will I handle them?",
  ],
  checklist: [
    "Review yesterday's accomplishments",
    "Identify today's must-do tasks",
    "Schedule time blocks for important work",
    "Set intentions for the day",
  ],
};

const WEEKLY_PLANNING_TEMPLATE = {
  prompts: [
    "What are my main goals for this week?",
    "What projects need my attention?",
    "What can I delegate or defer?",
    "How will I measure success this week?",
  ],
  checklist: [
    "Review last week's wins and learnings",
    "Set weekly goals and priorities",
    "Plan major tasks and deadlines",
    "Schedule important meetings and blocks",
    "Prepare for upcoming commitments",
  ],
};

export const GuidedPlanning = () => {
  const [ritualType, setRitualType] = useState<"morning" | "weekly">("morning");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  const { data: rituals, isLoading } = useQuery({
    queryKey: ["planning-rituals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("planning_rituals")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as PlanningRitual[];
    },
  });

  const template = ritualType === "morning" ? MORNING_PLANNING_TEMPLATE : WEEKLY_PLANNING_TEMPLATE;

  const saveRitual = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("planning_rituals")
        .upsert({
          user_id: user.id,
          ritual_type: ritualType,
          template: {
            responses,
            checklist: checklistItems,
            completed_at: new Date().toISOString(),
          },
          enabled: true,
        }, {
          onConflict: "user_id,ritual_type",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning-rituals"] });
      setDialogOpen(false);
      toast.success("Planning ritual saved!");
    },
  });

  const handleStartPlanning = () => {
    setResponses({});
    setChecklistItems({});
    setDialogOpen(true);
  };

  if (isLoading) {
    return <Card className="p-4">Loading...</Card>;
  }

  const morningRitual = rituals?.find((r) => r.ritual_type === "morning");
  const weeklyRitual = rituals?.find((r) => r.ritual_type === "weekly");

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-amber-500/10 dark:from-purple-500/20 dark:to-amber-500/20 border-border">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Sun className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              Guided Planning
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Structured planning rituals for better productivity
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Morning Planning */}
          <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <h4 className="font-semibold text-foreground">Morning Planning</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Start your day with intention and clarity
            </p>
            <Dialog open={dialogOpen && ritualType === "morning"} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setRitualType("morning");
            }}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setRitualType("morning");
                    handleStartPlanning();
                  }}
                >
                  Start Morning Planning
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Morning Planning - {format(new Date(), "MMMM dd, yyyy")}</DialogTitle>
                  <DialogDescription>
                    Set your intentions and priorities for today
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  {template.prompts.map((prompt, index) => (
                    <div key={index} className="space-y-2">
                      <Label>{prompt}</Label>
                      <Textarea
                        placeholder="Your response..."
                        value={responses[prompt] || ""}
                        onChange={(e) => setResponses({ ...responses, [prompt]: e.target.value })}
                        rows={3}
                      />
                    </div>
                  ))}
                  <div className="space-y-3">
                    <Label>Planning Checklist</Label>
                    {template.checklist.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Checkbox
                          checked={checklistItems[item] || false}
                          onCheckedChange={(checked) =>
                            setChecklistItems({ ...checklistItems, [item]: checked as boolean })
                          }
                        />
                        <Label className="font-normal cursor-pointer">{item}</Label>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => saveRitual.mutate()}
                    disabled={saveRitual.isPending}
                    className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white"
                  >
                    Save Planning Session
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Weekly Planning */}
          <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              <h4 className="font-semibold text-foreground">Weekly Planning</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Plan your week with strategic focus
            </p>
            <Dialog open={dialogOpen && ritualType === "weekly"} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setRitualType("weekly");
            }}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setRitualType("weekly");
                    handleStartPlanning();
                  }}
                >
                  Start Weekly Planning
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Weekly Planning - {format(startOfWeek(new Date()), "MMM dd")} to {format(endOfWeek(new Date()), "MMM dd, yyyy")}
                  </DialogTitle>
                  <DialogDescription>
                    Set your goals and priorities for the week
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  {template.prompts.map((prompt, index) => (
                    <div key={index} className="space-y-2">
                      <Label>{prompt}</Label>
                      <Textarea
                        placeholder="Your response..."
                        value={responses[prompt] || ""}
                        onChange={(e) => setResponses({ ...responses, [prompt]: e.target.value })}
                        rows={3}
                      />
                    </div>
                  ))}
                  <div className="space-y-3">
                    <Label>Planning Checklist</Label>
                    {template.checklist.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Checkbox
                          checked={checklistItems[item] || false}
                          onCheckedChange={(checked) =>
                            setChecklistItems({ ...checklistItems, [item]: checked as boolean })
                          }
                        />
                        <Label className="font-normal cursor-pointer">{item}</Label>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => saveRitual.mutate()}
                    disabled={saveRitual.isPending}
                    className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white"
                  >
                    Save Planning Session
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Card>
  );
};

