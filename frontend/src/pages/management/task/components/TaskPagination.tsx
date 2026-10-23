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

interface TaskPaginationProps {
  page: number;
  size: number;
  totalPages: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}

export function TaskPagination({
  page,
  size,
  totalPages,
  disabled,
  onPageChange,
  onSizeChange,
}: TaskPaginationProps) {
  const count = Math.max(1, totalPages);
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage: page + 1,
    totalPages: count,
    paginationItemsToDisplay: 5,
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Số dòng mỗi trang</span>
        <Select
          value={String(size)}
          disabled={disabled}
          onValueChange={(value) => onSizeChange(Number(value))}
        >
          <SelectTrigger className="w-20" aria-label="Số dòng mỗi trang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          Trang {page + 1}/{count}
        </span>
        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                aria-label="Trang trước"
                disabled={disabled || page === 0}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft />
              </Button>
            </PaginationItem>
            {showLeftEllipsis && <PaginationEllipsis />}
            {pages.map((number) => (
              <PaginationItem key={number}>
                <Button
                  size="icon"
                  variant={number === page + 1 ? "default" : "outline"}
                  disabled={disabled}
                  aria-label={`Trang ${number}`}
                  aria-current={number === page + 1 ? "page" : undefined}
                  onClick={() => onPageChange(number - 1)}
                >
                  {number}
                </Button>
              </PaginationItem>
            ))}
            {showRightEllipsis && <PaginationEllipsis />}
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                aria-label="Trang sau"
                disabled={disabled || page + 1 >= count}
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
