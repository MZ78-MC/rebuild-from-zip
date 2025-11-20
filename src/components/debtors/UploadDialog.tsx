import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X, Play } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UploadDialog = ({ open, onOpenChange }: UploadDialogProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [pastedFiles, setPastedFiles] = useState<File[]>([]);
  const queryClient = useQueryClient();
  const isProcessingRef = useRef(false);

  // Handle file upload/processing
  const handleFile = async (file: File, fileIndex?: number, totalFiles?: number) => {
    // Prevent duplicate processing
    if (isProcessingRef.current && fileIndex === undefined) {
      console.log("Upload already in progress, ignoring duplicate request");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name}: File size must be less than 10MB`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(`${file.name}: Please upload an image file`);
      return;
    }

    if (fileIndex === undefined) {
      isProcessingRef.current = true;
      setUploading(true);
    }

    if (fileIndex !== undefined && totalFiles !== undefined) {
      setUploadProgress({ current: fileIndex + 1, total: totalFiles, fileName: file.name });
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `debtors/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("debtors-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("debtors-files")
        .getPublicUrl(filePath);

      // Create file record
      const { data: fileRecord, error: fileError } = await supabase
        .from("debtors_files")
        .insert({
          user_id: user.id,
          file_url: publicUrl,
          file_name: file.name,
        })
        .select()
        .single();

      if (fileError) {
        throw fileError;
      }

      if (fileIndex === undefined) {
        toast.success("File uploaded! Processing with AI...");
      }

      // Get auth token for Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Process with AI
      const { data, error: processError } = await supabase.functions.invoke(
        "process-debtor-screenshot",
        {
          body: {
            file_url: publicUrl,
            file_id: fileRecord.id,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      // Check if response has an error field first (even if processError exists, data might have the error message)
      if (data?.error) {
        console.error("AI processing error from response:", data.error);
        let errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        
        // Include suggestion if available
        if (data.suggestion) {
          errorMessage += ` ${data.suggestion}`;
        } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
          errorMessage += " Try using a different AI API key (GEMINI_API_KEY, GROQ_API_KEY, etc.) or wait for quota reset.";
        }
        
        throw new Error(errorMessage);
      }

      if (processError) {
        console.error("Edge Function error:", processError);
        
        // Try to extract error message from the error object
        let errorMessage = "Failed to process screenshot.";
        
        if (processError.message) {
          errorMessage = processError.message;
        } else if (typeof processError === 'object' && processError !== null) {
          // Check for common error fields
          if ('error' in processError) {
            const err = processError.error;
            if (typeof err === 'string') {
              errorMessage = err;
            } else if (typeof err === 'object' && err !== null && 'message' in err) {
              errorMessage = String(err.message);
            } else {
              errorMessage = JSON.stringify(err);
            }
          } else if ('message' in processError) {
            errorMessage = String(processError.message);
          }
        }
        
        // Add helpful context based on status code or message
        if (errorMessage.includes("quota") || errorMessage.includes("429") || processError.status === 429) {
          errorMessage = "AI API quota exceeded. Try using a different AI API key (GEMINI_API_KEY, GROQ_API_KEY, etc.) or wait for quota reset.";
        } else if (errorMessage.includes("Not authenticated") || errorMessage.includes("401") || processError.status === 401) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (processError.status === 406) {
          errorMessage = "Request format not accepted. Please try again.";
        }
        
        throw new Error(errorMessage);
      }

      // Verify that a note was created
      if (!data?.note) {
        throw new Error("AI processing completed but no note was created. Please try again.");
      }

      if (fileIndex === undefined) {
        toast.success("AI analysis complete!");
        queryClient.invalidateQueries({ queryKey: ["debtors-notes"] });
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      let errorMessage = "Unknown error";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      }
      
      const displayMessage = fileIndex !== undefined 
        ? `${file.name}: ${errorMessage}`
        : `Failed to upload: ${errorMessage}`;
      toast.error(displayMessage);
      throw error; // Re-throw to allow batch processing to continue
    } finally {
      if (fileIndex === undefined) {
        setUploading(false);
        isProcessingRef.current = false;
      }
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // If multiple files, process them sequentially
    if (files.length > 1) {
      isProcessingRef.current = true;
      setUploading(true);
      
      try {
        for (let i = 0; i < files.length; i++) {
          await handleFile(files[i], i, files.length);
        }
        toast.success(`Successfully processed ${files.length} screenshot(s)!`);
        queryClient.invalidateQueries({ queryKey: ["debtors-notes"] });
        onOpenChange(false);
      } catch (error) {
        // Individual file errors are already handled in handleFile
        console.error("Batch upload error:", error);
      } finally {
        setUploading(false);
        setUploadProgress(null);
        isProcessingRef.current = false;
      }
    } else {
      // Single file - use existing flow
      await handleFile(files[0]);
    }
  };

  // Process all queued files
  const processQueuedFiles = async () => {
    if (pastedFiles.length === 0) return;
    
    const filesToProcess = [...pastedFiles];
    setPastedFiles([]); // Clear queue immediately
    
    isProcessingRef.current = true;
    setUploading(true);
    
    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        await handleFile(filesToProcess[i], i, filesToProcess.length);
      }
      toast.success(`Successfully processed ${filesToProcess.length} screenshot(s)!`);
      queryClient.invalidateQueries({ queryKey: ["debtors-notes"] });
      onOpenChange(false);
    } catch (error) {
      // Individual file errors are already handled in handleFile
      console.error("Batch upload error:", error);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      isProcessingRef.current = false;
    }
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Reset processing state when dialog closes
      isProcessingRef.current = false;
      setUploading(false);
      setUploadProgress(null);
      // Clean up object URLs before clearing files
      pastedFiles.forEach((file) => {
        // Object URLs are automatically cleaned up when component unmounts
      });
      setPastedFiles([]);
      return;
    }

    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't process if already processing
      if (isProcessingRef.current) return;

      // Only handle paste if dialog is open and clipboard contains image
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            const blob = items[i].getAsFile();
            if (blob) {
              const file = new File([blob], `screenshot-${Date.now()}.png`, {
                type: items[i].type,
              });
              
              // Add to queue instead of processing immediately
              setPastedFiles((prev) => {
                const newQueue = [...prev, file];
                toast.success(`Image pasted! (${newQueue.length} in queue)`);
                return newQueue;
              });
            }
            return;
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste, true); // Use capture phase
    return () => {
      window.removeEventListener("paste", handleGlobalPaste, true);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-card border-border"
      >
        <DialogHeader>
          <DialogTitle>
            Upload Debtor Screenshot
            {uploadProgress ? ` (${uploadProgress.current} of ${uploadProgress.total})` : ""}
            {pastedFiles.length > 0 && !uploading ? ` - ${pastedFiles.length} queued` : ""}
          </DialogTitle>
          <DialogDescription>
            Upload one or more screenshots of debtor information for AI analysis. Paste multiple screenshots to queue them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-[hsl(217,91%,60%)]/50 transition-colors">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-base text-foreground">
                    Click to upload multiple screenshots, drag and drop, or paste (Ctrl+V)
                  </span>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleUpload}
                disabled={uploading || isProcessingRef.current}
                onClick={(e) => {
                  // Reset input value to allow selecting the same file again
                  if (!uploading && !isProcessingRef.current) {
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </label>
                <p className="text-sm text-muted-foreground mt-2">
                  PNG, JPG, or WebP (max 10MB)
                </p>
          </div>

          {/* Queued Files */}
          {pastedFiles.length > 0 && !uploading && (
            <Card className="p-4 bg-muted/50 border-border">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {pastedFiles.length} screenshot{pastedFiles.length !== 1 ? "s" : ""} queued
                  </p>
                  <Button
                    onClick={processQueuedFiles}
                    size="sm"
                    className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(239,84%,67%)] hover:from-[hsl(217,91%,65%)] hover:to-[hsl(239,84%,72%)] text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Process All
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {pastedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Queued ${index + 1}`}
                        className="w-full h-20 object-cover rounded border border-border"
                      />
                      <button
                        onClick={() => {
                          setPastedFiles((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="absolute top-1 right-1 p-1 bg-destructive/80 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from queue"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {uploading && (
                <div className="flex flex-col items-center justify-center gap-2 text-base text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadProgress 
                      ? `Processing ${uploadProgress.fileName} (${uploadProgress.current} of ${uploadProgress.total})...`
                      : "Processing screenshot..."}
                  </div>
                  {uploadProgress && (
                    <div className="w-full max-w-xs">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[hsl(217,91%,60%)] transition-all duration-300"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
