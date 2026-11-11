import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    Clock,
    History,
    XCircle,
} from "lucide-react";
import { useState } from "react";
import { useClassStatusInfo, useTransitionClassStatus } from "@/hooks/useExternalLookups";
import type { ExternalClass } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ClassStatusBadge } from "./ClassStatusBadge";

const STATUS_LABELS: Record<string, string> = {
    planning: "Planning",
    assigned: "Assigned",
    active: "In progress",
    pending_close: "Pending close",
    completed: "Training completed",
    closed: "Closed",
    cancelled: "Cancelled",
};

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" }> = {
    assigned:      { label: "Assign Trainer & Admin", variant: "default" },
    active:        { label: "🚀 Start Class",          variant: "default" },
    pending_close: { label: "Request to Close",        variant: "secondary" },
    completed:     { label: "✅ Mark Training Completed", variant: "default" },
    closed:        { label: "Close Class",             variant: "outline" },
    cancelled:     { label: "❌ Cancel Class",         variant: "destructive" },
};

const REQUIRES_REASON = new Set(["cancelled", "closed"]);

const LIFECYCLE_ORDER = ["planning", "assigned", "active", "pending_close", "completed", "closed"];

function LifecycleProgressBar({ currentStatus }: { currentStatus: string }) {
    const idx = LIFECYCLE_ORDER.indexOf(currentStatus);
    if (currentStatus === "cancelled") {
        return (
            <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                <XCircle className="size-4" /> Lớp đã bị hủy
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 overflow-x-auto">
            {LIFECYCLE_ORDER.map((s, i) => {
                const done = idx >= 0 && i < idx;
                const active = s === currentStatus;
                const future = idx >= 0 && i > idx;
                return (
                    <div key={s} className="flex items-center gap-1 flex-shrink-0">
                        <div
                            className={cn(
                                "rounded-full px-2.5 py-0.5 text-xs font-medium border",
                                active && "bg-blue-600 text-white border-blue-600 shadow-sm",
                                done && "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300",
                                future && "bg-muted text-muted-foreground border-muted-foreground/20"
                            )}
                        >
                            {STATUS_LABELS[s] ?? s}
                        </div>
                        {i < LIFECYCLE_ORDER.length - 1 && (
                            <ArrowRight
                                className={cn(
                                    "size-3 flex-shrink-0",
                                    done ? "text-green-500" : "text-muted-foreground/40"
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ---- Transition Confirm Dialog ----
function TransitionDialog({
    open,
    target,
    classItem,
    onClose,
}: {
    open: boolean;
    target: string | null;
    classItem: ExternalClass;
    onClose: () => void;
}) {
    const [reason, setReason] = useState("");
    const mutation = useTransitionClassStatus(String(classItem.id));

    const needsReason = !!target && REQUIRES_REASON.has(target);

    const handleConfirm = () => {
        if (!target) return;
        mutation.mutate(
            { status: target, reason },
            {
                onSuccess: () => {
                    setReason("");
                    onClose();
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Xác nhận chuyển trạng thái lớp</DialogTitle>
                    <DialogDescription>
                        Lớp <strong>{classItem.code}</strong>:{" "}
                        <ClassStatusBadge status={classItem.status} /> →{" "}
                        <ClassStatusBadge status={target ?? ""} />
                    </DialogDescription>
                </DialogHeader>

                {needsReason && (
                    <div className="space-y-2">
                        <Label>
                            Lý do <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            placeholder={
                                target === "cancelled"
                                    ? "Nhập lý do hủy lớp học..."
                                    : "Nhập lý do đóng lớp học..."
                            }
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                    </div>
                )}

                {target === "active" && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300 space-y-1">
                        <p className="font-semibold">📋 Điều kiện bắt đầu lớp:</p>
                        <ul className="list-disc ml-4 space-y-0.5">
                            <li>Đã gán Master Trainer: <strong>{classItem.masterTrainer || "❌ Chưa gán"}</strong></li>
                            <li>Số học viên: <strong>{classItem.enrolledTrainees ?? 0}</strong> (cần ≥ 1)</li>
                        </ul>
                    </div>
                )}

                {mutation.isError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertTriangle className="size-4" />
                        {(mutation.error as Error).message}
                    </p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Hủy
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={mutation.isPending || (needsReason && !reason.trim())}
                        variant={target === "cancelled" ? "destructive" : "default"}
                    >
                        {mutation.isPending ? "Đang xử lý..." : "Xác nhận"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---- Main Component ----
export function ClassLifecyclePanel({ classItem }: { classItem: ExternalClass }) {
    const classId = String(classItem.id);
    const { data: statusInfo, isLoading } = useClassStatusInfo(classId);
    const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    const allowedTransitions = statusInfo?.allowedLabels ?? [];
    const log = statusInfo?.log ?? [];

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Vòng đời lớp học</span>
                </div>
                {log.length > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <History className="size-3 mr-1" />
                        Lịch sử ({log.length})
                        <ChevronDown className={cn("size-3 ml-1 transition-transform", showHistory && "rotate-180")} />
                    </Button>
                )}
            </div>

            <div className="p-4 space-y-4">
                {/* Progress bar */}
                {isLoading ? (
                    <Skeleton className="h-6 w-full" />
                ) : (
                    <LifecycleProgressBar currentStatus={classItem.status ?? ""} />
                )}

                {/* Action buttons */}
                {!isLoading && allowedTransitions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {allowedTransitions.map(({ value, label }) => {
                            const meta = ACTION_LABELS[value];
                            return (
                                <Button
                                    key={value}
                                    size="sm"
                                    variant={meta?.variant ?? "outline"}
                                    onClick={() => setConfirmTarget(value)}
                                >
                                    {meta?.label ?? label}
                                </Button>
                            );
                        })}
                    </div>
                )}

                {!isLoading && allowedTransitions.length === 0 && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-green-500" />
                        Lớp học ở trạng thái cuối — không còn hành động nào khả dụng.
                    </p>
                )}

                {/* Status change history */}
                {showHistory && log.length > 0 && (
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                        <div className="text-xs font-semibold text-muted-foreground px-3 py-2 border-b">
                            Lịch sử thay đổi trạng thái
                        </div>
                        <div className="divide-y">
                            {[...log].reverse().map((entry, i) => (
                                <div key={i} className="px-3 py-2 text-xs space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            {STATUS_LABELS[entry.from] ?? entry.from}
                                        </Badge>
                                        <ArrowRight className="size-3 text-muted-foreground" />
                                        <Badge variant="outline" className="text-xs">
                                            {STATUS_LABELS[entry.to] ?? entry.to}
                                        </Badge>
                                        <span className="ml-auto text-muted-foreground">
                                            {new Date(entry.changedAt).toLocaleString("vi-VN")}
                                        </span>
                                    </div>
                                    {entry.reason && (
                                        <p className="text-muted-foreground">Lý do: {entry.reason}</p>
                                    )}
                                    {entry.changedBy && (
                                        <p className="text-muted-foreground">Bởi: {entry.changedBy}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <TransitionDialog
                open={!!confirmTarget}
                target={confirmTarget}
                classItem={classItem}
                onClose={() => setConfirmTarget(null)}
            />
        </div>
    );
}
