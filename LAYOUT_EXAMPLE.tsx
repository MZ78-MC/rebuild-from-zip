// Example simplified Layout component with only Tasks, Notes, and Budget Buddy tabs
// Copy this to your new project and adjust styling as needed

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, StickyNote, Wallet, Settings, Sun, Moon, LogOut, User } from "lucide-react";
import { TasksModule } from "./modules/TasksModule";
import { NotesModule } from "./modules/NotesModule";
import { BudgetModule } from "./modules/BudgetModule";
import { Button } from "./ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";

export const Layout = () => {
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  // Get current user
  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Logged out successfully");
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (error: any) {
      toast.error(error.message || "Failed to log out");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 h-32 bg-[image:var(--gradient-glow)]" />
        <header className="relative border-b border-border/50 bg-background/95">
          <div className={`container mx-auto ${isMobile ? 'px-4 py-4' : 'px-6 py-6'}`}>
            <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between'}`}>
              <div>
                <h1 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-bold text-primary`}>
                  My Assistant
                </h1>
                <p className={`${isMobile ? 'text-sm' : 'text-base'} text-muted-foreground mt-1`}>
                  Tasks, Notes & Budget
                </p>
              </div>
              <div className={`flex items-center ${isMobile ? 'gap-1 self-end' : 'gap-2'}`}>
                <Button
                  variant="ghost"
                  size={isMobile ? "sm" : "icon"}
                  onClick={toggleTheme}
                  className="hover:bg-secondary min-w-[44px] min-h-[44px]"
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? (
                    <Sun className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
                  ) : (
                    <Moon className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size={isMobile ? "sm" : "icon"}
                      className="hover:bg-secondary min-w-[44px] min-h-[44px]"
                      title="User menu"
                    >
                      <User className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">Account</p>
                        {user?.email && (
                          <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className={`container mx-auto ${isMobile ? 'px-2 py-4' : 'px-6 py-8'}`}>
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className={`${isMobile ? 'flex overflow-x-auto w-full mb-4 bg-card border border-border gap-1 p-1 scrollbar-hide' : 'grid w-full grid-cols-3 mb-8 bg-card border border-border gap-1 p-1'}`}>
            {/* Tasks Tab */}
            <TabsTrigger
              value="tasks"
              className={`${isMobile ? 'flex-shrink-0 min-w-[100px] text-xs px-2' : ''} data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(262,83%,58%)] data-[state=active]:to-[hsl(43,96%,56%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20 transition-all duration-300 hover:bg-[hsl(262,83%,58%)]/20 data-[state=active]:hover:from-[hsl(262,83%,63%)] data-[state=active]:hover:to-[hsl(43,96%,61%)]`}
            >
              <Clock className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
              {isMobile ? 'Tasks' : 'Tasks'}
            </TabsTrigger>
            
            {/* Notes Tab */}
            <TabsTrigger
              value="notes"
              className={`${isMobile ? 'flex-shrink-0 min-w-[100px] text-xs px-2' : ''} data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(340,82%,65%)] data-[state=active]:to-[hsl(15,88%,65%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-500/30 transition-all duration-300 hover:bg-[hsl(340,82%,65%)]/20 data-[state=active]:hover:from-[hsl(340,82%,70%)] data-[state=active]:hover:to-[hsl(15,88%,70%)]`}
            >
              <StickyNote className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
              {isMobile ? 'Notes' : 'Notes'}
            </TabsTrigger>
            
            {/* Budget Buddy Tab */}
            <TabsTrigger
              value="budget"
              className={`${isMobile ? 'flex-shrink-0 min-w-[100px] text-xs px-2' : ''} data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(142,76%,36%)] data-[state=active]:to-[hsl(48,96%,53%)] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20 transition-all duration-300 hover:bg-[hsl(142,76%,36%)]/20 data-[state=active]:hover:from-[hsl(142,76%,41%)] data-[state=active]:hover:to-[hsl(48,96%,58%)]`}
            >
              <Wallet className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
              {isMobile ? 'Budget' : 'Budget Buddy'}
            </TabsTrigger>
          </TabsList>

          {/* Tasks Tab Content */}
          <TabsContent 
            value="tasks" 
            className={`mt-0 rounded-lg ${isMobile ? 'p-2' : 'p-6'} ${isMobile ? 'min-h-[400px]' : 'min-h-[600px]'} border transition-colors ${
              theme === "dark"
                ? "bg-gradient-to-br from-[hsl(262,83%,10%)] via-[hsl(262,83%,8%)] to-[hsl(43,96%,8%)] border-[hsl(262,83%,20%)]/30"
                : "bg-gradient-to-br from-[hsl(262,83%,95%)] via-[hsl(262,83%,97%)] to-[hsl(43,96%,97%)] border-[hsl(262,83%,80%)]/30"
            }`}
          >
            <TasksModule />
          </TabsContent>

          {/* Notes Tab Content */}
          <TabsContent 
            value="notes" 
            className={`mt-0 rounded-lg ${isMobile ? 'p-2' : 'p-6'} ${isMobile ? 'min-h-[400px]' : 'min-h-[600px]'} border transition-colors ${
              theme === "dark"
                ? "bg-gradient-to-br from-[hsl(340,82%,10%)] via-[hsl(340,82%,8%)] to-[hsl(15,88%,8%)] border-[hsl(340,82%,20%)]/30"
                : "bg-gradient-to-br from-[hsl(340,82%,95%)] via-[hsl(340,82%,97%)] to-[hsl(15,88%,97%)] border-[hsl(340,82%,80%)]/30"
            }`}
          >
            <NotesModule />
          </TabsContent>

          {/* Budget Buddy Tab Content */}
          <TabsContent 
            value="budget" 
            className={`mt-0 rounded-lg ${isMobile ? 'p-2' : 'p-6'} ${isMobile ? 'min-h-[400px]' : 'min-h-[600px]'} border transition-colors ${
              theme === "dark"
                ? "bg-gradient-to-br from-[hsl(142,76%,10%)] via-[hsl(142,76%,8%)] to-[hsl(48,96%,8%)] border-[hsl(142,76%,20%)]/30"
                : "bg-gradient-to-br from-[hsl(142,76%,95%)] via-[hsl(142,76%,97%)] to-[hsl(48,96%,97%)] border-[hsl(142,76%,80%)]/30"
            }`}
          >
            <BudgetModule />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

