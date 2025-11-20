import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TransactionInsert = Database["public"]["Tables"]["user_finances"]["Insert"];

interface UploadReceiptDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const UploadReceiptDialog = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: UploadReceiptDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const queryClient = useQueryClient();

  const processReceipt = useMutation({
    mutationFn: async (imageBase64: string) => {
      const response = await supabase.functions.invoke("process-receipt", {
        body: { image_base64: imageBase64 },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      setExtractedData(data.extracted);
      toast.success("Receipt processed successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to process receipt: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const saveTransaction = useMutation({
    mutationFn: async (transaction: TransactionInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_finances")
        .insert({
          ...transaction,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_finances"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Transaction saved!");
      setOpen(false);
      setFile(null);
      setPreview(null);
      setExtractedData(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save transaction: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setFile(selectedFile);
    setExtractedData(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleProcess = async () => {
    if (!file || !preview) return;

    setIsProcessing(true);
    try {
      // Convert to base64
      const base64 = preview.split(",")[1];
      await processReceipt.mutateAsync(base64);
    } catch (error) {
      console.error("Processing error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (!extractedData || !extractedData.total_amount) {
      toast.error("No transaction data to save");
      return;
    }

    const transactionData = {
      type: "expense" as const,
      amount: parseFloat(extractedData.total_amount),
      category: extractedData.category || "other",
      vendor: extractedData.vendor || null,
      description: extractedData.items
        ? `Items: ${extractedData.items.join(", ")}`
        : `Receipt from ${extractedData.vendor || "vendor"}`,
      date: extractedData.date
        ? new Date(extractedData.date).toISOString()
        : new Date().toISOString(),
      source: "receipt",
    };

    saveTransaction.mutate(transactionData as TransactionInsert);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-[hsl(142,76%,36%)] text-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,36%)]/10"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Receipt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Receipt</DialogTitle>
          <DialogDescription>
            Upload a receipt image to automatically extract transaction details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="receipt">Receipt Image</Label>
            <Input
              id="receipt"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border border-border rounded-lg p-4 bg-muted/50">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="max-w-full h-auto rounded"
                />
              </div>
              {!extractedData && (
                <Button
                  onClick={handleProcess}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(48,96%,53%)] hover:from-[hsl(142,76%,41%)] hover:to-[hsl(48,96%,58%)] text-white"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Process Receipt
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Extracted Data */}
          {extractedData && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-500 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <Label>Extracted Information</Label>
              </div>
              <div className="border border-border rounded-lg p-4 bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Amount:</span>
                  <span className="text-sm font-semibold">R{extractedData.total_amount?.toFixed(2)}</span>
                </div>
                {extractedData.vendor && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Vendor:</span>
                    <span className="text-sm">{extractedData.vendor}</span>
                  </div>
                )}
                {extractedData.category && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Category:</span>
                    <span className="text-sm capitalize">{extractedData.category}</span>
                  </div>
                )}
                {extractedData.date && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Date:</span>
                    <span className="text-sm">
                      {new Date(extractedData.date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setFile(null);
              setPreview(null);
              setExtractedData(null);
            }}
          >
            Cancel
          </Button>
          {extractedData && (
            <Button
              onClick={handleSave}
              disabled={saveTransaction.isPending}
              className="bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(48,96%,53%)] hover:from-[hsl(142,76%,41%)] hover:to-[hsl(48,96%,58%)] text-white"
            >
              {saveTransaction.isPending ? "Saving..." : "Save Transaction"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

