import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { TasksList } from "../notes/TasksList";
import { CreateTaskDialog } from "../notes/CreateTaskDialog";
import { ProductivityAnalytics } from "../notes/ProductivityAnalytics";
import { GuidedPlanning } from "../notes/GuidedPlanning";
import { DailyShutdown } from "../notes/DailyShutdown";
import { CalendarIntegration } from "../notes/CalendarIntegration";
import { MeetingLinks } from "../notes/MeetingLinks";

export const TasksModule = () => {
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-2 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Tasks</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Organize and track your work
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <TabsList className="bg-card border border-border/40 gap-1 p-1 flex-wrap">
            <TabsTrigger
              value="tasks"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(262,83%,58%)] data-[state=active]:to-[hsl(43,96%,56%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20 transition-all duration-300 hover:bg-[hsl(262,83%,58%)]/20 data-[state=active]:hover:from-[hsl(262,83%,63%)] data-[state=active]:hover:to-[hsl(43,96%,61%)]"
            >
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(262,83%,58%)] data-[state=active]:to-[hsl(43,96%,56%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20 transition-all duration-300 hover:bg-[hsl(262,83%,58%)]/20 data-[state=active]:hover:from-[hsl(262,83%,63%)] data-[state=active]:hover:to-[hsl(43,96%,61%)]"
            >
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="planning"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(262,83%,58%)] data-[state=active]:to-[hsl(43,96%,56%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20 transition-all duration-300 hover:bg-[hsl(262,83%,58%)]/20 data-[state=active]:hover:from-[hsl(262,83%,63%)] data-[state=active]:hover:to-[hsl(43,96%,61%)]"
            >
              Planning
            </TabsTrigger>
            <TabsTrigger
              value="shutdown"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(262,83%,58%)] data-[state=active]:to-[hsl(43,96%,56%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20 transition-all duration-300 hover:bg-[hsl(262,83%,58%)]/20 data-[state=active]:hover:from-[hsl(262,83%,63%)] data-[state=active]:hover:to-[hsl(43,96%,61%)]"
            >
              Shutdown
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(262,83%,58%)] data-[state=active]:to-[hsl(43,96%,56%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20 transition-all duration-300 hover:bg-[hsl(262,83%,58%)]/20 data-[state=active]:hover:from-[hsl(262,83%,63%)] data-[state=active]:hover:to-[hsl(43,96%,61%)]"
            >
              Calendar
            </TabsTrigger>
            <TabsTrigger
              value="meetings"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(262,83%,58%)] data-[state=active]:to-[hsl(43,96%,56%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20 transition-all duration-300 hover:bg-[hsl(262,83%,58%)]/20 data-[state=active]:hover:from-[hsl(262,83%,63%)] data-[state=active]:hover:to-[hsl(43,96%,61%)]"
            >
              Meetings
            </TabsTrigger>
          </TabsList>

          {activeTab === "tasks" && (
            <Button
              onClick={() => setShowTaskDialog(true)}
              className="bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(43,96%,56%)] hover:from-[hsl(262,83%,63%)] hover:to-[hsl(43,96%,61%)] text-white shadow-lg shadow-purple-500/20 transition-all duration-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Task
            </Button>
          )}
        </div>

        <TabsContent value="tasks" className="mt-0">
          <TasksList />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <ProductivityAnalytics />
        </TabsContent>

        <TabsContent value="planning" className="mt-0">
          <GuidedPlanning />
        </TabsContent>

        <TabsContent value="shutdown" className="mt-0">
          <DailyShutdown />
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          <CalendarIntegration />
        </TabsContent>

        <TabsContent value="meetings" className="mt-0">
          <MeetingLinks />
        </TabsContent>
      </Tabs>

      <CreateTaskDialog open={showTaskDialog} onOpenChange={setShowTaskDialog} />
    </div>
  );
};

