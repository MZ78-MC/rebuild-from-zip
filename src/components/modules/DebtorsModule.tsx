import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Plus, FileText, Loader2, LayoutGrid, List } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DebtorCard } from "../debtors/DebtorCard";
import { UploadDialog } from "../debtors/UploadDialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

type DebtorNote = {
  id: string;
  client_name: string | null;
  credit_limit: number | null;
  overdue: number | null;
  balance: number | null;
  summary: string | null;
  ai_generated: string | null;
  user_edited: string | null;
  urgency: string | null;
  sentiment: string | null;
  created_at: string;
  debtors_files?: {
    file_url: string;
  } | null;
};

type GroupedNotes = {
  [groupName: string]: {
    [date: string]: DebtorNote[];
  };
};

export const DebtorsModule = () => {
  const [showUpload, setShowUpload] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "grouped">("grid");
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [createdGroups, setCreatedGroups] = useState<string[]>([]);
  const isMobile = useIsMobile();

  const { data: notes, isLoading } = useQuery({
    queryKey: ["debtors-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtors_notes")
        .select("*, debtors_files(file_url)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Get available urgency levels
  const availableUrgencies = useMemo(() => {
    return ["high", "medium", "low"];
  }, []);

  // Group notes by urgency and then by day
  const groupNotesByUrgencyAndDay = (notesData: typeof notes) => {
    if (!notesData) return {};

    const grouped: Record<string, DebtorNote[]> = {};

    notesData.forEach((note) => {
      const urgency = note.urgency || "medium";
      if (!grouped[urgency]) {
        grouped[urgency] = [];
      }
      grouped[urgency].push(note as DebtorNote);
    });

    // Sort groups by urgency priority (high -> medium -> low)
    const sortedGrouped: Record<string, DebtorNote[]> = {};
    const urgencyOrder = ["high", "medium", "low"];
    
    urgencyOrder.forEach((urgency) => {
      if (grouped[urgency]) {
        sortedGrouped[urgency] = grouped[urgency];
      }
    });

    // Add any other urgencies
    Object.keys(grouped).forEach((urgency) => {
      if (!urgencyOrder.includes(urgency)) {
        sortedGrouped[urgency] = grouped[urgency];
      }
    });

    return sortedGrouped;
  };

  const groupedNotes = useMemo(() => groupNotesByUrgencyAndDay(notes), [notes]);

  const handleGroupCreated = (groupName: string) => {
    if (!createdGroups.includes(groupName)) {
      setCreatedGroups([...createdGroups, groupName]);
    }
  };

  const createGroup = useMutation({
    mutationFn: async (groupName: string) => {
      // Just track it locally - groups are created when notes are assigned to them
      return groupName;
    },
    onSuccess: (groupName: string) => {
      handleGroupCreated(groupName);
      setNewGroupName("");
      setShowNewGroupDialog(false);
      toast.success(`Group "${groupName}" created! You can now assign notes to it.`);
    },
  });

  const generatePDF = useMutation({
    mutationFn: async (params: { reportType: "daily" | "weekly" | "group"; groupName?: string }) => {
      const { reportType, groupName } = params;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated. Please log in again.");
      }

      const { data, error } = await supabase.functions.invoke("generate-pdf-report", {
        body: {
          report_type: reportType,
          ...(groupName && { group_name: groupName }),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("PDF generation error:", error);
        const errorMessage = error.message || 
          (typeof error === 'object' && error !== null && 'error' in error 
            ? String(error.error) 
            : "Failed to generate PDF. Please check Edge Function logs.");
        throw new Error(errorMessage);
      }
      
      // Check if response has an error field
      if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }
      
      return { data, reportType, groupName };
    },
    onSuccess: async (result, variables) => {
      const { data } = result;
      const { reportType, groupName } = variables;
      try {
        // Convert HTML to PDF
        if (data?.pdf_html) {
          // Create a temporary container for the HTML
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = data.pdf_html;
          tempDiv.style.position = "absolute";
          tempDiv.style.left = "-9999px";
          tempDiv.style.width = "210mm"; // A4 width
          tempDiv.style.padding = "0";
          tempDiv.style.backgroundColor = "white";
          tempDiv.style.color = "black";
          document.body.appendChild(tempDiv);

          // Wait for images to load
          const images = tempDiv.getElementsByTagName("img");
          const imagePromises = Array.from(images).map((img) => {
            return new Promise((resolve) => {
              if (img.complete) {
                resolve(null);
              } else {
                img.onload = () => resolve(null);
                img.onerror = () => resolve(null); // Continue even if image fails
                // Timeout after 5 seconds
                setTimeout(() => resolve(null), 5000);
              }
            });
          });
          await Promise.all(imagePromises);

          // Initialize PDF
          const pdf = new jsPDF("p", "mm", "a4");
          const pdfWidth = 210; // A4 width in mm
          const pdfHeight = 297; // A4 height in mm
          const margin = 15; // Margin in mm
          const contentWidth = pdfWidth - (margin * 2);
          let currentY = margin; // Current Y position on page

          // Helper function to render an element and get its height
          const renderElement = async (element: HTMLElement): Promise<{ imgData: string; imgHeight: number }> => {
            const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff",
              windowWidth: element.scrollWidth,
              windowHeight: element.scrollHeight,
            });
            
            const imgData = canvas.toDataURL("image/png");
            const imgWidth = contentWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            return { imgData, imgHeight };
          };

          // Process header first
          const header = tempDiv.querySelector(".header") as HTMLElement;
          if (header) {
            const { imgData, imgHeight } = await renderElement(header);
            
            // Check if header fits on current page
            if (currentY + imgHeight > pdfHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            
            pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, imgHeight);
            currentY += imgHeight + 10; // Add spacing after header
          }

          // Process metrics section (for weekly reports)
          const metrics = tempDiv.querySelector(".metrics") as HTMLElement;
          if (metrics) {
            const { imgData, imgHeight } = await renderElement(metrics);
            
            // Check if metrics fit on current page
            if (currentY + imgHeight > pdfHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            
            pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, imgHeight);
            currentY += imgHeight + 10;
          }

          // Process section headers (for weekly reports)
          const sectionHeaders = tempDiv.querySelectorAll("h2");
          for (const header of Array.from(sectionHeaders)) {
            const { imgData, imgHeight } = await renderElement(header as HTMLElement);
            
            if (currentY + imgHeight > pdfHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            
            pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, imgHeight);
            currentY += imgHeight + 10;
          }

          // Process each debtor entry separately
          const debtorEntries = tempDiv.querySelectorAll(".debtor-entry");
          for (const entry of Array.from(debtorEntries)) {
            const { imgData, imgHeight } = await renderElement(entry as HTMLElement);
            
            // Check if entry fits on current page
            // If not, start a new page
            if (currentY + imgHeight > pdfHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            
            // Add entry to PDF
            pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, imgHeight);
            currentY += imgHeight + 15; // Add spacing between entries
          }

          // Remove temporary div
          document.body.removeChild(tempDiv);

          // Download the PDF
          let fileName: string;
          let successMessage: string;
          if (reportType === "group" && groupName) {
            const safeGroupName = groupName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
            fileName = `group-${safeGroupName}-report-${new Date().toISOString().split("T")[0]}.pdf`;
            successMessage = `Group PDF report for "${groupName}" downloaded!`;
          } else {
            fileName = `${reportType}-debtor-report-${new Date().toISOString().split("T")[0]}.pdf`;
            successMessage = reportType === "daily"
              ? "Daily PDF report downloaded!"
              : "Weekly PDF report downloaded!";
          }
          pdf.save(fileName);
          toast.success(successMessage);
        } else if (data?.content) {
          // Fallback: create text-based PDF
          const pdf = new jsPDF("p", "mm", "a4");
          const lines = pdf.splitTextToSize(data.content, 180);
          pdf.text(lines, 10, 10);
          let fileName: string;
          let successMessage: string;
          if (reportType === "group" && groupName) {
            const safeGroupName = groupName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
            fileName = `group-${safeGroupName}-report-${new Date().toISOString().split("T")[0]}.pdf`;
            successMessage = `Group PDF report for "${groupName}" downloaded!`;
          } else {
            fileName = `${reportType}-debtor-report-${new Date().toISOString().split("T")[0]}.pdf`;
            successMessage = reportType === "daily"
              ? "Daily PDF report downloaded!"
              : "Weekly PDF report downloaded!";
          }
          pdf.save(fileName);
          toast.success(successMessage);
        } else {
          toast.error("No report content generated");
        }
      } catch (error: any) {
        console.error("PDF generation error:", error);
        toast.error(`Failed to generate PDF: ${error.message || "Unknown error"}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate PDF: ${error.message}`);
    },
  });

  return (
    <div className={isMobile ? "space-y-4" : "space-y-6"}>
      {/* Header */}
      <Card className={`${isMobile ? 'p-3' : 'p-6'} bg-card border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow`}>
        <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} flex-wrap gap-4`}>
          <div>
            <h2 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-semibold text-foreground`}>
              Debtors Intelligence
            </h2>
            <p className={`${isMobile ? 'text-sm' : 'text-base'} text-muted-foreground mt-1`}>
              Upload screenshots for AI-powered summaries
            </p>
          </div>
          <div className={`flex ${isMobile ? 'flex-wrap w-full gap-2' : 'gap-2'}`}>
            <Button
              onClick={() => setViewMode(viewMode === "grid" ? "grouped" : "grid")}
              variant="outline"
              className="border-[hsl(217,91%,60%)]/30 hover:bg-[hsl(217,91%,60%)]/10 hover:border-[hsl(217,91%,60%)]/50 hover:text-[hsl(217,91%,60%)] transition-all"
              title={viewMode === "grid" ? "Group View" : "Grid View"}
            >
              {viewMode === "grid" ? (
                <>
                  <List className="h-4 w-4 mr-2" />
                  Group View
                </>
              ) : (
                <>
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Grid View
                </>
              )}
            </Button>
            {viewMode === "grouped" && (
              <Button
                onClick={() => setShowNewGroupDialog(true)}
                variant="outline"
                className="border-[hsl(217,91%,60%)]/30 hover:bg-[hsl(217,91%,60%)]/10 hover:border-[hsl(217,91%,60%)]/50 hover:text-[hsl(217,91%,60%)] transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Group
              </Button>
            )}
            <Button
              onClick={() => generatePDF.mutate({ reportType: "daily" })}
              disabled={generatePDF.isPending}
              variant="outline"
              className="border-[hsl(217,91%,60%)]/30 hover:bg-[hsl(217,91%,60%)]/10 hover:border-[hsl(217,91%,60%)]/50 hover:text-[hsl(217,91%,60%)] transition-all"
            >
              {generatePDF.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Daily PDF
                </>
              )}
            </Button>
            <Button
              onClick={() => generatePDF.mutate({ reportType: "weekly" })}
              disabled={generatePDF.isPending}
              variant="outline"
              className="border-[hsl(217,91%,60%)]/30 hover:bg-[hsl(217,91%,60%)]/10 hover:border-[hsl(217,91%,60%)]/50 hover:text-[hsl(217,91%,60%)] transition-all"
            >
              {generatePDF.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Weekly PDF
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(239,84%,67%)] hover:from-[hsl(217,91%,65%)] hover:to-[hsl(239,84%,72%)] text-white shadow-lg shadow-blue-500/20 transition-all duration-300"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Screenshot
            </Button>
          </div>
        </div>
      </Card>

      {/* Notes Display */}
      {isLoading ? (
        <Card className="p-6 text-center text-muted-foreground">
          Loading notes...
        </Card>
      ) : notes && notes.length > 0 ? (
        viewMode === "grouped" ? (
          // Grouped View (by group_name and then by day)
          <div className="space-y-8">
            {Object.keys(groupedNotes).map((groupName) => (
              <div key={groupName} className="space-y-4">
                <Card className="p-4 bg-muted/50 border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-semibold text-foreground">
                      {groupName}
                    </h3>
                    <Button
                      onClick={() => generatePDF.mutate({ reportType: "group", groupName })}
                      disabled={generatePDF.isPending}
                      variant="outline"
                      size="sm"
                      className="border-[hsl(217,91%,60%)]/30 hover:bg-[hsl(217,91%,60%)]/10"
                    >
                      {generatePDF.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Generate PDF
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
                {Object.keys(groupedNotes[groupName]).map((dateKey) => (
                  <div key={`${groupName}-${dateKey}`} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-medium text-foreground/80">
                        {dateKey}
                      </h4>
                      <span className="text-sm text-muted-foreground">
                        ({groupedNotes[groupName][dateKey].length} note{groupedNotes[groupName][dateKey].length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'gap-6 md:grid-cols-2 lg:grid-cols-3'}`}>
                      {groupedNotes[groupName][dateKey].map((note) => (
                        <DebtorCard 
                          key={note.id} 
                          note={note}
                          availableGroups={availableUrgencies}
                          onGroupCreated={handleGroupCreated}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          // Grid View
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'gap-6 md:grid-cols-2 lg:grid-cols-3'}`}>
            {notes.map((note) => (
              <DebtorCard 
                key={note.id} 
                note={note as DebtorNote}
                availableGroups={availableUrgencies}
                onGroupCreated={handleGroupCreated}
              />
            ))}
          </div>
        )
      ) : (
        <Card className="p-12 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No debtors notes yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your first screenshot to get started
          </p>
          <Button
            onClick={() => setShowUpload(true)}
            className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(239,84%,67%)] hover:from-[hsl(217,91%,65%)] hover:to-[hsl(239,84%,72%)] text-white shadow-lg shadow-blue-500/20 transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add First Note
          </Button>
        </Card>
      )}

      <UploadDialog open={showUpload} onOpenChange={setShowUpload} />

      {/* New Group Dialog */}
      <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Enter a name for the new group. You can then assign notes to this group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Group name (e.g., 'Company A', 'Q4 2024')"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newGroupName.trim()) {
                  createGroup.mutate(newGroupName.trim());
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewGroupDialog(false);
                setNewGroupName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newGroupName.trim()) {
                  createGroup.mutate(newGroupName.trim());
                }
              }}
              disabled={!newGroupName.trim() || createGroup.isPending}
              className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(239,84%,67%)] hover:from-[hsl(217,91%,65%)] hover:to-[hsl(239,84%,72%)] text-white"
            >
              {createGroup.isPending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
