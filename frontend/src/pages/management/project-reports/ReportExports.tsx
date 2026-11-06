import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import { projectReportApi } from "@/api/features/project-report.api";
import type { ReportExport, ReportFilters } from "@/types/features/project-report";
import { reportDate, reportError, reportErrorMessage } from "./report-ui";

const labels: Record<ReportExport["status"], string> = { QUEUED: "Đang tạo", RUNNING: "Đang tạo", READY: "Sẵn sàng tải", FAILED: "Tạo thất bại", EXPIRED: "Đã hết hạn" };
export function ReportExports({ owner, filters, timeZone, disabled }: { owner: string; filters: ReportFilters; timeZone: string; disabled: boolean }) {
  const client = useQueryClient(), key = ["project-report-exports", owner];
  const jobs = useQuery({ queryKey: key, queryFn: ({ signal }) => projectReportApi.exports(signal), retry: false, gcTime: 0,
    refetchInterval: query => query.state.data?.some(job => ["QUEUED", "RUNNING"].includes(job.status)) ? 2000 : 30000 });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const request = useRef<{ fingerprint: string; id: string }>();
  async function create(format: "EXCEL" | "CSV") {
    const fingerprint = JSON.stringify({ ...filters, page: 0, format });
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    setBusy(true); setMessage("");
    try {
      const job = await projectReportApi.createExport(filters, format, request.current.id);
      client.setQueryData<ReportExport[]>(key, previous => [job, ...(previous ?? []).filter(old => old.id !== job.id)].slice(0, 20));
      request.current = undefined; setMessage("Đã tiếp nhận yêu cầu. File sẽ xuất hiện trong danh sách bên dưới khi tạo xong.");
    } catch (error) { setMessage(await reportError(error)); } finally { setBusy(false); }
  }
  async function download(job: ReportExport) {
    setBusy(true); setMessage("");
    try { downloadBlob(await projectReportApi.download(job.id), job.fileName ?? `project-report.${job.format === "EXCEL" ? "xlsx" : "csv"}`); }
    catch (error) { setMessage(await reportError(error)); void jobs.refetch(); } finally { setBusy(false); }
  }
  return <Card className="gap-4 shadow-none"><CardHeader><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><FileDown className="size-5" /></div><div><CardTitle className="text-base">Xuất báo cáo</CardTitle><p className="mt-1.5 text-xs text-muted-foreground">Tải dữ liệu theo bộ lọc đang áp dụng.</p></div></div>
    <div className="flex gap-2"><Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={disabled || busy || jobs.isError} onClick={() => void create("EXCEL")}><FileSpreadsheet className="size-4" />Export Excel</Button>
      <Button variant="outline" disabled={disabled || busy || jobs.isError} onClick={() => void create("CSV")}><FileText className="size-4" />Export CSV</Button></div></div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Bao gồm tất cả dự án của team khớp bộ lọc, kể cả các trang khác. File được tạo nền và có thời hạn tải.</p></CardHeader>
    <CardContent className="space-y-3">{message && <p role="status" className="text-sm">{message}</p>}
      {jobs.isSuccess && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{jobs.data.filter(job => job.status === "READY").length} file sẵn sàng tải · {jobs.data.filter(job => ["QUEUED", "RUNNING"].includes(job.status)).length} file đang tạo.</p>}
      {jobs.isPending ? <p role="status">Đang tải danh sách file...</p> : jobs.isError ? <div><p role="alert" className="text-destructive">{reportErrorMessage(jobs.error)}</p><Button variant="outline" onClick={() => void jobs.refetch()}>Thử lại</Button></div>
        : !jobs.data.length ? <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center"><p className="text-sm font-medium">Chưa có file báo cáo</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Chọn Excel hoặc CSV để tạo file đầu tiên.</p></div> : <div className="divide-y rounded-xl border px-4">{jobs.data.map(job => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex min-w-0 items-start gap-3"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{job.format === "EXCEL" ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}</div><div className="min-w-0 space-y-1 text-sm"><p className="break-all font-medium">{job.fileName ?? `${job.format} · ${reportDate(job.createdAt, timeZone)}`}</p>
            <p className="text-xs text-muted-foreground">{job.rowCount !== null ? `${job.rowCount} Sub-project · ` : ""}{job.expiresAt ? `Hạn tải: ${reportDate(job.expiresAt, timeZone)}` : ""}</p>
            {job.message && <p className="text-xs text-destructive">{job.message}</p>}</div></div>
          <div className="flex items-center gap-3"><Badge variant="outline" className={job.status === "READY" ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "rounded-full"}>{labels[job.status]}</Badge>{job.status === "READY" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void download(job)}><Download className="size-3.5" />Tải file</Button>}</div>
        </div>)}</div>}
    </CardContent></Card>;
}
