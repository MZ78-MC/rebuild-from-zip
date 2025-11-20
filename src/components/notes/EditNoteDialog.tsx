import { useState, useEffect } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { TagInput } from "./TagInput";

interface EditNoteDialogProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditNoteDialog = ({ noteId, open, onOpenChange }: EditNoteDialogProps) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const { data: note, isLoading } = useQuery({
    queryKey: ["note", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_notes")
        .select("*")
        .eq("id", noteId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!noteId && open,
  });

  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      setContent(note.content || "");
      setTags(note.tags || []);
    }
  }, [note]);

  const updateNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("personal_notes")
        .update({
          title: title.trim() || null,
          content,
          tags: tags.length > 0 ? tags : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", noteId);

      if (error) throw error;

      // Save version
      const { data: currentNote } = await supabase
        .from("personal_notes")
        .select("version")
        .eq("id", noteId)
        .single();

      const newVersion = (currentNote?.version || 1) + 1;

      await supabase.from("note_versions").insert({
        note_id: noteId,
        content: note?.content || "",
        title: note?.title || null,
        tags: note?.tags || null,
        version: note?.version || 1,
      });

      await supabase
        .from("personal_notes")
        .update({ version: newVersion })
        .eq("id", noteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-notes"] });
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      toast.success("Note updated successfully");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update note: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
          <DialogDescription>Update your note</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
            />
          </div>

          <div>
            <Label>Content</Label>
            <RichTextEditor content={content} onChange={setContent} placeholder="Write your note..." />
          </div>

          <div>
            <Label>Tags</Label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <Button
            onClick={() => updateNote.mutate()}
            disabled={!content.trim() || updateNote.isPending}
            className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white shadow-lg shadow-purple-500/20 transition-all duration-300"
          >
            {updateNote.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Note"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

