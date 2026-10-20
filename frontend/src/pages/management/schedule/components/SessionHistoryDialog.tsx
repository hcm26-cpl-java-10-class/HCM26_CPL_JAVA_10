import { sessionApi } from "@/api";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { SessionDTO, SessionStatus, SessionStatusHistoryEntry } from "@/types";
import { getApiErrorMessage } from "@/utils/api-error.utils";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { AlertCircle, ArrowRight, Copy, History, UserRound } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<SessionStatus, string> = {
  SCHEDULED: "Đã lên lịch",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const STATUS_CLASSES: Record<SessionStatus, string> = {
  SCHEDULED: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  COMPLETED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

interface SessionHistoryDialogProps {
  session: SessionDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const copyToClipboard = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Đã copy ${label}.`);
  } catch {
    toast.error("Không thể copy vào clipboard.");
  }
};

const HistoryRow = ({ entry }: { entry: SessionStatusHistoryEntry }) => (
  <li className="relative">
    <span className="absolute -left-[1.66rem] top-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />
    <div className="flex flex-wrap items-center gap-2">
      {entry.fromStatus ? (
        <>
          <Badge variant="outline" className={STATUS_CLASSES[entry.fromStatus]}>
            {STATUS_LABELS[entry.fromStatus]}
          </Badge>
          <ArrowRight className="size-3.5 text-muted-foreground" />
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Khởi tạo ·</span>
      )}
      <Badge variant="outline" className={STATUS_CLASSES[entry.toStatus]}>
        {STATUS_LABELS[entry.toStatus]}
      </Badge>
    </div>

    {entry.reason && (
      <p className="mt-1.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Lý do:</span> {entry.reason}
      </p>
    )}

    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <UserRound className="size-3" />#{entry.changedBy}
      </span>
      <span>{dayjs(entry.changedAt).format("DD/MM/YYYY HH:mm:ss")}</span>
      {entry.correlationId && (
        <button
          type="button"
          onClick={() => copyToClipboard(entry.correlationId as string, "correlation ID")}
          className="inline-flex items-center gap-1 font-mono text-[11px] underline-offset-2 hover:underline"
          title="Copy correlation ID"
        >
          {entry.correlationId.slice(0, 8)}…
          <Copy className="size-3" />
        </button>
      )}
    </div>
  </li>
);

/**
 * T2 — "Lịch sử trạng thái" trên trang /sessions.
 *
 * Gọi `GET /api/v1/sessions/{id}/history` (chỉ đọc; backend trả 405 cho mọi method ghi).
 * Chỉ Trainer được phân công / Class Admin xem được — tài khoản khác nhận 403.
 */
export function SessionHistoryDialog({ session, open, onOpenChange }: SessionHistoryDialogProps) {
  const sessionId = session?.id;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["session-history", sessionId],
    queryFn: () => sessionApi.getHistory(sessionId as number),
    enabled: open && !!sessionId,
    staleTime: 0,
  });

  const entries = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <History className="size-4 text-primary" />
            </span>
            Lịch sử trạng thái
          </DialogTitle>
          <DialogDescription>
            {session?.title || session?.classCode
              ? `Các lần chuyển trạng thái của “${session?.title || session?.classCode}”.`
              : "Các lần chuyển trạng thái của buổi học."}{" "}
            Lịch sử là bất biến, chỉ đọc.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {isLoading && (
            <div className="grid gap-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{getApiErrorMessage(error, "Không thể tải lịch sử trạng thái.")}</span>
            </div>
          )}

          {!isLoading && !isError && entries.length === 0 && (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              Chưa có lần chuyển trạng thái nào được ghi nhận.
            </p>
          )}

          {!isLoading && !isError && entries.length > 0 && (
            <ol className="relative ml-2 grid gap-5 border-l border-border/70 pl-5">
              {entries.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </ol>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
