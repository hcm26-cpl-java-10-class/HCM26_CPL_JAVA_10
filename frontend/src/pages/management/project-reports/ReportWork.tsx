import { BarChart3, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportDashboard } from "@/types/features/project-report";
import { reportDate } from "./report-utils";

export function ReportWork({ work, timeZone, onSelect }: { work: ReportDashboard["work"]; timeZone: string; onSelect: (id?: number) => void }) {
  const entries = [
    { label: "Todo", value: work.backlog.todo, color: "bg-slate-400" },
    { label: "In progress", value: work.backlog.inProgress, color: "bg-blue-500" },
    { label: "Review", value: work.backlog.review, color: "bg-amber-500" },
    { label: "Done", value: work.backlog.done, color: "bg-emerald-500" },
  ];
  const maximum = Math.max(1, ...entries.map(entry => entry.value));
  const selected = work.sprints.find(sprint => sprint.id === work.selectedSprintId);
  const statusLabels: Record<string, string> = { PLANNED: "Chưa bắt đầu", ACTIVE: "Đang chạy", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy" };
  return <section data-report-work className="space-y-3.5" aria-label="Phân bố công việc theo Sprint">
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-blue-500" />Phân bố trạng thái công việc</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Công việc chính trong phạm vi đang lọc, không cộng task con. Tổng <strong className="font-medium text-foreground">{work.backlog.total.toLocaleString("vi-VN")}</strong> công việc.</p></div>
        <Select value={work.selectedSprintId?.toString() ?? "all"} onValueChange={value => onSelect(value === "all" ? undefined : Number(value))}>
          <SelectTrigger aria-label="Sprint cho phân bố công việc" className="w-full min-w-0 sm:max-w-sm"><SelectValue placeholder="Tất cả công việc" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tất cả công việc</SelectItem>{work.sprints.map(sprint => <SelectItem key={sprint.id} value={String(sprint.id)}>{sprint.name} · {sprint.teamName ?? sprint.projectName}</SelectItem>)}</SelectContent>
        </Select>
      </header>
      <p className="mt-2 text-[11px] text-muted-foreground">Lựa chọn Sprint áp dụng cho phần công việc và dữ liệu Sprint trong Excel; KPI dự án và hoạt động vẫn theo bộ lọc chung.</p>
      <div className="mt-5 grid gap-4" role="img" aria-label={entries.map(entry => `${entry.label}: ${entry.value} công việc`).join(". ")}>
        {entries.map(entry => <div key={entry.label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 text-xs sm:grid-cols-[110px_minmax(0,1fr)_auto]">
          <span className="font-medium">{entry.label}</span><div className="h-7 overflow-hidden rounded bg-muted/50"><div className={`h-full rounded ${entry.color}`} style={{ width: `${entry.value / maximum * 100}%` }} /></div>
          <strong className="min-w-11 text-right text-lg font-semibold tabular-nums">{entry.value.toLocaleString("vi-VN")}</strong>
        </div>)}
      </div>
      {work.backlog.total === 0 && <p className="mt-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">Chưa có công việc {selected ? "trong Sprint này" : "khớp bộ lọc"}.</p>}
    </div>
    <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarRange className="size-4 text-muted-foreground" />Các Sprint trong phạm vi</h2><span className="text-xs text-muted-foreground">{work.sprints.length} Sprint</span></header>
      {!work.sprints.length ? <p className="p-6 text-sm text-muted-foreground">Chưa có Sprint khớp bộ lọc.</p> : <div className="overflow-x-auto"><Table className="min-w-[780px]"><TableHeader><TableRow>
        {["Sprint / Project", "Team", "Trạng thái", "Thời gian", "Todo", "In progress", "Review", "Done", ""].map((label, i) => <TableHead key={i} className="text-xs">{label}</TableHead>)}
      </TableRow></TableHeader><TableBody>{work.sprints.map(sprint => <TableRow key={sprint.id} className={selected?.id === sprint.id ? "bg-muted/50" : ""}>
        <TableCell className="max-w-64 whitespace-normal"><p className="text-xs font-medium">{sprint.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{sprint.projectName}</p></TableCell>
        <TableCell className="text-xs">{sprint.teamName ?? "Dùng chung"}</TableCell><TableCell className="text-xs">{statusLabels[sprint.status] ?? sprint.status}</TableCell>
        <TableCell className="text-[11px] text-muted-foreground"><p>{reportDate(sprint.startAt, timeZone)}</p><p>{reportDate(sprint.endAt, timeZone)}</p></TableCell>
        {[sprint.backlog.todo, sprint.backlog.inProgress, sprint.backlog.review, sprint.backlog.done].map((count, i) => <TableCell key={i} className="text-xs font-medium tabular-nums">{count.toLocaleString("vi-VN")}</TableCell>)}
        <TableCell><Button variant="ghost" size="sm" className="text-xs" onClick={() => onSelect(selected?.id === sprint.id ? undefined : sprint.id)}>{selected?.id === sprint.id ? "Bỏ chọn" : "Xem phân bố"}</Button></TableCell>
      </TableRow>)}</TableBody></Table></div>}
    </div>
  </section>;
}
