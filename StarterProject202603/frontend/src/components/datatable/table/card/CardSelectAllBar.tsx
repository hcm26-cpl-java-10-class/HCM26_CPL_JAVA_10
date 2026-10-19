import { Checkbox } from "@/components/ui/checkbox";

interface CardSelectAllBarProps {
  totalCount: number;
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
}

export function CardSelectAllBar({
  totalCount,
  selectedCount,
  allSelected,
  someSelected,
  onToggleSelectAll,
}: CardSelectAllBarProps) {
  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
      <Checkbox
        checked={allSelected ? true : someSelected ? "indeterminate" : false}
        onCheckedChange={onToggleSelectAll}
        aria-label="Select all cards"
      />
      <span className="text-xs text-muted-foreground">
        {selectedCount > 0
          ? `${selectedCount} of ${totalCount} selected`
          : `Select all ${totalCount} items`}
      </span>
    </div>
  );
}
