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
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, Square, Loader2 } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { TagInput } from "./TagInput";

interface CreateNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateNoteDialog = ({ open, onOpenChange }: CreateNoteDialogProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
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
          const transcribedText = data.transcription;
          setContent((prev) => (prev ? `${prev}<p>${transcribedText}</p>` : `<p>${transcribedText}</p>`));
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

  const createNote = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("personal_notes").insert({
        user_id: user.id,
        title: title.trim() || null,
        content,
        tags: tags.length > 0 ? tags : null,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-notes"] });
      toast.success("Note created successfully");
      setTitle("");
      setContent("");
      setTags([]);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create note: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create New Note</DialogTitle>
          <DialogDescription>
            Capture your thoughts and ideas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Content</Label>
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
            <RichTextEditor content={content} onChange={setContent} placeholder="Write your note here or use voice recording..." />
            <p className="text-sm text-muted-foreground">
              {isRecording && (
                <span className="text-destructive animate-pulse">● Recording...</span>
              )}
            </p>
          </div>

          <div>
            <Label>Tags</Label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <Button
            onClick={() => createNote.mutate()}
            disabled={!content.trim() || createNote.isPending || isRecording || isTranscribing}
            className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white shadow-lg shadow-purple-500/20 transition-all duration-300"
          >
            {createNote.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Note"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
