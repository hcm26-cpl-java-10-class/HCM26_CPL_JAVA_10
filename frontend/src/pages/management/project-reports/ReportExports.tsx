import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import { projectReportApi } from "@/api/features/project-report.api";
import type { ReportExport, ReportFilters } from "@/types/features/project-report";
import { reportDate, reportError, reportErrorMessage } from "./report-utils";
import { reportStateStyle } from "./report-ui";

const labels: Record<ReportExport["status"], string> = { QUEUED: "Generating", RUNNING: "Generating", READY: "Ready to download", FAILED: "Export failed" };
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
      request.current = undefined;
    } catch (error) { setMessage(await reportError(error)); } finally { setBusy(false); }
  }
  async function download(job: ReportExport) {
    setBusy(true); setMessage("");
    try { downloadBlob(await projectReportApi.download(job.id), job.fileName ?? "project-report.xlsx"); }
    catch (error) { setMessage(await reportError(error)); void jobs.refetch(); } finally { setBusy(false); }
  }
  const ready = jobs.data?.filter(job => job.status === "READY").length ?? 0;
  const pending = jobs.data?.filter(job => ["QUEUED", "RUNNING"].includes(job.status)).length ?? 0;
  const summary = jobs.isError ? reportErrorMessage(jobs.error) : message || (jobs.isPending
    ? "Loading exports…" : jobs.data?.length ? `${ready} ready · ${pending} generating` : "No exports yet");
  return <Card data-report-exports className="gap-0 border-slate-200/80 py-3 shadow-xs dark:border-border">
    <CardContent className="flex flex-wrap items-center gap-3 px-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><FileDown className="size-4" /></div>
        <h2 className="shrink-0 text-sm font-semibold">Report exports</h2>
        <p role={jobs.isError ? "alert" : "status"} aria-live="polite" title={summary} className={`min-w-0 truncate text-[11px] ${jobs.isError ? "text-destructive" : "text-muted-foreground"}`}>{summary}</p>
      </div>
      <div className="ml-auto flex max-w-full items-center gap-2">
        {jobs.isError ? <Button size="sm" variant="outline" className="text-xs" onClick={() => void jobs.refetch()}>Retry</Button> : <DropdownMenu onOpenChange={open => { if (open) void jobs.refetch(); }}>
          <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="text-xs" disabled={busy || jobs.isPending} aria-label="Choose a report to download"><Download className="size-3.5" />Downloads<ChevronDown className="size-3.5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-[min(32rem,calc(100vw-2rem))]">
            <DropdownMenuLabel className="px-3 py-2"><p className="text-xs">Excel downloads</p><p className="mt-1 text-[11px] font-normal text-muted-foreground">Recent exports, newest first.</p></DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!jobs.data?.length ? <p className="px-3 py-4 text-xs text-muted-foreground">Choose Export Excel to create your first report.</p> : jobs.data.map(job => <DropdownMenuItem key={job.id} disabled={busy || job.status !== "READY"} onSelect={() => void download(job)} className="items-start gap-2.5 px-3 py-3">
              <FileSpreadsheet className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-xs font-medium" title={job.fileName ?? undefined}>{job.fileName ?? `Excel · ${reportDate(job.createdAt, timeZone)}`}</p>
                <p className="text-[11px] text-muted-foreground">{job.rowCount !== null ? `${job.rowCount} project rows · ` : ""}Created {reportDate(job.createdAt, timeZone)}</p>
                {job.message && <p className="whitespace-normal text-[11px] text-destructive">{job.message}</p>}
              </div>
              <Badge data-report-status={job.status} variant="outline" className={"shrink-0 rounded-full border-transparent text-[10px] " + reportStateStyle(job.status).surface}>{labels[job.status]}</Badge>
            </DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>}
        <Button size="sm" className="bg-emerald-600 text-xs text-white hover:bg-emerald-700" title="Export six Excel sheets using the applied filters across all pages." disabled={disabled || busy || jobs.isError} onClick={() => void create()}><FileSpreadsheet className="size-3.5" />Export Excel</Button>
      </div>
    </CardContent>
  </Card>;
}
