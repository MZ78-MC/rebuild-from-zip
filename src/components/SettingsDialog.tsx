import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const [toneFormal, setToneFormal] = useState(50);
  const [toneDirect, setToneDirect] = useState(50);
  const [toneEmpathetic, setToneEmpathetic] = useState(50);
  const queryClient = useQueryClient();

  // Load personality profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["personality-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("personality_profile")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data;
    },
  });

  // Update local state when profile loads
  useEffect(() => {
    if (profile) {
      setToneFormal(Math.round((profile.tone_formal || 0.5) * 100));
      setToneDirect(Math.round((profile.tone_direct || 0.5) * 100));
      setToneEmpathetic(Math.round((profile.tone_empathetic || 0.5) * 100));
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const profileData = {
        user_id: user.id,
        tone_formal: toneFormal / 100,
        tone_direct: toneDirect / 100,
        tone_empathetic: toneEmpathetic / 100,
      };

      const { error } = await supabase
        .from("personality_profile")
        .upsert(profileData, {
          onConflict: "user_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personality-profile"] });
      toast.success("Personality settings saved!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const retrainNow = useMutation({
    mutationFn: async () => {
      // Trigger a learning refresh (could analyze recent edits)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get recent learning logs
      const { data: logs } = await supabase
        .from("learning_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (logs && logs.length > 0) {
        // Re-process recent edits to update personality
        for (const log of logs.slice(0, 5)) {
          await supabase.functions.invoke("learn-from-edit", {
            body: {
              original_text: log.original_text,
              corrected_text: log.corrected_text,
              note_id: log.id,
              context: log.context || "debtor_note",
            },
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["personality-profile"] });
    },
    onSuccess: () => {
      toast.success("Personality retrained from recent edits!");
    },
    onError: (error: Error) => {
      toast.error(`Retraining failed: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-card border-border max-w-2xl"
        style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
      >
        <DialogHeader>
          <DialogTitle 
            className="text-2xl font-semibold"
            style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
          >
            Personality Settings
          </DialogTitle>
          <DialogDescription 
            className="text-sm"
            style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
          >
            Tune how Muzaffar Assistant writes and responds
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card 
            className="p-6 bg-background border-border space-y-6"
            style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label 
                  className="text-foreground font-medium"
                  style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                >
                  Formality
                </Label>
                <span 
                  className="text-sm text-muted-foreground font-medium"
                  style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                >
                  {toneFormal}%
                </span>
              </div>
              <Slider
                value={[toneFormal]}
                onValueChange={(v) => setToneFormal(v[0])}
                max={100}
                step={1}
                className="py-2"
              />
              <p 
                className="text-xs text-muted-foreground"
                style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
              >
                Lower = casual, Higher = professional
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label 
                  className="text-foreground font-medium"
                  style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                >
                  Directness
                </Label>
                <span 
                  className="text-sm text-muted-foreground font-medium"
                  style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                >
                  {toneDirect}%
                </span>
              </div>
              <Slider
                value={[toneDirect]}
                onValueChange={(v) => setToneDirect(v[0])}
                max={100}
                step={1}
                className="py-2"
              />
              <p 
                className="text-xs text-muted-foreground"
                style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
              >
                Lower = elaborate, Higher = concise
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label 
                  className="text-foreground font-medium"
                  style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                >
                  Empathy
                </Label>
                <span 
                  className="text-sm text-muted-foreground font-medium"
                  style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                >
                  {toneEmpathetic}%
                </span>
              </div>
              <Slider
                value={[toneEmpathetic]}
                onValueChange={(v) => setToneEmpathetic(v[0])}
                max={100}
                step={1}
                className="py-2"
              />
              <p 
                className="text-xs text-muted-foreground"
                style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
              >
                Lower = factual, Higher = empathetic
              </p>
            </div>
          </Card>

          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-border hover:bg-secondary"
                onClick={() => {
                  setToneFormal(50);
                  setToneDirect(50);
                  setToneEmpathetic(50);
                }}
              >
                Reset to Default
              </Button>
              <Button
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending}
                className="flex-1 bg-primary hover:bg-primary-glow text-primary-foreground"
              >
                {saveProfile.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
            <Button
              onClick={() => retrainNow.mutate()}
              disabled={retrainNow.isPending}
              className="w-full bg-primary hover:bg-primary-glow text-primary-foreground"
            >
              {retrainNow.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retraining...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retrain Now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
