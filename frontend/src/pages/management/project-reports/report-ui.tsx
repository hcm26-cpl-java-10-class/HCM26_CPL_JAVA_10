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
    { label: "Todo", value: counts.todo, color: "bg-slate-400" },
    { label: "In progress", value: counts.inProgress, color: "bg-blue-500" },
    { label: "Review", value: counts.review, color: "bg-violet-500" },
    { label: "Done", value: counts.done, color: "bg-emerald-500" },
    ...(counts.other ? [{ label: "Khác", value: counts.other, color: "bg-amber-500" }] : []),
  ];
  return <dl className={expanded ? "grid grid-cols-2 gap-3" : "flex min-w-48 flex-wrap gap-x-3 gap-y-1.5"}>
    {entries.map(entry => <div key={entry.label} className={expanded ? "flex items-center gap-2 rounded-lg bg-muted/40 p-3" : "flex items-center gap-1.5 text-[11px]"}>
      <span className={"size-1.5 shrink-0 rounded-full " + entry.color} /><dt className="text-muted-foreground">{entry.label}</dt><dd className={(expanded ? "ml-auto text-lg " : "") + "font-semibold tabular-nums"}>{entry.value.toLocaleString("vi-VN")}</dd>
    </div>)}
  </dl>;
}
