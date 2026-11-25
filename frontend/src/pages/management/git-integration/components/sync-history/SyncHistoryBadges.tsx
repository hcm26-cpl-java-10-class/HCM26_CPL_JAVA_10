import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitSyncHistoryStatus, GitSyncHistoryType } from "@/types/features/git-integration";
import { SYNC_STATUS_LABELS, SYNC_TYPE_LABELS } from "./sync-history.format";

const TYPE_HINTS: Record<GitSyncHistoryType, string> = {
  INITIAL: "First import of the repository's history, when it was linked",
  MANUAL: "Started by someone (Sync now, Sync again, resume)",
  RECONCILE: "Periodic check that collects anything a webhook missed",
  WEBHOOK: "GitHub sent new activity (push, pull request, review)",
};

/** BR4, one meaning per colour (same as the sync pill): slate = waiting, sky = working, emerald = done, amber = partly, red = failed. */
const STATUS_STYLES: Record<GitSyncHistoryStatus, { label: string; icon: LucideIcon; className: string; spin?: boolean }> = {
  PENDING: {
    label: SYNC_STATUS_LABELS.PENDING,
    icon: Clock,
    className: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  PROCESSING: {
    label: SYNC_STATUS_LABELS.PROCESSING,
    icon: Loader2,
    spin: true,
    className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  },
  SUCCESS: {
    label: SYNC_STATUS_LABELS.SUCCESS,
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  PARTIAL_SUCCESS: {
    label: SYNC_STATUS_LABELS.PARTIAL_SUCCESS,
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  },
  FAILED: {
    label: SYNC_STATUS_LABELS.FAILED,
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300",
  },
};

export function SyncTypeBadge({ type }: { type: GitSyncHistoryType }) {
  return <span title={TYPE_HINTS[type]}
    className="inline-flex shrink-0 items-center rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
    {SYNC_TYPE_LABELS[type]}
  </span>;
}

export function SyncStatusBadge({ status, className }: { status: GitSyncHistoryStatus; className?: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.FAILED;
  const Icon = style.icon;
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", style.className, className)}>
    <Icon className={cn("size-3", style.spin && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />{style.label}
  </span>;
}
