import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type Props = {
    /** Tổng số bản ghi sau khi lọc. */
    totalItems: number;
    /** Trang hiện tại (0-based). */
    page: number;
    /** Số bản ghi mỗi trang. */
    pageSize: number;
    /** Đổi trang. */
    onPageChange: (page: number) => void;
    /** Đổi số bản ghi mỗi trang. */
    onPageSizeChange: (pageSize: number) => void;
    /** Tổng số trang (tính sẵn để tránh tính lại ở nhiều nơi). */
    totalPages?: number;
    /** Nhãn đơn vị, ví dụ "entries" hoặc "learners". */
    unit?: string;
};

/**
 * Thanh phân trại dùng chung cho các bảng trong Course Analytics.
 *
 * <p>Mặc định hiển thị 10 bản ghi mỗi trang, có nút trước/sau và
 * chọn số bản ghi mỗi trang.
 */
export function TablePagination({
    totalItems,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    totalPages,
    unit = "entries",
}: Props) {
    const computedTotalPages = totalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(page, computedTotalPages - 1);
    const from = totalItems === 0 ? 0 : currentPage * pageSize + 1;
    const to = Math.min((currentPage + 1) * pageSize, totalItems);

    return (
        <div className="flex flex-col gap-3 border-t px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
                Showing <span className="font-medium text-foreground">{from}</span> to{" "}
                <span className="font-medium text-foreground">{to}</span> of{" "}
                <span className="font-medium text-foreground">{totalItems}</span> {unit}
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <span>Rows per page:</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => onPageSizeChange(Number(value))}
                    >
                        <SelectTrigger className="h-8 w-16 text-xs">
                            <SelectValue placeholder={String(pageSize)} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                        disabled={currentPage === 0}
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <span className="px-2 font-medium text-foreground">
                        {currentPage + 1} / {computedTotalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => onPageChange(Math.min(computedTotalPages - 1, currentPage + 1))}
                        disabled={currentPage >= computedTotalPages - 1}
                        aria-label="Next page"
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
