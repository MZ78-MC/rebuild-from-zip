import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

interface Message {
  id: string;
  query: string;
  response: string;
  created_at: string;
}

interface OptimisticMessage {
  id: string;
  query: string;
  response: string | null;
  created_at: string;
  isOptimistic?: boolean;
}

export const DevAssistantModule = () => {
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["dev-memory"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("dev_memory")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching dev_memory:", error);
        throw error;
      }
      
      return (data || []) as Message[];
    },
  });

  // Combine history with optimistic messages
  const allMessages = [...(history || []), ...optimisticMessages];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current && allMessages.length > 0) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [allMessages.length]);

  const sendMessage = useMutation({
    mutationFn: async (query: string) => {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error("Please log in to use the Dev Assistant");
      }

      try {
        const { data, error } = await supabase.functions.invoke("dev-assistant", {
          body: { query },
        });

        if (error) {
          console.error("Function error:", error);
          throw new Error(error.message || "Function call failed");
        }

        // Check if response has an error field
        if (data?.error) {
          throw new Error(data.error);
        }

        return data;
      } catch (err: any) {
        console.error("Dev assistant error:", err);
        // Provide helpful error message
        if (err.message?.includes("500") || err.status === 500) {
          throw new Error(
            "Server error: The dev-assistant function may not be deployed or configured. Check Supabase Edge Functions and ensure LOVABLE_API_KEY is set."
          );
        }
        
        if (err.message?.includes("401") || err.status === 401) {
          throw new Error(
            "Authentication failed: LOVABLE_API_KEY is invalid or missing. Please set it in Supabase Edge Functions settings."
          );
        }
        throw err;
      }
    },
    onMutate: async (query: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["dev-memory"] });

      // Snapshot previous value
      const previousHistory = queryClient.getQueryData<Message[]>(["dev-memory"]);

      // Optimistically add user message
      const optimisticMsg: OptimisticMessage = {
        id: `temp-${Date.now()}`,
        query,
        response: null,
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };

      setOptimisticMessages([optimisticMsg]);

      // Scroll to bottom
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 50);

      return { previousHistory };
    },
    onSuccess: async (data, variables, context) => {
      // Remove optimistic message
      setOptimisticMessages([]);
      
      // Invalidate and refetch immediately
      await queryClient.invalidateQueries({ queryKey: ["dev-memory"] });
      
      setInput("");
      toast.success("Response generated");
      
      // Scroll to bottom after data updates
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 100);
    },
    onError: (error: any, variables, context) => {
      // Remove optimistic message on error
      setOptimisticMessages([]);
      
      // Restore previous history
      if (context?.previousHistory) {
        queryClient.setQueryData(["dev-memory"], context.previousHistory);
      }
      
      console.error("Mutation error:", error);
      toast.error(`Error: ${error.message || "Failed to get response"}`);
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input);
  };

  return (
    <div className={isMobile ? "space-y-4" : "space-y-6"}>
      {/* Header */}
      <Card className={`${isMobile ? 'p-3' : 'p-6'} bg-card border-border shadow-[var(--shadow-card)]`}>
        <div className="flex items-center gap-2 lg:gap-3">
          <div className={`${isMobile ? 'p-2' : 'p-3'} rounded-full bg-[hsl(187,85%,55%)]/10`}>
            <Sparkles className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} text-[hsl(187,85%,55%)]`} />
          </div>
          <div>
            <h2 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-semibold`}>Dev Assistant</h2>
            <p className={`${isMobile ? 'text-sm' : 'text-base'} text-muted-foreground mt-1`}>
              Your personal AI coding companion
            </p>
          </div>
        </div>
      </Card>

      {/* Chat History */}
      <div
        ref={scrollContainerRef}
        className={`flex flex-col ${isMobile ? 'space-y-3 max-h-[400px]' : 'space-y-4 max-h-[600px]'} overflow-y-auto px-2 py-3 lg:py-4`}
      >
        {isLoadingHistory ? (
          // Skeleton loaders for initial load
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] lg:max-w-[70%]">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] lg:max-w-[70%]">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
              </div>
            </div>
          ))
        ) : allMessages.length > 0 ? (
          allMessages.map((msg) => (
            <div key={msg.id} className="flex flex-col space-y-3">
              {/* User Message - Right aligned */}
              <div className="flex justify-end">
                <div className="max-w-[85%] lg:max-w-[70%]">
                  <div className={`bg-gradient-to-r from-[hsl(187,85%,55%)] to-[hsl(172,66%,50%)] text-[hsl(222,47%,6%)] rounded-2xl rounded-br-md ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} shadow-sm`}>
                    <p className={`${isMobile ? 'text-xs' : 'text-base'} whitespace-pre-wrap break-words`}>{msg.query}</p>
                  </div>
                </div>
              </div>
              
              {/* Assistant Message - Left aligned */}
              <div className="flex justify-start">
                <div className="max-w-[85%] lg:max-w-[70%]">
                  {msg.response ? (
                    <div className={`bg-muted text-foreground rounded-2xl rounded-bl-md ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} shadow-sm border border-border/50`}>
                      <p className={`${isMobile ? 'text-xs' : 'text-base'} whitespace-pre-wrap break-words`}>{msg.response}</p>
                    </div>
                  ) : (
                    // Typing indicator for optimistic messages
                    <div className={`bg-muted text-foreground rounded-2xl rounded-bl-md ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} shadow-sm border border-border/50`}>
                      <div className="flex items-center gap-2">
                        <Loader2 className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} animate-spin text-muted-foreground`} />
                        <p className={`${isMobile ? 'text-xs' : 'text-base'} text-muted-foreground`}>Assistant is thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <Card className="p-12 text-center bg-card border-border">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">No conversations yet</h3>
              <p className="text-base text-muted-foreground">
                Start by asking a development question below
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* Input */}
      <Card className={`${isMobile ? 'p-3' : 'p-6'} bg-card border-border shadow-[var(--shadow-elevated)]`}>
        <div className={isMobile ? "space-y-2" : "space-y-4"}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Supabase, React, Tailwind, or any development question..."
            className={`${isMobile ? 'min-h-[80px] text-sm' : 'min-h-[120px]'} bg-background border-border resize-none`}
            disabled={sendMessage.isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey && !sendMessage.isPending) {
                handleSend();
              }
            }}
          />
          <div className={`flex justify-between items-center ${isMobile ? 'gap-2' : ''}`}>
            <p className={`${isMobile ? 'text-xs hidden sm:block' : 'text-sm'} text-muted-foreground`}>
              Press Ctrl+Enter to send
            </p>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className={`bg-gradient-to-r from-[hsl(187,85%,55%)] to-[hsl(172,66%,50%)] hover:from-[hsl(187,85%,60%)] hover:to-[hsl(172,66%,55%)] text-[hsl(222,47%,6%)] shadow-lg shadow-cyan-500/30 transition-all duration-300 disabled:opacity-50 ${isMobile ? 'min-w-[80px] min-h-[44px]' : ''}`}
            >
              {sendMessage.isPending ? (
                <>
                  <Sparkles className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'} animate-spin`} />
                  <span className={isMobile ? 'text-xs' : ''}>Thinking...</span>
                </>
              ) : (
                <>
                  <Send className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
                  <span className={isMobile ? 'text-xs' : ''}>Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
