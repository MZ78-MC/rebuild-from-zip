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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TransactionInsert = Database["public"]["Tables"]["user_finances"]["Insert"];

interface UploadBankStatementDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const UploadBankStatementDialog = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: UploadBankStatementDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedTransactions, setExtractedTransactions] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [owner, setOwner] = useState<string>("me");
  const [statementDate, setStatementDate] = useState<string>("");
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [csvInput, setCsvInput] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const processStatement = useMutation({
    mutationFn: async ({ imageBase64, owner, statementDate, fileType }: { imageBase64: string; owner: string; statementDate: string; fileType?: string }) => {
      const response = await supabase.functions.invoke("process-bank-statement", {
        body: { 
          file_base64: imageBase64,
          owner: owner,
          statement_date: statementDate || undefined,
          file_type: fileType || "image",
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      if (data.requiresManualEntry || (data.count === 0 && data.transactions?.length === 0)) {
        // Vision failed - switch to manual entry
        setManualEntryMode(true);
        setExtractedTransactions([]);
        toast.info("Vision processing failed. Please use manual CSV entry below.");
      } else {
        setExtractedTransactions(data.transactions || []);
        setManualEntryMode(false);
        toast.success(`Extracted ${data.count || 0} transactions!`);
      }
      setIsProcessing(false);
    },
    onError: (error: Error) => {
      const msg = (error?.message || "").toString();
      if (msg.includes("429") || msg.toLowerCase().includes("rate") || msg.includes("RESOURCE_EXHAUSTED")) {
        toast.error("AI rate limit reached. Please wait ~30s and try again.");
      } else if (msg.includes("402") || msg.toLowerCase().includes("payment")) {
        toast.error("AI credits required. Please add credits to your Lovable AI workspace.");
      } else if (msg.includes("Failed to extract") || msg.includes("requiresManualEntry")) {
        // Auto-switch to manual entry on vision failure
        setManualEntryMode(true);
        toast.info("Vision processing failed. Please use manual CSV entry below.");
      } else {
        toast.error(`Failed to process statement: ${error.message}`);
      }
      setIsProcessing(false);
    },
  });

  const saveTransactions = useMutation({
    mutationFn: async (transactions: TransactionInsert[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const transactionsToInsert = transactions.map(tx => ({
        ...tx,
        user_id: user.id,
      }));

      const { data, error } = await supabase
        .from("user_finances")
        .insert(transactionsToInsert)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user_finances"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success(`Saved ${data.length} transactions!`);
      setOpen(false);
      setFile(null);
      setPreview(null);
      setExtractedTransactions([]);
      setOwner("me");
      setStatementDate("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save transactions: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Accept Excel, images, and PDFs
    const isExcel = selectedFile.name.toLowerCase().endsWith('.xlsx') || 
                    selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const isImage = selectedFile.type.startsWith("image/");
    const isPDF = selectedFile.type === "application/pdf";
    
    if (!isExcel && !isImage && !isPDF) {
      toast.error("Please select an Excel (.xlsx), image, or PDF file");
      return;
    }

    setFile(selectedFile);
    setExtractedTransactions([]);
    setManualEntryMode(false);

    // Create preview for images only
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      // Read the file as data URL and send to backend
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Detect file type
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || 
                      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const fileType = isExcel ? "excel" : "image";

      await processStatement.mutateAsync({
        imageBase64: dataUrl,
        owner: owner,
        statementDate: statementDate,
        fileType: fileType,
      });
    } catch (error) {
      console.error("Processing error:", error);
      toast.error("Failed to read file");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (extractedTransactions.length === 0) {
      toast.error("No transactions to save");
      return;
    }

    const transactionsToSave = extractedTransactions.map((tx) => ({
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      vendor: tx.vendor,
      description: `${tx.owner === "wife" ? "[Wife] " : ""}${tx.description}`,
      date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
      source: "bank_statement",
    })) as TransactionInsert[];

    saveTransactions.mutate(transactionsToSave);
  };

  const removeTransaction = (index: number) => {
    setExtractedTransactions(prev => prev.filter((_, i) => i !== index));
  };

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.trim().split('\n').filter(line => line.trim());
    const transactions: any[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length < 3) {
        errors.push(`Line ${index + 1}: Invalid format. Expected: Date,Description,Amount,Category`);
        return;
      }

      const [dateStr, description, amountStr, category] = parts;
      
      // Validate date
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        errors.push(`Line ${index + 1}: Invalid date format. Use YYYY-MM-DD`);
        return;
      }

      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Line ${index + 1}: Invalid amount. Must be a positive number`);
        return;
      }

      // Determine type based on context (negative amounts are expenses, positive are income)
      // For bank statements, we'll assume expenses unless description suggests income
      const isIncome = category?.toLowerCase().includes('salary') || 
                       category?.toLowerCase().includes('income') ||
                       description?.toLowerCase().includes('deposit') ||
                       description?.toLowerCase().includes('salary');
      
      transactions.push({
        type: isIncome ? "income" : "expense",
        amount: amount,
        category: (category || "other").toLowerCase(),
        description: description,
        vendor: description.split(" ")[0] || null,
        date: date.toISOString().split("T")[0],
        owner: owner || "me",
        source: "bank_statement",
      });
    });

    if (errors.length > 0) {
      setCsvError(errors.join('\n'));
    } else {
      setCsvError(null);
    }

    return transactions;
  };

  const handleCSVParse = () => {
    if (!csvInput.trim()) {
      setCsvError("Please enter CSV data");
      return;
    }

    const parsed = parseCSV(csvInput);
    if (parsed.length > 0) {
      setExtractedTransactions(parsed);
      setManualEntryMode(false);
      toast.success(`Parsed ${parsed.length} transactions from CSV!`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-[hsl(142,76%,36%)] text-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,36%)]/10"
        >
          <FileText className="h-4 w-4 mr-2" />
          Upload Bank Statement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Bank Statement</DialogTitle>
          <DialogDescription>
            Upload a bank statement (Excel, image, or PDF) to automatically extract all transactions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Owner Selection */}
          <div className="space-y-2">
            <Label htmlFor="owner">Statement Owner</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger id="owner">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Me</SelectItem>
                <SelectItem value="wife">Wife</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Statement Date (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="statementDate">Statement Period (Optional)</Label>
            <Input
              id="statementDate"
              type="text"
              placeholder="e.g., November 2024"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="statement">Bank Statement (Excel, Image, or PDF)</Label>
            <Input
              id="statement"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*,application/pdf"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              Excel format: Date, Description, Debit, Credit columns
            </p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border border-border rounded-lg p-4 bg-muted/50">
                <img
                  src={preview}
                  alt="Statement preview"
                  className="max-w-full h-auto rounded"
                />
              </div>
            </div>
          )}

          {file && !preview && (
            <div className="border border-border rounded-lg p-4 bg-muted/50">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {file.name.toLowerCase().endsWith('.xlsx') 
                  ? "Excel file - will extract transactions from Date, Description, Debit, Credit columns"
                  : "File ready to process"}
              </p>
            </div>
          )}

          {/* Process Button */}
          {file && extractedTransactions.length === 0 && !manualEntryMode && (
            <Button
              onClick={handleProcess}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(48,96%,53%)] hover:from-[hsl(142,76%,41%)] hover:to-[hsl(48,96%,58%)] text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing Statement...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Extract Transactions
                </>
              )}
            </Button>
          )}

          {/* Manual CSV Entry */}
          {(manualEntryMode || (extractedTransactions.length === 0 && !file)) && (
            <div className="space-y-2 border border-border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <Label>Manual Entry (CSV Format)</Label>
                {file && !manualEntryMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setManualEntryMode(true)}
                    className="text-sm"
                  >
                    Switch to Manual Entry
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Format: Date,Description,Amount,Category (one transaction per line)
                <br />
                Example: 2024-11-15,Groceries at Pick n Pay,250.50,groceries
              </p>
              <textarea
                className="w-full min-h-[200px] p-3 border border-border rounded-md bg-background text-sm font-mono"
                placeholder="2024-11-15,Groceries at Pick n Pay,250.50,groceries&#10;2024-11-16,Petrol Shell,350.00,transport&#10;2024-11-17,Salary Deposit,15000.00,salary"
                value={csvInput}
                onChange={(e) => {
                  setCsvInput(e.target.value);
                  setCsvError(null);
                }}
              />
              {csvError && (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  {csvError.split('\n').map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}
              <Button
                onClick={handleCSVParse}
                disabled={!csvInput.trim()}
                className="w-full bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(48,96%,53%)] hover:from-[hsl(142,76%,41%)] hover:to-[hsl(48,96%,58%)] text-white"
              >
                Parse CSV
              </Button>
            </div>
          )}

          {/* Extracted Transactions */}
          {extractedTransactions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  <Label>Extracted Transactions ({extractedTransactions.length})</Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  disabled={saveTransactions.isPending}
                  className="text-green-600 hover:text-green-700"
                >
                  {saveTransactions.isPending ? "Saving..." : `Save All (${extractedTransactions.length})`}
                </Button>
              </div>
              <div className="border border-border rounded-lg p-4 bg-muted/50 max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {extractedTransactions.map((tx, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-background rounded border border-border hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                            {tx.type === "income" ? "+" : "-"}R{tx.amount.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">{tx.category}</span>
                          {tx.owner === "wife" && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Wife</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{tx.description}</div>
                        <div className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTransaction(index)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
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
              setExtractedTransactions([]);
              setOwner("me");
              setStatementDate("");
              setManualEntryMode(false);
              setCsvInput("");
              setCsvError(null);
            }}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
