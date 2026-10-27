import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { useState } from "react";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Filters } from "./Filters";

interface FilterPopoverProps {
  table: any;
  hasFilters: boolean;
  activeFilterCount: number;
}

export function FilterPopover({
  table,
  hasFilters,
  activeFilterCount,
}: FilterPopoverProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
      <PopoverTrigger asChild>
        <div>
          <TooltipWrapper content="Filter data">
            <Button
              variant="outline"
              className="h-9 gap-1.5"
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="h-5 min-w-5 px-1.5 text-xs rounded-full ml-0.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </TooltipWrapper>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {hasFilters ? (
          <>
            <div className="px-3 py-2.5 border-b flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Filter size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 rounded-full">
                    {activeFilterCount}
                  </Badge>
                )}
              </span>
              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:text-destructive px-2"
                    onClick={() => {
                      table.setFilters({});
                      table.clearFilters?.();
                    }}
                  >
                    Clear all
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setFiltersOpen(false)}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            <div className="p-3">
              <Filters table={table} />
            </div>
          </>
        ) : (
          <div className="p-6 flex flex-col items-center gap-2 text-muted-foreground">
            <Filter size={20} />
            <span className="text-sm">No filters available</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
