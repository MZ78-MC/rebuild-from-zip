import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Wallet, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

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

export const FinancialChat = () => {
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sendMessage = useMutation({
    mutationFn: async (query: string) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error("Please log in to use the Financial Assistant");
      }

      try {
        const { data, error } = await supabase.functions.invoke("finance-assistant", {
          body: { query },
        });

        if (error) {
          console.error("Function error:", error);
          throw new Error(error.message || "Function call failed");
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        return data;
      } catch (err: any) {
        console.error("Finance assistant error:", err);
        if (err.message?.includes("500") || err.status === 500) {
          throw new Error(
            "Server error: The finance-assistant function may not be deployed or configured."
          );
        }
        throw err;
      }
    },
    onMutate: async (query: string) => {
      await queryClient.cancelQueries({ queryKey: ["finance-chat"] });

      const optimisticMsg: OptimisticMessage = {
        id: `temp-${Date.now()}`,
        query,
        response: null,
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };

      setOptimisticMessages([optimisticMsg]);

      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 50);
    },
    onSuccess: async (data) => {
      // Update optimistic message with actual response
      setOptimisticMessages((prev) => {
        if (prev.length > 0) {
          return prev.map((msg) => ({
            ...msg,
            response: data?.response || "Response received",
            isOptimistic: false,
          }));
        }
        // If no optimistic message exists, this shouldn't happen, but handle it gracefully
        return [];
      });
      
      await queryClient.invalidateQueries({ queryKey: ["user_finances"] });
      await queryClient.invalidateQueries({ queryKey: ["budget_goals"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      
      setInput("");
      toast.success("Response generated");
      
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 100);
    },
    onError: (error: any) => {
      setOptimisticMessages([]);
      console.error("Mutation error:", error);
      toast.error(`Error: ${error.message || "Failed to get response"}`);
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input);
  };

  const allMessages = [...optimisticMessages];

  useEffect(() => {
    if (scrollContainerRef.current && allMessages.length > 0) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [allMessages.length]);

  return (
    <Card className="p-3 lg:p-6 bg-card border-border shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 lg:gap-3 mb-3 lg:mb-4">
        <div className="p-2 rounded-full bg-[hsl(142,76%,36%)]/10">
          <Wallet className="h-4 w-4 lg:h-5 lg:w-5 text-[hsl(142,76%,36%)]" />
        </div>
        <h3 className="text-base lg:text-lg font-semibold">Financial Assistant</h3>
      </div>
      <p className="text-xs lg:text-sm text-muted-foreground mb-3 lg:mb-4">
        Ask about your finances, add transactions, or set goals. Try: "I spent R350 on petrol" or "How much did I spend on groceries this month?"
      </p>

      {/* Chat Messages */}
      <div
        ref={scrollContainerRef}
        className="flex flex-col space-y-3 lg:space-y-4 max-h-[300px] lg:max-h-[400px] overflow-y-auto px-2 py-3 lg:py-4 mb-3 lg:mb-4 border border-border rounded-lg bg-muted/30"
      >
        {allMessages.length > 0 ? (
          allMessages.map((msg) => (
            <div key={msg.id} className="flex flex-col space-y-3">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="max-w-[85%] lg:max-w-[70%]">
                  <div className="bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(48,96%,53%)] text-white rounded-2xl rounded-br-md px-3 py-2 lg:px-4 lg:py-3 shadow-sm">
                    <p className="text-xs lg:text-sm whitespace-pre-wrap break-words">{msg.query}</p>
                  </div>
                </div>
              </div>
              
              {/* Assistant Message */}
              <div className="flex justify-start">
                <div className="max-w-[85%] lg:max-w-[70%]">
                  {msg.response ? (
                    <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-3 py-2 lg:px-4 lg:py-3 shadow-sm border border-border/50">
                      <p className="text-xs lg:text-sm whitespace-pre-wrap break-words">{msg.response}</p>
                    </div>
                  ) : (
                    <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-3 py-2 lg:px-4 lg:py-3 shadow-sm border border-border/50">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 lg:h-4 lg:w-4 animate-spin text-muted-foreground" />
                        <p className="text-xs lg:text-sm text-muted-foreground">Assistant is thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div className="text-center">
              <Wallet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Start a conversation about your finances</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your finances, add transactions, or set goals..."
          className="min-h-[60px] lg:min-h-[80px] bg-background border-border resize-none text-sm"
          disabled={sendMessage.isPending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey && !sendMessage.isPending) {
              handleSend();
            }
          }}
        />
        <div className="flex justify-between items-center gap-2">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Press Ctrl+Enter to send
          </p>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-gradient-to-r from-[hsl(142,76%,36%)] to-[hsl(48,96%,53%)] hover:from-[hsl(142,76%,41%)] hover:to-[hsl(48,96%,58%)] text-white shadow-lg shadow-green-500/20 transition-all duration-300 disabled:opacity-50 min-w-[80px] min-h-[44px]"
          >
            {sendMessage.isPending ? (
              <>
                <Loader2 className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2 animate-spin" />
                <span className="text-xs lg:text-sm">Thinking...</span>
              </>
            ) : (
              <>
                <Send className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                <span className="text-xs lg:text-sm">Send</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

