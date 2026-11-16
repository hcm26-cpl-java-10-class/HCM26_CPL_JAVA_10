import { AlertCircle, CheckCircle2, Clock, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitSyncJob, GitSyncJobStatus } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../git-integration.format";

const STYLES: Record<GitSyncJobStatus, { label: string; icon: LucideIcon; className: string; spin?: boolean }> = {
  PENDING: {
    label: "Sync pending",
    icon: Clock,
    className: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  RUNNING: {
    label: "Syncing…",
    icon: Loader2,
    spin: true,
    className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  },
  SUCCEEDED: {
    label: "Synced",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  FAILED: {
    label: "Sync failed",
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300",
  },
};

/** US-GI-04: state of the latest repository synchronization (text + icon, never colour alone). */
export function SyncStatusPill({ job, lastSyncedAt }: { job: GitSyncJob | null; lastSyncedAt?: string | null }) {
  if (!job) return null;
  const style = STYLES[job.status];
  const Icon = style.icon;
  const when = job.status === "SUCCEEDED" ? (lastSyncedAt ?? job.finishedAt) : undefined;
  return <span role="status" title={when ? formatDateTime(when) : undefined}
    className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", style.className)}>
    <Icon className={cn("size-3.5", style.spin && "animate-spin")} aria-hidden="true" />
    {style.label}{when && <span className="font-normal opacity-80">· {formatRelative(when)}</span>}
  </span>;
}
