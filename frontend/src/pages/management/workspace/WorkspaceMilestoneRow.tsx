import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { milestoneStatusStyles } from "@/pages/management/project/milestone/milestone-status.styles";
import type { MilestoneLifecycleStatus } from "@/types";
import type { DeadlineInfo } from "./workspace-milestone-deadline";

const STEP_INDEX: Record<MilestoneLifecycleStatus, number> = {
  PLANNED: 0, IN_PROGRESS: 1, SUBMITTED: 2, CHANGES_REQUESTED: 2, ACCEPTED: 3, REJECTED: 3,
};

const FLAG_STYLES: Record<DeadlineInfo["tone"], string> = {
  normal: "",
  done: "",
  soon: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  "late-window": "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  overdue: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

export function MilestoneStatusPill({ status, label }: { status: MilestoneLifecycleStatus | null; label?: string }) {
  const style = status ? milestoneStatusStyles[status] : null;
  return <Badge variant="outline" className={cn("w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold", style?.badge)}>
    {label ?? style?.label ?? "Unknown"}
  </Badge>;
}

/** Four dots showing lifecycle position; the last dot reflects the review outcome. */
export function MilestoneMiniProgress({ status }: { status: MilestoneLifecycleStatus }) {
  const current = STEP_INDEX[status];
  const outcome = status === "REJECTED" ? "bg-red-500" : status === "CHANGES_REQUESTED" ? "bg-amber-500" : "bg-emerald-500";
  return <span className="inline-flex items-center gap-1" aria-label={`Step ${current + 1} of 4`}>
    {[0, 1, 2, 3].map((step) => <span key={step} className={cn("size-1.5 rounded-full",
      step < current ? "bg-emerald-500"
        : step === current ? (status === "CHANGES_REQUESTED" || status === "REJECTED" || status === "ACCEPTED" ? outcome : "bg-sky-500 ring-2 ring-sky-200 dark:ring-sky-900")
          : "bg-muted-foreground/25")} />)}
  </span>;
}

export function WorkspaceMilestoneRow({ title, description, status, statusLabel, deadline, badges, onOpen, primaryAction, menu }: {
  title: string;
  description?: string | null;
  status: MilestoneLifecycleStatus | null;
  statusLabel?: string;
  deadline: DeadlineInfo;
  badges?: ReactNode;
  onOpen?: () => void;
  primaryAction?: ReactNode;
  menu?: ReactNode;
}) {
  const edge = status ? milestoneStatusStyles[status].edge : "border-l-slate-300";
  return <div className={cn("grid gap-3 border-b border-l-4 px-4 py-3 last:border-b-0 hover:bg-muted/20 md:grid-cols-[minmax(0,1fr)_190px_150px_auto] md:items-center md:gap-4", edge)}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {onOpen ? <button type="button" className="min-w-0 break-words text-left font-semibold leading-5 hover:underline" onClick={onOpen}>{title}</button>
          : <span className="min-w-0 break-words font-semibold leading-5">{title}</span>}
        {badges}
      </div>
      {description ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground" title={description}>{description}</p> : null}
    </div>
    <div className="flex min-w-0 items-start gap-2 text-sm" title="Shown in your device time zone">
      <CalendarClock className={cn("mt-0.5 size-4 shrink-0", deadline.tone === "overdue" ? "text-red-600" : deadline.tone === "soon" || deadline.tone === "late-window" ? "text-amber-600" : "text-muted-foreground")} />
      <div className="min-w-0">
        <div className={cn("truncate", deadline.tone === "done" ? "text-muted-foreground" : "font-medium")}>{deadline.date}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {deadline.relative ? <span className="text-xs text-muted-foreground">{deadline.relative}</span> : null}
          {deadline.flag ? <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px] font-semibold", FLAG_STYLES[deadline.tone])}>{deadline.flag}</Badge> : null}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-1">
      <MilestoneStatusPill status={status} label={statusLabel} />
      {status ? <MilestoneMiniProgress status={status} /> : null}
    </div>
    <div className="flex items-center gap-1 md:justify-end">{primaryAction}{menu}</div>
  </div>;
}
