import { Activity, ArrowUpRight, Building2, CircleCheck, Clock3, FolderKanban, Info, TriangleAlert, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportDashboard, ReportFilters, ReportStatus } from "@/types/features/project-report";
import { statusColors, statusLabels } from "./report-ui";

const chartColors: Record<ReportStatus, string> = {
  NOT_STARTED: "#94a3b8", IN_PROGRESS: "#3b82f6", SUBMITTED: "#8b5cf6", DONE: "#10b981", CANCELLED: "#fb7185",
};
const percentage = (value: number | null) => value === null ? "—" : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
export function ReportOverview({ data, onFilter }: { data: ReportDashboard; onFilter: (changes: Partial<ReportFilters>) => void }) {
  const s = data.summary, statuses = Object.keys(statusLabels) as ReportStatus[];
  const total = statuses.reduce((sum, status) => sum + data.statuses[status], 0);
  let offset = 0;
  const slices = statuses.filter(status => data.statuses[status] > 0).map(status => {
    const start = offset;
    offset += data.statuses[status] / Math.max(total, 1) * 100;
    return `${chartColors[status]} ${start}% ${offset}%`;
  });
  const metrics = [
    { title: "Lớp có dự án", value: s.classes, note: `${s.cohorts} cohort trong kết quả`, icon: Building2, tone: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300" },
    { title: "Team tham gia", value: s.teams, note: "Team có dự án khớp bộ lọc", icon: Users, tone: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300" },
    { title: "Tổng dự án của team", value: s.projects, note: `${s.masters} nhóm đề bài / lớp (Master)`, icon: FolderKanban, tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" },
    { title: "Dự án đang thực hiện", value: data.statuses.IN_PROGRESS + data.statuses.SUBMITTED, note: `${data.statuses.IN_PROGRESS} đang làm · ${data.statuses.SUBMITTED} chờ chấm`, icon: Activity, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" },
  ];
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <Card key={metric.title} className="gap-4 border-slate-200/80 shadow-none dark:border-border">
      <CardContent><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{metric.title}</p><div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${metric.tone}`}><metric.icon className="size-[18px]" /></div></div>
        <p className="mt-3 text-[34px] leading-none font-semibold tracking-tight tabular-nums">{metric.value.toLocaleString("vi-VN")}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{metric.note}</p></CardContent>
    </Card>)}</div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="gap-5 shadow-none"><CardHeader><CardTitle className="text-base">Phân bố trạng thái dự án</CardTitle><p className="text-xs leading-5 text-muted-foreground">Mỗi dự án của team được thống kê một lần.</p></CardHeader>
        <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <div role="img" aria-label={`Tổng ${total} dự án. ${statuses.map(status => `${statusLabels[status]}: ${data.statuses[status]}`).join(". ")}`} className="relative flex size-44 shrink-0 items-center justify-center rounded-full" style={{ background: slices.length ? `conic-gradient(${slices.join(", ")})` : "var(--muted)" }}>
            <div className="flex size-32 flex-col items-center justify-center rounded-full bg-card"><strong className="text-3xl font-semibold tracking-tight tabular-nums">{total.toLocaleString("vi-VN")}</strong><span className="mt-1 text-xs text-muted-foreground">dự án của team</span></div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-1">{statuses.map(status => <li key={status}><button type="button" className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => onFilter({ status, ...(status === "CANCELLED" ? { includeCancelled: true } : {}) })} aria-label={`Lọc dự án ${statusLabels[status]}`}>
            <span className={`size-2.5 shrink-0 rounded-full ${statusColors[status]}`} /><span className="flex-1 text-muted-foreground group-hover:text-foreground">{statusLabels[status]}</span><strong className="text-sm font-semibold tabular-nums">{data.statuses[status]}</strong><ArrowUpRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button></li>)}</ul>
        </CardContent>
      </Card>
      <Card className="gap-5 shadow-none"><CardHeader><CardTitle className="text-base">Tiến độ và kết quả</CardTitle><p className="text-xs leading-5 text-muted-foreground">Tính trên toàn bộ dự án khớp bộ lọc, không chỉ trang đang xem.</p></CardHeader>
        <CardContent className="space-y-5">{[
          { title: "Tiến độ trung bình", value: s.averageProgress, icon: Activity, bar: "bg-blue-500", note: s.averageProgress === null ? "Chưa đủ dữ liệu hoặc cấu hình tiến độ." : "Trung bình tiến độ các dự án, loại dự án đã hủy." },
          { title: "Tỷ lệ hoàn thành", value: s.completionRate, icon: CircleCheck, bar: "bg-emerald-500", note: s.completionRate === null ? "Chưa có dự án triển khai trong kết quả." : "Hoàn thành / (Đang thực hiện + Chờ chấm + Hoàn thành)." },
        ].map(metric => <div key={metric.title}><div className="mb-2.5 flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-medium"><metric.icon className="size-4 text-muted-foreground" />{metric.title}</span><strong className="text-xl font-semibold tracking-tight tabular-nums">{percentage(metric.value)}</strong></div>
          <div role="progressbar" aria-label={metric.title} aria-valuenow={metric.value ?? undefined} aria-valuetext={metric.value === null ? metric.note : percentage(metric.value)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${metric.bar}`} style={{ width: `${Math.min(100, Math.max(0, metric.value ?? 0))}%` }} /></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{metric.note}</p></div>)}
          {s.missingProgressProjects > 0 && <p className="flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-400"><Info className="mt-0.5 size-3.5 shrink-0" />{s.missingProgressProjects} dự án thiếu cấu hình trọng số. Trạng thái và rủi ro vẫn được thống kê.</p>}
        </CardContent>
      </Card>
    </div>
    <Card className="gap-4 shadow-none"><CardHeader className="gap-1"><CardTitle className="flex items-center gap-2 text-base"><TriangleAlert className="size-4 text-amber-600" />Theo dõi rủi ro</CardTitle><p className="text-xs leading-5 text-muted-foreground">Sắp hạn có rủi ro: deadline trong {data.atRiskHours} giờ và tiến độ dưới {data.atRiskThreshold}%. Lịch sử nộp trễ được hiển thị riêng.</p></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">{[
        { title: "Đang quá hạn", value: s.overdueProjects, note: "Có milestone quá hạn chưa nộp", risk: undefined, icon: TriangleAlert, tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50/70 dark:bg-rose-950/20" },
        { title: "Sắp hạn có rủi ro", value: s.atRiskProjects, note: "Cần theo dõi tiến độ bàn giao", risk: "AT_RISK" as const, icon: Clock3, tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/70 dark:bg-amber-950/20" },
        { title: "Có lần nộp trễ", value: s.lateProjects, note: "Lịch sử, có thể đã được xử lý", risk: "LATE_SUBMISSION" as const, icon: Clock3, tone: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-900/40" },
      ].map(risk => <div key={risk.title} className={`flex items-center gap-3 rounded-xl p-4 text-left ${risk.bg}`}>
        <risk.icon className={`size-5 shrink-0 ${risk.tone}`} /><div className="min-w-0 flex-1"><p className="text-xs font-medium">{risk.title}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{risk.note}</p>{risk.risk && <button type="button" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-4" onClick={() => onFilter({ risk: risk.risk })}>Xem dự án<ArrowUpRight className="size-3" /></button>}</div><div className="text-right"><strong className={`text-2xl font-semibold tabular-nums ${risk.tone}`}>{risk.value}</strong><p className="text-[10px] text-muted-foreground">dự án</p></div>
      </div>)}</CardContent>
    </Card>
  </div>;
}
