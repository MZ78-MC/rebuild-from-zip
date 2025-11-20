import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { NotesList } from "../notes/NotesList";
import { NotebooksSidebar } from "../notes/NotebooksSidebar";
import { NotesSearch } from "../notes/NotesSearch";
import { NoteEditor } from "../notes/NoteEditor";

export const NotesModule = () => {
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Keyboard shortcut: Ctrl/Cmd + N to create new note
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        if (!isCreatingNote && !editingNoteId) {
          setIsCreatingNote(true);
        }
      }
      if (e.key === "Escape") {
        setIsCreatingNote(false);
        setEditingNoteId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreatingNote, editingNoteId]);

  const handleNoteSaved = () => {
    setIsCreatingNote(false);
    setEditingNoteId(null);
  };

  const handleNoteCancel = () => {
    setIsCreatingNote(false);
    setEditingNoteId(null);
  };

  // If creating or editing, show editor
  if (isCreatingNote || editingNoteId) {
    return (
      <div className="h-full flex flex-col min-h-[600px]">
        <NoteEditor
          noteId={editingNoteId || undefined}
          initialNotebookId={selectedNotebookId}
          onSave={handleNoteSaved}
          onCancel={handleNoteCancel}
          autoFocus={!editingNoteId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-2 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Notes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Capture, organize, and find your ideas
            </p>
          </div>
          <Button
            onClick={() => setIsCreatingNote(true)}
            className="bg-gradient-to-r from-[hsl(340,82%,65%)] to-[hsl(15,88%,65%)] hover:from-[hsl(340,82%,70%)] hover:to-[hsl(15,88%,70%)] text-white shadow-lg shadow-rose-500/30 transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
        </div>
      </div>

      {/* Search */}
      <NotesSearch onSearch={setSearchQuery} searchQuery={searchQuery} />

      {/* Main Content with Sidebar */}
      <div className="flex gap-4">
        {/* Notebooks Sidebar */}
        <NotebooksSidebar
          selectedNotebookId={selectedNotebookId}
          onSelectNotebook={setSelectedNotebookId}
        />
        
        {/* Notes List */}
        <div className="flex-1">
          <NotesList 
            notebookId={selectedNotebookId} 
            searchQuery={searchQuery}
            onEditNote={(noteId) => setEditingNoteId(noteId)}
          />
        </div>
      </div>
    </div>
  );
};
