import { Activity, ArrowUpRight, Building2, Clock3, FolderKanban, TriangleAlert, Users, UserRoundX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportDashboard, ReportFilters, ReportStatus } from "@/types/features/project-report";
import { BacklogSummary } from "./report-ui";
import { statusColors, statusLabels } from "./report-utils";

const chartColors: Record<ReportStatus, string> = {
  DRAFT: "#94a3b8", PLANNING: "#a78bfa", ACTIVE: "#3b82f6", COMPLETED: "#10b981", CANCELLED: "#fb7185",
};
export function ReportOverview({ data, onFilter }: { data: ReportDashboard; onFilter: (changes: Partial<ReportFilters>) => void }) {
  const s = data.summary, statuses = Object.keys(statusLabels) as ReportStatus[];
  const total = statuses.reduce((sum, status) => sum + data.statuses[status], 0);
  let offset = 0;
  const slices = statuses.filter(status => data.statuses[status] > 0).map(status => {
    const start = offset;
    offset += data.statuses[status] / Math.max(total, 1) * 100;
    return chartColors[status] + " " + start + "% " + offset + "%";
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
          <ul className="w-full min-w-0 flex-1 space-y-1">{statuses.map(status => <li key={status}><button type="button" className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onFilter({ masterStatus: status, ...(status === "CANCELLED" ? { includeCancelled: true } : {}) })} aria-label={"Lọc Master " + statusLabels[status]}>
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
    <Card className="gap-4 shadow-none"><CardHeader className="gap-1"><CardTitle className="flex items-center gap-2 text-base"><TriangleAlert className="size-4 text-amber-600" />Cần theo dõi</CardTitle><p className="text-xs leading-5 text-muted-foreground">Quá hạn là milestone chưa nộp đúng hạn. Thành viên có việc chờ nhưng chưa bắt đầu trong {data.inactiveDays} ngày được đánh dấu không hoạt động.</p></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">{[
        { title: "Đang quá hạn", value: s.overdueProjects, note: "Project có milestone quá hạn chưa nộp", risk: "OVERDUE" as const, icon: TriangleAlert, tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50/70 dark:bg-rose-950/20" },
        { title: "Thành viên không hoạt động", value: s.inactiveMembers, note: "Thuộc " + s.inactiveProjects + " Project trong kết quả", risk: "INACTIVE_MEMBERS" as const, icon: UserRoundX, tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/70 dark:bg-amber-950/20" },
        { title: "Có lần nộp trễ", value: s.lateProjects, note: "Project có lịch sử nộp trễ, có thể đã xử lý", risk: "LATE_SUBMISSION" as const, icon: Clock3, tone: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-900/40" },
      ].map(risk => <button type="button" key={risk.title} onClick={() => onFilter({ risk: risk.risk })} className={"flex items-center gap-3 rounded-xl p-4 text-left hover:ring-1 hover:ring-border focus-visible:outline-2 focus-visible:outline-ring " + risk.bg}>
        <risk.icon className={"size-5 shrink-0 " + risk.tone} /><div className="min-w-0 flex-1"><p className="text-xs font-medium">{risk.title}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{risk.note}</p><span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium">Xem chi tiết<ArrowUpRight className="size-3" /></span></div><strong className={"text-2xl font-semibold tabular-nums " + risk.tone}>{risk.value}</strong>
      </button>)}</CardContent>
    </Card>
  </div>;
}
