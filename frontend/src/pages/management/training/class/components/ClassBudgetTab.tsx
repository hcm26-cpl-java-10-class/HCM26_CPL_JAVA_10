import {
    AlertTriangle,
    TrendingDown,
    TrendingUp,
    Wallet,
    XCircle,
} from "lucide-react";
import { useClassBudget } from "@/hooks/useExternalLookups";
import type { ExternalClass } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function formatVND(amount: number) {
    return amount.toLocaleString("vi-VN") + " VND";
}

function ProgressBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const over = max > 0 && value > max;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : "bg-blue-500")}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className={cn("text-xs font-medium w-10 text-right", over ? "text-red-600" : "text-muted-foreground")}>
                {Math.round(pct)}%
            </span>
        </div>
    );
}

export function ClassBudgetTab({ classItem }: { classItem: ExternalClass }) {
    const classId = String(classItem.id);
    const { data: budget, isLoading, isError, refetch } = useClassBudget(classId);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
        );
    }

    if (isError || !budget) {
        return (
            <div className="text-center py-10 text-destructive">
                <XCircle className="size-6 mx-auto mb-2" />
                Không thể tải thông tin ngân sách.{" "}
                <button onClick={() => void refetch()} className="underline">Thử lại</button>
            </div>
        );
    }

    const { items, totalPlanned, totalActual, profitLoss, plannedRevenue } = budget;
    const isOverBudget = totalActual > totalPlanned;

    return (
        <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Doanh thu dự kiến", value: formatVND(plannedRevenue), icon: Wallet, color: "text-green-600" },
                    { label: "Chi phí kế hoạch", value: formatVND(totalPlanned), icon: AlertTriangle, color: "text-blue-600" },
                    { label: "Chi phí thực tế", value: formatVND(totalActual), icon: isOverBudget ? TrendingUp : TrendingDown, color: isOverBudget ? "text-red-600" : "text-blue-600" },
                    {
                        label: "Lợi nhuận / Lỗ",
                        value: formatVND(Math.abs(profitLoss)),
                        icon: profitLoss >= 0 ? TrendingUp : TrendingDown,
                        color: profitLoss >= 0 ? "text-green-600" : "text-red-600",
                        suffix: profitLoss >= 0 ? "▲ Lãi" : "▼ Lỗ",
                    },
                ].map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <div key={i} className="rounded-lg border bg-card p-3 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Icon className={cn("size-3.5", card.color)} />
                                {card.label}
                            </div>
                            <p className={cn("font-bold text-sm", card.color)}>{card.value}</p>
                            {card.suffix && <p className={cn("text-xs font-medium", card.color)}>{card.suffix}</p>}
                        </div>
                    );
                })}
            </div>

            {/* Budget execution progress */}
            <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-semibold">Tiến độ chi tiêu</p>
                <ProgressBar value={totalActual} max={totalPlanned} />
                <p className="text-xs text-muted-foreground">
                    Đã chi <strong>{formatVND(totalActual)}</strong> / {formatVND(totalPlanned)} ngân sách kế hoạch
                    {isOverBudget && (
                        <span className="text-red-600 ml-2 font-medium">
                            ⚠ Vượt ngân sách {formatVND(totalActual - totalPlanned)}
                        </span>
                    )}
                </p>
            </div>

            {/* Detail table */}
            <div className="rounded-lg border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Danh mục</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead className="text-right">Chi phí kế hoạch (VND)</TableHead>
                            <TableHead className="text-right">Chi phí thực tế (VND)</TableHead>
                            <TableHead>Tiến độ</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Chưa có hạng mục chi phí nào.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item, i) => {
                                const over = (item.actual ?? 0) > item.amount;
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                                                {item.category}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[200px] truncate">{item.description}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {item.amount.toLocaleString("vi-VN")}
                                        </TableCell>
                                        <TableCell className={cn("text-right font-mono text-sm font-semibold", over ? "text-red-600" : "text-green-600")}>
                                            {(item.actual ?? 0).toLocaleString("vi-VN")}
                                            {over && <span className="ml-1 text-xs">↑ Vượt</span>}
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <ProgressBar value={item.actual ?? 0} max={item.amount} />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                        {/* Total row */}
                        <TableRow className="border-t-2 font-bold bg-muted/30">
                            <TableCell colSpan={3} className="text-right text-sm">Tổng cộng</TableCell>
                            <TableCell className="text-right font-mono">{totalPlanned.toLocaleString("vi-VN")}</TableCell>
                            <TableCell className={cn("text-right font-mono", isOverBudget ? "text-red-600" : "text-green-600")}>
                                {totalActual.toLocaleString("vi-VN")}
                            </TableCell>
                            <TableCell><ProgressBar value={totalActual} max={totalPlanned} /></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            <p className="text-xs text-muted-foreground">
                Dữ liệu ngân sách do bộ phận kế toán / vận hành cập nhật. Mọi thay đổi phải được xác nhận qua quy trình phê duyệt.
            </p>
        </div>
    );
}
