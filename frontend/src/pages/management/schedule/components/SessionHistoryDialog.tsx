import { sessionApi, sessionAuditApi } from "@/api";
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
import { usePermissions } from "@/hooks/usePermissions";
import type { AuditLogEntry, SessionDTO, SessionStatus, SessionStatusHistoryEntry } from "@/types";
import { getApiErrorMessage } from "@/utils/api-error.utils";
import { ADMIN_ROLE } from "@/utils/rbac.utils";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  AlertCircle,
  ArrowRight,
  Copy,
  Download,
  History,
  Loader2,
  NotebookPen,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_LABELS: Record<SessionStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_CLASSES: Record<SessionStatus, string> = {
  SCHEDULED: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  COMPLETED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

type TimelineKind = "STATUS_CHANGE" | "NOTES_UPDATE";

interface TimelineEntry {
  key: string;
  kind: TimelineKind;
  at: string;
  actorId: number | null;
  fromStatus: SessionStatus | null;
  toStatus: SessionStatus | null;
  reason: string | null;
  notes: string | null;
  correlationId: string | null;
}

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

/**
 * Merge status transitions (`session_status_history`) with the audit log (notes/edits)
 * into a single newest-first timeline. Audit rows for status changes are skipped
 * because the history rows already represent them.
 */
const buildTimeline = (
  history: SessionStatusHistoryEntry[],
  audit: AuditLogEntry[],
): TimelineEntry[] => {
  const transitions: TimelineEntry[] = history.map((entry) => ({
    key: `history-${entry.id}`,
    kind: "STATUS_CHANGE",
    at: entry.changedAt,
    actorId: entry.changedBy ?? null,
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus,
    reason: entry.reason ?? null,
    notes: null,
    correlationId: entry.correlationId ?? null,
  }));

  const edits: TimelineEntry[] = audit
    .filter((entry) => entry.action !== "SESSION_STATUS_CHANGE")
    .map((entry) => {
      const after = parseSnapshot(entry.afterState);
      return {
        key: `audit-${entry.id}`,
        kind: "NOTES_UPDATE" as const,
        at: entry.createdAt,
        actorId: entry.actorId ?? null,
        fromStatus: null,
        toStatus: null,
        reason: entry.reason ?? null,
        notes: after?.notes ?? null,
        correlationId: entry.correlationId ?? null,
      };
    });

  return [...transitions, ...edits].sort(
    (a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf(),
  );
};

const copyToClipboard = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}.`);
  } catch {
    toast.error("Could not copy to clipboard.");
  }
};

const TimelineRow = ({ entry }: { entry: TimelineEntry }) => (
  <li className="relative">
    <span className="absolute -left-[1.66rem] top-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />

    <div className="flex flex-wrap items-center gap-2">
      {entry.kind === "STATUS_CHANGE" ? (
        <>
          <Badge variant="secondary" className="text-[11px]">
            Status change
          </Badge>
          {entry.fromStatus ? (
            <>
              <Badge variant="outline" className={STATUS_CLASSES[entry.fromStatus]}>
                {STATUS_LABELS[entry.fromStatus]}
              </Badge>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Created ·</span>
          )}
          {entry.toStatus && (
            <Badge variant="outline" className={STATUS_CLASSES[entry.toStatus]}>
              {STATUS_LABELS[entry.toStatus]}
            </Badge>
          )}
        </>
      ) : (
        <Badge variant="secondary" className="text-[11px]">
          <NotebookPen className="mr-1 size-3" />
          Notes updated
        </Badge>
      )}
    </div>

    {entry.kind === "NOTES_UPDATE" && (
      <p className="mt-1.5 break-words whitespace-pre-wrap text-sm text-muted-foreground">
        {entry.notes ? entry.notes : <span className="italic">Notes cleared.</span>}
      </p>
    )}

    {entry.reason && (
      <p className="mt-1.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Reason:</span> {entry.reason}
      </p>
    )}

    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <UserRound className="size-3" />#{entry.actorId ?? "—"}
      </span>
      <span>{dayjs(entry.at).format("DD/MM/YYYY HH:mm:ss")}</span>
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

interface SessionHistoryDialogProps {
  session: SessionDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Session history — status transitions plus edits (notes), newest first.
 *
 * - `GET /api/v1/sessions/{id}/history` — immutable status history
 * - `GET /api/v1/audit-logs?entityType=SESSION&entityId={id}` — edit entries (Admin only)
 * - `GET /api/v1/audit-logs/export` — CSV export (Admin only)
 */
export function SessionHistoryDialog({ session, open, onOpenChange }: SessionHistoryDialogProps) {
  const sessionId = session?.id;
  const { activeRole } = usePermissions();
  const isAdmin = activeRole === ADMIN_ROLE;
  const [exporting, setExporting] = useState(false);

  const historyQuery = useQuery({
    queryKey: ["session-history", sessionId],
    queryFn: () => sessionApi.getHistory(sessionId as number),
    enabled: open && !!sessionId,
    staleTime: 0,
  });

  const auditQuery = useQuery({
    queryKey: ["session-audit-log", sessionId],
    queryFn: () =>
      sessionAuditApi.search({
        entityType: "SESSION",
        entityId: sessionId as number,
        size: 100,
      }),
    enabled: open && !!sessionId && isAdmin,
    staleTime: 0,
    retry: false,
  });

  const timeline = buildTimeline(historyQuery.data ?? [], auditQuery.data?.content ?? []);
  const isLoading = historyQuery.isLoading || (isAdmin && auditQuery.isLoading);
  const isError = historyQuery.isError;
  const editsUnavailable = isAdmin && auditQuery.isError;

  const handleExport = async () => {
    if (!sessionId) return;
    setExporting(true);
    try {
      const blob = await sessionAuditApi.exportCsv({ entityType: "SESSION", entityId: sessionId });
      downloadBlob(blob, `session-${sessionId}-history.csv`);
      toast.success("History exported as CSV.");
    } catch (exportError) {
      toast.error(getApiErrorMessage(exportError, "Could not export history."));
    } finally {
      setExporting(false);
    }
  };

  const title = session?.title || session?.classCode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <History className="size-4 text-primary" />
            </span>
            History
          </DialogTitle>
          <DialogDescription>
            {title
              ? `Status changes and edits of “${title}”, newest first.`
              : "Status changes and edits of this session, newest first."}{" "}
            The history is append-only and read-only.
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
              <span>{getApiErrorMessage(historyQuery.error, "Could not load the history.")}</span>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              {timeline.length === 0 ? (
                <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                  No history recorded for this session yet.
                </p>
              ) : (
                <ol className="relative ml-2 grid gap-5 border-l border-border/70 pl-5">
                  {timeline.map((entry) => (
                    <TimelineRow key={entry.key} entry={entry} />
                  ))}
                </ol>
              )}

              {editsUnavailable && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Edit history is not available for your role.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={exporting || timeline.length === 0}
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  Export CSV
                </>
              )}
            </Button>
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
