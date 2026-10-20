import { sessionAuditApi } from "@/api";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
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
import type { AuditLogEntry, SessionDTO } from "@/types";
import { getApiErrorMessage } from "@/utils/api-error.utils";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { AlertCircle, ArrowRight, Download, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  SESSION_STATUS_CHANGE: "Đổi trạng thái",
  SESSION_NOTES_UPDATE: "Cập nhật ghi chú",
};

interface SessionStateSnapshot {
  status?: string | null;
  notes?: string | null;
  cancelReason?: string | null;
  version?: number | null;
}

const parseSnapshot = (raw?: string | null): SessionStateSnapshot | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionStateSnapshot;
  } catch {
    return null;
  }
};

interface SessionAuditLogDialogProps {
  session: SessionDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AuditRow = ({ entry }: { entry: AuditLogEntry }) => {
  const before = parseSnapshot(entry.beforeState);
  const after = parseSnapshot(entry.afterState);
  const notesChanged = (before?.notes ?? null) !== (after?.notes ?? null);

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary">{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
        <span className="text-xs text-muted-foreground">
          {dayjs(entry.createdAt).format("DD/MM/YYYY HH:mm:ss")}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">#{entry.actorId}</span>
        {before?.status && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{before.status}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </>
        )}
        <span className="font-medium">{after?.status ?? "—"}</span>
        {notesChanged && (
          <Badge variant="outline" className="text-[11px]">
            notes thay đổi
          </Badge>
        )}
      </div>

      {entry.reason && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Lý do:</span> {entry.reason}
        </p>
      )}

      {entry.correlationId && (
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground" title={entry.correlationId}>
          correlationId: {entry.correlationId}
        </p>
      )}
    </li>
  );
};

/**
 * T2 / UFR-SYS-014 — Audit log của một buổi học (chỉ Admin/Auditor).
 *
 * Gọi `GET /api/v1/audit-logs` (lọc `entityType=SESSION`, `entityId`) và
 * `GET /api/v1/audit-logs/export` để tải CSV.
 */
export function SessionAuditLogDialog({ session, open, onOpenChange }: SessionAuditLogDialogProps) {
  const [exporting, setExporting] = useState(false);
  const sessionId = session?.id;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["session-audit-log", sessionId],
    queryFn: () =>
      sessionAuditApi.search({ entityType: "SESSION", entityId: sessionId as number, size: 20 }),
    enabled: open && !!sessionId,
    staleTime: 0,
  });

  const entries = data?.content ?? [];

  const handleExport = async () => {
    if (!sessionId) return;
    setExporting(true);
    try {
      const blob = await sessionAuditApi.exportCsv({ entityType: "SESSION", entityId: sessionId });
      downloadBlob(blob, `session-${sessionId}-audit-log.csv`);
      toast.success("Đã tải file audit log (CSV).");
    } catch (exportError) {
      toast.error(getApiErrorMessage(exportError, "Không thể export audit log."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="size-4 text-primary" />
            </span>
            Audit log
          </DialogTitle>
          <DialogDescription>
            Nhật ký kiểm toán của buổi học “{session?.title || session?.classCode || "—"}”
            (UFR-SYS-014): actor, hành động, before/after, lý do, thời gian, correlation ID.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {isLoading && (
            <div className="grid gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{getApiErrorMessage(error, "Không thể tải audit log.")}</span>
            </div>
          )}

          {!isLoading && !isError && entries.length === 0 && (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              Chưa có bản ghi kiểm toán nào cho buổi học này.
            </p>
          )}

          {!isLoading && !isError && entries.length > 0 && (
            <ol className="grid gap-3">
              {entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </ol>
          )}

          {!isLoading && !isError && (data?.totalElements ?? 0) > entries.length && (
            <p className="text-xs text-muted-foreground">
              Đang hiển thị {entries.length}/{data?.totalElements} bản ghi. Tải CSV để xem đầy đủ.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={exporting || !entries.length}
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Đang xuất…
              </>
            ) : (
              <>
                <Download className="mr-2 size-4" />
                Xuất CSV
              </>
            )}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
