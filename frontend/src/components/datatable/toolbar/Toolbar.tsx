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
  extraHeaderActions?: React.ReactNode;
  browseActions?: React.ReactNode;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showViewModeToggle?: boolean;
  showActions?: boolean;
  showCardColumnToggle?: boolean;
  compact?: boolean;
  hideCreate?: boolean;
}

export function Toolbar({
  table,
  headerActions,
  extraHeaderActions,
  browseActions,
  viewMode = "table",
  onViewModeChange,
  showViewModeToggle = true,
  showActions = true,
  showCardColumnToggle = true,
  compact = false,
  hideCreate = false,
}: ToolbarProps) {
  const { schema } = table;

  const hasFilters = schema.fields.some((f: any) => f.filterable);
  const activeFilterCount = Object.keys(table.filters || {}).filter(
    (key) => table.filters[key] !== undefined && table.filters[key] !== "",
  ).length;

  const hasSorts = table.sortState?.length > 0;

  // Browse mode hides the regular toolbar actions; a single browse action
  // (e.g. "Create") can still be rendered on the right hand side.
  // NOTE: this is the single source of truth for the right hand side - it used
  // to be rendered twice (once as `rightSlot` and once inline), which produced
  // duplicated Import / Export / Create buttons.
  const rightSlot = showActions ? (
    <ToolbarActions
      table={table}
      headerActions={headerActions}
      extraActions={extraHeaderActions}
      hideCreate={hideCreate}
    />
  ) : browseActions ? (
    <div className="flex justify-end items-center gap-2 w-full">{browseActions}</div>
  ) : null;

  return (
    <div
      className={`grid ${rightSlot ? (compact ? "sm:grid-cols-[1fr_auto]" : "lg:grid-cols-[1fr_auto]") : "grid-cols-1"} items-center gap-2 w-full`}
    >
      <div
        className={
          compact
            ? "flex min-w-0 flex-wrap items-center gap-2"
            : "flex flex-col lg:flex-row justify-start items-center gap-2"
        }
      >
        {viewMode === "card" && showCardColumnToggle && (
          <ColumnToggle
            schema={schema}
            columnVisibility={table.columnVisibility}
            toggleFieldVisibility={table.toggleFieldVisibility}
            compact={compact}
          />
        )}

        <FilterPopover
          table={table}
          hasFilters={hasFilters}
          activeFilterCount={activeFilterCount}
        />

        <SearchInput search={table.search} onSearchChange={table.setSearch} compact={compact} />

        {hasSorts && (
          <ActionButton
            onClick={() => table.clearSort()}
            tooltip={`Clear all sorts (${table.sortState.length})`}
            title={`Clear sort (${table.sortState.length})`}
            variant="outline"
            icon={<ArrowUpDown size={14} />}
          />
        )}

        {showViewModeToggle && (
          <ActionButton
            onClick={() => onViewModeChange?.(viewMode === "table" ? "card" : "table")}
            tooltip={viewMode === "table" ? "Switch to card view" : "Switch to table view"}
            variant="outline"
            icon={viewMode === "table" ? <LayoutGrid size={16} /> : <Table2 size={16} />}
          />
        )}
      </div>

      {rightSlot}
    </div>
  );
}
