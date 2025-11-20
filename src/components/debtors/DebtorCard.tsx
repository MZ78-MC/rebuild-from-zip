import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Edit, TrendingDown, TrendingUp, RefreshCw, Trash2, Target } from "lucide-react";
import { format } from "date-fns";
import { EditNoteDialog } from "./EditNoteDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  created_at: string;
  debtors_files?: {
    file_url: string;
  } | null;
}

interface DebtorCardProps {
  note: DebtorNote;
  availableGroups?: string[];
  onGroupCreated?: (groupName: string) => void;
}

export const DebtorCard = ({ note, availableGroups = [], onGroupCreated }: DebtorCardProps) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const queryClient = useQueryClient();

  const regenerateSummary = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("regenerate-summary", {
        body: { note_id: note.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtors-notes"] });
      toast.success("Summary regenerated in your current tone!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to regenerate: ${error.message}`);
    },
  });


  const updateUrgency = useMutation({
    mutationFn: async (urgency: string | null) => {
      const { error } = await supabase
        .from("debtors_notes")
        .update({ urgency: urgency })
        .eq("id", note.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtors-notes"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update group: ${error.message}`);
    },
  });

  const deleteNote = useMutation({
    mutationFn: async () => {
      // Delete the note (cascade will handle file deletion if needed)
      const { error } = await supabase
        .from("debtors_notes")
        .delete()
        .eq("id", note.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtors-notes"] });
      toast.success("Note deleted successfully");
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const getUrgencyColor = (urgency: string | null) => {
    switch (urgency?.toLowerCase()) {
      case "urgent":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "high":
        return "bg-warning/10 text-warning border-warning/20";
      case "medium":
        return "bg-[hsl(217,91%,60%)]/10 text-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)]/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Card className="p-6 bg-card border-border hover:border-[hsl(217,91%,60%)]/30 hover:shadow-[var(--shadow-elevated)] transition-all">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-foreground">
              {note.client_name || "Unknown Client"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(note.created_at), "MMM dd, yyyy")}
            </p>
          </div>
          {note.urgency && (
            <Badge className={getUrgencyColor(note.urgency)}>
              {note.urgency}
            </Badge>
          )}
        </div>

        {/* Screenshot */}
        {note.debtors_files?.file_url && (
          <div className="w-full rounded-lg overflow-hidden border border-border">
            <img
              src={note.debtors_files.file_url}
              alt={`Screenshot for ${note.client_name || "Unknown Client"}`}
              className="w-full h-auto object-contain max-h-48 bg-muted"
              loading="lazy"
              onError={(e) => {
                // Hide image on error
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Financial Details */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Credit Limit</p>
            <p className="text-base font-medium">
              R {note.credit_limit?.toLocaleString() || "0"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Overdue</p>
            <p className="text-base font-medium text-destructive flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              R {note.overdue?.toLocaleString() || "0"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Balance</p>
            <p className="text-base font-medium flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              R {note.balance?.toLocaleString() || "0"}
            </p>
          </div>
        </div>

        {/* Summary */}
        {note.summary && (
          <div className="pt-4 border-t border-border">
            <p className="text-base text-foreground/80 line-clamp-3">
              {note.summary}
            </p>
          </div>
        )}

        {/* Priority/Urgency */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <Select
              value={note.urgency || "medium"}
              onValueChange={(value) => {
                updateUrgency.mutate(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Set urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="low">Low Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 hover:bg-[hsl(217,91%,60%)]/10 hover:text-[hsl(217,91%,60%)] transition-colors"
            onClick={() => setShowEditDialog(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit & Learn
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 hover:bg-[hsl(217,91%,60%)]/10 hover:text-[hsl(217,91%,60%)] transition-colors"
            onClick={() => regenerateSummary.mutate()}
            disabled={regenerateSummary.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerateSummary.isPending ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteNote.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <EditNoteDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        note={note}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debtor Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note for {note.client_name || "Unknown Client"}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNote.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNote.mutate()}
              disabled={deleteNote.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteNote.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Card>
  );
};
