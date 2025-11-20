import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface VersionHistoryProps {
  noteId: string;
  onRestore?: (versionId: string) => void;
}

export const VersionHistory = ({ noteId, onRestore }: VersionHistoryProps) => {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["note-versions", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_versions")
        .select("*")
        .eq("note_id", noteId)
        .order("version", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading versions...</div>;
  }

  if (!versions || versions.length === 0) {
    return <div className="p-4 text-muted-foreground">No version history</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b">
        <History className="h-4 w-4" />
        <h3 className="font-semibold">Version History</h3>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className="p-3 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium">Version {version.version}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {format(new Date(version.created_at), "MMM dd, yyyy 'at' HH:mm")}
                  </span>
                </div>
                {onRestore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRestore(version.id)}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Restore
                  </Button>
                )}
              </div>
              {version.title && (
                <div className="text-sm font-medium mb-1">{version.title}</div>
              )}
              <div
                className="text-sm text-muted-foreground line-clamp-3 prose prose-sm"
                dangerouslySetInnerHTML={{ __html: version.content?.substring(0, 200) || "" }}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

