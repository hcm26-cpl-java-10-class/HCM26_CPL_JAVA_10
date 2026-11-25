import { Button } from "@/components/ui/button";
import { ArrowLeft, FileBarChart, Download, RotateCcw } from "lucide-react";
import { dateText, rangeText, reportBlocks, sectionLabels, translator } from "./report-content";
import type { ReportDetail } from "./report-api";

export function ReportView({ detail, busy, aiAvailable, onBack, onPdf, onExcel, onRetry, onUpdate }: {
  detail: ReportDetail; busy: boolean; aiAvailable: boolean; onBack: () => void; onPdf: () => void;
  onExcel: () => void; onRetry: () => void; onUpdate: () => void;
}) {
  const { report, snapshot } = detail;
  const t = translator(report.language);
  const overview = snapshot.overview;
  const study = snapshot.study;
  const tracks = overview ? [overview.completed, overview.inProgress, overview.notStarted, overview.unknown] : [];
  const total = tracks.reduce((a, b) => a + b, 0);
  const palette = ["#16934d", "#2563eb", "#94a3b8", "#d9e1ea"];
  let offset = 0;
  const wedges = tracks.map((count, index) => {
    const start = offset;
    offset += total ? count / total * 100 : 0;
    return palette[index] + " " + start + "% " + offset + "%";
  }).join(", ");
  const scale = Math.max(1, ...study?.weeks.flatMap(week => [week.actualSeconds, week.plannedSeconds ?? 0]) ?? []);

  return <article className="rounded-xl border bg-card p-4 sm:p-6">
    <Button variant="ghost" onClick={onBack}><ArrowLeft /> {t("Report history", "Lịch sử báo cáo")}</Button>
    <header className="mt-4 flex flex-wrap items-start gap-3 border-b pb-5">
      <span className="rounded-xl bg-primary/10 p-3 text-primary"><FileBarChart size={22} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-2xl font-semibold">{report.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{rangeText(report)}{report.periodToDate && " · " + t("Period to date", "Đến hiện tại")}</p>
        <p className="mt-2 text-sm">{snapshot.learner}{snapshot.roadmap?.goal && " · " + snapshot.roadmap.goal}</p>
        <p className="text-xs text-muted-foreground">{t("Generated ", "Tạo lúc ")}{dateText(report.generatedAt, report.language, report.zone)} · {report.zone}</p>
      </div>
    </header>
    {reportBlocks(detail).map((block, index) => <section key={block.title} className="border-b py-5">
      <h3 className="mb-3 font-semibold">{block.title}</h3>
      {index === 0 && overview && total > 0 && <div className="mb-4 flex flex-wrap items-center gap-5">
        <div aria-hidden="true" className="grid size-24 shrink-0 place-items-center rounded-full"
          style={{ background: "conic-gradient(" + wedges + ")" }}>
          <span className="grid size-17 place-items-center rounded-full bg-card text-sm font-semibold tabular-nums">
            {Math.round(overview.completionRate ?? 0)}%
          </span>
        </div>
        <ul className="space-y-1 text-sm">{[
          t("Completed", "Hoàn thành"), t("In progress", "Đang học"),
          t("Not started", "Chưa bắt đầu"), t("Unknown", "Chưa có dữ liệu"),
        ].map((status, i) => <li key={status} className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: palette[i] }} />
          {status} <span className="font-medium tabular-nums">{tracks[i]}</span>
        </li>)}</ul>
      </div>}
      {block.rows.length ? <dl className="divide-y text-sm">
        {block.rows.map(([name, value], row) => <div key={row} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] sm:gap-3">
          <dt className={name ? "break-words font-medium" : "sr-only"}>{name || t("Note", "Ghi chú")}</dt>
          <dd className="min-w-0 break-words text-muted-foreground">
            {value}
            {block.title === t(...sectionLabels.COURSES) && snapshot.courses?.[row]?.percent != null &&
              <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary"
                style={{ width: Math.min(100, snapshot.courses[row].percent ?? 0) + "%" }} /></div>}
          </dd>
        </div>)}
      </dl> : <p className="text-sm text-muted-foreground">{t("No data available for this section.", "Chưa có dữ liệu cho phần này.")}</p>}
      {study && block.title === t(...sectionLabels.STUDY) && <>
        <div aria-hidden="true" className="mt-4 grid max-w-lg grid-cols-7 gap-1">
          {study.days.map(day => <div key={day.date} title={day.date + " · " + (day.seconds / 60).toFixed(1) + " min"}
            className={"h-3 rounded " + (day.active ? "bg-emerald-600" : day.seconds ? "bg-emerald-600/35" : "bg-muted")} />)}
        </div>
        <details className="mt-3 text-sm"><summary className="cursor-pointer">{t("Daily activity", "Hoạt động từng ngày")}</summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-muted-foreground">
            {study.days.map(day => <li key={day.date}>{dateText(day.date, report.language)} · {(day.seconds / 60).toFixed(1)} min</li>)}
          </ul>
        </details>
      </>}
      {study && block.title === t("Planned vs. recorded by week", "Kế hoạch và thời gian ghi theo tuần") &&
        <div aria-hidden="true" className="mt-4 max-h-44 space-y-2 overflow-auto">
          {study.weeks.map(week => <div key={week.start} className="space-y-0.5">
            <div className="h-1.5 rounded bg-blue-600/65" style={{ width: ((week.plannedSeconds ?? 0) / scale * 100) + "%" }} />
            <div className="h-1.5 rounded bg-emerald-600" style={{ width: (week.actualSeconds / scale * 100) + "%" }} />
          </div>)}
        </div>}
      {block.title === t(...sectionLabels.AI) && report.retryable && aiAvailable &&
        <Button className="mt-3" variant="outline" disabled={busy} onClick={onRetry}><RotateCcw />{t("Retry AI analysis", "Thử phân tích lại")}</Button>}
    </section>)}
    <footer className="mt-5 flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={onUpdate}>{t("Generate updated report", "Tạo báo cáo cập nhật")}</Button>
      <Button variant="outline" disabled={busy} onClick={onExcel}><Download /> XLSX</Button>
      <Button disabled={busy} onClick={onPdf}><Download /> PDF</Button>
    </footer>
  </article>;
}
