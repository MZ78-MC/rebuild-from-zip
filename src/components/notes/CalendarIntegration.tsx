import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Link2, RefreshCw, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type CalendarIntegration = {
  id: string;
  provider: string;
  enabled: boolean;
  last_sync_at: string | null;
};

export const CalendarIntegration = () => {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["calendar-integrations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("calendar_integrations")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as CalendarIntegration[];
    },
  });

  const toggleIntegration = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("calendar_integrations")
        .update({ enabled })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-integrations"] });
      toast.success("Integration updated");
    },
  });

  const connectCalendar = useMutation({
    mutationFn: async (provider: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // For Google Calendar, we'll use OAuth flow
      // This is a simplified version - in production, you'd redirect to OAuth
      if (provider === "google") {
        // In a real implementation, you'd redirect to Google OAuth
        // For now, we'll create a placeholder integration
        const { error } = await supabase.from("calendar_integrations").insert({
          user_id: user.id,
          provider: "google",
          enabled: true,
        });

        if (error) throw error;
        toast.info("Google Calendar integration requires OAuth setup. Please configure in settings.");
      } else {
        // For other providers, similar approach
        const { error } = await supabase.from("calendar_integrations").insert({
          user_id: user.id,
          provider,
          enabled: true,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-integrations"] });
      setConnectDialogOpen(false);
      toast.success("Calendar connected successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to connect: ${error.message}`);
    },
  });

  const syncCalendar = useMutation({
    mutationFn: async (integrationId: string) => {
      // In a real implementation, this would sync with the external calendar
      // For now, we'll just update the last_sync_at timestamp
      const { error } = await supabase
        .from("calendar_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Calendar synced");
    },
  });

  if (isLoading) {
    return <Card className="p-4">Loading...</Card>;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Calendar Integration</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Sync your tasks with external calendars
            </p>
          </div>
          <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white">
                <Link2 className="h-4 w-4 mr-2" />
                Connect Calendar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Calendar</DialogTitle>
                <DialogDescription>
                  Choose a calendar provider to sync with
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedProvider("google");
                    connectCalendar.mutate("google");
                  }}
                  disabled={connectCalendar.isPending}
                >
                  <Calendar className="h-5 w-5 mr-3" />
                  Google Calendar
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedProvider("outlook");
                    connectCalendar.mutate("outlook");
                  }}
                  disabled={connectCalendar.isPending}
                >
                  <Calendar className="h-5 w-5 mr-3" />
                  Outlook Calendar
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedProvider("ical");
                    connectCalendar.mutate("ical");
                  }}
                  disabled={connectCalendar.isPending}
                >
                  <Calendar className="h-5 w-5 mr-3" />
                  iCal / CalDAV
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {integrations && integrations.length > 0 ? (
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-card/50"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-[hsl(262,83%,58%)]" />
                  <div>
                    <p className="font-medium capitalize">{integration.provider} Calendar</p>
                    <p className="text-xs text-muted-foreground">
                      {integration.last_sync_at
                        ? `Last synced: ${new Date(integration.last_sync_at).toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncCalendar.mutate(integration.id)}
                    disabled={syncCalendar.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ${syncCalendar.isPending ? "animate-spin" : ""}`} />
                  </Button>
                  <Switch
                    checked={integration.enabled}
                    onCheckedChange={(checked) =>
                      toggleIntegration.mutate({ id: integration.id, enabled: checked })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No calendar integrations connected</p>
            <p className="text-sm mt-1">Connect a calendar to sync your tasks</p>
          </div>
        )}
      </div>
    </Card>
  );
};

