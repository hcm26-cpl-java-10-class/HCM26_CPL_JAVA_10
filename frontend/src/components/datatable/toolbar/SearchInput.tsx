import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchInputProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function SearchInput({ search, onSearchChange }: SearchInputProps) {
  return (
    <div className="relative w-full lg:w-[420px]">
      <Search
        size={16}
        className="absolute text-gray-500 top-1/2 -translate-y-1/2 left-2"
      />
      <Input
        placeholder="Search..."
        className="pl-8 pr-8 w-full"
        value={search || ""}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {search && (
        <TooltipWrapper content="Clear search">
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </TooltipWrapper>
      )}
    </div>
  );
}
