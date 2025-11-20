import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Plus,
  Folder,
  FolderOpen,
  Trash2,
  Edit,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface Notebook {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parent_stack_id: string | null;
}

interface Stack {
  id: string;
  name: string;
  notebooks: Notebook[];
}

interface NotebooksSidebarProps {
  selectedNotebookId: string | null;
  onSelectNotebook: (notebookId: string | null) => void;
}

export const NotebooksSidebar = ({ selectedNotebookId, onSelectNotebook }: NotebooksSidebarProps) => {
  const queryClient = useQueryClient();
  const [showNotebookDialog, setShowNotebookDialog] = useState(false);
  const [showStackDialog, setShowStackDialog] = useState(false);
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());
  const [notebookName, setNotebookName] = useState("");
  const [stackName, setStackName] = useState("");
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);

  const { data: notebooks } = useQuery({
    queryKey: ["notebooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notebooks")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          console.warn("Notebooks table not found. Please run the migration.");
          return [] as Notebook[];
        }
        throw error;
      }
      return (data || []) as Notebook[];
    },
    retry: false,
  });

  const { data: stacks } = useQuery({
    queryKey: ["stacks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stacks")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          console.warn("Stacks table not found. Please run the migration.");
          return [] as Stack[];
        }
        throw error;
      }
      return (data || []) as Stack[];
    },
    retry: false,
  });

  const createNotebook = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("notebooks").insert({
        user_id: user.id,
        name: notebookName,
        parent_stack_id: selectedStackId,
        color: "#8b5cf6",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Notebook created");
      setShowNotebookDialog(false);
      setNotebookName("");
      setSelectedStackId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create notebook: ${error.message}`);
    },
  });

  const createStack = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("stacks").insert({
        user_id: user.id,
        name: stackName,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stacks"] });
      toast.success("Stack created");
      setShowStackDialog(false);
      setStackName("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create stack: ${error.message}`);
    },
  });

  const deleteNotebook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notebooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      if (selectedNotebookId) {
        onSelectNotebook(null);
      }
      toast.success("Notebook deleted");
    },
  });

  const deleteStack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stacks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stacks"] });
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Stack deleted");
    },
  });

  const groupedNotebooks = (notebooks || []).reduce((acc, notebook) => {
    if (notebook.parent_stack_id) {
      if (!acc[notebook.parent_stack_id]) {
        acc[notebook.parent_stack_id] = [];
      }
      acc[notebook.parent_stack_id].push(notebook);
    } else {
      if (!acc["none"]) {
        acc["none"] = [];
      }
      acc["none"].push(notebook);
    }
    return acc;
  }, {} as Record<string, Notebook[]>);

  // Ensure stacks have notebooks array
  const stacksWithNotebooks = (stacks || []).map((stack) => ({
    ...stack,
    notebooks: groupedNotebooks[stack.id] || [],
  }));

  return (
    <div className="w-64 border-r border-border pr-4">
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => onSelectNotebook(null)}
            data-selected={selectedNotebookId === null}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            All Notes
          </Button>

          {/* Stacks */}
          {stacksWithNotebooks.map((stack) => {
            const stackNotebooks = stack.notebooks;
            const isExpanded = expandedStacks.has(stack.id);

            return (
              <div key={stack.id} className="space-y-1">
                <div className="flex items-center justify-between group">
                  <Button
                    variant="ghost"
                    className="flex-1 justify-start px-2 h-8"
                    onClick={() => {
                      const newExpanded = new Set(expandedStacks);
                      if (isExpanded) {
                        newExpanded.delete(stack.id);
                      } else {
                        newExpanded.add(stack.id);
                      }
                      setExpandedStacks(newExpanded);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 mr-1" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-1" />
                    )}
                    <FolderOpen className="h-4 w-4 mr-2" />
                    <span className="flex-1 text-left">{stack.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => deleteStack.mutate(stack.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {isExpanded && (
                  <div className="ml-4 space-y-1">
                    {stackNotebooks.map((notebook) => (
                      <Button
                        key={notebook.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => onSelectNotebook(notebook.id)}
                        data-selected={selectedNotebookId === notebook.id}
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        {notebook.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Notebooks without stacks */}
          {groupedNotebooks["none"]?.map((notebook) => (
            <Button
              key={notebook.id}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onSelectNotebook(notebook.id)}
              data-selected={selectedNotebookId === notebook.id}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              {notebook.name}
            </Button>
          ))}

          <div className="pt-4 space-y-2 border-t border-border">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowNotebookDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Notebook
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowStackDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Stack
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* Create Notebook Dialog */}
      <Dialog open={showNotebookDialog} onOpenChange={setShowNotebookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Notebook</DialogTitle>
            <DialogDescription>Organize your notes into notebooks</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notebook-name">Name</Label>
              <Input
                id="notebook-name"
                value={notebookName}
                onChange={(e) => setNotebookName(e.target.value)}
                placeholder="My Notebook"
              />
            </div>
            <div>
              <Label htmlFor="stack-select">Stack (optional)</Label>
              <select
                id="stack-select"
                className="w-full p-2 border border-border rounded-md bg-background"
                value={selectedStackId || ""}
                onChange={(e) => setSelectedStackId(e.target.value || null)}
              >
                <option value="">None</option>
                {stacksWithNotebooks.map((stack) => (
                  <option key={stack.id} value={stack.id}>
                    {stack.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => createNotebook.mutate()}
              disabled={!notebookName.trim() || createNotebook.isPending}
              className="w-full"
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Stack Dialog */}
      <Dialog open={showStackDialog} onOpenChange={setShowStackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Stack</DialogTitle>
            <DialogDescription>Group notebooks together</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="stack-name">Name</Label>
              <Input
                id="stack-name"
                value={stackName}
                onChange={(e) => setStackName(e.target.value)}
                placeholder="My Stack"
              />
            </div>
            <Button
              onClick={() => createStack.mutate()}
              disabled={!stackName.trim() || createStack.isPending}
              className="w-full"
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

