import { Badge } from "@/components/ui/badge";
import type { BacklogCounts, ReportStatus } from "@/types/features/project-report";
import { statusColors, statusLabels } from "./report-utils";

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
    { label: "Todo", value: counts.todo, color: "bg-slate-400", note: "Chờ thực hiện", style: "border-slate-200 bg-slate-50 text-slate-700 dark:border-border dark:bg-muted/30 dark:text-slate-300" },
    { label: "In progress", value: counts.inProgress, color: "bg-blue-500", note: "Đang tiến hành", style: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300" },
    { label: "Review", value: counts.review, color: "bg-amber-500", note: "Chờ review", style: "border-amber-100 bg-amber-50/60 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300" },
    { label: "Done", value: counts.done, color: "bg-emerald-500", note: "Đã hoàn thành", style: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300" },
    ...(counts.other ? [{ label: "Khác", value: counts.other, color: "bg-violet-500", note: "Trạng thái khác", style: "border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300" }] : []),
  ];
  if (expanded) return <div className="space-y-4">
    <div role="img" aria-label={"Phân bố backlog: " + entries.map(entry => `${entry.label}: ${entry.value}`).join(". ")}
      className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100 p-0.5 dark:bg-muted">
      {counts.total > 0 && entries.filter(entry => entry.value > 0).map(entry => <span aria-hidden="true" key={entry.label} title={`${entry.label}: ${entry.value}`} className={"min-w-[3px] rounded-full " + entry.color} style={{ flexGrow: entry.value, flexBasis: 0 }} />)}
    </div>
    <dl className={"grid grid-cols-2 gap-2.5 " + (counts.other ? "@[640px]/reports:grid-cols-3" : "@[640px]/reports:grid-cols-4")}>
      {entries.map(entry => <div key={entry.label} className={"min-w-0 rounded-lg border p-3 " + entry.style}>
        <dt className="flex items-center justify-between gap-1.5 text-[11px] font-medium"><span>{entry.label}</span><span aria-hidden="true" className={"size-2 shrink-0 rounded-full " + entry.color} /></dt>
        <dd className="mt-2.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{entry.value.toLocaleString("vi-VN")}</dd><dd className="mt-1.5 text-[10px] leading-4 opacity-75">{entry.note}</dd>
      </div>)}
    </dl>
  </div>;
  return <dl className="flex min-w-48 flex-wrap gap-x-3 gap-y-1.5">
    {entries.map(entry => <div key={entry.label} className="flex items-center gap-1.5 text-[11px]">
      <span aria-hidden="true" className={"size-1.5 shrink-0 rounded-full " + entry.color} /><dt className="text-muted-foreground">{entry.label}</dt><dd className="font-semibold tabular-nums">{entry.value.toLocaleString("vi-VN")}</dd>
    </div>)}
  </dl>;
}
