import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "./RichTextEditor";

interface TemplatesManagerProps {
  onSelectTemplate?: (template: { content: string; title?: string; tags?: string[] }) => void;
}

export const TemplatesManager = ({ onSelectTemplate }: TemplatesManagerProps) => {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");

  const { data: templates } = useQuery({
    queryKey: ["note-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_templates")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("note_templates").insert({
        user_id: user.id,
        name: templateName,
        content: templateContent,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note-templates"] });
      toast.success("Template created");
      setShowDialog(false);
      setTemplateName("");
      setTemplateContent("");
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("note_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note-templates"] });
      toast.success("Template deleted");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Templates</h3>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {templates?.map((template) => (
            <div
              key={template.id}
              className="p-3 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 flex-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{template.name}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onSelectTemplate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectTemplate({ content: template.content })}
                  >
                    Use
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTemplate.mutate(template.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>Save a note template for reuse</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div>
              <Label>Content</Label>
              <RichTextEditor
                content={templateContent}
                onChange={setTemplateContent}
                placeholder="Template content..."
              />
            </div>
            <Button
              onClick={() => createTemplate.mutate()}
              disabled={!templateName.trim() || !templateContent.trim()}
              className="w-full"
            >
              Create Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

