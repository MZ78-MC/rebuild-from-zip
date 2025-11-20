import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, Square, Loader2 } from "lucide-react";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateTaskDialog = ({ open, onOpenChange }: CreateTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const queryClient = useQueryClient();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setEstimatedDuration("");
      setScheduledTime("");
      setIsRecording(false);
      setIsTranscribing(false);
    }
  }, [open]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Recording started...");
    } catch (error: any) {
      toast.error(`Failed to start recording: ${error.message}`);
      console.error("Recording error:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Recording stopped. Transcribing...");
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get auth token for Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];

        // Call transcription edge function
        const { data, error } = await supabase.functions.invoke("transcribe-voice", {
          body: {
            audio_base64: base64Audio,
            audio_type: "audio/webm",
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;

        if (data?.transcription) {
          // Parse transcribed text intelligently
          const transcribedText = data.transcription.trim();
          
          // Split by newlines or periods to separate title from description
          const lines = transcribedText.split(/[\n\.]/).filter(line => line.trim());
          
          if (lines.length > 0) {
            // First line/sentence becomes title
            const newTitle = lines[0].trim();
            // Rest becomes description
            const newDescription = lines.slice(1).join(". ").trim();
            
            // Update title, append to description if there's already content
            setTitle((prev) => prev ? prev : newTitle);
            setDescription((prev) => {
              if (newDescription) {
                return prev ? `${prev}\n\n${newDescription}` : newDescription;
              }
              return prev;
            });
          } else {
            // If no clear separation, use first 50 chars as title, rest as description
            if (transcribedText.length > 50) {
              setTitle((prev) => prev ? prev : transcribedText.substring(0, 50).trim());
              setDescription((prev) => {
                const desc = transcribedText.substring(50).trim();
                return prev ? `${prev}\n\n${desc}` : desc;
              });
            } else {
              setTitle((prev) => prev ? prev : transcribedText);
            }
          }
          
          toast.success("Voice transcribed successfully!");
        }
        setIsTranscribing(false);
      };
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast.error(`Transcription failed: ${error.message}`);
      setIsTranscribing(false);
    }
  };

  const createTask = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const timePeriod = getTimePeriod(scheduledTime);
      const scheduledTimeISO = scheduledTime ? new Date(scheduledTime).toISOString() : null;
      const durationMinutes = estimatedDuration ? parseInt(estimatedDuration) : null;

      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title,
        description: description || null,
        priority: priority as any,
        due_date: dueDate || null,
        estimated_duration: durationMinutes,
        scheduled_time: scheduledTimeISO,
        time_period: timePeriod,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setEstimatedDuration("");
      setScheduledTime("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to track your work
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">Title</Label>
              <div className="flex gap-2">
                {!isRecording ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startRecording}
                    disabled={isTranscribing}
                    className="border-border hover:bg-secondary"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Record Voice
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={stopRecording}
                    className="border-border"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Recording
                  </Button>
                )}
                {isTranscribing && (
                    <div className="flex items-center gap-2 text-base text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transcribing...
                    </div>
                )}
              </div>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title or use voice recording..."
              className="bg-background border-border"
              disabled={isRecording || isTranscribing}
            />
                {isRecording && (
                  <p className="text-sm text-destructive animate-pulse">● Recording...</p>
                )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
              className="bg-background border-border resize-none"
              rows={3}
              disabled={isRecording || isTranscribing}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedDuration">Estimated Duration (optional)</Label>
              <Select value={estimatedDuration} onValueChange={setEstimatedDuration}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="240">4+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledTime">Schedule Time (optional)</Label>
              <Input
                id="scheduledTime"
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <Button
            onClick={() => createTask.mutate()}
            disabled={!title.trim() || createTask.isPending || isRecording || isTranscribing}
            className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white shadow-lg shadow-purple-500/20 transition-all duration-300"
          >
            {createTask.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Task"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
