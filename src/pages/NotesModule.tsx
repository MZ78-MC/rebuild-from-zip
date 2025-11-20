import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

const NotesModule = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const { toast } = useToast();

  const createNote = () => {
    if (!newTitle.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }

    const note: Note = {
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      createdAt: new Date(),
    };

    setNotes([note, ...notes]);
    setNewTitle("");
    setNewContent("");
    setSelectedNote(note);
    toast({ title: "Note created successfully" });
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
    if (selectedNote?.id === id) setSelectedNote(null);
    toast({ title: "Note deleted" });
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes(notes.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, ...updates });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Notes</h1>
        <p className="text-muted-foreground">Create and manage your notes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Create Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Note title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Note content..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
            />
            <Button onClick={createNote} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Note
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your Notes ({notes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notes yet. Create your first note to get started!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedNote?.id === note.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                    onClick={() => setSelectedNote(note)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{note.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {note.content || "No content"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {note.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedNote && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={selectedNote.title}
              onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
            />
            <Textarea
              value={selectedNote.content}
              onChange={(e) => updateNote(selectedNote.id, { content: e.target.value })}
              rows={8}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotesModule;
