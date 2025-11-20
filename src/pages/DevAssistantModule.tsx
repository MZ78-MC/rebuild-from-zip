import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Code, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  createdAt: Date;
}

const DevAssistantModule = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const addSnippet = () => {
    if (!title.trim() || !code.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    const snippet: Snippet = {
      id: Date.now().toString(),
      title,
      code,
      language,
      createdAt: new Date(),
    };

    setSnippets([snippet, ...snippets]);
    setTitle("");
    setCode("");
    toast({ title: "Snippet added" });
  };

  const deleteSnippet = (id: string) => {
    setSnippets(snippets.filter((s) => s.id !== id));
    toast({ title: "Snippet deleted" });
  };

  const copyToClipboard = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dev Assistant</h1>
        <p className="text-muted-foreground">Store and manage your code snippets</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Code Snippet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Snippet title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            placeholder="Language (e.g., javascript, python)"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
          <Textarea
            placeholder="Paste your code here..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={6}
            className="font-mono text-sm"
          />
          <Button onClick={addSnippet} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Snippet
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Snippets ({snippets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {snippets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No snippets yet. Add your first code snippet!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {snippets.map((snippet) => (
                <div key={snippet.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{snippet.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {snippet.language} • {snippet.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(snippet.id, snippet.code)}
                      >
                        {copiedId === snippet.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSnippet(snippet.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                    <code className="text-sm font-mono">{snippet.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DevAssistantModule;
