import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "./RichTextEditor";
import { TagInput } from "./TagInput";
import { 
  Save, 
  X, 
  Mic, 
  Square, 
  Loader2,
  BookOpen,
  Calendar,
  Pin,
  Star,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface NoteEditorProps {
  noteId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  initialNotebookId?: string | null;
  onSave?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export const NoteEditor = ({
  noteId,
  initialTitle = "",
  initialContent = "",
  initialTags = [],
  initialNotebookId = null,
  onSave,
  onCancel,
  autoFocus = true,
}: NoteEditorProps) => {
  const queryClient = useQueryClient();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notebookId, setNotebookId] = useState<string | null>(initialNotebookId);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [reminderDate, setReminderDate] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(!!noteId);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch notebooks for selection
  const { data: notebooks } = useQuery({
    queryKey: ["notebooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notebooks")
        .select("*")
        .order("name", { ascending: true });

      if (error && error.code !== "42P01") throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
    retry: false,
  });

  // Fetch note data if editing
  const { data: existingNote, isLoading: isLoadingNote } = useQuery({
    queryKey: ["note", noteId],
    queryFn: async () => {
      if (!noteId) return null;
      const { data, error } = await supabase
        .from("personal_notes")
        .select("*")
        .eq("id", noteId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!noteId,
  });

  // Update state when note data loads (only when noteId or existingNote changes)
  useEffect(() => {
    if (noteId && existingNote) {
      // Editing existing note - load from database
      setTitle(existingNote.title || "");
      setContent(existingNote.content || "");
      setTags(existingNote.tags || []);
      setNotebookId(existingNote.notebook_id || null);
      setIsPinned(existingNote.is_pinned || false);
      setIsFavorite(existingNote.is_favorite || false);
      if (existingNote.reminder_date) {
        setReminderDate(new Date(existingNote.reminder_date));
      }
      setIsLoading(false);
    }
  }, [existingNote, noteId]);

  // Initialize state for new notes (only once when creating a new note)
  useEffect(() => {
    if (!noteId && !isLoading && !hasInitialized.current) {
      // Creating new note - use initial props only once
      setTitle(initialTitle);
      setContent(initialContent);
      setTags(initialTags);
      setNotebookId(initialNotebookId);
      setIsPinned(false);
      setIsFavorite(false);
      setReminderDate(null);
      hasInitialized.current = true;
    }
    // Reset flag when switching between notes
    if (noteId) {
      hasInitialized.current = false;
    }
  }, [noteId, isLoading, initialTitle, initialContent, initialTags, initialNotebookId]);

  // Auto-focus title on mount (only for new notes)
  useEffect(() => {
    if (autoFocus && titleInputRef.current && !noteId && !isLoading) {
      // Small delay to ensure input is ready
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, noteId, isLoading]);

  // Track changes
  useEffect(() => {
    if (title !== initialTitle || content !== initialContent || 
        JSON.stringify(tags) !== JSON.stringify(initialTags) ||
        notebookId !== initialNotebookId) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [title, content, tags, notebookId, initialTitle, initialContent, initialTags, initialNotebookId]);

  // Auto-save after 2 seconds of inactivity (only for existing notes)
  useEffect(() => {
    if (hasUnsavedChanges && content.trim() && noteId) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveNote.mutate();
      }, 2000);
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, content, tags, notebookId, noteId, hasUnsavedChanges]);

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
    } catch (error: any) {
      toast.error(`Failed to start recording: ${error.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];

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
          toast.success("Voice transcribed");
        }
        setIsTranscribing(false);
      };
    } catch (error: any) {
      toast.error(`Transcription failed: ${error.message}`);
      setIsTranscribing(false);
    }
  };

  const saveNote = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (noteId) {
        // Update existing note
        const { error } = await supabase
          .from("personal_notes")
          .update({
            title: title.trim() || null,
            content,
            tags: tags.length > 0 ? tags : null,
            notebook_id: notebookId,
            is_pinned: isPinned,
            is_favorite: isFavorite,
            reminder_date: reminderDate?.toISOString() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", noteId);

        if (error) throw error;
      } else {
        // Create new note
        const { error } = await supabase.from("personal_notes").insert({
          user_id: user.id,
          title: title.trim() || null,
          content,
          tags: tags.length > 0 ? tags : null,
          notebook_id: notebookId,
          is_pinned: isPinned,
          is_favorite: isFavorite,
          reminder_date: reminderDate?.toISOString() || null,
        } as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-notes"] });
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      setHasUnsavedChanges(false);
      if (!noteId) {
        toast.success("Note created");
        if (onSave) onSave();
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!content.trim()) {
      toast.error("Note content cannot be empty");
      return;
    }
    saveNote.mutate();
  };

  // Show loading state while fetching note data
  if (isLoading || (noteId && isLoadingNote)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading note...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg shadow-sm" style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 flex-1">
          {/* Notebook Selector */}
          <Select value={notebookId || "none"} onValueChange={(value) => setNotebookId(value === "none" ? null : value)}>
            <SelectTrigger className="w-[180px] h-8">
              <BookOpen className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select notebook" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No notebook</SelectItem>
              {notebooks?.map((notebook) => (
                <SelectItem key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPinned(!isPinned)}
              className={isPinned ? "bg-muted" : ""}
              title="Pin note"
            >
              <Pin className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFavorite(!isFavorite)}
              className={isFavorite ? "bg-muted" : ""}
              title="Favorite"
            >
              <Star className={`h-4 w-4 ${isFavorite ? "fill-current text-yellow-500" : ""}`} />
            </Button>
            {!isRecording ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={startRecording}
                disabled={isTranscribing}
                title="Record voice"
              >
                <Mic className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={stopRecording}
                className="text-destructive"
                title="Stop recording"
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
            {isTranscribing && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground px-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Transcribing...
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saveNote.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!content.trim() || saveNote.isPending || isRecording || isTranscribing}
            className="bg-gradient-to-r from-[hsl(340,82%,65%)] to-[hsl(15,88%,65%)] hover:from-[hsl(340,82%,70%)] hover:to-[hsl(15,88%,70%)] text-white shadow-lg shadow-rose-500/30"
          >
            {saveNote.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                {noteId ? "Save" : "Create"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-6">
          {/* Title - Evernote style: large, clean, no border */}
          <Input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="text-3xl font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent placeholder:text-muted-foreground/50"
          />

          {/* Tags - Always visible, below title */}
          <div className="pt-2">
            <TagInput tags={tags} onChange={setTags} />
          </div>

          {/* Content Editor - Full width, clean */}
          <div className="min-h-[500px] -mx-4">
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Start writing..."
            />
          </div>

          {/* Metadata - Subtle footer */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t border-border/50">
            {existingNote ? (
              <>
                <span>Created: {format(new Date(existingNote.created_at || new Date()), "MMM dd, yyyy 'at' HH:mm")}</span>
                {existingNote.updated_at && existingNote.updated_at !== existingNote.created_at && (
                  <span>• Updated: {format(new Date(existingNote.updated_at), "MMM dd, yyyy 'at' HH:mm")}</span>
                )}
              </>
            ) : (
              <span>New note</span>
            )}
            {hasUnsavedChanges && noteId && (
              <span className="text-orange-500">• Saving...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

