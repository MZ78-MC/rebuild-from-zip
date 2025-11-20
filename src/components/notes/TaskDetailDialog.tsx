import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Paperclip, 
  X, 
  Download,
  Loader2,
  Trash2
} from "lucide-react";
import { format, parseISO } from "date-fns";

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

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
}

export const TaskDetailDialog = ({ open, onOpenChange, task }: TaskDetailDialogProps) => {
  const [description, setDescription] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Load task data when dialog opens
  useEffect(() => {
    if (task && open) {
      setDescription(task.description || "");
      setIsEditingDescription(false);
      if (task.scheduled_time) {
        const scheduled = parseISO(task.scheduled_time);
        setRescheduleDate(scheduled);
        setRescheduleTime(format(scheduled, "HH:mm"));
      } else {
        setRescheduleDate(undefined);
        setRescheduleTime("");
      }
    }
  }, [task, open]);

  // Determine time period based on scheduled time
  const getTimePeriod = (scheduledTimeStr: string): "morning" | "afternoon" | "evening" | "unscheduled" => {
    if (!scheduledTimeStr) return "unscheduled";
    
    try {
      const scheduled = new Date(scheduledTimeStr);
      const hour = scheduled.getHours();
      
      if (hour >= 5 && hour < 12) return "morning";
      if (hour >= 12 && hour < 17) return "afternoon";
      if (hour >= 17 && hour < 22) return "evening";
      return "unscheduled";
    } catch {
      return "unscheduled";
    }
  };

  // Update description mutation
  const updateDescription = useMutation({
    mutationFn: async (newDescription: string) => {
      if (!task) throw new Error("No task selected");
      const { error } = await supabase
        .from("tasks")
        .update({ description: newDescription || null })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsEditingDescription(false);
      toast.success("Description updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update description: ${error.message}`);
    },
  });

  // Reschedule task mutation
  const rescheduleTask = useMutation({
    mutationFn: async (scheduledTime: Date) => {
      if (!task) throw new Error("No task selected");
      const timePeriod = getTimePeriod(scheduledTime.toISOString());
      const { error } = await supabase
        .from("tasks")
        .update({ 
          scheduled_time: scheduledTime.toISOString(),
          time_period: timePeriod,
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task rescheduled successfully");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to reschedule task: ${error.message}`);
    },
  });

  // Upload attachment mutation
  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      if (!task) throw new Error("No task selected");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size must be less than 10MB");
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop() || "file";
      const fileName = `${user.id}/${task.id}/${Date.now()}.${fileExt}`;
      const filePath = `tasks/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("task-attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("task-attachments")
        .getPublicUrl(filePath);

      // Get current attachments
      const { data: currentTask } = await supabase
        .from("tasks")
        .select("attachments")
        .eq("id", task.id)
        .single();

      const currentAttachments = (currentTask?.attachments as Array<any>) || [];
      const newAttachment = {
        id: `${Date.now()}`,
        name: file.name,
        url: publicUrl,
        size: file.size,
      };

      // Update task with new attachment
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          attachments: [...currentAttachments, newAttachment],
        })
        .eq("id", task.id);

      if (updateError) throw updateError;

      return newAttachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Attachment uploaded successfully");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload attachment: ${error.message}`);
    },
  });

  // Delete attachment mutation
  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!task) throw new Error("No task selected");

      // Get current attachments
      const { data: currentTask } = await supabase
        .from("tasks")
        .select("attachments")
        .eq("id", task.id)
        .single();

      const currentAttachments = (currentTask?.attachments as Array<any>) || [];
      const attachmentToDelete = currentAttachments.find((a: any) => a.id === attachmentId);
      
      if (attachmentToDelete) {
        // Extract file path from URL
        const url = new URL(attachmentToDelete.url);
        const pathParts = url.pathname.split("/");
        const filePath = pathParts.slice(pathParts.indexOf("task-attachments") + 1).join("/");
        
        // Delete from storage
        await supabase.storage
          .from("task-attachments")
          .remove([`tasks/${filePath}`]);
      }

      // Update task with remaining attachments
      const updatedAttachments = currentAttachments.filter((a: any) => a.id !== attachmentId);
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          attachments: updatedAttachments,
        })
        .eq("id", task.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Attachment deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete attachment: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadAttachment.mutate(file, {
        onSettled: () => setUploading(false),
      });
    }
  };

  const handleReschedule = () => {
    if (!rescheduleDate) {
      toast.error("Please select a date");
      return;
    }

    const [hours, minutes] = rescheduleTime.split(":").map(Number);
    const scheduledTime = new Date(rescheduleDate);
    scheduledTime.setHours(hours || 9, minutes || 0, 0, 0);

    rescheduleTask.mutate(scheduledTime);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!task) return null;

  const attachments = (task.attachments as Array<{ id: string; name: string; url: string; size?: number }>) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">{task.title}</DialogTitle>
          <DialogDescription>
            {task.completed ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500">
                Completed
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500">
                Active
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Task Details */}
          <div className="grid grid-cols-2 gap-4">
            {task.priority && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Priority</Label>
                <div>
                  <Badge variant="outline" className="capitalize">
                    {task.priority}
                  </Badge>
                </div>
              </div>
            )}
            {task.estimated_duration && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Duration</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  {Math.floor(task.estimated_duration / 60)}h {task.estimated_duration % 60}m
                </div>
              </div>
            )}
            {task.scheduled_time && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Scheduled</Label>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  {format(parseISO(task.scheduled_time), "MMM dd, yyyy 'at' h:mm a")}
                </div>
              </div>
            )}
            {task.due_date && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Due Date</Label>
                <div className="text-sm">
                  {format(parseISO(task.due_date), "MMM dd, yyyy")}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              {!isEditingDescription ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingDescription(true)}
                  className="h-8"
                >
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingDescription(false);
                      setDescription(task.description || "");
                    }}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => updateDescription.mutate(description)}
                    disabled={updateDescription.isPending}
                    className="h-8"
                  >
                    {updateDescription.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              )}
            </div>
            {isEditingDescription ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                className="bg-background border-border min-h-[120px] resize-none"
                rows={5}
              />
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 min-h-[120px] border border-border/50">
                {task.description ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{task.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description added yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  multiple={false}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || uploadAttachment.isPending}
                  className="h-8"
                >
                  {uploading || uploadAttachment.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-4 w-4 mr-2" />
                      Add Attachment
                    </>
                  )}
                </Button>
              </div>
            </div>
            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:text-[hsl(262,83%,58%)] truncate block"
                        >
                          {attachment.name}
                        </a>
                        {attachment.size && (
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.size)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(attachment.url, "_blank")}
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAttachment.mutate(attachment.id)}
                        disabled={deleteAttachment.isPending}
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50 text-center">
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              </div>
            )}
          </div>

          {/* Reschedule Section */}
          <div className="space-y-2 border-t border-border/50 pt-4">
            <Label>Reschedule Task</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-background border-border"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rescheduleDate ? format(rescheduleDate, "MMM dd, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={rescheduleDate}
                      onSelect={setRescheduleDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Time</Label>
                <Input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleDate || rescheduleTask.isPending}
              className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white shadow-lg shadow-purple-500/20"
            >
              {rescheduleTask.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                "Reschedule Task"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

