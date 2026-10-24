import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchInputProps {
  search: string;
  onSearchChange: (value: string) => void;
  compact?: boolean;
}

export function SearchInput({ search, onSearchChange, compact = false }: SearchInputProps) {
  return (
    <div
      className={
        compact ? "relative min-w-40 flex-1 lg:max-w-[420px]" : "relative w-full lg:w-[420px]"
      }
    >
      <Search size={16} className="absolute text-gray-500 top-1/2 -translate-y-1/2 left-2" />
      <Input
        placeholder="Search..."
        aria-label="Search"
        className="pl-8 pr-8 w-full"
        value={search || ""}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {search && (
        <TooltipWrapper content="Clear search">
          <button
            type="button"
            aria-label="Clear search"
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
