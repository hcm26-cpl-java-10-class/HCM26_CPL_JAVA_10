import { Button } from "@/components/ui/button";
import {
  Pagination,
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

const PAGE_SIZES = [10, 20, 30, 50, 100];

interface MilestonePaginationProps {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}

export function MilestonePagination({
  page,
  size,
  totalElements,
  totalPages,
  loading = false,
  onPageChange,
  onSizeChange,
}: MilestonePaginationProps) {
  const currentPage = page + 1;
  const safeTotalPages = Math.max(totalPages, 1);
  const firstItem = totalElements === 0 ? 0 : page * size + 1;
  const lastItem = Math.min((page + 1) * size, totalElements);
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages: safeTotalPages,
    paginationItemsToDisplay: 5,
  });

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium text-foreground">{firstItem}–{lastItem}</span> of{" "}
        <span className="font-medium text-foreground">{totalElements}</span> milestones
      </p>

      <div className="flex flex-col items-end gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(size)}
            disabled={loading}
            onValueChange={(value) => onSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-20" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((option) => (
                <SelectItem key={option} value={String(option)}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="whitespace-nowrap text-sm text-muted-foreground" aria-live="polite">
          Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
          <span className="font-medium text-foreground">{safeTotalPages}</span>
        </div>

        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Previous page"
                disabled={loading || page <= 0}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft />
              </Button>
            </PaginationItem>
            {showLeftEllipsis ? <PaginationEllipsis /> : null}
            {pages.map((item) => (
              <PaginationItem key={item}>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={item === currentPage ? "default" : "ghost"}
                  aria-label={`Go to page ${item}`}
                  aria-current={item === currentPage ? "page" : undefined}
                  disabled={loading}
                  onClick={() => onPageChange(item - 1)}
                >
                  {item}
                </Button>
              </PaginationItem>
            ))}
            {showRightEllipsis ? <PaginationEllipsis /> : null}
            <PaginationItem>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Next page"
                disabled={loading || page >= totalPages - 1}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
