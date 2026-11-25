import type { ReactNode } from "react";
import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";

/** The management table filter shell, for pages with their own filter fields. */
export function CustomFilterPopover({ children, activeFilterCount, onClear, disabled = false }: {
  children: ReactNode;
  activeFilterCount: number;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <div><TooltipWrapper content="Filter data"><Button variant="outline" disabled={disabled} className="h-9 gap-1.5">
        <Filter size={14} />Filters
        {activeFilterCount > 0 && <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs">{activeFilterCount}</Badge>}
      </Button></TooltipWrapper></div>
    </PopoverTrigger>
    <PopoverContent align="start" aria-label="Filters" className="w-80 max-w-[calc(100vw-2rem)] p-0">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium"><Filter size={14} />Filters
          {activeFilterCount > 0 && <Badge variant="secondary" className="h-4 rounded-full px-1.5 text-[10px]">{activeFilterCount}</Badge>}
        </span>
        <div className="flex items-center gap-1">
          {activeFilterCount > 0 && <Button variant="ghost" size="sm" disabled={disabled}
            className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={onClear}>Clear all</Button>}
          <Button variant="ghost" size="sm" aria-label="Close filters" className="h-6 w-6 p-0" onClick={() => setOpen(false)}><X size={14} /></Button>
        </div>
      </div>
      <div className="grid max-h-[min(65vh,32rem)] gap-3 overflow-y-auto p-3">{children}</div>
    </PopoverContent>
  </Popover>;
}
