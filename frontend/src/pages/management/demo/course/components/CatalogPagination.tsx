import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CatalogPaginationProps {
  /** 0-based */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** [0, 1, 2, "…", 9] — luôn giữ trang đầu, trang cuối và 1 trang mỗi bên trang hiện tại. */
function buildPageItems(page: number, totalPages: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);

  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [0];
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages - 2, page + 1);

  if (start > 1) items.push("ellipsis-start");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages - 2) items.push("ellipsis-end");
  items.push(totalPages - 1);
  return items;
}

export function CatalogPagination({ page, totalPages, onPageChange }: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Course pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" /> Prev
      </Button>

      {buildPageItems(page, totalPages).map((item) =>
        typeof item === "number" ? (
          <Button
            key={item}
            size="sm"
            variant={item === page ? "default" : "outline"}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
            className="min-w-9"
          >
            {item + 1}
          </Button>
        ) : (
          <span key={item} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ),
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        Next <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
