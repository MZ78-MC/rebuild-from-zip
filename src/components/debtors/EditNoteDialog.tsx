import { useState, useEffect } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DebtorNote {
  id: string;
  client_name: string | null;
  credit_limit: number | null;
  overdue: number | null;
  balance: number | null;
  summary: string | null;
  ai_generated: string | null;
  user_edited: string | null;
  urgency: string | null;
  sentiment: string | null;
}

interface EditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: DebtorNote | null;
}

export const EditNoteDialog = ({
  open,
  onOpenChange,
  note,
}: EditNoteDialogProps) => {
  const [editedText, setEditedText] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (note) {
      setEditedText(note.user_edited || note.summary || note.ai_generated || "");
    }
  }, [note]);

  const saveNote = useMutation({
    mutationFn: async () => {
      if (!note) throw new Error("No note selected");

      const originalText = note.ai_generated || note.summary || "";
      const correctedText = editedText.trim();

      // Update the note
      const { error: updateError } = await supabase
        .from("debtors_notes")
        .update({
          summary: correctedText,
          user_edited: correctedText,
        })
        .eq("id", note.id);

      if (updateError) throw updateError;

      // If text was edited, learn from it
      if (originalText !== correctedText && originalText && correctedText) {
        await supabase.functions.invoke("learn-from-edit", {
          body: {
            original_text: originalText,
            corrected_text: correctedText,
            note_id: note.id,
            context: "debtor_note",
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtors-notes"] });
      toast.success("Note updated and learning system updated!");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  if (!note) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Debtor Note</DialogTitle>
          <DialogDescription>
            Edit the summary. The AI will learn from your changes to improve future responses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client Info */}
          <div className="p-4 bg-background rounded-lg border border-border">
            <h4 className="font-medium mb-2">{note.client_name || "Unknown Client"}</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Credit Limit: </span>
                <span className="font-medium">R {note.credit_limit?.toLocaleString() || "0"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Overdue: </span>
                <span className="font-medium text-destructive">
                  R {note.overdue?.toLocaleString() || "0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Balance: </span>
                <span className="font-medium">R {note.balance?.toLocaleString() || "0"}</span>
              </div>
            </div>
          </div>

          {/* Original AI Generated Text */}
          {note.ai_generated && note.ai_generated !== editedText && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">AI Generated (Original):</Label>
              <div className="p-3 bg-muted/30 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground line-through">
                  {note.ai_generated}
                </p>
              </div>
            </div>
          )}

          {/* Editable Summary */}
          <div className="space-y-2">
            <Label htmlFor="summary">Your Summary:</Label>
            <Textarea
              id="summary"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder="Edit the summary in your preferred style..."
              className="bg-background border-border resize-none min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Your edits will teach the AI your writing style
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-border hover:bg-secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveNote.mutate()}
              disabled={!editedText.trim() || saveNote.isPending}
              className="flex-1 bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(239,84%,67%)] hover:from-[hsl(217,91%,65%)] hover:to-[hsl(239,84%,72%)] text-white shadow-lg shadow-blue-500/20 transition-all duration-300"
            >
              {saveNote.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Learn"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
