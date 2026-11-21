import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2, PauseCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitSyncJob } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../git-integration.format";

type PillState = "PENDING" | "RUNNING" | "PAUSED" | "SUCCEEDED" | "PARTIAL" | "FAILED";

/** One meaning per colour: sky = working, emerald = done, amber = needs attention, red = failed, slate = waiting. */
const STYLES: Record<PillState, { label: string; icon: LucideIcon; className: string; spin?: boolean }> = {
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
  PAUSED: {
    label: "Paused",
    icon: PauseCircle,
    className: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  SUCCEEDED: {
    label: "Synced",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  PARTIAL: {
    label: "Partially synced",
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  },
  FAILED: {
    label: "Sync failed",
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300",
  },
};

const NUMBER = new Intl.NumberFormat("en-US");
const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/** A job between two runs of a long import (or waiting for the rate limit) is still "syncing" to the user. */
function pillState(job: GitSyncJob): PillState {
  if (job.status === "PENDING" && job.pausedUntil) return "PAUSED";
  if (job.status === "PENDING" && (job.progress?.pages ?? 0) > 0) return "RUNNING";
  return job.status;
}

/** US-GI-04 / US-SY-01: state of the latest repository synchronization (text + icon, never colour alone). */
export function SyncStatusPill({ job, lastSyncedAt }: { job: GitSyncJob | null; lastSyncedAt?: string | null }) {
  if (!job) return null;
  const state = pillState(job);
  const style = STYLES[state];
  const Icon = style.icon;
  const when = state === "SUCCEEDED" ? (lastSyncedAt ?? job.finishedAt) : undefined;
  const imported = job.progress?.inserted ?? 0;

  let detail: string | undefined;
  let title: string | undefined = when ? formatDateTime(when) : undefined;
  if (state === "RUNNING" && job.phase === "COMMITS" && imported > 0) {
    detail = `${NUMBER.format(imported)} ${imported === 1 ? "commit" : "commits"}`;
    title = "Importing the commit history of the default branch";
  } else if (state === "PAUSED" && job.pausedUntil) {
    detail = `resumes ${TIME.format(new Date(job.pausedUntil))}`;
    title = `GitHub rate limit reached · resumes automatically at ${formatDateTime(job.pausedUntil)}`;
  } else if (state === "PARTIAL") {
    title = `${NUMBER.format(imported)} commits imported before it stopped`;
  }

  return <span role="status" title={title}
    className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", style.className)}>
    <Icon className={cn("size-3.5", style.spin && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
    {style.label}
    {when && <span className="font-normal opacity-80">· {formatRelative(when)}</span>}
    {detail && <span className="font-normal tabular-nums opacity-80">· {detail}</span>}
  </span>;
}
