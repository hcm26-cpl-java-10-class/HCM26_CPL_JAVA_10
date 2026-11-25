import { ArrowUpRight, Building2, ChevronRight, ClockAlert, FolderKanban, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { formatDateTimeNow, formatNumberNow } from "@/i18n/format";
import { ArrowUpRight, Building2, ChevronRight, FolderKanban, TrendingUp, Users } from "lucide-react";
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
    { title: "Active master projects", value: k.activeMasters, note: "Active master projects only", icon: TrendingUp, tone: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300" },
    { title: "Classes with projects", value: s.classes, note: s.cohorts + " matching cohorts", icon: Building2, tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" },
    { title: "Active teams", value: k.activeTeams, note: "Teams with an active project, counted once", icon: Users, tone: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300" },
    { title: "Sub-project", value: s.subProjects, note: "Matching sub-projects", icon: FolderKanban, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" },
    { title: "Overdue tasks", value: k.overdueTasks, note: `${k.overdueBacklogItems} backlog · ${k.overdueSubtasks} subtask`, icon: ClockAlert, tone: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
    { title: "Risks needing attention", value: k.riskCount, note: `${k.milestoneRisks} milestone`, icon: ShieldAlert, tone: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  ];
  return <div className="space-y-3.5">
    <section aria-label="Thống kê tổng quan" className="grid gap-3.5 @[480px]/reports:grid-cols-2 @[800px]/reports:grid-cols-4">{metrics.map(metric => <div key={metric.title} className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200/80 bg-card p-4 shadow-xs dark:border-border">
      <div className="flex items-start justify-between gap-3"><h2 className="pt-0.5 text-xs font-medium leading-5 text-muted-foreground">{metric.title}</h2><div aria-hidden="true" className={"flex size-8 shrink-0 items-center justify-center rounded-lg " + metric.tone}><metric.icon className="size-4" /></div></div>
      <div className="mt-2"><p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{formatDateTimeNow(metric.value)}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{metric.note}</p></div>
  return <div data-report-overview className="space-y-3.5">
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 @[600px]/reports:grid-cols-3 @[960px]/reports:grid-cols-6">{metrics.map(metric => <div data-report-metric key={metric.title} className="flex min-w-0 flex-col rounded-lg border border-slate-200/80 bg-card p-3.5 shadow-xs dark:border-border">
      <div data-report-metric-heading className="flex min-h-8 items-start justify-between gap-2"><h2 className="text-xs font-medium leading-4 text-muted-foreground">{metric.title}</h2><div aria-hidden="true" className={"flex size-6 shrink-0 items-center justify-center rounded " + metric.tone}><metric.icon className="size-3.5" /></div></div>
      <div data-report-metric-value className="mt-1.5"><p className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{metric.value.toLocaleString("en-GB")}</p><p data-report-metric-note className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{metric.note}</p></div>
    </div>)}</section>
    <div className="grid gap-3.5 @[960px]/reports:grid-cols-12">
      <section aria-labelledby="master-status-heading" className="flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-card p-4 shadow-xs dark:border-border sm:p-5 @[960px]/reports:col-span-5">
        <header><h2 id="master-status-heading" className="text-sm font-semibold tracking-tight">Phân bố trạng thái Master Project</h2><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Mỗi Master được đếm một lần theo trạng thái Project hiện tại.</p></header>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-5 @[480px]/reports:flex-row @[480px]/reports:justify-between">
          <div role="img" aria-label={"Tổng " + total + " Master. " + statuses.map(status => statusLabels[status] + ": " + data.statuses[status]).join(". ")} className="relative flex size-40 shrink-0 items-center justify-center rounded-full" style={{ background: slices.length ? "conic-gradient(" + slices.join(", ") + ")" : "var(--muted)" }}>
            <div className="flex size-[120px] flex-col items-center justify-center rounded-full bg-card"><strong className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{formatNumberNow(total)}</strong><span className="mt-2 text-[11px] text-muted-foreground">Master Project</span></div>
    <div data-report-charts className="grid gap-3.5 @[960px]/reports:grid-cols-2 @[1020px]/reports:grid-cols-3">
      <ReportKpiStatuses overview={k} />
      <section data-report-chart="master" aria-labelledby="master-status-heading" className="flex min-w-0 flex-col rounded-lg border border-slate-200/80 bg-card p-4 shadow-xs dark:border-border">
        <header><h2 id="master-status-heading" className="text-xs font-semibold tracking-tight">Master project status breakdown</h2><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Each master project is counted once by its current status.</p></header>
        <div data-report-chart-body className="flex flex-1 items-center justify-center gap-4 py-3 sm:gap-6">
          <div data-report-donut role="img" aria-label={`Total master projects: ${total}. ${statuses.map(status => `${statusLabels[status]}: ${data.statuses[status]}`).join(". ")}`} className="flex size-28 shrink-0 items-center justify-center rounded-full" style={{ background: slices.length ? "conic-gradient(" + slices.join(", ") + ")" : "var(--muted)" }}>
            <div data-report-donut-center className="flex size-22 flex-col items-center justify-center rounded-full bg-card"><strong className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{total.toLocaleString("en-GB")}</strong><span className="mt-1 text-[10px] text-muted-foreground">Master Project</span></div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-1">{statuses.map(status => <li key={status}><button type="button" className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onFilter({ masterStatus: status })} aria-label={"Lọc Master " + statusLabels[status]}>
            <span className={"size-2.5 shrink-0 rounded-full " + statusColors[status]} /><span className="min-w-0 flex-1 text-muted-foreground">{statusLabels[status]}</span><strong className="font-semibold tabular-nums">{formatNumberNow(data.statuses[status])}</strong><ArrowUpRight aria-hidden="true" className="size-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          <ul data-report-master-legend className="w-48 min-w-0 max-w-52 flex-initial space-y-1">{statuses.map(status => <li key={status}><button type="button" className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onFilter({ masterStatus: status })} aria-label={"Filter master projects by " + statusLabels[status]}>
            <span className={"size-2.5 shrink-0 rounded-full " + statusColors[status]} /><span className="min-w-0 flex-1 text-muted-foreground">{statusLabels[status]}</span><strong className="font-semibold tabular-nums">{data.statuses[status].toLocaleString("en-GB")}</strong><ArrowUpRight aria-hidden="true" className="size-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button></li>)}</ul>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-border"><p className="text-muted-foreground">Hoàn thành: <strong className="font-medium">{formatNumberNow(data.statuses.COMPLETED)} / {formatNumberNow(total)}</strong> Master</p><button type="button" onClick={onViewProjects} aria-controls="project-report-masters" className="rounded font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">Chi tiết trạng thái</button></footer>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-border"><p className="text-muted-foreground">Completed: <strong className="font-medium">{data.statuses.COMPLETED.toLocaleString("en-GB")} / {total.toLocaleString("en-GB")}</strong> Master</p><button type="button" onClick={onViewProjects} aria-controls="project-report-masters" className="rounded font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">Status details</button></footer>
      </section>
      <section aria-labelledby="master-backlog-heading" className="flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-card p-4 shadow-xs dark:border-border sm:p-5 @[960px]/reports:col-span-7">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-x-5 gap-y-3"><div className="min-w-0 flex-1 basis-48"><h2 id="master-backlog-heading" className="text-sm font-semibold tracking-tight">Backlog của các Master</h2><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Cộng backlog trực tiếp trên Master và toàn bộ Project con trong phạm vi bạn được xem. Tổng này bao gồm cả module bị ẩn bởi bộ lọc chi tiết.</p></div>
          <div className="flex shrink-0 items-center gap-2"><strong className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{formatDateTimeNow(s.backlog.total)}</strong><span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:border-border dark:bg-muted dark:text-muted-foreground">Backlog item</span></div>
      <section data-report-chart="backlog" aria-labelledby="master-backlog-heading" className="flex min-w-0 flex-col rounded-lg border border-slate-200/80 bg-card p-4 shadow-xs dark:border-border @[1020px]/reports:col-span-3">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2"><div className="min-w-0 flex-1 basis-40"><h2 id="master-backlog-heading" className="text-xs font-semibold tracking-tight">Master project backlog</h2><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Backlog across master projects and sub-projects in your access scope.</p></div>
          <div className="flex shrink-0 items-center gap-2"><strong className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{s.backlog.total.toLocaleString("en-GB")}</strong><span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:border-border dark:bg-muted dark:text-muted-foreground">Backlog item</span></div>
        </header>
        <div className="flex-1"><BacklogSummary counts={s.backlog} expanded /></div>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-border"><p className="flex items-center gap-1.5 text-muted-foreground"><span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />Đã hoàn thành <strong className="font-medium text-foreground">{formatDateTimeNow(s.backlog.done)} / {formatDateTimeNow(s.backlog.total)}</strong> công việc</p>
          <button type="button" onClick={onViewProjects} aria-controls="project-report-masters" className="inline-flex items-center gap-1 rounded font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">Xem backlog từng dự án<ChevronRight aria-hidden="true" className="size-3" /></button></footer>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-border"><p className="flex items-center gap-1.5 text-muted-foreground"><span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />Completed <strong className="font-medium text-foreground">{s.backlog.done.toLocaleString("en-GB")} / {s.backlog.total.toLocaleString("en-GB")}</strong> work items</p>
          <button type="button" onClick={onViewProjects} aria-controls="project-report-masters" className="inline-flex items-center gap-1 rounded font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">View project backlog<ChevronRight aria-hidden="true" className="size-3" /></button></footer>
      </section>
    </div>
  </div>;
}
