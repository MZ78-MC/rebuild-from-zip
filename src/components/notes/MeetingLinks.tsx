import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Plus, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type MeetingLink = {
  id: string;
  provider: string;
  link_url: string;
  title: string | null;
  description: string | null;
  enabled: boolean;
};

export const MeetingLinks = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [provider, setProvider] = useState<string>("calendly");
  const [linkUrl, setLinkUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const { data: links, isLoading } = useQuery({
    queryKey: ["meeting-links"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("meeting_links")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MeetingLink[];
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!linkUrl.trim()) {
        throw new Error("Link URL is required");
      }

      const { error } = await supabase.from("meeting_links").insert({
        user_id: user.id,
        provider,
        link_url: linkUrl.trim(),
        title: title.trim() || null,
        description: description.trim() || null,
        enabled: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-links"] });
      setDialogOpen(false);
      setLinkUrl("");
      setTitle("");
      setDescription("");
      toast.success("Meeting link added");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add link: ${error.message}`);
    },
  });

  const toggleLink = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("meeting_links")
        .update({ enabled })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-links"] });
      toast.success("Link updated");
    },
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meeting_links")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-links"] });
      toast.success("Link deleted");
    },
  });

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  if (isLoading) {
    return <Card className="p-4">Loading...</Card>;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Meeting Scheduling Links</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Share your availability with meeting links
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Meeting Link</DialogTitle>
                <DialogDescription>
                  Add a scheduling link from Calendly, Cal.com, or another provider
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendly">Calendly</SelectItem>
                      <SelectItem value="cal.com">Cal.com</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Link URL *</Label>
                  <Input
                    placeholder="https://calendly.com/your-link"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input
                    placeholder="30-minute meeting"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="Quick catch-up call"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => addLink.mutate()}
                  disabled={addLink.isPending || !linkUrl.trim()}
                  className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white"
                >
                  Add Link
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {links && links.length > 0 ? (
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="h-4 w-4 text-[hsl(262,83%,58%)] flex-shrink-0" />
                    <p className="font-medium truncate">
                      {link.title || `${link.provider} Link`}
                    </p>
                    <span className="text-xs text-muted-foreground capitalize">
                      ({link.provider})
                    </span>
                  </div>
                  {link.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {link.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {link.link_url}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyLink(link.link_url)}
                    title="Copy link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(link.link_url, "_blank")}
                    title="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={link.enabled}
                    onCheckedChange={(checked) =>
                      toggleLink.mutate({ id: link.id, enabled: checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteLink.mutate(link.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No meeting links added</p>
            <p className="text-sm mt-1">Add a link to share your availability</p>
          </div>
        )}
      </div>
    </Card>
  );
};

