import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  /** Từ khóa tìm kiếm đang áp dụng. */
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Ô tìm kiếm trong header Course Analytics.
 *
 * <p>Kiểu dưới gạch chân (không viền tròn) theo thiết kế, có nút "X" để xoá nhanh.
 */
export function AnalyticsSearchInput({
  searchTerm,
  onSearchTermChange,
  placeholder = "Search course name or instructor",
  className,
}: Props) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search course name or instructor"
        className="h-9 w-full border-0 border-b border-input bg-transparent pl-6 pr-8 text-sm shadow-none focus-visible:border-b-primary focus-visible:ring-0"
      />
      {searchTerm ? (
        <button
          type="button"
          onClick={() => onSearchTermChange("")}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
