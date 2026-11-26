import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Search, Table2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SyllabusViewMode = "table" | "card";

type ToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  view: SyllabusViewMode;
  onViewChange: (view: SyllabusViewMode) => void;
  filters?: ReactNode;
  actions?: ReactNode;
};

/** Course-style compact toolbar, without CRUD actions that these screens do not support. */
export function SyllabusListToolbar({ search, onSearchChange, searchLabel, view, onViewChange, filters, actions }: ToolbarProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {filters}
        <div className="relative w-full min-w-44 max-w-sm flex-1 sm:w-64 sm:flex-none">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={searchLabel} placeholder="Search..." className="h-9 pl-9 pr-8" value={search}
            onChange={(event) => onSearchChange(event.target.value)} />
          {search && <button type="button" aria-label="Clear search" onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>}
        </div>
        <Button type="button" variant="outline" size="icon-sm"
          title={view === "table" ? "Switch to card view" : "Switch to table view"}
          aria-label={view === "table" ? "Switch to card view" : "Switch to table view"}
          onClick={() => onViewChange(view === "table" ? "card" : "table")}>
          {view === "table" ? <LayoutGrid className="size-4" /> : <Table2 className="size-4" />}
        </Button>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

type FooterProps = {
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function SyllabusListFooter({ count, page, pageSize, onPageChange, onPageSizeChange }: FooterProps) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const current = Math.min(page, pages - 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p aria-live="polite">{count} result{count === 1 ? "" : "s"}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="whitespace-nowrap">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger aria-label="Rows per page" className="h-8 w-[76px]"><SelectValue /></SelectTrigger>
          <SelectContent>{[10, 20, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
        </Select>
        <span className="whitespace-nowrap">Page {current + 1} of {pages}</span>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page"
            disabled={current === 0} onClick={() => onPageChange(current - 1)}><ChevronLeft className="size-4" /></Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Next page"
            disabled={current + 1 >= pages} onClick={() => onPageChange(current + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
