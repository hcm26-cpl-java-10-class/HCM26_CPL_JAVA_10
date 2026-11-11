import { Button } from "@/components/ui/button";
import {
  Pagination as PaginationComponent,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/usePagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ActionButton from "../common/ActionButton";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

interface PaginationProps {
  table: any;
  isAutoSize?: boolean;
  autoSize?: number;
  onPageSizeChange?: (value: string) => void;
  showSelectionSummary?: boolean;
}

export function Pagination({
  table,
  isAutoSize = true,
  autoSize,
  onPageSizeChange,
  showSelectionSummary = true,
}: PaginationProps) {
  const totalPages = Math.ceil(table.total / table.size) || 1;
  const currentPage = table.page + 1;

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  });

  const canPreviousPage = table.page > 0;
  const canNextPage = table.page < totalPages - 1;

  const currentSelectValue = isAutoSize ? "auto" : String(table.size);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        {showSelectionSummary && table.selected?.length >= 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {table.selected?.length || 0}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {table.total || table.data?.length || 0}
            </span>{" "}
            rows selected
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
          <Select value={currentSelectValue} onValueChange={onPageSizeChange}>
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                Auto{autoSize ? ` (${autoSize})` : ""}
              </SelectItem>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="text-sm text-muted-foreground whitespace-nowrap"
          aria-live="polite"
        >
          Page{" "}
          <span className="font-medium text-foreground">{currentPage}</span> of{" "}
          <span className="font-medium text-foreground">{totalPages}</span>
        </div>

        <PaginationComponent>
          <PaginationContent>
            <PaginationItem>
              <ActionButton
                onClick={() => table.setPage(table.page - 1)}
                disabled={!canPreviousPage}
                icon={<ChevronLeft size={16} />}
                variant="secondary"
                tooltip="Previous page"
              />
            </PaginationItem>

            {showLeftEllipsis && <PaginationEllipsis />}

            {pages.map((p) => (
              <PaginationItem key={p}>
                <Button
                  size="icon"
                  variant={p === currentPage ? "default" : "outline"}
                  onClick={() => table.setPage(p - 1)}
                >
                  {p}
                </Button>
              </PaginationItem>
            ))}

            {showRightEllipsis && <PaginationEllipsis />}

            <PaginationItem>
              <ActionButton
                onClick={() => table.setPage(table.page + 1)}
                disabled={!canNextPage}
                icon={<ChevronRight size={16} />}
                variant="secondary"
                tooltip="Next page"
              />
            </PaginationItem>
          </PaginationContent>
        </PaginationComponent>
      </div>
    </div>
  );
}
