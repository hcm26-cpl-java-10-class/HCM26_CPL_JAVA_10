import { FileCheck2, Flag } from "lucide-react";
import type { ReportDashboard } from "@/types/features/project-report";

const states = {
  PLANNED: { label: "Chưa bắt đầu", color: "#94a3b8" },
  DRAFT: { label: "Bản nháp", color: "#94a3b8" },
  IN_PROGRESS: { label: "Đang thực hiện", color: "#3b82f6" },
  SUBMITTED: { label: "Chờ duyệt", color: "#f59e0b" },
  ACCEPTED: { label: "Đã chấp nhận", color: "#10b981" },
  CHANGES_REQUESTED: { label: "Cần chỉnh sửa", color: "#f97316" },
  REJECTED: { label: "Bị từ chối", color: "#fb7185" },
  WAIVED: { label: "Được miễn", color: "#a78bfa" },
};

function StatusChart({ title, description, counts, kind }: {
  title: string; description: string; counts: Partial<Record<keyof typeof states, number>>; kind: "milestone" | "artifact";
}) {
  const entries = (Object.keys(states) as (keyof typeof states)[])
    .filter(state => counts[state] !== undefined && (state !== "WAIVED" || counts[state]! > 0))
    .map(state => ({ state, count: counts[state]!, ...states[state] }));
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  let offset = 0;
  const slices = entries.filter(entry => entry.count > 0).map(entry => {
    const start = offset;
    offset += entry.count / total * 100;
    return `${entry.color} ${start}% ${offset}%`;
  });
  const Icon = kind === "milestone" ? Flag : FileCheck2;
  return <section data-report-chart="status" aria-label={title} className="flex min-w-0 flex-col rounded-lg border border-slate-200/80 bg-card p-4 shadow-xs dark:border-border">
    <header className="mb-3 flex items-start gap-2">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1"><h2 className="text-xs font-semibold">{title}</h2><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p></div>
    </header>
    <div className="flex flex-1 items-center justify-center gap-4 sm:gap-6">
      <div data-report-donut role="img" aria-label={`${title}. Tổng ${total}. ${entries.map(entry => `${entry.label}: ${entry.count}`).join(". ")}`}
        className="flex size-28 shrink-0 items-center justify-center rounded-full"
        style={{ background: slices.length ? `conic-gradient(${slices.join(", ")})` : "var(--muted)" }}>
        <div data-report-donut-center className="flex size-22 min-w-0 flex-col items-center justify-center rounded-full bg-card">
          <strong className={"font-semibold leading-none tracking-tight tabular-nums " + (total >= 1000000 ? "text-sm" : total >= 10000 ? "text-lg" : "text-2xl")}>{total.toLocaleString("vi-VN")}</strong>
          <span className="mt-1.5 text-[10px] text-muted-foreground">{kind === "milestone" ? "Milestone" : "Bài nộp"}</span>
        </div>
      </div>
      <dl data-report-legend className="w-48 min-w-0 max-w-52 flex-initial space-y-1">
        {entries.map(entry => <div key={entry.state} className="flex items-center justify-between gap-4 py-0.5 text-xs">
          <dt className="flex min-w-0 items-center gap-2 text-muted-foreground"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} /><span>{entry.label}</span></dt>
          <dd className="shrink-0 font-semibold tabular-nums">{entry.count.toLocaleString("vi-VN")}</dd>
        </div>)}
      </dl>
    </div>
    {total === 0 && <p className="mt-3 text-xs text-muted-foreground">{kind === "milestone" ? "Chưa có milestone trong các Project và Workspace đang hoạt động khớp bộ lọc." : "Chưa có bản nháp hoặc bài nộp trong các Project và Workspace đang hoạt động khớp bộ lọc."}</p>}
  </section>;
}

export function ReportKpiStatuses({ overview }: { overview: ReportDashboard["overview"] }) {
  return <>
    <StatusChart kind="milestone" title="Trạng thái milestone" description="Milestone trong Project và Workspace đang hoạt động." counts={overview.milestoneStatuses} />
    <StatusChart kind="artifact" title="Trạng thái artifact / bài nộp" description="Bản nháp hoặc bài nộp mới nhất của mỗi milestone." counts={overview.artifactStatuses} />
  </>;
}
