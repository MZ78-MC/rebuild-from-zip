import React, { useState, useEffect, useRef, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay, parseISO, addDays, isToday, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from "date-fns";
import { CheckCircle2, Clock, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, X, GripVertical, Calendar as CalendarIcon, Filter, Timer, Zap } from "lucide-react";
import { toast } from "sonner";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { PomodoroTimer } from "./PomodoroTimer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string | null;
  completed: boolean | null;
  estimated_duration: number | null;
  scheduled_time: string | null;
  time_period: "morning" | "afternoon" | "evening" | "unscheduled" | null;
  attachments?: Array<{ id: string; name: string; url: string; size?: number }> | null;
};

// Generate hourly time slots from 6 AM to 10 PM
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 6; hour <= 22; hour++) {
    slots.push(hour);
  }
  return slots;
};

const timeSlots = generateTimeSlots();
const SLOT_HEIGHT = 100; // Optimized height for better fit

// Priority color mapping
const getPriorityColor = (priority: string | null) => {
  switch (priority) {
    case "urgent":
      return {
        border: "border-l-4 border-l-red-500",
        bg: "bg-red-500/10",
        text: "text-red-500",
      };
    case "high":
      return {
        border: "border-l-4 border-l-orange-500",
        bg: "bg-orange-500/10",
        text: "text-orange-500",
      };
    case "medium":
      return {
        border: "border-l-4 border-l-[hsl(262,83%,58%)]",
        bg: "bg-[hsl(262,83%,58%)]/10",
        text: "text-[hsl(262,83%,58%)]",
      };
    case "low":
      return {
        border: "border-l-4 border-l-gray-500",
        bg: "bg-gray-500/10",
        text: "text-gray-500",
      };
    default:
      return {
        border: "border-l-4 border-l-[hsl(262,83%,58%)]",
        bg: "bg-[hsl(262,83%,58%)]/10",
        text: "text-[hsl(262,83%,58%)]",
      };
  }
};

