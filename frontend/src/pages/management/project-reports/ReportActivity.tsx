import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Activity, ArrowRight, FileCheck2, Flag, History, ListTodo } from "lucide-react";
import { projectReportApi } from "@/api/features/project-report.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ReportActivityPage, ReportFilters } from "@/types/features/project-report";
import { activityLabel, deliveryLabels, workLabels } from "./report-labels";
import { reportDate, reportErrorMessage } from "./report-utils";
import { ReportActivityHistory } from "./ReportActivityHistory";

export function ReportActivity({ initial, filters, owner, timeZone }: {
  initial: ReportActivityPage; filters: ReportFilters; owner: string; timeZone: string;
}) {
  const location = useLocation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const scope = { ...filters, page: undefined, size: undefined, workSprintId: undefined };
  const query = useQuery({
    queryKey: ["project-report-activity", owner, scope, "preview"],
    initialData: initial,
    queryFn: ({ signal }) => projectReportApi.activities(scope, 0, undefined, signal),
    retry: false, gcTime: 0, staleTime: 30_000, refetchInterval: 30_000, refetchIntervalInBackground: false,
  });
  const events = query.data.content.slice(0, 10);
  return <section data-report-activity aria-label="Hoạt động gần đây" className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
    <header className="shrink-0 border-b bg-violet-50/40 px-3 py-3 dark:bg-violet-950/15"><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-xs font-semibold"><Activity className="size-4 text-violet-500" />Hoạt động gần đây</h2>
      <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300" aria-label={`${events.length} hoạt động đang hiển thị`}>{events.length}</span></div>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Các Project/team khớp bộ lọc · Mới nhất trước.</p>
    </header>
    <div data-report-activity-scroll role="region" aria-label="Danh sách hoạt động" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
    {!events.length && !query.isError && <p className="px-4 py-8 text-center text-xs text-muted-foreground">Chưa có hoạt động nào được ghi nhận trong phạm vi này.</p>}
    <ol className="divide-y">{events.map(event => {
      const Icon = event.entityType === "SUBMISSION" ? FileCheck2 : event.entityType === "MILESTONE" ? Flag : ListTodo;
      return <li key={event.id} className="flex min-w-0 gap-2 py-2.5">
        <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="size-3 text-muted-foreground" /></span>
        <div className="min-w-0 flex-1 space-y-1 [overflow-wrap:anywhere]"><div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5"><p className="text-[11px] font-semibold leading-4">{event.actorName}</p><time className="text-[9px] leading-4 text-muted-foreground">{reportDate(event.occurredAt, timeZone)}</time></div>
          <p className="text-[10px] leading-4 text-muted-foreground">{activityLabel(event.action)}</p>
          <p className="text-xs font-medium leading-4">{event.subject}</p>
          <p className="text-[10px] leading-4 text-muted-foreground">{event.projectCode} · {event.projectName} · {event.teamName ?? "Phần việc dùng chung"}</p>
          {event.masterName !== event.projectName && <p className="text-[10px] leading-4 text-muted-foreground">Master: {event.masterName}</p>}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
              {event.beforeStatus && <span className="rounded bg-muted px-1.5 py-0.5">{workLabels[event.beforeStatus] ?? deliveryLabels[event.beforeStatus] ?? event.beforeStatus}</span>}
              {event.beforeStatus && event.afterStatus && <ArrowRight aria-hidden="true" className="size-3" />}
              {event.afterStatus && <span className="rounded bg-muted px-1.5 py-0.5">{workLabels[event.afterStatus] ?? deliveryLabels[event.afterStatus] ?? event.afterStatus}</span>}
            </div>
            {event.href && <Link to={event.href} state={{ returnTo: location.pathname + location.search }} className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">Xem chi tiết<ArrowRight className="size-3" /></Link>}
          </div>
        </div>
      </li>;
    })}</ol>
    </div>
    {query.isError && <div className="shrink-0 space-y-2 border-t p-3"><p role="alert" className="text-xs text-destructive">{reportErrorMessage(query.error)}</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Thử lại hoạt động</Button></div>}
    <footer className="flex shrink-0 flex-col items-start gap-2 border-t px-3 py-2.5"><span className="text-[9px] text-muted-foreground">Tối đa 10 hoạt động mới nhất · {reportDate(query.data.asOf, timeZone)}</span>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 w-full text-[11px]"><History className="size-3.5" />Xem lịch sử</Button></DialogTrigger>
        <DialogContent data-report-history-dialog className="flex max-h-[88dvh] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          {historyOpen && <ReportActivityHistory owner={owner} filters={scope} timeZone={timeZone} asOf={query.data.asOf} />}
        </DialogContent>
      </Dialog>
    </footer>
  </section>;
}
