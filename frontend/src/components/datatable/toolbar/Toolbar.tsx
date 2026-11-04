import { ColumnToggle } from "./ColumnToggle";
import { FilterPopover } from "./filter/FilterPopover";
import { SearchInput } from "./SearchInput";
import { ToolbarActions } from "./ToolbarActions";
import ActionButton from "../common/ActionButton";
import { ArrowUpDown, LayoutGrid, Table2 } from "lucide-react";

export type ViewMode = "table" | "card";

interface ToolbarProps {
  table: any;
  headerActions?: React.ReactNode;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showViewModeToggle?: boolean;
  showActions?: boolean;
  showCardColumnToggle?: boolean;
  /** Rendered first in the left group (e.g. count + Card/Table switcher). */
  leadingSlot?: React.ReactNode;
  /** Hides search, filters and the small view-mode button (page already provides them). */
  compact?: boolean;
}

export function Toolbar({
  table,
  headerActions,
  viewMode = "table",
  onViewModeChange,
  showViewModeToggle = true,
  showActions = true,
  showCardColumnToggle = true,
  leadingSlot,
  compact = false,
}: ToolbarProps) {
  const { schema } = table;

  const hasFilters = schema.fields.some((f: any) => f.filterable);
  const activeFilterCount = Object.keys(table.filters || {}).filter(
    (key) => table.filters[key] !== undefined && table.filters[key] !== "",
  ).length;

  const hasSorts = table.sortState?.length > 0;

  return (
    <div
      className={`grid ${showActions ? "lg:grid-cols-[1fr_auto]" : "grid-cols-1"} items-center gap-2 w-full`}
    >
      <div className="flex flex-col lg:flex-row justify-start items-center gap-2">
        {leadingSlot}

        {viewMode === "card" && showCardColumnToggle && (
          <ColumnToggle
            schema={schema}
            columnVisibility={table.columnVisibility}
            toggleFieldVisibility={table.toggleFieldVisibility}
          />
        )}

        {!compact && (
          <FilterPopover
            table={table}
            hasFilters={hasFilters}
            activeFilterCount={activeFilterCount}
          />
        )}

        {!compact && <SearchInput search={table.search} onSearchChange={table.setSearch} />}

        {hasSorts && (
          <ActionButton
            onClick={() => table.clearSort()}
            tooltip={`Clear all sorts (${table.sortState.length})`}
            title={`Clear sort (${table.sortState.length})`}
            variant="outline"
            icon={<ArrowUpDown size={14} />}
          />
        )}

        {showViewModeToggle && !compact && (
          <ActionButton
            onClick={() => onViewModeChange?.(viewMode === "table" ? "card" : "table")}
            tooltip={viewMode === "table" ? "Switch to card view" : "Switch to table view"}
            variant="outline"
            icon={viewMode === "table" ? <LayoutGrid size={16} /> : <Table2 size={16} />}
          />
        )}
      </div>

      {showActions && <ToolbarActions table={table} headerActions={headerActions} />}
    </div>
  );
}