export const TasksList = () => {
  const queryClient = useQueryClient();
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"timeline" | "list" | "weekly">("timeline");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    unscheduled: true,
  });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragPreviewTime, setDragPreviewTime] = useState<string | null>(null);
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "thisWeek" | "priority">("all");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [selectedTaskForPomodoro, setSelectedTaskForPomodoro] = useState<string | null>(null);
  const lastClickRef = useRef<{ taskId: string; time: number } | null>(null);
  const dragStartTimeRef = useRef<number | null>(null);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("scheduled_time", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data.map((task) => ({
        ...task,
        attachments: (task.attachments as any) || null,
      })) as Task[];
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ completed: !completed })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated");
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted successfully");
      setDeleteTaskId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    },
  });

  const bulkDeleteTasks = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`${selectedTasks.size} tasks deleted`);
      setSelectedTasks(new Set());
    },
  });

  const updateTaskSchedule = useMutation({
    mutationFn: async ({ id, scheduledTime }: { id: string; scheduledTime: Date }) => {
      const hour = scheduledTime.getHours();
      let timePeriod: "morning" | "afternoon" | "evening" | "unscheduled" = "unscheduled";
      
      if (hour >= 5 && hour < 12) timePeriod = "morning";
      else if (hour >= 12 && hour < 17) timePeriod = "afternoon";
      else if (hour >= 17 && hour < 22) timePeriod = "evening";

      const { error } = await supabase
        .from("tasks")
        .update({
          scheduled_time: scheduledTime.toISOString(),
          time_period: timePeriod,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task rescheduled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reschedule task: ${error.message}`);
    },
  });

  // Auto-schedule unscheduled tasks
  const autoSchedule = useMutation({
    mutationFn: async () => {
      if (!tasks) return;

      const unscheduledTasks = tasks
        .filter((t) => !t.completed && !t.scheduled_time)
        .sort((a, b) => {
          // Sort by priority: urgent > high > medium > low
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
          const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 2;
          if (aPriority !== bPriority) return bPriority - aPriority;
          
          // Then by due date
          if (a.due_date && b.due_date) {
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          }
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return 0;
        });

      const startHour = 9; // Start scheduling from 9 AM
      const endHour = 17; // End at 5 PM
      let currentTime = new Date(selectedDate);
      currentTime.setHours(startHour, 0, 0, 0);
      let currentDay = 0; // Track which day we're scheduling for

      const scheduledTasks: Array<{ id: string; time: Date }> = [];
      const existingTasks = tasks.filter((t) => t.scheduled_time && !t.completed);

      for (const task of unscheduledTasks) {
        const duration = task.estimated_duration || 60; // Default 60 minutes
        let attempts = 0;
        const maxAttempts = 200; // Prevent infinite loops
        let scheduled = false;

        while (!scheduled && attempts < maxAttempts) {
          attempts++;
          const taskStart = new Date(currentTime);
          const taskEnd = new Date(taskStart.getTime() + duration * 60 * 1000);

          // Check if task would fit in the current day
          if (taskEnd.getHours() > endHour || (taskEnd.getHours() === endHour && taskEnd.getMinutes() > 0)) {
            // Move to next day
            currentDay++;
            currentTime = new Date(selectedDate);
            currentTime.setDate(currentTime.getDate() + currentDay);
            currentTime.setHours(startHour, 0, 0, 0);
            continue;
          }

          // Check for conflicts with existing scheduled tasks (including newly scheduled ones)
          let hasConflict = false;
          const taskStartTime = taskStart.getTime();
          const taskEndTime = taskEnd.getTime();

          // Check against existing tasks on the same day
          for (const existing of existingTasks) {
            if (!existing.scheduled_time) continue;
            const existingStartDate = new Date(existing.scheduled_time);
            const existingDay = existingStartDate.getDate();
            const taskDay = taskStart.getDate();
            
            // Only check conflicts if on the same day
            if (existingDay !== taskDay || existingStartDate.getMonth() !== taskStart.getMonth() || existingStartDate.getFullYear() !== taskStart.getFullYear()) {
              continue;
            }

            const existingStart = existingStartDate.getTime();
            const existingDuration = existing.estimated_duration || 60;
            const existingEnd = existingStart + existingDuration * 60 * 1000;

            // Check if times overlap
            if (
              (taskStartTime >= existingStart && taskStartTime < existingEnd) ||
              (taskEndTime > existingStart && taskEndTime <= existingEnd) ||
              (taskStartTime <= existingStart && taskEndTime >= existingEnd)
            ) {
              hasConflict = true;
              // Move to after this conflicting task
              const newTime = new Date(existingEnd);
              // If moving past end hour, move to next day
              if (newTime.getHours() >= endHour) {
                currentDay++;
                currentTime = new Date(selectedDate);
                currentTime.setDate(currentTime.getDate() + currentDay);
                currentTime.setHours(startHour, 0, 0, 0);
              } else {
                currentTime = newTime;
              }
              break;
            }
          }

          // Check against newly scheduled tasks in this batch (same day only)
          if (!hasConflict) {
            for (const scheduledTask of scheduledTasks) {
              const scheduledStartDate = new Date(scheduledTask.time);
              const scheduledDay = scheduledStartDate.getDate();
              const taskDay = taskStart.getDate();
              
              // Only check conflicts if on the same day
              if (scheduledDay !== taskDay || scheduledStartDate.getMonth() !== taskStart.getMonth() || scheduledStartDate.getFullYear() !== taskStart.getFullYear()) {
                continue;
              }

              const scheduledStart = scheduledStartDate.getTime();
              const scheduledDuration = tasks.find(t => t.id === scheduledTask.id)?.estimated_duration || 60;
              const scheduledEnd = scheduledStart + scheduledDuration * 60 * 1000;

              if (
                (taskStartTime >= scheduledStart && taskStartTime < scheduledEnd) ||
                (taskEndTime > scheduledStart && taskEndTime <= scheduledEnd) ||
                (taskStartTime <= scheduledStart && taskEndTime >= scheduledEnd)
              ) {
                hasConflict = true;
                // Move to after this conflicting task
                const newTime = new Date(scheduledEnd);
                // If moving past end hour, move to next day
                if (newTime.getHours() >= endHour) {
                  currentDay++;
                  currentTime = new Date(selectedDate);
                  currentTime.setDate(currentTime.getDate() + currentDay);
                  currentTime.setHours(startHour, 0, 0, 0);
                } else {
                  currentTime = newTime;
                }
                break;
              }
            }
          }

          // If no conflict, schedule the task
          if (!hasConflict) {
            scheduledTasks.push({ id: task.id, time: new Date(taskStart) });
            currentTime = new Date(taskEnd);
            scheduled = true;
          }
        }

        // If we couldn't schedule after max attempts, skip this task
        if (!scheduled) {
          console.warn(`Could not schedule task ${task.id} after ${maxAttempts} attempts`);
        }
      }

      // Update all tasks in batch
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Batch update all tasks at once
      const updates = scheduledTasks.map(({ id, time }) => {
        const hour = time.getHours();
        let timePeriod: "morning" | "afternoon" | "evening" | "unscheduled" = "unscheduled";
        
        if (hour >= 5 && hour < 12) timePeriod = "morning";
        else if (hour >= 12 && hour < 17) timePeriod = "afternoon";
        else if (hour >= 17 && hour < 22) timePeriod = "evening";

        return {
          id,
          scheduled_time: time.toISOString(),
          time_period: timePeriod,
        };
      });

      // Update tasks one by one (Supabase doesn't support batch updates easily)
      for (const update of updates) {
        const { error } = await supabase
          .from("tasks")
          .update({
            scheduled_time: update.scheduled_time,
            time_period: update.time_period,
          })
          .eq("id", update.id)
          .eq("user_id", user.id);

        if (error) {
          console.error(`Failed to update task ${update.id}:`, error);
          throw error;
        }
      }

      return scheduledTasks.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Auto-scheduled ${count} task${count !== 1 ? "s" : ""}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to auto-schedule: ${error.message}`);
    },
  });

  const formatDuration = (minutes: number | null): string => {
    if (!minutes) return "";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate task block height based on duration
  const getTaskHeight = (task: Task): number => {
    const duration = task.estimated_duration || 60; // Default to 60 minutes
    const height = (duration / 60) * SLOT_HEIGHT;
    return Math.max(50, Math.min(height, SLOT_HEIGHT - 12)); // Min 50px, max slot height - padding
  };

  // Get tasks count for a specific date
  const getTaskCountForDate = (date: Date): number => {
    if (!tasks) return 0;
    return tasks.filter((task) => {
      if (!task.scheduled_time || task.completed) return false;
      try {
        const scheduled = parseISO(task.scheduled_time);
        return isSameDay(scheduled, date);
      } catch {
        return false;
      }
    }).length;
  };

  const getTasksForTimeSlot = (hour: number, dayTasks: Task[]): Task[] => {
    return dayTasks.filter((task) => {
      if (!task.scheduled_time) return false;
      try {
        const scheduled = parseISO(task.scheduled_time);
        const taskHour = scheduled.getHours();
        return taskHour === hour;
      } catch {
        return false;
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    // Don't start drag if this was a double-click
    if (dragStartTimeRef.current && Date.now() - dragStartTimeRef.current < 300) {
      e.preventDefault();
      return;
    }
    dragStartTimeRef.current = Date.now();
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(hour);
    
    // Calculate preview time
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slotHeight = rect.height;
    const minutesOffset = Math.round((y / slotHeight) * 60);
    const previewDate = new Date(selectedDate);
    previewDate.setHours(hour, minutesOffset, 0, 0);
    setDragPreviewTime(format(previewDate, "h:mm a"));
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
    setDragPreviewTime(null);
  };

  const handleDrop = (e: React.DragEvent, targetHour: number) => {
    e.preventDefault();
    setDragOverSlot(null);
    setDragPreviewTime(null);
    
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slotHeight = rect.height;
    const minutesOffset = Math.round((y / slotHeight) * 60);
    
    const newDate = new Date(selectedDate);
    newDate.setHours(targetHour, minutesOffset, 0, 0);
    
    updateTaskSchedule.mutate({ id: taskId, scheduledTime: newDate });
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverSlot(null);
    setDragPreviewTime(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "k":
            e.preventDefault();
            document.getElementById("task-search")?.focus();
            break;
          case "t":
            e.preventDefault();
            setViewMode(viewMode === "timeline" ? "list" : "timeline");
            break;
        }
      }
      if (e.key === "Escape") {
        setSelectedTasks(new Set());
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode]);

  // Handle double-click to open task detail dialog
  const handleTaskDoubleClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setTaskDetailOpen(true);
  }, []);

  // Handle single click with double-click detection
  const handleTaskClick = useCallback((task: Task, isSelectable: boolean, e: React.MouseEvent) => {
    if (isSelectable) {
      setSelectedTasks((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(task.id)) {
          newSelected.delete(task.id);
        } else {
          newSelected.add(task.id);
        }
        return newSelected;
      });
      return;
    }
    // Don't handle single click for double-click detection - let onDoubleClick handle it
  }, []);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground text-base">
        Loading tasks...
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-12 text-center">
        <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">No tasks yet</h3>
        <p className="text-base text-muted-foreground">
          Create your first task to get started
        </p>
      </div>
    );
  }

  // Filter tasks
  let filteredTasks = tasks.filter((task) => {
    if (task.completed) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!task.title.toLowerCase().includes(query) && 
          !task.description?.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Date filter
    if (filter === "today") {
      if (!task.scheduled_time) return false;
      try {
        return isToday(parseISO(task.scheduled_time));
      } catch {
        return false;
      }
    } else if (filter === "thisWeek") {
      if (!task.scheduled_time) return false;
      try {
        const scheduled = parseISO(task.scheduled_time);
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
        return scheduled >= weekStart && scheduled <= weekEnd;
      } catch {
        return false;
      }
    }

    return true;
  });

  const incompleteTasks = filteredTasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  // Filter tasks for selected date
  const dayTasks = incompleteTasks.filter((task) => {
    if (!task.scheduled_time) return false;
    try {
      const scheduled = parseISO(task.scheduled_time);
      return isSameDay(scheduled, selectedDate);
    } catch {
      return false;
    }
  });

  const unscheduledTasks = incompleteTasks.filter((task) => !task.scheduled_time);

  // Calculate current time position
  const getCurrentTimePosition = (): number | null => {
    if (!isToday(selectedDate)) return null;
    const now = currentTime;
    const hour = now.getHours();
    const minutes = now.getMinutes();
    if (hour < 6 || hour > 22) return null;
    
    const slotIndex = hour - 6;
    const positionInSlot = (minutes / 60) * SLOT_HEIGHT;
    return slotIndex * SLOT_HEIGHT + positionInSlot;
  };

  const currentTimePosition = getCurrentTimePosition();

  const TaskCard = ({ task, compact = false, draggable = false, showPriority = true, selectable = false }: { task: Task; compact?: boolean; draggable?: boolean; showPriority?: boolean; selectable?: boolean }) => {
    const priorityColors = getPriorityColor(task.priority);
    const isDueSoon = task.due_date && new Date(task.due_date) < addDays(new Date(), 3);
    const isSelected = selectedTasks.has(task.id);

  return (
      <div 
        className={`group border border-border/50 rounded-lg bg-card hover:bg-muted/50 transition-all duration-200 shadow-sm hover:shadow-md box-border ${compact ? "mb-2.5" : "mb-3"} ${
          draggedTaskId === task.id ? "opacity-50 scale-95" : "hover:scale-[1.01]"
        } ${draggable ? "cursor-move" : "cursor-pointer"} ${showPriority ? priorityColors.border : ""} ${
          isSelected ? "ring-2 ring-[hsl(262,83%,58%)] bg-[hsl(262,83%,58%)]/5 shadow-md" : ""
        }`}
        draggable={draggable}
        onDragStart={draggable ? (e) => handleDragStart(e, task.id) : undefined}
        onDragEnd={draggable ? handleDragEnd : undefined}
        onClick={(e) => {
          if (selectable) {
            handleTaskClick(task, selectable, e);
          }
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!selectable) {
            handleTaskDoubleClick(task);
          }
        }}
            >
          <div className="p-4">
            <div className="flex items-start gap-3.5">
            {selectable ? (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => {
                  const newSelected = new Set(selectedTasks);
                  if (checked) {
                    newSelected.add(task.id);
                  } else {
                    newSelected.delete(task.id);
                  }
                  setSelectedTasks(newSelected);
                }}
                className="mt-0.5 h-5 w-5 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
                  <Checkbox
                checked={task.completed || false}
                    onCheckedChange={() =>
                  toggleTask.mutate({ id: task.id, completed: task.completed || false })
                }
                className="mt-0.5 h-5 w-5 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className={`font-semibold text-foreground leading-snug ${compact ? "text-base" : "text-lg"}`}>
                        {task.title}
                      </h4>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTaskId(task.id);
                    }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
              
                    {task.description && (
                <p className={`text-muted-foreground leading-relaxed mb-2 ${compact ? "text-sm" : "text-base"} line-clamp-2`}>
                        {task.description}
                      </p>
              )}
              
              <div className="flex items-center gap-3 flex-wrap">
                {task.estimated_duration && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className={`${compact ? "text-xs" : "text-sm"} font-medium`}>{formatDuration(task.estimated_duration)}</span>
                  </div>
                )}
                {task.scheduled_time && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`${compact ? "text-xs" : "text-sm"} font-medium`}>
                      {format(parseISO(task.scheduled_time), "h:mm a")}
                    </span>
                  </div>
                    )}
                    {task.due_date && (
                  <div className={`flex items-center gap-1.5 ${isDueSoon ? "text-orange-500 font-semibold" : "text-muted-foreground"}`}>
                    <span className={`${compact ? "text-xs" : "text-sm"} font-medium`}>
                      Due {format(parseISO(task.due_date), "MMM dd, yyyy")}
                    </span>
                  </div>
                )}
                {task.priority && task.priority !== "medium" && (
                  <Badge variant="outline" className={`${priorityColors.text} ${priorityColors.bg} border-current text-xs px-2 py-0.5 font-medium`}>
                    {task.priority}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Compact Header with Search, Filters, and Navigation */}
        <div className="flex flex-col gap-3">
          {/* Top Row: View Toggle, Search, and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-1 border border-border/50 rounded-lg p-0.5 bg-card/80 shadow-sm">
                <Button
                  variant={viewMode === "timeline" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("timeline")}
                  className={`h-8 px-3 text-sm font-medium transition-all ${
                    viewMode === "timeline" 
                      ? "bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] text-white shadow-md shadow-purple-500/20" 
                      : "hover:bg-muted/50"
                  }`}
                >
                  Timeline
                </Button>
                <Button
                  variant={viewMode === "weekly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("weekly")}
                  className={`h-8 px-3 text-sm font-medium transition-all ${
                    viewMode === "weekly" 
                      ? "bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] text-white shadow-md shadow-purple-500/20" 
                      : "hover:bg-muted/50"
                  }`}
                >
                  Weekly
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={`h-8 px-3 text-sm font-medium transition-all ${
                    viewMode === "list" 
                      ? "bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] text-white shadow-md shadow-purple-500/20" 
                      : "hover:bg-muted/50"
                  }`}
                >
                  List
                </Button>
              </div>
              
              {/* Search - More compact */}
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="task-search"
                  placeholder="Q Search tasks... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-8 bg-background border-border/50 text-sm"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Action Buttons - Grouped */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPomodoroOpen(true);
                  setSelectedTaskForPomodoro(null);
                }}
                className="h-8 px-3 text-sm font-medium bg-card border-border/50 hover:bg-muted/50 shadow-sm"
                title="Start Focus Session"
              >
                <Timer className="h-4 w-4 mr-1.5" />
                Focus
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => autoSchedule.mutate()}
                disabled={autoSchedule.isPending}
                className="h-8 px-3 text-sm font-medium bg-card border-border/50 hover:bg-muted/50 shadow-sm"
                title="Auto-schedule unscheduled tasks"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                Auto-Schedule
              </Button>
            </div>
          </div>

          {/* Bottom Row: Date Navigation and Filters - More compact */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {/* Quick Date Navigation - Compact */}
              <div className="flex items-center gap-0.5 border border-border/50 rounded-lg p-0.5 bg-card/80 shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                  className="h-8 w-8 p-0 hover:bg-muted/50"
                  title="Previous day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                  className="h-8 px-2.5 text-xs font-medium hover:bg-muted/50"
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(addDays(new Date(), 1))}
                  className="h-8 px-2.5 text-xs font-medium hover:bg-muted/50"
                >
                  Tomorrow
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const nextWeek = addDays(new Date(), 7);
                    setSelectedDate(nextWeek);
                  }}
                  className="h-8 px-2.5 text-xs font-medium hover:bg-muted/50"
                >
                  Next Week
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="h-8 w-8 p-0 hover:bg-muted/50"
                  title="Next day"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Date Display - Compact */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 bg-card border-border/50 text-xs font-medium shadow-sm hover:bg-muted/50 px-3">
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {format(selectedDate, "MMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filter Chips - Compact */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {(["all", "today", "thisWeek"] as const).map((filterOption) => (
                <Button
                  key={filterOption}
                  variant={filter === filterOption ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(filterOption)}
                  className={`h-8 px-2.5 text-xs font-medium transition-all ${
                    filter === filterOption
                      ? "bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] text-white shadow-md shadow-purple-500/20"
                      : "bg-card border-border/50 hover:bg-muted/50 shadow-sm"
                  }`}
                >
                  {filterOption === "all" ? "All Tasks" : filterOption === "today" ? "Today" : "This Week"}
                </Button>
              ))}
            </div>
            
            {/* Selection Controls - Compact */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedTasks(new Set());
                }}
                className={`h-8 px-2.5 text-xs font-medium transition-all ${
                  selectionMode 
                    ? "bg-[hsl(262,83%,58%)]/10 border-[hsl(262,83%,58%)] text-[hsl(262,83%,58%)]" 
                    : "bg-card border-border/50 hover:bg-muted/50 shadow-sm"
                }`}
              >
                {selectionMode ? "Cancel" : "Select"}
              </Button>
              
              {selectedTasks.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    bulkDeleteTasks.mutate(Array.from(selectedTasks));
                  }}
                  disabled={bulkDeleteTasks.isPending}
                  className="h-8 px-2.5 text-xs font-medium bg-card border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 shadow-sm"
                >
                  Delete {selectedTasks.size}
                </Button>
              )}
            </div>
          </div>
        </div>

        {viewMode === "weekly" ? (
          /* Weekly View - Days as columns, Time as rows */
          <div className="border border-border/50 rounded-lg overflow-hidden bg-card/80 shadow-sm">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[100px_repeat(7,1fr)] min-w-[1000px]">
                {/* Time column header */}
                <div className="border-r border-b border-border/50 bg-muted/30 p-3 sticky left-0 z-20">
                  <div className="font-semibold text-sm text-foreground">Time</div>
                </div>
                
                {/* Day headers */}
                {eachDayOfInterval({
                  start: startOfWeek(selectedDate, { weekStartsOn: 0 }),
                  end: endOfWeek(selectedDate, { weekStartsOn: 0 }),
                }).map((day, idx) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  const dayTasks = incompleteTasks.filter((task) => {
                    if (!task.scheduled_time) return false;
                    try {
                      const scheduled = parseISO(task.scheduled_time);
                      return isSameDay(scheduled, day);
                    } catch {
                      return false;
                    }
                  });
                  
                  return (
                    <div
                      key={idx}
                      className={`border-b border-border/50 p-3 text-center cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[hsl(262,83%,58%)]/10 border-l-2 border-l-[hsl(262,83%,58%)]"
                          : isTodayDate
                          ? "bg-[hsl(43,96%,56%)]/5"
                          : "bg-muted/20"
                      } hover:bg-muted/30`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        {format(day, "EEE")}
                      </div>
                      <div className={`text-base font-semibold ${
                        isSelected ? "text-[hsl(262,83%,58%)]" : isTodayDate ? "text-[hsl(43,96%,56%)]" : "text-foreground"
                      }`}>
                        {format(day, "d")}
                      </div>
                      {dayTasks.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {dayTasks.length} task{dayTasks.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Time slots with tasks */}
                {timeSlots.map((hour) => (
                  <React.Fragment key={hour}>
                    {/* Time label */}
                    <div className={`border-r border-b border-border/40 px-3 py-2 bg-gradient-to-b from-muted/40 to-muted/20 sticky left-0 z-10 ${
                      hour % 2 === 0 ? "bg-muted/10" : "bg-transparent"
                    }`}>
                      <span className="text-xs font-bold text-foreground/80">
                        {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                      </span>
                    </div>

                    {/* Day columns for this time slot */}
                    {eachDayOfInterval({
                      start: startOfWeek(selectedDate, { weekStartsOn: 0 }),
                      end: endOfWeek(selectedDate, { weekStartsOn: 0 }),
                    }).map((day, dayIdx) => {
                      // Get tasks that start in this specific hour
                      const slotTasks = incompleteTasks.filter((task) => {
                        if (!task.scheduled_time || task.completed) return false;
                        try {
                          const scheduled = parseISO(task.scheduled_time);
                          const taskHour = scheduled.getHours();
                          return isSameDay(scheduled, day) && taskHour === hour;
                        } catch {
                          return false;
                        }
                      });

                      return (
                        <div
                          key={dayIdx}
                          className={`border-b border-r border-border/40 relative min-h-[${SLOT_HEIGHT}px] ${
                            hour % 2 === 0 ? "bg-muted/5" : "bg-transparent"
                          }`}
                          style={{ height: `${SLOT_HEIGHT}px`, minHeight: `${SLOT_HEIGHT}px` }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const minutesOffset = Math.round((y / rect.height) * 60);
                            const newDate = new Date(day);
                            newDate.setHours(hour, minutesOffset, 0, 0);
                            setDragPreviewTime(format(newDate, "h:mm a"));
                            setDragOverSlot(hour);
                          }}
                          onDragLeave={() => {
                            setDragOverSlot(null);
                            setDragPreviewTime(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverSlot(null);
                            setDragPreviewTime(null);
                            
                            const taskId = e.dataTransfer.getData("text/plain");
                            if (!taskId) return;

                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const minutesOffset = Math.round((y / rect.height) * 60);
                            
                            const newDate = new Date(day);
                            newDate.setHours(hour, minutesOffset, 0, 0);
                            
                            updateTaskSchedule.mutate({ id: taskId, scheduledTime: newDate });
                            setDraggedTaskId(null);
                          }}
                        >
                          {slotTasks.map((task) => {
                            const scheduled = parseISO(task.scheduled_time!);
                            const taskMinutes = scheduled.getMinutes();
                            const taskHeight = getTaskHeight(task);
                            const priorityColors = getPriorityColor(task.priority);
                            const absoluteTop = (taskMinutes / 60) * SLOT_HEIGHT;
                            
                            return (
                              <Tooltip key={task.id}>
                                <TooltipTrigger asChild>
                                  <div
                                    draggable={true}
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      handleDragStart(e, task.id);
                                    }}
                                    onDragEnd={handleDragEnd}
                                    onDoubleClick={() => handleTaskDoubleClick(task)}
                                    className={`${priorityColors.bg} ${priorityColors.border} border-2 border-border/60 rounded-lg p-2 cursor-move hover:shadow-xl transition-all group absolute left-1 right-1 shadow-md ${
                                      draggedTaskId === task.id ? "opacity-50 scale-95" : "hover:scale-[1.01] hover:border-[hsl(262,83%,58%)]/50"
                                    }`}
                                    style={{
                                      height: `${taskHeight}px`,
                                      minHeight: `${taskHeight}px`,
                                      top: `${absoluteTop}px`,
                                      userSelect: "none",
                                      WebkitUserSelect: "none",
                                      zIndex: 30,
                                    }}
                                  >
                                    <div className="flex items-center gap-2 h-full">
                                      <Checkbox
                                        checked={task.completed || false}
                                        onCheckedChange={(checked) => {
                                          toggleTask.mutate({ id: task.id, completed: !checked });
                                        }}
                                        className="h-3.5 w-3.5 flex-shrink-0 pointer-events-auto"
                                        onClick={(e) => e.stopPropagation()}
                                        draggable={false}
                                      />
                                      <span className="text-xs font-semibold text-foreground truncate flex-1" draggable={false}>
                                        {task.title}
                                      </span>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <div className="space-y-2">
                                    <div className="font-medium">{task.title}</div>
                                    {task.description && (
                                      <div className="text-sm text-muted-foreground">{task.description}</div>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      {task.estimated_duration && (
                                        <span>Duration: {formatDuration(task.estimated_duration)}</span>
                                      )}
                                      {task.priority && (
                                        <span>Priority: {task.priority}</span>
                                      )}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          
                          {dragOverSlot === hour && dragPreviewTime && (
                            <div className="absolute top-1 right-1 bg-[hsl(262,83%,58%)] text-white px-2 py-1 rounded text-xs font-semibold z-20 shadow-lg pointer-events-none">
                              {dragPreviewTime}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Unscheduled Tasks for Weekly View */}
            {unscheduledTasks.length > 0 && (
              <div className="border-t border-border/50 p-4 bg-card/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-foreground">
                    Unscheduled Tasks ({unscheduledTasks.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => autoSchedule.mutate()}
                    disabled={autoSchedule.isPending}
                    className="h-8 px-3 text-sm font-medium"
                  >
                    Auto-Schedule All
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {unscheduledTasks.map((task) => (
                    <TaskCard key={task.id} task={task} compact draggable={!selectionMode} showPriority selectable={selectionMode} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : viewMode === "timeline" ? (
          <div className={`grid gap-6 transition-all duration-300 ${calendarCollapsed ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3 xl:grid-cols-5"}`}>
            {/* Calendar Sidebar - Wider on larger screens */}
            <div className={`lg:col-span-1 xl:col-span-2 transition-all duration-300 ${calendarCollapsed ? "hidden lg:block lg:w-0 lg:overflow-hidden" : ""}`}>
              <div className="border border-border/50 rounded-2xl p-5 bg-gradient-to-br from-card via-card to-card/95 shadow-2xl sticky top-4 overflow-hidden backdrop-blur-sm" style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
                {/* Modern header with elegant styling */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/40">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1 tracking-tight" style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
                      Calendar
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium" style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
                      {format(selectedDate, "MMMM yyyy")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalendarCollapsed(!calendarCollapsed)}
                    className="h-8 w-8 p-0 hover:bg-muted/60 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    {calendarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </Button>
                </div>
                {!calendarCollapsed && (
                  <div className="relative w-full">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      className="rounded-xl w-full"
                      classNames={{
                        months: "flex flex-col space-y-4 w-full",
                        month: "space-y-3 w-full",
                        caption: "flex justify-center pt-2 relative items-center mb-4",
                        caption_label: "text-lg font-bold text-foreground tracking-tight",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-9 w-9 bg-background/90 hover:bg-muted border border-border/50 rounded-xl p-0 opacity-80 hover:opacity-100 transition-all duration-200 hover:border-[hsl(262,83%,58%)]/50 hover:shadow-lg hover:scale-105 active:scale-95 hover:shadow-[hsl(262,83%,58%)]/10",
                        nav_button_previous: "absolute left-0",
                        nav_button_next: "absolute right-0",
                        table: "w-full border-collapse",
                        head_row: "flex mb-3",
                        head_cell: "text-muted-foreground rounded-lg w-11 font-bold text-[0.7rem] uppercase tracking-wider text-center",
                        row: "flex w-full mt-2",
                        cell: "h-11 w-11 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                        day: "h-11 w-11 p-0 font-semibold rounded-xl transition-all duration-200 aria-selected:opacity-100 hover:bg-muted/70 hover:scale-110 active:scale-95 hover:shadow-md",
                        day_selected: "bg-gradient-to-br from-[hsl(262,83%,58%)] to-[hsl(262,83%,63%)] text-white hover:from-[hsl(262,83%,63%)] hover:to-[hsl(262,83%,68%)] hover:text-white focus:from-[hsl(262,83%,58%)] focus:to-[hsl(262,83%,63%)] focus:text-white font-bold shadow-xl shadow-[hsl(262,83%,58%)]/30 ring-2 ring-[hsl(262,83%,58%)]/30 scale-105",
                        day_today: "bg-gradient-to-br from-[hsl(43,96%,56%)]/20 to-[hsl(43,96%,56%)]/10 text-[hsl(43,96%,56%)] font-bold border-2 border-[hsl(43,96%,56%)]/40 shadow-sm",
                        day_outside: "text-muted-foreground/30 opacity-40",
                        day_disabled: "text-muted-foreground opacity-25 cursor-not-allowed",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                      modifiersClassNames={{
                        selected: "bg-gradient-to-br from-[hsl(262,83%,58%)] to-[hsl(262,83%,63%)] text-white",
                      }}
                    />
                    {/* Modern Task indicators - Subtle dots below dates */}
                    <div className="absolute inset-0 pointer-events-none [&_.rdp-day]:relative">
                      {Array.from({ length: 35 }, (_, i) => {
                        const today = new Date(selectedDate);
                        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                        const startDate = new Date(firstDay);
                        startDate.setDate(startDate.getDate() - firstDay.getDay());
                        const checkDate = new Date(startDate);
                        checkDate.setDate(startDate.getDate() + i);
                        
                        // Only show for current month
                        if (checkDate.getMonth() !== today.getMonth()) return null;
                        
                        const count = getTaskCountForDate(checkDate);
                        if (count === 0) return null;
                        
                        const week = Math.floor(i / 7);
                        const day = i % 7;
                        const isSelected = isSameDay(checkDate, selectedDate);
                        const isTodayDate = isToday(checkDate);
                        
                        // Modern color scheme based on task density with gradients
                        const getIndicatorStyle = (taskCount: number) => {
                          if (taskCount >= 5) return "bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30";
                          if (taskCount >= 3) return "bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30";
                          return "bg-gradient-to-br from-[hsl(262,83%,58%)] to-[hsl(262,83%,63%)] shadow-md shadow-[hsl(262,83%,58%)]/25";
                        };
                        
                        const indicatorColor = getIndicatorStyle(count);
                        
                        return (
                          <div
                            key={i}
                            className="absolute pointer-events-none z-10"
                            style={{
                              top: `${58 + week * 44}px`,
                              left: `${day * 14.28 + 7.14}%`,
                              transform: "translate(-50%, 0)",
                            }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-0.5 pointer-events-auto cursor-pointer">
                                  {/* Modern dot indicator with improved styling */}
                                  <div className="flex items-center justify-center gap-1">
                                    {count <= 3 ? (
                                      // Show individual dots for 1-3 tasks
                                      Array.from({ length: Math.min(count, 3) }).map((_, idx) => (
                                        <div
                                          key={idx}
                                          className={`h-2 w-2 rounded-full ${indicatorColor} shadow-sm`}
                                        />
                                      ))
                                    ) : (
                                      // Show count badge for 4+ tasks
                                      <div className={`h-5 w-5 rounded-full ${indicatorColor} text-white text-[0.65rem] flex items-center justify-center font-bold shadow-lg border-2 border-white/30`}>
                                        {count > 9 ? "9+" : count}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-popover border border-border/50 shadow-lg">
                                <div className="space-y-1">
                                  <p className="font-semibold text-sm">{count} task{count > 1 ? "s" : ""}</p>
                                  <p className="text-xs text-muted-foreground">{format(checkDate, "EEEE, MMMM dd, yyyy")}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline View - Optimized width */}
            <div className={`transition-all duration-300 ${calendarCollapsed ? "lg:col-span-1" : "lg:col-span-2 xl:col-span-3"}`}>
              <div className="border border-border/50 rounded-lg overflow-hidden bg-card/80 shadow-sm">
                <div className="grid grid-cols-[120px_1fr]">
                  {/* Time Column - Optimized width */}
                  <div className="border-r border-border/50 bg-gradient-to-b from-muted/40 to-muted/20">
                    {timeSlots.map((hour, index) => (
                      <div
                        key={hour}
                        className={`border-b border-border/40 px-3 py-3 flex items-start ${index % 2 === 0 ? "bg-muted/10" : "bg-transparent"}`}
                        style={{ height: `${SLOT_HEIGHT}px` }}
                      >
                        <span className="text-sm font-bold text-foreground/80 leading-tight">
                          {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Tasks Column */}
                  <div className="relative" ref={timelineRef} style={{ zIndex: 0 }}>
                    {/* Current Time Indicator */}
                    {currentTimePosition !== null && (
                      <div
                        className="absolute left-0 right-0 z-10 pointer-events-none"
                        style={{ top: `${currentTimePosition}px` }}
                      >
                        <div className="flex items-center">
                          <div className="h-0.5 bg-red-500 flex-1 shadow-sm" />
                          <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-background -ml-1.5 shadow-md" />
                        </div>
                      </div>
                    )}

                    {/* Time Markers (15/30/45 min) */}
                    {timeSlots.map((hour) => (
                      <div
                        key={`markers-${hour}`}
                        className="absolute left-0 right-0 border-b border-border/20 pointer-events-none"
                        style={{ top: `${(hour - 6) * SLOT_HEIGHT + SLOT_HEIGHT / 4}px`, zIndex: 1 }}
                      />
                    ))}
                    {timeSlots.map((hour) => (
                      <div
                        key={`markers-${hour}-2`}
                        className="absolute left-0 right-0 border-b border-border/20 pointer-events-none"
                        style={{ top: `${(hour - 6) * SLOT_HEIGHT + SLOT_HEIGHT / 2}px`, zIndex: 1 }}
                      />
                    ))}
                    {timeSlots.map((hour) => (
                      <div
                        key={`markers-${hour}-3`}
                        className="absolute left-0 right-0 border-b border-border/20 pointer-events-none"
                        style={{ top: `${(hour - 6) * SLOT_HEIGHT + (SLOT_HEIGHT * 3) / 4}px`, zIndex: 1 }}
                      />
                    ))}

                    {/* Render all tasks at timeline level, not within slots */}
                    {dayTasks
                      .filter((task) => task.scheduled_time)
                      .map((task) => {
                        const scheduled = parseISO(task.scheduled_time!);
                        const taskHour = scheduled.getHours();
                        const taskMinutes = scheduled.getMinutes();
                        const taskHeight = getTaskHeight(task);
                        const priorityColors = getPriorityColor(task.priority);
                        
                        // Calculate absolute position from top of timeline
                        const absoluteTop = (taskHour - 6) * SLOT_HEIGHT + (taskMinutes / 60) * SLOT_HEIGHT;
                        
                        return (
                          <Tooltip key={task.id}>
                            <TooltipTrigger asChild>
                              <div
                                draggable={true}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, task.id);
                                }}
                                onDragEnd={(e) => {
                                  e.stopPropagation();
                                  handleDragEnd();
                                }}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleTaskDoubleClick(task);
                                }}
                                onMouseDown={(e) => {
                                  if (e.detail === 1) {
                                    dragStartTimeRef.current = null;
                                  }
                                }}
                                onMouseUp={(e) => {
                                  if (e.detail === 2) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }
                                }}
                                className={`${priorityColors.bg} ${priorityColors.border} border-2 border-border/60 rounded-lg p-3 cursor-move hover:shadow-xl transition-all group absolute left-2 right-2 shadow-md ${
                                  draggedTaskId === task.id ? "opacity-50 scale-95" : "hover:scale-[1.01] hover:border-[hsl(262,83%,58%)]/50"
                                }`}
                                style={{
                                  height: `${taskHeight}px`,
                                  minHeight: `${taskHeight}px`,
                                  top: `${absoluteTop}px`,
                                  userSelect: "none",
                                  WebkitUserSelect: "none",
                                  zIndex: 30,
                                }}
                              >
                                <div 
                                  className="flex items-center justify-between gap-2 h-full"
                                  onDragStart={(e) => {
                                    if (!e.defaultPrevented) {
                                      e.stopPropagation();
                                      handleDragStart(e, task.id);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    <Checkbox
                                      checked={task.completed || false}
                                      onCheckedChange={(checked) => {
                                        toggleTask.mutate({ id: task.id, completed: !checked });
                                      }}
                                      className="h-4 w-4 flex-shrink-0 pointer-events-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                      }}
                                      draggable={false}
                                    />
                                    <span 
                                      className="text-sm font-semibold text-foreground truncate leading-snug flex-1"
                                      draggable={false}
                                      onDragStart={(e) => e.preventDefault()}
                                    >
                                      {task.title}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive flex-shrink-0 transition-opacity pointer-events-auto"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setDeleteTaskId(task.id);
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                    draggable={false}
                                    onDragStart={(e) => e.preventDefault()}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                {task.estimated_duration && taskHeight > 50 && (
                                  <div 
                                    className="text-xs text-muted-foreground mt-1.5 ml-9 flex items-center gap-1"
                                    draggable={false}
                                    onDragStart={(e) => e.preventDefault()}
                                  >
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(task.estimated_duration)}
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <div className="space-y-2">
                                <div className="font-medium">{task.title}</div>
                                {task.description && (
                                  <div className="text-sm text-muted-foreground">{task.description}</div>
                                )}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {task.estimated_duration && (
                                    <span>Duration: {formatDuration(task.estimated_duration)}</span>
                                  )}
                                  {task.priority && (
                                    <span className="capitalize">Priority: {task.priority}</span>
                                  )}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}

                    {/* Time slot drop zones */}
                    {timeSlots.map((hour) => {
                      const slotTasks = getTasksForTimeSlot(hour, dayTasks);
                      return (
                        <div
                          key={hour}
                          className={`border-b border-border/50 px-3 py-2 relative transition-all ${
                            dragOverSlot === hour ? "bg-[hsl(262,83%,58%)]/10 border-[hsl(262,83%,58%)]/50 ring-1 ring-[hsl(262,83%,58%)]/30" : ""
                          }`}
                          style={{ 
                            height: `${SLOT_HEIGHT}px`, 
                            minHeight: `${SLOT_HEIGHT}px`, 
                            zIndex: 1,
                            pointerEvents: "auto"
                          }}
                          onDragOver={(e) => handleDragOver(e, hour)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, hour)}
                        >
                          {dragOverSlot === hour && dragPreviewTime && (
                            <div className="absolute top-2 right-2 bg-[hsl(262,83%,58%)] text-white px-2.5 py-1.5 rounded-md text-xs font-semibold z-20 shadow-lg pointer-events-none">
                              {dragPreviewTime}
                            </div>
                          )}
                          
                          {slotTasks.length === 0 && (
                            <div className="h-full flex items-center justify-center pointer-events-none">
                              <div className="text-xs text-muted-foreground/30 font-medium opacity-50">Drop tasks here</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Unscheduled Tasks - Always visible */}
              {unscheduledTasks.length > 0 && (
                <div className="mt-6 border-t border-border/50 pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-px w-10 bg-gradient-to-r from-transparent via-[hsl(262,83%,58%)]/50 to-transparent" />
                      <h3 className="text-base font-bold text-foreground">
                        Unscheduled Tasks ({unscheduledTasks.length})
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => autoSchedule.mutate()}
                        disabled={autoSchedule.isPending}
                        className="h-8 px-3 text-sm font-medium bg-card border-border/50 hover:bg-muted/50 shadow-sm"
                      >
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        Auto-Schedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Schedule all unscheduled tasks to today at 9 AM
                          unscheduledTasks.forEach((task) => {
                            const scheduleTime = new Date(selectedDate);
                            scheduleTime.setHours(9, 0, 0, 0);
                            updateTaskSchedule.mutate({ id: task.id, scheduledTime: scheduleTime });
                          });
                          toast.success(`Scheduling ${unscheduledTasks.length} tasks...`);
                        }}
                        className="h-8 px-3 text-sm font-medium bg-card border-border/50 hover:bg-muted/50 shadow-sm"
                      >
                        Schedule All to Today
                      </Button>
                    </div>
                  </div>
                  <div className="border border-border/50 rounded-lg overflow-hidden bg-card/80 shadow-sm">
                    <Collapsible
                      open={expandedSections.unscheduled}
                      onOpenChange={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          unscheduled: !prev.unscheduled,
                        }))
                      }
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-[hsl(262,83%,58%)]/10 border-[hsl(262,83%,58%)]/30 text-[hsl(262,83%,58%)]">
                              {unscheduledTasks.length}
                            </Badge>
                            <h3 className="text-sm font-semibold text-foreground">
                              Click to {expandedSections.unscheduled ? "collapse" : "expand"} unscheduled tasks
                            </h3>
                          </div>
                          {expandedSections.unscheduled ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-border/50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {unscheduledTasks.map((task) => (
                              <TaskCard key={task.id} task={task} compact draggable={!selectionMode} showPriority selectable={selectionMode} />
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {dayTasks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground mb-2">
                  Scheduled for {format(selectedDate, "MMMM dd")}
                </h3>
              {dayTasks.map((task) => (
                <TaskCard key={task.id} task={task} showPriority selectable={selectionMode} draggable={!selectionMode} />
              ))}
              </div>
            )}

            {/* Unscheduled Tasks for List View - Always visible */}
            {unscheduledTasks.length > 0 && (
              <div className="mt-6 border-t border-border/50 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-px w-10 bg-gradient-to-r from-transparent via-[hsl(262,83%,58%)]/50 to-transparent" />
                    <h3 className="text-base font-bold text-foreground">
                      Unscheduled Tasks ({unscheduledTasks.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => autoSchedule.mutate()}
                      disabled={autoSchedule.isPending}
                      className="h-8 px-3 text-sm font-medium"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      Auto-Schedule
                    </Button>
                  </div>
                </div>
                <div className="border border-border/50 rounded-lg overflow-hidden bg-card/80 shadow-sm">
                  <Collapsible
                    open={expandedSections.unscheduled}
                    onOpenChange={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        unscheduled: !prev.unscheduled,
                      }))
                    }
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-[hsl(262,83%,58%)]/10 border-[hsl(262,83%,58%)]/30 text-[hsl(262,83%,58%)]">
                            {unscheduledTasks.length}
                          </Badge>
                          <h3 className="text-sm font-semibold text-foreground">
                            Click to {expandedSections.unscheduled ? "collapse" : "expand"} unscheduled tasks
                          </h3>
                        </div>
                        {expandedSections.unscheduled ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-border/50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {unscheduledTasks.map((task) => (
                            <TaskCard key={task.id} task={task} compact draggable={!selectionMode} showPriority selectable={selectionMode} />
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <div className="mt-6 pt-5 border-t border-border/50">
            <Collapsible>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between px-2 py-2.5 hover:bg-muted/30 transition-colors rounded-md">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-base font-semibold text-muted-foreground">
                      Completed ({completedTasks.length})
                    </h3>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2.5 pt-3">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="group border border-border/50 rounded-lg p-4 bg-card/40 opacity-60 hover:opacity-90 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-start gap-3.5">
                        <Checkbox
                          checked={task.completed || false}
                          onCheckedChange={() =>
                            toggleTask.mutate({ id: task.id, completed: task.completed || false })
                          }
                          className="mt-0.5 h-5 w-5 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-base font-semibold text-muted-foreground line-through">
                              {task.title}
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity flex-shrink-0"
                              onClick={() => setDeleteTaskId(task.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskId && deleteTask.mutate(deleteTaskId)}
              disabled={deleteTask.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteTask.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={taskDetailOpen}
        onOpenChange={setTaskDetailOpen}
        task={selectedTask}
      />

      <Dialog open={pomodoroOpen} onOpenChange={setPomodoroOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Focus Session</DialogTitle>
          </DialogHeader>
          <PomodoroTimer
            taskId={selectedTaskForPomodoro}
            onComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};
