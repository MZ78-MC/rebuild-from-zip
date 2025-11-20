import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Square, RotateCcw, Coffee } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type PomodoroTimerProps = {
  taskId?: string | null;
  onComplete?: () => void;
};

type TimerState = "idle" | "running" | "paused" | "break";

const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds
const SHORT_BREAK = 5 * 60; // 5 minutes
const LONG_BREAK = 15 * 60; // 15 minutes

export const PomodoroTimer = ({ taskId, onComplete }: PomodoroTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(POMODORO_DURATION);
  const [state, setState] = useState<TimerState>("idle");
  const [isBreak, setIsBreak] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const queryClient = useQueryClient();

  const saveFocusSession = useMutation({
    mutationFn: async (duration: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("focus_sessions").insert({
        user_id: user.id,
        task_id: taskId || null,
        duration_minutes: Math.round(duration / 60),
        completed: true,
        started_at: startTimeRef.current?.toISOString() || new Date().toISOString(),
        ended_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Update task focus sessions count
      if (taskId) {
        // First get current count
        const { data: task } = await supabase
          .from("tasks")
          .select("focus_sessions_count")
          .eq("id", taskId)
          .single();
        
        const currentCount = task?.focus_sessions_count || 0;
        
        // Update with incremented value
        await supabase
          .from("tasks")
          .update({ focus_sessions_count: currentCount + 1 })
          .eq("id", taskId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["focus-sessions"] });
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
    },
  });

  useEffect(() => {
    if (state === "running" && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state, timeLeft]);

  const handleTimerComplete = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isBreak) {
      // Pomodoro completed
      const duration = POMODORO_DURATION - timeLeft;
      saveFocusSession.mutate(duration);
      setCompletedPomodoros((prev) => prev + 1);
      
      // Determine break type
      const breakDuration = completedPomodoros > 0 && completedPomodoros % 4 === 0 
        ? LONG_BREAK 
        : SHORT_BREAK;
      
      setIsBreak(true);
      setTimeLeft(breakDuration);
      setState("idle");
      toast.success("Pomodoro completed! Time for a break 🎉");
      onComplete?.();
    } else {
      // Break completed
      setIsBreak(false);
      setTimeLeft(POMODORO_DURATION);
      setState("idle");
      toast.success("Break over! Ready for another Pomodoro?");
    }
  };

  const startTimer = () => {
    if (state === "idle" && !startTimeRef.current) {
      startTimeRef.current = new Date();
    }
    setState("running");
  };

  const pauseTimer = () => {
    setState("paused");
  };

  const resetTimer = () => {
    setState("idle");
    setIsBreak(false);
    setTimeLeft(POMODORO_DURATION);
    startTimeRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const skipBreak = () => {
    setIsBreak(false);
    setTimeLeft(POMODORO_DURATION);
    setState("idle");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = isBreak 
    ? ((SHORT_BREAK - timeLeft) / SHORT_BREAK) * 100
    : ((POMODORO_DURATION - timeLeft) / POMODORO_DURATION) * 100;

  const maxTime = isBreak ? SHORT_BREAK : POMODORO_DURATION;

  return (
    <Card className="p-6 bg-gradient-to-br from-[hsl(262,83%,15%)] to-[hsl(43,96%,15%)] border-[hsl(262,83%,30%)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {isBreak ? "Break Time" : "Focus Mode"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isBreak 
                ? "Take a well-deserved break" 
                : completedPomodoros > 0 
                  ? `${completedPomodoros} completed today`
                  : "Stay focused and productive"}
            </p>
          </div>
          {completedPomodoros > 0 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(completedPomodoros, 4) }).map((_, i) => (
                <Coffee key={i} className="h-5 w-5 text-[hsl(43,96%,56%)]" />
              ))}
            </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <div className="text-6xl font-bold text-[hsl(262,83%,58%)] font-mono">
            {formatTime(timeLeft)}
          </div>
          <Progress 
            value={progress} 
            className="h-2 bg-muted/20"
          />
        </div>

        <div className="flex items-center justify-center gap-2">
          {state === "running" ? (
            <Button
              onClick={pauseTimer}
              variant="outline"
              size="lg"
              className="bg-background/50"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button
              onClick={startTimer}
              size="lg"
              className="bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white"
            >
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          )}
          
          {state !== "idle" && (
            <>
              <Button
                onClick={resetTimer}
                variant="outline"
                size="lg"
                className="bg-background/50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              {isBreak && (
                <Button
                  onClick={skipBreak}
                  variant="outline"
                  size="lg"
                  className="bg-background/50"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Skip Break
                </Button>
              )}
            </>
          )}
        </div>

        {state === "running" && (
          <p className="text-xs text-center text-muted-foreground">
            {isBreak ? "Relax and recharge..." : "Stay focused! You've got this 💪"}
          </p>
        )}
      </div>
    </Card>
  );
};

