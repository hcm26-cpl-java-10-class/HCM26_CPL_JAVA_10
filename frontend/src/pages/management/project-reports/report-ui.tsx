import type { ReactNode } from "react";
import { formatNumberNow } from "@/i18n/format";
import { Badge } from "@/components/ui/badge";
import type { BacklogCounts, ReportStatus } from "@/types/features/project-report";
import { statusColors, statusLabels } from "./report-utils";

const statePalettes = {
  neutral: { background: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", dot: "bg-slate-400" },
  working: { background: "bg-blue-50 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  waiting: { background: "bg-amber-50 dark:bg-amber-500/15", text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  success: { background: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  revision: { background: "bg-orange-50 dark:bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  danger: { background: "bg-rose-50 dark:bg-rose-500/15", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  waived: { background: "bg-violet-50 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-400" },
};
const stateTones: Record<string, keyof typeof statePalettes> = {
  DRAFT: "neutral", PLANNED: "neutral", TODO: "neutral",
  ACTIVE: "working", IN_PROGRESS: "working", RUNNING: "working",
  SUBMITTED: "waiting", PENDING_REVIEW: "waiting", REVIEW: "waiting", QUEUED: "waiting",
  ACCEPTED: "success", APPROVED: "success", COMPLETED: "success", DONE: "success", READY: "success",
  CHANGES_REQUESTED: "revision", DUE_SOON: "revision",
  REJECTED: "danger", OVERDUE: "danger", FAILED: "danger", CANCELLED: "danger",
  WAIVED: "waived", PLANNING: "waived",
};
export function reportStateStyle(status: string) {
  const palette = statePalettes[stateTones[status] ?? "neutral"];
  return { surface: palette.background + " " + palette.text, text: palette.text, dot: palette.dot };
}
export function ReportStateBadge({ status, children, className = "" }: {
  status: string; children: ReactNode; className?: string;
}) {
  const style = reportStateStyle(status);
  return <span data-report-status={status} className={"inline-flex max-w-full items-start gap-1.5 rounded-md px-1.5 py-0.5 align-middle font-medium leading-4 " + style.surface + " " + className}>
    <span aria-hidden="true" className={"mt-1.25 size-1.5 shrink-0 rounded-full " + style.dot} />
    <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
  </span>;
}

const statusStyles: Record<ReportStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  PLANNING: "border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  ACTIVE: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  COMPLETED: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED: "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
};
export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge variant="outline" className={"gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-medium " + statusStyles[status]}><span className={"size-1.5 rounded-full " + statusColors[status]} />{statusLabels[status]}</Badge>;
}
export function BacklogSummary({ counts, expanded = false }: { counts: BacklogCounts; expanded?: boolean }) {
  const entries = [
    { label: "Todo", value: counts.todo, color: "bg-slate-400", note: "To do", style: "border-slate-200 bg-slate-50 text-slate-700 dark:border-border dark:bg-muted/30 dark:text-slate-300" },
    { label: "In progress", value: counts.inProgress, color: "bg-blue-500", note: "In progress", style: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300" },
    { label: "Review", value: counts.review, color: "bg-amber-500", note: "In review", style: "border-amber-100 bg-amber-50/60 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300" },
    { label: "Done", value: counts.done, color: "bg-emerald-500", note: "Completed", style: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300" },
    ...(counts.other ? [{ label: "Other", value: counts.other, color: "bg-violet-500", note: "Other statuses", style: "border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300" }] : []),
  ];
  if (expanded) return <div data-report-backlog-summary className="space-y-3">
    <div role="img" aria-label={"Backlog breakdown: " + entries.map(entry => `${entry.label}: ${entry.value}`).join(". ")}
      className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100 p-0.5 dark:bg-muted">
      {counts.total > 0 && entries.filter(entry => entry.value > 0).map(entry => <span aria-hidden="true" key={entry.label} title={`${entry.label}: ${entry.value}`} className={"min-w-[3px] rounded-full " + entry.color} style={{ flexGrow: entry.value, flexBasis: 0 }} />)}
    </div>
    <dl className={"grid grid-cols-2 gap-2.5 " + (counts.other ? "@[640px]/reports:grid-cols-3" : "@[640px]/reports:grid-cols-4")}>
      {entries.map(entry => <div key={entry.label} className={"min-w-0 rounded-lg border p-2.5 " + entry.style}>
        <dt className="flex items-center justify-between gap-1.5 text-[10px] font-medium"><span>{entry.label}</span><span aria-hidden="true" className={"size-2 shrink-0 rounded-full " + entry.color} /></dt>
        <dd className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums">{formatNumberNow(entry.value)}</dd><dd className="mt-1.5 text-[10px] leading-4 opacity-75">{entry.note}</dd>
      </div>)}
    </dl>
  </div>;
  return <dl className="flex min-w-48 flex-wrap gap-x-3 gap-y-1.5">
    {entries.map(entry => <div key={entry.label} className="flex items-center gap-1.5 text-[11px]">
      <span aria-hidden="true" className={"size-1.5 shrink-0 rounded-full " + entry.color} /><dt className="text-muted-foreground">{entry.label}</dt><dd className="font-semibold tabular-nums">{formatNumberNow(entry.value)}</dd>
    </div>)}
  </dl>;
}
