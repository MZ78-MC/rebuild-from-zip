import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface NotesSearchProps {
  onSearch: (query: string) => void;
  searchQuery: string;
}

export const NotesSearch = ({ onSearch, searchQuery }: NotesSearchProps) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSearch = (query: string) => {
    setLocalQuery(query);
    onSearch(query);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search notes... (supports Boolean: AND, OR, NOT)"
        value={localQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-9 pr-9"
      />
      {localQuery && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          onClick={() => handleSearch("")}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

