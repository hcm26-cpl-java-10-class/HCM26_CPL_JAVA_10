import { Activity, ArrowUpRight, Building2, FolderKanban, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportDashboard, ReportFilters, ReportStatus } from "@/types/features/project-report";
import { BacklogSummary } from "./report-ui";
import { reportStatuses, statusColors, statusLabels } from "./report-utils";

const chartColors: Record<ReportStatus, string> = {
  DRAFT: "#94a3b8", PLANNING: "#a78bfa", ACTIVE: "#3b82f6", COMPLETED: "#10b981", CANCELLED: "#fb7185",
};
export function ReportOverview({ data, onFilter }: { data: ReportDashboard; onFilter: (changes: Partial<ReportFilters>) => void }) {
  const s = data.summary, statuses = reportStatuses((Object.keys(data.statuses) as ReportStatus[]).filter(status => data.statuses[status] > 0));
  const total = statuses.reduce((sum, status) => sum + data.statuses[status], 0);
  const slices = statuses.filter(status => data.statuses[status] > 0).map((status, index, visibleStatuses) => {
    const start = visibleStatuses.slice(0, index).reduce((sum, previous) => sum + data.statuses[previous], 0) / Math.max(total, 1) * 100;
    const end = start + data.statuses[status] / Math.max(total, 1) * 100;
    return chartColors[status] + " " + start + "% " + end + "%";
  });
  const metrics = [
    { title: "Master đang triển khai", value: s.runningMasters, note: s.masters + " Master Project trong kết quả", icon: Activity, tone: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300" },
    { title: "Lớp có dự án", value: s.classes, note: s.cohorts + " cohort trong kết quả", icon: Building2, tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" },
    { title: "Team tham gia", value: s.teams, note: "Mỗi team được đếm một lần", icon: Users, tone: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300" },
    { title: "Sub-project", value: s.subProjects, note: "Project con khớp bộ lọc", icon: FolderKanban, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" },
  ];
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <Card key={metric.title} className="gap-4 shadow-none">
      <CardContent><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{metric.title}</p><div className={"flex size-9 shrink-0 items-center justify-center rounded-xl " + metric.tone}><metric.icon className="size-[18px]" /></div></div>
        <p className="mt-3 text-[34px] leading-none font-semibold tracking-tight tabular-nums">{metric.value.toLocaleString("vi-VN")}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{metric.note}</p></CardContent>
    </Card>)}</div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="gap-5 shadow-none"><CardHeader><CardTitle className="text-base">Phân bố trạng thái Master Project</CardTitle><p className="text-xs leading-5 text-muted-foreground">Mỗi Master được đếm một lần theo trạng thái Project hiện tại.</p></CardHeader>
        <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <div role="img" aria-label={"Tổng " + total + " Master. " + statuses.map(status => statusLabels[status] + ": " + data.statuses[status]).join(". ")} className="relative flex size-44 shrink-0 items-center justify-center rounded-full" style={{ background: slices.length ? "conic-gradient(" + slices.join(", ") + ")" : "var(--muted)" }}>
            <div className="flex size-32 flex-col items-center justify-center rounded-full bg-card"><strong className="text-3xl font-semibold tracking-tight tabular-nums">{total.toLocaleString("vi-VN")}</strong><span className="mt-1 text-xs text-muted-foreground">Master Project</span></div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-1">{statuses.map(status => <li key={status}><button type="button" className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onFilter({ masterStatus: status })} aria-label={"Lọc Master " + statusLabels[status]}>
            <span className={"size-2.5 shrink-0 rounded-full " + statusColors[status]} /><span className="flex-1 text-muted-foreground">{statusLabels[status]}</span><strong className="text-sm font-semibold tabular-nums">{data.statuses[status]}</strong><ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button></li>)}</ul>
        </CardContent>
      </Card>
      <Card className="gap-5 shadow-none"><CardHeader><CardTitle className="text-base">Backlog của các Master</CardTitle><p className="text-xs leading-5 text-muted-foreground">Cộng backlog trực tiếp trên Master và toàn bộ Project con trong phạm vi bạn được xem. Bộ lọc chi tiết chọn Master; tổng này vẫn bao gồm các module còn lại của Master đó.</p></CardHeader>
        <CardContent><div className="mb-5 flex items-baseline gap-2"><strong className="text-3xl font-semibold tabular-nums">{s.backlog.total.toLocaleString("vi-VN")}</strong><span className="text-sm text-muted-foreground">backlog item</span></div>
          <BacklogSummary counts={s.backlog} expanded />
        </CardContent>
      </Card>
    </div>
  </div>;
}
