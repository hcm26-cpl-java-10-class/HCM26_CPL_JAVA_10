import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import { projectReportApi } from "@/api/features/project-report.api";
import type { ReportExport, ReportFilters } from "@/types/features/project-report";
import { reportDate, reportError, reportErrorMessage } from "./report-utils";

const labels: Record<ReportExport["status"], string> = { QUEUED: "Đang tạo", RUNNING: "Đang tạo", READY: "Sẵn sàng tải", FAILED: "Tạo thất bại", EXPIRED: "Đã hết hạn" };
export function ReportExports({ owner, filters, timeZone, disabled }: { owner: string; filters: ReportFilters; timeZone: string; disabled: boolean }) {
  const client = useQueryClient(), key = ["project-report-exports", owner];
  const jobs = useQuery({ queryKey: key, queryFn: ({ signal }) => projectReportApi.exports(signal), retry: false, gcTime: 0,
    select: rows => rows.filter(job => job.format === "EXCEL"),
    refetchInterval: query => query.state.data?.some(job => job.format === "EXCEL" && ["QUEUED", "RUNNING"].includes(job.status)) ? 2000 : 30000 });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const request = useRef<{ fingerprint: string; id: string }>();
  async function create() {
    const fingerprint = JSON.stringify({ ...filters, page: 0 });
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    setBusy(true); setMessage("");
    try {
      const job = await projectReportApi.createExport(filters, request.current.id);
      client.setQueryData<ReportExport[]>(key, previous => [job, ...(previous ?? []).filter(old => old.id !== job.id)].slice(0, 20));
      request.current = undefined; setMessage("Đã tiếp nhận yêu cầu. File sẽ xuất hiện trong danh sách bên dưới khi tạo xong.");
    } catch (error) { setMessage(await reportError(error)); } finally { setBusy(false); }
  }
  async function download(job: ReportExport) {
    setBusy(true); setMessage("");
    try { downloadBlob(await projectReportApi.download(job.id), job.fileName ?? "project-report.xlsx"); }
    catch (error) { setMessage(await reportError(error)); void jobs.refetch(); } finally { setBusy(false); }
  }
  return <Card className="gap-3 border-slate-200/80 py-4 shadow-xs dark:border-border"><CardHeader className="gap-2 px-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5"><div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><FileDown className="size-[18px]" /></div><div><CardTitle className="text-sm">Xuất báo cáo</CardTitle><p className="mt-1 text-[11px] text-muted-foreground">Tải dữ liệu theo bộ lọc đang áp dụng.</p></div></div>
    <Button size="sm" className="bg-emerald-600 text-xs text-white hover:bg-emerald-700" disabled={disabled || busy || jobs.isError} onClick={() => void create()}><FileSpreadsheet className="size-3.5" />Export Excel</Button></div>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Bao gồm Master và Sub-project khớp bộ lọc trên tất cả các trang. Excel gồm một sheet với 7 cột phân công, trạng thái và tiến độ milestone. File được tạo nền và có thời hạn tải.</p></CardHeader>
    <CardContent className="space-y-3 px-4 sm:px-5">{message && <p role="status" className="text-xs">{message}</p>}
      {jobs.isSuccess && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{jobs.data.filter(job => job.status === "READY").length} file sẵn sàng tải · {jobs.data.filter(job => ["QUEUED", "RUNNING"].includes(job.status)).length} file đang tạo.</p>}
      {jobs.isPending ? <p role="status">Đang tải danh sách file...</p> : jobs.isError ? <div><p role="alert" className="text-destructive">{reportErrorMessage(jobs.error)}</p><Button variant="outline" onClick={() => void jobs.refetch()}>Thử lại</Button></div>
        : !jobs.data.length ? <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-center"><p className="text-xs font-medium">Chưa có file báo cáo</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Chọn Export Excel để tạo file đầu tiên.</p></div> : <div className="divide-y rounded-lg border px-3">{jobs.data.map(job => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-start gap-2.5"><div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FileSpreadsheet className="size-3.5" /></div><div className="min-w-0 space-y-1 text-xs"><p className="break-all font-medium">{job.fileName ?? `Excel · ${reportDate(job.createdAt, timeZone)}`}</p>
            <p className="text-xs text-muted-foreground">{job.rowCount !== null ? `${job.rowCount} dòng Project · ` : ""}{job.expiresAt ? `Hạn tải: ${reportDate(job.expiresAt, timeZone)}` : ""}</p>
            {job.message && <p className="text-xs text-destructive">{job.message}</p>}</div></div>
          <div className="flex items-center gap-3"><Badge variant="outline" className={job.status === "READY" ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "rounded-full"}>{labels[job.status]}</Badge>{job.status === "READY" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void download(job)}><Download className="size-3.5" />Tải file</Button>}</div>
        </div>)}</div>}
    </CardContent></Card>;
}
