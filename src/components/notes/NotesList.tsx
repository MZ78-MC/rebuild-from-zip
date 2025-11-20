import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";
import { StickyNote, Trash2, Edit, Pin, Star } from "lucide-react";
import { toast } from "sonner";
import { EditNoteDialog } from "./EditNoteDialog";

interface NotesListProps {
  notebookId?: string | null;
  searchQuery?: string;
  onEditNote?: (noteId: string) => void;
}

export const NotesList = ({ notebookId, searchQuery = "", onEditNote }: NotesListProps) => {
  const queryClient = useQueryClient();
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["personal-notes", notebookId, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("personal_notes")
        .select("*");

      if (notebookId) {
        query = query.eq("notebook_id", notebookId);
      }

      if (searchQuery) {
        // Full-text search - search in content (title search will work after migration)
        query = query.ilike("content", `%${searchQuery}%`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        // If column doesn't exist yet, just ignore the filter
        if (error.code === "42703" || error.message.includes("column") || error.message.includes("does not exist")) {
          console.warn("Some columns may not exist yet. Please run the migration.");
          // Try without notebook filter if that's the issue
          if (notebookId) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("personal_notes")
              .select("*")
              .order("created_at", { ascending: false });
            if (fallbackError) throw fallbackError;
            return fallbackData;
          }
        }
        throw error;
      }
      return data || [];
    },
    retry: false,
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("personal_notes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-notes"] });
      toast.success("Note deleted successfully");
      setDeleteNoteId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        Loading notes...
      </Card>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <Card className="p-12 text-center">
        <StickyNote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No notes yet</h3>
        <p className="text-sm text-muted-foreground">
          Create your first note to get started
        </p>
      </Card>
    );
  }

  const sortedNotes = [...(notes || [])].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedNotes.map((note) => (
          <Card
            key={note.id}
            className={`p-6 bg-card border-border hover:border-[hsl(340,82%,65%)]/30 hover:shadow-[var(--shadow-card)] transition-all duration-200 relative group ${
              note.is_pinned ? "border-l-4 border-l-[hsl(340,82%,65%)]" : ""
            }`}
          >
            <div className="space-y-3">
              {note.title && (
                <h3 className="text-lg font-semibold text-foreground">{note.title}</h3>
              )}
              <div
                className="text-base text-foreground prose prose-sm max-w-none prose-headings:font-semibold prose-p:leading-relaxed"
                style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                dangerouslySetInnerHTML={{ __html: note.content || "" }}
              />
              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {format(new Date(note.created_at || new Date()), "MMM dd, yyyy 'at' HH:mm")}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                      if (onEditNote) {
                        onEditNote(note.id);
                      } else {
                        setEditNoteId(note.id);
                      }
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteNoteId(note.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNote.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNoteId && deleteNote.mutate(deleteNoteId)}
              disabled={deleteNote.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteNote.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Note Dialog */}
      {editNoteId && (
        <EditNoteDialog
          noteId={editNoteId}
          open={!!editNoteId}
          onOpenChange={(open) => !open && setEditNoteId(null)}
        />
      )}
    </>
  );
};
