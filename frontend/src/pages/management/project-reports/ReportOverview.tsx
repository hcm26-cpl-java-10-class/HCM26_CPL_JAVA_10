import { ArrowUpRight, Building2, ChevronRight, ClockAlert, FolderKanban, ShieldAlert, TrendingUp, Users } from "lucide-react";
import type { ReportDashboard, ReportFilters, ReportStatus } from "@/types/features/project-report";
import { BacklogSummary } from "./report-ui";
import { reportStatuses, statusColors, statusLabels } from "./report-utils";
import { ReportKpiStatuses } from "./ReportKpiStatuses";

const chartColors: Record<ReportStatus, string> = {
  DRAFT: "#94a3b8", PLANNING: "#a78bfa", ACTIVE: "#3b82f6", COMPLETED: "#10b981", CANCELLED: "#fb7185",
};
export function ReportOverview({ data, onFilter, onViewProjects }: {
  data: ReportDashboard;
  onFilter: (changes: Partial<ReportFilters>) => void;
  onViewProjects: () => void;
}) {
  const s = data.summary, statuses = reportStatuses((Object.keys(data.statuses) as ReportStatus[]).filter(status => data.statuses[status] > 0));
  const total = statuses.reduce((sum, status) => sum + data.statuses[status], 0);
  const slices = statuses.filter(status => data.statuses[status] > 0).map((status, index, visibleStatuses) => {
    const start = visibleStatuses.slice(0, index).reduce((sum, previous) => sum + data.statuses[previous], 0) / Math.max(total, 1) * 100;
    const end = start + data.statuses[status] / Math.max(total, 1) * 100;
    return chartColors[status] + " " + start + "% " + end + "%";
  });
  const k = data.overview;
  const metrics = [
    { title: "Master đang triển khai", value: k.activeMasters, note: "Master hoạt động, không cộng Project con", icon: TrendingUp, tone: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300" },
    { title: "Lớp có dự án", value: s.classes, note: s.cohorts + " cohort trong kết quả", icon: Building2, tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" },
    { title: "Team đang tham gia", value: k.activeTeams, note: "Team có Project hoạt động, đếm một lần", icon: Users, tone: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300" },
    { title: "Sub-project", value: s.subProjects, note: "Project con khớp bộ lọc", icon: FolderKanban, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" },
    { title: "Task quá hạn", value: k.overdueTasks, note: `${k.overdueBacklogItems} backlog · ${k.overdueSubtasks} task con`, icon: ClockAlert, tone: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
    { title: "Rủi ro cần xử lý", value: k.riskCount, note: `${k.milestoneRisks} milestone · ${k.overdueTasks} task · ${k.inactiveMembers} thành viên`, icon: ShieldAlert, tone: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  ];
  return <div data-report-overview className="space-y-3.5">
    <section aria-label="Thống kê tổng quan" className="grid grid-cols-2 gap-3 @[600px]/reports:grid-cols-3 @[960px]/reports:grid-cols-6">{metrics.map(metric => <div data-report-metric key={metric.title} className="flex min-w-0 flex-col rounded-lg border border-slate-200/80 bg-card p-3.5 shadow-xs dark:border-border">
      <div data-report-metric-heading className="flex min-h-8 items-start justify-between gap-2"><h2 className="text-xs font-medium leading-4 text-muted-foreground">{metric.title}</h2><div aria-hidden="true" className={"flex size-6 shrink-0 items-center justify-center rounded " + metric.tone}><metric.icon className="size-3.5" /></div></div>
      <div data-report-metric-value className="mt-1.5"><p className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{metric.value.toLocaleString("vi-VN")}</p><p data-report-metric-note className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{metric.note}</p></div>
    </div>)}</section>
    <div data-report-charts className="grid gap-3.5 @[960px]/reports:grid-cols-2 @[1020px]/reports:grid-cols-3">
      <ReportKpiStatuses overview={k} />
      <section data-report-chart="master" aria-labelledby="master-status-heading" className="flex min-w-0 flex-col rounded-lg border border-slate-200/80 bg-card p-4 shadow-xs dark:border-border">
        <header><h2 id="master-status-heading" className="text-xs font-semibold tracking-tight">Phân bố trạng thái Master Project</h2><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Mỗi Master được đếm một lần theo trạng thái Project hiện tại.</p></header>
        <div data-report-chart-body className="flex flex-1 items-center justify-center gap-4 py-3 sm:gap-6">
          <div data-report-donut role="img" aria-label={"Tổng " + total + " Master. " + statuses.map(status => statusLabels[status] + ": " + data.statuses[status]).join(". ")} className="flex size-28 shrink-0 items-center justify-center rounded-full" style={{ background: slices.length ? "conic-gradient(" + slices.join(", ") + ")" : "var(--muted)" }}>
            <div data-report-donut-center className="flex size-22 flex-col items-center justify-center rounded-full bg-card"><strong className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{total.toLocaleString("vi-VN")}</strong><span className="mt-1 text-[10px] text-muted-foreground">Master Project</span></div>
          </div>
          <ul data-report-master-legend className="w-48 min-w-0 max-w-52 flex-initial space-y-1">{statuses.map(status => <li key={status}><button type="button" className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onFilter({ masterStatus: status })} aria-label={"Lọc Master " + statusLabels[status]}>
            <span className={"size-2.5 shrink-0 rounded-full " + statusColors[status]} /><span className="min-w-0 flex-1 text-muted-foreground">{statusLabels[status]}</span><strong className="font-semibold tabular-nums">{data.statuses[status].toLocaleString("vi-VN")}</strong><ArrowUpRight aria-hidden="true" className="size-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button></li>)}</ul>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-border"><p className="text-muted-foreground">Hoàn thành: <strong className="font-medium">{data.statuses.COMPLETED.toLocaleString("vi-VN")} / {total.toLocaleString("vi-VN")}</strong> Master</p><button type="button" onClick={onViewProjects} aria-controls="project-report-masters" className="rounded font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">Chi tiết trạng thái</button></footer>
      </section>
      <section data-report-chart="backlog" aria-labelledby="master-backlog-heading" className="flex min-w-0 flex-col rounded-lg border border-slate-200/80 bg-card p-4 shadow-xs dark:border-border @[1020px]/reports:col-span-3">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2"><div className="min-w-0 flex-1 basis-40"><h2 id="master-backlog-heading" className="text-xs font-semibold tracking-tight">Backlog của các Master</h2><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Backlog của Master và Project con trong phạm vi bạn được xem, kể cả phần bị bộ lọc chi tiết ẩn.</p></div>
          <div className="flex shrink-0 items-center gap-2"><strong className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{s.backlog.total.toLocaleString("vi-VN")}</strong><span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:border-border dark:bg-muted dark:text-muted-foreground">Backlog item</span></div>
        </header>
        <div className="flex-1"><BacklogSummary counts={s.backlog} expanded /></div>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-border"><p className="flex items-center gap-1.5 text-muted-foreground"><span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />Đã hoàn thành <strong className="font-medium text-foreground">{s.backlog.done.toLocaleString("vi-VN")} / {s.backlog.total.toLocaleString("vi-VN")}</strong> công việc</p>
          <button type="button" onClick={onViewProjects} aria-controls="project-report-masters" className="inline-flex items-center gap-1 rounded font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">Xem backlog từng dự án<ChevronRight aria-hidden="true" className="size-3" /></button></footer>
      </section>
    </div>
  </div>;
}
