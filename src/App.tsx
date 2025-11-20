import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import NotesModule from "./pages/NotesModule";
import TasksModule from "./pages/TasksModule";
import BudgetModule from "./pages/BudgetModule";
import DebtorsModule from "./pages/DebtorsModule";
import DevAssistantModule from "./pages/DevAssistantModule";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Index />} />
              <Route path="notes" element={<NotesModule />} />
              <Route path="tasks" element={<TasksModule />} />
              <Route path="budget" element={<BudgetModule />} />
              <Route path="debtors" element={<DebtorsModule />} />
              <Route path="dev-assistant" element={<DevAssistantModule />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
